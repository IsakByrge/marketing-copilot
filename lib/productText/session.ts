// ─────────────────────────────────────────────────────────────
// Arbetspasset: katalogen, arbetsläget per artikel, och de härledningar
// listan och godkännandevyn behöver.
//
// Allt här är rena funktioner över data. Var passet FÖRVARAS (IndexedDB i
// webbläsaren) bor i app/produkttexter/_lib/db.ts — filen lämnar aldrig
// datorn och hamnar aldrig i vår databas.
//
// Testas i pipeline.test.mts.
// ─────────────────────────────────────────────────────────────
import type { ColumnGuess, Row } from "./csv";
import { toPlainText, visibleLength } from "./html";
import { missingHardFacts, uncoveredFacts, type ListedFact } from "./hardFacts";
import { pickTemplate, type TemplateId } from "./templates";
import type { PageResult } from "./pageFacts";

/** Arbetsläget för EN artikel. Bara det vi själva skapat — aldrig CSV-raden. */
export interface WorkItem {
  /** Vald mall. Sätts automatiskt vid inläsning, kan ändras per artikel. */
  template: TemplateId;
  /** Redigerad HTML. Finns när en text är skriven. */
  description?: string;
  /** AI:ns oredigerade version. Skillnaden mot `description` lär oss stilen. */
  original?: string;
  metaTitle?: string;
  metaDescription?: string;
  /** Uppgifter som saknades. Icke-tom = "Behöver uppgifter". */
  needsInfo?: string[];
  /** Modellens egen faktalista med nyckelord. Kontrolleras mot texten. */
  facts?: ListedFact[];
  approved?: boolean;
}

/** Ett helt arbetspass, som det sparas i webbläsaren. */
export interface Session {
  fileName: string;
  headers: string[];
  delimiter: string;
  rows: Row[];
  cols: ColumnGuess;
  items: Record<string, WorkItem>;
  /**
   * Hämtade produktsidor, artikelnummer → resultat. Cachen för passet:
   * varje sida hämtas en gång, aldrig om, varken vid omgenerering eller
   * efter en omladdning.
   */
  sources: Record<string, PageResult>;
  savedAt: number;
}

/** En artikel som listan och godkännandevyn arbetar med. */
export interface Product {
  id: string;
  name: string;
  category: string;
  subCategory: string;
  producer: string;
  model: string;
  /** Butikens nuvarande beskrivning, som HTML med entiteter. */
  current: string;
  /** Synliga tecken i den nuvarande texten. */
  currentLength: number;
  /** Lagersaldo, `null` när kolumnen saknas eller inte är ett tal. */
  stock: number | null;
  /** Produktsidans adress, tom när kolumnen saknas. */
  url: string;
}

const cell = (row: Row, column: string | null): string =>
  column ? (row[column] ?? "").trim() : "";

/** Tolkar ett lagersaldo. "12", "12,0" och "12 st" blir 12; "" blir null. */
export function parseStock(value: string): number | null {
  const m = (value ?? "").replace(",", ".").match(/-?\d+(\.\d+)?/);
  if (!m) return null;
  const n = Number(m[0]);
  return Number.isFinite(n) ? Math.trunc(n) : null;
}

/** Bygger artikellistan ur CSV-raderna och kolumnvalen. */
export function buildProducts(rows: Row[], cols: ColumnGuess): Product[] {
  if (!cols.id || !cols.name) return [];
  const out: Product[] = [];
  for (const row of rows) {
    const id = cell(row, cols.id);
    const name = cell(row, cols.name);
    if (!id || !name) continue;
    const current = cols.description ? (row[cols.description] ?? "") : "";
    out.push({
      id,
      name,
      category: cell(row, cols.group),
      subCategory: cell(row, cols.subGroup),
      producer: cell(row, cols.producer),
      model: cell(row, cols.model),
      current,
      currentLength: visibleLength(current),
      stock: cols.stock ? parseStock(cell(row, cols.stock)) : null,
      url: cell(row, cols.url),
    });
  }
  return out;
}

/** Ger varje artikel en automatiskt vald mall. Befintliga val behålls. */
export function initialItems(
  products: Product[],
  existing: Record<string, WorkItem> = {},
): Record<string, WorkItem> {
  const items: Record<string, WorkItem> = {};
  for (const p of products) {
    items[p.id] = existing[p.id] ?? {
      template: pickTemplate({ category: p.category, subCategory: p.subCategory, name: p.name }),
    };
  }
  return items;
}

// ── Nyckeltal ───────────────────────────────────────────────

export interface CatalogStats {
  total: number;
  /** Artiklar helt utan beskrivning. */
  missing: number;
  /** Artiklar med text under gränsen, men inte tomma. */
  thin: number;
  /** Artiklar med text över gränsen. */
  ok: number;
  /** Medianlängd i tecken — säger mer om katalogen än ett medelvärde. */
  median: number;
}

export function catalogStats(products: Product[], thinLimit: number): CatalogStats {
  let missing = 0;
  let thin = 0;
  for (const p of products) {
    if (p.currentLength === 0) missing++;
    else if (p.currentLength < thinLimit) thin++;
  }
  const lengths = products.map((p) => p.currentLength).sort((a, b) => a - b);
  const median = lengths.length === 0
    ? 0
    : lengths.length % 2 === 1
      ? lengths[(lengths.length - 1) / 2]
      : Math.round((lengths[lengths.length / 2 - 1] + lengths[lengths.length / 2]) / 2);
  return { total: products.length, missing, thin, ok: products.length - missing - thin, median };
}

// ── Filtrering och sortering ────────────────────────────────

export type StatusFilter = "alla" | "saknar" | "tunn" | "utkast" | "behover" | "godkand";
export type SortKey = "length" | "name" | "category" | "stock";
export type SortDir = "asc" | "desc";

export interface Filters {
  query: string;
  category: string;
  status: StatusFilter;
  template: TemplateId | "alla";
}

export const EMPTY_FILTERS: Filters = {
  query: "",
  category: "",
  status: "alla",
  template: "alla",
};

/** Var artikeln står just nu. Styr både filter och märket i listan. */
export type ItemState = "saknar" | "tunn" | "ok" | "utkast" | "behover" | "godkand";

/**
 * Det utkastet tappat: tal med enhet och förkortningar ur före-texten, och
 * uppgifter ur modellens egen faktalista vars nyckelord inte står i texten.
 * Räknas om från texten varje gång, så att varningen försvinner när du
 * själv skriver in det som fattades.
 */
export function lostFacts(p: Product, item: WorkItem | undefined): string[] {
  if (!item?.description) return [];
  const draft = toPlainText(item.description);
  return [
    ...missingHardFacts(toPlainText(p.current), draft),
    ...uncoveredFacts(item.facts, draft),
  ];
}

export function itemState(p: Product, item: WorkItem | undefined, thinLimit: number): ItemState {
  if (item?.approved) return "godkand";
  if (item?.needsInfo && item.needsInfo.length > 0) return "behover";
  if (lostFacts(p, item).length > 0) return "behover";
  if (item?.description) return "utkast";
  if (p.currentLength === 0) return "saknar";
  return p.currentLength < thinLimit ? "tunn" : "ok";
}

const matchesStatus = (state: ItemState, filter: StatusFilter): boolean =>
  filter === "alla" || state === filter;

export function filterProducts(
  products: Product[],
  items: Record<string, WorkItem>,
  filters: Filters,
  thinLimit: number,
): Product[] {
  const q = filters.query.trim().toLowerCase();
  return products.filter((p) => {
    const item = items[p.id];
    if (!matchesStatus(itemState(p, item, thinLimit), filters.status)) return false;
    if (filters.category && p.category !== filters.category) return false;
    if (filters.template !== "alla" && item?.template !== filters.template) return false;
    if (q && !`${p.name} ${p.id} ${p.model}`.toLowerCase().includes(q)) return false;
    return true;
  });
}

/**
 * Sorterar en kopia. Saknat lagersaldo hamnar alltid sist, oavsett riktning:
 * "okänt" är inte detsamma som noll och ska inte toppa listan.
 */
export function sortProducts(products: Product[], key: SortKey, dir: SortDir): Product[] {
  const sign = dir === "asc" ? 1 : -1;
  const collator = new Intl.Collator("sv");
  return [...products].sort((a, b) => {
    if (key === "stock") {
      if (a.stock === null && b.stock === null) return collator.compare(a.name, b.name);
      if (a.stock === null) return 1;
      if (b.stock === null) return -1;
      return (a.stock - b.stock) * sign || collator.compare(a.name, b.name);
    }
    if (key === "length") return (a.currentLength - b.currentLength) * sign || collator.compare(a.name, b.name);
    if (key === "category") return collator.compare(a.category, b.category) * sign || collator.compare(a.name, b.name);
    return collator.compare(a.name, b.name) * sign;
  });
}

/** Unika kategorier i bokstavsordning, för filtermenyn. */
export function categoriesOf(products: Product[]): string[] {
  return [...new Set(products.map((p) => p.category).filter(Boolean))]
    .sort((a, b) => new Intl.Collator("sv").compare(a, b));
}

/** Artiklar som är godkända och har både text och meta — de som exporteras. */
export function approvedFor(
  items: Record<string, WorkItem>,
): Record<string, { description: string; metaTitle: string; metaDescription: string }> {
  const out: Record<string, { description: string; metaTitle: string; metaDescription: string }> = {};
  for (const [id, item] of Object.entries(items)) {
    if (!item.approved || !item.description) continue;
    out[id] = {
      description: item.description,
      metaTitle: item.metaTitle ?? "",
      metaDescription: item.metaDescription ?? "",
    };
  }
  return out;
}

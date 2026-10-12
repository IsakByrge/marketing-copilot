// ─────────────────────────────────────────────────────────────
// Från lästa sidor till förslag på Company Brain.
//
// Modellen sammanfattar; koden kontrollerar. Varje förslag måste ange
// vilken sida det kommer från, och varje siffra (pris, adress,
// öppettider) måste stå på just den sidan. Det som inte klarar
// kontrollen tas bort — hellre ett tomt fält än ett påhittat pris.
//
// Ren modul, testas i siteReader.test.mts.
// ─────────────────────────────────────────────────────────────
import type { PageExtract } from "./pages";

export const DRAFT_LIMITS = { PRODUCTS: 15, LOCATIONS: 20, LIST: 6 } as const;

export interface DraftProduct {
  name: string;
  category?: string;
  description?: string;
  /** Pris eller prisintervall som det står på sidan, t.ex. "1 012–6 990 kr". */
  priceInfo?: string;
  /** Namngivna modeller eller varianter, högst sex. */
  examples: string[];
  source: string;
}

export interface DraftLocation {
  city: string;
  address?: string;
  openingHours?: string;
  source: string;
}

export interface BrainDraft {
  summary?: string;
  customers: string[];
  usps: string[];
  tone: string[];
  products: DraftProduct[];
  locations: DraftLocation[];
  /** Sidorna förslaget bygger på. */
  sources: string[];
}

export const SITE_READER_SYSTEM = `Du läser ett svenskt företags egen hemsida och webbshop och sammanfattar vad företaget är, säljer och var det finns.
Svara ALLTID med exakt giltig JSON. Svara på svenska.`;

export function siteReaderPrompt(corpus: string, companyName: string): string {
  return `Nedan står text från ${companyName || "företagets"} egna webbsidor. Varje sida börjar
med "=== SIDA: <adress>".

REGLER:
- Skriv BARA det som står på sidorna. Ingen gissning, ingen allmän
  kunskap om branschen, inga omdömen eller siffror som inte står där.
- Varje produkt och plats ska ha "source": adressen till sidan där
  uppgiften står, kopierad exakt från en "=== SIDA:"-rad.
- Priser, adresser och öppettider skrivs EXAKT som på sidan. Står de inte
  där: utelämna fältet. Ett rabatterat pris är det nuvarande priset.
- Produkter: slå ihop till högst ${DRAFT_LIMITS.PRODUCTS} produktgrupper eller tjänster som
  företaget faktiskt lever på (t.ex. "Gasolkaminer", "Kaminservice"),
  inte enskilda reservdelar. Ange prisintervallet för gruppen om priser
  står, och upp till sex modellnamn som exempel.
- Platser: varje butik, depå eller verkstad med ort, och adress och
  öppettider om de står.
- "usps": det företaget självt säger skiljer dem från andra, med deras
  egna ord. Högst ${DRAFT_LIMITS.LIST}.
- "tone": två till fyra ord om hur sajten låter (t.ex. "rak", "folklig").
- "customers": vilka sajten vänder sig till, högst ${DRAFT_LIMITS.LIST}.

SIDORNA:
${corpus}

Svara med EXAKT denna JSON:
{
  "summary": "2–3 meningar: vad företaget gör, för vilka och hur",
  "customers": ["..."],
  "usps": ["..."],
  "tone": ["..."],
  "products": [
    { "name": "...", "category": "...", "description": "en mening ur sidan", "priceInfo": "...", "examples": ["..."], "source": "https://..." }
  ],
  "locations": [
    { "city": "...", "address": "...", "openingHours": "...", "source": "https://..." }
  ]
}`;
}

const s = (v: unknown, max = 300): string => (typeof v === "string" ? v.replace(/\s+/g, " ").trim().slice(0, max) : "");
const list = (v: unknown, n: number, max = 160): string[] =>
  Array.isArray(v) ? [...new Set(v.map((x) => s(x, max)).filter(Boolean))].slice(0, n) : [];

/** Siffror i en text, utan mellanrum: "1 012–6 990 kr" → ["1012", "6990"]. */
export function numbersIn(text: string): string[] {
  return (text.replace(/(\d)[\s .](?=\d{3}\b)/g, "$1").match(/\d+/g) ?? []);
}

/** Sant när varje tal i `value` står på sidan. Utan tal: sant. */
export function numbersOnPage(value: string, page: string): boolean {
  const onPage = new Set(numbersIn(page));
  return numbersIn(value).every((n) => onPage.has(n));
}

function normUrl(u: string): string {
  return u.trim().replace(/#.*$/, "").replace(/\/$/, "").replace(/^https?:\/\/(www\.)?/i, "").toLowerCase();
}

/**
 * Modellens svar → förslag som klarat kontrollen. Allt som saknar en
 * läst källa faller bort; ett pris, en adress eller öppettider vars
 * siffror inte står på källsidan tas bort, medan resten av posten
 * behålls.
 */
export function validateDraft(raw: unknown, pages: PageExtract[]): BrainDraft {
  const o = (raw && typeof raw === "object") ? raw as Record<string, unknown> : {};
  const pageText = new Map<string, string>();
  for (const p of pages) {
    pageText.set(normUrl(p.url), [p.title, p.description, ...p.structured, p.text].join("\n"));
  }
  const all = [...pageText.values()].join("\n");
  const sourceOf = (v: unknown): { url: string; text: string } | null => {
    const url = s(v, 500);
    const text = url ? pageText.get(normUrl(url)) : undefined;
    return text !== undefined ? { url, text } : null;
  };

  const products: DraftProduct[] = [];
  for (const p of Array.isArray(o.products) ? o.products : []) {
    const r = (p && typeof p === "object") ? p as Record<string, unknown> : {};
    const name = s(r.name, 120);
    const src = sourceOf(r.source);
    if (!name || !src) continue;
    const priceInfo = s(r.priceInfo, 80);
    products.push({
      name,
      category: s(r.category, 80) || undefined,
      description: s(r.description, 400) || undefined,
      priceInfo: priceInfo && numbersIn(priceInfo).length && numbersOnPage(priceInfo, all) ? priceInfo : undefined,
      // Modellnamn ska stå någonstans i det lästa, annars är de påhittade.
      examples: list(r.examples, 6, 80).filter((e) => all.toLowerCase().includes(e.toLowerCase())),
      source: src.url,
    });
    if (products.length >= DRAFT_LIMITS.PRODUCTS) break;
  }

  const locations: DraftLocation[] = [];
  for (const l of Array.isArray(o.locations) ? o.locations : []) {
    const r = (l && typeof l === "object") ? l as Record<string, unknown> : {};
    const city = s(r.city, 80);
    const src = sourceOf(r.source);
    if (!city || !src) continue;
    if (!src.text.toLowerCase().includes(city.toLowerCase())) continue;
    const address = s(r.address, 160);
    const hours = s(r.openingHours, 200);
    locations.push({
      city,
      address: address && numbersOnPage(address, src.text) ? address : undefined,
      openingHours: hours && numbersOnPage(hours, src.text) ? hours : undefined,
      source: src.url,
    });
    if (locations.length >= DRAFT_LIMITS.LOCATIONS) break;
  }

  return {
    summary: s(o.summary, 600) || undefined,
    customers: list(o.customers, DRAFT_LIMITS.LIST),
    usps: list(o.usps, DRAFT_LIMITS.LIST, 200),
    tone: list(o.tone, 4, 40),
    products,
    locations,
    sources: pages.map((p) => p.url),
  };
}

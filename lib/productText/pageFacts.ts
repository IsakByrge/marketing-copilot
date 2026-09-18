// ─────────────────────────────────────────────────────────────
// Underlag hämtat från butikens egen produktsida.
//
// Exporten har en URL per artikel. Sidan innehåller det som CSV:n inte
// har: specifikationstabellen, tillverkaren, dokumenten. Att skriva av
// den är att belägga, inte att gissa — och det är hela skillnaden mellan
// en text vi vågar publicera och en vi inte vågar.
//
// TVÅ SAKER ATT HÅLLA ISÄR:
//   • Vi litar på sidan som FAKTAKÄLLA för den här artikeln.
//   • Vi litar ALDRIG på den som INSTRUKTION. Texten går in i prompten
//     som citerat underlag, uttryckligen märkt att den inte får lydas.
//     En produktsida kan innehålla "ignorera tidigare instruktioner",
//     medvetet eller av misstag.
//
// Ren logik utan nätverk: HTML in, fakta ut. Hämtningen sker i
// app/api/product-texts/source. Testas i source.test.mts.
// ─────────────────────────────────────────────────────────────
import { decodeEntities } from "./html";

export interface SpecRow {
  label: string;
  value: string;
}

export interface PageDocument {
  label: string;
  url: string;
}

export interface PageFacts {
  url: string;
  title?: string;
  /** Sidans egen beskrivningstext, som ren text. */
  description?: string;
  specs: SpecRow[];
  producer?: string;
  articleNumber?: string;
  documents: PageDocument[];
}

/** Ett misslyckat hämtningsförsök. Sparas också, så vi inte försöker om i onödan. */
export interface PageFetchError {
  url: string;
  /** Kort svensk förklaring, visas i gränssnittet. */
  reason: string;
}

export type PageResult =
  | ({ ok: true } & PageFacts)
  | ({ ok: false } & PageFetchError);

// ── Gränser ─────────────────────────────────────────────────

export const MAX_DESCRIPTION = 2_500;
export const MAX_SPECS = 40;
export const MAX_SPEC_LEN = 200;
export const MAX_DOCUMENTS = 8;

/** Block vars innehåll aldrig är produktfakta. Tas bort före allt annat. */
const STRIP_BLOCKS = [
  "script", "style", "noscript", "template", "svg", "nav", "header",
  "footer", "form", "aside", "select", "button",
];

/** Tar bort ett helt element inklusive innehåll, oavsett attribut. */
function stripBlock(html: string, tag: string): string {
  return html.replace(new RegExp(`<${tag}\\b[^>]*>[\\s\\S]*?</${tag}\\s*>`, "gi"), " ");
}

/** Ren text ur ett HTML-fragment: taggar bort, entiteter avkodade, luft ihopdragen. */
export function textOf(html: string): string {
  return decodeEntities(
    (html ?? "")
      .replace(/<(br|\/p|\/div|\/li|\/tr|\/h[1-6])\s*\/?>/gi, " ")
      .replace(/<[^>]*>/g, ""),
  )
    .replace(/\s+/g, " ")
    .trim();
}

/** Plockar ut innehållet i alla förekomster av en tagg. */
function matchAll(html: string, pattern: RegExp): string[] {
  return [...html.matchAll(pattern)].map((m) => m[1] ?? "");
}

// ── Delarna ─────────────────────────────────────────────────

function readTitle(html: string): string | undefined {
  const h1 = html.match(/<h1\b[^>]*>([\s\S]*?)<\/h1>/i);
  if (h1) {
    const t = textOf(h1[1]);
    if (t) return t.slice(0, 200);
  }
  const title = html.match(/<title\b[^>]*>([\s\S]*?)<\/title>/i);
  const t = title ? textOf(title[1]) : "";
  return t ? t.slice(0, 200) : undefined;
}

/** Läser ett meta-fält oavsett om det använder name eller property. */
function readMeta(html: string, key: string): string | undefined {
  const re = new RegExp(
    `<meta\\b[^>]*(?:name|property)\\s*=\\s*["']${key}["'][^>]*>`,
    "i",
  );
  const tag = html.match(re)?.[0];
  if (!tag) return undefined;
  const content = tag.match(/content\s*=\s*["']([^"']*)["']/i)?.[1];
  const value = content ? decodeEntities(content).replace(/\s+/g, " ").trim() : "";
  return value || undefined;
}

/**
 * Specifikationer ur tabeller och definitionslistor. Bara rader med exakt
 * två celler räknas: tre celler är nästan alltid en prislista eller en
 * jämförelse, inte en specifikation för den här artikeln.
 */
export function readSpecs(html: string): SpecRow[] {
  const out: SpecRow[] = [];
  const seen = new Set<string>();

  const push = (label: string, value: string) => {
    const l = label.replace(/[:\s]+$/, "").trim().slice(0, MAX_SPEC_LEN);
    const v = value.trim().slice(0, MAX_SPEC_LEN);
    if (!l || !v || l.toLowerCase() === v.toLowerCase()) return;
    const key = l.toLowerCase();
    if (seen.has(key) || out.length >= MAX_SPECS) return;
    seen.add(key);
    out.push({ label: l, value: v });
  };

  for (const row of matchAll(html, /<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)) {
    const cells = matchAll(row, /<t[dh]\b[^>]*>([\s\S]*?)<\/t[dh]>/gi).map(textOf);
    if (cells.length === 2) push(cells[0], cells[1]);
  }

  for (const list of matchAll(html, /<dl\b[^>]*>([\s\S]*?)<\/dl>/gi)) {
    const terms = matchAll(list, /<dt\b[^>]*>([\s\S]*?)<\/dt>/gi).map(textOf);
    const defs = matchAll(list, /<dd\b[^>]*>([\s\S]*?)<\/dd>/gi).map(textOf);
    terms.forEach((t, i) => { if (defs[i]) push(t, defs[i]); });
  }

  return out;
}

/** Länkar till dokument: datablad, monteringsanvisningar, säkerhetsdatablad. */
export function readDocuments(html: string, baseUrl: string): PageDocument[] {
  const out: PageDocument[] = [];
  const seen = new Set<string>();
  for (const m of html.matchAll(/<a\b[^>]*href\s*=\s*["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi)) {
    const href = decodeEntities(m[1]);
    if (!/\.pdf(\?|#|$)/i.test(href)) continue;
    let absolute: string;
    try { absolute = new URL(href, baseUrl).toString(); } catch { continue; }
    if (seen.has(absolute) || out.length >= MAX_DOCUMENTS) continue;
    seen.add(absolute);
    const label = textOf(m[2]) || absolute.split("/").pop() || "Dokument";
    out.push({ label: label.slice(0, 120), url: absolute });
  }
  return out;
}

/** Etiketter som brukar bära tillverkare respektive artikelnummer. */
const PRODUCER_LABELS = ["tillverkare", "varumärke", "varumarke", "märke", "marke", "fabrikat", "brand", "producer", "manufacturer"];
const ARTICLE_LABELS = ["artikelnummer", "artikelnr", "art.nr", "artnr", "sku", "produktnummer", "article number"];

function fromSpecs(specs: SpecRow[], labels: string[]): string | undefined {
  const hit = specs.find((s) => labels.some((l) => s.label.toLowerCase().includes(l)));
  return hit?.value;
}

/**
 * Brödtexten. Tar styckena på sidan och slår ihop dem. Korta stycken
 * hoppas över — de är nästan alltid "Fri frakt över 500 kr" och liknande,
 * och sådant får inte hamna i en produktbeskrivning.
 */
export function readDescription(html: string): string | undefined {
  const paragraphs = matchAll(html, /<p\b[^>]*>([\s\S]*?)<\/p>/gi)
    .map(textOf)
    .filter((t) => t.length >= 40);

  const joined = paragraphs.join("\n\n").slice(0, MAX_DESCRIPTION).trim();
  return joined || undefined;
}

/**
 * Hela extraktionen. `baseUrl` behövs för att göra dokumentlänkar absoluta.
 *
 * Returnerar aldrig något som inte stod på sidan — saknas en tabell blir
 * `specs` tom, och då märks artikeln "Behöver uppgifter" längre fram.
 */
export function extractPageFacts(html: string, url: string): PageFacts {
  let body = html ?? "";
  for (const tag of STRIP_BLOCKS) body = stripBlock(body, tag);
  // Kommentarer kan gömma både gammal text och hela navigationsmenyer.
  body = body.replace(/<!--[\s\S]*?-->/g, " ");

  const specs = readSpecs(body);
  const description = readDescription(body) ?? readMeta(html, "description");

  return {
    url,
    title: readTitle(body) ?? readTitle(html),
    description,
    specs,
    producer: fromSpecs(specs, PRODUCER_LABELS) ?? readMeta(html, "product:brand"),
    articleNumber: fromSpecs(specs, ARTICLE_LABELS) ?? readMeta(html, "product:retailer_item_id"),
    documents: readDocuments(body, url),
  };
}

/** Sant när sidan gav något att skriva ifrån. Bara en titel räcker inte. */
export function hasUsablePageFacts(f: PageFacts): boolean {
  return Boolean(f.description || f.specs.length > 0 || f.documents.length > 0);
}

/**
 * Formaterar sidfakta för prompten. Varje rad är citerat underlag.
 * Inramningen — att det här är data och inte instruktioner — sätts av
 * anroparen i prompt.ts, en gång, så den inte kan glömmas här.
 */
export function formatPageFacts(f: PageFacts): string | null {
  if (!hasUsablePageFacts(f)) return null;
  const lines: string[] = [];
  if (f.producer) lines.push(`Tillverkare enligt sidan: ${f.producer}`);
  if (f.articleNumber) lines.push(`Artikelnummer enligt sidan: ${f.articleNumber}`);
  if (f.specs.length > 0) {
    lines.push("Specifikationer enligt sidan:");
    for (const s of f.specs) lines.push(`- ${s.label}: ${s.value}`);
  }
  if (f.documents.length > 0) {
    lines.push(`Dokument som finns: ${f.documents.map((d) => d.label).join(", ")}`);
  }
  if (f.description) lines.push(`Sidans egen text: ${f.description}`);
  return lines.join("\n");
}

// ─────────────────────────────────────────────────────────────
// Läsa företaget från hemsidan — ren logik.
//
// Onboardingen läste tidigare högst tre gissade sidor (/om-oss,
// /kontakt), 2 500 tecken var, och fyllde bara textfält. Produkter,
// priser, depåer och öppettider lästes aldrig, och Company Brain blev
// tunt. Den här modulen väljer RÄTT sidor ur sajtens egen sitemap och
// gör om varje sida till det en modell behöver: titel, beskrivning,
// strukturerad data och text.
//
// Inga nätanrop här — se read.ts. Testas i siteReader.test.mts.
// ─────────────────────────────────────────────────────────────

/** Sitemap-raderna ur robots.txt. */
export function sitemapsFromRobots(text: string): string[] {
  return text
    .split(/\r?\n/)
    .map((l) => l.match(/^\s*sitemap\s*:\s*(\S+)/i)?.[1])
    .filter((u): u is string => Boolean(u));
}

/** En sitemap är antingen ett index med fler sitemaps eller en lista sidor. */
export function parseSitemap(xml: string): { pages: string[]; sitemaps: string[] } {
  const locs = [...xml.matchAll(/<loc>\s*(?:<!\[CDATA\[)?\s*([^<\]\s]+)\s*(?:\]\]>)?\s*<\/loc>/gi)].map((m) => decodeEntities(m[1]));
  return /<sitemapindex[\s>]/i.test(xml) ? { pages: [], sitemaps: locs } : { pages: locs, sitemaps: [] };
}

function decodeEntities(s: string): string {
  return s.replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;/g, "'");
}

/**
 * Vilka sitemaps i ett index som är värda att öppna. Inlägg och
 * taggar säger lite om företaget; sidor, platser och produkter mycket.
 */
export function rankSitemap(url: string): number {
  const u = url.toLowerCase();
  if (/(tag|author|category_tag|attachment|image|video)/.test(u)) return -1;
  if (/(page|sida|station|butik|store|location|depa|aterforsaljare|retailer)/.test(u)) return 3;
  if (/(product|produkt|category|kategori|collection)/.test(u)) return 2;
  if (/(post|blogg|blog|nyhet|news)/.test(u)) return 0;
  return 1;
}

/** Ordmönster i sökvägen och hur mycket de säger om företaget. */
const PATH_SCORES: Array<[RegExp, number]> = [
  [/(om-oss|om_oss|about|vilka-vi-ar|historia)/, 10],
  [/(kontakt|contact|hitta-hit|vara-butiker|butiker|stores|depa|fyllningsstation|oppettider|opening)/, 10],
  [/(campaign|kampanj|erbjudande|rea|sale|paketerbjudande)/, 9],
  [/(pris|price|tjanst|service|kaminservice)/, 8],
  [/(fraga|faq|vanliga-fragor|sa-funkar|hur-fungerar)/, 6],
  [/(aterforsaljare|retailer)/, 3],
  [/(kopvillkor|villkor|terms|integritet|privacy|cookie|gdpr|login|konto|account|cart|varukorg|checkout|kassa|sok|search|wishlist|favorit)/, -50],
];

/** Hur intressant en sida är för att förstå företaget. Högre = viktigare. */
export function scorePage(url: string, root: string): number {
  let u: URL;
  try { u = new URL(url); } catch { return -100; }
  let r: URL;
  try { r = new URL(root); } catch { return -100; }
  if (u.hostname.replace(/^www\./, "") !== r.hostname.replace(/^www\./, "")) return -100;

  const path = decodeURIComponent(u.pathname).toLowerCase()
    .normalize("NFD").replace(/\p{M}/gu, "");
  if (path === "/" || path === "") return 100;

  let score = 0;
  for (const [re, s] of PATH_SCORES) if (re.test(path)) score += s;

  // Korta sökvägar är oftast kategorier och huvudsidor; djupa är enskilda
  // artiklar. En webbshops kategorisida visar dussintals produkter och
  // priser på en gång — mer värd än en enskild produktsida.
  const depth = path.split("/").filter(Boolean).length;
  score += depth === 1 ? 4 : depth === 2 ? 1 : -2;
  if (u.search) score -= 3;
  return score;
}

/**
 * Sidorna som ska läsas, i ordning. Startsidan först, sedan efter poäng.
 * Högst `max`, inga dubbletter, bara samma sajt, och aldrig en sida
 * robots.txt stänger.
 */
export function selectPages(
  urls: string[], root: string, max: number, allowed: (path: string) => boolean = () => true,
  maxPerFolder = 3,
): string[] {
  const seen = new Set<string>();
  const scored: Array<{ url: string; score: number; i: number }> = [];
  [root, ...urls].forEach((raw, i) => {
    let u: URL;
    try { u = new URL(raw, root); } catch { return; }
    u.hash = "";
    const key = u.toString().replace(/\/$/, "");
    if (seen.has(key)) return;
    seen.add(key);
    if (!allowed(u.pathname + u.search)) return;
    const score = scorePage(u.toString(), root);
    if (score > -10) scored.push({ url: u.toString(), score, i });
  });
  // Högst några sidor per mapp: tolv paketerbjudanden tränger annars undan
  // kategorierna, som säger mest om sortimentet. Depåer och butiker är
  // undantaget — varje sida har sin egen adress och sina egna tider, och
  // det är just dem vi vill ha. Återförsäljare är andras butiker: en räcker.
  const perMapp = new Map<string, number>();
  const ut: string[] = [];
  for (const s of scored.sort((a, b) => b.score - a.score || a.i - b.i)) {
    const segs = new URL(s.url).pathname.split("/").filter(Boolean);
    const mapp = segs.length > 1 ? segs.slice(0, -1).join("/") : "";
    const n = perMapp.get(mapp) ?? 0;
    const tak = /(fyllningsstation|butik|store|depa|location|hitta-hit|anlaggning)/.test(mapp) ? 20
      : /(aterforsaljare|retailer|reseller)/.test(mapp) ? 1
      : maxPerFolder;
    if (mapp && n >= tak) continue;
    perMapp.set(mapp, n + 1);
    ut.push(s.url);
    if (ut.length >= max) break;
  }
  return ut;
}

/** Länkar på en sida (för sajter utan sitemap). Bara samma sajt. */
export function linksFrom(html: string, base: string): string[] {
  const out: string[] = [];
  for (const m of html.matchAll(/<a\s[^>]*href\s*=\s*["']([^"'#]+)["']/gi)) {
    try {
      const u = new URL(decodeEntities(m[1]), base);
      if (/^https?:$/.test(u.protocol)) out.push(u.toString());
    } catch { /* trasig länk */ }
  }
  return out;
}

/* ── En sida → det modellen behöver ─────────────────────── */

export interface PageExtract {
  url: string;
  title: string;
  description: string;
  /** Rader ur strukturerad data (JSON-LD): produkter, priser, adresser, öppettider. */
  structured: string[];
  text: string;
}

/** Namngivna tecken som svenska sajter faktiskt använder ("v&auml;rmare"). */
const NAMED: Record<string, string> = {
  aring: "å", auml: "ä", ouml: "ö", Aring: "Å", Auml: "Ä", Ouml: "Ö",
  eacute: "é", Eacute: "É", uuml: "ü", ndash: "–", mdash: "—", hellip: "…",
  lsquo: "‘", ldquo: "“", rdquo: "”", laquo: "«", raquo: "»", euro: "€", copy: "©",
};

function stripTags(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ")
    .replace(/<svg[\s\S]*?<\/svg>/gi, " ")
    .replace(/<nav[\s\S]*?<\/nav>/gi, " ")
    // Blockelement blir radbrytningar, så pris och namn hålls ihop per rad.
    .replace(/<\/(p|div|li|h[1-6]|tr|section|article|header|footer|br)\s*>/gi, "\n")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;|&#160;/g, " ")
    .replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"').replace(/&#39;|&rsquo;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/&([a-zA-Z]+);/g, (m, name: string) => NAMED[name] ?? m)
    .replace(/[ \t\f\v]+/g, " ")
    .split("\n").map((l) => l.trim()).filter(Boolean)
    // Samma rad om och om igen är meny och sidfot, inte innehåll. Rader
    // med siffror behålls alltid: två produkter kan kosta 149 kr, och
    // tas det andra priset bort hamnar namn och pris i otakt.
    .filter((l, i, all) => /\d/.test(l) || all.indexOf(l) === i)
    .join("\n");
}

function meta(html: string, name: string): string {
  const re = new RegExp(`<meta[^>]+(?:name|property)\\s*=\\s*["']${name}["'][^>]*>`, "i");
  const tag = html.match(re)?.[0];
  return tag?.match(/content\s*=\s*["']([^"']*)["']/i)?.[1]?.trim() ?? "";
}

/** JSON-LD-objekt, plattade (även @graph och listor). */
function jsonLdObjects(html: string): Array<Record<string, unknown>> {
  const out: Array<Record<string, unknown>> = [];
  for (const m of html.matchAll(/<script[^>]+application\/ld\+json[^>]*>([\s\S]*?)<\/script>/gi)) {
    try {
      const data = JSON.parse(m[1].trim());
      // Kö, inte stack: ordningen på sidan behålls.
      const stack: unknown[] = [data];
      while (stack.length) {
        const x = stack.shift();
        if (Array.isArray(x)) stack.unshift(...x);
        else if (x && typeof x === "object") {
          const o = x as Record<string, unknown>;
          out.push(o);
          if (o["@graph"]) stack.push(o["@graph"]);
          if (o.itemListElement) stack.push(o.itemListElement);
          if (o.item && typeof o.item === "object") stack.push(o.item);
        }
      }
    } catch { /* trasig JSON-LD hoppas över */ }
  }
  return out;
}

const str = (v: unknown) => (typeof v === "string" || typeof v === "number" ? String(v).trim() : "");

function typeOf(o: Record<string, unknown>): string {
  const t = o["@type"];
  return (Array.isArray(t) ? t.join(",") : str(t)).toLowerCase();
}

/** Strukturerad data som korta rader: det mest pålitliga en sida har. */
export function structuredLines(html: string): string[] {
  const lines: string[] = [];
  for (const o of jsonLdObjects(html)) {
    const t = typeOf(o);
    if (t.includes("product")) {
      const offers = (Array.isArray(o.offers) ? o.offers[0] : o.offers) as Record<string, unknown> | undefined;
      const price = offers ? str(offers.price) || str(offers.lowPrice) : "";
      const cur = offers ? str(offers.priceCurrency) : "";
      lines.push(`Produkt: ${str(o.name)}${price ? ` — ${price} ${cur}`.trimEnd() : ""}`);
    } else if (/(localbusiness|store|organization|autopartsstore|homegoodsstore|gasstation)/.test(t)) {
      const a = o.address as Record<string, unknown> | undefined;
      const adress = a ? [str(a.streetAddress), str(a.postalCode), str(a.addressLocality)].filter(Boolean).join(", ") : "";
      const hours = Array.isArray(o.openingHours) ? (o.openingHours as unknown[]).map(str).join("; ") : str(o.openingHours);
      const tel = str(o.telephone);
      // Bara namnet säger inget; en plats behöver adress, tider eller telefon.
      if (adress || hours || tel) {
        const parts = [str(o.name), adress, hours && `öppet ${hours}`, tel && `tel ${tel}`].filter(Boolean);
        lines.push(`Plats: ${parts.join(" — ")}`);
      }
    }
  }
  return [...new Set(lines)].slice(0, 40);
}

export function extractPage(html: string, url: string, maxText = 20_000): PageExtract {
  const title = (html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] ?? "").replace(/\s+/g, " ").trim();
  const body = html.match(/<body[\s\S]*<\/body>/i)?.[0] ?? html;
  // Huvudinnehållet först om sajten märkt ut det; meny och sidfot sist.
  const main = body.match(/<main[\s\S]*?<\/main>/i)?.[0];
  const text = stripTags(main ?? body);
  return {
    url,
    title: stripTags(title),
    description: meta(html, "description") || meta(html, "og:description"),
    structured: structuredLines(html),
    text: text.slice(0, maxText),
  };
}

/**
 * Tar bort det som står på nästan varje sida — meny, sidfot, listan över
 * alla depåer — från alla sidor utom den första, och kortar sedan varje
 * sida. Utan det här bestod en depåsida av 2 500 tecken meny och inget
 * om depån. En rad räknas som mall när den står på minst tre sidor och
 * minst 40 procent av dem.
 */
export function trimBoilerplate(pages: PageExtract[], maxText = 2500): PageExtract[] {
  if (pages.length < 3) return pages.map((p) => ({ ...p, text: p.text.slice(0, maxText) }));
  const count = new Map<string, number>();
  for (const p of pages) {
    for (const line of new Set(p.text.split("\n"))) count.set(line, (count.get(line) ?? 0) + 1);
  }
  const grans = Math.max(3, Math.ceil(pages.length * 0.4));
  return pages.map((p, i) => ({
    ...p,
    text: (i === 0 ? p.text : p.text.split("\n").filter((l) => (count.get(l) ?? 0) < grans).join("\n"))
      .slice(0, maxText),
  }));
}

/** Allt som läst, som en text till modellen. Sidornas ordning behålls. */
export function corpus(pages: PageExtract[], maxChars = 45_000): string {
  const delar: string[] = [];
  let total = 0;
  for (const p of pages) {
    const block = [
      `=== SIDA: ${p.url}`,
      p.title && `Titel: ${p.title}`,
      p.description && `Beskrivning: ${p.description}`,
      p.structured.length ? `Strukturerad data:\n${p.structured.join("\n")}` : "",
      p.text,
    ].filter(Boolean).join("\n");
    if (total + block.length > maxChars) {
      const rest = maxChars - total;
      if (rest > 400) delar.push(block.slice(0, rest));
      break;
    }
    delar.push(block);
    total += block.length;
  }
  return delar.join("\n\n");
}

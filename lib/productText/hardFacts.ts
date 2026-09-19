// ─────────────────────────────────────────────────────────────
// Hårda fakta: tal med enhet och versalförkortningar.
//
// Den befintliga texten i butiken är den viktigaste källan vi har. Står
// det "3,4 kW", "247 g/h" eller "ODS" i FÖRE-texten ska det stå i EFTER-
// texten också. Kortare får inte betyda fattigare.
//
// Det här är en maskinell kontroll, inte en bedömning. Den fångar inte
// "gjutjärn" eller "levereras utan regulator" (det gör prompten), men den
// fångar varje siffra och varje förkortning, och den kan inte övertalas.
//
// Jämförelsen är symmetrisk: samma tolkning körs på före och efter, så
// "40–100 m²", "40-100 m2" och "mellan 40 och 100 m²" är samma sak. Ett
// intervall räknas som två tal med samma enhet och "475x424x743 mm" som tre.
//
// Ren logik, inga beroenden. Testas i hardFacts.test.mts.
// ─────────────────────────────────────────────────────────────

export interface HardFact {
  /** Normaliserad nyckel som jämförs, t.ex. "3.4|kw" eller "ODS". */
  key: string;
  /** Som det visas för användaren, t.ex. "3,4 kW". */
  label: string;
}

/** Enheter vi kräver kvar. Längst först, så att "kWh" inte blir "kW" + "h". */
const UNITS = [
  "kWh", "kW", "W", "g/h", "kg/h", "kg", "g", "m²", "m2", "m³", "m3",
  "mm", "cm", "m", "mbar", "bar", "kPa", "l/min", "liter", "l", "°C", "V",
  "Ah", "mAh", "tum",
];

/** Enhet → jämförelseform. */
function canonicalUnit(u: string): string {
  const l = u.toLowerCase();
  if (l === "m²") return "m2";
  if (l === "m³") return "m3";
  if (l === "liter") return "l";
  return l;
}

/** Versalord som inte är fakta. Står de i en gammal text ska de inte krävas. */
const NOT_CODES = new Set([
  "OBS", "NY", "NYHET", "NYHETER", "GRATIS", "REA", "INFO", "TIPS", "VIKTIGT",
  "OBSERVERA", "OCH", "ELLER", "MED", "FÖR", "SE", "OK", "PS", "TEL", "FAQ",
]);

const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\/]/g, "\\$&");
const NUM = String.raw`\d+(?:[.,]\d+)?`;
/** Mellan två tal i samma mått: streck, x, "och", "till". */
const JOIN = String.raw`(?:\s*[-x×]\s*|\s+(?:och|till)\s+)`;
const QUANTITY = new RegExp(
  String.raw`(?<![\p{L}\p{N}.,])(${NUM}(?:${JOIN}${NUM})*)\s*(${UNITS.map(escape).join("|")})(?![\p{L}\p{N}])`,
  "giu",
);
const CODE = /(?<![\p{L}\p{N}])[A-ZÅÄÖ][A-ZÅÄÖ0-9]*(?:-[A-ZÅÄÖ0-9]+)*(?![\p{L}\p{N}])/gu;
/** "EN 559" → "EN559". Inte när talet är ett mått: "FFD 138 g/h" ska förbli ett mått. */
const SPACED_CODE = new RegExp(
  String.raw`(?<![\p{L}\p{N}])([A-ZÅÄÖ]{1,5})[ -](\d{2,5})(?![\p{L}\p{N}]|[.,]\d|\s*(?:${UNITS.map(escape).join("|")})(?![\p{L}\p{N}]))`,
  "gu",
);

/** Alla streck blir bindestreck, allt blanktecken (även hårt) ett mellanslag,
 *  "EN 559" blir "EN559". */
function normalize(text: string): string {
  return (text ?? "")
    .replace(/\p{Pd}/gu, "-")
    .replace(/\s+/g, " ")
    .replace(SPACED_CODE, "$1$2");
}

const numKey = (n: string) => n.replace(",", ".").replace(/\.0+$/, "");

/** Alla hårda fakta i en ren text, utan dubbletter, i den ordning de står. */
export function extractHardFacts(plainText: string): HardFact[] {
  const text = normalize(plainText);
  const out: HardFact[] = [];
  const seen = new Set<string>();
  const add = (key: string, label: string) => {
    if (seen.has(key)) return;
    seen.add(key);
    out.push({ key, label });
  };

  for (const m of text.matchAll(QUANTITY)) {
    const unit = m[2];
    for (const n of m[1].split(new RegExp(JOIN, "i"))) {
      add(`${numKey(n)}|${canonicalUnit(unit)}`, `${n} ${unit}`);
    }
  }

  for (const m of text.matchAll(CODE)) {
    const code = m[0];
    const letters = code.replace(/[^A-ZÅÄÖ]/g, "").length;
    const digits = /\d/.test(code);
    if (code.length < 2 || NOT_CODES.has(code)) continue;
    // Bara versaler: en förkortning har 2–4 bokstäver. "VARMT" är en rubrik.
    if (!digits && (letters < 2 || letters > 4)) continue;
    add(code, code);
  }

  return out;
}

// ── Modellens egen faktalista ───────────────────────────────
// Tal och förkortningar går att kontrollera utan hjälp. "Gjutjärn" och
// "batteridriven tändning" gör det inte, så modellen får lista varje
// sakuppgift med ett nyckelord, och vi kontrollerar att nyckelordet står
// i texten. Den kan fortfarande glömma att lista något, men den kan inte
// lista det och sedan hoppa över det.

export interface ListedFact {
  /** Uppgiften, kort, som modellen formulerade den. */
  uppgift: string;
  /** Ordet som bevisar att uppgiften står i texten. */
  ord: string;
}

export const MAX_LISTED_FACTS = 40;

/** Tolkar modellens `fakta`-fält. Allt som inte har både uppgift och ord kastas. */
export function parseListedFacts(input: unknown): ListedFact[] {
  if (!Array.isArray(input)) return [];
  const out: ListedFact[] = [];
  for (const raw of input) {
    if (!raw || typeof raw !== "object") continue;
    const o = raw as Record<string, unknown>;
    const uppgift = typeof o.uppgift === "string" ? o.uppgift.trim().slice(0, 200) : "";
    const ord = typeof o.ord === "string" ? o.ord.trim().slice(0, 60) : "";
    if (uppgift && ord) out.push({ uppgift, ord });
    if (out.length >= MAX_LISTED_FACTS) break;
  }
  return out;
}

const loose = (s: string) => normalize(s).toLowerCase();

/** För ordjämförelse: gemener, och dubbla bokstäver som en, så att butikens
 *  "termostatsstyrd" och rätt stavade "termostatstyrd" blir samma ord. */
const wordForm = (s: string) => loose(s).replace(/(\p{L})\1+/gu, "$1");

/**
 * Står ordet i texten? Ett långt ord får tappa sin böjningsändelse:
 * "gjutjärnet" räknas för "gjutjärn", "termostatstyrning" för
 * "termostatstyrd". Ett kort ord måste stå i början av ett ord, så att
 * "lock" inte hittas i "blocket". Är ordet ett mått jämförs det som ett
 * mått: "138 g/h" står i "138-247 g/h".
 */
export function mentions(plainText: string, word: string): boolean {
  const measures = extractHardFacts(word);
  if (measures.length > 0) {
    const hard = new Set(extractHardFacts(plainText).map((f) => f.key));
    return measures.every((m) => hard.has(m.key));
  }
  const text = wordForm(plainText);
  const w = wordForm(word);
  if (!w) return false;
  // Flera ord: vart och ett ska stå där, böjt eller inte. "Den batteridrivna
  // tändningen" räknas för "batteridriven tändning".
  const parts = w.split(" ");
  if (parts.length > 1) return parts.every((part) => mentions(plainText, part));
  const atWordStart = (s: string) => new RegExp(`(?<![\\p{L}\\p{N}])${escape(s)}`, "u").test(text);
  if (w.length < 6) return atWordStart(w);
  if (text.includes(w)) return true;
  // Böjningsändelse av: "värmen" → "värme", "termostatstyrd" → "termostatsty".
  // En stam på sex tecken får stå var som helst, en på fem bara i början av
  // ett ord, och kortare stammar godtas inte: "locket" ska inte hittas i "lockar".
  for (const cut of [1, 2]) {
    const stem = w.slice(0, w.length - cut);
    if (stem.length >= 6 ? text.includes(stem) : stem.length >= 5 && atWordStart(stem)) return true;
  }
  return false;
}

/** Uppgifter ur modellens egen lista vars nyckelord inte står i texten. */
export function uncoveredFacts(facts: ListedFact[] | undefined, afterPlain: string): string[] {
  if (!facts || facts.length === 0) return [];
  return facts.filter((f) => !mentions(afterPlain, f.ord)).map((f) => f.uppgift);
}

/** Nyckelord ur före-texten (se keywords.ts) som saknas i efter-texten. */
export function missingKeywords(keywords: string[] | undefined, afterPlain: string): string[] {
  if (!keywords || keywords.length === 0) return [];
  return keywords.filter((k) => !mentions(afterPlain, k));
}

/**
 * Fakta som stod i före-texten men saknas i efter-texten. Tom lista betyder
 * att inget tappats. Båda argumenten är ren text (se toPlainText).
 */
export function missingHardFacts(beforePlain: string, afterPlain: string): string[] {
  const before = extractHardFacts(beforePlain);
  if (before.length === 0) return [];
  const after = new Set(extractHardFacts(afterPlain).map((f) => f.key));
  return before.filter((f) => !after.has(f.key)).map((f) => f.label);
}

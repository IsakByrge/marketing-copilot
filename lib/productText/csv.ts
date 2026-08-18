// ─────────────────────────────────────────────────────────────
// CSV in och ut för produkttexter.
//
// Wikinggruppens export är semikolonseparerad och ofta med BOM, men
// andra butiker exporterar annorlunda. Därför gissas avgränsare och
// kolumner istället för att hårdkodas — samma kod ska fungera för
// nästa butik utan ändring.
//
// Ren logik, inga beroenden. Testas i csv.test.mts.
// ─────────────────────────────────────────────────────────────

export type Row = Record<string, string>;

export interface ParsedCsv {
  headers: string[];
  rows: Row[];
  delimiter: string;
}

/** Vanliga avgränsare i ordning efter hur troliga de är i svensk export. */
const CANDIDATES = [";", ",", "\t", "|"] as const;

/**
 * Gissar avgränsare genom att räkna förekomster utanför citattecken på
 * första raden. Den som ger flest fält vinner; semikolon vid lika.
 */
export function detectDelimiter(text: string): string {
  const firstLine = text.split(/\r?\n/, 1)[0] ?? "";
  let best = ";";
  let bestCount = 0;
  for (const d of CANDIDATES) {
    let count = 0;
    let inQuotes = false;
    for (let i = 0; i < firstLine.length; i++) {
      const ch = firstLine[i];
      if (ch === '"') inQuotes = !inQuotes;
      else if (ch === d && !inQuotes) count++;
    }
    if (count > bestCount) {
      bestCount = count;
      best = d;
    }
  }
  return best;
}

/** Tar bort byte order mark som Excel och Wikinggruppen ofta lägger först. */
function stripBom(text: string): string {
  return text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
}

/**
 * Parsar CSV med stöd för citattecken, escapade citattecken ("") och
 * radbrytningar inuti fält — produktbeskrivningar innehåller ofta båda.
 */
export function parseCsv(input: string, delimiter?: string): ParsedCsv {
  const text = stripBom(input);
  const d = delimiter ?? detectDelimiter(text);

  const records: string[][] = [];
  let field = "";
  let record: string[] = [];
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];

    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += ch;
      }
      continue;
    }

    if (ch === '"') {
      inQuotes = true;
    } else if (ch === d) {
      record.push(field);
      field = "";
    } else if (ch === "\n") {
      record.push(field);
      records.push(record);
      record = [];
      field = "";
    } else if (ch !== "\r") {
      field += ch;
    }
  }
  if (field.length > 0 || record.length > 0) {
    record.push(field);
    records.push(record);
  }

  const headerRow = records.shift() ?? [];
  const headers = headerRow.map((h) => h.trim());
  const rows: Row[] = records
    .filter((r) => r.some((v) => v.trim() !== ""))
    .map((r) => {
      const row: Row = {};
      headers.forEach((h, i) => { row[h] = r[i] ?? ""; });
      return row;
    });

  return { headers, rows, delimiter: d };
}

/** Skriver CSV i samma format som lästes in, så importen tillbaka accepterar den. */
export function toCsv(headers: string[], rows: Row[], delimiter = ";"): string {
  const esc = (v: string) => {
    const s = v ?? "";
    return /["\n\r]/.test(s) || s.includes(delimiter) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const lines = [headers.map(esc).join(delimiter)];
  for (const row of rows) lines.push(headers.map((h) => esc(row[h] ?? "")).join(delimiter));
  return lines.join("\r\n");
}

// ── Kolumngissning ──────────────────────────────────────────

export interface ColumnGuess {
  id: string | null;
  name: string | null;
  description: string | null;
  group: string | null;
}

/** Kandidatnamn per fält, gemener, i prioritetsordning. */
const PATTERNS: Record<keyof ColumnGuess, string[]> = {
  // "id" är medvetet borttaget: det delsträngsmatchade "Hidden (1/0)" i
  // Wikinggruppens export, så alla produkter fick artikelnummer "0" och alla
  // texter kollapsade till en. Vi matchar bara på riktiga artikelnummerord.
  id: ["artikelnummer", "artnr", "art.nr", "artikelnr", "sku", "produktnummer", "article number", "article no", "articleno", "product number"],
  name: ["produktnamn", "artikelnamn", "namn", "titel", "name", "title"],
  description: ["beskrivning", "produktbeskrivning", "artikelbeskrivning", "brödtext", "lång beskrivning", "description", "body"],
  group: ["produktgrupp", "kategori", "varugrupp", "grupp", "category"],
};

/**
 * Rubriker som innehåller något av dessa ord får ALDRIG delsträngsmatchas —
 * de är notoriska falska träffar (t.ex. "Hidden (1/0)" mot "id", eller
 * "Meta description" mot "description"). Exakt matchning fungerar fortfarande:
 * en kolumn som exakt heter "Category" väljs, men "Supplier category" väljs
 * inte som produktgrupp via delsträng.
 */
export const NEVER_PARTIAL = [
  "hidden", "meta", "image", "url", "stock", "price", "vat", "campaign", "supplier", "producer",
] as const;

const isNeverPartial = (headerLower: string): boolean =>
  NEVER_PARTIAL.some((word) => headerLower.includes(word));

/** Gissar vilka kolumner som är vad. Användaren kan alltid ändra i gränssnittet. */
export function guessColumns(headers: string[]): ColumnGuess {
  const lower = headers.map((h) => h.toLowerCase().trim());
  const pick = (key: keyof ColumnGuess): string | null => {
    for (const p of PATTERNS[key]) {
      const exact = lower.indexOf(p);
      if (exact !== -1) return headers[exact];
    }
    for (const p of PATTERNS[key]) {
      const partial = lower.findIndex((h) => h.includes(p) && !isNeverPartial(h));
      if (partial !== -1) return headers[partial];
    }
    return null;
  };
  return { id: pick("id"), name: pick("name"), description: pick("description"), group: pick("group") };
}

// ── Verifiering av artikelnummerkolumn ──────────────────────

export interface IdColumnCheck {
  /** Sant bara när varje rad har ett värde OCH alla värden är unika. */
  ok: boolean;
  /** Antal rader med ett ifyllt (icke-tomt) värde. */
  filled: number;
  /** Antal unika ifyllda värden. */
  unique: number;
  /** Upp till tre dubblettvärden, för felmeddelandet. */
  examples: string[];
}

/**
 * Kontrollerar att en vald kolumn duger som artikelnummer: varje rad måste ha
 * ett värde och alla värden måste vara unika. Annars skulle flera artiklar få
 * samma text, och en import skriva över hela sortimentet med en beskrivning.
 */
export function checkIdColumn(rows: Row[], column: string): IdColumnCheck {
  const seen = new Set<string>();
  const duplicates = new Set<string>();
  let filled = 0;
  for (const row of rows) {
    const value = (row[column] ?? "").trim();
    if (!value) continue;
    filled++;
    if (seen.has(value)) duplicates.add(value);
    else seen.add(value);
  }
  const ok = filled === rows.length && duplicates.size === 0;
  return {
    ok,
    filled,
    unique: seen.size,
    examples: [...duplicates].slice(0, 3),
  };
}

// ── Tunna texter ────────────────────────────────────────────

/** Under så här många tecken räknas en beskrivning som tunn. */
export const THIN_LIMIT = 120;

/** Räknar synliga tecken utan html-taggar och whitespace-brus. */
export function textLength(html: string): number {
  return (html ?? "")
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/\s+/g, " ")
    .trim().length;
}

export function isThin(html: string, limit = THIN_LIMIT): boolean {
  return textLength(html) < limit;
}

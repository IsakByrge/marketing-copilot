// ─────────────────────────────────────────────────────────────
// Filen som går tillbaka in i webbshoppen.
//
// Wikinggruppens import tar samma kolumner som exporten plus tre till:
// Meta title, Meta description och Ignore. Ignore=1 hoppar över raden.
// Därför skickar vi HELA katalogen tillbaka med Ignore=1 på allt, och
// Ignore=0 bara på det du godkänt. Ett stavfel i en artikelnummerkolumn
// kan då inte råka skriva över en artikel vi aldrig rört.
//
// Ren logik, inga beroenden. Testas i pipeline.test.mts.
// ─────────────────────────────────────────────────────────────
import { toCsv, type Row } from "./csv";

export const META_TITLE_COLUMN = "Meta title";
export const META_DESCRIPTION_COLUMN = "Meta description";
export const IGNORE_COLUMN = "Ignore";

/** Det som ska skrivas för en godkänd artikel. */
export interface ApprovedText {
  description: string;
  metaTitle: string;
  metaDescription: string;
}

export interface BuildImportInput {
  headers: string[];
  rows: Row[];
  idColumn: string;
  descriptionColumn: string;
  /** Artikelnummer → godkänd text. Allt som inte finns här får Ignore=1. */
  approved: Record<string, ApprovedText>;
}

export interface BuiltImport {
  headers: string[];
  rows: Row[];
  /** Antal rader med Ignore=0, alltså de som faktiskt importeras. */
  included: number;
}

/**
 * Hittar en befintlig kolumn oavsett skiftläge och mellanslag, så att vi
 * fyller butikens egen "Meta title" istället för att lägga till en andra
 * kolumn med nästan samma namn.
 */
function findColumn(headers: string[], wanted: string): string | null {
  const key = wanted.toLowerCase().replace(/\s+/g, "");
  const hit = headers.find((h) => h.toLowerCase().replace(/\s+/g, "") === key);
  return hit ?? null;
}

/**
 * Bygger rader och rubriker för importfilen. Rubrikordningen från exporten
 * behålls; saknade kolumner läggs till sist.
 */
export function buildImport(input: BuildImportInput): BuiltImport {
  const { headers, rows, idColumn, descriptionColumn, approved } = input;

  const titleCol = findColumn(headers, META_TITLE_COLUMN) ?? META_TITLE_COLUMN;
  const descCol = findColumn(headers, META_DESCRIPTION_COLUMN) ?? META_DESCRIPTION_COLUMN;
  const ignoreCol = findColumn(headers, IGNORE_COLUMN) ?? IGNORE_COLUMN;

  const outHeaders = [...headers];
  for (const col of [titleCol, descCol, ignoreCol]) {
    if (!outHeaders.includes(col)) outHeaders.push(col);
  }

  let included = 0;
  const outRows = rows.map((row) => {
    const id = (row[idColumn] ?? "").trim();
    const hit = id ? approved[id] : undefined;
    if (!hit) return { ...row, [ignoreCol]: "1" };
    included++;
    return {
      ...row,
      [descriptionColumn]: hit.description,
      [titleCol]: hit.metaTitle,
      [descCol]: hit.metaDescription,
      [ignoreCol]: "0",
    };
  });

  return { headers: outHeaders, rows: outRows, included };
}

/**
 * Hela filen som text, med BOM först. Wikinggruppen exporterar UTF-8 med
 * BOM och förväntar sig det tillbaka — utan den blir å, ä och ö fel i
 * kolumner som inte är entitetskodade.
 */
export function buildImportCsv(input: BuildImportInput, delimiter = ";"): { csv: string; included: number } {
  const built = buildImport(input);
  return {
    csv: "﻿" + toCsv(built.headers, built.rows, delimiter),
    included: built.included,
  };
}

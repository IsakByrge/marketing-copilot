// ─────────────────────────────────────────────────────────────
// Siffror som lagts TILL — kontrollen som saknades.
//
// Alla tidigare kontroller letade efter fakta som försvunnit ur texten.
// Ingen letade efter fakta som tillkommit. Skriver modellen "30 mbar"
// eller "EN 559" på en regulator som underlaget inte säger något om,
// syntes det inte. För gasol är det det farligaste felet som finns.
//
// Varje tal i texten måste stå någonstans i underlaget: befintlig text,
// produktsidan, Company Brain, namn eller modell. Annars flaggas det,
// och texten går inte att godkänna förrän det är borta eller bekräftat
// genom att det skrivits in i underlaget.
//
// Ren modul. Testas i pd.test.mts.
// ─────────────────────────────────────────────────────────────

/** Tal i en text, normaliserade: "1 012" → "1012", "3,4" → "3.4", "08" → "8". */
export function numberTokens(text: string): string[] {
  const t = (text ?? "")
    // Tusentalsavgränsare: "1 012", "1.012", "1 012" (smalt mellanslag)
    .replace(/(\d)[\s  .](?=\d{3}(?!\d)(?![.,]\d))/g, "$1");
  return (t.match(/\d+(?:[.,]\d+)?/g) ?? []).map((n) => {
    const s = n.replace(",", ".");
    const [heltal, dec] = s.split(".");
    const h = String(Number(heltal));
    return dec !== undefined ? `${h}.${dec.replace(/0+$/, "") || "0"}`.replace(/\.0$/, "") : h;
  });
}

/** Talen i `output` som inte står i `sources`, i ordning och utan dubbletter. */
export function addedNumbers(output: string, sources: string | string[]): string[] {
  const tillatna = new Set(numberTokens(Array.isArray(sources) ? sources.join("\n") : sources));
  const ut: string[] = [];
  for (const n of numberTokens(output)) {
    if (!tillatna.has(n) && !ut.includes(n)) ut.push(n);
  }
  return ut.map((n) => n.replace(".", ","));
}

/** De tillåtna talen, för att kunna räkna om kontrollen i webbläsaren. */
export function allowedNumbers(sources: string | string[]): string[] {
  return [...new Set(numberTokens(Array.isArray(sources) ? sources.join("\n") : sources))];
}

/** Samma kontroll mot en sparad lista med tillåtna tal. */
export function addedAgainst(output: string, allowed: string[] | undefined): string[] {
  if (!allowed) return [];
  const set = new Set(allowed);
  const ut: string[] = [];
  for (const n of numberTokens(output)) if (!set.has(n) && !ut.includes(n)) ut.push(n);
  return ut.map((n) => n.replace(".", ","));
}

// Kör: npx tsx app/_shared/contrast.test.mts
//
// Kontrastvakt för designsystemets färgpar. Bakgrunden: primärknappen
// renderade mörk text på emerald (2,3:1) trots att primitiven sa
// text-white, eftersom en olagrad `a { color: inherit }` i globals.css
// slog Tailwinds utility. Testet låser fast KRAVET — att paren räcker
// till — så att en färgändring i tokens fångas här och inte i en
// preview-granskning.
//
// Testet läser tokens ur globals.css i stället för att upprepa dem, så
// det kan inte hamna ur synk med den riktiga paletten.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

let passed = 0;
function test(name: string, fn: () => void) {
  try { fn(); passed++; }
  catch (e) { console.error(`FAIL: ${name}\n  ${e instanceof Error ? e.message : e}`); process.exitCode = 1; }
}

/** WCAG 2.1 relativ luminans för en #rrggbb-färg. */
function luminance(hex: string): number {
  const h = hex.replace("#", "");
  const channels = [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16) / 255);
  const lin = channels.map((c) => (c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4)));
  return 0.2126 * lin[0] + 0.7152 * lin[1] + 0.0722 * lin[2];
}

/** WCAG 2.1 kontrastkvot, 1–21. */
export function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

// Tokens ur den enda källan till sanning.
const css = readFileSync(new URL("../globals.css", import.meta.url), "utf8");
function token(name: string): string {
  const m = css.match(new RegExp(`--color-${name}:\\s*(#[0-9A-Fa-f]{6})`));
  if (!m) throw new Error(`hittade inte token --color-${name} i globals.css`);
  return m[1];
}

const WHITE = "#FFFFFF";
const AA_TEXT = 4.5;      // WCAG AA, brödtext
const AA_LARGE = 3;       // WCAG AA, stor text

test("tokens går att läsa ur globals.css", () => {
  assert.match(token("primary"), /^#[0-9A-Fa-f]{6}$/);
  assert.match(token("background"), /^#[0-9A-Fa-f]{6}$/);
});

test("primärknapp: vit text på emerald klarar AA", () => {
  const ratio = contrast(WHITE, token("primary"));
  assert.ok(ratio >= AA_TEXT, `vit på primary är ${ratio.toFixed(2)}:1, kräver ${AA_TEXT}`);
});

test("primärknapp: hover-läget klarar också AA", () => {
  const ratio = contrast(WHITE, token("primary-hover"));
  assert.ok(ratio >= AA_TEXT, `vit på primary-hover är ${ratio.toFixed(2)}:1`);
});

test("mörk text på emerald är UNDERKÄND — det var buggen", () => {
  const ratio = contrast(token("text-primary"), token("primary"));
  assert.ok(ratio < AA_TEXT, `mörk på emerald gav ${ratio.toFixed(2)}:1, borde vara för lågt`);
});

test("brödtext på papper och på vitt kort klarar AA", () => {
  for (const bg of ["background", "surface", "surface-sunken"] as const) {
    const ratio = contrast(token("text-primary"), token(bg));
    assert.ok(ratio >= AA_TEXT, `text-primary på ${bg} är ${ratio.toFixed(2)}:1`);
  }
});

test("sekundär text klarar AA på alla tre ytor", () => {
  for (const bg of ["background", "surface", "surface-sunken"] as const) {
    const ratio = contrast(token("text-secondary"), token(bg));
    assert.ok(ratio >= AA_TEXT, `text-secondary på ${bg} är ${ratio.toFixed(2)}:1`);
  }
});

test("tertiär text når minst AA för stor text", () => {
  // Används bara till versala etiketter och hjälptexter, aldrig brödtext.
  for (const bg of ["background", "surface"] as const) {
    const ratio = contrast(token("text-tertiary"), token(bg));
    assert.ok(ratio >= AA_LARGE, `text-tertiary på ${bg} är ${ratio.toFixed(2)}:1`);
  }
});

test("emerald som länkfärg på papper klarar AA", () => {
  const ratio = contrast(token("primary"), token("background"));
  assert.ok(ratio >= AA_TEXT, `primary på background är ${ratio.toFixed(2)}:1`);
});

test("felfärg klarar AA på sin egen yta", () => {
  const ratio = contrast(token("danger"), token("danger-surface"));
  assert.ok(ratio >= AA_TEXT, `danger på danger-surface är ${ratio.toFixed(2)}:1`);
});

/* ── Mörkt läge ─────────────────────────────────────────────
   Samma krav som ljust. token() ovan hittar det FÖRSTA värdet i filen,
   alltså @theme statics ljusa palett; darkToken() läser i stället inuti
   [data-theme="dark"]-blocket. Ändras en mörk token utan att kontrasten
   håller faller testet här, inte i en preview-granskning. */

const darkBlock = (() => {
  const m = css.match(/\[data-theme="dark"\]\s*\{([\s\S]*?)\}/);
  if (!m) throw new Error("hittade inte [data-theme=\"dark\"]-blocket i globals.css");
  return m[1];
})();

function darkToken(name: string): string {
  const m = darkBlock.match(new RegExp(`--color-${name}:\\s*(#[0-9A-Fa-f]{6})`));
  if (!m) throw new Error(`hittade inte --color-${name} i dark-blocket`);
  return m[1];
}

test("dark: alla tokens går att läsa", () => {
  for (const t of [
    "background", "surface", "surface-sunken", "primary", "primary-hover",
    "text-primary", "text-secondary", "text-tertiary", "border", "border-strong",
    "success", "success-surface", "warning", "warning-surface", "danger", "danger-surface",
  ]) {
    assert.match(darkToken(t), /^#[0-9A-Fa-f]{6}$/, `--color-${t} saknas i dark`);
  }
});

test("dark: brödtext klarar AA på alla tre ytorna", () => {
  for (const bg of ["background", "surface", "surface-sunken"] as const) {
    const ratio = contrast(darkToken("text-primary"), darkToken(bg));
    assert.ok(ratio >= AA_TEXT, `dark text-primary på ${bg} är ${ratio.toFixed(2)}:1`);
  }
});

test("dark: sekundärtext klarar AA på background och surface", () => {
  for (const bg of ["background", "surface"] as const) {
    const ratio = contrast(darkToken("text-secondary"), darkToken(bg));
    assert.ok(ratio >= AA_TEXT, `dark text-secondary på ${bg} är ${ratio.toFixed(2)}:1`);
  }
});

test("dark: tertiärtext klarar AA-large", () => {
  for (const bg of ["background", "surface"] as const) {
    const ratio = contrast(darkToken("text-tertiary"), darkToken(bg));
    assert.ok(ratio >= AA_LARGE, `dark text-tertiary på ${bg} är ${ratio.toFixed(2)}:1`);
  }
});

test("dark: vit text på primärknappen klarar AA", () => {
  for (const p of ["primary", "primary-hover"] as const) {
    const ratio = contrast(WHITE, darkToken(p));
    assert.ok(ratio >= AA_TEXT, `vit på dark ${p} är ${ratio.toFixed(2)}:1`);
  }
});

test("dark: emerald som text klarar AA-large — och varför bara det", () => {
  // Vit text PÅ primary kräver luminans ≤ 0,183. Primary SOM text mot
  // bakgrunden kräver ≥ 0,217. Intervallen överlappar inte, så en enda
  // emerald kan inte ge AA åt båda rollerna i mörkt läge.
  //
  // Knappen vann: vit på primary har full AA i testet ovan. Emerald som
  // text landar därför på AA-large. Sänk inte den här gränsen till 3
  // "för att bli av med felet" utan att läsa kommentaren i globals.css —
  // rätt lösning när det behövs är ett eget token för emerald-som-text.
  const ratio = contrast(darkToken("primary"), darkToken("background"));
  assert.ok(ratio >= AA_LARGE, `dark primary på background är ${ratio.toFixed(2)}:1`);
  assert.ok(
    ratio < AA_TEXT,
    `dark primary på background är ${ratio.toFixed(2)}:1 — om den nu klarar AA har paletten ändrats och kommentaren i globals.css bör uppdateras`,
  );
});

test("dark: statusfärgerna klarar AA på sina egna ytor", () => {
  for (const s of ["success", "danger", "warning"] as const) {
    const ratio = contrast(darkToken(s), darkToken(`${s}-surface`));
    assert.ok(ratio >= AA_TEXT, `dark ${s} på ${s}-surface är ${ratio.toFixed(2)}:1`);
  }
});

test("dark: ramar syns mot sina ytor", () => {
  // Ramar är inte text; kravet är att de går att uppfatta, inte AA.
  for (const [linje, yta] of [["border", "surface"], ["border-strong", "background"]] as const) {
    const ratio = contrast(darkToken(linje), darkToken(yta));
    assert.ok(ratio >= 1.2, `dark ${linje} mot ${yta} är ${ratio.toFixed(2)}:1 — osynlig`);
  }
});

test("dark: ytorna skiljer sig från varandra", () => {
  // surface ska lyfta mot background, precis som i ljust läge.
  assert.notEqual(darkToken("surface"), darkToken("background"), "surface och background är identiska");
  assert.notEqual(darkToken("surface-sunken"), darkToken("background"), "sunken och background är identiska");
});

test("dark är faktiskt mörkt och ljust faktiskt ljust", () => {
  assert.ok(
    luminance(darkToken("background")) < luminance(token("background")),
    "dark background är inte mörkare än light background",
  );
  // Inte svart: en varm mörk ton, inte #000.
  assert.ok(luminance(darkToken("background")) > 0.002, "dark background är i princip svart");
});

console.log(`${passed} test ok`);

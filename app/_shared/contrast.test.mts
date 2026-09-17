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

console.log(`${passed} test ok`);

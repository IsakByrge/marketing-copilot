// Kör: npx tsx lib/server/factGuard.test.mts
//
// Två sorters test i samma fil:
//
// 1. Att blocket säger rätt saker givet olika kontext.
// 2. Att VARJE promptbyggande fil faktiskt använder det. Det andra är
//    poängen med modulen: spärren fanns tidigare bara i veckoplanens
//    opportunities, och därför hittade inlägg och nyhetsbrev på
//    tjänster som "Boka en service". Glider en ny prompt in utan
//    spärren ska bygget säga ifrån här, inte en kund i en preview.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { factGuardBlock, RISKY_CTA_WORDS, UNSUPPORTED_FORMATS } from "./factGuard";

let passed = 0;
function test(name: string, fn: () => void) {
  try { fn(); passed++; }
  catch (e) { console.error(`FAIL: ${name}\n  ${e instanceof Error ? e.message : e}`); process.exitCode = 1; }
}

/** Varje fil som bygger en prompt vars resultat en kund får läsa.
 *  Listan ska peka på filen som FAKTISKT bygger prompten. Flyttar en
 *  prompt till en modul ska raden flytta med — testet fångade just det
 *  när veckoplanens prompt bröts ut ur routen. */
const PROMPT_FILES = [
  "lib/server/planPrompt.ts",
  "lib/server/contentPrompt.ts",
  "lib/facebook/specialist.ts",
  "lib/productText/prompt.ts",
  "lib/strategist/prompts.ts",
] as const;

const read = (p: string) => readFileSync(new URL(`../../${p}`, import.meta.url), "utf8");

// ── 1. Innehållet i blocket ─────────────────────────────────

test("utan kontext blir spärren strängast, inte svagast", () => {
  const b = factGuardBlock();
  assert.match(b, /nämn då ingen specifik tjänst alls/);
  assert.match(b, /inga angivna/);
});

test("produkter listas när de finns", () => {
  const b = factGuardBlock({ products: ["Gasol i Lösvikt", "Gasolflaskor"] });
  assert.match(b, /- Gasol i Lösvikt/);
  assert.match(b, /- Gasolflaskor/);
});

test("godkända uppmaningar listas i stället för standardtexten", () => {
  const b = factGuardBlock({ approvedCtas: ["Kom förbi depån"] });
  assert.match(b, /- Kom förbi depån/);
  assert.ok(!/inga angivna — använd då/.test(b.split("Godkända uppmaningar:")[1] ?? ""));
});

test("riskorden nämns explicit, så CTA-regeln blir konkret", () => {
  const b = factGuardBlock();
  for (const w of RISKY_CTA_WORDS) {
    assert.ok(b.includes(`"${w}"`), `saknar riskordet ${w}`);
  }
});

test("format vi saknar material för räknas upp", () => {
  const b = factGuardBlock();
  for (const f of UNSUPPORTED_FORMATS) {
    assert.ok(b.includes(`"${f}"`), `saknar formatet ${f}`);
  }
});

test("de konkreta exempel som faktiskt slank igenom nämns vid namn", () => {
  // "Boka en service idag" och "Boka din inspektion idag" var de två
  // uppmaningar som publicerades utan täckning. De står med i spärren
  // som exempel, eftersom modellen följer konkreta instruktioner bäst.
  const b = factGuardBlock();
  assert.match(b, /Boka en service/);
  assert.match(b, /Boka din inspektion/);
});

test("förbjudna påståenden tas med bara när de finns", () => {
  assert.ok(!factGuardBlock().includes("UTTRYCKLIGEN FÖRBJUDIT"));
  assert.match(factGuardBlock({ forbiddenClaims: ["marknadens billigaste"] }), /marknadens billigaste/);
});

test("rubrik-lovar-lista-regeln finns med", () => {
  assert.match(factGuardBlock(), /5 steg/);
  assert.match(factGuardBlock(), /checklista/);
});

test("platser och webbadress tas med när de är kända", () => {
  const b = factGuardBlock({ locations: ["Depån i Norrköping"], website: "gasolfyllarna.se" });
  assert.match(b, /Depån i Norrköping/);
  assert.match(b, /gasolfyllarna\.se/);
});

// ── 2. Att varje prompt använder den ────────────────────────

test("varje promptbyggande fil importerar faktaspärren", () => {
  for (const f of PROMPT_FILES) {
    // Grannfiler importerar relativt, övriga via alias. Båda duger.
    assert.match(
      read(f),
      /from "(@\/lib\/server\/factGuard|\.\/factGuard)"/,
      `${f} importerar inte factGuard`,
    );
  }
});

test("varje promptbyggande fil väver faktiskt in blocket", () => {
  for (const f of PROMPT_FILES) {
    const src = read(f);
    // Antingen direkt i en mall, eller via en konstant som är det.
    const anvander = /\$\{factGuardBlock\(/.test(src)
      || /\$\{FACT_GUARD\}/.test(src)
      || /push\(factGuardBlock\(/.test(src);
    assert.ok(anvander, `${f} importerar factGuard men använder det inte i en prompt`);
  }
});

test("ingen prompt har en egen kopia av spärrtexten", () => {
  // En omskriven kopia är precis hur de glider isär. Rubriken får bara
  // finnas i modulen.
  for (const f of PROMPT_FILES) {
    const traffar = read(f).split("FAKTASPÄRR").length - 1;
    assert.equal(traffar, 0, `${f} har en egen FAKTASPÄRR-rubrik i stället för modulens`);
  }
  assert.ok(factGuardBlock().includes("FAKTASPÄRR"));
});

console.log(`${passed} test ok`);

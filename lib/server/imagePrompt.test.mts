// Kör: npx tsx lib/server/imagePrompt.test.mts
import assert from "node:assert/strict";
import { buildImagePrompt, briefToSubject, qualityParam } from "./imagePrompt";

let passed = 0;
function test(name: string, fn: () => void) {
  try { fn(); passed++; }
  catch (e) { console.error(`FAIL: ${name}\n  ${e instanceof Error ? e.message : e}`); process.exitCode = 1; }
}

test("motivet står först", () => {
  const p = buildImagePrompt({ subject: "En kund fyller en gasolflaska" });
  assert.ok(p.startsWith("En kund fyller en gasolflaska"));
});

test("tomt motiv ger tom prompt", () => {
  assert.equal(buildImagePrompt({ subject: "   " }), "");
});

test("standardförbud finns alltid med", () => {
  const p = buildImagePrompt({ subject: "Något" });
  assert.ok(p.includes("logotyper"));
  assert.ok(p.includes("deformerade händer"));
});

test("egna förbud läggs till", () => {
  const p = buildImagePrompt({ subject: "Något", avoid: ["stockfoto-känsla"] });
  assert.ok(p.includes("stockfoto-känsla"));
});

test("dubbletter i förbudslistan tas bort", () => {
  const p = buildImagePrompt({ subject: "Något", avoid: ["Text", "text", "TEXT"] });
  const matches = p.toLowerCase().match(/\btext\b/g) ?? [];
  assert.equal(matches.length, 1);
});

test("företagsnamn förekommer aldrig — det måste anropet utelämna", () => {
  const p = buildImagePrompt({ subject: "En flaska" });
  assert.ok(!p.toLowerCase().includes("marknadsföringsbild"));
  assert.ok(!p.toLowerCase().includes("professionell"));
});

test("stilraden är konkret fotografispråk", () => {
  const p = buildImagePrompt({ subject: "Något" });
  assert.ok(p.includes("dagsljus"));
  assert.ok(p.includes("35 mm"));
});

test("briefToSubject prioriterar motiv och komposition", () => {
  const s = briefToSubject({
    concept: "Kundvänlig gasolfyllning",
    subject: "En person som fyller en flaska",
    composition: "Nära, i halvbild",
  });
  assert.ok(s.startsWith("En person som fyller en flaska"));
  assert.ok(s.includes("Nära, i halvbild"));
  assert.ok(!s.includes("Kundvänlig"));
});

test("briefToSubject faller tillbaka på concept när annat saknas", () => {
  assert.equal(briefToSubject({ concept: "Bara ett koncept" }), "Bara ett koncept");
});

test("briefToSubject klarar tom brief", () => {
  assert.equal(briefToSubject({}), "");
});

test("kvalitet mappas till API-värden", () => {
  assert.equal(qualityParam("draft"), "low");
  assert.equal(qualityParam("final"), "high");
});

console.log(`${passed} test ok`);

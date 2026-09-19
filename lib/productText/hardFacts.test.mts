// Kör: npx tsx lib/productText/hardFacts.test.mts
//
// Kortare får inte betyda fattigare. Verona (101259) gick från 13 270 tecken
// till 694 och tappade varje siffra. De här testen håller den kontrollen
// som fångar det.
import assert from "node:assert/strict";
import { extractHardFacts, missingHardFacts, parseListedFacts, uncoveredFacts } from "./hardFacts";
import {
  validateGenerated, validateProducts, stripInternalFields, buildUserPrompt, buildRetryPrompt,
  rewriteReasons, isImprovement,
} from "./prompt";

let passed = 0;
function test(name: string, fn: () => void) {
  try { fn(); passed++; }
  catch (e) { console.error(`FAIL: ${name}\n  ${e instanceof Error ? e.message : e}`); process.exitCode = 1; }
}

const labels = (text: string) => extractHardFacts(text).map((f) => f.label);

// Veronas egna meningar, ordagrant ur exporten.
const VERONA = [
  "Denna stilrena kamin är perfekt för uppvärmning av utrymmen upp till 40–100 m², idealisk för både vardagsrum.",
  "Med en maxeffekt på 3,4 kW och en mineffekt på 1,9 kW anpassar du enkelt värmen.",
  "Tack vare termostatsstyrd reglering och inbyggda ODS (Oxygen Depletion Sensor) samt FFD (Flame Failure Device).",
  "Med en maximal förbrukning på 247 g/h och minimal på 138 g/h.",
  "Den passar gasolflaskor upp till 11 kg.",
  "Lämplig flaska är PC10 eller P11 men även mindre fungerar.",
  "Obs. Levereras utan regulator och slang.",
].join(" ");

// ── Utvinning ───────────────────────────────────────────────

test("hittar alla Veronas tal med enhet och förkortningar", () => {
  assert.deepEqual(labels(VERONA), [
    "40 m²", "100 m²", "3,4 kW", "1,9 kW", "247 g/h", "138 g/h", "11 kg",
    "ODS", "FFD", "PC10", "P11",
  ]);
});

test("intervall och mått med x blir ett tal per led", () => {
  assert.deepEqual(labels("Mått 475x424x743 mm, effekt 1,9 - 3,4 kW"), [
    "475 mm", "424 mm", "743 mm", "1,9 kW", "3,4 kW",
  ]);
});

test("enheter: mbar är inte m, kWh är inte kW", () => {
  assert.deepEqual(labels("30 mbar, 2 kWh, 8 mm, 10 m"), ["30 mbar", "2 kWh", "8 mm", "10 m"]);
});

test("pris, procent och tal utan enhet krävs inte", () => {
  assert.deepEqual(labels("Nu 699 kr, spara 20 %, 3 st i lager"), []);
});

test("versalrubriker och OBS är inte förkortningar", () => {
  assert.deepEqual(labels("OBS! VARMT OCH SKÖNT. Nyhet."), []);
});

test("siffran i en modellkod är inte ett mått", () => {
  assert.deepEqual(labels("PC10 och 10 kg"), ["10 kg", "PC10"]);
});

test("EN 559 och EN559 är samma standard", () => {
  assert.deepEqual(missingHardFacts("Slang enligt EN 559", "Godkänd enligt EN559"), []);
});

test("en förkortning före ett mått slukar inte måttet", () => {
  assert.deepEqual(labels("FFD 138 g/h"), ["138 g/h", "FFD"]);
});

// ── Jämförelse ──────────────────────────────────────────────

test("samma fakta i annan form räknas som kvar", () => {
  const after = "Effekt 1,9–3,4 kW. Värmer 40-100 m2. Förbrukning 138–247 g/h. " +
    "Säkerhet: ODS och FFD. Flaska PC10 eller P11, högst 11 kg.";
  assert.deepEqual(missingHardFacts(VERONA, after), []);
});

test("'mellan 40 och 100 m²' och '40 till 100 m²' är intervall", () => {
  // Verona, första försöket: "mellan 40 och 100 m²" avvisades för att 40 saknade enhet.
  assert.deepEqual(missingHardFacts("40–100 m²", "för utrymmen mellan 40 och 100 m²"), []);
  assert.deepEqual(missingHardFacts("40–100 m²", "från 40 till 100 m²"), []);
});

test("'och' mellan två hela mått förblir två mått", () => {
  assert.deepEqual(labels("maxeffekt 3,4 kW och mineffekt 1,9 kW"), ["3,4 kW", "1,9 kW"]);
});

test("decimalpunkt och decimalkomma är samma tal", () => {
  assert.deepEqual(missingHardFacts("3,4 kW", "3.4 kW"), []);
});

test("det Verona tappade rapporteras, i före-textens ordning", () => {
  const after = "En stilren gasolkamin för stugan. Fyll på gasol hos oss.";
  assert.deepEqual(missingHardFacts(VERONA, after), labels(VERONA));
});

test("en ändrad siffra är en saknad siffra", () => {
  assert.deepEqual(missingHardFacts("3,4 kW", "3,5 kW"), ["3,4 kW"]);
});

test("utan fakta i före-texten saknas inget", () => {
  assert.deepEqual(missingHardFacts("En fin produkt.", ""), []);
});

// ── I kedjan ────────────────────────────────────────────────

const [VERONA_INPUT] = validateProducts([{
  id: "101259", name: "Gasolkamin Verona", template: "huvudprodukt",
  category: "Värmare", subCategory: "Gasolkaminer", producer: "Gasso",
  current: `<p>${VERONA}</p>`,
}])!;

test("validateGenerated märker texten med det som tappats", () => {
  const out = validateGenerated(
    { texts: [{ id: "101259", description: "<p>Gasolkamin med 3,4 kW.</p>", metaTitle: "T", metaDescription: "D" }] },
    [VERONA_INPUT],
  )!;
  assert.ok(out[0].missingFacts.includes("1,9 kW"));
  assert.ok(!out[0].missingFacts.includes("3,4 kW"));
});

test("prompten listar det som måste finnas med", () => {
  const user = buildUserPrompt([VERONA_INPUT]);
  assert.match(user, /MÅSTE FINNAS MED: 40 m², 100 m², 3,4 kW/);
});

test("omskrivningen säger exakt vad som saknades", () => {
  const rejected = {
    id: "101259", description: "<p>Kamin med 3,4 kW.</p>", metaTitle: "", metaDescription: "",
    needsInfo: [], missingFacts: ["247 g/h", "ODS"], facts: [], uncoveredFacts: ["tillverkad i gjutjärn"], keywords: [],
  };
  const retry = buildRetryPrompt([VERONA_INPUT], [{ id: "101259", reasons: rewriteReasons(rejected) }]);
  assert.match(retry, /AVVISADES/);
  assert.match(retry, /id 101259: de här uppgifterna ur den befintliga texten saknades: 247 g\/h, ODS/);
  assert.match(retry, /skrev inte med dem: tillverkad i gjutjärn/);
});

test("omskrivningen behålls bara om den är bättre", () => {
  const base = { id: "1", description: "<p>x</p>", metaTitle: "", metaDescription: "", needsInfo: [], facts: [], keywords: [] };
  const a = { ...base, missingFacts: ["11 kg"], uncoveredFacts: [] };
  const b = { ...base, missingFacts: [], uncoveredFacts: ["gjutjärn"] };
  const c = { ...base, missingFacts: [], uncoveredFacts: [] };
  // Ett tappat tal väger tyngre än en tappad egen uppgift.
  assert.equal(isImprovement(b, a), true);
  assert.equal(isImprovement(a, b), false);
  assert.equal(isImprovement(c, b), true);
  assert.equal(isImprovement(a, a), false);
});

// ── Modellens egen faktalista ───────────────────────────────

test("uppgift vars ord saknas i texten rapporteras", () => {
  // Verona, tredje körningen: gjutjärn och batteritändning föll bort.
  const facts = parseListedFacts([
    { uppgift: "maxeffekt 3,4 kW", ord: "3,4 kW" },
    { uppgift: "tillverkad i gjutjärn", ord: "gjutjärn" },
    { uppgift: "batteridriven tändning", ord: "batteridriven" },
  ]);
  assert.deepEqual(
    uncoveredFacts(facts, "Effekt 3,4 kW. Kaminfläkten drivs av värmen."),
    ["tillverkad i gjutjärn", "batteridriven tändning"],
  );
});

test("böjd form räknas: gjutjärnet för gjutjärn, gjutjärnskonstruktion också", () => {
  const facts = parseListedFacts([{ uppgift: "gjutjärn", ord: "gjutjärn" }]);
  assert.deepEqual(uncoveredFacts(facts, "Gjutjärnet håller."), []);
  assert.deepEqual(uncoveredFacts(facts, "Robust gjutjärnskonstruktion."), []);
});

test("ett mått som nyckelord hittas i ett intervall", () => {
  // Verona, fjärde körningen: "138 g/h" flaggades fast texten sa "138-247 g/h".
  const facts = parseListedFacts([{ uppgift: "förbrukning 138 g/h", ord: "138 g/h" }]);
  assert.deepEqual(uncoveredFacts(facts, "Förbrukning: 138-247 g/h"), []);
  assert.deepEqual(uncoveredFacts(facts, "Förbrukning: 247 g/h"), ["förbrukning 138 g/h"]);
});

test("faktalistan tål skräp från modellen", () => {
  assert.deepEqual(parseListedFacts("inte en lista"), []);
  assert.deepEqual(parseListedFacts([{ uppgift: "utan ord" }, null, "sträng", { uppgift: "ok", ord: "ok" }]), [
    { uppgift: "ok", ord: "ok" },
  ]);
  assert.equal(parseListedFacts(Array(100).fill({ uppgift: "a", ord: "a" })).length, 40);
});

test("validateGenerated läser fakta och märker det som inte kom med", () => {
  const out = validateGenerated({
    texts: [{
      id: "101259", description: "<p>Gasolkamin med 3,4 kW.</p>", metaTitle: "T", metaDescription: "D",
      fakta: [{ uppgift: "maxeffekt 3,4 kW", ord: "3,4 kW" }, { uppgift: "tillverkad i gjutjärn", ord: "gjutjärn" }],
    }],
  }, [VERONA_INPUT])!;
  assert.equal(out[0].facts.length, 2);
  assert.deepEqual(out[0].uncoveredFacts, ["tillverkad i gjutjärn"]);
});

// ── Interna fält ────────────────────────────────────────────

test("interna fält skrivs aldrig ut som kundtext", () => {
  const html = "<p>Kaminen värmer.</p><ul><li>Kategori: Värmare</li><li><strong>Underkategori:</strong> Gasolkaminer</li>" +
    "<li>Tillverkare: Gasso</li><li>Modell: Verona</li></ul><ul><li>Effekt: 3,4 kW</li></ul>";
  assert.equal(stripInternalFields(html), "<p>Kaminen värmer.</p><ul><li>Effekt: 3,4 kW</li></ul>");
});

test("interna fält står inte som 'Kategori:' i prompten", () => {
  const user = buildUserPrompt([VERONA_INPUT]);
  assert.ok(!/Kategori:/.test(user));
  assert.match(user, /interna fält \(skriv aldrig ut dem\): kategori Värmare/);
});

console.log(`${passed} test ok`);

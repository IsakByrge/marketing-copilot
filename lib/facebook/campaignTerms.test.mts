// Kör: npx tsx lib/facebook/campaignTerms.test.mts
//
// Buggrapport: kampanjen "20 % på Mustang" gav en huvudtext utan Mustang
// och utan 20 procent. Båda alternativen hade dem. De här testen håller
// kontrollen som ser till att huvudtexten nämner produkt och erbjudande.
import assert from "node:assert/strict";
import { missingCampaignTerms, nameMentioned, offerMentioned } from "./quality";

let passed = 0;
function test(name: string, fn: () => void) {
  try { fn(); passed++; }
  catch (e) { console.error(`FAIL: ${name}\n  ${e instanceof Error ? e.message : e}`); process.exitCode = 1; }
}

const MUSTANG = { product: "Mustang gasolgrill", offer: "20 % på Mustang" };

test("den rapporterade huvudtexten fångas: varken produkt eller erbjudande", () => {
  assert.deepEqual(
    missingCampaignTerms("Allt du behöver för att göra varje grillning till en succé.", MUSTANG),
    ["Mustang gasolgrill", "20 % på Mustang"],
  );
});

test("produkten och rabatten i vanliga skrivsätt godkänns", () => {
  for (const text of [
    "Nu får du 20 % på Mustang gasolgrill.",
    "20% rabatt på Mustang gasolgrillen i helgen.",
    "Mustang-gasolgrill, nu 20 procent billigare.",
    "MUSTANG GASOLGRILL: 20 % i veckan",
  ]) {
    assert.deepEqual(missingCampaignTerms(text, MUSTANG), [], text);
  }
});

test("rabatt utan produktnamn räcker inte, och tvärtom", () => {
  assert.deepEqual(missingCampaignTerms("Nu 20 % på alla grillar.", MUSTANG), ["Mustang gasolgrill"]);
  assert.deepEqual(missingCampaignTerms("Mustang gasolgrill till bra pris.", MUSTANG), ["20 % på Mustang"]);
});

test("fel tal eller fel enhet räknas inte", () => {
  assert.equal(offerMentioned("Nu 120 % bättre", "20 %"), false);
  assert.equal(offerMentioned("Nu 25 % på Mustang", "20 %"), false);
  assert.equal(offerMentioned("Spara 20 kr", "20 %"), false);
  assert.equal(offerMentioned("Pris 2,0 kg", "20 %"), false);
});

test("kronor skrivs på flera sätt", () => {
  assert.equal(offerMentioned("Spara 500 kronor", "500 kr rabatt"), true);
  assert.equal(offerMentioned("Nu 1 499:-", "1 499 kr"), true);
  assert.equal(offerMentioned("Spara 500:-", "500 kr"), true);
});

test("erbjudande utan tal krävs ordagrant", () => {
  assert.equal(offerMentioned("Fri frakt hela veckan", "Fri frakt"), true);
  assert.equal(offerMentioned("Vi skickar gratis", "Fri frakt"), false);
});

test("namnet får stå i början av ett ord men inte mitt i", () => {
  assert.equal(nameMentioned("Mustangs nya grill", "Mustang"), true);
  assert.equal(nameMentioned("Fordmustang", "Mustang"), false);
});

test("långa beskrivningar kan inte krävas ordagrant och hoppas över", () => {
  assert.equal(nameMentioned("x", "grillar och tillbehör till sommarens alla fester"), null);
  assert.deepEqual(missingCampaignTerms("x", { product: "grillar och tillbehör till sommarens alla fester" }), []);
});

test("tomt underlag kräver ingenting", () => {
  assert.deepEqual(missingCampaignTerms("valfri text", {}), []);
  assert.deepEqual(missingCampaignTerms("valfri text", { product: " ", offer: "" }), []);
});

console.log(`${passed} test ok`);

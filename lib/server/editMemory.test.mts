// Kör: npx tsx lib/server/editMemory.test.mts
//
// Testar bara den rena logiken — filtret och formateringen. Läsning och
// skrivning mot Supabase testas inte här (kräver session och nätverk).
import assert from "node:assert/strict";
import { isMeaningfulEdit, formatEditPairs, MAX_PAIRS } from "./editMemory";

let passed = 0;
function test(name: string, fn: () => void) {
  try { fn(); passed++; }
  catch (e) { console.error(`FAIL: ${name}\n  ${e instanceof Error ? e.message : e}`); process.exitCode = 1; }
}

test("identisk text är ingen signal", () => {
  assert.equal(isMeaningfulEdit("Vi fyller din flaska.", "Vi fyller din flaska."), false);
});

test("enbart whitespace skiljer är ingen signal", () => {
  assert.equal(isMeaningfulEdit("Vi fyller  din flaska.", "Vi fyller din flaska. "), false);
});

test("tomt värde är ingen signal", () => {
  assert.equal(isMeaningfulEdit("", "Något"), false);
  assert.equal(isMeaningfulEdit("Något", "   "), false);
});

test("ett struket utropstecken är för litet för att räknas", () => {
  assert.equal(isMeaningfulEdit("Kom förbi idag!", "Kom förbi idag"), false);
});

test("en struken mening är en signal", () => {
  const before = "Vi fyller din flaska medan du väntar. Det är både enkelt och kostnadseffektivt!";
  const after = "Vi fyller din flaska medan du väntar.";
  assert.equal(isMeaningfulEdit(before, after), true);
});

test("omskrivning med samma längd är en signal", () => {
  const before = "Perfekt för alla dina behov av gasol till hemmet";
  const after = "Räcker till grillen och terrassvärmaren under hela sommaren";
  assert.equal(isMeaningfulEdit(before, after), true);
});

test("tomt minne ger tom sträng", () => {
  assert.equal(formatEditPairs([]), "");
});

test("formatering innehåller båda versionerna", () => {
  const block = formatEditPairs([{ original: "AI-text", edited: "Min text" }]);
  assert.ok(block.includes("AI-text"));
  assert.ok(block.includes("Min text"));
  assert.ok(block.includes("DU SKREV"));
});

test("senaste paret hamnar sist, närmast instruktionen", () => {
  const block = formatEditPairs([
    { original: "nyast original", edited: "nyast" },
    { original: "äldst original", edited: "äldst" },
  ]);
  assert.ok(block.indexOf("äldst") < block.indexOf("nyast"));
});

test("långa texter klipps", () => {
  const long = "x".repeat(2000);
  const block = formatEditPairs([{ original: long, edited: "kort" }]);
  assert.ok(block.includes("…"));
  assert.ok(block.length < 2000);
});

test("MAX_PAIRS är rimligt tilltaget", () => {
  assert.ok(MAX_PAIRS >= 3 && MAX_PAIRS <= 20);
});

console.log(`${passed} test ok`);

// Kör: npx tsx app/_shared/locations.test.mts
import assert from "node:assert/strict";
import { ortesFranText, tillgangligaOrter, veckansOrt } from "./locations";

let passed = 0;
function test(name: string, fn: () => void) {
  try { fn(); passed++; }
  catch (e) { console.error(`FAIL: ${name}\n  ${e instanceof Error ? e.message : e}`); process.exitCode = 1; }
}

test("läser en uppräkning efter depåer", () => {
  assert.deepEqual(
    ortesFranText("Vi har depåer i Norrköping, Linköping och Nyköping."),
    ["Norrköping", "Linköping", "Nyköping"],
  );
});

test("läser en ensam butiksort", () => {
  assert.deepEqual(ortesFranText("Butik i Örebro sedan 1998."), ["Örebro"]);
});

test("hittar inget när texten inte nämner någon plats", () => {
  assert.deepEqual(ortesFranText("Vi säljer gasol till privatpersoner."), []);
  assert.deepEqual(ortesFranText(undefined), []);
  assert.deepEqual(ortesFranText(""), []);
});

test("gemener räknas inte som ort", () => {
  // "i lösvikt" ska inte bli orten "Lösvikt".
  assert.deepEqual(ortesFranText("Vi fyller gasol i lösvikt."), []);
});

test("ifyllda platser slår alltid reservläsningen", () => {
  assert.deepEqual(
    tillgangligaOrter([{ id: "1", city: "Motala" }], "Vi har depåer i Norrköping och Linköping."),
    ["Motala"],
  );
});

test("reserven används bara när listan är tom", () => {
  assert.deepEqual(
    tillgangligaOrter([], "Vi har depåer i Norrköping och Linköping."),
    ["Norrköping", "Linköping"],
  );
  assert.deepEqual(tillgangligaOrter([], "Ingen ort alls."), []);
  assert.deepEqual(tillgangligaOrter(undefined, undefined), []);
});

test("dubbletter och tomma orter rensas", () => {
  assert.deepEqual(
    tillgangligaOrter(
      [{ id: "1", city: "Motala" }, { id: "2", city: " Motala " }, { id: "3", city: "  " }],
      undefined,
    ),
    ["Motala"],
  );
});

test("rotationen ger en ny ort varje vecka och börjar om", () => {
  const orter = ["Norrköping", "Linköping", "Nyköping"];
  const veckor = [38, 39, 40, 41].map((v) => veckansOrt(orter, v));
  assert.equal(new Set(veckor.slice(0, 3)).size, 3, "tre veckor i rad ska ge tre olika orter");
  assert.equal(veckor[3], veckor[0], "fjärde veckan börjar om");
});

test("samma vecka ger alltid samma ort", () => {
  const orter = ["A", "B", "C"];
  assert.equal(veckansOrt(orter, 12), veckansOrt(orter, 12));
});

test("en enda ort fungerar, och noll ger null", () => {
  assert.equal(veckansOrt(["Motala"], 7), "Motala");
  assert.equal(veckansOrt([], 7), null);
});

test("årsskiftets veckonummer kraschar inte rotationen", () => {
  const orter = ["A", "B"];
  for (const v of [1, 52, 53]) {
    assert.ok(orter.includes(veckansOrt(orter, v)!), `vecka ${v}`);
  }
});

console.log(`${passed} test ok`);

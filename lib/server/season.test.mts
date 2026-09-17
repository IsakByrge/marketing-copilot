// Kör: npx tsx lib/server/season.test.mts
import assert from "node:assert/strict";
import {
  sasongsfelIText, forbjudnaSasongsord, sasongsBlock, manad,
  SOMMARORD, VINTERORD,
} from "./season";

let passed = 0;
function test(name: string, fn: () => void) {
  try { fn(); passed++; }
  catch (e) { console.error(`FAIL: ${name}\n  ${e instanceof Error ? e.message : e}`); process.exitCode = 1; }
}

const sept = new Date("2026-09-17T12:00:00Z");
const maj = new Date("2026-05-17T12:00:00Z");
const feb = new Date("2026-02-17T12:00:00Z");
const aug = new Date("2026-08-17T12:00:00Z");

test("månaden räknas i Europe/Stockholm", () => {
  assert.equal(manad(sept), 9);
  // 31 aug 23:30 UTC är redan 1 september i Sverige.
  assert.equal(manad(new Date("2026-08-31T23:30:00Z")), 9);
});

test("september–februari förbjuder sommarord", () => {
  for (const d of [sept, feb]) {
    assert.deepEqual([...forbjudnaSasongsord(d)], [...SOMMARORD], `månad ${manad(d)}`);
  }
});

test("mars–augusti förbjuder vinterord", () => {
  for (const d of [maj, aug]) {
    assert.deepEqual([...forbjudnaSasongsord(d)], [...VINTERORD], `månad ${manad(d)}`);
  }
});

test("det verkliga felet fångas: hetta i september", () => {
  assert.deepEqual(sasongsfelIText("Fyll på gasol inför hettan", sept), ["hett"]);
});

test("sommarsäsong i en septembertext fångas", () => {
  // Kom ur en riktig körning: "Efter en aktiv sommarsäsong …"
  assert.deepEqual(
    sasongsfelIText("Efter en aktiv sommarsäsong vårdar du utrustningen.", sept),
    ["sommar"],
  );
});

test("åt andra hållet: jul och snö i maj fångas", () => {
  const fel = sasongsfelIText("Julkampanj med snö och kyla", maj);
  assert.ok(fel.includes("jul"));
  assert.ok(fel.includes("snö"));
  assert.ok(fel.includes("kyla"));
});

test("rätt årstid flaggas inte", () => {
  assert.deepEqual(sasongsfelIText("Höstmörkret kommer smygande.", sept), []);
  assert.deepEqual(sasongsfelIText("Grillsäsongen är igång.", maj), []);
});

test("tom text ger inget fel", () => {
  assert.deepEqual(sasongsfelIText(undefined, sept), []);
  assert.deepEqual(sasongsfelIText("", sept), []);
});

test("promptblocket skriver ut månadens faktiska förbud", () => {
  const b = sasongsBlock(sept);
  assert.match(b, /"hett"/);
  assert.match(b, /kalla halvan/);
  assert.match(b, /kampanjtitlar/i);
  assert.ok(!b.includes('"snö"'), "vinterord ska inte förbjudas i september");
});

console.log(`${passed} test ok`);

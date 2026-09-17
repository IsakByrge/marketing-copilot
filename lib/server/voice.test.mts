// Kör: npx tsx lib/server/voice.test.mts
import assert from "node:assert/strict";
import { isoWeek, todayLabel, voiceBlock, BANNED_PHRASES, greeting, stockholmHour, isoWeekKey, isPlanStale } from "./voice";

let passed = 0;
function test(name: string, fn: () => void) {
  try { fn(); passed++; }
  catch (e) { console.error(`FAIL: ${name}\n  ${e instanceof Error ? e.message : e}`); process.exitCode = 1; }
}

// ISO 8601: veckan tillhör det år dess torsdag ligger i.
test("4 januari ligger alltid i vecka 1", () => {
  for (const y of [2021, 2022, 2023, 2024, 2025, 2026]) {
    assert.equal(isoWeek(new Date(y, 0, 4)), 1, `${y}`);
  }
});

test("1 januari 2021 tillhör vecka 53 föregående år", () => {
  assert.equal(isoWeek(new Date(2021, 0, 1)), 53);
});

test("31 december 2024 tillhör vecka 1", () => {
  assert.equal(isoWeek(new Date(2024, 11, 31)), 1);
});

test("5 augusti 2026 är vecka 32", () => {
  assert.equal(isoWeek(new Date(2026, 7, 5)), 32);
});

test("veckonumret ligger alltid inom 1–53", () => {
  const d = new Date(2026, 0, 1);
  while (d.getFullYear() === 2026) {
    const w = isoWeek(d);
    assert.ok(w >= 1 && w <= 53, `${d.toDateString()} gav ${w}`);
    d.setDate(d.getDate() + 1);
  }
});

test("todayLabel innehåller dag, månad, år och vecka", () => {
  assert.equal(todayLabel(new Date(2026, 7, 5)), "5 augusti 2026, vecka 32");
});

test("voiceBlock innehåller förbjudna fraser och exempel", () => {
  const b = voiceBlock();
  assert.ok(b.includes("perfekt för"));
  assert.ok(b.includes("skridskor"));
  assert.ok(!b.includes("VARIATION"));
});

test("variation läggs bara till på begäran", () => {
  assert.ok(voiceBlock({ variation: true }).includes("VARIATION"));
});

test("exemplet kan stängas av", () => {
  assert.ok(!voiceBlock({ example: false }).includes("skridskor"));
});

test("inga dubbletter i förbjuden-listan", () => {
  assert.equal(new Set(BANNED_PHRASES).size, BANNED_PHRASES.length);
});


// ── Hälsning efter svensk tid ───────────────────────────────
// UTC-tider med flit: poängen är att hälsningen ska följa Stockholm,
// inte maskinens tidszon. Januari = UTC+1, juli = UTC+2.
test("hälsningen följer Europe/Stockholm, inte UTC", () => {
  // 07:30 UTC i januari = 08:30 svensk tid → morgon
  assert.equal(greeting(new Date("2026-01-15T07:30:00Z")), "God morgon");
  // 22:30 UTC i januari = 23:30 svensk tid → kväll
  assert.equal(greeting(new Date("2026-01-15T22:30:00Z")), "God kväll");
  // 23:30 UTC i juli = 01:30 svensk tid dagen efter → morgon
  assert.equal(greeting(new Date("2026-07-15T23:30:00Z")), "God morgon");
});

test("de fyra delarna av dygnet", () => {
  const svensk = (h: number) => new Date(Date.UTC(2026, 0, 15, h - 1, 0, 0)); // januari: UTC+1
  assert.equal(greeting(svensk(6)), "God morgon");
  assert.equal(greeting(svensk(9)), "God morgon");
  assert.equal(greeting(svensk(10)), "God förmiddag");
  assert.equal(greeting(svensk(11)), "God förmiddag");
  assert.equal(greeting(svensk(12)), "God eftermiddag");
  assert.equal(greeting(svensk(17)), "God eftermiddag");
  assert.equal(greeting(svensk(18)), "God kväll");
  assert.equal(greeting(svensk(23)), "God kväll");
});

test("midnatt är timme 0, aldrig 24", () => {
  assert.equal(stockholmHour(new Date("2026-01-15T23:00:00Z")), 0);
});

// ── Gammalt förslag ──────────────────────────────────
test("veckonyckeln skiljer på samma veckonummer olika år", () => {
  assert.equal(isoWeekKey(new Date(2026, 0, 8)), "2026-v2");
  assert.notEqual(isoWeekKey(new Date(2025, 0, 8)), isoWeekKey(new Date(2026, 0, 8)));
});

test("en plan från samma vecka är inte gammal", () => {
  const nu = new Date(2026, 8, 16);           // onsdag
  const mandag = new Date(2026, 8, 14);
  const sondag = new Date(2026, 8, 20);
  assert.equal(isPlanStale(mandag.toISOString(), nu), false);
  assert.equal(isPlanStale(sondag.toISOString(), nu), false);
});

test("en plan från förra veckan är gammal", () => {
  const nu = new Date(2026, 8, 16);
  assert.equal(isPlanStale(new Date(2026, 8, 13).toISOString(), nu), true);  // söndag innan
  assert.equal(isPlanStale(new Date(2025, 8, 16).toISOString(), nu), true);  // ett år tidigare
});

test("saknat eller trasigt datum ger ingen varning", () => {
  assert.equal(isPlanStale(undefined), false);
  assert.equal(isPlanStale("inte ett datum"), false);
});

console.log(`${passed} test ok`);

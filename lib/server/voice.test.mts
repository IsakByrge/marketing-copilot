// Kör: npx tsx lib/server/voice.test.mts
import assert from "node:assert/strict";
import { isoWeek, todayLabel, voiceBlock, BANNED_PHRASES, greeting, stockholmHour, isoWeekKey, isPlanStale, weeksAhead, weekLabel, opportunityWhen, stockholmDate } from "./voice";

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

// ── Veckoetiketter ──────────────────────────────────────────
// Alla Date(Date.UTC(...)) nedan är avsiktliga: poängen är att veckan
// ska räknas i Europe/Stockholm, inte i maskinens tidszon.

test("stockholmDate ger svensk kalenderdag, inte UTC-dag", () => {
  // Söndag 23:30 UTC i september = måndag 01:30 svensk tid.
  const d = stockholmDate(new Date("2026-09-20T23:30:00Z"));
  assert.equal(d.toISOString().slice(0, 10), "2026-09-21");
});

test("söndag till måndag byter vecka", () => {
  const sondag = new Date(Date.UTC(2026, 8, 20, 12));   // 20 sep 2026
  const mandag = new Date(Date.UTC(2026, 8, 21, 12));   // 21 sep 2026
  assert.notEqual(isoWeekKey(sondag), isoWeekKey(mandag));
  assert.equal(weeksAhead(mandag, sondag), 1);
  assert.equal(weekLabel(mandag, sondag), "Nästa vecka");
});

test("gränsen går vid svensk midnatt, inte UTC-midnatt", () => {
  // 23:30 UTC på söndagen är redan måndag i Sverige (UTC+2).
  const straxEfterSvenskMidnatt = new Date("2026-09-20T23:30:00Z");
  const mandagMitt = new Date(Date.UTC(2026, 8, 21, 12));
  assert.equal(weekLabel(mandagMitt, straxEfterSvenskMidnatt), "Denna vecka");
  // 21:30 UTC samma kväll är fortfarande söndag i Sverige.
  const foreSvenskMidnatt = new Date("2026-09-20T21:30:00Z");
  assert.equal(weekLabel(mandagMitt, foreSvenskMidnatt), "Nästa vecka");
});

test("hela veckan räknas som samma vecka", () => {
  const onsdag = new Date(Date.UTC(2026, 8, 16, 12));
  for (const dag of [14, 15, 16, 17, 18, 19, 20]) {
    assert.equal(weekLabel(new Date(Date.UTC(2026, 8, dag, 12)), onsdag), "Denna vecka", "dag " + dag);
  }
});

test("årsskifte: vecka 53 följs av vecka 1", () => {
  // 2026-12-28 är måndag i ISO-vecka 53, 2027-01-04 är måndag i vecka 1.
  const v53 = new Date(Date.UTC(2026, 11, 28, 12));
  const v1 = new Date(Date.UTC(2027, 0, 4, 12));
  assert.equal(weeksAhead(v1, v53), 1);
  assert.equal(weekLabel(v1, v53), "Nästa vecka");
  assert.notEqual(isoWeekKey(v53), isoWeekKey(v1));
});

test("årsskifte: 31 december och 1 januari kan vara samma vecka", () => {
  // 2026-12-31 (tors) och 2027-01-01 (fre) ligger båda i vecka 53.
  const sista = new Date(Date.UTC(2026, 11, 31, 12));
  const forsta = new Date(Date.UTC(2027, 0, 1, 12));
  assert.equal(isoWeekKey(sista), isoWeekKey(forsta));
  assert.equal(weekLabel(forsta, sista), "Denna vecka");
});

test("längre fram räknas i veckor", () => {
  const nu = new Date(Date.UTC(2026, 8, 16, 12));
  // Nu = onsdag 16 sep, veckan börjar måndag 14 sep.
  assert.equal(weekLabel(new Date(Date.UTC(2026, 8, 21, 12)), nu), "Nästa vecka");
  assert.equal(weekLabel(new Date(Date.UTC(2026, 8, 28, 12)), nu), "Om 2 veckor");
  assert.equal(weekLabel(new Date(Date.UTC(2026, 9, 5, 12)), nu), "Om 3 veckor");
});

test("passerade veckor får egen etikett", () => {
  const nu = new Date(Date.UTC(2026, 8, 16, 12));
  assert.equal(weekLabel(new Date(Date.UTC(2026, 8, 9, 12)), nu), "Förra veckan");
  assert.equal(weekLabel(new Date(Date.UTC(2026, 7, 26, 12)), nu), "För 3 veckor sedan");
});

test("opportunityWhen räknar ISO-datum men lämnar fri text ifred", () => {
  const nu = new Date(Date.UTC(2026, 8, 16, 12));
  assert.equal(opportunityWhen("2026-09-16", nu), "Denna vecka");
  assert.equal(opportunityWhen("2026-09-21", nu), "Nästa vecka");
  // Gamla planer i databasen har fri text — den visas som den är.
  assert.equal(opportunityWhen("Vecka 39", nu), "Vecka 39");
  assert.equal(opportunityWhen("21 juni", nu), "21 juni");
  assert.equal(opportunityWhen(undefined, nu), null);
  assert.equal(opportunityWhen("   ", nu), null);
});

console.log(`${passed} test ok`);

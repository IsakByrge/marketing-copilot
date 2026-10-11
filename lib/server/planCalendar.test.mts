// Kör: npx tsx lib/server/planCalendar.test.mts
import assert from "node:assert/strict";
import {
  easterSunday, swedishCalendar, upcomingCalendar, calendarLines,
  filterOpportunities, stockholmIso,
} from "./planCalendar";

let passed = 0;
function test(name: string, fn: () => void) {
  try { fn(); passed++; }
  catch (e) { console.error(`FAIL: ${name}\n  ${e instanceof Error ? e.message : e}`); process.exitCode = 1; }
}

const dag = (year: number, title: string) =>
  swedishCalendar(year).find((e) => e.title.startsWith(title))?.date;

test("påskdagen stämmer mot kända år", () => {
  assert.equal(easterSunday(2025).toISOString().slice(0, 10), "2025-04-20");
  assert.equal(easterSunday(2026).toISOString().slice(0, 10), "2026-04-05");
  assert.equal(easterSunday(2027).toISOString().slice(0, 10), "2027-03-28");
});

test("rörliga helger 2026", () => {
  assert.equal(dag(2026, "Långfredagen"), "2026-04-03");
  assert.equal(dag(2026, "Kristi himmelsfärdsdag"), "2026-05-14");
  assert.equal(dag(2026, "Pingstdagen"), "2026-05-24");
  assert.equal(dag(2026, "Midsommarafton"), "2026-06-19");
  assert.equal(dag(2026, "Mors dag"), "2026-05-31");
  assert.equal(dag(2026, "Alla helgons dag"), "2026-10-31");
  assert.equal(dag(2026, "Fars dag"), "2026-11-08");
  assert.equal(dag(2026, "Black Friday"), "2026-11-27");
  assert.equal(dag(2026, "Första advent"), "2026-11-29");
});

test("rörliga helger 2025 (andra veckodagar än 2026)", () => {
  assert.equal(dag(2025, "Midsommarafton"), "2025-06-20");
  assert.equal(dag(2025, "Alla helgons dag"), "2025-11-01");
  assert.equal(dag(2025, "Fars dag"), "2025-11-09");
  assert.equal(dag(2025, "Black Friday"), "2025-11-28");
  assert.equal(dag(2025, "Första advent"), "2025-11-30");
});

test("klockbytena", () => {
  assert.equal(dag(2026, "Sommartid"), "2026-03-29");
  assert.equal(dag(2026, "Vintertid"), "2026-10-25");
});

test("höstlovet är måndagen vecka 44, inte dagen planen skapas", () => {
  assert.equal(dag(2026, "Höstlovet"), "2026-10-26");
  assert.equal(dag(2025, "Höstlovet"), "2025-10-27");
});

test("datumen de närmaste två veckorna från 12 okt 2026", () => {
  const titles = upcomingCalendar("2026-10-12").map((e) => `${e.date} ${e.title.split(" ")[0]}`);
  assert.deepEqual(titles, ["2026-10-25 Vintertid", "2026-10-26 Höstlovet"]);
});

test("listan går över årsskiftet", () => {
  const dates = upcomingCalendar("2026-12-28").map((e) => e.date);
  assert.ok(dates.includes("2026-12-31"));
  assert.ok(dates.includes("2027-01-01"));
  assert.ok(dates.includes("2027-01-06"));
});

test("prompten får veckodag med varje datum", () => {
  const rader = calendarLines(upcomingCalendar("2026-10-12"));
  assert.match(rader, /2026-10-25 \(söndag\): Vintertid/);
  assert.equal(calendarLines([]), "(inga datum de närmaste två veckorna)");
});

test("dagens datum räknas i svensk tid", () => {
  // 22:30 UTC den 11 oktober är redan 12 oktober i Sverige (UTC+2).
  assert.equal(stockholmIso(new Date("2026-10-11T22:30:00Z")), "2026-10-12");
});

const lista = upcomingCalendar("2026-10-12");

test("det verkliga felet: höstlovet daterat till planens dag tas bort", () => {
  const ut = filterOpportunities([
    { title: "Höstlovet", date: "2026-10-12", relevance: "x" },
    { title: "Förberedelser inför vintern", date: "2026-10-12", relevance: "y" },
  ], lista);
  assert.deepEqual(ut, []);
});

test("ett datum ur listan behålls, med listans titel", () => {
  const ut = filterOpportunities([{ title: "Höstlov", date: "2026-10-26", relevance: "Familjer är lediga." }], lista);
  assert.equal(ut.length, 1);
  assert.equal(ut[0].title, "Höstlovet börjar (vecka 44 i de flesta kommuner)");
  assert.equal(ut[0].relevance, "Familjer är lediga.");
});

test("samma dag med två datum: titeln avgör vilket", () => {
  const nov = upcomingCalendar("2026-10-25");
  const ut = filterOpportunities([{ title: "Alla helgons dag", date: "2026-10-31", relevance: "x" }], nov);
  assert.equal(ut[0].title, "Alla helgons dag");
  const ut2 = filterOpportunities([{ title: "Halloween", date: "2026-10-31", relevance: "x" }], nov);
  assert.equal(ut2[0].title, "Halloween");
});

test("dubbletter och mer än tre faller bort, skräp tål filtret", () => {
  const nov = upcomingCalendar("2026-10-25");
  const ut = filterOpportunities([
    { title: "Vintertid", date: "2026-10-25" },
    { title: "Vintertid igen", date: "2026-10-25" },
    { title: "Höstlovet", date: "2026-10-26" },
    { title: "Halloween", date: "2026-10-31" },
    { title: "Alla helgons dag", date: "2026-10-31" },
    null, "text", { date: 5 },
  ], nov);
  assert.equal(ut.length, 3);
  assert.deepEqual(filterOpportunities("inte en lista", nov), []);
});

console.log(`${passed} test ok`);

// Kör: npx tsx lib/server/voice.test.mts
import assert from "node:assert/strict";
import { isoWeek, todayLabel, voiceBlock, BANNED_PHRASES } from "./voice";

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

console.log(`${passed} test ok`);

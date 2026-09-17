// Kör: npx tsx app/_shared/websites.test.mts
import assert from "node:assert/strict";
import { normaliseraUrl, arGiltigUrl, vardnamn, lankarIText } from "./websites";

let passed = 0;
function test(name: string, fn: () => void) {
  try { fn(); passed++; }
  catch (e) { console.error(`FAIL: ${name}\n  ${e instanceof Error ? e.message : e}`); process.exitCode = 1; }
}

test("bar domän får https och godkänns", () => {
  assert.deepEqual(normaliseraUrl("gasolfyllarna.se"), {
    ok: true, url: "https://gasolfyllarna.se", fel: "",
  });
});

test("befintligt schema behålls", () => {
  assert.equal(normaliseraUrl("http://exempel.se").url, "http://exempel.se");
  assert.equal(normaliseraUrl("https://shop.exempel.se/gasol").url, "https://shop.exempel.se/gasol");
});

test("avslutande snedstreck normaliseras bort", () => {
  // Annars lagras samma adress i två former och jämförelser slutar stämma.
  assert.equal(normaliseraUrl("https://exempel.se/").url, "https://exempel.se");
});

test("tomt fält ger ett begripligt fel", () => {
  assert.equal(normaliseraUrl("").ok, false);
  assert.equal(normaliseraUrl("   ").ok, false);
  assert.equal(normaliseraUrl(undefined).ok, false);
});

test("javascript: och data: släpps aldrig igenom", () => {
  // Det viktigaste testet i filen: adressen hamnar i kundtext, och
  // "javascript:" får inte få https:// påklistrat och bli giltigt.
  for (const ond of ["javascript:alert(1)", "data:text/html,<script>", "file:///etc/passwd"]) {
    const r = normaliseraUrl(ond);
    assert.equal(r.ok, false, `${ond} godkändes`);
    assert.equal(r.url, "");
  }
});

test("värdnamn utan domän underkänns", () => {
  assert.equal(arGiltigUrl("gasolfyllarna"), false);
  assert.equal(arGiltigUrl("localhost"), false);
});

test("värdnamn tas ut utan www", () => {
  assert.equal(vardnamn("https://www.exempel.se/sida"), "exempel.se");
  assert.equal(vardnamn("shop.exempel.se"), "shop.exempel.se");
  assert.equal(vardnamn("inte en adress"), null);
});

test("länkar hittas i löptext", () => {
  assert.deepEqual(
    lankarIText("Läs mer på https://exempel.se/gasol eller shop.exempel.se."),
    ["https://exempel.se/gasol", "shop.exempel.se"],
  );
});

test("meningar med punkt blir inte länkar", () => {
  // "gasol.Vi" skulle kunna se ut som en domän med ett slarvigt uttryck.
  const traffar = lankarIText("Vi säljer gasol. Vi har öppet.");
  assert.deepEqual(traffar.filter((t) => vardnamn(t) !== null), []);
});

test("dubbletter räknas en gång", () => {
  assert.deepEqual(lankarIText("exempel.se och exempel.se"), ["exempel.se"]);
});

console.log(`${passed} test ok`);

// Kör: npx tsx lib/server/admin.test.mts
import assert from "node:assert/strict";
import { adminEmails, isAdminEmail } from "./admin";

let passed = 0;
function test(name: string, fn: () => void) {
  try { fn(); passed++; }
  catch (e) { console.error(`FAIL: ${name}\n  ${e instanceof Error ? e.message : e}`); process.exitCode = 1; }
}

test("saknad variabel ger ingen administratör", () => {
  assert.deepEqual(adminEmails(undefined), []);
  assert.equal(isAdminEmail("nagon@example.com", undefined), false);
});

test("tom variabel stänger, öppnar inte", () => {
  assert.equal(isAdminEmail("nagon@example.com", ""), false);
  assert.equal(isAdminEmail("nagon@example.com", "   "), false);
  assert.equal(isAdminEmail("nagon@example.com", ",,"), false);
});

test("en adress i listan släpps in", () => {
  assert.equal(isAdminEmail("agare@example.com", "agare@example.com"), true);
});

test("flera adresser, med mellanslag runt kommatecken", () => {
  const lista = "en@example.com , TVA@Example.com,tre@example.com";
  assert.equal(isAdminEmail("en@example.com", lista), true);
  assert.equal(isAdminEmail("tva@example.com", lista), true);
  assert.equal(isAdminEmail("tre@example.com", lista), true);
  assert.equal(isAdminEmail("fyra@example.com", lista), false);
});

test("versaler spelar ingen roll åt något håll", () => {
  assert.equal(isAdminEmail("Agare@Example.COM", "agare@example.com"), true);
  assert.equal(isAdminEmail("agare@example.com", "AGARE@EXAMPLE.COM"), true);
});

test("mellanslag runt adressen trimmas", () => {
  assert.equal(isAdminEmail("  agare@example.com  ", "agare@example.com"), true);
});

test("saknad eller tom adress är aldrig administratör", () => {
  assert.equal(isAdminEmail(null, "agare@example.com"), false);
  assert.equal(isAdminEmail(undefined, "agare@example.com"), false);
  assert.equal(isAdminEmail("", "agare@example.com"), false);
  assert.equal(isAdminEmail("   ", "agare@example.com"), false);
});

test("delsträng räcker inte — hela adressen måste stämma", () => {
  assert.equal(isAdminEmail("agare@example.com.angripare.se", "agare@example.com"), false);
  assert.equal(isAdminEmail("inte-agare@example.com", "agare@example.com"), false);
  assert.equal(isAdminEmail("agare@example.co", "agare@example.com"), false);
});

console.log(`${passed} test ok`);

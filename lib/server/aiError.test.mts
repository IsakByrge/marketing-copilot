// Kör: npx tsx lib/server/aiError.test.mts
//
// Buggrapport 2026-09-19: slut saldo på OpenAI-nyckeln visades som "Det gick
// inte att skapa inlägget just nu", och loggen sa bara "Error". Testen bygger
// felen med OpenAI-SDK:ns egna klasser, så att det är samma objekt som
// routes faktiskt får.
import assert from "node:assert/strict";
import { APIError, APIConnectionTimeoutError, APIConnectionError } from "openai";
import { classifyAiError } from "./aiError";

let passed = 0;
function test(name: string, fn: () => void) {
  try { fn(); passed++; }
  catch (e) { console.error(`FAIL: ${name}\n  ${e instanceof Error ? e.message : e}`); process.exitCode = 1; }
}

/** Som OpenAI svarar: felet ligger i `error` i svarskroppen. */
const api = (status: number, body: Record<string, unknown> = {}) =>
  APIError.generate(status, { error: { message: "x", ...body } }, "x", new Headers());

// ── Saldo och kvot ──────────────────────────────────────────

test("felet från prod: 429 credit_balance_exhausted är slut saldo", () => {
  const f = classifyAiError(api(429, { code: "credit_balance_exhausted", type: "insufficient_quota" }), "inlägget");
  assert.equal(f.kind, "saldo");
  assert.match(f.message, /inget saldo kvar/);
  assert.match(f.message, /inlägget kunde inte skapas/);
  assert.match(f.message, /hjälper inte/);
  assert.equal(f.logTag, "RateLimitError:429:credit_balance_exhausted");
});

test("429 insufficient_quota är slut saldo", () => {
  assert.match(classifyAiError(api(429, { code: "insufficient_quota" }), "planen").message, /inget saldo kvar/);
});

test("402 är slut saldo", () => {
  const f = classifyAiError(api(402), "texterna");
  assert.equal(f.kind, "saldo");
  assert.match(f.message, /inget saldo kvar/);
});

test("401 är saldo/kvot-slaget, men säger att nyckeln inte godtas", () => {
  const f = classifyAiError(api(401, { code: "invalid_api_key" }), "bilden");
  assert.equal(f.kind, "saldo");
  assert.match(f.message, /godtar inte vår API-nyckel/);
  assert.equal(f.logTag, "AuthenticationError:401:invalid_api_key");
});

test("429 utan saldoproblem är nådd anropskvot: vänta", () => {
  const f = classifyAiError(api(429, { code: "rate_limit_exceeded" }), "inlägget");
  assert.equal(f.kind, "saldo");
  assert.match(f.message, /kvot för antal anrop är nådd/);
  assert.match(f.message, /Vänta en minut/);
});

test("saldo svarar aldrig 429, så produkttexternas kö inte väntar i onödan", () => {
  for (const status of [401, 402, 429]) {
    assert.equal(classifyAiError(api(status, { code: "insufficient_quota" }), "x").httpStatus, 503);
  }
});

// ── Tidsgräns ───────────────────────────────────────────────

test("SDK:ns timeout, AbortError och TimeoutError är tidsgräns", () => {
  const abort = Object.assign(new Error("aborted"), { name: "AbortError" });
  const timeout = new DOMException("t", "TimeoutError");
  for (const e of [new APIConnectionTimeoutError(), abort, timeout]) {
    const f = classifyAiError(e, "planen");
    assert.equal(f.kind, "tidsgrans", String(e));
    assert.equal(f.httpStatus, 504);
    assert.match(f.message, /tog för lång tid att skapa planen/);
  }
});

// ── Övriga fel ──────────────────────────────────────────────

test("allt annat är ett fel hos oss, och säger det", () => {
  for (const e of [api(500), api(400, { code: "invalid_request_error" }), new APIConnectionError({}), new Error("DraftCoercionFailed"), new SyntaxError("JSON"), null, "sträng"]) {
    const f = classifyAiError(e, "inlägget");
    assert.equal(f.kind, "fel", String(e));
    assert.equal(f.httpStatus, 500);
    assert.match(f.message, /fel hos oss, inte i ditt underlag/);
  }
});

test("loggen får felklass och kod, aldrig meddelandet", () => {
  const f = classifyAiError(api(400, { code: "context_length_exceeded", message: "Företaget Gasolfyllarna AB …" }), "x");
  assert.equal(f.logTag, "BadRequestError:400:context_length_exceeded");
  assert.ok(!f.logTag.includes("Gasolfyllarna"));
  assert.equal(classifyAiError(new SyntaxError("x"), "x").logTag, "SyntaxError");
});

test("inget budskap är den gamla allmänna meningen", () => {
  for (const e of [api(429, { code: "insufficient_quota" }), api(401), new APIConnectionTimeoutError(), new Error("x")]) {
    assert.doesNotMatch(classifyAiError(e, "inlägget").message, /^Det gick inte att skapa inlägget just nu/);
  }
});

console.log(`${passed} test ok`);

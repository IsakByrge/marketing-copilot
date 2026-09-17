// Kör: npx tsx lib/server/usageReport.test.mts
import assert from "node:assert/strict";
import { summarize, rowCost, PRICES, IMAGE_PRICE, type UsageRow } from "./usageReport";

let passed = 0;
function test(name: string, fn: () => void) {
  try { fn(); passed++; }
  catch (e) { console.error(`FAIL: ${name}\n  ${e instanceof Error ? e.message : e}`); process.exitCode = 1; }
}

const row = (o: Partial<UsageRow> = {}): UsageRow => ({
  feature: "product-texts",
  model: "gpt-4o-mini",
  status: "ok",
  prompt_tokens: 1_000_000,
  completion_tokens: 0,
  ...o,
});

test("kostnad räknas per miljon tokens", () => {
  const { usd } = rowCost(row());
  assert.equal(Math.round(usd * 1000) / 1000, PRICES["gpt-4o-mini"].input);
});

test("okänd modell kostar noll och flaggas", () => {
  const { usd, known } = rowCost(row({ model: "gpt-9-turbo" }));
  assert.equal(usd, 0);
  assert.equal(known, false);
});

test("saknad modell kostar noll och flaggas", () => {
  assert.deepEqual(rowCost(row({ model: null })), { usd: 0, known: false });
});

test("bilder prissätts per styck, inte per token", () => {
  const { usd } = rowCost(row({ model: "gpt-image-1", prompt_tokens: 0, completion_tokens: 0 }));
  assert.equal(usd, IMAGE_PRICE.high);
});

test("tom lista ger nollor", () => {
  const s = summarize([]);
  assert.equal(s.calls, 0);
  assert.equal(s.estimatedUsd, 0);
  assert.deepEqual(s.byFeature, []);
});

test("anrop och fel räknas", () => {
  const s = summarize([row(), row({ status: "error" }), row({ status: "rate_limited" })]);
  assert.equal(s.calls, 3);
  assert.equal(s.errors, 2);
});

test("grupperas per funktion", () => {
  const s = summarize([row(), row({ feature: "generate-plan" })]);
  assert.equal(s.byFeature.length, 2);
});

test("sorteras med dyrast först", () => {
  const s = summarize([
    row({ feature: "billig", prompt_tokens: 1 }),
    row({ feature: "dyr", model: "gpt-image-1" }),
  ]);
  assert.equal(s.byFeature[0].feature, "dyr");
});

test("okänd modell flaggas hela vägen upp", () => {
  const s = summarize([row({ model: "okänd" })]);
  assert.equal(s.hasUnknownModel, true);
  assert.equal(s.byFeature[0].hasUnknownModel, true);
});

test("saknat funktionsnamn får en etikett", () => {
  assert.equal(summarize([row({ feature: "" })]).byFeature[0].feature, "okänd");
});

test("null-tokens kraschar inte", () => {
  const s = summarize([row({ prompt_tokens: null, completion_tokens: null })]);
  assert.equal(s.estimatedUsd, 0);
  assert.equal(s.calls, 1);
});

console.log(`${passed} test ok`);

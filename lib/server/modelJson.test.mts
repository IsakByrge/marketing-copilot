// Kör: npx tsx lib/server/modelJson.test.mts
//
// Delad parsning av modellgenererad JSON (lib/server/modelJson.ts).
//
// `response_format: json_object` garanterar giltig JSON — utom när
// genereringen stoppas av token-taket. Då är svaret avhugget, och ett
// rått JSON.parse kastar ett SyntaxError som blir ett generiskt 500 med
// loggraden "fel:SyntaxError". Den raden går inte att skilja från vilket
// annat internt fel som helst, så det gick inte att avgöra om
// modellanropet lyckades och svaret kapades, eller om något annat gick
// sönder. Kom fram under felsökningen av STRATEGIST_RECOMMEND.
//
// Gäller nu alla flöden som ber modellen om JSON: callChatJson (plan,
// produkttexter, create-content, analyze-company), Facebook-specialisten
// och strategen.
//
// Testet visar det gamla beteendet och låser det nya: avhugget svar och
// ogiltig JSON av annan anledning får var sin kategori, med finish_reason,
// svarslängd, modell och tokens kvar — men aldrig modellens text.
//
// Ren logik. Inget nät, ingen databas, ingen modell.
import assert from "node:assert/strict";
import { parseModelJson } from "./modelJson";
import { classifyAiError, ModelJsonError, modelUsageFrom } from "./aiError";

let passed = 0;
function test(name: string, fn: () => void) {
  try { fn(); passed++; }
  catch (e) { console.error(`FAIL: ${name}\n  ${e instanceof Error ? e.message : e}`); process.exitCode = 1; }
}

/** Ett recommend-svar som tog slut mitt i "channelPriority". */
const TRUNCATED = `{"analysis":{"campaignDiagnosis":"Bred kampanj utan tydlig prioritering.","recommendedFocus":"Fokusera på gasolkaminer inför hösten.","rationale":["Kaminer har högst marginal"],"identifiedGaps":[],"alternativeDirections":[],"confidence":"medium"},"strategy":{"primaryGoal":"Fler butiksbesök","primaryAudience":"Villaägare i Mälardalen","product":"Gasolkamin Verona","offer":"20 % rabatt","mainMessage":"Värme utan el","primaryCta":"Kom in i butiken","channelPriority":[{"channel":"facebook","reas`;

const fields = {
  model: "gpt-4o",
  promptTokens: 2411,
  completionTokens: 1800,
};

// ── Det gamla beteendet ─────────────────────────────────────

test("rått JSON.parse ger ett SyntaxError som inte säger något om orsaken", () => {
  // Så här såg prod ut: kategorin blev "fel:SyntaxError", oavsett om
  // svaret kapades av token-taket eller var trasigt av annan anledning.
  let caught: unknown;
  try { JSON.parse(TRUNCATED); } catch (e) { caught = e; }
  assert.ok(caught instanceof SyntaxError);
  const old = classifyAiError(caught, "strategin");
  assert.equal(old.kind, "fel");
  assert.equal(old.httpStatus, 500);
  assert.equal(old.logTag, "SyntaxError");
});

// ── Avhugget svar ───────────────────────────────────────────

test("finish_reason length ger ett typat fel med orsaken kvar", () => {
  let caught: unknown;
  try {
    parseModelJson({ content: TRUNCATED, finishReason: "length", ...fields });
  } catch (e) { caught = e; }

  assert.ok(caught instanceof ModelJsonError, "ska vara ModelJsonError");
  const e = caught as ModelJsonError;
  assert.equal(e.reason, "truncated");
  assert.equal(e.finishReason, "length");
  assert.equal(e.contentLength, TRUNCATED.length);
  assert.equal(e.model, "gpt-4o");
  assert.equal(e.promptTokens, 2411);
  assert.equal(e.completionTokens, 1800);
});

test("avhugget svar får sin egen kategori, inte fel:SyntaxError", () => {
  try {
    parseModelJson({ content: TRUNCATED, finishReason: "length", ...fields });
    assert.fail("skulle ha kastat");
  } catch (e) {
    const f = classifyAiError(e, "strategin");
    assert.match(f.logTag, /^model_json_truncated/);
    assert.match(f.logTag, /len=\d+/);
    // Statusen och texten till användaren är oförändrade — det här är
    // en diagnostisk ändring, inte en beteendeändring.
    assert.equal(f.kind, "fel");
    assert.equal(f.httpStatus, 500);
    assert.match(f.message, /fel hos oss, inte i ditt underlag/);
  }
});

test("kategorin ryms i error_category, som kapas vid 60 tecken", () => {
  try {
    parseModelJson({ content: TRUNCATED, finishReason: "length", ...fields });
    assert.fail("skulle ha kastat");
  } catch (e) {
    const f = classifyAiError(e, "strategin");
    assert.ok(`${f.kind}:${f.logTag}`.length <= 60, `för lång: ${f.kind}:${f.logTag}`);
  }
});

// ── Ogiltig JSON av annan anledning ─────────────────────────

test("ogiltig JSON med finish_reason stop är en annan kategori", () => {
  try {
    parseModelJson({ content: "Här kommer strategin: {", finishReason: "stop", ...fields });
    assert.fail("skulle ha kastat");
  } catch (e) {
    assert.ok(e instanceof ModelJsonError);
    assert.equal((e as ModelJsonError).reason, "invalid");
    assert.match(classifyAiError(e, "strategin").logTag, /^model_json_invalid/);
  }
});

test("tomt svar skiljs också på finish_reason", () => {
  const empty = (finishReason: string | null) => {
    try { parseModelJson({ content: "", finishReason, ...fields }); return null; }
    catch (e) { return e as ModelJsonError; }
  };
  assert.equal(empty("length")?.reason, "truncated");
  assert.equal(empty("stop")?.reason, "invalid");
  assert.equal(empty(null)?.reason, "invalid");
});

// ── Giltigt svar rörs inte ──────────────────────────────────

test("giltig JSON går igenom oförändrad, även vid finish_reason length", () => {
  assert.deepEqual(parseModelJson({ content: `{"a":1}`, finishReason: "stop", ...fields }), { a: 1 });
  // Kapad text kan undantagsvis ändå vara giltig JSON. Då finns inget fel.
  assert.deepEqual(parseModelJson({ content: `{"a":1}`, finishReason: "length", ...fields }), { a: 1 });
});

// ── Vad som hamnar i loggen ─────────────────────────────────

test("varken modellens text eller användarens innehåll följer med felet", () => {
  try {
    parseModelJson({ content: TRUNCATED, finishReason: "length", ...fields });
    assert.fail("skulle ha kastat");
  } catch (e) {
    const f = classifyAiError(e, "strategin");
    const spar = `${f.kind}:${f.logTag} ${(e as Error).message}`;
    for (const hemligt of ["Villaägare", "Gasolkamin", "Mälardalen", "20 %", "facebook"]) {
      assert.ok(!spar.includes(hemligt), `läckte: ${hemligt}`);
    }
  }
});

test("usage följer med felet, så raden i ai_usage_events kan bli komplett", () => {
  try {
    parseModelJson({ content: TRUNCATED, finishReason: "length", ...fields });
    assert.fail("skulle ha kastat");
  } catch (e) {
    assert.deepEqual(modelUsageFrom(e), { model: "gpt-4o", promptTokens: 2411, completionTokens: 1800 });
  }
});

test("modelUsageFrom ger tomt för andra fel", () => {
  assert.deepEqual(modelUsageFrom(new Error("x")), {});
  assert.deepEqual(modelUsageFrom(null), {});
});

console.log(`${passed} test ok`);

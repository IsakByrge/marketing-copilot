// Kör: npx tsx lib/server/planValidate.test.mts
//
// Tyngdpunkten ligger på säkerhetsdetektorn. De tre meningarna som
// publicerades i en riktig plan ligger här som fasta testfall — slutar
// detektorn fånga dem ska bygget säga ifrån, inte nästa granskning.
import assert from "node:assert/strict";
import {
  hittaPlatshallare, beskrivSaknat, saknatIText,
  normaliseraDag, antalStycken, delaIStycken,
  sakerhetsordIText, arSakerhetsrad, valideraPlan, kopLank, sattLank,
} from "./planValidate";

let passed = 0;
function test(name: string, fn: () => void) {
  try { fn(); passed++; }
  catch (e) { console.error(`FAIL: ${name}\n  ${e instanceof Error ? e.message : e}`); process.exitCode = 1; }
}

/** Publicerades i en riktig plan. Får aldrig sluta fångas. */
const LÄCKTA = [
  "Kontrollera gasolslangar för sprickor",
  "Se över regulatorn",
  "Rengör gasolkaminen",
];

test("de tre läckta säkerhetsråden fångas", () => {
  for (const m of LÄCKTA) {
    assert.ok(sakerhetsordIText(m).length > 0, `inget säkerhetsord i: ${m}`);
    assert.ok(arSakerhetsrad(m), `räknades inte som råd: ${m}`);
  }
});

test("förvaringsrådet som slank igenom fångas nu", () => {
  // Kom ur en riktig plan efter att sakerhetsregeln redan skarpts.
  // Bara "ventil" (ur "ventilerat") traffade, och da som substantiv
  // utan handling - texten gick igenom som ofarlig.
  const forvaring = [
    "Tänk på att placera din gasolflaska i ett ventilerat förråd eller en skyddad plats.",
    "Överväg ett skyddande överdrag om gasolflaskan står ute längre perioder.",
  ];
  for (const m of forvaring) {
    assert.ok(arSakerhetsrad(m), `slank igenom: ${m}`);
  }
});

test("vanlig text om produkten ar fortfarande inte ett rad", () => {
  // Skarpningen far inte gora varje mening om gasol till ett larm.
  for (const m of [
    "Vi fyller gasol i lösvikt till husbilsägare.",
    "Kom förbi depån i Norrköping så hjälper personalen dig.",
    "Du betalar bara för det som faktiskt fylls.",
  ]) {
    assert.equal(arSakerhetsrad(m), false, `falskt larm: ${m}`);
  }
});

test("varje ord i listan fångas för sig", () => {
  const prov: Array<[string, string]> = [
    ["slang", "Vi säljer slang i flera längder."],
    ["regulator", "En ny regulator finns i shoppen."],
    ["läck", "Misstänker du en läcka?"],
    ["ventil", "Ventilen sitter på flaskan."],
    ["packning", "Packningen är utbytbar."],
    ["kamin", "Gasolkaminen värmer altanen."],
  ];
  for (const [ord, mening] of prov) {
    assert.ok(sakerhetsordIText(mening).includes(ord), `${ord} missades i: ${mening}`);
  }
});

test("vanlig säljtext utan utrustning flaggas inte", () => {
  assert.deepEqual(sakerhetsordIText("Vi fyller gasol i lösvikt till husbilsägare."), []);
  assert.equal(arSakerhetsrad("Kom förbi depån i Norrköping."), false);
});

test("utrustning utan handling är inte ett råd, men flaggas för granskning", () => {
  // Att nämna en slang som produkt ska synas i gränssnittet, men det är
  // inte samma sak som att instruera någon att göra något med den.
  const mening = "Vi har slang och regulator i sortimentet.";
  assert.ok(sakerhetsordIText(mening).length > 0);
  assert.equal(arSakerhetsrad(mening), false);
});

test("valideraPlan märker inlägget med granskas", () => {
  const plan = valideraPlan<{ posts: Array<Record<string, unknown>> }>({
    posts: [
      { title: "Tips inför hösten", text: "Se över regulatorn innan kylan.", cta: "Kom förbi" },
      { title: "Lösvikt", text: "Du betalar bara för det som går i flaskan.", cta: "Kom förbi" },
    ],
  });
  assert.ok(((plan.posts?.[0].granskas as string[]) ?? []).includes("regulator"));
  assert.equal(plan.posts?.[1].granskas, undefined);
});

// ── Platshållare ────────────────────────────────────────────

test("platshållare hittas i alla former", () => {
  assert.deepEqual(hittaPlatshallare("Kom till [ort] idag"), ["[ort]"]);
  assert.deepEqual(hittaPlatshallare("Ring {{telefon}}"), ["{{telefon}}"]);
});

test("platshållaren blir en konkret uppmaning", () => {
  assert.match(beskrivSaknat("[depåort]"), /depåorter/);
  assert.match(beskrivSaknat("[öppettider]"), /öppettider/);
  assert.deepEqual(saknatIText("Färdig text utan luckor."), []);
});

// ── Veckodagar ──────────────────────────────────────────────

test("veckodagar normaliseras till gemener", () => {
  assert.equal(normaliseraDag("Måndag"), "måndag");
  assert.equal(normaliseraDag("mandag"), "måndag");
  assert.equal(normaliseraDag("SÖNDAG"), "söndag");
  assert.equal(normaliseraDag("hejsan"), null);
});

// ── Nyhetsbrevets stycken ───────────────────────────────────

test("ett block delas utan att ett ord ändras", () => {
  const block = "Nu blir det kallare. Många ser över sin gasol. Hos oss fyller du flaskan. Du betalar bara för det som går i. Kom förbi när det passar. Vi hjälper dig gärna.";
  const ut = delaIStycken(block)!;
  assert.ok(antalStycken(ut) >= 2, "delades inte");
  assert.equal(
    ut.replace(/\s+/g, " ").trim(),
    block.replace(/\s+/g, " ").trim(),
    "texten ändrades",
  );
});

test("redan indelad text lämnas orörd", () => {
  const redan = "Ett stycke.\n\nEtt till.";
  assert.equal(delaIStycken(redan), redan);
});

test("för få meningar delas inte", () => {
  assert.equal(delaIStycken("Bara en mening."), "Bara en mening.");
});

// ── Länkar ──────────────────────────────────────────────────

const SIDOR = [
  { url: "https://testgas.se", purpose: "Hemsida – information och depåer" },
  { url: "https://shop.testgas.se", purpose: "Webbshop – köp av produkter" },
];

test("köplänken väljs på syftet, inte på ordningen", () => {
  assert.equal(kopLank(SIDOR), "https://shop.testgas.se");
});

test("utan köpsyfte tas den första", () => {
  assert.equal(kopLank([{ url: "https://a.se", purpose: "Info" }]), "https://a.se");
  assert.equal(kopLank([]), null);
  assert.equal(kopLank(undefined), null);
});

test("länken sätts sist i säljande och prioriterade inlägg", () => {
  const plan = sattLank<{ posts: Array<Record<string, unknown>> }>({
    posts: [
      { roll: "saljande", text: "Köp gasol hos oss." },
      { roll: "prioriterad_produkt", text: "Lösvikt är smidigt." },
      { roll: "tips", text: "Ett tips utan länk." },
    ],
  }, SIDOR);
  assert.ok(String(plan.posts[0].text).endsWith("https://shop.testgas.se"));
  assert.ok(String(plan.posts[1].text).endsWith("https://shop.testgas.se"));
  assert.equal(plan.posts[2].text, "Ett tips utan länk.", "tips ska inte få länk");
});

test("en länk modellen redan valt rörs inte", () => {
  const plan = sattLank<{ posts: Array<Record<string, unknown>> }>({
    posts: [{ roll: "saljande", text: "Läs mer på https://testgas.se" }],
  }, SIDOR);
  assert.equal(plan.posts[0].text, "Läs mer på https://testgas.se");
});

test("utan webbplatser händer ingenting", () => {
  const plan = sattLank<{ posts: Array<Record<string, unknown>> }>({
    posts: [{ roll: "saljande", text: "Köp gasol hos oss." }],
  }, []);
  assert.equal(plan.posts[0].text, "Köp gasol hos oss.");
});

console.log(`${passed} test ok`);

// Kör: npx tsx lib/server/planRepair.test.mts
//
// Rättningsrundan utan modellanrop: vad som skickas tillbaka för
// rättning, och vilka svar som tas emot. Det andra är det viktiga —
// rundan får aldrig göra en text sämre än den var.
import assert from "node:assert/strict";
import { hittaBrister, buildRepairPrompt, applyRepair, ord, type PlanShape } from "./planRepair";
import { LENGTH_LIMITS } from "./planPrompt";

let passed = 0;
function test(name: string, fn: () => void) {
  try { fn(); passed++; }
  catch (e) { console.error(`FAIL: ${name}\n  ${e instanceof Error ? e.message : e}`); process.exitCode = 1; }
}

const UNDERLAG = {
  text: "Säljer gasol i webbshop och i egna depåer.\nGasol i lösvikt\nBetalar bara för det som faktiskt fylls",
  bevis: [],
};

/** N ord utan något att anmärka på. */
const fyll = (n: number) => Array.from({ length: n }, (_, i) => `ord${i}`).join(" ");
const LANG = fyll(LENGTH_LIMITS.POST_MIN_WORDS + 10);
const LANGT_BREV = fyll(LENGTH_LIMITS.NEWSLETTER_MIN_WORDS + 10);

function plan(over: Partial<PlanShape> = {}): PlanShape {
  return {
    posts: [
      { roll: "saljande", title: "Fyll din egen flaska", text: LANG, cta: "Kom förbi depån" },
      { roll: "tips", title: "Så går det till", text: LANG, cta: "Kom förbi depån" },
    ],
    newsletter: { subject: "Höst i depån", body: LANGT_BREV, cta: "Kom förbi depån" },
    campaigns: [{ title: "Påfyllningsdagar", produkt: "Gasol i lösvikt", goal: "Fler besök", message: "Fyll din egen flaska.", cta: "Kom förbi" }],
    ...over,
  };
}

const medInlagg = (i: number, falt: Record<string, string>): PlanShape => {
  const p = plan();
  p.posts![i] = { ...p.posts![i], ...falt };
  return p;
};

// ── Vad som skickas för rättning ────────────────────────────

test("en plan utan fel ger inga brister", () => {
  assert.deepEqual(hittaBrister(plan(), UNDERLAG), []);
});

test("för korta brödtexter hittas, med eller utan underlag", () => {
  const p = medInlagg(1, { text: "Bara fem ord står här." });
  for (const b of [hittaBrister(p), hittaBrister(p, UNDERLAG)]) {
    assert.equal(b.length, 1);
    assert.equal(b[0].nyckel, "1");
    assert.deepEqual(b[0].forKort, { ordNu: 5, minst: LENGTH_LIMITS.POST_MIN_WORDS });
  }
});

test("påståenden utan underlag hittas i varje fält en kund kan få läsa", () => {
  const p = plan({
    posts: [{ roll: "saljande", title: "Spara pengar på gasolen", text: `${LANG} Många upplever det som krångligt.`, cta: "Fyll på billigare" }],
    newsletter: { subject: "Vår populära tjänst", body: `${LANGT_BREV} Det sparar tid.`, cta: "Kom förbi depån" },
    campaigns: [{ title: "Ekonomiskt val", goal: "Fler besök", message: "Lösvikt är kostnadseffektivt.", cta: "Kom förbi" }],
  });
  const nycklar = hittaBrister(p, UNDERLAG).map((b) => b.nyckel).sort();
  assert.deepEqual(nycklar, ["0", "amnesrad", "cta-0", "kampanj-0-budskap", "kampanj-0-titel", "newsletter", "rubrik-0"].sort());
});

test("utan underlag mäts bara längden — rundan beter sig som förut", () => {
  const p = medInlagg(0, { text: `${LANG} Det sparar tid och pengar.` });
  assert.deepEqual(hittaBrister(p), []);
});

test("prompten pekar ut felet, golvet och det som får påstås", () => {
  const p = plan({ newsletter: { subject: "Höst", body: `${LANGT_BREV} Det sparar tid.`, cta: "Kom" } });
  p.posts![1] = { ...p.posts![1], text: "Bara fem ord står här." };
  const prompt = buildRepairPrompt(hittaBrister(p, UNDERLAG), UNDERLAG);
  assert.ok(prompt.includes(`FÖR KORT: 5 ord`));
  assert.ok(prompt.includes(`PÅSTÅR UTAN UNDERLAG: "sparar tid"`));
  assert.ok(prompt.includes(`ska fortfarande vara minst ${LENGTH_LIMITS.NEWSLETTER_MIN_WORDS} ord`), "ett omskrivet nyhetsbrev får inte krympa under golvet");
  assert.ok(prompt.includes("Betalar bara för det som faktiskt fylls"), "underlaget ska stå i prompten");
  assert.ok(prompt.includes('"1":') && prompt.includes('"newsletter":'));
});

test("utan obelagda påståenden skickas inte underlaget", () => {
  const p = medInlagg(1, { text: "Bara fem ord står här." });
  const prompt = buildRepairPrompt(hittaBrister(p, UNDERLAG), UNDERLAG);
  assert.ok(!prompt.includes("DET HÄR STÅR I FÖRETAGSDATAN"));
  assert.ok(prompt.includes("Lägg aldrig till ett påstående"), "en utbyggd text får inte få nya påståenden");
});

// ── Vilka svar som tas emot ─────────────────────────────────

test("ett påstående som skrivits bort tas emot", () => {
  const p = medInlagg(0, { text: `${LANG} Det sparar tid och pengar.` });
  const ny = `${LANG} Du betalar bara för det som faktiskt fylls.`;
  assert.equal(applyRepair(p, { "0": ny }, UNDERLAG).posts![0].text, ny);
});

test("en synonym för samma påstående tas inte emot", () => {
  const original = `${LANG} Det sparar pengar.`;
  const p = medInlagg(0, { text: original });
  const ut = applyRepair(p, { "0": `${LANG} Det är kostnadseffektivt.` }, UNDERLAG);
  assert.equal(ut.posts![0].text, original);
});

test("ett svar som strukit texten i stället för påståendet tas inte emot", () => {
  const original = `${LANG} Det sparar tid.`;
  const p = medInlagg(0, { text: original });
  assert.equal(applyRepair(p, { "0": "Kom förbi." }, UNDERLAG).posts![0].text, original);
  // En mening kortare är däremot en rättning.
  assert.equal(applyRepair(p, { "0": LANG }, UNDERLAG).posts![0].text, LANG);
});

test("en utbyggd text tas emot — men inte om den fått ett nytt påstående", () => {
  const kort = "Bara fem ord står här.";
  const p = medInlagg(1, { text: kort });
  assert.equal(applyRepair(p, { "1": LANG }, UNDERLAG).posts![1].text, LANG);
  assert.equal(applyRepair(p, { "1": `${LANG} Många väljer lösvikt.` }, UNDERLAG).posts![1].text, kort);
  // Utan underlag gäller bara längden, som förut.
  assert.ok(ord(applyRepair(p, { "1": `${LANG} Många väljer lösvikt.` }).posts![1].text ?? "") > ord(kort));
});

test("REGRESSION: en för kort text som byter ett påstående mot ett annat tas inte emot", () => {
  // Stod i en riktig rättning: nyhetsbrevet var för kort och sa "sparar
  // tid". Svaret var längre och sa "kunder uppskattar" i stället. Lika
  // många påståenden, och det räckte förut.
  const original = "Lösvikt sparar tid för dig.";
  const p = plan({ newsletter: { subject: "Höst", body: original, cta: "Kom" } });
  const ny = `${LANGT_BREV} Något som våra kunder uppskattar.`;
  assert.equal(applyRepair(p, { newsletter: ny }, UNDERLAG).newsletter!.body, original);
  // Också när påståendena blir FÄRRE men ett av dem är nytt.
  const tva = medInlagg(1, { text: "Sparar tid och är kostnadseffektivt." });
  const ut = applyRepair(tva, { "1": `${LANG} Ett populärt val.` }, UNDERLAG);
  assert.equal(ut.posts![1].text, "Sparar tid och är kostnadseffektivt.");
  // Utbyggd, och det gamla påståendet står kvar orört: det är inte sämre.
  const kvar = `${LANGT_BREV} Lösvikt sparar tid för dig.`;
  assert.equal(applyRepair(p, { newsletter: kvar }, UNDERLAG).newsletter!.body, kvar);
});

test("en utbyggd text med ett ord från fel årstid tas inte emot", () => {
  const kort = "Bara fem ord står här.";
  const p = medInlagg(1, { text: kort });
  const oktober = new Date("2026-10-09T10:00:00Z");
  const juni = new Date("2026-06-09T10:00:00Z");
  // Stod i en riktig rättning i oktober.
  const ny = `${LANG} Inför en kommande semester med husvagnen.`;
  assert.equal(applyRepair(p, { "1": ny }, UNDERLAG, oktober).posts![1].text, kort);
  assert.equal(applyRepair(p, { "1": ny }, UNDERLAG, juni).posts![1].text, ny, "i juni är ordet inte fel");
  // Ett annat ord från fel årstid än det som redan stod där är också nytt.
  const medSommar = medInlagg(1, { text: "Vid sommarstugan, fem ord." });
  assert.equal(applyRepair(medSommar, { "1": ny }, UNDERLAG, oktober).posts![1].text, "Vid sommarstugan, fem ord.");
  // Stod ordet redan i originalet har rundan inte gjort texten sämre.
  const sammaOrd = `${LANG} Vid sommarstugan.`;
  assert.equal(applyRepair(medSommar, { "1": sammaOrd }, UNDERLAG, oktober).posts![1].text, sammaOrd);
});

test("en rättad text med en webbadress som inte stod där tas inte emot", () => {
  const kort = "Bara fem ord.\n\nhttps://testgas.se";
  const p = medInlagg(1, { text: kort });
  assert.equal(applyRepair(p, { "1": `${LANG}\n\nhttps://testgas.se/erbjudande-host.se` }, UNDERLAG).posts![1].text, kort);
  assert.equal(applyRepair(p, { "1": `${LANG} Läs mer på gasolguiden.se.\n\nhttps://testgas.se` }, UNDERLAG).posts![1].text, kort);
  // Adressen som redan stod där får stå kvar.
  const ny = `${LANG}\n\nhttps://testgas.se`;
  assert.equal(applyRepair(p, { "1": ny }, UNDERLAG).posts![1].text, ny);
});

test("en utbyggd text som inte blivit längre tas inte emot", () => {
  const kort = "Bara fem ord står här.";
  const p = medInlagg(1, { text: kort });
  assert.equal(applyRepair(p, { "1": "Fyra ord står här." }, UNDERLAG).posts![1].text, kort);
});

test("rubrik, uppmaning, ämnesrad och kampanjbudskap skrivs till rätt fält", () => {
  const p = plan({
    posts: [{ roll: "saljande", title: "Spara pengar på gasolen", text: LANG, cta: "Fyll på billigare" }],
    newsletter: { subject: "Vår populära tjänst", body: LANGT_BREV, cta: "Kom förbi depån" },
    campaigns: [{ title: "Påfyllningsdagar", goal: "Fler besök", message: "Lösvikt är kostnadseffektivt.", cta: "Kom förbi" }],
  });
  const ut = applyRepair(p, {
    "rubrik-0": "Fyll din egen flaska",
    "cta-0": "Kom förbi depån",
    "amnesrad": "Lösvikt i depån",
    "kampanj-0-budskap": "Du betalar bara för det som faktiskt fylls.",
  }, UNDERLAG);
  assert.equal(ut.posts![0].title, "Fyll din egen flaska");
  assert.equal(ut.posts![0].cta, "Kom förbi depån");
  assert.equal(ut.posts![0].text, LANG, "brödtexten ska vara orörd");
  assert.equal(ut.newsletter!.subject, "Lösvikt i depån");
  assert.equal(ut.newsletter!.body, LANGT_BREV);
  assert.equal(ut.campaigns![0].message, "Du betalar bara för det som faktiskt fylls.");
  assert.equal(ut.campaigns![0].title, "Påfyllningsdagar");
});

test("svar på något som inte var fel, okända nycklar och skräp ignoreras", () => {
  const p = plan();
  const ut = applyRepair(p, {
    "0": "En helt annan text som modellen skickade oombedd.",
    "7": LANG,
    "kampanj-9-budskap": "Finns inte.",
    "hittepa": "Finns inte.",
    "1": "",
  } as Record<string, string>, UNDERLAG);
  assert.deepEqual(ut, p);
});

console.log(`${passed} test ok`);

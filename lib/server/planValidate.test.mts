// Kör: npx tsx lib/server/planValidate.test.mts
//
// Tyngdpunkten ligger på säkerhetsdetektorn. De tre meningarna som
// publicerades i en riktig plan ligger här som fasta testfall — slutar
// detektorn fånga dem ska bygget säga ifrån, inte nästa granskning.
import assert from "node:assert/strict";
import {
  hittaPlatshallare, beskrivSaknat, saknatIText,
  normaliseraDag, antalStycken, delaIStycken,
  sakerhetsordIText, granskningsordIText, arSakerhetsrad, valideraPlan,
  kopLank, infoLank, valjLank, arBesoksuppmaning, kundensHandling, sattLank,
  obelagdaPastaenden, utanUtropstecken,
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

test("varje ord i listan kanns igen som omnamnande", () => {
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
    // ... men inget av dem ska FLAGGA, eftersom ingen handling finns.
    assert.deepEqual(granskningsordIText(mening), [], `falsk flagga: ${mening}`);
  }
});

test("handling i en ANNAN mening flaggar inte", () => {
  // Det var det har som gav larm pa varenda inlagg: orden lag i samma
  // text men inte i samma mening, och hade inget med varandra att gora.
  const text = "Vi säljer gasolflaskor i flera storlekar. Kom förbi depån så hjälper vi dig placera din beställning.";
  assert.deepEqual(granskningsordIText(text), []);
});

test("handling i SAMMA mening flaggar", () => {
  assert.deepEqual(granskningsordIText("Placera gasolflaskan svalt."), ["gasolflask"]);
});

test("vanlig säljtext utan utrustning flaggas inte", () => {
  assert.deepEqual(sakerhetsordIText("Vi fyller gasol i lösvikt till husbilsägare."), []);
  assert.equal(arSakerhetsrad("Kom förbi depån i Norrköping."), false);
});

test("utrustning utan handling ar varken rad eller flagga", () => {
  const mening = "Vi har slang och regulator i sortimentet.";
  assert.ok(sakerhetsordIText(mening).length > 0, "ska synas som omnamnande");
  assert.equal(arSakerhetsrad(mening), false);
  assert.deepEqual(granskningsordIText(mening), []);
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
const BARA_SHOP = [SIDOR[1]];
const BARA_INFO = [SIDOR[0]];

type Inlagg = { posts: Array<Record<string, unknown>> };
const satt = (posts: Inlagg["posts"], sidor = SIDOR) => sattLank<Inlagg>({ posts }, sidor).posts;

test("köplänken väljs på syftet, inte på ordningen", () => {
  assert.equal(kopLank(SIDOR), "https://shop.testgas.se");
});

test("utan köpsyfte finns ingen köplänk — ingen annan adress tas i stället", () => {
  assert.equal(kopLank(BARA_INFO), null);
  assert.equal(kopLank([]), null);
  assert.equal(kopLank(undefined), null);
});

test("informationssidan väljs på syftet", () => {
  assert.equal(infoLank(SIDOR), "https://testgas.se");
  assert.equal(infoLank([{ url: "https://a.se", purpose: "Våra depåer och öppettider" }]), "https://a.se");
  assert.equal(infoLank([]), null);
});

test("med bara webbshoppen registrerad finns ingen informationslänk", () => {
  // Reserven "den första i listan" gav tidigare shoppens adress här.
  assert.equal(infoLank(BARA_SHOP), null);
  assert.equal(infoLank([{ url: "https://shop.a.se", purpose: "Webbshop" }, { url: "https://a.se", purpose: "Allmänt" }]), null);
});

test("kundens handling läses ur uppmaningen", () => {
  const fall: Array<[string, string | null]> = [
    ["Kom förbi depån", "besok"],
    ["Besök våra depåer idag", "besok"],
    ["Besök oss i Nyköping", "besok"],
    // "köp" i ortsnamnet gjorde tidigare det här till ett köp.
    ["Kom förbi vår depå i Nyköping", "besok"],
    ["Träffa oss på plats", "besok"],
    ["Beställ i webbshoppen", "kop"],
    ["Handla online", "kop"],
    ["Besök webbshoppen", "kop"],
    ["Läs mer på webbplatsen", "las"],
    ["Besök vår hemsida för mer information", "las"],
    // Pekar åt två håll, eller inte åt något.
    ["Kom förbi depån eller beställ på nätet", null],
    ["Dela ditt favoritrecept i kommentarerna", null],
    ["", null],
  ];
  for (const [cta, vantat] of fall) assert.equal(kundensHandling(cta), vantat, `"${cta}"`);
  assert.equal(kundensHandling(undefined), null);
});

test("besöksuppmaningar känns igen", () => {
  for (const c of ["Besök våra depåer idag", "Kom förbi depån", "Träffa oss på plats", "Hitta oss"]) {
    assert.ok(arBesoksuppmaning(c), `missade: ${c}`);
  }
  for (const c of ["Beställ i webbshoppen", "Läs mer på webbplatsen", "Handla online"]) {
    assert.equal(arBesoksuppmaning(c), false, `falskt larm: ${c}`);
  }
});

test("länken följer uppmaningen, inte ämnet", () => {
  assert.equal(valjLank(SIDOR, "Besök våra depåer idag"), "https://testgas.se");
  assert.equal(valjLank(SIDOR, "Beställ i webbshoppen"), "https://shop.testgas.se");
  assert.equal(valjLank(SIDOR, "Läs mer på webbplatsen"), "https://testgas.se");
  assert.equal(valjLank(SIDOR, "Dela ditt bästa recept"), null);
});

test("DET VERKLIGA FELET: depåbesök med webbshoppens adress får depåinformationen", () => {
  // Modellen skrev uppmaningen "Kom förbi depån" och avslutade med
  // shoppens adress. Tidigare lämnades en länk modellen själv valt orörd.
  const [p] = satt([{
    roll: "prioriterad_produkt", cta: "Kom förbi depån",
    text: "Gasol i lösvikt hos oss. Du betalar för det som fylls.\n\nhttps://shop.testgas.se",
  }]);
  assert.equal(p.text, "Gasol i lösvikt hos oss. Du betalar för det som fylls.\n\nhttps://testgas.se");
  assert.equal(p.saknas, undefined);
});

test("fel länk rättas i alla roller, inte bara de som ska ha länk", () => {
  const [p] = satt([{ roll: "lokalt", cta: "Besök oss i Nyköping", text: "Vi finns i Nyköping. https://shop.testgas.se" }]);
  assert.equal(p.text, "Vi finns i Nyköping. https://testgas.se");
});

test("köp med informationssidans adress får köplänken", () => {
  const [p] = satt([{ roll: "saljande", cta: "Beställ i webbshoppen", text: "Ny grill i sortimentet.\n\nhttps://testgas.se" }]);
  assert.equal(p.text, "Ny grill i sortimentet.\n\nhttps://shop.testgas.se");
});

test("saknas rätt destination tas länken bort och inlägget säger vad som saknas", () => {
  const [p] = satt([{
    roll: "prioriterad_produkt", cta: "Kom förbi depån",
    text: "Gasol i lösvikt hos oss.\n\nhttps://shop.testgas.se",
  }], BARA_SHOP);
  assert.equal(p.text, "Gasol i lösvikt hos oss.");
  assert.equal((p.saknas as string[]).length, 1);
  assert.match((p.saknas as string[])[0], /ber om ett besök.*depå- eller kontaktinformation/);
});

test("saknas rätt destination läggs ingen annan länk till", () => {
  const besok = satt([{ roll: "saljande", cta: "Kom förbi depån", text: "Fyll på hos oss." }], BARA_SHOP);
  assert.equal(besok[0].text, "Fyll på hos oss.");
  assert.equal(besok[0].saknas, undefined, "inget togs bort, så inget att anmärka på");

  const kop = satt([{ roll: "saljande", cta: "Beställ i webbshoppen", text: "Ny grill.\n\nhttps://testgas.se" }], BARA_INFO);
  assert.equal(kop[0].text, "Ny grill.");
  assert.match((kop[0].saknas as string[])[0], /ber om ett köp/);
});

test("säljande och prioriterade inlägg utan länk får den som hör till uppmaningen", () => {
  const posts = satt([
    { roll: "prioriterad_produkt", text: "Gasol i lösvikt hos oss.", cta: "Besök våra depåer idag" },
    { roll: "saljande", text: "Ny gasolgrill i sortimentet.", cta: "Beställ i webbshoppen" },
    { roll: "saljande", text: "Mer om lösvikt.", cta: "Läs mer på webbplatsen" },
    { roll: "tips", text: "Ett tips utan länk.", cta: "Kom förbi depån" },
  ]);
  assert.ok(String(posts[0].text).endsWith("\n\nhttps://testgas.se"), "depåbesök ska ge hemsidan");
  assert.ok(String(posts[1].text).endsWith("\n\nhttps://shop.testgas.se"), "köp ska ge shoppen");
  assert.ok(String(posts[2].text).endsWith("\n\nhttps://testgas.se"), "läs mer ska ge hemsidan");
  assert.equal(posts[3].text, "Ett tips utan länk.", "tips ska inte få länk");
});

test("säger uppmaningen inte vart läsaren ska rörs ingenting", () => {
  const posts = satt([
    { roll: "saljande", text: "Köp gasol hos oss." },
    { roll: "saljande", text: "Läs mer på https://shop.testgas.se", cta: "Dela ditt bästa recept" },
    { roll: "saljande", text: "Fyll på. https://shop.testgas.se", cta: "Kom förbi depån eller beställ på nätet" },
  ]);
  assert.equal(posts[0].text, "Köp gasol hos oss.");
  assert.equal(posts[1].text, "Läs mer på https://shop.testgas.se");
  assert.equal(posts[2].text, "Fyll på. https://shop.testgas.se");
});

test("en rätt länk dubbleras inte, och en oregistrerad adress rörs inte", () => {
  const posts = satt([
    { roll: "saljande", cta: "Kom förbi depån", text: "Fyll på hos oss.\n\nhttps://testgas.se" },
    { roll: "saljande", cta: "Kom förbi depån", text: "Se https://shop.testgas.se eller https://testgas.se" },
    { roll: "tips", cta: "Kom förbi depån", text: "Läs hos https://energigas.example" },
  ]);
  assert.equal(posts[0].text, "Fyll på hos oss.\n\nhttps://testgas.se");
  assert.equal(posts[1].text, "Se eller https://testgas.se", "fel länk bort när den rätta redan står där");
  assert.equal(posts[2].text, "Läs hos https://energigas.example");
});

test("utan webbplatser händer ingenting", () => {
  const [p] = satt([{ roll: "saljande", text: "Köp gasol hos oss.", cta: "Beställ i webbshoppen" }], []);
  assert.equal(p.text, "Köp gasol hos oss.");
});

test("valideraPlan behåller länkrättningens anmärkning bredvid platshållarnas", () => {
  const plan = valideraPlan<Inlagg>({
    posts: [{ roll: "saljande", cta: "Kom förbi depån", text: "Vi finns i [ort].\n\nhttps://shop.testgas.se" }],
  }, BARA_SHOP);
  const saknas = plan.posts[0].saknas as string[];
  assert.equal(saknas.length, 2);
  assert.ok(saknas.some((s) => /ber om ett besök/.test(s)));
  assert.ok(saknas.some((s) => /depåorter/.test(s)));
});

// ── Obelagda påståenden ─────────────────────────────────────

/** Det företaget självt har skrivit. Säger ingenting om tid eller pengar. */
const UNDERLAG = {
  text: "Säljer gasol i webbshop och i egna depåer.\nEgna depåer\nGasol i lösvikt\nBetalar bara för det som faktiskt fylls",
  bevis: 0,
};

/** Stod i en riktig plan. Får aldrig sluta fångas. */
const OBELAGDA_I_SKARP_PLAN: Array<[string, string]> = [
  ["Många upplever att påfyllning är krångligt.", "Många upplever"],
  ["Lösvikt sparar både tid och pengar.", "sparar både tid och pengar"],
  ["Hos oss får du alltid fräsch gasol.", "fräsch"],
];

test("påståendena ur den riktiga planen fångas", () => {
  for (const [mening, fras] of OBELAGDA_I_SKARP_PLAN) {
    assert.ok(obelagdaPastaenden(mening, UNDERLAG).includes(fras), `missade "${fras}" i: ${mening}`);
  }
});

test("fler former av samma tre sorter fångas", () => {
  const fall: Array<[string, string]> = [
    ["De flesta husbilsägare väljer lösvikt.", "De flesta husbilsägare väljer"],
    ["Vår populära tjänst gasol i lösvikt.", "populära"],
    ["Något som är särskilt uppskattat av husbilsägare.", "uppskattat"],
    ["Många kunder vill fylla sina flaskor.", "Många kunder"],
    ["Ett kostnadseffektivt sätt att fylla på.", "kostnadseffektivt"],
    ["Flexibelt och ekonomiskt för husbilsägare.", "ekonomiskt"],
    ["Du får lägre kostnader över tid.", "lägre kostnader"],
    ["Smidigare än att byta flaska.", "Smidigare än"],
    ["Gasol av högsta kvalitet.", "högsta kvalitet"],
    ["Med högkvalitativa produkter för utomhusbruk.", "högkvalitativa"],
    // Stod i den sista mätningen: ett kampanjbudskap och ett utbyggt inlägg.
    ["Upptäck våra kvalitetsprodukter.", "kvalitetsprodukter"],
    ["Användbart för våra kunder som uppskattar exakt kontroll.", "kunder som uppskattar"],
  ];
  for (const [mening, fras] of fall) {
    assert.ok(obelagdaPastaenden(mening, UNDERLAG).includes(fras), `missade "${fras}" i: ${mening}`);
  }
});

test("bekräftade fakta och vanlig text ger inga larm", () => {
  for (const mening of [
    "Du betalar bara för det som faktiskt fylls.",
    "Vi fyller din egen flaska och du betalar per kilo.",
    "Vilken flaskstorlek passar husbilen, grillen och kaminen?",
    "Påfyllning är enklare än du tror.",
    "Vad är ditt bästa ställe att campa på?",
    "Spara inlägget till nästa resa.",
    "Tidigare i höst öppnade depån i Nyköping.",
    "Många av våra depåer ligger nära E4.",
  ]) {
    assert.deepEqual(obelagdaPastaenden(mening, UNDERLAG), [], `falskt larm: ${mening}`);
  }
});

test("det företaget självt har påstått får stå kvar", () => {
  assert.deepEqual(obelagdaPastaenden("Lösvikt sparar tid.", { text: "Lösvikt sparar tid för den som fyller ofta", bevis: 0 }), []);
  assert.deepEqual(obelagdaPastaenden("Ett prisvärt val.", { text: "Prisvärd påfyllning", bevis: 0 }), []);
  assert.deepEqual(obelagdaPastaenden("Alltid fräsch gasol.", { text: "Fräsch gasol från egen cistern", bevis: 0 }), []);
  assert.deepEqual(obelagdaPastaenden("Med högkvalitativa grillar.", { text: "Högkvalitativa grillar i gjutjärn", bevis: 0 }), []);
  assert.deepEqual(obelagdaPastaenden("Med högkvalitativa grillar.", { text: "Grillar av hög kvalitet", bevis: 0 }), []);
  assert.deepEqual(obelagdaPastaenden("Våra kvalitetsprodukter.", { text: "Grillar av hög kvalitet", bevis: 0 }), []);
  // Tid är belagt, pengar är det inte.
  assert.deepEqual(
    obelagdaPastaenden("Lösvikt sparar både tid och pengar.", { text: "Lösvikt sparar tid", bevis: 0 }),
    ["sparar både tid och pengar"],
  );
});

test("omdömen kräver verifierade bevis, inte bara ordet i underlaget", () => {
  const mening = "Många kunder uppskattar lösvikt.";
  assert.ok(obelagdaPastaenden(mening, { text: "Många kunder", bevis: 0 }).length > 0);
  assert.deepEqual(obelagdaPastaenden(mening, { text: "", bevis: 1 }), []);
});

test("utan underlag räknas ingenting som belagt", () => {
  assert.deepEqual(obelagdaPastaenden("Sparar tid."), ["Sparar tid"]);
  assert.deepEqual(obelagdaPastaenden(undefined), []);
});

test("valideraPlan märker inlägget med vad som saknar underlag", () => {
  const plan = valideraPlan<Inlagg>({
    posts: [
      { roll: "tips", title: "Spara pengar på gasolen", text: "Många upplever att det är krångligt.", cta: "Kom förbi depån" },
      { roll: "tips", title: "Så går det till", text: "Du betalar bara för det som faktiskt fylls.", cta: "Kom förbi depån" },
    ],
  }, SIDOR, UNDERLAG);
  const saknas = plan.posts[0].saknas as string[];
  assert.equal(saknas.length, 2);
  assert.ok(saknas.some((s) => s.includes('"Spara pengar"')));
  assert.ok(saknas.some((s) => s.includes('"Många upplever"') && s.includes("Vad jag vet")));
  assert.equal(plan.posts[1].saknas, undefined, "ett bekräftat faktum ska inte märkas");
});

test("utan underlag mäts inga påståenden — anropare som inte skickar det får ingen flagga", () => {
  const plan = valideraPlan<Inlagg>({ posts: [{ roll: "tips", text: "Lösvikt sparar tid och pengar." }] }, SIDOR);
  assert.equal(plan.posts[0].saknas, undefined);
});

// ── Utropstecken ────────────────────────────────────────────

test("utropstecken blir punkt", () => {
  assert.equal(
    utanUtropstecken("Du kan vara tillbaka på vägen snabbt!"),
    "Du kan vara tillbaka på vägen snabbt.",
  );
  assert.equal(utanUtropstecken("Kom förbi! Vi hjälper dig!"), "Kom förbi. Vi hjälper dig.");
});

test("en serie utropstecken blir EN punkt", () => {
  assert.equal(utanUtropstecken("Wow!!!"), "Wow.");
});

test("dubbel interpunktion undviks", () => {
  // "Va?." vore sämre än originalet.
  assert.equal(utanUtropstecken("Va?!"), "Va?");
  assert.equal(utanUtropstecken("Klart.!"), "Klart.");
});

test("text utan utropstecken rörs inte", () => {
  const t = "Ingen förändring här. Inte heller här?";
  assert.equal(utanUtropstecken(t), t);
  assert.equal(utanUtropstecken(undefined), undefined);
  assert.equal(utanUtropstecken(""), "");
});

test("valideraPlan städar inlägg, nyhetsbrev och kampanjer", () => {
  const plan = valideraPlan<{
    posts: Array<Record<string, unknown>>;
    newsletter: Record<string, unknown>;
    campaigns: Array<Record<string, unknown>>;
  }>({
    posts: [{ roll: "tips", title: "Snabbt!", text: "Kom förbi!", cta: "Gör det!" }],
    newsletter: { subject: "Nyhet!", body: "Hej!", cta: "Kom!" },
    campaigns: [{ title: "Kampanj!", message: "Nu kör vi!", cta: "Boka!" }],
  });
  assert.equal(plan.posts[0].title, "Snabbt.");
  assert.equal(plan.posts[0].text, "Kom förbi.");
  assert.equal(plan.posts[0].cta, "Gör det.");
  assert.equal(plan.newsletter.subject, "Nyhet.");
  assert.equal(plan.newsletter.cta, "Kom.");
  assert.equal(plan.campaigns[0].title, "Kampanj.");
  assert.equal(plan.campaigns[0].message, "Nu kör vi.");
});

console.log(`${passed} test ok`);

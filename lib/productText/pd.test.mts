// Kör: npx tsx lib/productText/pd.test.mts
import assert from "node:assert/strict";
import { detectPdType, PD_PROFILES } from "./pdProfiles";
import { validatePd, renderPd, sanitizePd, safeHref, isPdHtml } from "./pdRender";
import { numberTokens, addedNumbers, addedAgainst, allowedNumbers } from "./addedFacts";
import {
  validateProducts, validateGenerated, buildSystemPrompt, buildUserPrompt, rewriteReasons,
  isImprovement, batchSizeFor, budgetFor,
} from "./prompt";
import { inventedNumbers, approvedFor } from "./session";
import { toPlainText } from "./html";

let passed = 0;
function test(name: string, fn: () => void) {
  try { fn(); passed++; }
  catch (e) { console.error(`FAIL: ${name}\n  ${e instanceof Error ? e.message : e}`); process.exitCode = 1; }
}

/* ── Typer ───────────────────────────────────────────────── */

test("typen avgörs av kategori först, sedan namn", () => {
  assert.equal(detectPdType({ name: "Gasolkamin Verona", category: "Värmare", subCategory: "Gasolkaminer" }), "kamin");
  assert.equal(detectPdType({ name: "Slangsockel G14V 8mm", category: "Kopplingar & reservdelar" }), "koppling");
  assert.equal(detectPdType({ name: "Regulatorset 30mbar" }), "koppling");
  assert.equal(detectPdType({ name: "ALUGAS 11 kg", category: "ALUGAS" }), "flaska");
  assert.equal(detectPdType({ name: "Gasolgrill Greenville 3", category: "Grillar" }), "grill");
  assert.equal(detectPdType({ name: "Myggfälla", category: "Myggbekämpning" }), "allman");
});

test("byggnoteringarnas rader och rubriker", () => {
  assert.deepEqual(PD_PROFILES.kamin.specRows, ["Effekt", "Yta", "Förbrukning", "Tändning", "Fläkt", "Mått", "Vikt"]);
  assert.deepEqual(PD_PROFILES.koppling.fitLabels, { yes: "Passar direkt", add: "Kräver adapter", no: "Passar inte" });
  assert.ok(PD_PROFILES.koppling.noteHint?.includes("vänstergänga"));
});

/* ── Fält → HTML ─────────────────────────────────────────── */

const VERONA_PD = {
  lead: "Gjutjärnskamin med levande låga och en fläkt som drivs av kaminens egen värme – ingen el behövs!",
  fit: {
    yes: ["Utrymmen på 40–100 m²", "Inomhus, uterum och förtält"],
    add: ["Gasolflaska PC10 eller P11", "Regulator 30 mbar och slang – ingår inte"],
    no: ["Ventilation – förbränningen kräver syre"],
  },
  about: [
    { title: "", text: "Verona är en gasolkamin i gjutjärn med stor glasdörr." },
    { title: "Fläkt utan el.", text: "Kaminfläkten drivs av kaminens egen värme." },
  ],
  note: null,
  specs: [
    { label: "Effekt", value: "1,9–3,4 kW" },
    { label: "Förbrukning", value: "138–247 g/h" },
    { label: "Max tryck", value: "50 mbar" },          // inte en kaminrad
    { label: "Mått", value: "okänt" },                  // vet inte = saknas
  ],
  faq: [{ q: "Behöver kaminen el?", a: "Nej, fläkten drivs av värmen." }, { q: "Utan svar", a: "" }],
};

test("fälten saneras: typens rader i typens ordning, okänt räknas som saknat", () => {
  const r = validatePd(VERONA_PD, PD_PROFILES.kamin)!;
  assert.ok(!r.content.lead.includes("!"), "utropstecken bort");
  assert.deepEqual(r.content.specs.map((s) => s.label), ["Effekt", "Förbrukning"]);
  assert.deepEqual(r.missingSpecs, ["Yta", "Tändning", "Fläkt", "Mått", "Vikt"]);
  assert.equal(r.content.about[1].title, "Fläkt utan el", "punkt i rubriken tas bort, renderingen lägger den");
  assert.equal(r.content.faq.length, 1, "fråga utan svar faller bort");
  assert.equal(validatePd({ fit: {} }, PD_PROFILES.kamin), null, "ingen ingress = ingen text");
});

test("HTML:en följer verona-beskrivning.html", () => {
  const html = renderPd(validatePd(VERONA_PD, PD_PROFILES.kamin)!.content, "kamin");
  assert.ok(html.startsWith('<div class="gf-pd">'));
  assert.match(html, /<p class="gf-pd__lead">Gjutj&auml;rnskamin/);
  assert.match(html, /<div class="gf-pd__cols">\n<div class="gf-pd__main">\n<h2 class="gf-pd__h">Passar den dig\?<\/h2>/);
  assert.match(html, /<div class="gf-fit__col gf-fit__col--yes">\n {4}<h3><span class="gf-fit__icon">&#10003;<\/span>Passar f&ouml;r<\/h3>/);
  assert.match(html, /<div class="gf-fit__col gf-fit__col--no">/);
  assert.match(html, /<h2 class="gf-pd__h">Om produkten<\/h2>\n<p>Verona &auml;r/);
  assert.match(html, /<p><strong>Fl&auml;kt utan el\.<\/strong> Kaminfl/);
  assert.match(html, /<tr><td>Effekt<\/td><td>1,9&ndash;3,4 kW<\/td><\/tr>/);
  assert.match(html, /<details class="gf-acc__item">\n<summary>Beh&ouml;ver kaminen el\?<\/summary>/);
  assert.ok(!html.includes("gf-note"), "ingen varningsruta utan innehåll");
  assert.ok(isPdHtml(html));
});

test("tomma avsnitt tas inte med; kopplingen får sina rubriker och varningsruta", () => {
  const html = renderPd(validatePd({
    lead: "Slangsockel för 8 mm slang.",
    fit: { yes: ["Regulatorer med G.1/4 vänstergänga"], add: [], no: [] },
    about: [], note: { title: "Vänstergänga", text: "Gängan är vänstergängad." }, specs: [], faq: [],
  }, PD_PROFILES.koppling)!.content, "koppling");
  assert.match(html, /Passar detta\?/);
  assert.match(html, /Passar direkt/);
  assert.ok(!html.includes("gf-fit__col--add") && !html.includes("Om produkten") && !html.includes("<table"));
  assert.match(html, /<div class="gf-note">\n<span class="gf-note__icon">!<\/span>\n<div><strong>V&auml;nsterg&auml;nga<\/strong>/);
});

test("text från modellen kan inte bli HTML", () => {
  const html = renderPd(validatePd({ lead: 'Kamin <script>alert(1)</script> "fin" & <b>bra</b>', about: [] }, PD_PROFILES.allman)!.content, "allman");
  assert.ok(!html.includes("<script") && !html.includes("<b>"));
  assert.match(html, /&quot;fin&quot; &amp;/);
});

/* ── Sanering av handredigerad HTML ──────────────────────── */

test("mallens taggar och gf-klasser behålls", () => {
  const html = renderPd(validatePd(VERONA_PD, PD_PROFILES.kamin)!.content, "kamin");
  assert.equal(sanitizePd(html), html.replace(/\n\s*/g, (m) => m), "egen rendering överlever oförändrad");
  assert.equal(toPlainText(sanitizePd(html)), toPlainText(html));
});

test("stil, skript, händelser och främmande klasser tas bort", () => {
  const ut = sanitizePd('<div class="gf-pd evil" style="color:red" onclick="x()"><p class="gf-pd__lead" onmouseover="y">A</p><script>alert(1)</script><img src=x onerror=z><style>p{}</style></div>');
  assert.equal(ut, '<div class="gf-pd"><p class="gf-pd__lead">A</p></div>');
});

test("bara länkar inom butiken", () => {
  assert.equal(safeHref("/paketerbjudanden/verona/"), "/paketerbjudanden/verona/");
  assert.equal(safeHref("#jamfor"), "#jamfor");
  for (const bad of ["javascript:alert(1)", "https://evil.se/", "//evil.se/x", " /a\"onclick", "data:text/html,x"]) {
    assert.equal(safeHref(bad), null, bad);
  }
  assert.equal(sanitizePd('<a href="https://evil.se">x</a><a href="/ok/" target="_blank">y</a>'), '<a>x</a><a href="/ok/">y</a>');
});

/* ── Påhittade tal ───────────────────────────────────────── */

test("tal normaliseras: tusental, decimalkomma, inledande nollor", () => {
  assert.deepEqual(numberTokens("1 012 kr, 3,4 kW, 08 mm, 2.50 m"), ["1012", "3.4", "8", "2.5"]);
});

test("det verkliga felet: en påhittad tryckklass och standard flaggas", () => {
  assert.deepEqual(addedNumbers("Regulator 30 mbar för 8 mm slang enligt EN 559.", "Regulatorset för 8 mm slang"), ["30", "559"]);
  assert.deepEqual(addedNumbers("1,9–3,4 kW", "Effekt 1,9 - 3,4 kW"), []);
});

test("kontrollen räknas om mot sparad lista", () => {
  const allowed = allowedNumbers("8 mm slang");
  assert.deepEqual(addedAgainst("8 mm och 30 mbar", allowed), ["30"]);
  assert.deepEqual(addedAgainst("8 mm", allowed), []);
  assert.deepEqual(addedAgainst("30 mbar", undefined), [], "äldre texter utan lista flaggas inte");
});

/* ── Hela vägen: modellens svar → text ───────────────────── */

const [verona] = validateProducts([{
  id: "101259", name: "Gasolkamin Verona", template: "huvudprodukt", category: "Värmare", subCategory: "Gasolkaminer",
  current: "<p>Gjutjärnskamin 1,9–3,4 kW för 40–100 m². Förbrukning 138–247 g/h. PC10 och P11.</p>",
}])!;
verona.pdType = detectPdType(verona);

test("gfpd: HTML byggs av fälten, och påhittade tal hittas", () => {
  const [t] = validateGenerated({ texts: [{
    id: "101259", fakta: [], metaTitle: "Gasolkamin Verona 3,4 kW", metaDescription: "Gasolkamin i gjutjärn.",
    pd: { ...VERONA_PD, specs: [...VERONA_PD.specs, { label: "Vikt", value: "23 kg" }] }, needsInfo: [],
  }] }, [verona], { format: "gfpd" })!;
  assert.ok(isPdHtml(t.description));
  assert.equal(t.pdType, "kamin");
  assert.ok(t.pd && t.pd.specs.some((s) => s.label === "Vikt"));
  // 23 kg och 30 mbar står inte i underlaget (50 mbar föll bort som fel rad).
  assert.deepEqual(t.addedNumbers, ["30", "23"]);
  assert.match(rewriteReasons(t, verona).join(), /de här talen står inte någonstans i underlaget: 30, 23/);
  assert.ok(!rewriteReasons(t, verona).join().includes("mallen kräver"), "längden mäts inte i den nya mallen");
});

test("en text med färre påhittade tal är alltid bättre", () => {
  const base = { id: "1", description: "", metaTitle: "", metaDescription: "", needsInfo: [], facts: [], keywords: [], missingFacts: [], uncoveredFacts: [], allowedNumbers: [] };
  assert.equal(isImprovement({ ...base, addedNumbers: [], missingFacts: ["x"] }, { ...base, addedNumbers: ["30"] }), true);
});

test("prompten: typraden och fältformatet, ingen HTML", () => {
  const sys = buildSystemPrompt(null, "", "gfpd");
  assert.match(sys, /Du skriver INTE HTML/);
  assert.match(sys, /"specs"/);
  assert.ok(!sys.includes("Endast dessa taggar"));
  const user = buildUserPrompt([verona], undefined, "gfpd");
  assert.match(user, /typ: kamin/);
  assert.match(user, /specifikationsrader: Effekt, Yta, Förbrukning/);
  assert.ok(!user.includes("mall: huvudprodukt"));
  assert.match(buildSystemPrompt(null), /Endast dessa taggar/, "det enkla formatet är oförändrat");
});

test("färre artiklar per anrop i den nya mallen", () => {
  assert.ok(batchSizeFor("reservdel", "gfpd") < batchSizeFor("reservdel"));
  assert.ok(budgetFor([verona], "gfpd") <= 4096);
});

/* ── I webbläsaren ───────────────────────────────────────── */

test("flaggan räknas om när talet tas bort ur texten", () => {
  const item = { template: "huvudprodukt" as const, description: "<p>30 mbar och 8 mm</p>", allowedNumbers: ["8"], metaTitle: "", metaDescription: "" };
  assert.deepEqual(inventedNumbers(item), ["30"]);
  assert.deepEqual(inventedNumbers({ ...item, description: "<p>8 mm</p>" }), []);
  assert.deepEqual(inventedNumbers({ ...item, description: "<p>8 mm</p>", metaTitle: "Regulator 30 mbar" }), ["30"], "meta räknas med");
});

test("exporten sanerar det som redigerats för hand", () => {
  const out = approvedFor({
    a: { template: "huvudprodukt", approved: true, description: '<div class="gf-pd" style="x"><p onclick="y">A</p></div>' },
    b: { template: "tillbehor", approved: true, description: '<p class="x">B</p><div>C</div>' },
  });
  assert.equal(out.a.description, '<div class="gf-pd"><p>A</p></div>');
  assert.equal(out.b.description, "<p>B</p>C");
});

console.log(`${passed} test ok`);

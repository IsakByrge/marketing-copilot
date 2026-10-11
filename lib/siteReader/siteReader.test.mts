// Kör: npx tsx lib/siteReader/siteReader.test.mts
import assert from "node:assert/strict";
import {
  sitemapsFromRobots, parseSitemap, rankSitemap, scorePage, selectPages, linksFrom,
  extractPage, structuredLines, corpus, trimBoilerplate,
} from "./pages";
import { validateDraft, numbersIn, numbersOnPage, siteReaderPrompt } from "./brainDraft";
import { suggestionsFrom, applySuggestions } from "./merge";
import type { CompanyBrain } from "../../app/_shared/companyBrain";

let passed = 0;
function test(name: string, fn: () => void) {
  try { fn(); passed++; }
  catch (e) { console.error(`FAIL: ${name}\n  ${e instanceof Error ? e.message : e}`); process.exitCode = 1; }
}

// Påhittade sajter med samma form som en WordPress-sajt med Yoast och en
// webbshop med gzippad sitemap.
const ROOT = "https://www.testgas.se/";

test("sitemaps läses ur robots.txt", () => {
  const robots = "User-agent: *\nDisallow: /checkout/\nSitemap: https://shop.testgas.se/sitemap.xml.gz\nsitemap:https://testgas.se/sitemap_index.xml";
  assert.deepEqual(sitemapsFromRobots(robots), ["https://shop.testgas.se/sitemap.xml.gz", "https://testgas.se/sitemap_index.xml"]);
});

test("sitemap-index och sidlista skiljs åt", () => {
  const index = `<?xml version="1.0"?><sitemapindex><sitemap><loc>https://testgas.se/page-sitemap.xml</loc></sitemap><sitemap><loc>https://testgas.se/post-sitemap.xml</loc></sitemap></sitemapindex>`;
  assert.deepEqual(parseSitemap(index), { pages: [], sitemaps: ["https://testgas.se/page-sitemap.xml", "https://testgas.se/post-sitemap.xml"] });
  const set = `<urlset><url><loc><![CDATA[ https://testgas.se/om-oss/ ]]></loc></url><url><loc>https://testgas.se/a?x=1&amp;y=2</loc></url></urlset>`;
  assert.deepEqual(parseSitemap(set).pages, ["https://testgas.se/om-oss/", "https://testgas.se/a?x=1&y=2"]);
});

test("sidor och platser går före blogginlägg; taggar öppnas inte", () => {
  assert.ok(rankSitemap("https://testgas.se/page-sitemap.xml") > rankSitemap("https://testgas.se/post-sitemap.xml"));
  assert.ok(rankSitemap("https://testgas.se/fyllningsstation-sitemap.xml") > rankSitemap("https://testgas.se/produkt-sitemap.xml"));
  assert.equal(rankSitemap("https://testgas.se/post_tag-sitemap.xml"), -1);
});

test("om oss, butiker och kampanjer går före villkor och kassa", () => {
  assert.ok(scorePage("https://testgas.se/info/om-oss/", ROOT) > scorePage("https://testgas.se/grillar/weber-q1200-blabla/", ROOT));
  assert.ok(scorePage("https://shop.testgas.se/campaigns/", "https://shop.testgas.se/") > 0);
  assert.ok(scorePage("https://testgas.se/info/kopvillkor/", ROOT) < -10);
  assert.equal(scorePage("https://annan.se/om-oss/", ROOT), -100);
});

test("urvalet: startsidan först, inga dubbletter, robots följs, taket hålls", () => {
  const urls = [
    "https://testgas.se/info/kopvillkor/", "https://testgas.se/om-oss/", "https://testgas.se/om-oss",
    "https://testgas.se/hemlig/sida/", "https://testgas.se/kontakt/", "https://testgas.se/blogg/2019/nyhet/",
    "https://testgas.se/gasolkaminer/", "https://annan.se/om-oss/",
  ];
  const ut = selectPages(urls, ROOT, 4, (p) => !p.startsWith("/hemlig"));
  assert.equal(ut[0], ROOT);
  assert.equal(ut.length, 4);
  assert.ok(ut.includes("https://testgas.se/om-oss/"));
  assert.ok(!ut.some((u) => u.includes("hemlig") || u.includes("kopvillkor") || u.includes("annan.se")));
});

test("länkar på startsidan, relativa och absoluta", () => {
  const html = `<a href="/om-oss/">Om</a><a class="x" href='https://testgas.se/kontakt'>K</a><a href="mailto:a@b.se">m</a><a href="#top">t</a>`;
  assert.deepEqual(linksFrom(html, ROOT), ["https://www.testgas.se/om-oss/", "https://testgas.se/kontakt"]);
});

const shopHtml = `<html><head><title>Testgas Shop</title><meta name="description" content="Gasol och grillar">
<script type="application/ld+json">{"@context":"https://schema.org","@graph":[
 {"@type":"Product","name":"Gasolkamin Alfa","offers":{"@type":"Offer","price":"1990","priceCurrency":"SEK"}},
 {"@type":"LocalBusiness","name":"Testgas Motala","address":{"streetAddress":"Storgatan 1","addressLocality":"Motala"},"openingHours":["Mo-Fr 07:30-17:30"]}
]}</script></head>
<body><nav>Meny</nav><main><h2>Gasolkaminer</h2><div>Gasolkamin Alfa</div><div>1 990 kr</div>
<div>Gasolkamin Beta</div><div>149 kr</div><div>Regulator</div><div>149 kr</div><p>Lägg i varukorgen</p><p>Lägg i varukorgen</p></main>
<script>var x = 1;</script></body></html>`;

test("en sida blir titel, beskrivning, strukturerad data och text", () => {
  const p = extractPage(shopHtml, "https://shop.testgas.se/");
  assert.equal(p.title, "Testgas Shop");
  assert.equal(p.description, "Gasol och grillar");
  assert.deepEqual(p.structured, [
    "Produkt: Gasolkamin Alfa — 1990 SEK",
    "Plats: Testgas Motala — Storgatan 1, Motala — öppet Mo-Fr 07:30-17:30",
  ]);
  assert.ok(!p.text.includes("var x"));
  assert.ok(!p.text.includes("Meny"), "main-elementet går före meny");
  // Båda "149 kr" finns kvar, så namn och pris inte hamnar i otakt.
  assert.equal(p.text.split("149 kr").length - 1, 2);
  assert.equal(p.text.split("Lägg i varukorgen").length - 1, 1);
});

test("trasig JSON-LD fäller inte sidan", () => {
  assert.deepEqual(structuredLines(`<script type="application/ld+json">{trasig</script>`), []);
});

test("korpusen har sidrubriker och håller taket", () => {
  const p = extractPage(shopHtml, "https://shop.testgas.se/");
  const c = corpus([p, { ...p, url: "https://shop.testgas.se/b/" }], 600);
  assert.match(c, /^=== SIDA: https:\/\/shop\.testgas\.se\//);
  assert.ok(c.length <= 600);
});

test("tal läses med tusentalsavgränsare", () => {
  assert.deepEqual(numbersIn("1 012–6 990 kr"), ["1012", "6990"]);
  assert.ok(numbersOnPage("1 990 kr", "Pris 1 990 kr"));
  assert.ok(!numbersOnPage("2 490 kr", "Pris 1 990 kr"));
  assert.ok(numbersOnPage("Vardagar 07.30-17.30", "öppet vardagar 07.30–17.30"));
});

const pages = [
  extractPage(shopHtml, "https://shop.testgas.se/"),
  extractPage(`<main><h1>Våra depåer</h1><p>Motala, Storgatan 1. Vardagar 07.30-17.30</p><p>Mjölby</p></main>`, "https://testgas.se/depaer/"),
];

test("förslagen kontrolleras: källa krävs, påhittade siffror tas bort", () => {
  const d = validateDraft({
    summary: "Testgas fyller gasol.",
    customers: ["Husbilsägare", "Husbilsägare", ""],
    usps: ["Fyller medan du väntar"],
    tone: ["rak"],
    products: [
      { name: "Gasolkaminer", priceInfo: "149–1 990 kr", examples: ["Alfa", "Beta", "Gamma"], source: "https://shop.testgas.se" },
      { name: "Grillar", priceInfo: "2 490 kr", examples: [], source: "https://shop.testgas.se/" },
      { name: "Påhittad", source: "https://annan.se/" },
    ],
    locations: [
      { city: "Motala", address: "Storgatan 1", openingHours: "Vardagar 07.30-17.30", source: "https://testgas.se/depaer/" },
      { city: "Mjölby", address: "Ågatan 9", source: "https://testgas.se/depaer" },
      { city: "Linköping", source: "https://testgas.se/depaer/" },
    ],
  }, pages);
  assert.deepEqual(d.customers, ["Husbilsägare"]);
  assert.equal(d.products.length, 2, "produkten utan läst källa faller bort");
  assert.equal(d.products[0].priceInfo, "149–1 990 kr");
  assert.deepEqual(d.products[0].examples, ["Alfa", "Beta"], "en modell som inte står någonstans tas bort");
  assert.equal(d.products[1].priceInfo, undefined, "ett pris som inte står på sidan tas bort");
  assert.equal(d.locations.length, 2, "en ort som inte står på källsidan faller bort");
  assert.equal(d.locations[0].address, "Storgatan 1");
  assert.equal(d.locations[1].address, undefined, "en adress som inte står på sidan tas bort");
  assert.equal(validateDraft("skräp", pages).products.length, 0);
});

test("prompten kräver källa och exakta siffror", () => {
  const p = siteReaderPrompt("=== SIDA: https://x.se/\ntext", "Testgas");
  assert.match(p, /"source"/);
  assert.match(p, /EXAKT som på sidan/);
});

function brain(over: Partial<CompanyBrain> = {}): CompanyBrain {
  return {
    companySummary: "", primaryCustomers: [], strengths: [], uniqueSellingPoints: [], tone: [],
    contentGuidelines: [], forbiddenClaims: [], preferredCallsToAction: [], commonCustomerObjections: [],
    proofPoints: [], competitors: [], locations: [], websites: [], products: [], keySeasons: [], marketingGoals: [],
    ...over,
  };
}

test("förslag: nytt eller komplettering, och det som redan står ändras aldrig", () => {
  const d = validateDraft({
    summary: "Testgas fyller gasol.",
    usps: ["Fyller medan du väntar"],
    products: [{ name: "Gasolkaminer", priceInfo: "149–1 990 kr", examples: ["Alfa"], source: "https://shop.testgas.se/" }],
    locations: [{ city: "Motala", address: "Storgatan 1", source: "https://testgas.se/depaer/" }, { city: "Mjölby", source: "https://testgas.se/depaer/" }],
  }, pages);
  const b = brain({
    companySummary: "Egen sammanfattning.",
    products: [{ id: "p1", name: "Gasolkamin", differentiators: [], commonObjections: [], profitability: "high", priority: "high", source: "user_confirmed", confidence: "high", updatedAt: "x" }],
    locations: [{ id: "l1", city: "Motala", openingHours: "Egna tider" }],
  });
  const sug = suggestionsFrom(d, b);
  const kinds = sug.map((s) => s.kind).sort();
  assert.deepEqual(kinds, ["list", "location-fill", "location-new", "product-fill"], "sammanfattningen föreslås inte när en finns");
  const next = applySuggestions(b, sug, () => "ny", "2026-10-12T00:00:00Z");
  assert.equal(next.companySummary, "Egen sammanfattning.");
  assert.equal(next.products[0].name, "Gasolkamin", "namnet användaren skrev står kvar");
  assert.equal(next.products[0].priority, "high");
  assert.equal(next.products[0].priceInfo, "149–1 990 kr");
  assert.equal(next.locations[0].openingHours, "Egna tider", "egna öppettider skrivs inte över");
  assert.equal(next.locations[0].address, "Storgatan 1");
  assert.equal(next.locations[1].city, "Mjölby");
  assert.deepEqual(next.uniqueSellingPoints, ["Fyller medan du väntar"]);
  assert.equal(b.products[0].priceInfo, undefined, "originalet muteras inte");
});

test("en vald produkt från hemsidan är bekräftad och bär sin källa", () => {
  const d = validateDraft({ products: [{ name: "Pizzaugnar", priceInfo: "1 990 kr", examples: [], source: "https://shop.testgas.se/" }] }, pages);
  const next = applySuggestions(brain(), suggestionsFrom(d, brain()), () => "ny");
  assert.equal(next.products[0].source, "user_confirmed");
  assert.equal(next.products[0].priority, "normal");
  assert.equal(next.products[0].sourceUrl, "https://shop.testgas.se/");
});

test("högst tre sidor per mapp, så kategorier inte trängs undan", () => {
  const urls = [
    ...[1, 2, 3, 4, 5, 6].map((n) => `https://testgas.se/paketerbjudanden/paket-${n}/`),
    "https://testgas.se/varmare/", "https://testgas.se/grillar/",
  ];
  const ut = selectPages(urls, ROOT, 10);
  assert.equal(ut.filter((u) => u.includes("/paketerbjudanden/")).length, 3);
  assert.ok(ut.includes("https://testgas.se/varmare/") && ut.includes("https://testgas.se/grillar/"));
});

test("menyn som står på varje sida tas bort, utom på startsidan", () => {
  const meny = "Priser\nKontakt\nWebbshop\nEnköping\nLinköping";
  const sida = (url: string, egen: string) => ({ url, title: "", description: "", structured: [], text: `${meny}\n${egen}` });
  const ut = trimBoilerplate([
    sida("https://testgas.se/", "Välkommen"),
    sida("https://testgas.se/a/", "Depån i Motala, Storgatan 1"),
    sida("https://testgas.se/b/", "Öppet 7–17"),
    sida("https://testgas.se/c/", "Om oss"),
  ]);
  assert.ok(ut[0].text.includes("Priser"), "startsidan behåller allt");
  assert.equal(ut[1].text, "Depån i Motala, Storgatan 1");
  assert.equal(ut[2].text, "Öppet 7–17");
});

test("en plats i JSON-LD utan adress, tider eller telefon är ingen uppgift", () => {
  assert.deepEqual(structuredLines(`<script type="application/ld+json">{"@type":"Organization","name":"Testgas"}</script>`), []);
});

console.log(`${passed} test ok`);

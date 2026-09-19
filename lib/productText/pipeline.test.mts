// Kör: npx tsx lib/productText/pipeline.test.mts
//
// Hela vägen från CSV-rad till importfil: mallval, listans härledningar,
// validering av modellens svar och exporten tillbaka till butiken.
import assert from "node:assert/strict";
import { THIN_LIMIT, type ColumnGuess, type Row } from "./csv";
import { pickTemplate, TEMPLATES } from "./templates";
import {
  buildProducts, initialItems, catalogStats, parseStock, itemState,
  filterProducts, sortProducts, categoriesOf, approvedFor, filterCounts, pageState,
  EMPTY_FILTERS, type WorkItem,
} from "./session";
import type { PageResult } from "./pageFacts";
import { validateProducts, validateGenerated, clampMeta, budgetFor, MAX_BATCH } from "./prompt";
import { buildImport, buildImportCsv } from "./importFile";
import { parseCsv } from "./csv";

let passed = 0;
function test(name: string, fn: () => void) {
  try { fn(); passed++; }
  catch (e) { console.error(`FAIL: ${name}\n  ${e instanceof Error ? e.message : e}`); process.exitCode = 1; }
}

// ── Mallval ─────────────────────────────────────────────────

test("kopplingar och reservdelar blir reservdelsmallen", () => {
  assert.equal(pickTemplate({ category: "Kopplingar & reservdelar" }), "reservdel");
  assert.equal(pickTemplate({ category: "ALUGAS", name: "Slangbrottsventil G1/4" }), "reservdel");
});

test("kaminer, grillar, pizzaugnar och kylskåp blir huvudprodukt", () => {
  assert.equal(pickTemplate({ category: "Gasolkaminer" }), "huvudprodukt");
  assert.equal(pickTemplate({ category: "Grillar" }), "huvudprodukt");
  assert.equal(pickTemplate({ category: "Pizzaugnar" }), "huvudprodukt");
  assert.equal(pickTemplate({ category: "Kylskåp" }), "huvudprodukt");
});

test("okänd kategori faller på tillbehör", () => {
  assert.equal(pickTemplate({ category: "ALUGAS" }), "tillbehor");
  assert.equal(pickTemplate({}), "tillbehor");
});

test("kategorin väger tyngre än produktnamnet", () => {
  // Butiken har satt kategorin; namnet kommer från en leverantör.
  assert.equal(pickTemplate({ category: "Kopplingar & reservdelar", name: "Grillgaller" }), "reservdel");
  // Och åt andra hållet: en kamin i kaminkategorin blir inte reservdel bara
  // för att den har en brännare i namnet.
  assert.equal(pickTemplate({ category: "Gasolkaminer", name: "Kamin med brännare" }), "huvudprodukt");
});

test("reservdelsmallen förbjuder säljretorik", () => {
  assert.match(TEMPLATES.reservdel.instructions, /Ingen säljretorik/);
  assert.equal(TEMPLATES.reservdel.maxWords, 80);
});

// ── Katalogen ───────────────────────────────────────────────

const COLS: ColumnGuess = {
  id: "Article number", name: "Name", description: "Description",
  group: "Category", subGroup: "Sub category", stock: "Stock",
  producer: "Producer", model: "Model", url: "URL",
};

const ROWS: Row[] = [
  { "Article number": "1001", Name: "Gasolkamin 4000", Description: "<p>" + "x".repeat(400) + "</p>", Category: "Gasolkaminer", "Sub category": "", Stock: "4", Producer: "Kemppi", Model: "K4000" },
  { "Article number": "1002", Name: "Slangnippel", Description: "", Category: "Kopplingar & reservdelar", "Sub category": "Nipplar", Stock: "0", Producer: "", Model: "" },
  { "Article number": "1003", Name: "Kapell", Description: "<p>Kort</p>", Category: "ALUGAS", "Sub category": "", Stock: "", Producer: "", Model: "" },
];

test("buildProducts plockar ut fälten och mäter nuvarande text", () => {
  const products = buildProducts(ROWS, COLS);
  assert.equal(products.length, 3);
  assert.equal(products[0].producer, "Kemppi");
  assert.equal(products[0].currentLength, 400);
  assert.equal(products[1].currentLength, 0);
  assert.equal(products[2].currentLength, 4);
});

test("buildProducts hoppar över rader utan artikelnummer eller namn", () => {
  const rows = [...ROWS, { "Article number": "", Name: "Spöke" }];
  assert.equal(buildProducts(rows, COLS).length, 3);
});

test("parseStock tolkar tal och ger null när det inte går", () => {
  assert.equal(parseStock("12"), 12);
  assert.equal(parseStock("12 st"), 12);
  assert.equal(parseStock("12,0"), 12);
  assert.equal(parseStock("-3"), -3);
  assert.equal(parseStock(""), null);
  assert.equal(parseStock("okänt"), null);
});

test("initialItems väljer mall per artikel efter kategori", () => {
  const items = initialItems(buildProducts(ROWS, COLS));
  assert.equal(items["1001"].template, "huvudprodukt");
  assert.equal(items["1002"].template, "reservdel");
  assert.equal(items["1003"].template, "tillbehor");
});

test("initialItems behåller mall du redan ändrat", () => {
  const products = buildProducts(ROWS, COLS);
  const kept = initialItems(products, { "1001": { template: "tillbehor" } });
  assert.equal(kept["1001"].template, "tillbehor");
});

test("catalogStats räknar saknade, tunna och medianen", () => {
  const s = catalogStats(buildProducts(ROWS, COLS), THIN_LIMIT);
  assert.equal(s.total, 3);
  assert.equal(s.missing, 1);
  assert.equal(s.thin, 1);
  assert.equal(s.ok, 1);
  assert.equal(s.median, 4);
});

test("tom katalog kraschar inte statistiken", () => {
  const s = catalogStats([], THIN_LIMIT);
  assert.deepEqual(s, { total: 0, missing: 0, thin: 0, ok: 0, median: 0 });
});

// ── Tillstånd, filter, sortering ────────────────────────────

test("itemState: godkänt slår allt annat", () => {
  const p = buildProducts(ROWS, COLS)[1];
  assert.equal(itemState(p, undefined, THIN_LIMIT), "saknar");
  assert.equal(itemState(p, { template: "reservdel" }, THIN_LIMIT), "saknar");
  assert.equal(itemState(p, { template: "reservdel", description: "<p>x</p>" }, THIN_LIMIT), "utkast");
  assert.equal(itemState(p, { template: "reservdel", description: "<p>x</p>", needsInfo: ["gänga"] }, THIN_LIMIT), "behover");
  assert.equal(itemState(p, { template: "reservdel", description: "<p>x</p>", needsInfo: ["gänga"], approved: true }, THIN_LIMIT), "godkand");
});

test("filter på status, kategori, mall och fritext", () => {
  const products = buildProducts(ROWS, COLS);
  const items = initialItems(products);
  const f = (over: Partial<typeof EMPTY_FILTERS>) =>
    filterProducts(products, items, { ...EMPTY_FILTERS, ...over }, THIN_LIMIT).map((p) => p.id);

  assert.deepEqual(f({ status: "saknar" }), ["1002"]);
  assert.deepEqual(f({ status: "tunn" }), ["1003"]);
  assert.deepEqual(f({ category: "ALUGAS" }), ["1003"]);
  assert.deepEqual(f({ template: "huvudprodukt" }), ["1001"]);
  assert.deepEqual(f({ query: "kamin" }), ["1001"]);
  assert.deepEqual(f({ query: "1002" }), ["1002"]);
  assert.deepEqual(f({}), ["1001", "1002", "1003"]);
});

// ── Lager och produktsida ───────────────────────────────────
// Många artiklar i Visma-importen har 0 i lager och död produktsida och är
// inte värda en text. 1001 har 4 i lager, 1002 har 0, 1003 saknar saldo.

const SOURCES: Record<string, PageResult> = {
  "1001": { ok: true, url: "https://b.se/1001", specs: [], documents: [] },
  "1002": { ok: false, url: "https://b.se/1002", reason: "Sidan finns inte längre (404).", status: 404 },
  "1003": { ok: false, url: "https://b.se/1003", reason: "Sidan svarade inte i tid." },
};

test("pageState: hämtad, död, och allt vi inte vet", () => {
  assert.equal(pageState(SOURCES["1001"]), "finns");
  assert.equal(pageState(SOURCES["1002"]), "saknas");
  assert.equal(pageState({ ok: false, url: "x", reason: "Borta.", status: 410 }), "saknas");
  // Timeout och serverfel betyder inte att sidan är död.
  assert.equal(pageState(SOURCES["1003"]), "okand");
  assert.equal(pageState({ ok: false, url: "x", reason: "Sidan svarade 503.", status: 503 }), "okand");
  assert.equal(pageState(undefined), "okand");
});

test("pageState läser 404 ur pass som sparades innan statusen fanns", () => {
  assert.equal(pageState({ ok: false, url: "x", reason: "Sidan finns inte längre (404)." }), "saknas");
});

test("filter: finns i lager och produktsidans läge", () => {
  const products = buildProducts(ROWS, COLS);
  const items = initialItems(products);
  const f = (over: Partial<typeof EMPTY_FILTERS>) =>
    filterProducts(products, items, { ...EMPTY_FILTERS, ...over }, THIN_LIMIT, SOURCES).map((p) => p.id);

  // Noll i lager och okänt saldo räknas inte som i lager.
  assert.deepEqual(f({ stock: "i_lager" }), ["1001"]);
  assert.deepEqual(f({ page: "finns" }), ["1001"]);
  assert.deepEqual(f({ page: "saknas" }), ["1002"]);
  assert.deepEqual(f({ stock: "i_lager", page: "saknas" }), []);
  // Utan hämtade sidor finns inget att säga om sidan.
  assert.deepEqual(filterProducts(products, items, { ...EMPTY_FILTERS, page: "saknas" }, THIN_LIMIT).map((p) => p.id), []);
});

test("antalen stämmer med vad listan visar när du trycker", () => {
  const rows = ROWS.map((r) => ({ ...r, URL: `https://b.se/${r["Article number"]}` }));
  const products = buildProducts(rows, COLS);
  const items = initialItems(products);
  const c = filterCounts(products, items, EMPTY_FILTERS, THIN_LIMIT, SOURCES);
  assert.deepEqual(c, { hasStock: true, inStock: 1, pageFound: 1, pageMissing: 1, pageUnchecked: 0 });

  // Med ett annat filter aktivt räknas antalen inom det.
  const tunn = filterCounts(products, items, { ...EMPTY_FILTERS, status: "saknar" }, THIN_LIMIT, SOURCES);
  assert.equal(tunn.pageMissing, 1);
  assert.equal(tunn.inStock, 0);

  // Lagerantalet räknas utan lagerfiltret, så knappen visar vad den ger.
  const iLager = filterCounts(products, items, { ...EMPTY_FILTERS, stock: "i_lager" }, THIN_LIMIT, SOURCES);
  assert.equal(iLager.inStock, 1);
  assert.equal(iLager.pageMissing, 0);

  // Aldrig hämtade sidor kan kontrolleras; fel som redan sparats räknas inte.
  const none = filterCounts(products, items, EMPTY_FILTERS, THIN_LIMIT, {});
  assert.equal(none.pageUnchecked, 3);
});

test("utan lagerkolumn visas inget lagerfilter", () => {
  const products = buildProducts(ROWS, { ...COLS, stock: null });
  assert.equal(filterCounts(products, initialItems(products), EMPTY_FILTERS, THIN_LIMIT, {}).hasStock, false);
});

test("sortering på textlängd, kategori och namn", () => {
  const products = buildProducts(ROWS, COLS);
  assert.deepEqual(sortProducts(products, "length", "asc").map((p) => p.id), ["1002", "1003", "1001"]);
  assert.deepEqual(sortProducts(products, "length", "desc").map((p) => p.id), ["1001", "1003", "1002"]);
  assert.deepEqual(sortProducts(products, "category", "asc").map((p) => p.id), ["1003", "1001", "1002"]);
});

test("saknat lagersaldo hamnar sist åt båda hållen", () => {
  const products = buildProducts(ROWS, COLS);
  assert.equal(sortProducts(products, "stock", "asc").at(-1)?.id, "1003");
  assert.equal(sortProducts(products, "stock", "desc").at(-1)?.id, "1003");
});

test("categoriesOf ger unika kategorier i svensk bokstavsordning", () => {
  assert.deepEqual(categoriesOf(buildProducts(ROWS, COLS)), ["ALUGAS", "Gasolkaminer", "Kopplingar & reservdelar"]);
});

// ── Validering av modellens svar ────────────────────────────

const ASKED = validateProducts([
  { id: "1001", name: "Gasolkamin 4000", template: "huvudprodukt", category: "Gasolkaminer" },
  { id: "1002", name: "Slangnippel", template: "reservdel" },
])!;

test("validateProducts kräver mall", () => {
  assert.equal(validateProducts([{ id: "1", name: "A" }]), null);
  assert.equal(validateProducts([{ id: "1", name: "A", template: "hittepa" }]), null);
  assert.ok(validateProducts([{ id: "1", name: "A", template: "tillbehor" }]));
});

test("validateProducts avvisar för stor batch", () => {
  const many = Array.from({ length: MAX_BATCH + 1 }, (_, i) => ({ id: String(i), name: "A", template: "reservdel" }));
  assert.equal(validateProducts(many), null);
});

test("budgetFor ger huvudprodukter mer utrymme än reservdelar", () => {
  const stor = validateProducts([{ id: "1", name: "A", template: "huvudprodukt" }])!;
  const liten = validateProducts([{ id: "1", name: "A", template: "reservdel" }])!;
  assert.ok(budgetFor(stor) > budgetFor(liten));
  assert.ok(budgetFor(stor) <= 4096);
});

test("validateGenerated sanerar html och kodar entiteter", () => {
  const out = validateGenerated({
    texts: [{
      id: "1002",
      description: '<div><p>Nippel i mässing.</p><script>x</script></div>',
      metaTitle: "Slangnippel",
      metaDescription: "Nippel i mässing.",
      needsInfo: [],
    }],
  }, ASKED)!;
  assert.equal(out.length, 1);
  assert.equal(out[0].description, "<p>Nippel i m&auml;ssing.</p>");
});

test("validateGenerated kastar texter för produkter vi inte frågat om", () => {
  const out = validateGenerated({
    texts: [{ id: "9999", description: "<p>Fel produkt</p>" }],
  }, ASKED);
  assert.equal(out, null);
});

test("validateGenerated kastar identisk text på två artiklar", () => {
  const same = "<p>Exakt samma text pa bada artiklarna, vilket betyder att modellen tappat bort sig.</p>";
  const out = validateGenerated({
    texts: [{ id: "1001", description: same }, { id: "1002", description: same }],
  }, ASKED)!;
  assert.equal(out.length, 1);
});

test("för kort text märks Behöver uppgifter även när modellen tiger", () => {
  const out = validateGenerated({
    texts: [{ id: "1001", description: "<p>En kamin.</p>", needsInfo: [] }],
  }, ASKED)!;
  assert.ok(out[0].needsInfo.length > 0);
});

test("modellens egna needsInfo behålls", () => {
  const out = validateGenerated({
    texts: [{ id: "1002", description: "<p>" + "ord ".repeat(20) + "</p>", needsInfo: ["gänga", "tryck"] }],
  }, ASKED)!;
  assert.deepEqual(out[0].needsInfo, ["gänga", "tryck"]);
});

test("meta faller tillbaka på produktnamnet när modellen struntar i det", () => {
  const out = validateGenerated({
    texts: [{ id: "1001", description: "<p>" + "ord ".repeat(100) + "</p>" }],
  }, ASKED)!;
  assert.equal(out[0].metaTitle, "Gasolkamin 4000");
  assert.ok(out[0].metaDescription.length > 0);
});

test("clampMeta klipper vid ordgräns och håller taket", () => {
  assert.equal(clampMeta("Kort titel", 60), "Kort titel");
  const long = clampMeta("Gasolkamin för husvagn med termostat och inbyggd tändsäkring", 30);
  assert.ok(long.length <= 30);
  assert.ok(!long.endsWith(" "));
  assert.ok(!/\S$/.test(long) || !long.includes("  "));
});

test("clampMeta avkodar entiteter innan den räknar tecken", () => {
  assert.equal(clampMeta("m&auml;ssing", 60), "mässing");
});

// ── Importfilen ─────────────────────────────────────────────

const HEADERS = ["Article number", "Name", "Description", "Category", "Stock"];

test("Ignore=1 på allt utom det godkända", () => {
  const built = buildImport({
    headers: HEADERS, rows: ROWS, idColumn: "Article number", descriptionColumn: "Description",
    approved: { "1002": { description: "<p>Ny</p>", metaTitle: "T", metaDescription: "D" } },
  });
  assert.equal(built.included, 1);
  assert.deepEqual(built.rows.map((r) => r["Ignore"]), ["1", "0", "1"]);
  assert.equal(built.rows[1]["Description"], "<p>Ny</p>");
  assert.equal(built.rows[1]["Meta title"], "T");
  // Orörda rader behåller sin gamla text — de importeras ju inte ändå.
  assert.equal(built.rows[0]["Description"], ROWS[0]["Description"]);
});

test("meta- och ignorekolumner läggs till sist, en gång", () => {
  const built = buildImport({
    headers: HEADERS, rows: ROWS, idColumn: "Article number", descriptionColumn: "Description", approved: {},
  });
  assert.deepEqual(built.headers, [...HEADERS, "Meta title", "Meta description", "Ignore"]);
});

test("befintlig metakolumn fylls i stället för att dubbleras", () => {
  const withMeta = ["Article number", "Name", "Description", "Meta title", "meta description", "Ignore"];
  const built = buildImport({
    headers: withMeta,
    rows: [{ "Article number": "1002", Name: "N", Description: "" }],
    idColumn: "Article number", descriptionColumn: "Description",
    approved: { "1002": { description: "<p>Ny</p>", metaTitle: "T", metaDescription: "D" } },
  });
  assert.deepEqual(built.headers, withMeta);
  assert.equal(built.rows[0]["meta description"], "D");
});

test("exporten är semikolonseparerad med BOM och överlever tur och retur", () => {
  const { csv, included } = buildImportCsv({
    headers: HEADERS, rows: ROWS, idColumn: "Article number", descriptionColumn: "Description",
    approved: { "1001": { description: "<p>M&auml;ssing; med semikolon</p>", metaTitle: "T", metaDescription: "D" } },
  });
  assert.equal(included, 1);
  assert.equal(csv.charCodeAt(0), 0xfeff);
  const again = parseCsv(csv);
  assert.equal(again.delimiter, ";");
  assert.equal(again.rows[0]["Description"], "<p>M&auml;ssing; med semikolon</p>");
  assert.equal(again.rows[0]["Ignore"], "0");
  assert.equal(again.rows[1]["Ignore"], "1");
});

test("approvedFor tar bara med godkända som faktiskt har text", () => {
  const items: Record<string, WorkItem> = {
    a: { template: "reservdel", description: "<p>x</p>", approved: true, metaTitle: "T", metaDescription: "D" },
    b: { template: "reservdel", description: "<p>y</p>", approved: false },
    c: { template: "reservdel", approved: true },
  };
  assert.deepEqual(Object.keys(approvedFor(items)), ["a"]);
});

console.log(`${passed} test ok`);

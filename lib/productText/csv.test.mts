// Kör: npx tsx lib/productText/csv.test.mts
import assert from "node:assert/strict";
import {
  parseCsv, toCsv, detectDelimiter, guessColumns, checkIdColumn, isThin, textLength,
} from "./csv";

let passed = 0;
function test(name: string, fn: () => void) {
  try { fn(); passed++; }
  catch (e) { console.error(`FAIL: ${name}\n  ${e instanceof Error ? e.message : e}`); process.exitCode = 1; }
}

test("gissar semikolon", () => {
  assert.equal(detectDelimiter("a;b;c\n1;2;3"), ";");
});

test("gissar komma", () => {
  assert.equal(detectDelimiter("a,b,c\n1,2,3"), ",");
});

test("parsar rubriker och rader", () => {
  const r = parseCsv("Artikelnummer;Namn\n1001;Gasolflaska P11");
  assert.deepEqual(r.headers, ["Artikelnummer", "Namn"]);
  assert.equal(r.rows.length, 1);
  assert.equal(r.rows[0]["Namn"], "Gasolflaska P11");
});

test("hanterar BOM", () => {
  const r = parseCsv("﻿id;namn\n1;A");
  assert.deepEqual(r.headers, ["id", "namn"]);
});

test("hanterar citattecken, avgränsare och radbrytning i fält", () => {
  const r = parseCsv('id;text\n1;"rad ett\nrad två; med semikolon"');
  assert.equal(r.rows[0]["text"], "rad ett\nrad två; med semikolon");
});

test("hanterar escapade citattecken", () => {
  const r = parseCsv('id;text\n1;"han sa ""hej"""');
  assert.equal(r.rows[0]["text"], 'han sa "hej"');
});

test("hoppar över tomma rader", () => {
  const r = parseCsv("id;namn\n1;A\n\n2;B\n");
  assert.equal(r.rows.length, 2);
});

test("toCsv överlever tur och retur", () => {
  const input = 'id;text\n1;"a;b"\n2;enkel';
  const p = parseCsv(input);
  const again = parseCsv(toCsv(p.headers, p.rows, p.delimiter));
  assert.deepEqual(again.rows, p.rows);
});

test("gissar kolumner exakt", () => {
  const g = guessColumns(["Artikelnummer", "Produktnamn", "Beskrivning", "Produktgrupp"]);
  assert.equal(g.id, "Artikelnummer");
  assert.equal(g.name, "Produktnamn");
  assert.equal(g.description, "Beskrivning");
  assert.equal(g.group, "Produktgrupp");
});

test("gissar kolumner på delsträng", () => {
  const g = guessColumns(["Art.nr (unikt)", "Namn på produkt", "Lång beskrivning HTML"]);
  assert.equal(g.name, "Namn på produkt");
  assert.equal(g.description, "Lång beskrivning HTML");
});

test("saknad kolumn ger null", () => {
  assert.equal(guessColumns(["kolumn a", "kolumn b"]).id, null);
});

// Wikinggruppens riktiga export: ~25 rubriker där naiv delsträngsmatchning
// tidigare tog "Hidden (1/0)" som artikelnummer och "Meta description" som
// beskrivning. Dessa regressionstester ska hindra att det händer igen.
const WIKING_HEADERS = [
  "Article number", "Product name", "Description", "Meta description",
  "Meta title", "Category", "Supplier category", "Producer", "Supplier",
  "Hidden (1/0)", "Image 1", "Image 2", "Product URL", "Stock", "Stock status",
  "Price", "Price incl VAT", "VAT rate", "Campaign price", "Weight",
  "EAN", "Unit", "Sort order", "Created", "Updated",
];

test("Wikinggruppens rubriker mappas rätt", () => {
  const g = guessColumns(WIKING_HEADERS);
  assert.equal(g.id, "Article number");
  assert.equal(g.name, "Product name");
  assert.equal(g.description, "Description");
  assert.equal(g.group, "Category");
});

test("Hidden (1/0) väljs aldrig som artikelnummer", () => {
  // Utan en riktig artikelnummerkolumn ska id bli null, inte "Hidden (1/0)".
  const g = guessColumns(["Hidden (1/0)", "Product name", "Description"]);
  assert.equal(g.id, null);
});

test("Meta description väljs inte före Description", () => {
  // Även om Meta description står först i filen.
  const g = guessColumns(["Meta description", "Description"]);
  assert.equal(g.description, "Description");
});

test("NEVER_PARTIAL blockerar delsträng men inte exakt match", () => {
  // "Supplier category" får inte delsträngsmatchas mot grupp...
  assert.equal(guessColumns(["Supplier category"]).group, null);
  // ...men en exakt "Category" väljs fortfarande.
  assert.equal(guessColumns(["Category"]).group, "Category");
});

test("checkIdColumn: unika, ifyllda värden är ok", () => {
  const rows = [{ Art: "1001" }, { Art: "1002" }, { Art: "1003" }];
  const c = checkIdColumn(rows, "Art");
  assert.equal(c.ok, true);
  assert.equal(c.filled, 3);
  assert.equal(c.unique, 3);
  assert.deepEqual(c.examples, []);
});

test("checkIdColumn: dubbletter ger inte ok och listar exempel", () => {
  const rows = [{ Art: "0" }, { Art: "0" }, { Art: "0" }, { Art: "7" }];
  const c = checkIdColumn(rows, "Art");
  assert.equal(c.ok, false);
  assert.equal(c.filled, 4);
  assert.equal(c.unique, 2);
  assert.deepEqual(c.examples, ["0"]);
});

test("checkIdColumn: tomma värden ger inte ok", () => {
  const rows = [{ Art: "1001" }, { Art: "" }, { Art: "1003" }];
  const c = checkIdColumn(rows, "Art");
  assert.equal(c.ok, false);
  assert.equal(c.filled, 2);
});

test("textLength räknar utan html", () => {
  assert.equal(textLength("<p>Hej&nbsp;där</p>"), "Hej där".length);
});

test("isThin på kort och lång text", () => {
  assert.equal(isThin("<p>Kort</p>"), true);
  assert.equal(isThin("x".repeat(200)), false);
});

console.log(`${passed} test ok`);

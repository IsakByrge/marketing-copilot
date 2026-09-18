// Kör: npx tsx lib/productText/html.test.mts
//
// Det här är testet som skyddar shoppen mot trasiga tecken. 567 av 601
// artiklar har entitetskodad HTML; skriver vi tillbaka rå UTF-8 blir det
// "mÃ¤ssing" i butiken.
import assert from "node:assert/strict";
import {
  decodeEntities, encodeText, sanitizeHtml, toPlainText, visibleLength, wordCount,
} from "./html";

let passed = 0;
function test(name: string, fn: () => void) {
  try { fn(); passed++; }
  catch (e) { console.error(`FAIL: ${name}\n  ${e instanceof Error ? e.message : e}`); process.exitCode = 1; }
}

// ── Avkodning ───────────────────────────────────────────────

test("avkodar namngivna entiteter", () => {
  assert.equal(decodeEntities("m&auml;ssing"), "mässing");
  assert.equal(decodeEntities("&Aring;NGTRYCK"), "ÅNGTRYCK");
});

test("avkodar nbsp till mellanslag-tecknet", () => {
  assert.equal(decodeEntities("10&nbsp;bar"), "10 bar");
});

test("avkodar numeriska entiteter, decimalt och hexadecimalt", () => {
  assert.equal(decodeEntities("&#229;&#xE4;&#246;"), "åäö");
});

test("lämnar okänd entitet orörd i stället för att äta tecken", () => {
  assert.equal(decodeEntities("a&floop;b"), "a&floop;b");
});

test("avkodar amp, lt och gt", () => {
  assert.equal(decodeEntities("&lt;p&gt; &amp; mer"), "<p> & mer");
});

// ── Kodning ─────────────────────────────────────────────────

test("kodar svenska tecken till namngivna entiteter", () => {
  assert.equal(encodeText("mässing"), "m&auml;ssing");
  assert.equal(encodeText("Öppning"), "&Ouml;ppning");
});

test("kodar html-tecken så de inte blir taggar", () => {
  assert.equal(encodeText('a < b & c > d'), "a &lt; b &amp; c &gt; d");
});

test("ascii lämnas som det är", () => {
  assert.equal(encodeText("G1/4 gänga".replace("ä", "a")), "G1/4 ganga");
});

test("tecken utan namn kodas numeriskt", () => {
  assert.equal(encodeText("漢"), "&#28450;");
});

test("kodning och avkodning är omvändningar av varandra", () => {
  const s = 'Mässing, 10 bar, ø22 mm – "kort" & smidig';
  assert.equal(decodeEntities(encodeText(s)), s);
});

// ── Sanering ────────────────────────────────────────────────

test("behåller stycken och punktlistor", () => {
  const out = sanitizeHtml("<p>Ett</p><ul><li>A</li><li>B</li></ul>");
  assert.equal(out, "<p>Ett</p><ul><li>A</li><li>B</li></ul>");
});

test("kastar taggar vi inte tillåter, men behåller texten", () => {
  const out = sanitizeHtml('<div class="x"><h2>Rubrik</h2><p>Text</p></div>');
  assert.equal(out, "Rubrik<p>Text</p>");
});

test("kastar attribut, inklusive onclick och style", () => {
  const out = sanitizeHtml('<p style="color:red" onclick="alert(1)">Hej</p>');
  assert.equal(out, "<p>Hej</p>");
});

test("kastar script helt", () => {
  // Taggarna försvinner; innehållet blir ofarlig, kodad text.
  const out = sanitizeHtml("<script>alert('x')</script><p>Ok</p>");
  assert.ok(!out.includes("<script"));
  assert.ok(out.includes("<p>Ok</p>"));
});

test("länkar försvinner men ankartexten blir kvar", () => {
  assert.equal(sanitizeHtml('<a href="http://x.se">Läs mer</a>'), "L&auml;s mer");
});

test("saneringen kodar svenska tecken", () => {
  assert.equal(sanitizeHtml("<p>Mässing</p>"), "<p>M&auml;ssing</p>");
});

test("redan kodad indata dubbelkodas inte", () => {
  assert.equal(sanitizeHtml("<p>m&auml;ssing</p>"), "<p>m&auml;ssing</p>");
});

test("stänger taggar som modellen glömt stänga", () => {
  assert.equal(sanitizeHtml("<p>Ett<strong>Tva"), "<p>Ett<strong>Tva</strong></p>");
});

test("nästlar aldrig p eller li — det förra stycket stängs", () => {
  assert.equal(sanitizeHtml("<p>Ett<p>Tva"), "<p>Ett</p><p>Tva</p>");
  assert.equal(sanitizeHtml("<ul><li>A<li>B</ul>"), "<ul><li>A</li><li>B</li></ul>");
});

test("ignorerar sluttagg utan starttagg", () => {
  assert.equal(sanitizeHtml("Text</p>"), "Text");
});

test("ofullständig tagg sist blir text, inte trasig html", () => {
  const out = sanitizeHtml("<p>Ok</p><br");
  assert.ok(!out.includes("<br"));
  assert.ok(out.startsWith("<p>Ok</p>"));
});

// ── Mätning ─────────────────────────────────────────────────

test("visibleLength räknar avkodade tecken utan taggar", () => {
  assert.equal(visibleLength("<p>m&auml;ssing</p>"), "mässing".length);
});

test("toPlainText sätter mellanrum mellan block", () => {
  assert.equal(toPlainText("<p>Ett</p><p>Tva</p>"), "Ett Tva");
  assert.equal(toPlainText("<ul><li>A</li><li>B</li></ul>"), "A B");
});

test("tom text ger noll ord", () => {
  assert.equal(wordCount(""), 0);
  assert.equal(wordCount("<p></p>"), 0);
});

test("wordCount räknar ord, inte taggar", () => {
  assert.equal(wordCount("<p>Ett tva tre</p><ul><li>fyra</li></ul>"), 4);
});

console.log(`${passed} test ok`);

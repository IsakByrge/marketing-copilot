// Kör: npx tsx lib/content/content.test.mts
import assert from "node:assert/strict";
import {
  utanLankar, hashtag, byggHashtags, slutfordBildtext, instagramPrompt, planPostText,
} from "./instagram";
import {
  indexPublished, publishedChannels, unpublishedCount, shortDate, pubKey,
} from "./published";

let passed = 0;
function test(name: string, fn: () => void) {
  try { fn(); passed++; }
  catch (e) { console.error(`FAIL: ${name}\n  ${e instanceof Error ? e.message : e}`); process.exitCode = 1; }
}

test("länkar tas bort, och raden de stod ensamma på", () => {
  assert.equal(
    utanLankar("Kom förbi depån.\n\nhttps://shop.example.se\n\nVi ses."),
    "Kom förbi depån.\n\nVi ses.",
  );
  assert.equal(utanLankar("Se www.example.se idag"), "Se idag");
});

test("hashtags görs av ord, med svenska bokstäver kvar", () => {
  assert.equal(hashtag("Gasol i lösvikt"), "#gasolilösvikt");
  assert.equal(hashtag("A&B"), null);
});

test("hashtags: företag, produkt, och bara orter som står i texten", () => {
  const h = byggHashtags({
    companyName: "Testgas", produkt: "Gasolkamin",
    orter: ["Motala", "Köping", "Mjölby"],
    text: "Kom till depån i Motala. Vi har öppet i Norrköping också.",
  });
  assert.deepEqual(h, ["#testgas", "#gasolkamin", "#motala"]);
});

test("modellens egna hashtags, länkar och utropstecken städas bort", () => {
  const ut = slutfordBildtext("Värme i uterummet! #mys https://x.se", ["#testgas"]);
  assert.equal(ut, "Värme i uterummet.\n\n#testgas");
});

test("prompten förbjuder länkar och 'länk i bio', och bär källtexten", () => {
  const p = instagramPrompt('Rubrik\n\nText om kaminer """ slut');
  assert.match(p, /Ingen webbadress och ingen länk/);
  assert.match(p, /länk i bio/);
  assert.match(p, /Text om kaminer/);
  assert.equal(p.split('"""').length - 1, 2);
});

test("planinläggets text: rubrik, brödtext och uppmaning", () => {
  assert.equal(planPostText({ title: "R", text: "T", cta: "C" }), "R\n\nT\n\nC");
  assert.equal(planPostText({ text: "T" }), "T");
});

const rader = [
  { id: "1", item_key: "post-0", channel: "facebook", published_on: "2026-10-12" },
  { id: "2", item_key: "post-0", channel: "instagram", published_on: "2026-10-13" },
  { id: "3", item_key: "post-2", channel: "facebook", published_on: "2026-10-14" },
  { id: "4", item_key: "post-3", channel: "tiktok", published_on: "2026-10-14" },
  null, "skräp",
];

test("publiceringar indexeras per inlägg och kanal; okänd kanal hoppas över", () => {
  const ix = indexPublished(rader);
  assert.equal(Object.keys(ix).length, 3);
  assert.equal(ix[pubKey("post-0", "instagram")].published_on, "2026-10-13");
  assert.deepEqual(indexPublished("inte en lista"), {});
});

test("kanaler per inlägg och antal kvar att publicera", () => {
  const ix = indexPublished(rader);
  assert.deepEqual(publishedChannels(ix, "post-0"), ["facebook", "instagram"]);
  assert.deepEqual(publishedChannels(ix, "post-1"), []);
  assert.equal(unpublishedCount(ix, ["post-0", "post-1", "post-2", "post-3", "post-4"]), 3);
});

test("datumet visas kort och glider inte en dag", () => {
  assert.equal(shortDate("2026-10-12"), "12 okt");
  assert.equal(shortDate("trasigt"), "trasigt");
});

console.log(`${passed} test ok`);

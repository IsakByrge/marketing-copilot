// Kör: npx tsx lib/content/refine.test.mts
import assert from "node:assert/strict";
import {
  isRefineAction, instructionFor, refinePrompt, checkRefined, cleanRefined, splitHashtags,
} from "./refine";

let passed = 0;
function test(name: string, fn: () => void) {
  try { fn(); passed++; }
  catch (e) { console.error(`FAIL: ${name}\n  ${e instanceof Error ? e.message : e}`); process.exitCode = 1; }
}

test("handlingar och instruktioner", () => {
  assert.ok(isRefineAction("kortare") && !isRefineAction("längre"));
  assert.match(instructionFor("kortare")!, /hälften/);
  assert.equal(instructionFor("egen", "  x "), null, "för kort egen instruktion");
  assert.equal(instructionFor("egen", 5), null);
  assert.equal(instructionFor("egen", "Nämn  lördagsöppet")!, "Nämn lördagsöppet");
  assert.equal(instructionFor("egen", "a".repeat(500))!.length, 300);
});

test("prompten bär instruktion, text och veckans underlag, och kan inte stängas", () => {
  const p = refinePrompt({ text: 'Text """ slut', channel: "instagram", instruction: "Kortare", weekInput: "15 % på kaminer" });
  assert.match(p, /Instagram-bildtext/);
  assert.match(p, /15 % på kaminer/);
  assert.match(p, /Byt aldrig ett villkor/);
  assert.equal(p.split('"""').length - 1, 6);
});

const underlag = "Gasolkamin Alfa 1 990 kr. Depån i Motala, vardagar 07.30-17.30.";

test("en ny siffra flaggas, en känd gör det inte", () => {
  assert.deepEqual(checkRefined("Alfa kostar 1 990 kr.", underlag, 0), []);
  const w = checkRefined("Alfa kostar 1 490 kr, 20 % rabatt.", underlag, 0);
  assert.deepEqual(w.filter((x) => x.kind === "siffra").map((x) => x.phrase).sort(), ["1490", "20"]);
});

test("påhittat omdöme och klichéer flaggas", () => {
  const w = checkRefined("Våra kunder älskar Alfa. Inte bara varm utan också snygg.", underlag, 0);
  assert.ok(w.some((x) => x.kind === "kliche"));
  assert.ok(w.some((x) => x.kind === "socialt-bevis"));
});

test("brådska utan underlag flaggas, med datum i underlaget inte", () => {
  assert.ok(checkRefined("Passa på, erbjudandet gäller bara till söndag.", underlag, 0).some((x) => x.kind === "bradska"));
  assert.ok(!checkRefined("Passa på, erbjudandet gäller bara till söndag.", underlag + " Gäller till och med 18 okt.", 0).some((x) => x.kind === "bradska"));
});

test("modellens svar städas", () => {
  assert.equal(cleanRefined({ text: "Värme i uterummet!! Kom förbi! " }), "Värme i uterummet. Kom förbi.");
  assert.equal(cleanRefined({ text: "kort" }), null);
  assert.equal(cleanRefined("skräp"), null);
});

test("hashtaggarna hålls isär och kan läggas tillbaka", () => {
  assert.deepEqual(splitHashtags("Text här.\n\n#testgas #alfa"), { body: "Text här.", tags: "#testgas #alfa" });
  assert.deepEqual(splitHashtags("Text utan taggar."), { body: "Text utan taggar.", tags: "" });
});

console.log(`${passed} test ok`);

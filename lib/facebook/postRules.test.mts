// Kör: npx tsx lib/facebook/postRules.test.mts
//
// Två saker från riktig användning av Facebook-flödet:
// 1. Huvudtextens förstautkast landade på 65–80 ord när "normal" kräver
//    95, och skrevs om nästan varje gång. Nu skrivs det i tre delar.
// 2. "Fantastiskt erbjudande" och "innan erbjudandet tar slut" i ett
//    inlägg utan slutdatum. Tomt beröm och påhittad brådska.
import assert from "node:assert/strict";
import { detectInventedUrgency, detectCliches, deriveUserStatus, type UrgencyBasis } from "./quality";
import { draftSystem, draftUserPrompt, joinPostParts, coerceDraft, urgencyBasisFor } from "./specialist";
import type { FacebookBrief, FacebookSpecialistContext, FacebookQualityReview } from "@/app/content/facebook/types";

let passed = 0;
function test(name: string, fn: () => void) {
  try { fn(); passed++; }
  catch (e) { console.error(`FAIL: ${name}\n  ${e instanceof Error ? e.message : e}`); process.exitCode = 1; }
}

const NO_BASIS: UrgencyBasis = { deadline: undefined, briefText: "20 % på Mustang" };
const phrases = (text: string, basis = NO_BASIS) => detectInventedUrgency(text, basis).map((h) => h.phrase);

// ── Påhittad brådska ────────────────────────────────────────

test("den rapporterade frasen fångas när slutdatum saknas", () => {
  assert.deepEqual(
    phrases("Klicka in i vår webbshop och beställ din Mustang gasolgrill innan erbjudandet tar slut."),
    ["innan erbjudandet tar slut"],
  );
});

test("varianter av samma påstående fångas", () => {
  for (const [text, label] of [
    ["Beställ innan kampanjen går ut.", "innan erbjudandet tar slut"],
    ["Passa på medan det finns!", "passa på"],
    ["Missa inte det här.", "missa inte"],
    ["Sista chansen att fynda.", "sista chansen"],
    ["Gäller bara idag.", "bara idag"],
    ["Ett tidsbegränsat erbjudande.", "begränsad tid"],
    ["Skynda dig in i butiken.", "skynda dig"],
    ["Så länge lagret räcker.", "så länge lagret räcker"],
    ["Begränsat antal grillar.", "begränsat antal"],
    ["Snart slutsålda!", "snart slut"],
  ]) {
    assert.deepEqual(phrases(text), [label], text);
  }
});

test("med sista datum i underlaget är tidsbrådska tillåten", () => {
  const basis = { deadline: "31 maj", briefText: "20 % på Mustang" };
  assert.deepEqual(phrases("Passa på innan erbjudandet tar slut den 31 maj.", basis), []);
  // Men knapphet kräver fortfarande att underlaget talar om lager.
  assert.deepEqual(phrases("Så länge lagret räcker.", basis), ["så länge lagret räcker"]);
});

test("knapphet är tillåten när underlaget självt talar om lager eller antal", () => {
  assert.deepEqual(phrases("Så länge lagret räcker.", { deadline: undefined, briefText: "20 % så länge lagret räcker" }), []);
  assert.deepEqual(phrases("Begränsat antal.", { deadline: undefined, briefText: "Bara 10 exemplar" }), []);
});

test("säsong och vanliga ord är inte brådska", () => {
  for (const text of [
    "Inför grillsäsongen har vi 20 % på Mustang.",
    "Nu har vi 20 % på Mustang gasolgrill.",
    "Grillen passar på altanen.",       // "passar på" är inte "passa på"
    "Den här grillen tar slut på gasol långsamt.",
    "Kom in i butiken i helgen.",
  ]) {
    assert.deepEqual(phrases(text), [], text);
  }
});

test("urgencyBasisFor läser sista datum och uppdragets egna ord", () => {
  const b = urgencyBasisFor({ deadline: "31 maj", offer: "20 %", additionalNotes: "så länge lagret räcker" } as FacebookBrief);
  assert.equal(b.deadline, "31 maj");
  assert.match(b.briefText ?? "", /20 %.*lagret/);
});

// ── Tomt beröm ──────────────────────────────────────────────

test("'fantastiskt erbjudande' och släktingar är klichéer", () => {
  for (const text of ["Ett fantastiskt erbjudande.", "Otroligt pris just nu.", "Ett grymt tillfälle."]) {
    assert.ok(detectCliches(text).some((c) => c.phrase === "fantastiskt erbjudande"), text);
  }
  assert.equal(detectCliches("Nu 20 % på Mustang.").length, 0);
});

// ── Status ──────────────────────────────────────────────────

const checks = {
  companySpecific: true, audienceSpecific: true, clearHook: true, clearCustomerValue: true,
  credibleClaims: true, correctTone: true, clearCTA: true, appropriateLength: true,
  readableFormatting: true, noForbiddenClaims: true, naturalSwedish: true, honestSocialProof: true,
  noEmptyClosing: true, noBannedPhrases: true, mentionsProductAndOffer: true, noInventedUrgency: true,
};
const ready: FacebookQualityReview = { status: "ready", overallScore: 90, userStatus: "review", statusReason: "", checks, issues: [] };
const noFlags = { fabricatedSocialProof: false, forbiddenClaim: false, clicheCount: 0, missingCampaignTerms: [], inventedUrgency: [] };

test("påhittad brådska kan aldrig bli 'Publiceringsklar', och statusen säger vad", () => {
  assert.equal(deriveUserStatus(ready, noFlags).userStatus, "ready");
  const r = deriveUserStatus(ready, { ...noFlags, inventedUrgency: ["innan erbjudandet tar slut"] });
  assert.equal(r.userStatus, "review");
  assert.match(r.statusReason, /innan erbjudandet tar slut/);
  assert.equal(deriveUserStatus({ ...ready, checks: { ...checks, noInventedUrgency: false } }, noFlags).userStatus, "review");
});

// ── Prompten ────────────────────────────────────────────────

test("prompten förbjuder brådska och namnger båda fraserna", () => {
  const sys = draftSystem();
  assert.match(sys, /BRÅDSKA OCH KNAPPHET/);
  assert.match(sys, /"innan erbjudandet tar slut"/);
  assert.match(sys, /"Fantastiskt erbjudande"/);
  assert.match(sys, /bara när SISTA DATUM står i underlaget/);
});

const brief = {
  goal: "sell", productOrTopic: "Mustang gasolgrill", audience: "Villaägare", offer: "20 % på Mustang",
  desiredAction: "Beställ i webbshoppen", requestedAngle: "specialist_recommendation", length: "normal",
} as FacebookBrief;
const ctx = {
  company: {
    summary: "x", audiences: [], strengths: [], usps: [], tone: "rak", contentGuidelines: [],
    forbiddenClaims: [], preferredCallsToAction: [], verifiedSocialProof: [],
  },
} as FacebookSpecialistContext;

test("uppdraget har ordmål per del för vald längd", () => {
  const user = draftUserPrompt(brief, ctx);
  assert.match(user, /hook: 20–35 ord/);
  assert.match(user, /varde: 70–120 ord/);
  assert.match(user, /avslut: 20–35 ord/);
  assert.match(draftUserPrompt({ ...brief, length: "short" }, ctx), /varde: 35–60 ord/);
});

// ── Delarna ─────────────────────────────────────────────────

test("delarna sätts ihop i ordning med blankrad", () => {
  assert.equal(joinPostParts({ avslut: "C", hook: "A", varde: "B" }), "A\n\nB\n\nC");
  assert.equal(joinPostParts({ hook: " A ", varde: "", avslut: "C" }), "A\n\nC");
  assert.equal(joinPostParts({}), null);
  assert.equal(joinPostParts("text"), null);
  assert.equal(joinPostParts(["A"]), null);
});

test("utkastet läser delar och faller tillbaka på postText", () => {
  const variant = (extra: object) => ({
    id: "v", label: "L", angle: "A", callToAction: "Beställ", hashtags: ["grill"],
    imageBrief: { concept: "c", subject: "s", composition: "k", avoid: [] }, ...extra,
  });
  const draft = coerceDraft({
    recommendedAngle: "A", angleReason: "r",
    primary: variant({ delar: { hook: "Mustang gasolgrill nu.", varde: "20 % på Mustang i webbshoppen.", avslut: "Beställ i dag." } }),
    alternatives: [variant({ postText: "En hel text utan delar, men lång nog att räknas." })],
    assumptions: [], missingInformation: [],
  })!;
  assert.equal(draft.primary.postText, "Mustang gasolgrill nu.\n\n20 % på Mustang i webbshoppen.\n\nBeställ i dag.");
  assert.equal(draft.alternatives[0].postText, "En hel text utan delar, men lång nog att räknas.");
});

console.log(`${passed} test ok`);

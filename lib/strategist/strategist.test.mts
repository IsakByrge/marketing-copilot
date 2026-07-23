// Marketing Strategist — deterministiska tester för mapping, validering
// och beslutsträd (inte snapshots). Körs: npx tsx lib/strategist/strategist.test.mts
import { coerceAnalyze, coerceRecommend, MAX_FOLLOWUPS } from "./validate";
import { normalizeStrategyContext } from "./adapter";
import { mapStrategyToPrefill } from "../facebook/strategyPrefill";
import type { StrategistBrief, StrategyV2 } from "./types";
import type { StrategistCompanyContext } from "./companyContext";

let failures = 0;
function check(name: string, cond: boolean, detail = "") {
  if (cond) console.log("  ✓ " + name);
  else { failures++; console.log("  ✗ " + name + (detail ? " — " + detail : "")); }
}

const brief: StrategistBrief = { product: "grillsortiment", goalKey: "sell-product", goalTitle: "Sälj mer av en produkt" };

function ctx(over: Partial<StrategistCompanyContext> = {}): StrategistCompanyContext {
  return {
    hasBrain: true, companyName: "Gasolfyllarna", summary: "Säljer gasol och grillar.",
    audiences: ["villaägare", "husbilsägare"],
    products: [
      { name: "Gasolbyte", differentiators: ["snabbt"], objections: [], profitability: "high", priority: "high" },
      { name: "Greenville 3", differentiators: [], objections: [], profitability: "normal", priority: "normal" },
    ],
    strengths: ["kunnig personal"], usps: [], tone: ["jordnära"], contentGuidelines: [],
    forbiddenClaims: ["billigast i sverige"], proofPoints: [], seasons: ["grillsäsong"],
    competitors: [], marketingGoals: [], ...over,
  };
}

const validAnalysis = {
  campaignDiagnosis: "Fokus är brett.", recommendedFocus: "Fokusera på gasolbyte, inte hela sortimentet.",
  rationale: ["Tydligare köp"], identifiedGaps: [], alternativeDirections: [], confidence: "medium",
};

/* 1. Company Brain har målgrupp → generisk (text) målgruppsfråga ska släppas. */
console.log("1. Känd målgrupp → generisk målgruppsfråga släpps:");
{
  const r = coerceAnalyze({ analysis: validAnalysis, followUpQuestions: [
    { id: "q1", question: "Vilken målgrupp har ni?", reason: "x", answerType: "text", strategicImpact: "styr budskap", relatedField: "primaryAudience" },
  ] }, ctx(), brief);
  check("frågan släpptes", r.value?.followUpQuestions.length === 0, JSON.stringify(r.notes));
}

/* 3. Prioriteringsfråga (single_select) om målgrupp behålls även när målgrupper är kända. */
console.log("3. Målgruppsprioritering (select) behålls:");
{
  const r = coerceAnalyze({ analysis: validAnalysis, followUpQuestions: [
    { id: "q1", question: "Vilken grupp ska prioriteras?", reason: "x", answerType: "single_select", options: ["villaägare", "husbilsägare"], strategicImpact: "avgör kanal", relatedField: "primaryAudience" },
  ] }, ctx(), brief);
  check("prioriteringsfrågan behölls", r.value?.followUpQuestions.length === 1);
}

/* 2 + 6. Konkret erbjudande-/kritisk fråga med strategicImpact behålls. */
console.log("2/6. Konkret erbjudandefråga med impact behålls:");
{
  const r = coerceAnalyze({ analysis: validAnalysis, followUpQuestions: [
    { id: "q1", question: "Kan ni erbjuda ett tidsbegränsat pris före helgen?", reason: "skapar anledning att agera", answerType: "single_select", options: ["Ja", "Nej — bygg på bekvämlighet"], strategicImpact: "avgör om vi bygger på brådska eller bekvämlighet", relatedField: "offer" },
  ] }, ctx(), brief);
  check("frågan behölls med impact", r.value?.followUpQuestions.length === 1 && !!r.value?.followUpQuestions[0].strategicImpact);
}

/* 5. All info finns → 0 följdfrågor är giltigt. */
console.log("5. Noll följdfrågor är giltigt:");
{
  const r = coerceAnalyze({ analysis: validAnalysis, followUpQuestions: [] }, ctx(), brief);
  check("giltig analys utan frågor", !!r.value && r.hardIssues.length === 0 && r.value.followUpQuestions.length === 0);
}

/* 7. Duplicerade frågor (samma fält) → dedupas. */
console.log("7. Duplicerade frågor dedupas:");
{
  const r = coerceAnalyze({ analysis: validAnalysis, followUpQuestions: [
    { id: "q1", question: "Vill ni ha ett tidsbegränsat pris?", reason: "x", answerType: "single_select", options: ["Ja", "Nej"], strategicImpact: "brådska", relatedField: "offer" },
    { id: "q2", question: "Ska erbjudandet vara tidsbegränsat?", reason: "y", answerType: "single_select", options: ["Ja", "Nej"], strategicImpact: "brådska", relatedField: "offer" },
  ] }, ctx(), brief);
  check("bara en fråga per fält", r.value?.followUpQuestions.length === 1);
}

/* 12. Fler än maxantalet följdfrågor → trimmas deterministiskt. */
console.log("12. Följdfrågor trimmas till maxantal:");
{
  const fields = ["offer", "timing", "channel", "kpi", "risk", "geographicArea"];
  const qs = fields.map((f, i) => ({ id: "q" + i, question: "Fråga om " + f + "?", reason: "x", answerType: "single_select", options: ["A", "B"], strategicImpact: "påverkar " + f, relatedField: f }));
  const r = coerceAnalyze({ analysis: validAnalysis, followUpQuestions: qs }, ctx(), brief);
  check(`max ${MAX_FOLLOWUPS} frågor`, (r.value?.followUpQuestions.length ?? 99) === MAX_FOLLOWUPS, String(r.value?.followUpQuestions.length));
}

/* Widget-konsistens: single_select utan options → text. */
console.log("W. single_select utan options → text:");
{
  const r = coerceAnalyze({ analysis: validAnalysis, followUpQuestions: [
    { id: "q1", question: "Vad ska budskapet betona?", reason: "x", answerType: "single_select", options: [], strategicImpact: "budskap", relatedField: "mainMessage" },
  ] }, ctx(), brief);
  const q = r.value?.followUpQuestions[0];
  check("konverterad till text utan options", q?.answerType === "text" && !q?.options);
}

const validStrategy = {
  analysis: validAnalysis,
  strategy: {
    primaryGoal: "Öka antalet gasolbyten", primaryAudience: "villaägare i Norrköping", secondaryAudience: null,
    product: "Gasolbyte", offer: "Fyll flaskan medan du handlar", geographicArea: "Norrköping",
    mainMessage: "Slipp krånglet — byt gasol på vägen hem", valueProposition: "Snabbt och bekvämt",
    primaryCta: "Besök butiken", urgency: "inför grillhelgen",
    channelPriority: [{ channel: "facebook", reason: "stark lokal räckvidd" }, { channel: "e-post", reason: "återkommande kunder" }],
    risks: ["Erbjudandet saknar tidsgräns"], improvementOpportunities: ["Lägg till en deadline"], kpis: ["Antal gasolbyten", "Butiksbesök"], assumptions: ["Grillsäsong pågår"],
  },
  companyBrainReferences: ["Gasolbyte är prioriterad, hög lönsamhet"],
};

/* 8. Overifierat social proof → hårt problem. */
console.log("8. Overifierat social proof avvisas:");
{
  const bad = { ...validStrategy, strategy: { ...validStrategy.strategy, mainMessage: "Många nöjda kunder rekommenderar oss varje vecka" } };
  const r = coerceRecommend(bad, ctx({ proofPoints: [] }), brief, []);
  check("UnverifiedProof flaggat", r.hardIssues.includes("UnverifiedProof"), r.hardIssues.join(","));
  const ok = coerceRecommend(bad, ctx({ proofPoints: ["Verifierat Google-omdöme 4,8"] }), brief, []);
  check("tillåtet när proof finns", !ok.hardIssues.includes("UnverifiedProof"));
}

/* Förbjudet påstående → hårt problem. */
console.log("F. Förbjudet påstående avvisas:");
{
  const bad = { ...validStrategy, strategy: { ...validStrategy.strategy, valueProposition: "Vi är billigast i Sverige, garanterat" } };
  const r = coerceRecommend(bad, ctx(), brief, []);
  check("ForbiddenClaim flaggat", r.hardIssues.some((i) => i.startsWith("ForbiddenClaim")), r.hardIssues.join(","));
}

/* Giltig strategi → inga hårda problem + version 2. */
console.log("R. Giltig strategi validerar:");
{
  const r = coerceRecommend(validStrategy, ctx(), brief, []);
  check("inga hårda problem", r.hardIssues.length === 0, r.hardIssues.join(","));
  check("version 2 + kanaler + kpis", r.value?.version === 2 && (r.value?.strategy.channelPriority.length ?? 0) === 2 && (r.value?.strategy.kpis.length ?? 0) === 2);
}

/* Ofullständig strategi → hårda problem. */
console.log("M. Ofullständig strategi flaggas:");
{
  const r = coerceRecommend({ analysis: validAnalysis, strategy: {} }, ctx(), brief, []);
  check("saknad rekommendation/målgrupp/budskap/kanal/kpi", ["MissingRecommendation", "MissingPrimaryAudience", "MissingMessageOrCta", "UnmotivatedChannels", "MissingKpis"].every((h) => r.hardIssues.includes(h)), r.hardIssues.join(","));
}

/* 9. Äldre v1-strategi → FB-fält förifylls. */
console.log("9. v1-strategi öppnas i Facebook Specialist:");
{
  const v1 = { goalKey: "sell-product", product: "Greenville 3", audience: "villaägare", offer: "15% på tillbehör", price: "från 4 995 kr", geographicArea: "Västerås", deadline: "2026-08-01", cta: "Besök butiken" };
  const n = normalizeStrategyContext(v1);
  check("normaliserad v1", n.product === "Greenville 3" && n.audience === "villaägare" && n.cta === "Besök butiken");
  const p = mapStrategyToPrefill(v1);
  check("v1 förifyller 8 fält", ["Syfte", "Vad marknadsförs", "Målgrupp", "Erbjudande", "Pris", "Sista datum", "Geografiskt område", "Önskad CTA"].every((f) => p.filledFields.includes(f)), p.filledFields.join(","));
}

/* 10. Ny v2-strategi → FB-fält förifylls. */
console.log("10. v2-strategi öppnas i Facebook Specialist:");
{
  const v2: StrategyV2 = {
    version: 2,
    brief: { product: "Gasolbyte", goalKey: "sell-product", goalTitle: "Sälj mer av en produkt", period: { end: "2026-08-15" } },
    analysis: validAnalysis as StrategyV2["analysis"],
    strategy: validStrategy.strategy as StrategyV2["strategy"],
    answers: [], companyBrainReferences: [],
  };
  const n = normalizeStrategyContext(v2);
  check("normaliserad v2", n.goalKey === "sell-product" && n.product === "Gasolbyte" && n.audience === "villaägare i Norrköping" && n.deadline === "2026-08-15" && n.cta === "Besök butiken");
  const p = mapStrategyToPrefill(v2);
  check("v2 förifyller Syfte/produkt/målgrupp/erbjudande/datum/geografi/CTA", ["Syfte", "Vad marknadsförs", "Målgrupp", "Erbjudande", "Sista datum", "Geografiskt område", "Önskad CTA"].every((f) => p.filledFields.includes(f)), p.filledFields.join(","));
}

console.log(failures === 0 ? "\nOK — alla assertions passerade." : `\nMISSLYCKADES — ${failures} assertions föll.`);
process.exit(failures === 0 ? 0 : 1);

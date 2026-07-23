// ─────────────────────────────────────────────────────────────
// Deterministisk validering ovanpå modellens JSON. Säkra transformer
// (trimma till maxantal, dedupa, släppa frågor om redan känd stabil
// fakta, tvinga rätt widget/options) görs tyst. "Hårda" problem
// (trasigt schema, förbjudet påstående, overifierat social proof)
// returneras som issues → routen gör EN kontrollerad repair; ingen
// tyst fallback till generisk text.
// ─────────────────────────────────────────────────────────────
import type {
  AnalyzeResult, FollowUpQuestion, StrategyV2, StrategyCore, StrategyAnalysis,
  Confidence, AnswerType, StrategistBrief, FollowUpAnswer,
} from "./types";
import { STRATEGY_VERSION } from "./types";
import type { StrategistCompanyContext } from "./companyContext";

export const MAX_FOLLOWUPS = 4;

const s = (v: unknown, max = 600): string => (typeof v === "string" ? v : "").replace(/\s+/g, " ").trim().slice(0, max);
const sList = (v: unknown, n: number, max = 400): string[] =>
  Array.isArray(v) ? v.filter((x): x is string => typeof x === "string" && x.trim().length > 0).map((x) => s(x, max)).slice(0, n) : [];
const conf = (v: unknown): Confidence => (v === "high" || v === "medium" || v === "low" ? v : "medium");
const answerType = (v: unknown): AnswerType => (v === "single_select" || v === "multi_select" ? v : "text");

function norm(t: string): string { return t.toLowerCase().replace(/[^a-zåäö0-9 ]/g, "").replace(/\s+/g, " ").trim(); }

export interface ValidationOutput<T> {
  value: T | null;
  /** Hårda problem som kräver en modell-repair (inte tyst fallback). */
  hardIssues: string[];
  /** Säkra transformer som applicerades (telemetri). */
  notes: string[];
}

/* ── Förbjudna påståenden + overifierat social proof ─────────── */
function forbiddenHit(text: string, forbidden: string[]): string | null {
  const hay = text.toLowerCase();
  for (const raw of forbidden) {
    const p = raw.toLowerCase().trim();
    if (p.length >= 4 && hay.includes(p)) return raw;
  }
  return null;
}

const PROOF_PATTERNS: RegExp[] = [
  /\b(?:en av )?(?:våra|vår[at]?) (?:nöjda )?kund(?:er)?\b/i,
  /\bmånga (?:av (?:våra|era) )?kunder\b/i,
  /\bnöjda kunder\b/i,
  /\b(?:recension(?:er)?|omdöme[nt]?)\b/i,
  /\b(?:bäst i test|mest sålda|marknadsledande|prisbelönt|utsedd till)\b/i,
  /\b(?:över|mer än|fler än)\s*\d[\d\s.,]*\s*(?:nöjda\s*)?(?:kunder|recensioner|omdömen)\b/i,
];
function proofViolation(text: string, verifiedCount: number): boolean {
  if (verifiedCount > 0) return false;
  return PROOF_PATTERNS.some((re) => re.test(text));
}

/* ── Fas 1: analys + följdfrågor ──────────────────────────── */
export function coerceAnalyze(
  raw: unknown,
  ctx: StrategistCompanyContext,
  brief: StrategistBrief,
): ValidationOutput<AnalyzeResult> {
  const notes: string[] = [];
  const hardIssues: string[] = [];
  if (!raw || typeof raw !== "object") return { value: null, hardIssues: ["InvalidJson"], notes };
  const o = raw as Record<string, unknown>;
  const a = (o.analysis && typeof o.analysis === "object" ? o.analysis : {}) as Record<string, unknown>;

  const analysis: StrategyAnalysis = {
    campaignDiagnosis: s(a.campaignDiagnosis, 700),
    recommendedFocus: s(a.recommendedFocus, 500),
    rationale: sList(a.rationale, 4),
    identifiedGaps: sList(a.identifiedGaps, 4),
    alternativeDirections: sList(a.alternativeDirections, 4),
    confidence: conf(a.confidence),
  };
  if (!analysis.recommendedFocus || !analysis.campaignDiagnosis) hardIssues.push("MissingAnalysis");

  const rawQs = Array.isArray(o.followUpQuestions) ? o.followUpQuestions : [];
  const seen = new Set<string>();
  const seenFields = new Set<string>();
  const knownAudience = ctx.audiences.length > 0;
  const briefHasProduct = brief.product.trim().length > 0;
  const questions: FollowUpQuestion[] = [];

  for (const raw of rawQs) {
    if (!raw || typeof raw !== "object") continue;
    const q = raw as Record<string, unknown>;
    const question = s(q.question, 300);
    const strategicImpact = s(q.strategicImpact, 300);
    if (!question || !strategicImpact) { notes.push("dropped:missing-impact"); continue; }

    const key = norm(question);
    if (seen.has(key)) { notes.push("dropped:duplicate"); continue; }

    const relatedField = s(q.relatedField, 40) || "other";
    let at = answerType(q.answerType);
    let options = sList(q.options, 8, 120);

    // Widget/options-konsistens: select kräver ≥2 options, annars → text utan options.
    if ((at === "single_select" || at === "multi_select") && options.length < 2) { at = "text"; options = []; notes.push("fixed:select-without-options→text"); }
    if (at === "text") options = [];

    // Släpp frågor om redan känd stabil fakta:
    // - öppen målgruppsfråga när Company Brain redan har målgrupper (prioriteringsval med options tillåts).
    if (relatedField === "primaryAudience" && knownAudience && at === "text") { notes.push("dropped:known-audience"); continue; }
    // - öppen produktfråga när briefen redan anger produkten (prioriteringsval tillåts).
    if (relatedField === "product" && briefHasProduct && at === "text") { notes.push("dropped:known-product"); continue; }
    // Endast en fråga per strategifält (undvik omformuleringar).
    if (seenFields.has(relatedField)) { notes.push("dropped:same-field"); continue; }

    seen.add(key); seenFields.add(relatedField);
    questions.push({
      id: s(q.id, 24) || `q${questions.length + 1}`,
      question, reason: s(q.reason, 300) || strategicImpact, answerType: at,
      options: options.length ? options : undefined, strategicImpact, relatedField,
    });
    if (questions.length >= MAX_FOLLOWUPS) { notes.push("trimmed:max-followups"); break; }
  }

  return { value: { analysis, followUpQuestions: questions }, hardIssues, notes };
}

/* ── Fas 2: färdig strategi ───────────────────────────────── */
export function coerceRecommend(
  raw: unknown,
  ctx: StrategistCompanyContext,
  brief: StrategistBrief,
  answers: FollowUpAnswer[],
): ValidationOutput<StrategyV2> {
  const notes: string[] = [];
  const hardIssues: string[] = [];
  if (!raw || typeof raw !== "object") return { value: null, hardIssues: ["InvalidJson"], notes };
  const o = raw as Record<string, unknown>;
  const a = (o.analysis && typeof o.analysis === "object" ? o.analysis : {}) as Record<string, unknown>;
  const st = (o.strategy && typeof o.strategy === "object" ? o.strategy : {}) as Record<string, unknown>;

  const analysis: StrategyAnalysis = {
    campaignDiagnosis: s(a.campaignDiagnosis, 700),
    recommendedFocus: s(a.recommendedFocus, 500),
    rationale: sList(a.rationale, 4), identifiedGaps: sList(a.identifiedGaps, 4),
    alternativeDirections: sList(a.alternativeDirections, 4), confidence: conf(a.confidence),
  };

  const channelPriority = (Array.isArray(st.channelPriority) ? st.channelPriority : [])
    .map((c) => (c && typeof c === "object" ? { channel: s((c as Record<string, unknown>).channel, 40), reason: s((c as Record<string, unknown>).reason, 300) } : null))
    .filter((c): c is { channel: string; reason: string } => !!c && c.channel.length > 0)
    .slice(0, 5);

  const strategy: StrategyCore = {
    primaryGoal: s(st.primaryGoal, 200),
    primaryAudience: s(st.primaryAudience, 240),
    secondaryAudience: s(st.secondaryAudience, 240) || null,
    product: s(st.product, 240),
    offer: s(st.offer, 400),
    geographicArea: s(st.geographicArea, 160),
    mainMessage: s(st.mainMessage, 500),
    valueProposition: s(st.valueProposition, 500),
    primaryCta: s(st.primaryCta, 200),
    urgency: s(st.urgency, 240),
    channelPriority,
    risks: sList(st.risks, 6),
    improvementOpportunities: sList(st.improvementOpportunities, 6),
    kpis: sList(st.kpis, 4),
    assumptions: sList(st.assumptions, 6),
  };

  // Hårda krav: rekommendation + prioriterad målgrupp + budskap + CTA + motiverad kanal.
  if (!strategy.primaryGoal || !analysis.recommendedFocus) hardIssues.push("MissingRecommendation");
  if (!strategy.primaryAudience) hardIssues.push("MissingPrimaryAudience");
  if (!strategy.mainMessage || !strategy.primaryCta) hardIssues.push("MissingMessageOrCta");
  if (channelPriority.length === 0 || channelPriority.some((c) => !c.reason)) hardIssues.push("UnmotivatedChannels");
  if (strategy.kpis.length === 0) hardIssues.push("MissingKpis");

  // Förbjudna påståenden + overifierat social proof i strategitexten.
  const blob = [strategy.mainMessage, strategy.valueProposition, strategy.offer, strategy.primaryCta, ...strategy.improvementOpportunities, ...strategy.risks].join(" \n ");
  const fh = forbiddenHit(blob, ctx.forbiddenClaims);
  if (fh) hardIssues.push(`ForbiddenClaim:${fh}`);
  if (proofViolation(blob, ctx.proofPoints.length)) hardIssues.push("UnverifiedProof");

  const value: StrategyV2 = {
    version: STRATEGY_VERSION,
    brief,
    analysis,
    strategy,
    answers,
    companyBrainReferences: sList(o.companyBrainReferences, 12),
  };
  return { value, hardIssues, notes };
}

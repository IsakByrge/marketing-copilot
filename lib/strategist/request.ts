// ─────────────────────────────────────────────────────────────
// Parsning/validering av inkommande request-bodies (klient → route).
// Endast strukturell normalisering — innehållsanalys sker i validate.ts.
// ─────────────────────────────────────────────────────────────
import type { StrategistBrief, FollowUpAnswer, StrategyAnalysis } from "./types";
import { CAMPAIGN_GOALS, GOAL_TITLES } from "./goals";

const clip = (v: unknown, n: number): string => (typeof v === "string" ? v : "").replace(/\r/g, "").trim().slice(0, n);

export function parseBrief(input: unknown): StrategistBrief | null {
  if (!input || typeof input !== "object") return null;
  const o = input as Record<string, unknown>;
  const goalKey = typeof o.goalKey === "string" && (CAMPAIGN_GOALS as readonly string[]).includes(o.goalKey)
    ? o.goalKey as StrategistBrief["goalKey"] : null;
  if (!goalKey) return null;
  const product = clip(o.product, 320);
  if (!product) return null;

  const period = o.period && typeof o.period === "object"
    ? {
        start: clip((o.period as Record<string, unknown>).start, 20) || undefined,
        end: clip((o.period as Record<string, unknown>).end, 20) || undefined,
      }
    : undefined;

  return {
    product,
    goalKey,
    goalTitle: GOAL_TITLES[goalKey] ?? clip(o.goalTitle, 120) ?? goalKey,
    offer: clip(o.offer, 400) || undefined,
    period: period && (period.start || period.end) ? period : undefined,
    geographicArea: clip(o.geographicArea, 160) || undefined,
    additionalContext: clip(o.additionalContext, 900) || undefined,
  };
}

export function parseAnswers(input: unknown): FollowUpAnswer[] {
  if (!Array.isArray(input)) return [];
  return input
    .filter((x): x is Record<string, unknown> => !!x && typeof x === "object")
    .map((a) => ({
      questionId: clip(a.questionId, 24),
      question: clip(a.question, 300),
      answer: clip(a.answer, 600),
      relatedField: clip(a.relatedField, 40) || "other",
    }))
    .filter((a) => a.answer.length > 0)
    .slice(0, 8);
}

export function parseAnalysis(input: unknown): StrategyAnalysis | null {
  if (!input || typeof input !== "object") return null;
  const o = input as Record<string, unknown>;
  const focus = clip(o.recommendedFocus, 500);
  if (!focus) return null;
  const list = (v: unknown, n: number): string[] =>
    Array.isArray(v) ? v.filter((x): x is string => typeof x === "string" && x.trim().length > 0).map((x) => clip(x, 400)).slice(0, n) : [];
  const c = o.confidence;
  return {
    campaignDiagnosis: clip(o.campaignDiagnosis, 700),
    recommendedFocus: focus,
    rationale: list(o.rationale, 4),
    identifiedGaps: list(o.identifiedGaps, 4),
    alternativeDirections: list(o.alternativeDirections, 4),
    confidence: c === "high" || c === "medium" || c === "low" ? c : "medium",
  };
}

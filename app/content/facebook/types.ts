// ─────────────────────────────────────────────────────────────
// Content Engine 1.0 — Facebook Specialist
// Delade, strikt typade datamodeller för Facebook-flödet. Rena
// typer + validering, körbara på både klient (specialistvyn) och
// server (API-routen). INGA server-importer här (ingen openai,
// ingen next/headers) — filen måste kunna buntas in i en klient-
// komponent. Prompt-byggande och modellanrop lever i
// lib/facebook/specialist.ts (server-only).
// ─────────────────────────────────────────────────────────────
import type { ProfitabilityLevel, BusinessPriority } from "@/app/_shared/companyBrain";

/* ── Enums ───────────────────────────────────────────────── */

export type FacebookContentGoal =
  | "sell"
  | "traffic"
  | "leads"
  | "store_visits"
  | "inform"
  | "launch"
  | "engagement"
  | "other";

export type FacebookAngle =
  | "customer_value"
  | "problem_solution"
  | "quality"
  | "local_service"
  | "urgency"
  | "social_proof"
  | "behind_the_scenes"
  | "specialist_recommendation";

export type FacebookLength = "short" | "normal" | "detailed";

export const FACEBOOK_GOALS: readonly FacebookContentGoal[] =
  ["sell", "traffic", "leads", "store_visits", "inform", "launch", "engagement", "other"];
export const FACEBOOK_ANGLES: readonly FacebookAngle[] =
  ["customer_value", "problem_solution", "quality", "local_service", "urgency", "social_proof", "behind_the_scenes", "specialist_recommendation"];
export const FACEBOOK_LENGTHS: readonly FacebookLength[] = ["short", "normal", "detailed"];

/* ── Brief (klientens indata) ────────────────────────────── */

export interface FacebookBrief {
  goal: FacebookContentGoal;
  productOrTopic: string;
  audience: string;
  offer?: string;
  price?: string;
  deadline?: string;
  geographicArea?: string;
  desiredAction: string;
  requestedAngle: FacebookAngle;
  toneOverride?: string;
  length: FacebookLength;
  additionalNotes?: string;
  campaignStrategyId?: string;
  productId?: string;
}

/* ── Minimerad, säker AI-kontext (byggs server-side ur Brain) ─
   Inga interna ID:n, inga exakta ekonomiska siffror, inget
   användar-ID, inga hela databasrader. */

export interface FacebookSpecialistContext {
  company: {
    summary: string;
    audiences: string[];
    strengths: string[];
    usps: string[];
    tone: string;
    contentGuidelines: string[];
    forbiddenClaims: string[];
    preferredCallsToAction: string[];
  };
  selectedProduct?: {
    name: string;
    category?: string;
    description?: string;
    customerProblem?: string;
    primaryAudience?: string;
    differentiators: string[];
    objections: string[];
    profitability: ProfitabilityLevel;
    priority: BusinessPriority;
    seasonality?: string;
    availabilityNotes?: string;
  };
  campaignStrategy?: {
    goal: string;
    audience?: string;
    mainMessage?: string;
    offer?: string;
    channels?: string[];
    cta?: string;
    risks?: string[];
    avoid?: string[];
  };
}

/* ── Resultat (server → klient) ──────────────────────────── */

export interface FacebookImageBrief {
  concept: string;
  subject: string;
  composition: string;
  textOverlay?: string;
  avoid: string[];
}

export interface FacebookPostVariant {
  id: string;
  label: string;
  angle: string;
  postText: string;
  callToAction: string;
  imageBrief: FacebookImageBrief;
  hashtags: string[];
}

export interface FacebookQualityChecks {
  companySpecific: boolean;
  audienceSpecific: boolean;
  clearHook: boolean;
  clearCustomerValue: boolean;
  credibleClaims: boolean;
  correctTone: boolean;
  clearCTA: boolean;
  appropriateLength: boolean;
  readableFormatting: boolean;
  noForbiddenClaims: boolean;
}

export interface FacebookQualityReview {
  status: "ready" | "needs_revision" | "blocked";
  overallScore: number;
  checks: FacebookQualityChecks;
  issues: string[];
  revisionSummary?: string;
}

export interface FacebookSpecialistResult {
  recommendedAngle: string;
  angleReason: string;
  primary: FacebookPostVariant;
  alternatives: FacebookPostVariant[];
  qualityReview: FacebookQualityReview;
  assumptions: string[];
  missingInformation: string[];
}

/** Blockerat läge — avgörande information saknas, ingen text genereras.
 *  Specialisten ställer exakt EN konkret följdfråga i stället. */
export interface FacebookBlockedResponse {
  status: "blocked";
  question: string;
  missingInformation: string[];
}

export type FacebookApiResponse =
  | ({ status: "ok" } & FacebookSpecialistResult)
  | FacebookBlockedResponse
  | { status: "error"; error: string };

/* ── Fältgränser (säkerhet + rimlig kostnad) ─────────────── */

export const FB_LIMITS = {
  PRODUCT_OR_TOPIC: 320,
  AUDIENCE: 320,
  OFFER: 320,
  PRICE: 60,
  DEADLINE: 60,
  GEO: 120,
  DESIRED_ACTION: 300,
  TONE_OVERRIDE: 120,
  NOTES: 900,
  ID: 80,
  POST_TEXT: 2600,
  CTA: 220,
  HASHTAG: 40,
  MAX_HASHTAGS: 3,
  IMG_FIELD: 400,
  ISSUE: 320,
  MAX_ISSUES: 8,
} as const;

/* ── UI-alternativ (svenska etiketter) ───────────────────── */

export const GOAL_OPTIONS: { value: FacebookContentGoal; label: string; hint: string }[] = [
  { value: "sell", label: "Sälja en produkt eller tjänst", hint: "Driva köp eller bokning" },
  { value: "traffic", label: "Driva trafik", hint: "Få fler till webb/sida" },
  { value: "leads", label: "Få fler förfrågningar", hint: "Offert eller kontakt" },
  { value: "store_visits", label: "Få fler butiksbesök", hint: "Besök på plats" },
  { value: "inform", label: "Informera", hint: "Berätta något viktigt" },
  { value: "launch", label: "Lansera något nytt", hint: "Nyhet eller premiär" },
  { value: "engagement", label: "Skapa engagemang", hint: "Reaktioner och samtal" },
  { value: "other", label: "Annat", hint: "Beskriv själv i noteringen" },
];

export const ANGLE_OPTIONS: { value: FacebookAngle; label: string }[] = [
  { value: "specialist_recommendation", label: "Specialistens rekommendation" },
  { value: "customer_value", label: "Kundnytta" },
  { value: "problem_solution", label: "Problem och lösning" },
  { value: "quality", label: "Produktkvalitet" },
  { value: "local_service", label: "Lokal service" },
  { value: "urgency", label: "Brådska" },
  { value: "social_proof", label: "Socialt bevis" },
  { value: "behind_the_scenes", label: "Bakom kulisserna" },
];

export const LENGTH_OPTIONS: { value: FacebookLength; label: string; hint: string; recommended?: boolean }[] = [
  { value: "normal", label: "Normal", hint: "Ca 100–220 ord — specialistens rekommendation", recommended: true },
  { value: "short", label: "Kort", hint: "Ca 50–100 ord" },
  { value: "detailed", label: "Utförlig", hint: "Ca 180–350 ord" },
];

export const TONE_SUGGESTIONS = ["kunnig", "personlig", "inspirerande", "direkt", "varm", "återhållsam"] as const;

/* ── Etikettöversättning för visning ─────────────────────── */

export const GOAL_LABEL: Record<FacebookContentGoal, string> =
  Object.fromEntries(GOAL_OPTIONS.map((o) => [o.value, o.label])) as Record<FacebookContentGoal, string>;
export const ANGLE_LABEL: Record<FacebookAngle, string> =
  Object.fromEntries(ANGLE_OPTIONS.map((o) => [o.value, o.label])) as Record<FacebookAngle, string>;

/* ── Validering av inkommande brief ──────────────────────── */

const clip = (v: unknown, max: number): string =>
  (typeof v === "string" ? v : "").replace(/\r/g, "").trim().slice(0, max);

/**
 * Normaliserar en okänd request-body till ett FacebookBrief.
 * Returnerar { ok:false } endast vid strukturellt trasig data (fel enum,
 * fel typ). Saknade INNEHÅLLSfält (produkt/målgrupp/handling) är tillåtna
 * här — de fångas av den kritiska-fält-kontrollen i routen och leder till
 * en följdfråga, inte ett 400-fel.
 */
export function validateBrief(input: unknown): { ok: true; brief: FacebookBrief } | { ok: false; error: string } {
  if (!input || typeof input !== "object") return { ok: false, error: "Ogiltig förfrågan." };
  const o = input as Record<string, unknown>;

  const goal = o.goal;
  if (typeof goal !== "string" || !FACEBOOK_GOALS.includes(goal as FacebookContentGoal))
    return { ok: false, error: "Ogiltigt syfte." };

  const requestedAngle = typeof o.requestedAngle === "string" && FACEBOOK_ANGLES.includes(o.requestedAngle as FacebookAngle)
    ? (o.requestedAngle as FacebookAngle)
    : "specialist_recommendation";

  const length = typeof o.length === "string" && FACEBOOK_LENGTHS.includes(o.length as FacebookLength)
    ? (o.length as FacebookLength)
    : "normal";

  const brief: FacebookBrief = {
    goal: goal as FacebookContentGoal,
    productOrTopic: clip(o.productOrTopic, FB_LIMITS.PRODUCT_OR_TOPIC),
    audience: clip(o.audience, FB_LIMITS.AUDIENCE),
    offer: clip(o.offer, FB_LIMITS.OFFER) || undefined,
    price: clip(o.price, FB_LIMITS.PRICE) || undefined,
    deadline: clip(o.deadline, FB_LIMITS.DEADLINE) || undefined,
    geographicArea: clip(o.geographicArea, FB_LIMITS.GEO) || undefined,
    desiredAction: clip(o.desiredAction, FB_LIMITS.DESIRED_ACTION),
    requestedAngle,
    toneOverride: clip(o.toneOverride, FB_LIMITS.TONE_OVERRIDE) || undefined,
    length,
    additionalNotes: clip(o.additionalNotes, FB_LIMITS.NOTES) || undefined,
    campaignStrategyId: clip(o.campaignStrategyId, FB_LIMITS.ID) || undefined,
    productId: clip(o.productId, FB_LIMITS.ID) || undefined,
  };

  return { ok: true, brief };
}

/** Ordräkning för längdkontroll (deterministisk, inte AI). */
export function wordCount(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

export const LENGTH_WORDS: Record<FacebookLength, { min: number; max: number }> = {
  short: { min: 45, max: 110 },
  normal: { min: 95, max: 230 },
  detailed: { min: 170, max: 360 },
};

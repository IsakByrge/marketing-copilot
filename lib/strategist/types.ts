// ─────────────────────────────────────────────────────────────
// Marketing Strategist 2.0 — delade, strikt typade datamodeller.
// Körbara på både klient och server (rena typer, inga runtime-
// importer utom CampaignGoal-typen). Strategin lagras i den
// befintliga campaign_strategies.strategy_context-JSONB:n som ett
// StrategyV2-objekt (version: 2). v1-rader läses via adapter.ts.
// ─────────────────────────────────────────────────────────────
import type { CampaignGoal } from "@/app/campaign-builder/types";

export const STRATEGY_VERSION = 2 as const;

/* ── Fas 1: brief (användarens grundunderlag) ─────────────── */
export interface StrategistBrief {
  /** Vad som ska marknadsföras (produkt/tjänst/erbjudande). */
  product: string;
  /** Affärsmål (återanvänder CampaignGoal-enumet). */
  goalKey: CampaignGoal;
  /** Läsbar måltitel. */
  goalTitle: string;
  /** Konkret erbjudande om det finns (frivilligt). */
  offer?: string;
  /** Kampanjperiod (frivilligt). ISO yyyy-mm-dd. */
  period?: { start?: string; end?: string };
  /** Geografiskt område om användaren anger det (annars härlett/tomt). */
  geographicArea?: string;
  /** Fritext: något särskilt AI:n ska ta hänsyn till. */
  additionalContext?: string;
}

/* ── Fas 3: adaptiva följdfrågor ──────────────────────────── */
export type AnswerType = "text" | "single_select" | "multi_select";

export interface FollowUpQuestion {
  id: string;
  question: string;
  /** Varför frågan ställs — visas för användaren. */
  reason: string;
  answerType: AnswerType;
  /** Krävs för single_select/multi_select, förbjudet för text. */
  options?: string[];
  /** Vad svaret konkret kan förändra i strategin. */
  strategicImpact: string;
  /** Vilket strategifält frågan påverkar (t.ex. "primaryAudience", "offer"). */
  relatedField: string;
}

export interface FollowUpAnswer {
  questionId: string;
  question: string;
  answer: string;
  relatedField: string;
}

/* ── Fas 2: strategisk analys ─────────────────────────────── */
export type Confidence = "low" | "medium" | "high";

export interface StrategyAnalysis {
  /** Nykter diagnos av kampanjen som den ser ut i briefen. */
  campaignDiagnosis: string;
  /** Den rekommenderade riktningen/hypotesen — FÅR utmana användarens idé. */
  recommendedFocus: string;
  /** 2–4 konkreta resonemang. */
  rationale: string[];
  /** Verkliga informationsluckor som påverkar strategin. */
  identifiedGaps: string[];
  /** Alternativa riktningar värda att överväga. */
  alternativeDirections: string[];
  confidence: Confidence;
}

export interface AnalyzeResult {
  analysis: StrategyAnalysis;
  /** 0–4 följdfrågor, deterministiskt begränsade. */
  followUpQuestions: FollowUpQuestion[];
}

/* ── Fas 4: rekommenderad strategi ────────────────────────── */
export interface ChannelPriority {
  channel: string;
  reason: string;
}

export interface StrategyCore {
  primaryGoal: string;
  primaryAudience: string;
  secondaryAudience?: string | null;
  product: string;
  offer: string;
  geographicArea: string;
  mainMessage: string;
  valueProposition: string;
  primaryCta: string;
  urgency: string;
  channelPriority: ChannelPriority[];
  risks: string[];
  improvementOpportunities: string[];
  kpis: string[];
  assumptions: string[];
}

/** Hela den strukturerade strategin som sparas i strategy_context. */
export interface StrategyV2 {
  version: 2;
  brief: StrategistBrief;
  analysis: StrategyAnalysis;
  strategy: StrategyCore;
  answers: FollowUpAnswer[];
  /** Vilka Company Brain-fakta rekommendationen lutar sig mot (spårbarhet). */
  companyBrainReferences: string[];
}

/* ── Normaliserad kontext (adapter-utdata, v1+v2) ─────────── */
/** Den platta formen som Facebook Specialist konsumerar oavsett strategiversion. */
export interface NormalizedStrategyContext {
  goal?: string;        // läsbar måltitel
  goalKey?: string;     // CampaignGoal-enum
  product?: string;
  audience?: string;
  secondaryAudience?: string;
  offer?: string;
  price?: string;       // endast v1
  geographicArea?: string;
  deadline?: string;    // v1 deadline / v2 period.end
  cta?: string;
  mainMessage?: string;
  valueProposition?: string;
  urgency?: string;
  channels?: string[];
  risks?: string[];
  assumptions?: string[];
}

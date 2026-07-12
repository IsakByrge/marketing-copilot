// ─────────────────────────────────────────────────────────────
// Dynamic Interview Engine — delade typer, konstanter och validering.
// Importeras av både API-routen (server) och campaign-builder (klient)
// så att kontraktet är exakt detsamma på båda sidor.
// ─────────────────────────────────────────────────────────────

export type InterviewAction = "confirm" | "deepen" | "challenge" | "skip" | "finish";

export type ReasonCategory =
  | "missing_information"
  | "weak_assumption"
  | "contradiction"
  | "strategic_opportunity"
  | "sufficient_information";

export interface InterviewDecision {
  action: InterviewAction;
  response: string;
  reasonCategory: ReasonCategory;
  nextQuestion?: string;
  targetField?: string;
  canRecommend: boolean;
  missingCriticalInformation: string[];
}

/* ── Begränsningar (säkerhet + kostnad) ─────────────────────── */
export const LIMITS = {
  /** Max antal AI-anrop per intervju (frontend + backend enforcar båda). */
  MAX_AI_CALLS: 14,
  /** Max längd på ett enskilt användarsvar som skickas till modellen. */
  MAX_ANSWER_LEN: 700,
  /** Max antal historik-turer som skickas med. */
  MAX_HISTORY: 12,
  /** Max längd per historik-fält. */
  MAX_HISTORY_FIELD_LEN: 300,
  /** Timeout för modellanropet (ms). */
  TIMEOUT_MS: 15000,
  /** Max längd på modellens svarstext som visas. */
  MAX_RESPONSE_LEN: 600,
} as const;

const ACTIONS: readonly InterviewAction[] = ["confirm", "deepen", "challenge", "skip", "finish"];
const REASONS: readonly ReasonCategory[] = [
  "missing_information", "weak_assumption", "contradiction", "strategic_opportunity", "sufficient_information",
];

/** Innehållslösa fraser som regel 2 förbjuder som ensamt svar. */
const FILLER = new Set([
  "bra", "intressant", "tack", "ok", "okej", "toppen", "perfekt",
  "bra svar", "spännande", "noterat", "härligt", "kul", "trevligt", "juste",
]);

export function isFillerResponse(s: string): boolean {
  const t = s.trim().toLowerCase().replace(/[.!?…]+$/g, "").trim();
  return t.length === 0 || FILLER.has(t);
}

/**
 * Defensiv validering av modellens JSON till en säker InterviewDecision.
 * Returnerar null om något är strukturellt fel — anroparen faller då tillbaka.
 */
export function validateDecision(input: unknown): InterviewDecision | null {
  if (!input || typeof input !== "object") return null;
  const o = input as Record<string, unknown>;

  const action = o.action;
  if (typeof action !== "string" || !ACTIONS.includes(action as InterviewAction)) return null;

  const reasonCategory = o.reasonCategory;
  if (typeof reasonCategory !== "string" || !REASONS.includes(reasonCategory as ReasonCategory)) return null;

  if (typeof o.response !== "string") return null;
  const response = o.response.trim();
  if (response.length < 3 || isFillerResponse(response)) return null;

  if (typeof o.canRecommend !== "boolean") return null;

  const missingCriticalInformation = Array.isArray(o.missingCriticalInformation)
    ? o.missingCriticalInformation.filter((x): x is string => typeof x === "string" && x.trim().length > 0).slice(0, 8)
    : [];

  const nextQuestion = typeof o.nextQuestion === "string" ? o.nextQuestion.trim() : undefined;
  const targetField = typeof o.targetField === "string" && o.targetField.trim() ? o.targetField.trim() : undefined;

  // Alla actions utom finish MÅSTE ha en konkret fråga (regel 4).
  if (action !== "finish" && (!nextQuestion || nextQuestion.length < 3)) return null;

  return {
    action: action as InterviewAction,
    response: response.slice(0, LIMITS.MAX_RESPONSE_LEN),
    reasonCategory: reasonCategory as ReasonCategory,
    nextQuestion: action === "finish" ? undefined : nextQuestion,
    targetField,
    canRecommend: o.canRecommend,
    missingCriticalInformation,
  };
}

/* ── Request-kontrakt (frontend → API) ──────────────────────── */
export interface InterviewField {
  key: string;
  label: string;
  value?: string;
}

export interface InterviewRequest {
  goal: string;
  goalTitle: string;
  /** Endast relevanta företagsfält — aldrig hela profilen. */
  company?: {
    companyName?: string;
    products?: string[];
    customers?: string[];
    bestCustomer?: string;
  };
  lastQuestion: string;
  lastAnswer: string;
  history: { question: string; answer: string }[];
  answeredFields: InterviewField[];
  unansweredFields: InterviewField[];
  callCount: number;
}

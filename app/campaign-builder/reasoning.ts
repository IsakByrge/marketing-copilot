// ─────────────────────────────────────────────────────────────
// Reasoning Engine — delade typer, konstanter och validering.
// Importeras av både API-routen (server) och campaign-builder (klient)
// så att kontraktet är exakt detsamma på båda sidor.
//
// Ersätter den tidigare Dynamic Interview Engine (confirm/deepen/
// challenge/skip/finish, fältkö). Motorn resonerar nu i strategiska
// områden (TargetArea) snarare än en fast fältkö, kan visa tidiga
// insikter (surface_insight) och strategiska varningar (concern),
// och kan omdirigera när valt mål inte matchar det verkliga problemet.
// ─────────────────────────────────────────────────────────────

export type ReasoningAction =
  | "ask"
  | "clarify"
  | "challenge"
  | "surface_insight"
  | "redirect"
  | "finish";

export type TargetArea =
  | "goal"
  | "offer"
  | "audience"
  | "problem"
  | "differentiation"
  | "trust"
  | "urgency"
  | "profitability"
  | "availability"
  | "conversion"
  | "measurement"
  | "channel"
  | "other";

export interface ReasoningInsight {
  title: string;
  text: string;
  confidence: "low" | "medium" | "high";
  /** Konkreta svar eller profiluppgifter insikten bygger på — får aldrig vara tom. */
  basedOn: string[];
}

export interface ReasoningConcern {
  title: string;
  text: string;
  severity: "low" | "medium" | "high";
}

export interface ReasoningDecision {
  action: ReasoningAction;
  /** Kort kommentar som visas för användaren. Aldrig bara "Bra"/"Intressant". */
  message: string;
  /** Nästa fråga — krävs för alla actions utom "finish". */
  nextQuestion?: string;
  /** Strategiskt område frågan gäller. */
  targetArea?: TargetArea;
  /** Kort, användarsynlig anledning till varför frågan ställs (≤ två meningar). */
  questionReason?: string;
  /** En tidig, väl grundad observation — kan visas separat i UI:t. */
  insight?: ReasoningInsight;
  /** Upptäckt motsägelse eller svaghet. */
  concern?: ReasoningConcern;
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
  /** Max längd på modellens meddelandetext som visas. */
  MAX_MESSAGE_LEN: 500,
  /** Max längd på nästa fråga. */
  MAX_QUESTION_LEN: 300,
  /** Max längd på den korta motiveringen till varför frågan ställs. */
  MAX_QUESTION_REASON_LEN: 220,
  /** Max längd på insikt/oro-text. */
  MAX_NOTE_TEXT_LEN: 400,
  /**
   * Hårt tak på hur många frågor som får ställas inom samma strategiska
   * område — modellen instrueras att hålla sig till detta själv, men
   * gpt-4o-mini följer inte alltid en numerisk regel i fritext perfekt.
   * Servern tvingar därför fram "finish" om taket ändå överskrids, så en
   * intervju aldrig kan fastna i en loop kring ett enda område.
   */
  MAX_ASKS_PER_AREA: 2,
} as const;

const ACTIONS: readonly ReasoningAction[] = ["ask", "clarify", "challenge", "surface_insight", "redirect", "finish"];
const AREAS: readonly TargetArea[] = [
  "goal", "offer", "audience", "problem", "differentiation", "trust",
  "urgency", "profitability", "availability", "conversion", "measurement",
  "channel", "other",
];
const CONFIDENCE = ["low", "medium", "high"] as const;
const SEVERITY = ["low", "medium", "high"] as const;

/** Innehållslösa fraser som aldrig får utgöra hela "message" (kravregel 1). */
const FILLER = new Set([
  "bra", "intressant", "tack", "ok", "okej", "toppen", "perfekt",
  "bra svar", "spännande", "noterat", "härligt", "kul", "trevligt", "juste",
  "förstår", "jag förstår", "bra att veta", "tack för svaret", "mycket bra",
]);

export function isFillerResponse(s: string): boolean {
  const t = s.trim().toLowerCase().replace(/[.!?…]+$/g, "").trim();
  return t.length === 0 || FILLER.has(t);
}

const str = (v: unknown, max: number): string =>
  typeof v === "string" ? v.trim().slice(0, max) : "";

function validArea(v: unknown): TargetArea | undefined {
  return typeof v === "string" && AREAS.includes(v as TargetArea) ? (v as TargetArea) : undefined;
}

function validateInsight(v: unknown): ReasoningInsight | undefined {
  if (!v || typeof v !== "object") return undefined;
  const o = v as Record<string, unknown>;
  const title = str(o.title, 120);
  const text = str(o.text, LIMITS.MAX_NOTE_TEXT_LEN);
  const confidence = o.confidence;
  if (title.length < 3 || text.length < 10) return undefined;
  if (typeof confidence !== "string" || !CONFIDENCE.includes(confidence as (typeof CONFIDENCE)[number])) return undefined;
  const basedOn = Array.isArray(o.basedOn)
    ? o.basedOn.filter((x): x is string => typeof x === "string" && x.trim().length > 0).map((x) => str(x, 120)).slice(0, 5)
    : [];
  // En insikt utan konkret grund kasseras hellre än visas — den får aldrig vara påhittad.
  if (basedOn.length === 0) return undefined;
  return { title, text, confidence: confidence as ReasoningInsight["confidence"], basedOn };
}

function validateConcern(v: unknown): ReasoningConcern | undefined {
  if (!v || typeof v !== "object") return undefined;
  const o = v as Record<string, unknown>;
  const title = str(o.title, 120);
  const text = str(o.text, LIMITS.MAX_NOTE_TEXT_LEN);
  const severity = o.severity;
  if (title.length < 3 || text.length < 10) return undefined;
  if (typeof severity !== "string" || !SEVERITY.includes(severity as (typeof SEVERITY)[number])) return undefined;
  return { title, text, severity: severity as ReasoningConcern["severity"] };
}

/**
 * Defensiv validering av modellens JSON till en säker ReasoningDecision.
 * Returnerar null om något strukturellt centralt är fel (ogiltig action,
 * saknad/ogiltig message, saknad nextQuestion när det krävs) — anroparen
 * faller då tillbaka till det skriptade läget. Svagare fält (insight,
 * concern, questionReason, targetArea) kasseras var för sig i stället för
 * att fälla hela beslutet.
 */
export function validateDecision(input: unknown): ReasoningDecision | null {
  if (!input || typeof input !== "object") return null;
  const o = input as Record<string, unknown>;

  const action = o.action;
  if (typeof action !== "string" || !ACTIONS.includes(action as ReasoningAction)) return null;

  if (typeof o.message !== "string") return null;
  const message = o.message.trim();
  // Högre golv än en ren "icke-tom"-kontroll: meddelandet ska tillföra
  // konkret värde, inte bara vara en artig kvittens.
  if (message.length < 20 || isFillerResponse(message)) return null;

  // canRecommend är ett stödsignal-fält, inte kärnan i beslutet — modellen
  // utelämnar det ibland för action "ask". Fäll inte hela beslutet för det;
  // anta konservativt "inte redo att rekommendera" om det saknas.
  const canRecommend = typeof o.canRecommend === "boolean" ? o.canRecommend : action === "finish";

  const missingCriticalInformation = Array.isArray(o.missingCriticalInformation)
    ? o.missingCriticalInformation.filter((x): x is string => typeof x === "string" && x.trim().length > 0).slice(0, 8)
    : [];

  const nextQuestionRaw = typeof o.nextQuestion === "string" ? o.nextQuestion.trim() : undefined;
  // Alla actions utom finish MÅSTE ha en konkret fråga (kravregel 4 + robusthet:
  // UI:t ska aldrig kunna fastna utan en väg framåt).
  if (action !== "finish" && (!nextQuestionRaw || nextQuestionRaw.length < 3)) return null;

  const isFinish = action === "finish";
  const questionReasonRaw = typeof o.questionReason === "string" ? o.questionReason.trim() : "";

  return {
    action: action as ReasoningAction,
    message: message.slice(0, LIMITS.MAX_MESSAGE_LEN),
    nextQuestion: isFinish ? undefined : nextQuestionRaw!.slice(0, LIMITS.MAX_QUESTION_LEN),
    targetArea: validArea(o.targetArea),
    questionReason: !isFinish && questionReasonRaw ? questionReasonRaw.slice(0, LIMITS.MAX_QUESTION_REASON_LEN) : undefined,
    insight: validateInsight(o.insight),
    concern: validateConcern(o.concern),
    canRecommend,
    missingCriticalInformation,
  };
}

/* ── Områdesstatus: per-strategiskt-område historik ─────────── */
// En "loop" (samma område frågat om och om igen) och en "för tidig finish"
// (avslutar fast kritisk information saknas) är två olika fel. Att bara
// räkna hur många gånger ett område frågats om räcker inte för att skilja
// dem åt — vi måste veta VARFÖR området inte gick vidare: fick vi ett
// riktigt svar, ett uttryckligt "vet inte", eller hoppade användaren
// uttryckligen över det?

/** Utfallet av ett enskilt försök att fråga om ett strategiskt område. */
export type AreaOutcome = "answered" | "unknown" | "skipped";

export interface AreaAttempt {
  area: TargetArea;
  outcome: AreaOutcome;
}

/**
 * Aggregerad status för ett område givet alla försök hittills:
 * - "unasked": aldrig frågat.
 * - "unknown": frågat minst en gång, bara "vet inte"-svar hittills, under taket
 *   — får fortfarande frågas om (högst en gång till).
 * - "covered": minst ett riktigt svar givet. Får fortfarande frågas om igen
 *   (t.ex. en challenge/clarify-uppföljning) så länge taket inte nåtts —
 *   "covered" handlar om INFORMATION, inte om att frågor är förbjudna.
 * - "skipped": användaren har uttryckligen klickat "Hoppa över". Terminalt —
 *   frågas aldrig igen, oavsett hur få gånger det frågats.
 * - "exhausted": frågat till taket (MAX_ASKS_PER_AREA) utan att någonsin få
 *   ett riktigt svar. Terminalt — frågas aldrig igen.
 */
export type AreaStatus = "unasked" | "unknown" | "covered" | "skipped" | "exhausted";

function attemptsFor(attempts: AreaAttempt[], area: TargetArea): AreaAttempt[] {
  return attempts.filter((a) => a.area === area);
}

export function askCountFor(attempts: AreaAttempt[], area: TargetArea): number {
  return attemptsFor(attempts, area).length;
}

export function hasAnsweredArea(attempts: AreaAttempt[], area: TargetArea): boolean {
  return attemptsFor(attempts, area).some((a) => a.outcome === "answered");
}

export function wasAreaSkipped(attempts: AreaAttempt[], area: TargetArea): boolean {
  return attemptsFor(attempts, area).some((a) => a.outcome === "skipped");
}

export function areaStatus(attempts: AreaAttempt[], area: TargetArea, cap: number): AreaStatus {
  if (hasAnsweredArea(attempts, area)) return "covered";
  if (wasAreaSkipped(attempts, area)) return "skipped";
  const count = askCountFor(attempts, area);
  if (count === 0) return "unasked";
  if (count >= cap) return "exhausted";
  return "unknown";
}

/**
 * Om ett område fortfarande får frågas om. Skiljs medvetet från
 * "covered" — ett besvarat område kan fortfarande behöva en
 * uppföljningsfråga (challenge/clarify) så länge taket inte är nått.
 * Ett uttryckligt överhoppat område ("skipped") frågas dock aldrig igen.
 */
export function isAreaAskable(attempts: AreaAttempt[], area: TargetArea, cap: number): boolean {
  if (wasAreaSkipped(attempts, area)) return false;
  return askCountFor(attempts, area) < cap;
}

/** Nästa högst prioriterade kritiska område som fortfarande saknar svar OCH går att fråga om. */
export function nextAskableCriticalArea(criticalAreas: TargetArea[], attempts: AreaAttempt[], cap: number): TargetArea | null {
  return criticalAreas.find((a) => !hasAnsweredArea(attempts, a) && isAreaAskable(attempts, a, cap)) ?? null;
}

/**
 * Kritiska områden som varken har ett riktigt svar eller längre går att
 * fråga om (dvs. status "skipped" eller "exhausted") — de riktiga
 * luckorna en rekommendation måste vara ärlig om.
 */
export function unresolvedCriticalAreas(criticalAreas: TargetArea[], attempts: AreaAttempt[], cap: number): TargetArea[] {
  return criticalAreas.filter((a) => !hasAnsweredArea(attempts, a) && !isAreaAskable(attempts, a, cap));
}

/* ── Request-kontrakt (frontend → API) ──────────────────────── */
export interface KnownFact {
  key: string;
  label: string;
  value?: string;
}

export interface ReasoningRequest {
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
  /** Sant om användaren uttryckligen svarade "vet inte" — får aldrig tolkas som fakta. */
  unknownAnswer: boolean;
  history: { question: string; answer: string }[];
  /** Alla försök att fråga om ett strategiskt område hittills, i turordning. */
  areaAttempts: AreaAttempt[];
  /** Fakta företagaren själv gett hittills. */
  knownFacts: KnownFact[];
  /** Kandidatfält som ännu inte är besvarade — referens, inte en kö att beta av. */
  candidateFields: KnownFact[];
  callCount: number;
}

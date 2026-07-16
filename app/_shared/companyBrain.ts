// ─────────────────────────────────────────────────────────────
// Company Brain 1.1 — strukturerad, redigerbar, återanvändbar
// företagskunskap. Rena typer och funktioner, körbara på både
// klient och server. Ingen Supabase-anrop här — se
// useCompanyBrain.ts (klient) och lib/companyBrainServer.ts
// (server) för det.
//
// GRUNDPRINCIP: systemet får aldrig gissa att en uppgift är sann.
// Migrerad, oöverblickad eller AI-härledd information markeras
// alltid med låg confidence och en icke-bekräftande source — den
// blir ALDRIG automatiskt "user_confirmed".
// ─────────────────────────────────────────────────────────────
import type { CompanyProfile } from "./useAccountData";

/* ── Grundtyper ──────────────────────────────────────────── */

export type KnowledgeSource =
  | "user_confirmed"
  | "website_extracted"
  | "campaign_learned"
  | "ai_suggested";

export type KnowledgeConfidence = "low" | "medium" | "high";
export type ProfitabilityLevel = "unknown" | "low" | "normal" | "high";
export type BusinessPriority = "low" | "normal" | "high";

export interface CompanyProduct {
  id: string;
  name: string;
  category?: string;
  description?: string;
  customerProblem?: string;
  primaryAudience?: string;
  differentiators: string[];
  commonObjections: string[];
  profitability: ProfitabilityLevel;
  priority: BusinessPriority;
  seasonality?: string;
  availabilityNotes?: string;
  source: KnowledgeSource;
  confidence: KnowledgeConfidence;
  confirmedAt?: string;
  updatedAt: string;
}

export interface CompanyCompetitor {
  id: string;
  name: string;
  website?: string;
  notes?: string;
  source: KnowledgeSource;
  confidence: KnowledgeConfidence;
}

export interface CompanyBrain {
  companySummary: string;
  primaryCustomers: string[];
  strengths: string[];
  uniqueSellingPoints: string[];
  tone: string[];
  contentGuidelines: string[];
  forbiddenClaims: string[];
  preferredCallsToAction: string[];
  commonCustomerObjections: string[];
  competitors: CompanyCompetitor[];
  products: CompanyProduct[];
  keySeasons: string[];
  marketingGoals: string[];
  lastReviewedAt?: string;
}

/** Nivåbaserad, deterministisk kunskapskvalitet — aldrig en falskt exakt procentsats. */
export interface BrainCompleteness {
  level: "basic" | "useful" | "strong";
  missingAreas: string[];
}

/** En prioriterad kunskapslucka — visas högst tre åt gången på Företagskunskap-sidan. */
export type KnowledgeGap =
  | { id: string; kind: "summary"; question: string }
  | { id: string; kind: "audience"; question: string }
  | { id: string; kind: "tone"; question: string }
  | { id: string; kind: "strengths"; question: string }
  | { id: string; kind: "competitors"; question: string }
  | { id: string; kind: "seasons"; question: string }
  | { id: string; kind: "objections"; question: string }
  | { id: string; kind: "product_profitability"; question: string; productId: string; productName: string }
  | { id: string; kind: "product_audience"; question: string; productId: string; productName: string }
  | { id: string; kind: "product_objections"; question: string; productId: string; productName: string };

/** Minimerad, säker AI-kontext — inga interna ID:n, inga exakta ekonomiska siffror. */
export interface CompanyBrainContext {
  summary: string;
  audiences: string[];
  priorityProducts: Array<{
    name: string;
    description?: string;
    profitability: ProfitabilityLevel;
    priority: BusinessPriority;
    objections: string[];
    differentiators: string[];
    seasonality?: string;
  }>;
  strengths: string[];
  usps: string[];
  tone: string[];
  contentGuidelines: string[];
  forbiddenClaims: string[];
  seasons: string[];
}

/* ── Begränsningar (säkerhet) ────────────────────────────── */
export const BRAIN_LIMITS = {
  MAX_TEXT: 400,
  MAX_LONG_TEXT: 1200,
  MAX_LIST_ITEM: 200,
  MAX_LIST_ITEMS: 20,
  MAX_PRODUCTS: 40,
  MAX_COMPETITORS: 20,
  /** Hur många prioriterade produkter som skickas i AI-kontexten. */
  MAX_CONTEXT_PRODUCTS: 8,
} as const;

const PROFITABILITY_LEVELS: readonly ProfitabilityLevel[] = ["unknown", "low", "normal", "high"];
const PRIORITY_LEVELS: readonly BusinessPriority[] = ["low", "normal", "high"];
const SOURCES: readonly KnowledgeSource[] = ["user_confirmed", "website_extracted", "campaign_learned", "ai_suggested"];
const CONFIDENCES: readonly KnowledgeConfidence[] = ["low", "medium", "high"];

const clipText = (v: unknown, max: number = BRAIN_LIMITS.MAX_TEXT): string =>
  typeof v === "string" ? v.trim().slice(0, max) : "";

const clipList = (v: unknown, maxItems: number = BRAIN_LIMITS.MAX_LIST_ITEMS, maxLen: number = BRAIN_LIMITS.MAX_LIST_ITEM): string[] =>
  Array.isArray(v)
    ? v.filter((x): x is string => typeof x === "string" && x.trim().length > 0).map((x) => clipText(x, maxLen)).slice(0, maxItems)
    : [];

export function newBrainId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") return crypto.randomUUID();
  return `id_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

/* ── Tomma standardvärden ────────────────────────────────── */
export function emptyBrain(): CompanyBrain {
  return {
    companySummary: "", primaryCustomers: [], strengths: [], uniqueSellingPoints: [],
    tone: [], contentGuidelines: [], forbiddenClaims: [], preferredCallsToAction: [],
    commonCustomerObjections: [], competitors: [], products: [], keySeasons: [], marketingGoals: [],
  };
}

/**
 * Säker normalisering av ett OKÄNT/potentiellt korrupt JSONB-värde till en
 * giltig CompanyBrain. Kastar aldrig — ett trasigt eller saknat fält faller
 * tillbaka till ett säkert tomt värde i stället för att krascha sidan.
 */
export function sanitizeBrain(raw: unknown): CompanyBrain {
  const o = (raw && typeof raw === "object") ? (raw as Record<string, unknown>) : {};
  return {
    companySummary: clipText(o.companySummary, BRAIN_LIMITS.MAX_LONG_TEXT),
    primaryCustomers: clipList(o.primaryCustomers),
    strengths: clipList(o.strengths),
    uniqueSellingPoints: clipList(o.uniqueSellingPoints),
    tone: clipList(o.tone),
    contentGuidelines: clipList(o.contentGuidelines),
    forbiddenClaims: clipList(o.forbiddenClaims),
    preferredCallsToAction: clipList(o.preferredCallsToAction),
    commonCustomerObjections: clipList(o.commonCustomerObjections),
    competitors: Array.isArray(o.competitors) ? o.competitors.map(sanitizeCompetitor).slice(0, BRAIN_LIMITS.MAX_COMPETITORS) : [],
    products: Array.isArray(o.products) ? o.products.map(sanitizeProduct).slice(0, BRAIN_LIMITS.MAX_PRODUCTS) : [],
    keySeasons: clipList(o.keySeasons),
    marketingGoals: clipList(o.marketingGoals),
    lastReviewedAt: typeof o.lastReviewedAt === "string" ? o.lastReviewedAt : undefined,
  };
}

function sanitizeSource(v: unknown): KnowledgeSource {
  return typeof v === "string" && SOURCES.includes(v as KnowledgeSource) ? (v as KnowledgeSource) : "ai_suggested";
}
function sanitizeConfidence(v: unknown): KnowledgeConfidence {
  return typeof v === "string" && CONFIDENCES.includes(v as KnowledgeConfidence) ? (v as KnowledgeConfidence) : "low";
}
function sanitizeProfitability(v: unknown): ProfitabilityLevel {
  return typeof v === "string" && PROFITABILITY_LEVELS.includes(v as ProfitabilityLevel) ? (v as ProfitabilityLevel) : "unknown";
}
function sanitizePriority(v: unknown): BusinessPriority {
  return typeof v === "string" && PRIORITY_LEVELS.includes(v as BusinessPriority) ? (v as BusinessPriority) : "normal";
}

export function sanitizeProduct(raw: unknown): CompanyProduct {
  const o = (raw && typeof raw === "object") ? (raw as Record<string, unknown>) : {};
  return {
    id: typeof o.id === "string" && o.id ? o.id : newBrainId(),
    name: clipText(o.name, 120) || "Namnlös produkt",
    category: clipText(o.category, 80) || undefined,
    description: clipText(o.description, BRAIN_LIMITS.MAX_LONG_TEXT) || undefined,
    customerProblem: clipText(o.customerProblem, BRAIN_LIMITS.MAX_LONG_TEXT) || undefined,
    primaryAudience: clipText(o.primaryAudience, BRAIN_LIMITS.MAX_TEXT) || undefined,
    differentiators: clipList(o.differentiators, 10),
    commonObjections: clipList(o.commonObjections, 10),
    profitability: sanitizeProfitability(o.profitability),
    priority: sanitizePriority(o.priority),
    seasonality: clipText(o.seasonality, 120) || undefined,
    availabilityNotes: clipText(o.availabilityNotes, BRAIN_LIMITS.MAX_TEXT) || undefined,
    source: sanitizeSource(o.source),
    confidence: sanitizeConfidence(o.confidence),
    confirmedAt: typeof o.confirmedAt === "string" ? o.confirmedAt : undefined,
    updatedAt: typeof o.updatedAt === "string" ? o.updatedAt : new Date().toISOString(),
  };
}

export function sanitizeCompetitor(raw: unknown): CompanyCompetitor {
  const o = (raw && typeof raw === "object") ? (raw as Record<string, unknown>) : {};
  return {
    id: typeof o.id === "string" && o.id ? o.id : newBrainId(),
    name: clipText(o.name, 120) || "Namnlös konkurrent",
    website: clipText(o.website, 200) || undefined,
    notes: clipText(o.notes, BRAIN_LIMITS.MAX_TEXT) || undefined,
    source: sanitizeSource(o.source),
    confidence: sanitizeConfidence(o.confidence),
  };
}

/** Skapar en ny, ännu obekräftad produkt (t.ex. tillagd manuellt av användaren). */
export function newManualProduct(name: string): CompanyProduct {
  return {
    id: newBrainId(), name: clipText(name, 120), differentiators: [], commonObjections: [],
    profitability: "unknown", priority: "normal", source: "user_confirmed", confidence: "high",
    confirmedAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
  };
}

/**
 * Migrerar det gamla, platta CompanyProfile-formatet till Company Brain 1.1.
 * Körs varje gång ett konto saknar (eller har ofullständig) company_brain.
 *
 * VIKTIGT: gamla produkter var bara namn-strängar utan känd proveniens — vi
 * vet INTE om de kommer från en AI-analys av hemsidan eller skrevs in för
 * hand. Att gissa "user_confirmed" vore precis den typen av påhitt principen
 * förbjuder. De migreras därför som "ai_suggested" / "low confidence" tills
 * användaren uttryckligen bekräftar dem i det nya gränssnittet — även om de
 * i praktiken ofta stämmer.
 *
 * existingBrain (om company_brain redan finns, t.ex. delvis ifylld) vinner
 * alltid över det som härleds ur den gamla profilen.
 */
export function migrateProfileToBrain(
  profile: Pick<CompanyProfile, "summary" | "customers" | "products" | "tone" | "strengths" | "avoid" | "contentGuidelines"> | null | undefined,
  existingBrain?: unknown,
): CompanyBrain {
  const base = emptyBrain();
  const now = new Date().toISOString();

  if (profile) {
    base.companySummary = clipText(profile.summary, BRAIN_LIMITS.MAX_LONG_TEXT);
    base.primaryCustomers = clipList(profile.customers);
    base.strengths = clipList(profile.strengths);
    base.tone = clipList(profile.tone);
    base.contentGuidelines = clipList(profile.contentGuidelines);
    // avoid → forbiddenClaims: samma koncept ("saker vi aldrig vill uttrycka"),
    // bara namnet moderniserat i Company Brain-modellen.
    base.forbiddenClaims = clipList(profile.avoid);
    base.products = clipList(profile.products, BRAIN_LIMITS.MAX_PRODUCTS, 120).map((name) => ({
      id: newBrainId(), name, differentiators: [], commonObjections: [],
      profitability: "unknown" as ProfitabilityLevel, priority: "normal" as BusinessPriority,
      source: "ai_suggested" as KnowledgeSource, confidence: "low" as KnowledgeConfidence,
      updatedAt: now,
    }));
  }

  if (!existingBrain) return base;

  // Ett redan existerande (om än ofullständigt) company_brain vinner fält
  // för fält över det som just härletts ur den gamla profilen.
  const sanitized = sanitizeBrain(existingBrain);
  const hasAny = (arr: unknown[]) => Array.isArray(arr) && arr.length > 0;
  return {
    companySummary: sanitized.companySummary || base.companySummary,
    primaryCustomers: hasAny(sanitized.primaryCustomers) ? sanitized.primaryCustomers : base.primaryCustomers,
    strengths: hasAny(sanitized.strengths) ? sanitized.strengths : base.strengths,
    uniqueSellingPoints: sanitized.uniqueSellingPoints,
    tone: hasAny(sanitized.tone) ? sanitized.tone : base.tone,
    contentGuidelines: hasAny(sanitized.contentGuidelines) ? sanitized.contentGuidelines : base.contentGuidelines,
    forbiddenClaims: hasAny(sanitized.forbiddenClaims) ? sanitized.forbiddenClaims : base.forbiddenClaims,
    preferredCallsToAction: sanitized.preferredCallsToAction,
    commonCustomerObjections: sanitized.commonCustomerObjections,
    competitors: sanitized.competitors,
    products: hasAny(sanitized.products) ? sanitized.products : base.products,
    keySeasons: sanitized.keySeasons,
    marketingGoals: sanitized.marketingGoals,
    lastReviewedAt: sanitized.lastReviewedAt,
  };
}

/* ── Kunskapskvalitet ────────────────────────────────────── */
/**
 * Deterministisk, dokumenterad completeness-regel — aldrig en falskt exakt
 * procentsats. Varje nivå kräver ALLA villkor i den nivån (och alla lägre).
 *
 * basic:  företagsöversikt finns + minst en målgrupp finns.
 * useful: basic + minst en produkt/tjänst + minst en styrka/USP +
 *         minst en tonläges-tagg + minst en invändning (företags- eller
 *         produktnivå).
 * strong: useful + minst en produkt prioriterad "high" + den produkten (eller
 *         någon annan) har en känd lönsamhetsnivå (≠ unknown) + minst en
 *         säsong + minst en konkurrent/alternativ + minst en innehållsregel.
 */
export function computeCompleteness(brain: CompanyBrain): BrainCompleteness {
  const hasSummary = brain.companySummary.trim().length > 0;
  const hasAudience = brain.primaryCustomers.length > 0;
  const hasProduct = brain.products.length > 0;
  const hasStrengthOrUsp = brain.strengths.length > 0 || brain.uniqueSellingPoints.length > 0;
  const hasTone = brain.tone.length > 0;
  const hasObjections = brain.commonCustomerObjections.length > 0 || brain.products.some((p) => p.commonObjections.length > 0);

  const basicOk = hasSummary && hasAudience;
  const usefulOk = basicOk && hasProduct && hasStrengthOrUsp && hasTone && hasObjections;

  const hasPriorityProduct = brain.products.some((p) => p.priority === "high");
  const hasKnownProfitability = brain.products.some((p) => p.profitability !== "unknown");
  const hasSeasons = brain.keySeasons.length > 0;
  const hasCompetitors = brain.competitors.length > 0;
  const hasContentGuidelines = brain.contentGuidelines.length > 0;
  const strongOk = usefulOk && hasPriorityProduct && hasKnownProfitability && hasSeasons && hasCompetitors && hasContentGuidelines;

  if (strongOk) return { level: "strong", missingAreas: [] };

  if (usefulOk) {
    const missing: string[] = [];
    if (!hasPriorityProduct) missing.push("Ingen produkt är markerad som prioriterad");
    if (!hasKnownProfitability) missing.push("Ingen produkt har en känd lönsamhetsnivå");
    if (!hasSeasons) missing.push("Inga säsonger angivna");
    if (!hasCompetitors) missing.push("Inga konkurrenter eller alternativ angivna");
    if (!hasContentGuidelines) missing.push("Inga innehållsregler angivna");
    return { level: "useful", missingAreas: missing };
  }

  const missing: string[] = [];
  if (!hasSummary) missing.push("Ingen företagsöversikt");
  if (!hasAudience) missing.push("Ingen målgrupp angiven");
  if (!hasProduct) missing.push("Ingen produkt eller tjänst tillagd");
  if (!hasStrengthOrUsp) missing.push("Inga styrkor eller USP:ar");
  if (!hasTone) missing.push("Inget tonläge angivet");
  if (!hasObjections) missing.push("Inga vanliga kundinvändningar");
  return { level: "basic", missingAreas: missing };
}

/* ── Progressiv kunskapsinsamling ────────────────────────── */
/**
 * De tre viktigaste kunskapsluckorna just nu, i fast prioritetsordning:
 * 1. Företagsöversikt saknas
 * 2. Målgrupp saknas
 * 3. En prioriterad produkts lönsamhet är okänd (störst påverkan på råd)
 * 4. En produkts målgrupp är okänd
 * 5. Vanliga kundinvändningar saknas (företag eller produkt)
 * 6. Tonläge saknas
 * 7. Styrkor/USP saknas
 * 8. Konkurrenter saknas
 * 9. Säsonger saknas
 */
export function topKnowledgeGaps(brain: CompanyBrain, max = 3): KnowledgeGap[] {
  const gaps: KnowledgeGap[] = [];

  if (!brain.companySummary.trim()) {
    gaps.push({ id: "gap_summary", kind: "summary", question: "Ge en kort sammanfattning av vad företaget gör." });
  }
  if (brain.primaryCustomers.length === 0) {
    gaps.push({ id: "gap_audience", kind: "audience", question: "Vilka är era viktigaste kunder?" });
  }

  const priorityProductsMissingProfitability = brain.products.filter((p) => p.priority === "high" && p.profitability === "unknown");
  const anyProductMissingProfitability = brain.products.filter((p) => p.profitability === "unknown");
  for (const p of (priorityProductsMissingProfitability.length ? priorityProductsMissingProfitability : anyProductMissingProfitability)) {
    gaps.push({ id: `gap_profitability_${p.id}`, kind: "product_profitability", productId: p.id, productName: p.name, question: `Hur lönsam är ${p.name} ungefär?` });
  }

  for (const p of brain.products.filter((p) => !p.primaryAudience)) {
    gaps.push({ id: `gap_paudience_${p.id}`, kind: "product_audience", productId: p.id, productName: p.name, question: `Vem är den primära målgruppen för ${p.name}?` });
  }

  if (brain.commonCustomerObjections.length === 0 && !brain.products.some((p) => p.commonObjections.length > 0)) {
    gaps.push({ id: "gap_objections", kind: "objections", question: "Vad är den vanligaste invändningen ni möter från kunder?" });
  }
  for (const p of brain.products.filter((p) => p.commonObjections.length === 0)) {
    gaps.push({ id: `gap_pobjections_${p.id}`, kind: "product_objections", productId: p.id, productName: p.name, question: `Vilken invändning möter ni oftast kring ${p.name}?` });
  }

  if (brain.tone.length === 0) {
    gaps.push({ id: "gap_tone", kind: "tone", question: "Hur vill ni att marknadsföringen ska låta — tre ord om tonläget?" });
  }
  if (brain.strengths.length === 0 && brain.uniqueSellingPoints.length === 0) {
    gaps.push({ id: "gap_strengths", kind: "strengths", question: "Vad är er största styrka jämfört med alternativen?" });
  }
  if (brain.competitors.length === 0) {
    gaps.push({ id: "gap_competitors", kind: "competitors", question: "Vilka konkurrenter eller alternativ jämför kunder er med?" });
  }
  if (brain.keySeasons.length === 0) {
    gaps.push({ id: "gap_seasons", kind: "seasons", question: "Finns det säsonger som påverkar er verksamhet?" });
  }

  return gaps.slice(0, max);
}

/* ── Minimerad AI-kontext ────────────────────────────────── */
/**
 * Bygger den kompakta AI-kontexten Campaign Builder (och en framtida Content
 * Engine) kan använda. Innehåller ALDRIG interna ID:n, källa/confidence-
 * metadata eller exakta ekonomiska siffror — bara det AI:n faktiskt behöver
 * för att resonera om strategi.
 */
export function buildCompanyBrainContext(brain: CompanyBrain): CompanyBrainContext {
  const sortedProducts = [...brain.products].sort((a, b) => {
    const rank = { high: 0, normal: 1, low: 2 } as const;
    return rank[a.priority] - rank[b.priority];
  });

  return {
    summary: brain.companySummary,
    audiences: brain.primaryCustomers,
    priorityProducts: sortedProducts.slice(0, BRAIN_LIMITS.MAX_CONTEXT_PRODUCTS).map((p) => ({
      name: p.name,
      description: p.description,
      profitability: p.profitability,
      priority: p.priority,
      objections: p.commonObjections,
      differentiators: p.differentiators,
      seasonality: p.seasonality,
    })),
    strengths: brain.strengths,
    usps: brain.uniqueSellingPoints,
    tone: brain.tone,
    contentGuidelines: brain.contentGuidelines,
    forbiddenClaims: brain.forbiddenClaims,
    seasons: brain.keySeasons,
  };
}

// ─────────────────────────────────────────────────────────────
// Server-side Company Brain-kontextbyggare för Marketing Strategist.
// Härleder företaget ALLTID ur den autentiserade Supabase-sessionen
// (aldrig ur klient-skickad data), läser company_brain-JSONB:n och
// väljer ut den information strategen faktiskt behöver. Skickar aldrig
// interna id:n, exakta ekonomiska siffror eller onödig data till modellen.
// ─────────────────────────────────────────────────────────────
import { createClient } from "@/lib/supabase-server";
import { migrateProfileToBrain, type CompanyBrain, type ProfitabilityLevel, type BusinessPriority } from "@/app/_shared/companyBrain";

const clip = (v: unknown, n: number): string => (typeof v === "string" ? v.trim().slice(0, n) : "");
const clipArr = (v: unknown, n: number, len: number): string[] =>
  Array.isArray(v) ? v.filter((x): x is string => typeof x === "string" && x.trim().length > 0).map((x) => clip(x, len)).slice(0, n) : [];

export interface StrategistProduct {
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
}

/** Den minimerade, säkra kontext strategen resonerar utifrån. */
export interface StrategistCompanyContext {
  /** Sant om ett företag med användbar kunskap hittades (annars graceful degradation). */
  hasBrain: boolean;
  companyName: string;
  summary: string;
  audiences: string[];
  products: StrategistProduct[];
  strengths: string[];
  usps: string[];
  tone: string[];
  contentGuidelines: string[];
  forbiddenClaims: string[];
  /** Verifierat social proof — enda tillåtna källan för omdömen/siffror. */
  proofPoints: string[];
  seasons: string[];
  competitors: string[];
  marketingGoals: string[];
}

export interface CompanyContextResult {
  context: StrategistCompanyContext;
  companyId: string | null;
}

function emptyContext(companyName = ""): StrategistCompanyContext {
  return {
    hasBrain: false, companyName, summary: "", audiences: [], products: [], strengths: [],
    usps: [], tone: [], contentGuidelines: [], forbiddenClaims: [], proofPoints: [],
    seasons: [], competitors: [], marketingGoals: [],
  };
}

/** Rankar produkter: prioritet först, sedan känd lönsamhet. */
function rankProducts(brain: CompanyBrain): CompanyBrain["products"] {
  const rankP = { high: 0, normal: 1, low: 2 } as const;
  const rankProf = { high: 0, normal: 1, low: 2, unknown: 3 } as const;
  return [...brain.products].sort((a, b) =>
    rankP[a.priority] - rankP[b.priority] || rankProf[a.profitability] - rankProf[b.profitability]);
}

/**
 * Bygger StrategistCompanyContext för den inloggade användaren.
 * Returnerar null om ingen giltig session finns (routen svarar då 401).
 */
export async function buildStrategistCompanyContext(): Promise<CompanyContextResult | null> {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return null;

  const { data: companies } = await sb
    .from("companies").select("*").eq("user_id", user.id)
    .order("created_at", { ascending: false }).limit(1);
  const company = companies?.[0] ?? null;
  if (!company) return { context: emptyContext(), companyId: null };

  const brain: CompanyBrain = migrateProfileToBrain({
    summary: company.summary, customers: company.customers ?? [], products: company.products ?? [],
    tone: company.tone ?? [], strengths: company.strengths ?? [], avoid: company.avoid ?? [],
    contentGuidelines: company.content_guidelines ?? [],
  }, company.company_brain);

  const products: StrategistProduct[] = rankProducts(brain).slice(0, 8).map((p) => ({
    name: clip(p.name, 120),
    category: p.category ? clip(p.category, 80) : undefined,
    description: p.description ? clip(p.description, 600) : undefined,
    customerProblem: p.customerProblem ? clip(p.customerProblem, 600) : undefined,
    primaryAudience: p.primaryAudience ? clip(p.primaryAudience, 200) : undefined,
    differentiators: clipArr(p.differentiators, 8, 200),
    objections: clipArr(p.commonObjections, 8, 200),
    profitability: p.profitability,
    priority: p.priority,
    seasonality: p.seasonality ? clip(p.seasonality, 120) : undefined,
  }));

  const context: StrategistCompanyContext = {
    hasBrain: Boolean(clip(brain.companySummary, 1) || products.length || brain.primaryCustomers.length),
    companyName: clip(company.name, 120),
    summary: clip(brain.companySummary, 1200),
    audiences: clipArr(brain.primaryCustomers, 10, 200),
    products,
    strengths: clipArr(brain.strengths, 10, 200),
    usps: clipArr(brain.uniqueSellingPoints, 10, 200),
    tone: clipArr(brain.tone, 8, 60),
    contentGuidelines: clipArr(brain.contentGuidelines, 12, 200),
    forbiddenClaims: clipArr(brain.forbiddenClaims, 20, 200),
    proofPoints: clipArr(brain.proofPoints, 12, 240),
    seasons: clipArr(brain.keySeasons, 8, 120),
    competitors: Array.isArray(brain.competitors) ? brain.competitors.map((c) => clip(c?.name, 120)).filter(Boolean).slice(0, 8) : [],
    marketingGoals: clipArr(brain.marketingGoals, 8, 200),
  };

  return { context, companyId: company.id ?? null };
}

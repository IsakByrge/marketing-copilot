// ─────────────────────────────────────────────────────────────
// Facebook Specialist — säker, server-side sammansättning av den
// minimerade FacebookSpecialistContext. Företaget härleds ALLTID
// ur den autentiserade Supabase-sessionen (cookie-klienten),
// aldrig ur klient-skickat userId eller klient-skickad Brain.
//
// Klienten skickar bara ID:n (productId, campaignStrategyId) och
// sina per-inlägg-justeringar i briefen. De faktiska grundfakta
// (invändningar, differentiering, forbiddenClaims, strategi) läses
// här från databasen — så att en manipulerad klient aldrig kan
// injicera falska "fakta" eller kringgå forbiddenClaims.
// ─────────────────────────────────────────────────────────────
import { createClient } from "@/lib/supabase-server";
import { migrateProfileToBrain, type CompanyBrain } from "@/app/_shared/companyBrain";
import type { FacebookSpecialistContext, FacebookBrief } from "@/app/content/facebook/types";

const clip = (v: unknown, n: number): string => (typeof v === "string" ? v : "").trim().slice(0, n);
const clipArr = (v: unknown, n: number, len: number): string[] =>
  Array.isArray(v) ? v.filter((x): x is string => typeof x === "string" && x.trim().length > 0).map((x) => clip(x, len)).slice(0, n) : [];

export interface FacebookContextResult {
  context: FacebookSpecialistContext;
  /** Sant om ett företag hittades. Vid false bör routen ge tydlig vägledning. */
  hasCompany: boolean;
}

/**
 * Bygger FacebookSpecialistContext för den inloggade användaren.
 * Returnerar null om ingen giltig session finns (routen svarar då 401).
 */
export async function buildFacebookContext(brief: FacebookBrief): Promise<FacebookContextResult | null> {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return null;

  const { data: companies } = await sb
    .from("companies").select("*").eq("user_id", user.id)
    .order("created_at", { ascending: false }).limit(1);
  const company = companies?.[0] ?? null;

  if (!company) {
    return {
      hasCompany: false,
      context: {
        company: { summary: "", audiences: [], strengths: [], usps: [], tone: "", contentGuidelines: [], forbiddenClaims: [], preferredCallsToAction: [] },
      },
    };
  }

  const brain: CompanyBrain = migrateProfileToBrain({
    summary: company.summary, customers: company.customers ?? [], products: company.products ?? [],
    tone: company.tone ?? [], strengths: company.strengths ?? [], avoid: company.avoid ?? [],
    contentGuidelines: company.content_guidelines ?? [],
  }, company.company_brain);

  const context: FacebookSpecialistContext = {
    company: {
      summary: clip(brain.companySummary, 1200),
      audiences: clipArr(brain.primaryCustomers, 12, 200),
      strengths: clipArr(brain.strengths, 12, 200),
      usps: clipArr(brain.uniqueSellingPoints, 12, 200),
      tone: clipArr(brain.tone, 8, 60).join(", "),
      contentGuidelines: clipArr(brain.contentGuidelines, 12, 200),
      forbiddenClaims: clipArr(brain.forbiddenClaims, 20, 200),
      preferredCallsToAction: clipArr(brain.preferredCallsToAction, 8, 120),
    },
  };

  // Vald produkt — grundfakta hämtas server-side ur Brain via id.
  if (brief.productId) {
    const p = brain.products.find((x) => x.id === brief.productId);
    if (p) {
      context.selectedProduct = {
        name: clip(p.name, 120),
        category: p.category ? clip(p.category, 80) : undefined,
        description: p.description ? clip(p.description, 1200) : undefined,
        customerProblem: p.customerProblem ? clip(p.customerProblem, 1200) : undefined,
        primaryAudience: p.primaryAudience ? clip(p.primaryAudience, 300) : undefined,
        differentiators: clipArr(p.differentiators, 10, 200),
        objections: clipArr(p.commonObjections, 10, 200),
        profitability: p.profitability,
        priority: p.priority,
        seasonality: p.seasonality ? clip(p.seasonality, 120) : undefined,
        availabilityNotes: p.availabilityNotes ? clip(p.availabilityNotes, 300) : undefined,
      };
    }
  }

  // Vald kampanjstrategi — den FB-säkra sammanfattningen (strategy_context)
  // lästes/skrevs av Campaign Builder. Innehåller aldrig marginaler/exakt ekonomi.
  if (brief.campaignStrategyId) {
    const { data: strat } = await sb
      .from("campaign_strategies")
      .select("strategy_context")
      .eq("id", brief.campaignStrategyId)
      .eq("user_id", user.id) // defensivt utöver RLS
      .limit(1)
      .maybeSingle();
    const sc = strat?.strategy_context as Record<string, unknown> | undefined;
    if (sc && typeof sc === "object") {
      context.campaignStrategy = {
        goal: clip(sc.goal, 200) || "Kampanjmål",
        audience: clip(sc.audience, 300) || undefined,
        mainMessage: clip(sc.mainMessage, 700) || undefined,
        offer: clip(sc.offer, 300) || undefined,
        channels: clipArr(sc.channels, 6, 80),
        cta: clip(sc.cta, 200) || undefined,
        risks: clipArr(sc.risks, 6, 300),
        avoid: clipArr(sc.avoid, 6, 300),
      };
    }
  }

  return { context, hasCompany: true };
}

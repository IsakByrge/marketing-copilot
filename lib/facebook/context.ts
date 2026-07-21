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
import { normalizeStrategyContext } from "@/lib/strategist/adapter";
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
        company: { summary: "", audiences: [], strengths: [], usps: [], tone: "", contentGuidelines: [], forbiddenClaims: [], preferredCallsToAction: [], verifiedSocialProof: [] },
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
      // Verifierat social proof: ENDAST från strukturerat, användarägt
      // underlag. Byggs här server-side så att en manipulerad klient aldrig
      // kan injicera "omdömen". Kompletteras nedan med kampanjstrategins
      // egen social proof om den finns.
      verifiedSocialProof: clipArr(brain.proofPoints, 12, 240),
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
      // Normalisera v1 (platt) ELLER v2 (StrategyV2) till en gemensam form.
      const n = normalizeStrategyContext(sc);
      const message = [
        n.mainMessage,
        n.valueProposition ? `Värdeerbjudande: ${n.valueProposition}` : "",
        n.urgency ? `Tidsskäl: ${n.urgency}` : "",
      ].filter(Boolean).join(" · ");
      context.campaignStrategy = {
        goal: n.goal || "Kampanjmål",
        audience: n.audience,
        mainMessage: clip(message, 700) || undefined,
        offer: n.offer,
        channels: (n.channels ?? []).slice(0, 6),
        cta: n.cta,
        risks: (n.risks ?? []).slice(0, 6),
        avoid: clipArr(sc.avoid, 6, 300),
      };
      // Strategin kan bära uttryckligt, strukturerat social proof (t.ex.
      // ett verifierat kundcitat kopplat till kampanjen). Endast då — och
      // aldrig härlett ur fritext — läggs det till som tillåten källa.
      const stratProof = typeof sc.socialProof === "string"
        ? [clip(sc.socialProof, 240)].filter(Boolean)
        : clipArr(sc.socialProof, 12, 240);
      if (stratProof.length) {
        context.company.verifiedSocialProof = [
          ...context.company.verifiedSocialProof,
          ...stratProof,
        ].slice(0, 16);
      }
    }
  }

  return { context, hasCompany: true };
}

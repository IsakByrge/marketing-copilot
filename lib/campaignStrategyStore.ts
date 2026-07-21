// ─────────────────────────────────────────────────────────────
// Persistens av en färdig kampanjrekommendation → campaign_strategies.
// ADDITIVT: ändrar inte Campaign Builders resonemang eller analys.
// Builder anropar bara detta best-effort EFTER att rekommendationen
// är klar, så att den kan väljas som underlag i Facebook Specialist.
//
// strategy_context är den FB-säkra sammanfattningen — den innehåller
// aldrig marginaler eller exakt ekonomi (margin/price utelämnas med
// flit). Klient-sидan använder den RLS-skyddade browser-klienten,
// samma mönster som useCompanyBrain redan gör.
// ─────────────────────────────────────────────────────────────
import { createClient } from "@/lib/supabase-browser";
import type { CampaignBrief } from "@/app/campaign-builder/types";
import type { CampaignRecommendation } from "@/app/campaign-builder/analysis";
import type { StrategyV2 } from "@/lib/strategist/types";

/**
 * Bygger den FB-säkra strategy_context ur ett kampanjunderlag. Ren funktion
 * (ingen Supabase, inga sidoeffekter) så att kedjan Campaign Builder → Facebook
 * Specialist kan integrationstestas. Margin utelämnas ALLTID (känslig ekonomi);
 * pris är annonserbar, publik info och tas därför med. Fälten speglar exakt vad
 * Facebook Specialist kan förifylla (se lib/facebook/strategyPrefill.ts).
 */
export function buildStrategyContext(brief: CampaignBrief, rec: CampaignRecommendation) {
  return {
    goal: brief.goalTitle,
    goalKey: brief.goal, // CampaignGoal-enum → pålitlig mappning till FB-syfte
    product: brief.basics.product || undefined,
    audience: brief.basics.targetAudience || undefined,
    mainMessage: rec.coreMessage,
    offer: brief.basics.hasExistingOffer === "ja" ? (brief.basics.offerContent || undefined) : undefined,
    price: brief.basics.price || undefined,
    geographicArea: brief.basics.geographicArea || undefined,
    deadline: brief.basics.endDate || undefined,
    channels: rec.channels.map((c) => c.name),
    risks: rec.watchouts,
  };
}

/**
 * Sparar strategin och returnerar det faktiska id:t för den nya raden
 * (för direktlänken till Facebook Specialist). Kastar aldrig — vid fel
 * returneras null och anroparen visar då inget direktflöde.
 */
export async function saveCampaignStrategy(brief: CampaignBrief, rec: CampaignRecommendation): Promise<string | null> {
  try {
    const sb = createClient();
    const { data: { user } } = await sb.auth.getUser();
    if (!user) return null;

    const { data: companies } = await sb
      .from("companies").select("id").eq("user_id", user.id)
      .order("created_at", { ascending: false }).limit(1);
    const companyId = companies?.[0]?.id ?? null;

    const strategyContext = buildStrategyContext(brief, rec);

    const { data, error } = await sb.from("campaign_strategies").insert({
      user_id: user.id,
      company_id: companyId,
      title: (rec.headline || brief.basics.product || "Kampanjstrategi").slice(0, 120),
      goal: brief.goalTitle,
      strategy_context: strategyContext,
      recommendation: rec,
    }).select("id").single();

    if (error || !data?.id) return null;
    return data.id as string;
  } catch (e) {
    console.warn("Kunde inte spara kampanjstrategin:", e instanceof Error ? e.name : "UnknownError");
    return null;
  }
}

/**
 * Sparar en Marketing Strategist v2-strategi och returnerar rad-id:t.
 * strategy_context = hela StrategyV2-objektet (version: 2) — samma tabell/
 * kolumn som v1, ingen migration. Läses av Facebook Specialist via adaptern.
 */
export async function saveStrategyV2(strategy: StrategyV2): Promise<string | null> {
  try {
    const sb = createClient();
    const { data: { user } } = await sb.auth.getUser();
    if (!user) return null;

    const { data: companies } = await sb
      .from("companies").select("id").eq("user_id", user.id)
      .order("created_at", { ascending: false }).limit(1);
    const companyId = companies?.[0]?.id ?? null;

    const title = (strategy.strategy.product || strategy.brief.product || strategy.analysis.recommendedFocus || "Strategi").slice(0, 120);

    const { data, error } = await sb.from("campaign_strategies").insert({
      user_id: user.id,
      company_id: companyId,
      title,
      goal: strategy.strategy.primaryGoal || strategy.brief.goalTitle,
      strategy_context: strategy,
      recommendation: strategy.strategy,
    }).select("id").single();

    if (error || !data?.id) return null;
    return data.id as string;
  } catch (e) {
    console.warn("Kunde inte spara strategin:", e instanceof Error ? e.name : "UnknownError");
    return null;
  }
}

// ─────────────────────────────────────────────────────────────
// Server-side identitet (Security Foundation).
//
// Användaren härleds ALLTID ur den autentiserade, cookie-baserade
// Supabase-sessionen — ALDRIG ur klient-skickad data (inget userId/
// companyId i request-body får någonsin styra vem vi agerar som).
//
// Alla queries som görs via den returnerade `supabase`-klienten körs
// som den inloggade användaren, så RLS-policyn (auth.uid() = user_id)
// gäller. Det gör resursägarskap till en databas-garanti, inte bara
// en applikationskontroll.
// ─────────────────────────────────────────────────────────────
import type { SupabaseClient, User } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase-server";

export interface AuthedContext {
  user: User;
  supabase: SupabaseClient;
}

/**
 * Returnerar den inloggade användaren + en session-scopad Supabase-klient,
 * eller null om ingen giltig session finns (anroparen svarar då 401).
 */
export async function getAuthedUser(): Promise<AuthedContext | null> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  return { user, supabase };
}

export interface UserCompany {
  id: string;
  name: string;
}

/**
 * Hämtar den inloggade användarens senaste företag (RLS-scopat till user_id).
 * Returnerar null om användaren ännu inte har något företag.
 */
export async function getUserCompany(ctx: AuthedContext): Promise<UserCompany | null> {
  const { data } = await ctx.supabase
    .from("companies")
    .select("id, name")
    .eq("user_id", ctx.user.id)
    .order("created_at", { ascending: false })
    .limit(1);
  const company = data?.[0];
  return company ? { id: company.id as string, name: (company.name as string) ?? "" } : null;
}

/**
 * Verifierar att en kampanjstrategi ägs av den inloggade användaren.
 * Frågan är RLS-scopad OCH filtrerar explicit på user_id — en användare
 * kan aldrig slå upp någon annans strategi via ett gissat id.
 * Returnerar true endast om raden finns och tillhör användaren.
 */
export async function ownsCampaignStrategy(ctx: AuthedContext, strategyId: string): Promise<boolean> {
  if (!strategyId) return false;
  const { data, error } = await ctx.supabase
    .from("campaign_strategies")
    .select("id")
    .eq("id", strategyId)
    .eq("user_id", ctx.user.id)
    .maybeSingle();
  return !error && !!data;
}

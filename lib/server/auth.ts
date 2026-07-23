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

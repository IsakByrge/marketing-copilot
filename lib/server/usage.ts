// ─────────────────────────────────────────────────────────────
// Enkel användningsloggning för AI-routes (Security Foundation).
//
// Loggar EN rad per AI-anrop till public.ai_usage_events för kostnads-
// och missbruksuppföljning. Skrivningen är RLS-scopad till användaren
// (auth.uid() = user_id) och sker via den autentiserade session-klienten.
//
// Loggar ALDRIG: API-nycklar, sessionscookies, system- eller användar-
// prompter eller Company Brain-innehåll. Endast metadata (vem, vilken
// funktion, modell, status, tid, feltyp, uppskattad tokenanvändning).
//
// Best effort: fel i loggningen får aldrig fälla eller sänka svaret till
// användaren — allt sker i en try/catch och kastar aldrig vidare.
// ─────────────────────────────────────────────────────────────
import type { SupabaseClient } from "@supabase/supabase-js";

export type UsageStatus = "ok" | "error" | "blocked" | "rate_limited";

export interface UsageEvent {
  userId: string;
  companyId?: string | null;
  feature: string;
  model?: string | null;
  status: UsageStatus;
  startedAt: number; // Date.now() vid start
  errorCategory?: string | null;
  promptTokens?: number | null;
  completionTokens?: number | null;
}

export async function logAiUsage(supabase: SupabaseClient, event: UsageEvent): Promise<void> {
  try {
    const endedAt = Date.now();
    await supabase.from("ai_usage_events").insert({
      user_id: event.userId,
      company_id: event.companyId ?? null,
      feature: event.feature.slice(0, 60),
      model: event.model ? event.model.slice(0, 60) : null,
      status: event.status,
      started_at: new Date(event.startedAt).toISOString(),
      ended_at: new Date(endedAt).toISOString(),
      duration_ms: endedAt - event.startedAt,
      error_category: event.errorCategory ? event.errorCategory.slice(0, 60) : null,
      prompt_tokens: event.promptTokens ?? null,
      completion_tokens: event.completionTokens ?? null,
    });
  } catch (err) {
    // Aldrig känsligt innehåll — bara att loggningen misslyckades.
    console.error("AI_USAGE_LOG_ERROR:", err instanceof Error ? err.name : "UnknownError");
  }
}

// ─────────────────────────────────────────────────────────────
// Gemensam ingångskontroll för AI-routes (Security Foundation).
//
// Ett anrop högst upp i en route ger: autentiserad användare (401 om
// ingen), samtidighets- och rate-limit-skydd (429), samt en färdig
// `finish()` som släpper samtidighetslåset och skriver en användnings-
// logg. Syftet är att slippa duplicera auth/timeout/limit/logg i varje
// route — inte att bygga en generell arkitektur.
// ─────────────────────────────────────────────────────────────
import type { SupabaseClient, User } from "@supabase/supabase-js";
import { getAuthedUser } from "./auth";
import { acquireSlot } from "./rateLimit";
import { logAiUsage, type UsageStatus } from "./usage";
import { AI } from "./ai";

const json = (body: unknown, status: number) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

export interface FinishInput {
  status: UsageStatus;
  model?: string | null;
  companyId?: string | null;
  errorCategory?: string | null;
  promptTokens?: number | null;
  completionTokens?: number | null;
}

export interface Guarded {
  user: User;
  supabase: SupabaseClient;
  /** Släpper samtidighetslåset och skriver användningsloggen. Idempotent. */
  finish: (input: FinishInput) => Promise<void>;
}

export type GuardResult =
  | { ok: true; guard: Guarded }
  | { ok: false; response: Response };

/**
 * Kör auth + limit för en AI-route. `feature` identifierar routen i
 * loggen och i rate-limit-nyckeln.
 */
export async function guardAiRequest(feature: string): Promise<GuardResult> {
  const auth = await getAuthedUser();
  if (!auth) {
    return { ok: false, response: json({ error: "Du behöver vara inloggad." }, 401) };
  }

  const slot = acquireSlot(auth.user.id, feature);
  if (!slot.ok) {
    // Logga att vi rate-limitade (best effort) — men blockera aldrig svaret på loggen.
    void logAiUsage(auth.supabase, {
      userId: auth.user.id,
      feature,
      status: "rate_limited",
      startedAt: Date.now(),
      errorCategory: slot.reason,
    });
    const message =
      slot.reason === "concurrent"
        ? "En förfrågan pågår redan. Vänta tills den är klar."
        : "Du har gjort för många förfrågningar. Vänta en stund och försök igen.";
    return {
      ok: false,
      response: json({ error: message }, 429),
    };
  }

  const startedAt = Date.now();
  let finished = false;

  const guard: Guarded = {
    user: auth.user,
    supabase: auth.supabase,
    async finish(input: FinishInput) {
      if (finished) return;
      finished = true;
      slot.release();
      await logAiUsage(auth.supabase, {
        userId: auth.user.id,
        companyId: input.companyId ?? null,
        feature,
        model: input.model ?? AI.CHAT_MODEL,
        status: input.status,
        startedAt,
        errorCategory: input.errorCategory ?? null,
        promptTokens: input.promptTokens ?? null,
        completionTokens: input.completionTokens ?? null,
      });
    },
  };

  return { ok: true, guard };
}

/** Standardiserat, säkert JSON-fel (svenska). Läcker aldrig interna detaljer. */
export function safeError(message: string, status: number): Response {
  return json({ error: message }, status);
}

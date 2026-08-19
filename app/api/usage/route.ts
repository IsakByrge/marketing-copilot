// ─────────────────────────────────────────────────────────────
// GET /api/usage
//
// Läser den inloggade användarens AI-användning. Ingen AI körs här, så
// ingen guardAiRequest — men inloggning krävs, och RLS gör att bara
// egna rader kan nås.
//
// Returnerar aldrig prompter eller innehåll; ai_usage_events lagrar
// inte sådant och den här routen läser bara aggregat.
// ─────────────────────────────────────────────────────────────
import { safeError } from "@/lib/server/guard";
import { createClient } from "@/lib/supabase-server";
import { getUsage } from "@/lib/server/usageReport";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    const sb = await createClient();
    const { data: { user } } = await sb.auth.getUser();
    if (!user) return safeError("Du måste vara inloggad.", 401);

    const raw = new URL(request.url).searchParams.get("days");
    const parsed = Number(raw);
    const days = Number.isFinite(parsed) ? Math.min(Math.max(Math.round(parsed), 1), 90) : 30;

    return Response.json({ days, ...(await getUsage(days)) });
  } catch (error) {
    console.error("USAGE:", error instanceof Error ? error.name : "UnknownError");
    return safeError("Kunde inte hämta användningen just nu.", 500);
  }
}

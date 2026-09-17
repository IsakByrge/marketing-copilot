// ─────────────────────────────────────────────────────────────
// POST /api/text-edits
//
// Tar emot ett par: vad modellen skrev och vad användaren faktiskt
// behöll. Sparas bara när ändringen är meningsfull (se editMemory.ts).
//
// Ingen AI-körning sker här, så ingen guardAiRequest — men inloggning
// krävs, och identiteten härleds server-side ur sessionen precis som i
// AI-routerna. RLS gör sedan att raden bara kan nå sin egen ägare.
//
// Svaret säger aldrig något om att sparandet hoppades över; klienten
// ska inte bry sig, och användaren ska aldrig störas av det här.
// ─────────────────────────────────────────────────────────────
import { safeError } from "@/lib/server/guard";
import { createClient } from "@/lib/supabase-server";
import { recordEdit, type EditKind } from "@/lib/server/editMemory";

export const runtime = "nodejs";

const KINDS: readonly EditKind[] = ["product_text", "facebook_post", "newsletter", "plan_post"];
const isKind = (x: unknown): x is EditKind =>
  typeof x === "string" && (KINDS as readonly string[]).includes(x);

const MAX_LEN = 8_000;

export async function POST(request: Request) {
  try {
    const sb = await createClient();
    const { data: { user } } = await sb.auth.getUser();
    if (!user) return safeError("Du måste vara inloggad.", 401);

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return safeError("Ogiltig förfrågan.", 400);
    }

    const o = (body ?? {}) as Record<string, unknown>;
    if (!isKind(o.kind)) return safeError("Ogiltig texttyp.", 400);

    const original = typeof o.original === "string" ? o.original : "";
    const edited = typeof o.edited === "string" ? o.edited : "";
    if (!original || !edited) return safeError("Både original och redigerad text krävs.", 400);
    if (original.length > MAX_LEN || edited.length > MAX_LEN) {
      return safeError("Texten är för lång.", 400);
    }

    await recordEdit({
      kind: o.kind,
      original,
      edited,
      label: typeof o.label === "string" ? o.label : undefined,
      companyId: typeof o.companyId === "string" ? o.companyId : undefined,
    });

    return Response.json({ ok: true });
  } catch (error) {
    console.error("TEXT_EDITS:", error instanceof Error ? error.name : "UnknownError");
    return safeError("Kunde inte spara just nu.", 500);
  }
}

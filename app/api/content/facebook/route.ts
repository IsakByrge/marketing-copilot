// ─────────────────────────────────────────────────────────────
// /api/content/facebook — Facebook Specialist-motorn.
//
// - Verifierar autentiserad Supabase-session (företag härleds server-
//   side, aldrig ur klienten).
// - Validerar FacebookBrief och bygger minimerad specialistcontext.
// - Deterministisk gate: saknas avgörande info → EN följdfråga, ingen
//   generering, inga påhitt.
// - Genererar utkast → kvalitetsgranskar → högst EN revision.
// - Streamar ärliga processfaser (NDJSON) — ett steg markeras klart
//   först när servern faktiskt är klar med det. Ingen konstlad väntetid.
// - Loggar bara request-id + feltyp — ALDRIG företagsinnehåll.
// - Alla kodvägar skickar ett avslutande svar.
// ─────────────────────────────────────────────────────────────
import { validateBrief } from "@/app/content/facebook/types";
import { runFacebookSpecialist, criticalFollowUp, type FacebookPhase } from "@/lib/facebook/specialist";
import { buildFacebookContext } from "@/lib/facebook/context";

// Låt inte plattformen döda funktionen mitt i modellkedjan (draft+review+revision).
export const maxDuration = 120;

const encoder = new TextEncoder();
const line = (obj: unknown) => encoder.encode(JSON.stringify(obj) + "\n");

export async function POST(request: Request) {
  const requestId = crypto.randomUUID().slice(0, 8);

  // Validera briefen innan vi öppnar strömmen — trasig struktur → 400.
  let brief;
  try {
    const raw = await request.json();
    const parsed = validateBrief(raw);
    if (!parsed.ok) {
      console.error(`FB_SPECIALIST ${requestId}: InvalidBrief`);
      return Response.json({ status: "error", error: parsed.error }, { status: 400 });
    }
    brief = parsed.brief;
  } catch {
    console.error(`FB_SPECIALIST ${requestId}: BadJson`);
    return Response.json({ status: "error", error: "Ogiltig förfrågan." }, { status: 400 });
  }

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const emit = (phase: FacebookPhase) => {
        try { controller.enqueue(line({ type: "phase", phase })); } catch { /* strömmen stängd */ }
      };
      try {
        emit("reading");
        const ctx = await buildFacebookContext(brief);
        if (!ctx) {
          controller.enqueue(line({ type: "error", error: "Du behöver vara inloggad för att skapa innehåll." }));
          controller.close();
          return;
        }
        if (!ctx.hasCompany) {
          controller.enqueue(line({
            type: "error",
            error: "Ingen företagskunskap hittades. Skapa en företagsprofil först så kan specialisten skriva för ditt företag.",
          }));
          controller.close();
          return;
        }

        // Deterministisk gate — exakt EN följdfråga, ingen generering.
        const blocked = criticalFollowUp(brief);
        if (blocked) {
          controller.enqueue(line({ type: "blocked", ...blocked }));
          controller.close();
          return;
        }

        const { result, meta } = await runFacebookSpecialist(brief, ctx.context, {
          emit,
          signal: request.signal,
          requestId,
        });

        // Endast icke-känslig telemetri i loggen.
        console.log(`FB_SPECIALIST ${requestId}: ok calls=${meta.calls} revised=${meta.revised} status=${result.qualityReview.userStatus} altsDropped=${meta.alternativesDropped} cliches=${meta.clichesFound} proof=${meta.verifiedSocialProofCount} ms=${meta.ms} tok=${meta.usage.promptTokens}/${meta.usage.completionTokens}`);

        controller.enqueue(line({ type: "result", status: "ok", result, meta }));
        controller.close();
      } catch (error) {
        const name = error instanceof Error ? error.name : "UnknownError";
        console.error(`FB_SPECIALIST ${requestId}: ${name}`);
        try {
          controller.enqueue(line({ type: "error", error: "Det gick inte att skapa inlägget just nu. Dina uppgifter är kvar och du kan försöka igen." }));
        } catch { /* strömmen redan stängd */ }
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "application/x-ndjson; charset=utf-8",
      "Cache-Control": "no-store",
      "X-Accel-Buffering": "no",
    },
  });
}

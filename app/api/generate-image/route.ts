// ─────────────────────────────────────────────────────────────
// POST /api/generate-image
//
// Genererar en marknadsföringsbild. Kräver inloggning (401) och rate-
// limitas (429) — bildgenerering är dyrt och var tidigare helt oskyddat.
// Central modell + timeout. Läcker inte längre råa OpenAI-felmeddelanden
// till klienten (loggas server-side, generiskt svenskt fel returneras).
// ─────────────────────────────────────────────────────────────
import { guardAiRequest, safeError } from "@/lib/server/guard";
import { getOpenAI, AI } from "@/lib/server/ai";

export const runtime = "nodejs";
export const maxDuration = 120;

const clip = (v: unknown, n: number): string => (typeof v === "string" ? v.trim().slice(0, n) : "");

export async function POST(request: Request) {
  const requestId = crypto.randomUUID().slice(0, 8);

  const guarded = await guardAiRequest("generate-image");
  if (!guarded.ok) return guarded.response;
  const { guard } = guarded;

  try {
    let body: Record<string, unknown>;
    try {
      body = (await request.json()) as Record<string, unknown>;
    } catch {
      await guard.finish({ status: "error", errorCategory: "bad_json" });
      return safeError("Ogiltig förfrågan.", 400);
    }

    const prompt = clip(body.prompt, 1_000);
    const companyName = clip(body.companyName, 200);
    if (!prompt) {
      await guard.finish({ status: "error", errorCategory: "missing_prompt" });
      return safeError("Beskrivning saknas.", 400);
    }

    const response = await getOpenAI().images.generate(
      {
        model: AI.IMAGE_MODEL,
        prompt: `Professionell marknadsföringsbild för ${companyName}: ${prompt}. Fotorealistisk, ljus och inbjudande. Inga texter eller logotyper i bilden.`,
        n: 1,
        size: "1024x1024",
      },
      { timeout: AI.TIMEOUT_MS * 2 },
    );

    const imageBase64 = response.data?.[0]?.b64_json;
    if (!imageBase64) {
      console.error(`IMAGE_GEN ${requestId}: NoImageReturned`);
      await guard.finish({ status: "error", errorCategory: "no_image", model: AI.IMAGE_MODEL });
      return safeError("Ingen bild kunde skapas. Försök igen.", 502);
    }

    await guard.finish({ status: "ok", model: AI.IMAGE_MODEL });
    return Response.json({ image: `data:image/png;base64,${imageBase64}` });
  } catch (error) {
    const name = error instanceof Error ? error.name : "UnknownError";
    console.error(`IMAGE_GEN ${requestId}: ${name}`);
    await guard.finish({ status: "error", errorCategory: name, model: AI.IMAGE_MODEL });
    const status = name === "AbortError" ? 504 : 500;
    const message = name === "AbortError" ? "Bildgenereringen tog för lång tid. Försök igen." : "Kunde inte skapa bilden just nu.";
    return safeError(message, status);
  }
}

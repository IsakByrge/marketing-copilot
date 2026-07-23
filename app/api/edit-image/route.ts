// ─────────────────────────────────────────────────────────────
// POST /api/edit-image
//
// Redigerar en uppladdad produktbild till en marknadsföringsbild.
// Kräver inloggning (401) och rate-limitas (429). Central modell +
// timeout. Begränsar uppladdningsstorleken. Läcker inte längre råa
// OpenAI-felmeddelanden till klienten.
// ─────────────────────────────────────────────────────────────
import { toFile } from "openai/uploads";
import { guardAiRequest, safeError } from "@/lib/server/guard";
import { getOpenAI, AI } from "@/lib/server/ai";

export const runtime = "nodejs";
export const maxDuration = 120;

const MAX_IMAGE_BYTES = Number(process.env.EDIT_IMAGE_MAX_BYTES) || 8_000_000; // ~8 MB

export async function POST(request: Request) {
  const requestId = crypto.randomUUID().slice(0, 8);

  const guarded = await guardAiRequest("edit-image");
  if (!guarded.ok) return guarded.response;
  const { guard } = guarded;

  try {
    const formData = await request.formData();
    const image = formData.get("image");
    const prompt = formData.get("prompt");
    const companyName = formData.get("companyName");

    if (!(image instanceof File)) {
      await guard.finish({ status: "error", errorCategory: "missing_image" });
      return safeError("Ingen bildfil skickades.", 400);
    }
    if (image.size > MAX_IMAGE_BYTES) {
      await guard.finish({ status: "error", errorCategory: "image_too_large" });
      return safeError("Bilden är för stor.", 400);
    }
    if (typeof prompt !== "string" || !prompt.trim()) {
      await guard.finish({ status: "error", errorCategory: "missing_prompt" });
      return safeError("Beskrivning saknas.", 400);
    }

    const arrayBuffer = await image.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const openAIFile = await toFile(buffer, image.name || "product.png", { type: image.type || "image/png" });

    const finalPrompt = `
Placera produkten från den uppladdade bilden i en ny professionell marknadsföringsmiljö.

Företag: ${typeof companyName === "string" ? companyName.slice(0, 200) : ""}

Önskad miljö:
${prompt.slice(0, 1_000)}

Krav:
- Behåll produkten tydlig och igenkännbar.
- Skapa en realistisk marknadsföringsbild.
- Fotorealistisk stil. Naturligt ljus.
- Ingen text, inga logotyper, inga vattenstämplar.
`;

    const response = await getOpenAI().images.edit(
      {
        model: AI.IMAGE_MODEL,
        image: openAIFile,
        prompt: finalPrompt,
        size: "1024x1024",
      },
      { timeout: AI.TIMEOUT_MS * 2 },
    );

    const imageBase64 = response.data?.[0]?.b64_json;
    if (!imageBase64) {
      console.error(`IMAGE_EDIT ${requestId}: NoImageReturned`);
      await guard.finish({ status: "error", errorCategory: "no_image", model: AI.IMAGE_MODEL });
      return safeError("Ingen bild kunde skapas. Försök igen.", 502);
    }

    await guard.finish({ status: "ok", model: AI.IMAGE_MODEL });
    return Response.json({ image: `data:image/png;base64,${imageBase64}` });
  } catch (error) {
    const name = error instanceof Error ? error.name : "UnknownError";
    console.error(`IMAGE_EDIT ${requestId}: ${name}`);
    await guard.finish({ status: "error", errorCategory: name, model: AI.IMAGE_MODEL });
    const status = name === "AbortError" ? 504 : 500;
    const message = name === "AbortError" ? "Bildredigeringen tog för lång tid. Försök igen." : "Kunde inte redigera bilden just nu.";
    return safeError(message, status);
  }
}

// ─────────────────────────────────────────────────────────────
// POST /api/create-content
//
// Stängd, strukturerad content-endpoint (tidigare en öppen AI-proxy).
// Klienten skickar BARA { contentType, request } — inga prompter, inget
// modellval, ingen tokenbudget. Servern:
//   • kräver inloggad användare (401),
//   • rate-limitar per användare/funktion (429),
//   • hämtar Company Brain server-side ur sessionen,
//   • bygger hela system-/användarprompten,
//   • anropar modellen med central config + timeout,
//   • validerar svaret innan det returneras,
//   • loggar användning (ingen prompt/företagsdata).
// ─────────────────────────────────────────────────────────────
import { guardAiRequest, safeError } from "@/lib/server/guard";
import { getCompanyBrainContext } from "@/lib/companyBrainServer";
import { callChatJson, AI } from "@/lib/server/ai";
import {
  isContentType,
  hasForbiddenProxyField,
  buildContentSystemPrompt,
  buildContentUserPrompt,
  validateGeneratedContent,
  MAX_REQUEST_LEN,
} from "@/lib/server/contentPrompt";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(request: Request) {
  const requestId = crypto.randomUUID().slice(0, 8);

  const guarded = await guardAiRequest("create-content");
  if (!guarded.ok) return guarded.response;
  const { guard } = guarded;

  try {
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      await guard.finish({ status: "error", errorCategory: "bad_json" });
      return safeError("Ogiltig förfrågan.", 400);
    }

    const o = (body ?? {}) as Record<string, unknown>;

    // Avvisa uttryckligen råa prompter — den öppna proxyn är stängd.
    if (hasForbiddenProxyField(o)) {
      await guard.finish({ status: "error", errorCategory: "forbidden_field" });
      return safeError("Ogiltigt format: prompt, modell och tokenbudget ägs av servern.", 400);
    }

    if (!isContentType(o.contentType)) {
      await guard.finish({ status: "error", errorCategory: "bad_content_type" });
      return safeError("Ogiltig innehållstyp.", 400);
    }

    const requestText = typeof o.request === "string" ? o.request : "";
    if (requestText.length > MAX_REQUEST_LEN) {
      await guard.finish({ status: "error", errorCategory: "request_too_long" });
      return safeError("Din beskrivning är för lång.", 400);
    }

    // Företagskontext härleds ALLTID server-side ur sessionen.
    const ctx = await getCompanyBrainContext();
    const system = buildContentSystemPrompt(ctx);
    const user = buildContentUserPrompt(o.contentType, requestText);

    const result = await callChatJson(system, user, { temperature: 0.6 });
    const content = validateGeneratedContent(result.parsed);
    if (!content) {
      console.error(`CREATE_CONTENT ${requestId}: SchemaValidationFailed`);
      await guard.finish({ status: "error", errorCategory: "schema_validation", model: AI.CHAT_MODEL, promptTokens: result.promptTokens, completionTokens: result.completionTokens });
      return safeError("Innehållet kunde inte skapas. Försök igen.", 502);
    }

    await guard.finish({
      status: "ok",
      model: AI.CHAT_MODEL,
      promptTokens: result.promptTokens,
      completionTokens: result.completionTokens,
    });
    return Response.json(content);
  } catch (error) {
    const name = error instanceof Error ? error.name : "UnknownError";
    console.error(`CREATE_CONTENT ${requestId}: ${name}`);
    await guard.finish({ status: "error", errorCategory: name });
    const status = name === "AbortError" ? 504 : 500;
    const message = name === "AbortError" ? "Det tog för lång tid att skapa innehållet. Försök igen." : "Kunde inte skapa innehållet just nu.";
    return safeError(message, status);
  }
}

// ─────────────────────────────────────────────────────────────
// POST /api/product-texts
//
// Genererar produktbeskrivningar för en liten batch produkter.
// Följer samma mönster som /api/create-content: inloggning krävs,
// rate limit per användare, Company Brain hämtas server-side, servern
// äger hela prompten, svaret valideras, användningen loggas.
//
// Klienten skickar { products: [{ id, name, group?, current? }] }.
// ─────────────────────────────────────────────────────────────
import { guardAiRequest, safeError } from "@/lib/server/guard";
import { hasForbiddenProxyField } from "@/lib/server/contentPrompt";
import { getCompanyBrainContext } from "@/lib/companyBrainServer";
import { callChatJson, AI } from "@/lib/server/ai";
import {
  buildSystemPrompt,
  buildUserPrompt,
  validateProducts,
  validateGenerated,
  MAX_BATCH,
} from "@/lib/productText/prompt";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(request: Request) {
  const requestId = crypto.randomUUID().slice(0, 8);

  const guarded = await guardAiRequest("product-texts");
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

    if (hasForbiddenProxyField(o)) {
      await guard.finish({ status: "error", errorCategory: "forbidden_field" });
      return safeError("Ogiltigt format: prompt, modell och tokenbudget ägs av servern.", 400);
    }

    const products = validateProducts(o.products);
    if (!products) {
      await guard.finish({ status: "error", errorCategory: "bad_products" });
      return safeError(`Skicka mellan 1 och ${MAX_BATCH} produkter med id och namn.`, 400);
    }

    const ctx = await getCompanyBrainContext();
    const system = buildSystemPrompt(ctx);
    const user = buildUserPrompt(products);

    // ~120 tokens per text plus overhead. Taket i ai.ts gäller ändå.
    const maxTokens = Math.min(400 + products.length * 200, 4_096);
    const result = await callChatJson(system, user, { temperature: 0.5, maxTokens });

    const texts = validateGenerated(result.parsed, products);
    if (!texts) {
      console.error(`PRODUCT_TEXTS ${requestId}: SchemaValidationFailed`);
      await guard.finish({
        status: "error", errorCategory: "schema_validation", model: AI.CHAT_MODEL,
        promptTokens: result.promptTokens, completionTokens: result.completionTokens,
      });
      return safeError("Texterna kunde inte skapas. Försök igen.", 502);
    }

    await guard.finish({
      status: "ok", model: AI.CHAT_MODEL,
      promptTokens: result.promptTokens, completionTokens: result.completionTokens,
    });
    return Response.json({ texts });
  } catch (error) {
    const name = error instanceof Error ? error.name : "UnknownError";
    console.error(`PRODUCT_TEXTS ${requestId}: ${name}`);
    await guard.finish({ status: "error", errorCategory: name });
    const status = name === "AbortError" ? 504 : 500;
    const message = name === "AbortError"
      ? "Det tog för lång tid att skapa texterna. Försök igen."
      : "Kunde inte skapa texterna just nu.";
    return safeError(message, status);
  }
}

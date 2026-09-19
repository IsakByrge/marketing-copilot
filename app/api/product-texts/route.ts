// ─────────────────────────────────────────────────────────────
// POST /api/product-texts
//
// Genererar produktbeskrivningar för en liten batch produkter.
// Följer samma mönster som /api/create-content: inloggning krävs,
// rate limit per användare, Company Brain hämtas server-side, servern
// äger hela prompten, svaret valideras, användningen loggas.
//
// Klienten skickar { products: [{ id, name, template, category?, subCategory?,
// producer?, model?, current? }] }. Mallen avgör längd, struktur och hur stor
// tokenbudget batchen får.
// ─────────────────────────────────────────────────────────────
import { guardAiRequest, safeError } from "@/lib/server/guard";
import { hasForbiddenProxyField } from "@/lib/server/contentPrompt";
import { getCompanyBrainContext, getCompanyBrain } from "@/lib/companyBrainServer";
import { callChatJson, AI } from "@/lib/server/ai";
import {
  buildSystemPrompt,
  buildUserPrompt,
  validateProducts,
  validateGenerated,
  budgetFor,
  buildRetryPrompt,
  rewriteReasons,
  isImprovement,
  currentPlain,
  MAX_BATCH,
} from "@/lib/productText/prompt";
import {
  KEYWORD_SYSTEM, MIN_WORDS_FOR_KEYWORDS, buildKeywordPrompt, parseKeywords,
} from "@/lib/productText/keywords";
import { wordCount } from "@/lib/productText/html";
import { buildFactsLookup } from "@/lib/productText/productFacts";
import { editMemoryBlock } from "@/lib/server/editMemory";

export const runtime = "nodejs";
// Upp till tre modellanrop: nyckelord, text, och omskrivning om texten avvisas.
export const maxDuration = 150;

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
      return safeError(`Skicka mellan 1 och ${MAX_BATCH} produkter med id, namn och mall.`, 400);
    }

    const [ctx, brain, editMemory] = await Promise.all([
      getCompanyBrainContext(),
      getCompanyBrain(),
      editMemoryBlock("product_text"),
    ]);
    const lookup = brain ? buildFactsLookup(brain) : undefined;
    let promptTokens = 0;
    let completionTokens = 0;

    // Steg 1: material och funktioner ur före-texten, innan något skrivs.
    // Misslyckas det skrivs texten ändå, med siffrorna som enda krav.
    const before = new Map(
      products
        .map((p) => [p.id, currentPlain(p)] as const)
        .filter(([, text]) => wordCount(text) >= MIN_WORDS_FOR_KEYWORDS),
    );
    if (before.size > 0) {
      try {
        const kw = await callChatJson(
          KEYWORD_SYSTEM,
          buildKeywordPrompt([...before].map(([id, text]) => ({ id, text }))),
          { temperature: 0, maxTokens: 200 + before.size * 150 },
        );
        promptTokens += kw.promptTokens;
        completionTokens += kw.completionTokens;
        const found = parseKeywords(kw.parsed, before);
        for (const p of products) p.keywords = found.get(p.id);
      } catch (error) {
        console.error(`PRODUCT_TEXTS ${requestId}: keywords ${error instanceof Error ? error.name : "UnknownError"}`);
      }
    }

    const system = buildSystemPrompt(ctx, editMemory);
    const user = buildUserPrompt(products, lookup);

    // Steg 2: texten. Budgeten följer mallarna i batchen: en huvudprodukt på
    // 400 ord behöver tio gånger så mycket som en reservdel. Taket i ai.ts gäller ändå.
    const result = await callChatJson(system, user, {
      temperature: 0.5,
      maxTokens: budgetFor(products),
    });
    promptTokens += result.promptTokens;
    completionTokens += result.completionTokens;

    const texts = validateGenerated(result.parsed, products);
    if (!texts) {
      console.error(`PRODUCT_TEXTS ${requestId}: SchemaValidationFailed`);
      await guard.finish({
        status: "error", errorCategory: "schema_validation", model: AI.CHAT_MODEL,
        promptTokens, completionTokens,
      });
      return safeError("Texterna kunde inte skapas. Försök igen.", 502);
    }

    // Steg 3, hård kontroll: tappade en text ett tal med enhet, en förkortning
    // eller ett nyckelord ur före-texten, eller en uppgift ur modellens egen
    // faktalista, avvisas
    // den och skrivs om en gång, med besked om vad som saknades. Saknas
    // något ändå går texten tillbaka märkt och visas som "Behöver
    // uppgifter", aldrig som klar.
    const byId = new Map(products.map((p) => [p.id, p]));
    const rejected = texts
      .map((t) => ({ id: t.id, reasons: rewriteReasons(t, byId.get(t.id)) }))
      .filter((r) => r.reasons.length > 0);
    if (rejected.length > 0) {
      const again = products.filter((p) => rejected.some((r) => r.id === p.id));
      try {
        const retry = await callChatJson(system, buildRetryPrompt(again, rejected, lookup), {
          temperature: 0.3,
          maxTokens: budgetFor(again),
        });
        promptTokens += retry.promptTokens;
        completionTokens += retry.completionTokens;

        for (const fixed of validateGenerated(retry.parsed, again) ?? []) {
          const i = texts.findIndex((t) => t.id === fixed.id);
          if (i !== -1 && isImprovement(fixed, texts[i], byId.get(fixed.id))) texts[i] = fixed;
        }
      } catch (error) {
        // Omskrivningen misslyckades. Första versionen går tillbaka, märkt.
        console.error(`PRODUCT_TEXTS ${requestId}: retry ${error instanceof Error ? error.name : "UnknownError"}`);
      }
    }

    await guard.finish({ status: "ok", model: AI.CHAT_MODEL, promptTokens, completionTokens });
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

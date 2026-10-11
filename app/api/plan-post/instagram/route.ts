// ─────────────────────────────────────────────────────────────
// POST /api/plan-post/instagram
//
// Gör ett av veckoplanens inlägg till en Instagram-bildtext.
//
// Klienten skickar bara planens id och inläggets index. Texten läses här,
// ur planen och ur användarens sparade redigering (plan_text_edits), via
// den RLS-scopade klienten. Routen kan alltså bara skriva om text som
// redan finns på kontot — den är ingen öppen skrivtjänst.
// ─────────────────────────────────────────────────────────────
import { guardAiRequest, safeError } from "@/lib/server/guard";
import { classifyAiError, modelUsageFrom } from "@/lib/server/aiError";
import { callChatJson, AI } from "@/lib/server/ai";
import { getCompanyBrainContext } from "@/lib/companyBrainServer";
import { factGuardBlock } from "@/lib/server/factGuard";
import { voiceBlock } from "@/lib/server/voice";
import {
  instagramPrompt, byggHashtags, slutfordBildtext, planPostText,
} from "@/lib/content/instagram";

export const runtime = "nodejs";
export const maxDuration = 60;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type PlanPost = { title?: string; text?: string; cta?: string; produkt?: string };

export async function POST(request: Request) {
  const requestId = crypto.randomUUID().slice(0, 8);

  const guarded = await guardAiRequest("plan-post-instagram");
  if (!guarded.ok) return guarded.response;
  const { guard } = guarded;

  try {
    const body = await request.json().catch(() => null) as { planId?: unknown; index?: unknown } | null;
    const planId = typeof body?.planId === "string" && UUID.test(body.planId) ? body.planId : null;
    const index = Number.isInteger(body?.index) ? (body!.index as number) : -1;
    if (!planId || index < 0 || index > 20) {
      await guard.finish({ status: "error", errorCategory: "bad_request" });
      return safeError("Ogiltig förfrågan.", 400);
    }

    const { data: plan } = await guard.supabase
      .from("plans").select("posts").eq("id", planId).maybeSingle();
    const post = (Array.isArray(plan?.posts) ? plan.posts[index] : null) as PlanPost | null;
    if (!post) {
      await guard.finish({ status: "error", errorCategory: "not_found" });
      return safeError("Inlägget hittades inte.", 404);
    }

    // Användarens version går före planens original — det är den som ska
    // ut, och den som ska bli Instagram-text.
    const { data: edit } = await guard.supabase
      .from("plan_text_edits").select("edited_text")
      .eq("plan_id", planId).eq("item_key", `post-${index}`).maybeSingle();
    const kalla = (typeof edit?.edited_text === "string" && edit.edited_text.trim())
      ? edit.edited_text
      : planPostText(post);

    const [brain, { data: company }] = await Promise.all([
      getCompanyBrainContext(),
      guard.supabase.from("companies").select("name")
        .eq("user_id", guard.user.id).order("created_at", { ascending: false }).limit(1).maybeSingle(),
    ]);
    const system = [
      "Du skriver bildtexter för Instagram åt ett svenskt företag. Svara ALLTID med exakt giltig JSON. Svara på svenska.",
      factGuardBlock({
        products: brain?.priorityProducts.map((p) => p.name) ?? [],
        approvedCtas: brain?.preferredCallsToAction ?? [],
        forbiddenClaims: brain?.forbiddenClaims ?? [],
        locations: brain?.locations ?? [],
      }),
      voiceBlock({ example: false }),
    ].join("\n\n");

    const result = await callChatJson(system, instagramPrompt(kalla), { temperature: 0.5, maxTokens: 900 });
    const caption = (result.parsed as { caption?: unknown })?.caption;
    if (typeof caption !== "string" || caption.trim().length < 20) {
      console.error(`PLAN_POST_INSTAGRAM ${requestId}: SchemaValidationFailed`);
      await guard.finish({ status: "error", errorCategory: "schema_validation", model: AI.CHAT_MODEL, promptTokens: result.promptTokens, completionTokens: result.completionTokens });
      return safeError("Instagram-texten kunde inte skapas. Försök igen.", 502);
    }

    const hashtags = byggHashtags({
      companyName: typeof company?.name === "string" ? company.name : undefined,
      produkt: post.produkt,
      orter: brain?.locations ?? [],
      text: kalla,
    });

    await guard.finish({
      status: "ok", model: AI.CHAT_MODEL,
      promptTokens: result.promptTokens, completionTokens: result.completionTokens,
    });
    return Response.json({ caption: slutfordBildtext(caption, hashtags) });
  } catch (error) {
    const failure = classifyAiError(error, "Instagram-texten");
    const usage = modelUsageFrom(error);
    console.error(`PLAN_POST_INSTAGRAM ${requestId}: ${failure.kind} ${failure.logTag}`);
    await guard.finish({ status: "error", errorCategory: `${failure.kind}:${failure.logTag}`, ...usage });
    return safeError(failure.message, failure.httpStatus);
  }
}

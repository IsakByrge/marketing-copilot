// ─────────────────────────────────────────────────────────────
// POST /api/plan-post/refine
//
// Skriver om ett av veckoplanens inlägg efter en instruktion: kortare,
// konkretare, mer säljande eller egna ord. Ersätter formuläret i
// Facebook-specialisten för det vanliga fallet — planen vet redan
// produkt, mål och uppmaning.
//
// Klienten skickar plan, inlägg, kanal och instruktion. Texten läses
// här, ur användarens sparade version eller planens original, via den
// RLS-scopade klienten. Routen kan bara skriva om text som redan finns
// på kontot.
// ─────────────────────────────────────────────────────────────
import { guardAiRequest, safeError } from "@/lib/server/guard";
import { classifyAiError, modelUsageFrom } from "@/lib/server/aiError";
import { callChatJson, AI } from "@/lib/server/ai";
import { getCompanyBrain, getCompanyBrainContext } from "@/lib/companyBrainServer";
import { factGuardBlock } from "@/lib/server/factGuard";
import { voiceBlock } from "@/lib/server/voice";
import { planPostText } from "@/lib/content/instagram";
import { isChannel } from "@/lib/content/published";
import {
  isRefineAction, instructionFor, refinePrompt, checkRefined, cleanRefined, splitHashtags,
} from "@/lib/content/refine";

export const runtime = "nodejs";
export const maxDuration = 60;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type PlanPost = { title?: string; text?: string; cta?: string };

export async function POST(request: Request) {
  const requestId = crypto.randomUUID().slice(0, 8);

  const guarded = await guardAiRequest("plan-post-refine");
  if (!guarded.ok) return guarded.response;
  const { guard } = guarded;

  try {
    const body = await request.json().catch(() => null) as Record<string, unknown> | null;
    const planId = typeof body?.planId === "string" && UUID.test(body.planId) ? body.planId : null;
    const index = Number.isInteger(body?.index) ? (body!.index as number) : -1;
    const channel = isChannel(body?.channel) ? body!.channel : null;
    const action = isRefineAction(body?.action) ? body!.action : null;
    const instruction = action ? instructionFor(action, body?.instruction) : null;
    if (!planId || index < 0 || index > 20 || !channel || !instruction) {
      await guard.finish({ status: "error", errorCategory: "bad_request" });
      return safeError(action === "egen" ? "Skriv vad du vill ändra." : "Ogiltig förfrågan.", 400);
    }

    const itemKey = channel === "instagram" ? `post-${index}-ig` : `post-${index}`;
    const [{ data: plan }, { data: edit }] = await Promise.all([
      guard.supabase.from("plans").select("posts, week_input").eq("id", planId).maybeSingle(),
      guard.supabase.from("plan_text_edits").select("edited_text")
        .eq("plan_id", planId).eq("item_key", itemKey).maybeSingle(),
    ]);
    const post = (Array.isArray(plan?.posts) ? plan.posts[index] : null) as PlanPost | null;
    const sparad = typeof edit?.edited_text === "string" && edit.edited_text.trim() ? edit.edited_text : null;
    const kalla = sparad ?? (channel === "facebook" && post ? planPostText(post) : null);
    if (!kalla) {
      await guard.finish({ status: "error", errorCategory: "not_found" });
      return safeError(channel === "instagram" ? "Skriv Instagram-versionen först." : "Inlägget hittades inte.", 404);
    }

    // Hashtaggarna hålls utanför omskrivningen och läggs tillbaka efteråt.
    const { body: text, tags } = channel === "instagram" ? splitHashtags(kalla) : { body: kalla, tags: "" };
    const weekInput = typeof plan?.week_input === "string" ? plan.week_input : null;

    const [ctx, brain] = await Promise.all([getCompanyBrainContext(), getCompanyBrain()]);
    const system = [
      "Du redigerar marknadsföringstext åt ett svenskt företag. Svara ALLTID med exakt giltig JSON. Svara på svenska.",
      factGuardBlock({
        products: ctx?.priorityProducts.map((p) => p.name) ?? [],
        approvedCtas: ctx?.preferredCallsToAction ?? [],
        forbiddenClaims: ctx?.forbiddenClaims ?? [],
        locations: ctx?.locations ?? [],
        websites: ctx?.websites ?? [],
        hasWeekInput: Boolean(weekInput),
      }),
      voiceBlock({ example: false }),
    ].join("\n\n");

    const result = await callChatJson(system, refinePrompt({ text, channel, instruction, weekInput }), {
      temperature: 0.5, maxTokens: 1_200,
    });
    const ny = cleanRefined(result.parsed);
    if (!ny) {
      console.error(`PLAN_POST_REFINE ${requestId}: SchemaValidationFailed`);
      await guard.finish({ status: "error", errorCategory: "schema_validation", model: AI.CHAT_MODEL, promptTokens: result.promptTokens, completionTokens: result.completionTokens });
      return safeError("Texten kunde inte skrivas om. Försök igen.", 502);
    }

    // Allt texten får bygga på, för kontrollen av nya siffror och brådska.
    const underlag = [
      text, weekInput ?? "",
      ...(brain?.products ?? []).flatMap((p) => [p.name, p.priceInfo ?? "", p.description ?? "", ...(p.models ?? [])]),
      ...(brain?.locations ?? []).flatMap((l) => [l.city, l.address ?? "", l.openingHours ?? ""]),
      ...(brain?.websites ?? []).map((w) => w.url),
    ].join("\n");
    const warnings = checkRefined(ny, underlag, ctx?.proofPoints.length ?? 0);
    const final = channel === "instagram" ? splitHashtags(ny).body + (tags ? `\n\n${tags}` : "") : ny;

    await guard.finish({
      status: "ok", model: AI.CHAT_MODEL,
      promptTokens: result.promptTokens, completionTokens: result.completionTokens,
    });
    return Response.json({ text: final, previous: kalla, warnings });
  } catch (error) {
    const failure = classifyAiError(error, "omskrivningen");
    const usage = modelUsageFrom(error);
    console.error(`PLAN_POST_REFINE ${requestId}: ${failure.kind} ${failure.logTag}`);
    await guard.finish({ status: "error", errorCategory: `${failure.kind}:${failure.logTag}`, ...usage });
    return safeError(failure.message, failure.httpStatus);
  }
}

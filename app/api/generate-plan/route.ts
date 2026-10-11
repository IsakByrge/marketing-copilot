// ─────────────────────────────────────────────────────────────
// POST /api/generate-plan
//
// Genererar en veckoplan. Identiteten härleds ALLTID ur den inloggade
// sessionen — klienten kan inte längre skicka userId för att styra vems
// historik/feedback som används. All DB-läsning sker via den session-
// scopade Supabase-klienten (RLS: auth.uid() = user_id), så en användare
// kan bara nå sina egna företag, planer och feedback.
// ─────────────────────────────────────────────────────────────
import type { SupabaseClient } from "@supabase/supabase-js";
import { guardAiRequest, safeError } from "@/lib/server/guard";
import { classifyAiError, modelUsageFrom } from "@/lib/server/aiError";
import { callChatJson, AI } from "@/lib/server/ai";
import { editMemoryBlock } from "@/lib/server/editMemory";
import { PLAN_SYSTEM_PROMPT, buildPlanUserPrompt, planContextFromRow, type PlanCompanyRow } from "@/lib/server/planPrompt";
import { hittaForKorta, buildRepairPrompt, applyRepair, type PlanShape } from "@/lib/server/planRepair";
import { valideraPlan } from "@/lib/server/planValidate";
import { stockholmIso, upcomingCalendar, calendarLines, filterOpportunities } from "@/lib/server/planCalendar";
import { parseWeekInput, parseUnderlagSaknas, relevantCampaigns, campaignsBlock, campaignAreas, type CampaignForPlan } from "@/lib/server/weekInput";


export const runtime = "nodejs";
export const maxDuration = 60;

/** Kontots senaste foretag, med company_brain. RLS gor att bara egna
 *  rader nas. Kolumnerna ar exakt de PlanCompanyRow bar - inget annat
 *  ur raden behovs for planen. */
async function getCompanyRow(supabase: SupabaseClient, userId: string): Promise<PlanCompanyRow | null> {
  try {
    const { data } = await supabase
      .from("companies")
      .select("name, industry, summary, customers, products, tone, strengths, avoid, content_guidelines, company_brain")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(1);
    return (data?.[0] as PlanCompanyRow) ?? null;
  } catch {
    return null;
  }
}

type PastPlan = {
  created_at: string;
  focus: string;
  tags: string[];
  posts: { title: string }[];
};

async function getPastPlans(supabase: SupabaseClient, companyName: string, userId: string): Promise<PastPlan[]> {
  try {
    const { data: company } = await supabase
      .from("companies")
      .select("id")
      .eq("name", companyName)
      .eq("user_id", userId)
      .limit(1)
      .maybeSingle();

    if (!company) return [];

    const { data: plans } = await supabase
      .from("plans")
      .select("created_at, focus, tags, posts")
      .eq("company_id", company.id)
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(3);

    return (plans as PastPlan[]) ?? [];
  } catch {
    return [];
  }
}
/**
 * Tummarna som signal om ämne och ton.
 *
 * Läser ALLA rader för företaget, även de som saknar plan_id. Sedan
 * 0008 vet gränssnittet vilken plan en tumme gäller och visar bara
 * rätt ones — men för inlärningen spelar det ingen roll vilken plan en
 * titel kom från. "Gillade: Så här ser du om slangen behöver bytas" är
 * lika användbart oavsett vecka. Att kasta de gamla raderna vore att
 * slänga den enda feedback användaren faktiskt hunnit ge.
 */
async function getFeedback(supabase: SupabaseClient, companyName: string, userId: string) {
  try {
    const { data } = await supabase
      .from("content_feedback")
      .select("post_title, rating_text")
      .eq("company_name", companyName)
      .eq("user_id", userId);

    const liked = (data ?? []).filter(f => f.rating_text === "up").map(f => f.post_title);
    const disliked = (data ?? []).filter(f => f.rating_text === "down").map(f => f.post_title);
    return { liked, disliked };
  } catch {
    return { liked: [], disliked: [] };
  }
}

/** Kontots kampanjer med strategin inbäddad. RLS gör att bara egna rader
 *  nås. Går hämtningen inte igenom blir det en plan utan kampanjblock,
 *  inte ett fel — kampanjerna är underlag, inte förutsättning. */
async function getCampaigns(supabase: SupabaseClient, userId: string): Promise<CampaignForPlan[]> {
  try {
    const { data } = await supabase
      .from("campaigns")
      .select("title,status,starts_on,ends_on,strategy:campaign_strategies(strategy_context)")
      .eq("user_id", userId)
      .in("status", ["planned", "active"]);
    return (data as unknown as CampaignForPlan[]) ?? [];
  } catch {
    return [];
  }
}

export async function POST(request: Request) {
  const requestId = crypto.randomUUID().slice(0, 8);

  const guarded = await guardAiRequest("generate-plan");
  if (!guarded.ok) return guarded.response;
  const { guard } = guarded;

  try {
    // Identiteten kommer ALLTID från sessionen — aldrig från request-body.
    const userId = guard.user.id;

    // INGEN FÖRETAGSDATA LÄSES UR REQUEST-BODY.
    //
    // Tidigare skickade klienten hela companyProfile hit, och prompten
    // byggdes på den. Det innebar att vem som helst kunde generera en
    // plan mot påhittade produkter och styrkor genom att skicka en egen
    // body — och, mer vardagligt, att prompten fick klientens kopia i
    // stället för det som faktiskt står i databasen. Allt hämtas nu
    // server-side via den RLS-scopade klienten.
    //
    // Bodyn bär EN sak: det företagaren själv skrivit om veckan. Den är
    // data om veckan, aldrig företagsdata och aldrig prompttext, och den
    // städas och kortas i parseWeekInput. Ett anrop utan body fungerar
    // som förut.
    const body = await request.json().catch(() => null) as { weekInput?: unknown } | null;
    const weekInput = parseWeekInput(body?.weekInput);

    const company = await getCompanyRow(guard.supabase, userId);
    if (!company) {
      await guard.finish({ status: "error", errorCategory: "missing_profile" });
      return safeError("Ingen företagsprofil hittades på kontot.", 400);
    }

    // Profil och Company Brain ur SAMMA rad. Hjärnan hämtades tidigare
    // med en egen fråga, och då fanns en väg där profilen kom fram men
    // hjärnan inte gjorde det.
    const { profile, brain, locationDetails } = planContextFromRow(company);

    // Datum och veckonummer formas numera inne i planPrompt.
    const now = new Date();

    // Datumen räknas ut, inte gissas (se planCalendar.ts). Möjligheterna
    // får bara väljas ur samma lista och filtreras mot den efteråt.
    const today = stockholmIso(now);
    const calendar = upcomingCalendar(today);
    const upcomingDates = calendarLines(calendar);

    const campaignRows = relevantCampaigns(await getCampaigns(guard.supabase, userId), today);
    const campaignsContext = campaignsBlock(campaignRows, today);
    // Lär av hur användaren brukar skriva om planens inlägg.
    const editMemory = await editMemoryBlock("plan_post");

    // Hämta historik från Supabase (RLS-scopat till den inloggade användaren)
    const pastPlans = await getPastPlans(guard.supabase, profile.companyName ?? "", userId);

    // Hämta tidigare feedback (tummar)
    const { liked, disliked } = await getFeedback(guard.supabase, profile.companyName ?? "", userId);
    const feedbackContext = (liked.length > 0 || disliked.length > 0)
      ? `\nANVÄNDARENS FEEDBACK PÅ TIDIGARE INLÄGG:
${liked.length > 0 ? `Gillade (skapa fler i denna stil och ton):\n${liked.map(t => `  + ${t}`).join("\n")}` : ""}
${disliked.length > 0 ? `Gillade INTE (undvik dessa mönster, ämnen och denna ton):\n${disliked.map(t => `  - ${t}`).join("\n")}` : ""}`
      : "";

    const historyContext = pastPlans.length > 0
      ? `\nTIDIGARE PLANER (undvik att upprepa dessa teman och inläggstitlar):
${pastPlans.map((p, i) => {
  const date = new Date(p.created_at).toLocaleDateString("sv-SE", { day: "numeric", month: "long" });
  const titles = Array.isArray(p.posts) ? p.posts.map((post: { title: string }) => `  - ${post.title}`).join("\n") : "";
  return `Plan ${i + 1} (${date}):
  Fokus: ${p.focus}
  Teman: ${Array.isArray(p.tags) ? p.tags.join(", ") : ""}
  Inläggstitlar:\n${titles}`;
}).join("\n\n")}`
      : "";

    // Uppladdat material kom från /profile, som togs bort i en tidigare
    // sprint. Ingen producent finns kvar, och enda stället det kunde
    // komma ifrån nu vore request-body — vilket är precis vad den här
    // routen inte längre läser.
    const fileContext = "";

    const systemPrompt = PLAN_SYSTEM_PROMPT;
    const userPrompt = buildPlanUserPrompt({
      profile, brain, now, upcomingDates,
      historyContext, feedbackContext, fileContext, editMemory,
      weekInput, campaignsContext,
      locationDetails, campaignAreas: campaignAreas(campaignRows),
    });

    const result = await callChatJson(systemPrompt, userPrompt, {
      maxTokens: AI.MAX_OUTPUT_TOKENS,
      model: AI.PLAN_MODEL,
    });
    let plan = result.parsed as PlanShape;

    // Reparationsrunda: modellen skriver konsekvent for korta texter pa
    // svenska oavsett hur kravet formuleras (se lib/server/planRepair.ts).
    // Har raknas orden i stallet, och bara de texter som ligger under
    // golvet skickas tillbaka for utokning. Ett extra anrop, bara vid
    // behov, och misslyckas det behaller vi originalet.
    const forKorta = hittaForKorta(plan);
    if (forKorta.length > 0) {
      try {
        const repair = await callChatJson(
          PLAN_SYSTEM_PROMPT,
          buildRepairPrompt(plan, forKorta),
          { maxTokens: AI.MAX_OUTPUT_TOKENS, model: AI.PLAN_MODEL },
        );
        const texts = (repair.parsed as { texts?: Record<string, string> })?.texts;
        if (texts) plan = applyRepair(plan, texts);
      } catch (e) {
        console.warn(`[${requestId}] Utokningen misslyckades, behaller originalet:`, e);
      }
    }

    // Markera platshallare och normalisera veckodagarna. Texten rors
    // aldrig - att gissa fram ett faktum vore precis det problem en
    // platshallare avslojar. Inlagget far i stallet med sig vad som
    // saknas, och granssnittet visar det.
    plan = valideraPlan(plan, brain.websites);
    plan = { ...plan, opportunities: filterOpportunities(plan.opportunities, calendar) };
    // Det modellen behöver veta om veckans underlag. Visas på Idag direkt
    // efter att planen skapats; sparas inte, det är en fråga, inte innehåll.
    const underlagSaknas = parseUnderlagSaknas(plan.underlag_saknas, Boolean(weekInput));
    delete (plan as { underlag_saknas?: unknown }).underlag_saknas;
    // Nyhetsbrevet ingår inte längre. Skickar modellen ett ändå sparas det inte.
    delete (plan as { newsletter?: unknown }).newsletter;

    await guard.finish({
      status: "ok",
      // Planens modell, inte chattmodellen. Tidigare loggades AI.CHAT_MODEL
      // här, så användningsloggen visade fel modell för varje veckoplan.
      model: AI.PLAN_MODEL,
      promptTokens: result.promptTokens,
      completionTokens: result.completionTokens,
    });
    return Response.json({ ...plan, weekInput, underlagSaknas });

  } catch (error) {
    const failure = classifyAiError(error, "planen");
    // Bär felet modell och tokens (ModelJsonError) följer de med hit, så
    // raden i ai_usage_events visar vilken modell som svarade och hur mycket
    // den hann generera. Andra fel loggas precis som förut.
    const usage = modelUsageFrom(error);
    console.error(`GENERATE_PLAN ${requestId}: ${failure.kind} ${failure.logTag}`);
    await guard.finish({ status: "error", errorCategory: `${failure.kind}:${failure.logTag}`, ...usage });
    return safeError(failure.message, failure.httpStatus);
  }
}

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
import { getCompanyBrainContext } from "@/lib/companyBrainServer";
import { PLAN_SYSTEM_PROMPT, buildPlanUserPrompt, type PlanCompanyProfile } from "@/lib/server/planPrompt";
import { hittaForKorta, buildRepairPrompt, applyRepair, type PlanShape } from "@/lib/server/planRepair";
import { valideraPlan } from "@/lib/server/planValidate";


export const runtime = "nodejs";
export const maxDuration = 60;

/** Den platta foretagsraden, hamtad server-side. */
type CompanyRow = {
  name: string; industry?: string | null; summary?: string | null;
  customers?: string[] | null; products?: string[] | null; tone?: string[] | null;
  strengths?: string[] | null; avoid?: string[] | null;
  content_guidelines?: string[] | null;
};

/** Kontots senaste foretag. RLS gor att bara egna rader nas. */
async function getCompanyRow(supabase: SupabaseClient, userId: string): Promise<CompanyRow | null> {
  try {
    const { data } = await supabase
      .from("companies")
      .select("name, industry, summary, customers, products, tone, strengths, avoid, content_guidelines")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(1);
    return (data?.[0] as CompanyRow) ?? null;
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

export async function POST() {
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
    // Bodyn läses inte alls. Ett anrop utan body fungerar.
    const company = await getCompanyRow(guard.supabase, userId);
    if (!company) {
      await guard.finish({ status: "error", errorCategory: "missing_profile" });
      return safeError("Ingen företagsprofil hittades på kontot.", 400);
    }

    const profile: PlanCompanyProfile = {
      companyName: company.name,
      industry: company.industry ?? "",
      summary: company.summary ?? "",
      customers: company.customers ?? [],
      products: company.products ?? [],
      tone: company.tone ?? [],
      strengths: company.strengths ?? [],
      avoid: company.avoid ?? [],
      contentGuidelines: company.content_guidelines ?? [],
    };

    // Datum och veckonummer formas numera inne i planPrompt.
    const now = new Date();

    const upcomingDates = getUpcomingDates(now);
    // Lär av hur användaren brukar skriva om planens inlägg.
    const editMemory = await editMemoryBlock("plan_post");

    // Company Brain, hämtad server-side ur sessionen. Bär prioritet,
    // lönsamhet, säsong och marknadsföringsmål — allt som de platta
    // kolumnerna saknar.
    const brain = await getCompanyBrainContext();

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
    plan = valideraPlan(plan, brain?.websites);

    await guard.finish({
      status: "ok",
      model: AI.CHAT_MODEL,
      promptTokens: result.promptTokens,
      completionTokens: result.completionTokens,
    });
    return Response.json(plan);

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

function getUpcomingDates(from: Date): string {
  const events: { month: number; day: number; name: string }[] = [
    { month: 1, day: 1, name: "Nyårsdagen" },
    { month: 1, day: 6, name: "Trettondedag jul" },
    { month: 2, day: 14, name: "Alla hjärtans dag" },
    { month: 3, day: 8, name: "Internationella kvinnodagen" },
    { month: 4, day: 1, name: "April fools / Första april" },
    { month: 4, day: 30, name: "Valborg" },
    { month: 5, day: 1, name: "Första maj / Arbetarnas dag" },
    { month: 5, day: 31, name: "Nationaldagen (nästan)" },
    { month: 6, day: 6, name: "Sveriges nationaldag" },
    { month: 6, day: 21, name: "Midsommarafton" },
    { month: 6, day: 22, name: "Midsommardagen" },
    { month: 7, day: 1, name: "Sommarlovets mitt — semesterhögsäsong" },
    { month: 8, day: 1, name: "Högsommaren — sista semesterveckorna" },
    { month: 8, day: 15, name: "Semestern tar slut för många" },
    { month: 9, day: 1, name: "Hösten börjar — tillbaka till jobbet" },
    { month: 10, day: 31, name: "Halloween" },
    { month: 11, day: 1, name: "Alla helgons dag" },
    { month: 11, day: 11, name: "Mårtensgås" },
    { month: 11, day: 25, name: "Black Friday (nästan)" },
    { month: 11, day: 29, name: "Black Friday" },
    { month: 12, day: 1, name: "Advent börjar" },
    { month: 12, day: 13, name: "Lucia" },
    { month: 12, day: 24, name: "Julafton" },
    { month: 12, day: 25, name: "Juldagen" },
    { month: 12, day: 31, name: "Nyårsafton" },
  ];

  const upcoming: string[] = [];
  const end = new Date(from);
  end.setDate(end.getDate() + 14);

  for (const event of events) {
    const eventDate = new Date(from.getFullYear(), event.month - 1, event.day);
    if (eventDate >= from && eventDate <= end) {
      upcoming.push(`- ${event.day} ${eventDate.toLocaleString("sv-SE", { month: "long" })}: ${event.name}`);
    }
    const eventDateNextYear = new Date(from.getFullYear() + 1, event.month - 1, event.day);
    if (eventDateNextYear >= from && eventDateNextYear <= end) {
      upcoming.push(`- ${event.day} ${eventDateNextYear.toLocaleString("sv-SE", { month: "long" })}: ${event.name}`);
    }
  }

  const m = from.getMonth() + 1;
  if (m >= 6 && m <= 8) upcoming.push("- SÄSONG: Högsommar — semester, camping, friluftsliv");
  if (m >= 9 && m <= 11) upcoming.push("- SÄSONG: Höst — förberedelser, service inför vintern");
  if (m === 12 || m <= 2) upcoming.push("- SÄSONG: Vinter — inomhusaktiviteter, julkänsla, nyår");
  if (m >= 3 && m <= 5) upcoming.push("- SÄSONG: Vår — uppstart, städning, förberedelser");

  return upcoming.length > 0
    ? upcoming.join("\n")
    : `- Ingen specifik högtid denna vecka — fokusera på säsongsrelevant innehåll för ${from.toLocaleString("sv-SE", { month: "long" })}`;
}
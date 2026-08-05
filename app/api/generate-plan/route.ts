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
import { callChatJson, AI } from "@/lib/server/ai";
import { voiceBlock, isoWeek } from "@/lib/server/voice";

export const runtime = "nodejs";
export const maxDuration = 60;

type CompanyProfile = {
  companyName?: string; industry?: string; summary?: string;
  customers?: string[]; products?: string[]; tone?: string[];
  strengths?: string[]; avoid?: string[]; contentGuidelines?: string[];
};

type BrainFile = {
  name: string; size: number; type: string; addedAt: string; content?: string;
};

type GeneratePlanBody = {
  companyProfile?: CompanyProfile;
  brainFiles?: BrainFile[];
};

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

export async function POST(request: Request) {
  const requestId = crypto.randomUUID().slice(0, 8);

  const guarded = await guardAiRequest("generate-plan");
  if (!guarded.ok) return guarded.response;
  const { guard } = guarded;

  try {
    let body: GeneratePlanBody;
    try {
      body = await request.json();
    } catch {
      await guard.finish({ status: "error", errorCategory: "bad_json" });
      return safeError("Ogiltig förfrågan.", 400);
    }
    const profile = body.companyProfile;
    const brainFiles = body.brainFiles ?? [];
    // Identiteten kommer ALLTID från sessionen — aldrig från request-body.
    const userId = guard.user.id;

    if (!profile) {
      await guard.finish({ status: "error", errorCategory: "missing_profile" });
      return safeError("Företagsprofil saknas.", 400);
    }

    const now = new Date();
    const year = now.getFullYear();
    const month = now.toLocaleString("sv-SE", { month: "long" });
    const day = now.getDate();
    // ISO 8601 — den tidigare approximationen gav fel vecka stora delar av året.
    const week = isoWeek(now);

    const upcomingDates = getUpcomingDates(now);

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

    const fileContext = brainFiles.length > 0
      ? `\nUPPLADDAT MATERIAL:\n${brainFiles.map(f => {
          let line = `- ${f.name} (${f.type})`;
          if (f.content) line += `\n  Innehåll: ${f.content.slice(0, 800)}`;
          return line;
        }).join("\n")}`
      : "";

    const systemPrompt = `Du är en erfaren copywriter och marknadsstrateg specialiserad på lokala svenska tjänsteföretag.
Skapa marknadsinnehåll som känns skrivet av någon som KÄNNER företaget inifrån — inte av en AI.
Svara ALLTID med exakt giltig JSON — ingen förtext, inga backticks. Svara på svenska.`;

    const userPrompt = `NULÄGE: ${day} ${month} ${year}, vecka ${week}.

KOMMANDE HÄNDELSER OCH DATUM (nästa 2 veckor):
${upcomingDates}
${historyContext}
${feedbackContext}

FÖRETAGSPROFIL:
Företagsnamn: ${profile.companyName ?? ""}
Bransch: ${profile.industry ?? ""}
Sammanfattning: ${profile.summary ?? ""}
Kunder: ${(profile.customers ?? []).join(", ")}
Produkter och tjänster: ${(profile.products ?? []).join(", ")}
Tonalitet: ${(profile.tone ?? []).join(", ")}
Styrkor: ${(profile.strengths ?? []).join(", ")}
Ska undvikas: ${(profile.avoid ?? []).join(", ")}
Innehållsriktlinjer: ${(profile.contentGuidelines ?? []).join(", ")}
${fileContext}

${voiceBlock({ variation: true })}

DESSUTOM:
1. Använd ALLTID företagets faktiska namn och specifika tjänster
2. Anpassa till ${day} ${month} ${year} — rätt år är ${year}, inte något tidigare år
3. Matcha branschens verkliga språk
4. Upprepa INTE teman, fokus eller inläggstitlar från tidigare planer
5. Om användaren gett feedback ovan: luta tydligt mot de gillade inläggens stil och ton, och undvik mönstren i de ogillade

Returnera exakt denna JSON:
{
  "company": "${profile.companyName ?? ""}",
  "focus": "En mening om veckans tema — specifik och säsongsanpassad för ${month} ${year}",
  "tags": ["3-5 konkreta teman för veckan, ej enkla ord utan fraser som 'Midsommarförberedelser' eller 'Campingsäsongen startar'"],
  "posts": [
    { "title": "Rubrik som fångar ett konkret problem", "text": "Max 3 meningar. Konkret scenario.", "cta": "Specifik uppmaning", "image": "Realistisk bildidé" },
    { "title": "Tips-format", "text": "Praktisk insikt från branschen", "cta": "Konkret CTA", "image": "Bildidé" },
    { "title": "Säsongsrelevant för ${month} ${year}", "text": "Kopplat till vad som händer nu", "cta": "Konkret CTA", "image": "Bildidé" },
    { "title": "Bakom-kulisserna eller kundperspektiv", "text": "Berättande, bygger förtroende", "cta": "Konkret CTA", "image": "Bildidé" },
    { "title": "Experttips eller vanligt misstag", "text": "Positionerar som specialist", "cta": "Konkret CTA", "image": "Bildidé" }
  ],
  "newsletter": {
    "subject": "Ämnesrad max 50 tecken",
    "preview": "Förhandsvisning max 85 tecken",
    "body": "3 stycken: scenario → lösning → varför just nu i ${month} ${year}",
    "cta": "Specifik uppmaning"
  },
  "campaigns": [
    { "title": "Kampanj för ${month} ${year}", "goal": "Vad kampanjen uppnår", "message": "Budskap 2-3 meningar", "channels": "Kanaler", "cta": "CTA" },
    { "title": "Kampanj för ${profile.products?.[0] ?? "huvudtjänst"}", "goal": "Vad kampanjen uppnår", "message": "Budskap 2-3 meningar", "channels": "Kanaler", "cta": "CTA" }
  ],
  "opportunities": [
    {
      "title": "Konkret händelse, temadag eller säsongstillfälle inom 2 veckor",
      "date": "Datum eller tidsperiod t.ex. '21 juni' eller 'Denna vecka'",
      "relevance": "Exakt hur ${profile.companyName ?? "företaget"} kan använda detta — konkret innehållsidé kopplad till deras tjänster"
    },
    {
      "title": "Säsongsbeteende hos målgruppen just nu",
      "date": "Denna vecka eller nästa vecka",
      "relevance": "Konkret marknadsföringsidé kopplad till vad målgruppen gör just nu"
    },
    {
      "title": "Branschspecifikt tillfälle eller lokal händelse",
      "date": "Tidsangivelse",
      "relevance": "Hur företaget kan agera på detta med specifikt innehåll eller erbjudande"
    }
  ]
}`;

    const result = await callChatJson(systemPrompt, userPrompt, { maxTokens: AI.MAX_OUTPUT_TOKENS });
    const plan = result.parsed;

    await guard.finish({
      status: "ok",
      model: AI.CHAT_MODEL,
      promptTokens: result.promptTokens,
      completionTokens: result.completionTokens,
    });
    return Response.json(plan);

  } catch (error) {
    const name = error instanceof Error ? error.name : "UnknownError";
    console.error(`GENERATE_PLAN ${requestId}: ${name}`);
    await guard.finish({ status: "error", errorCategory: name });
    const status = name === "AbortError" ? 504 : 500;
    const message = name === "AbortError" ? "Det tog för lång tid att generera planen. Försök igen." : "Kunde inte generera marknadsplan.";
    return safeError(message, status);
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
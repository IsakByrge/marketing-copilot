import OpenAI from "openai";
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

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
  userId?: string;
};

type PastPlan = {
  created_at: string;
  focus: string;
  tags: string[];
  posts: { title: string }[];
};

async function getPastPlans(companyName: string, userId: string): Promise<PastPlan[]> {
  try {
    const { data: company } = await supabase
      .from("companies")
      .select("id")
      .eq("name", companyName)
      .eq("user_id", userId)
      .single();

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

export async function POST(request: Request) {
  try {
    const body: GeneratePlanBody = await request.json();
    const profile = body.companyProfile;
    const brainFiles = body.brainFiles ?? [];

    if (!profile) {
      return NextResponse.json({ error: "Företagsprofil saknas." }, { status: 400 });
    }

    const now = new Date();
    const year = now.getFullYear();
    const month = now.toLocaleString("sv-SE", { month: "long" });
    const day = now.getDate();
    const jan1 = new Date(now.getFullYear(), 0, 1);
    const week = Math.ceil(
      ((now.getTime() - jan1.getTime()) / 86400000 + jan1.getDay() + 1) / 7
    );

    const upcomingDates = getUpcomingDates(now);

    // Hämta historik från Supabase
    const userId = body.userId ?? "";
const pastPlans = await getPastPlans(profile.companyName ?? "", userId);
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

KRITISKA REGLER:
1. Använd ALLTID företagets faktiska namn och specifika tjänster
2. Anpassa till ${day} ${month} ${year} — rätt år är ${year}
3. Matcha branschens verkliga språk
4. CTA:er ska vara konkreta handlingar, inte "Kontakta oss"
5. Hitta INTE på fakta som inte framgår av profilen
6. Variera innehållet — upprepa INTE teman, fokus eller inläggstitlar från tidigare planer

FÖRBJUDNA FRASER:
- "Vi strävar efter att leverera kvalitet"
- "Nöjda kunder är vår prioritet"
- "Med lång erfarenhet inom branschen"
- "Tveka inte att höra av dig"
- "I dagens digitala värld"
- Alla generiska fraser som kan gälla vilket företag som helst

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

    const response = await client.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      response_format: { type: "json_object" },
    });

    const raw = response.choices[0]?.message?.content || "";
    const plan = JSON.parse(raw);
    return NextResponse.json(plan);

  } catch (error) {
    console.error("GENERATE_PLAN_ERROR:", error);
    return NextResponse.json({ error: "Kunde inte generera marknadsplan." }, { status: 500 });
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
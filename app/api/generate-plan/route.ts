import OpenAI from "openai";
import { NextResponse } from "next/server";

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

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
    const jan1 = new Date(now.getFullYear(), 0, 1);
    const week = Math.ceil(
      ((now.getTime() - jan1.getTime()) / 86400000 + jan1.getDay() + 1) / 7
    );

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

    const userPrompt = `NULÄGE: ${month} ${year}, vecka ${week}.

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
2. Anpassa till ${month} ${year} — rätt år är ${year}, INTE 2024
3. Matcha branschens verkliga språk
4. CTA:er ska vara konkreta handlingar, inte "Kontakta oss"
5. Hitta INTE på fakta som inte framgår av profilen

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
  "tags": ["tema 1", "tema 2", "tema 3"],
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
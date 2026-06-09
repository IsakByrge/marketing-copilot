import OpenAI from "openai";
import { NextResponse } from "next/server";

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

type CompanyProfile = {
  companyName?: string;
  industry?: string;
  summary?: string;
  customers?: string[];
  products?: string[];
  tone?: string[];
  strengths?: string[];
  avoid?: string[];
  contentGuidelines?: string[];
};

type BrainFile = {
  name: string;
  size: number;
  type: string;
  addedAt: string;
  content?: string;
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
      return NextResponse.json(
        { error: "Företagsprofil saknas." },
        { status: 400 }
      );
    }

    // Build week + month context
    const now = new Date();
    const month = now.toLocaleString("sv-SE", { month: "long" });
    const jan1 = new Date(now.getFullYear(), 0, 1);
    const week = Math.ceil(
      ((now.getTime() - jan1.getTime()) / 86400000 + jan1.getDay() + 1) / 7
    );

    // Build brain files context
    const fileContext = brainFiles.length > 0
      ? `\nUPPLADDAT MATERIAL (använd detta för djupare förståelse):\n${brainFiles
          .map(f => {
            let line = `- ${f.name} (${f.type})`;
            if (f.content) line += `\n  Innehåll: ${f.content.slice(0, 800)}`;
            return line;
          })
          .join("\n")}`
      : "";

    const response = await client.responses.create({
      model: "gpt-4.1-mini",
      input: `Du är en erfaren copywriter och marknadsstrateg specialiserad på lokala svenska tjänsteföretag.

DITT UPPDRAG: Skapa marknadsinnehåll som känns skrivet av någon som KÄNNER företaget inifrån — inte av en AI.

NULÄGE: ${month}, vecka ${week}.

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
1. Använd ALLTID företagets faktiska namn och specifika tjänster — aldrig "era tjänster" generellt
2. Anpassa till ${month} och vecka ${week} — nämn säsongen och relevanta händelser där det passar
3. Matcha branschens verkliga språk — en gasolfirma pratar inte som en frisör
4. CTA:er ska vara konkreta handlingar, inte "Kontakta oss"
5. Hitta INTE på fakta om orter, priser, garantier, certifieringar eller specifika resultat som inte framgår av profilen

FÖRBJUDNA FRASER — använd ALDRIG:
- "Vi strävar efter att leverera kvalitet"
- "Nöjda kunder är vår prioritet"
- "Med lång erfarenhet inom branschen"
- "Tveka inte att höra av dig"
- "I dagens digitala värld"
- "Vi på [företag] är stolta"
- Alla generiska fraser som kan gälla vilket företag som helst

BRA INNEHÅLL:
- Refererar till specifika scenarion kunden känner igen
- Sätter upp ett problem INNAN lösningen presenteras
- Är konkret nog att publiceras direkt utan redigering
- Känns skrivet av en människa som jobbar i branschen

Returnera ENDAST giltig JSON i exakt denna struktur. Ingen markdown, inga kommentarer:

{
  "company": "${profile.companyName ?? ""}",
  "focus": "En mening om veckans marknadsföringstema — specifik och säsongsanpassad",
  "tags": ["3-5 konkreta teman för veckan"],
  "posts": [
    {
      "title": "Rubrik som fångar ett konkret problem eller behov",
      "text": "Inläggstext — kort nog att publiceras direkt, max 3 meningar. Konkret scenario kunden känner igen.",
      "cta": "Specifik uppmaning med tydlig handling",
      "image": "Realistisk bildidé enkel att fotografera med mobil"
    },
    {
      "title": "Tips-format: Visste du att... eller 3 tecken på att...",
      "text": "Inläggstext med praktisk insikt från branschen",
      "cta": "Konkret CTA",
      "image": "Bildidé"
    },
    {
      "title": "Säsongsrelevant rubrik för ${month}",
      "text": "Inläggstext kopplad till vad som händer just nu för målgruppen",
      "cta": "Konkret CTA",
      "image": "Bildidé"
    },
    {
      "title": "Bakom-kulisserna eller kundperspektiv",
      "text": "Mer berättande inlägg som bygger förtroende",
      "cta": "Konkret CTA",
      "image": "Bildidé"
    },
    {
      "title": "Experttips eller vanligt misstag i branschen",
      "text": "Inlägg som positionerar företaget som specialist",
      "cta": "Konkret CTA",
      "image": "Bildidé"
    }
  ],
  "newsletter": {
    "subject": "Ämnesrad som skapar nyfikenhet, max 50 tecken, refererar till specifik tjänst eller scenario",
    "preview": "Kompletterande förhandsvisningstext, max 85 tecken",
    "body": "3 stycken: 1) Konkret scenario kunden känner igen. 2) Hur ${profile.companyName ?? "företaget"} löser det specifikt. 3) Varför just nu i ${month}.",
    "cta": "Specifik uppmaning med tydlig handling"
  },
  "campaigns": [
    {
      "title": "Kampanjnamn kopplat till ${month}",
      "goal": "Vad kampanjen ska uppnå",
      "message": "Kampanjbudskapet i 2-3 meningar — specifikt och säsongsanpassat",
      "channels": "Rekommenderade kanaler",
      "cta": "Kampanjens call to action"
    },
    {
      "title": "Kampanjnamn kopplat till ${profile.products?.[0] ?? "huvudtjänst"}",
      "goal": "Vad kampanjen ska uppnå",
      "message": "Kampanjbudskapet i 2-3 meningar",
      "channels": "Rekommenderade kanaler",
      "cta": "Kampanjens call to action"
    }
  ]
}`,
    });

    const rawText = response.output_text;
    const cleanedText = rawText.replace(/```json/g, "").replace(/```/g, "").trim();
    const firstBrace = cleanedText.indexOf("{");
    const lastBrace = cleanedText.lastIndexOf("}");

    if (firstBrace === -1 || lastBrace === -1) {
      throw new Error("OpenAI returnerade ingen JSON.");
    }

    const plan = JSON.parse(cleanedText.slice(firstBrace, lastBrace + 1));
    return NextResponse.json(plan);

  } catch (error) {
    console.error("GENERATE_PLAN_ERROR:", error);
    return NextResponse.json(
      { error: "Kunde inte generera marknadsplan." },
      { status: 500 }
    );
  }
}
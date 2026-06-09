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

type GeneratePlanBody = {
  companyProfile?: CompanyProfile;
};

export async function POST(request: Request) {
  try {
    const body: GeneratePlanBody = await request.json();
    const profile = body.companyProfile;

    if (!profile) {
      return NextResponse.json(
        { error: "Företagsprofil saknas." },
        { status: 400 }
      );
    }

    const response = await client.responses.create({
      model: "gpt-4.1-mini",
      input: `
Du är en erfaren svensk marknadschef för småföretag.

Din uppgift är att skapa en konkret veckoplan baserad på företagets AI-profil.

FÖRETAGSPROFIL:
Företagsnamn: ${profile.companyName ?? ""}
Bransch: ${profile.industry ?? ""}
Sammanfattning: ${profile.summary ?? ""}

Kunder:
${(profile.customers ?? []).map((item) => `- ${item}`).join("\n")}

Produkter och tjänster:
${(profile.products ?? []).map((item) => `- ${item}`).join("\n")}

Tonalitet:
${(profile.tone ?? []).map((item) => `- ${item}`).join("\n")}

Styrkor:
${(profile.strengths ?? []).map((item) => `- ${item}`).join("\n")}

Ska undvika:
${(profile.avoid ?? []).map((item) => `- ${item}`).join("\n")}

Riktlinjer för innehåll:
${(profile.contentGuidelines ?? []).map((item) => `- ${item}`).join("\n")}

VIKTIGT:
Planen får inte innehålla information som inte finns i profilen.
Om företaget inte har angett ort, skriv inte ort.
Om företaget inte har angett pris, rabatt eller kampanj, skriv inte pris, rabatt eller kampanj.
Om företaget inte har angett garanti, skriv inte garanti.

Returnera ENDAST giltig JSON i exakt denna struktur:

{
  "company": "",
  "focus": "",
  "tags": [],
  "posts": [
    {
      "title": "",
      "text": "",
      "cta": "",
      "image": ""
    }
  ],
  "newsletter": {
    "subject": "",
    "preview": "",
    "body": "",
    "cta": ""
  },
  "campaigns": [
    {
      "title": "",
      "goal": "",
      "message": "",
      "channels": "",
      "cta": ""
    }
  ]
}

Regler:
- Skriv på svenska.
- Skapa exakt 5 sociala inlägg.
- Skapa exakt 2 kampanjer.
- All text måste följa tonaliteten från profilen.
- Allt som står under "Ska undvika" är förbjudet att använda.
- Innehållet måste följa riktlinjerna under "Riktlinjer för innehåll".
- Bygg planen på företagets sammanfattning, kunder, produkter/tjänster och styrkor.
- Hitta inte på fakta om orter, antal anläggningar, priser, rabatter, erbjudanden, öppettider, garantier, certifieringar eller specifika resultat.
- Om något inte framgår av profilen, skriv generellt.
- Använd inte emojis om profilen säger att emojis ska undvikas.
- Använd inte engelska buzzwords om profilen säger att det ska undvikas.
- Använd inte skämtsam ton om profilen säger att det ska undvikas.
- Använd inte billigt säljspråk om profilen säger att det ska undvikas.
- Gör innehållet konkret, praktiskt och användbart.
- Undvik generiska AI-formuleringar som "i dagens digitala värld".
- Varje socialt inlägg ska vara kort nog att kunna publiceras direkt.
- CTA ska vara konkret men inte pushig.
- Bildidéerna ska vara realistiska och enkla att skapa.
- Returnera endast JSON. Ingen markdown, inga kommentarer, ingen förklaring.
`,
    });

    const rawText = response.output_text;

    const cleanedText = rawText
      .replace(/```json/g, "")
      .replace(/```/g, "")
      .trim();

    const firstBrace = cleanedText.indexOf("{");
    const lastBrace = cleanedText.lastIndexOf("}");

    if (firstBrace === -1 || lastBrace === -1) {
      throw new Error("OpenAI returnerade ingen JSON.");
    }

    const jsonText = cleanedText.slice(firstBrace, lastBrace + 1);
    const plan = JSON.parse(jsonText);

    return NextResponse.json(plan);
  } catch (error) {
    console.error("GENERATE_PLAN_ERROR:", error);

    return NextResponse.json(
      { error: "Kunde inte generera marknadsplan." },
      { status: 500 }
    );
  }
}
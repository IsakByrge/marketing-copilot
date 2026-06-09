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
- Hitta inte på fakta om orter, antal anläggningar, priser, erbjudanden, öppettider eller garantier.
- Om något inte framgår av profilen, skriv generellt.
- Följ tonaliteten från profilen.
- Undvik allt som profilen säger att företaget vill undvika.
- Gör innehållet konkret, praktiskt och användbart.
- Undvik generiska AI-formuleringar som "i dagens digitala värld".
- Varje socialt inlägg ska vara kort nog att kunna publiceras direkt.
- CTA ska vara konkret men inte för pushig.
- Bildidéerna ska vara realistiska och enkla att skapa.
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
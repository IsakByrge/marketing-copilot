import { setGeneratedPlan } from "@/lib/generatedPlan";
import OpenAI from "openai";
import { NextResponse } from "next/server";

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

type GeneratePlanBody = {
  company?: string;
  industry?: string;
  focus?: string;
};

export async function POST(request: Request) {
  try {
    let body: GeneratePlanBody = {};

    try {
      body = await request.json();
    } catch {
      body = {};
    }

    const company = body.company ?? "Gasolfyllarna";
    const industry = body.industry ?? "Gasol";
    const focus = body.focus ?? "Sommarens gasolsäsong";

    const response = await client.responses.create({
      model: "gpt-4.1-mini",
      input: [
        {
          role: "system",
          content:
            "Du är en svensk marknadschef för småföretag. Du returnerar alltid endast giltig JSON, utan markdown och utan förklarande text.",
        },
        {
          role: "user",
          content: `
Skapa en veckoplan för:

Företag: ${company}
Bransch: ${industry}
Fokus: ${focus}

Returnera exakt denna JSON-struktur:

{
  "company": "Företagsnamn",
  "focus": "Veckans fokus",
  "tags": ["Tagg 1", "Tagg 2", "Tagg 3", "Tagg 4"],
  "posts": [
    {
      "title": "Rubrik",
      "text": "Inläggstext",
      "cta": "Call to action",
      "image": "Bildidé"
    }
  ],
  "newsletter": {
    "subject": "Ämnesrad",
    "preview": "Förhandsvisningstext",
    "body": "Nyhetsbrevets innehåll",
    "cta": "Call to action"
  },
  "campaigns": [
    {
      "title": "Kampanjtitel",
      "goal": "Mål",
      "message": "Budskap",
      "channels": "Kanaler",
      "cta": "Call to action"
    }
  ]
}

Regler:
- Skriv på svenska.
- Skapa exakt 5 sociala inlägg.
- Skapa exakt 2 kampanjer.
- Var konkret, lokalt och praktiskt.
- Undvik AI-känsla.
- Undvik överdrivet säljspråk.
- Skriv som en erfaren marknadschef, inte som en reklambyrå.
- Returnera endast JSON.
`,
        },
      ],
    });

    const text = response.output_text;

    console.log("OPENAI RESPONSE:");
    console.log(text);

    const cleanedText = text
      .replace(/```json/g, "")
      .replace(/```/g, "")
      .trim();

    const plan = JSON.parse(cleanedText);
setGeneratedPlan(plan);

    return NextResponse.json(plan);
  } catch (error) {
    console.error("GENERATE_PLAN_ERROR:", error);

    return NextResponse.json(
      { error: "Kunde inte generera marknadsplan." },
      { status: 500 }
    );
  }
}
import OpenAI from "openai";
import { NextResponse } from "next/server";

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function POST(request: Request) {
  try {
    const body = await request.json();

    const response = await client.responses.create({
      model: "gpt-4.1-mini",
      input: `
Du är en svensk marknadschef för småföretag.

Skapa en veckoplan baserad på detta:

${JSON.stringify(body, null, 2)}

Returnera endast giltig JSON i exakt denna struktur:

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
- Hitta inte på specifika fakta.
- Undvik generiskt AI-språk.
`,
    });

    const text = response.output_text
      .replace(/```json/g, "")
      .replace(/```/g, "")
      .trim();

    const plan = JSON.parse(text);

    return NextResponse.json(plan);
  } catch (error) {
    console.error("GENERATE_PLAN_ERROR:", error);

    return NextResponse.json(
      { error: "Kunde inte generera marknadsplan." },
      { status: 500 }
    );
  }
}
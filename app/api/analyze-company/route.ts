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
Analysera detta företag och returnera endast giltig JSON.

Företagsnamn: ${body.companyName}
Hemsida: ${body.website}
Bransch: ${body.industry}
Produkter: ${body.products}
Kunder: ${body.customers}
Ton: ${body.tone}
Undvik: ${body.avoid}
Tidigare inlägg: ${body.previousPosts}

Returnera exakt:
{
  "companyName": "",
  "industry": "",
  "summary": "",
  "customers": [],
  "products": [],
  "tone": [],
  "strengths": [],
  "avoid": [],
  "contentGuidelines": []
}
`,
    });

    const text = response.output_text
      .replace(/```json/g, "")
      .replace(/```/g, "")
      .trim();

    const profile = JSON.parse(text);

    return NextResponse.json(profile);
  } catch (error) {
    console.error("ANALYZE_COMPANY_ERROR:", error);

    return NextResponse.json(
      { error: "Kunde inte analysera företaget." },
      { status: 500 }
    );
  }
}
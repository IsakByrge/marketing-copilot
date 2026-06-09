import OpenAI from "openai";
import { NextResponse } from "next/server";

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

type CompanyInput = {
  companyName?: string;
  website?: string;
  industry?: string;
  products?: string;
  customers?: string;
  tone?: string;
  avoid?: string;
  previousPosts?: string;
};

export async function POST(request: Request) {
  try {
    const body: CompanyInput = await request.json();

    const response = await client.responses.create({
      model: "gpt-4.1-mini",
      input: [
        {
          role: "system",
          content:
            "Du är en svensk marknadsstrateg. Din uppgift är att analysera ett småföretag och skapa en tydlig företagsprofil för AI-genererad marknadsföring. Returnera endast giltig JSON.",
        },
        {
          role: "user",
          content: `
Analysera detta företag:

Företagsnamn: ${body.companyName}
Hemsida: ${body.website}
Bransch: ${body.industry}
Vad säljer de: ${body.products}
Kunder: ${body.customers}
Önskad tonalitet: ${body.tone}
Ska undvika: ${body.avoid}
Tidigare inlägg: ${body.previousPosts}

Returnera exakt denna JSON-struktur:

{
  "companyName": "",
  "industry": "",
  "summary": "",
  "customers": ["", "", ""],
  "products": ["", "", ""],
  "tone": ["", "", ""],
  "strengths": ["", "", ""],
  "avoid": ["", "", ""],
  "contentGuidelines": ["", "", ""]
}

Regler:
- Skriv på svenska.
- Hitta inte på specifika fakta som inte framgår.
- Om något saknas, gör en rimlig men försiktig tolkning.
- Skriv kort, tydligt och användbart.
- Returnera endast JSON.
`,
        },
      ],
    });

    const text = response.output_text;

    const cleanedText = text
      .replace(/```json/g, "")
      .replace(/```/g, "")
      .trim();

    const profile = JSON.parse(cleanedText);

    return NextResponse.json(profile);
  } catch (error) {
    console.error("ANALYZE_COMPANY_ERROR:", error);

    return NextResponse.json(
      { error: "Kunde inte analysera företaget." },
      { status: 500 }
    );
  }
}
import OpenAI from "openai";
import { NextResponse } from "next/server";

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function POST(request: Request) {
  try {
    const { systemPrompt, userPrompt } = await request.json();

    const response = await client.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      response_format: { type: "json_object" },
    });

    const raw = response.choices[0]?.message?.content || "";
    const parsed = JSON.parse(raw);

    return NextResponse.json(parsed);
  } catch (error) {
    console.error("CREATE_CONTENT_ERROR:", error);
    return NextResponse.json({ error: "Kunde inte skapa innehållet." }, { status: 500 });
  }
}
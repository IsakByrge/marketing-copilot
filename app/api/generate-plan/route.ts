import OpenAI from "openai";
import { NextResponse } from "next/server";

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function POST(request: Request) {
  try {
    const { systemPrompt, userPrompt } = await request.json();

    const response = await client.responses.create({
      model: "gpt-4.1-mini",
      input: `${systemPrompt}\n\n${userPrompt}`,
    });

    const raw = response.output_text.replace(/```json|```/g, "").trim();
    const match = raw.match(/\{[\s\S]*\}/);
    if (!match) throw new Error("No JSON");

    return NextResponse.json(JSON.parse(match[0]));
  } catch (error) {
    console.error("CREATE_CONTENT_ERROR:", error);
    return NextResponse.json({ error: "Kunde inte skapa innehållet." }, { status: 500 });
  }
}
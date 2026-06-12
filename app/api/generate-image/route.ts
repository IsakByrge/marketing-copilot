import OpenAI from "openai";
import { NextResponse } from "next/server";

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export async function POST(request: Request) {
  try {
    const { prompt, companyName } = await request.json();

    const response = await client.images.generate({
      model: "dall-e-3",
      prompt: `Professionell marknadsföringsbild för ${companyName}: ${prompt}. Fotorealistisk, ljus och inbjudande. Inga texter eller logotyper i bilden.`,
      n: 1,
      size: "1024x1024",
      quality: "standard",
    });

    const imageUrl = response.data?.[0]?.url;
    return NextResponse.json({ url: imageUrl });
  } catch (error) {
    console.error("IMAGE_GEN_ERROR:", error);
    return NextResponse.json({ error: "Kunde inte generera bild." }, { status: 500 });
  }
}
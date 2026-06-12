import OpenAI from "openai";
import { NextResponse } from "next/server";

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function POST(request: Request) {
  try {
    const { prompt, companyName } = await request.json();

    const response = await client.images.generate({
      model: "gpt-image-1",
      prompt: `Professionell marknadsföringsbild för ${companyName}: ${prompt}. Fotorealistisk, ljus och inbjudande. Inga texter eller logotyper i bilden.`,
      n: 1,
      size: "1024x1024",
    });

    const imageBase64 = response.data?.[0]?.b64_json;

    if (!imageBase64) {
      throw new Error("Ingen bild returnerades från OpenAI.");
    }

    return NextResponse.json({
      image: `data:image/png;base64,${imageBase64}`,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);

    console.error("IMAGE_GEN_ERROR:", message);
    console.error("IMAGE_GEN_ERROR full:", error);

    return NextResponse.json({ error: message }, { status: 500 });
  }
}
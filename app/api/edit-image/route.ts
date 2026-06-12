import OpenAI from "openai";
import { NextResponse } from "next/server";
import { toFile } from "openai/uploads";

export const runtime = "nodejs";

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function POST(request: Request) {
  try {
    const formData = await request.formData();

    const image = formData.get("image");
    const prompt = formData.get("prompt");
    const companyName = formData.get("companyName");

    if (!(image instanceof File)) {
      return NextResponse.json(
        { error: "Ingen bildfil skickades." },
        { status: 400 }
      );
    }

    if (typeof prompt !== "string" || !prompt.trim()) {
      return NextResponse.json(
        { error: "Prompt saknas." },
        { status: 400 }
      );
    }

    const arrayBuffer = await image.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const openAIFile = await toFile(
      buffer,
      image.name || "product.png",
      {
        type: image.type || "image/png",
      }
    );

    const finalPrompt = `
Placera produkten från den uppladdade bilden i en ny professionell marknadsföringsmiljö.

Företag: ${typeof companyName === "string" ? companyName : ""}

Önskad miljö:
${prompt}

Krav:
- Behåll produkten tydlig och igenkännbar.
- Skapa en realistisk marknadsföringsbild.
- Fotorealistisk stil.
- Naturligt ljus.
- Ingen text i bilden.
- Inga logotyper.
- Inga vattenstämplar.
- Bilden ska kännas professionell och användbar i marknadsföring.
`;

    const response = await client.images.edit({
      model: "gpt-image-1",
      image: openAIFile,
      prompt: finalPrompt,
      size: "1024x1024",
    });

    const imageBase64 = response.data?.[0]?.b64_json;

    if (!imageBase64) {
      throw new Error("OpenAI returnerade ingen bild.");
    }

    return NextResponse.json({
      image: `data:image/png;base64,${imageBase64}`,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);

    console.error("IMAGE_EDIT_ERROR:", message);
    console.error("IMAGE_EDIT_ERROR_FULL:", error);

    return NextResponse.json(
      { error: message },
      { status: 500 }
    );
  }
}
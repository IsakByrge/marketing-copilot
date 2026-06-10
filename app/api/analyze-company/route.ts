import OpenAI from "openai";
import { NextResponse } from "next/server";

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

/* ── Server-side website scraping ──────────────────────── */
async function scrapeWebsite(url: string): Promise<string> {
  try {
    let target = url.trim();
    if (!/^https?:\/\//i.test(target)) target = "https://" + target;

    const res = await fetch(target, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "sv-SE,sv;q=0.9,en;q=0.8",
      },
      signal: AbortSignal.timeout(8000),
    });

    if (!res.ok) return "";

    const html = await res.text();

    // Strip scripts, styles, nav, footer
    const text = html
      .replace(/<script[\s\S]*?<\/script>/gi, "")
      .replace(/<style[\s\S]*?<\/style>/gi, "")
      .replace(/<nav[\s\S]*?<\/nav>/gi, "")
      .replace(/<footer[\s\S]*?<\/footer>/gi, "")
      .replace(/<header[\s\S]*?<\/header>/gi, "")
      .replace(/<[^>]+>/g, " ")
      .replace(/\s{3,}/g, "\n")
      .replace(/&amp;/g, "&").replace(/&nbsp;/g, " ")
      .replace(/&lt;/g, "<").replace(/&gt;/g, ">")
      .trim()
      .slice(0, 4000);

    return text;
  } catch {
    return "";
  }
}

/* ── Route handler ─────────────────────────────────────── */
export async function POST(request: Request) {
  try {
    const body = await request.json();

    // Scrape website if provided
    let websiteContent = "";
    if (body.website?.trim()) {
      websiteContent = await scrapeWebsite(body.website);
    }

    const hasWebsiteContent = websiteContent.length > 100;

    const prompt = `Du är expert på att analysera svenska företag för marknadsföringsändamål.
Svara ALLTID med exakt giltig JSON — ingen förtext, inga backticks, inget annat. Svara på svenska.

Analysera detta företag och bygg en detaljerad profil:

Företagsnamn: ${body.companyName || ""}
Bransch: ${body.industry || ""}
Beskrivning från användaren: ${body.description || body.previousPosts || ""}
${hasWebsiteContent ? `\nHEMSIDA (analyserad):\n${websiteContent}` : ""}

${hasWebsiteContent
  ? "Basera profilen primärt på hemsidans innehåll. Använd beskrivningen som komplement."
  : "Basera profilen på beskrivningen från användaren. Var specifik och undvik generiska fraser."}

Returnera exakt denna JSON:
{
  "companyName": "${body.companyName || ""}",
  "industry": "bransch (ett ord)",
  "summary": "2-3 meningar som sammanfattar företaget så specifikt att ägaren känner igen sitt företag — inte en generisk beskrivning",
  "customers": ["specifik kundtyp 1", "specifik kundtyp 2", "specifik kundtyp 3"],
  "products": ["specifik tjänst/produkt 1", "specifik tjänst/produkt 2", "specifik tjänst/produkt 3"],
  "tone": ["tonlägesord 1", "tonlägesord 2", "tonlägesord 3"],
  "strengths": ["styrka 1", "styrka 2", "styrka 3"],
  "avoid": ["undvik 1", "undvik 2"],
  "contentGuidelines": ["riktlinje 1", "riktlinje 2", "riktlinje 3"]
}`;

    const response = await client.responses.create({
      model: "gpt-4.1-mini",
      input: prompt,
    });

    const raw = response.output_text.replace(/```json|```/g, "").trim();
    const match = raw.match(/\{[\s\S]*\}/);
    if (!match) throw new Error("No JSON in response");

    const profile = JSON.parse(match[0]);

    // Attach metadata so frontend knows if website was scraped
    profile._websiteScraped = hasWebsiteContent;

    return NextResponse.json(profile);

  } catch (error) {
    console.error("ANALYZE_COMPANY_ERROR:", error);
    return NextResponse.json(
      { error: "Kunde inte analysera företaget." },
      { status: 500 }
    );
  }
}
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

    let websiteContent = "";
    if (body.website?.trim()) {
      websiteContent = await scrapeWebsite(body.website);
    }

    const hasWebsiteContent = websiteContent.length > 100;

    const systemPrompt = `Du är expert på att analysera svenska företag för marknadsföringsändamål.
Svara ALLTID med exakt giltig JSON — ingen förtext, inga backticks, inget annat. Svara på svenska.`;

    const userPrompt = `Analysera detta företag och bygg en detaljerad profil:

Företagsnamn: ${body.companyName || ""}
${hasWebsiteContent ? `\nHEMSIDA (analyserad):\n${websiteContent}` : ""}

SPECIFIK INPUT FRÅN ÄGAREN:
Bästa kunden: ${body.bestCustomer || ""}
Vanligaste frågan kunder ställer: ${body.commonQuestion || ""}
Vad skiljer dem från konkurrenter: ${body.differentiator || ""}
Nyligt genomfört jobb: ${body.recentJob || ""}
${body.description ? `Övrig beskrivning: ${body.description}` : ""}

${hasWebsiteContent
  ? "Basera profilen primärt på hemsidans innehåll. Använd ägarens svar som komplement och för att fylla luckor."
  : "Basera profilen på ägarens svar. Var extremt specifik — använd deras egna ord och exempel."}

VIKTIGT: Profilen ska vara så specifik att ägaren känner igen sitt eget företag. Inga generiska fraser.

Returnera exakt denna JSON:
{
  "companyName": "${body.companyName || ""}",
  "industry": "bransch (ett ord)",
  "summary": "2-3 meningar som sammanfattar företaget så specifikt att ägaren känner igen sitt företag — använd deras egna exempel och formuleringar",
  "customers": ["specifik kundtyp baserad på ägarens beskrivning", "specifik kundtyp 2", "specifik kundtyp 3"],
  "products": ["specifik tjänst/produkt 1", "specifik tjänst/produkt 2", "specifik tjänst/produkt 3"],
  "tone": ["tonlägesord 1", "tonlägesord 2", "tonlägesord 3"],
  "strengths": ["styrka baserad på vad ägaren sa skiljer dem", "styrka 2", "styrka 3"],
  "avoid": ["undvik 1", "undvik 2"],
  "contentGuidelines": ["riktlinje baserad på vanligaste frågan", "riktlinje 2", "riktlinje 3"]
}`;

    const response = await client.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      response_format: { type: "json_object" },
    });

    const raw = response.choices[0]?.message?.content || "";
    const profile = JSON.parse(raw);
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
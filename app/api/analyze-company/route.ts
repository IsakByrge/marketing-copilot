import OpenAI from "openai";
import { NextResponse } from "next/server";

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

/* ── Skrapa en enskild sida ────────────────────────────── */
async function scrapePage(url: string): Promise<string> {
  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "sv-SE,sv;q=0.9,en;q=0.8",
      },
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return "";
    const html = await res.text();
    return html
      .replace(/<script[\s\S]*?<\/script>/gi, "")
      .replace(/<style[\s\S]*?<\/style>/gi, "")
      .replace(/<nav[\s\S]*?<\/nav>/gi, "")
      .replace(/<footer[\s\S]*?<\/footer>/gi, "")
      .replace(/<header[\s\S]*?<\/header>/gi, "")
      .replace(/<[^>]+>/g, " ")
      .replace(/\s{3,}/g, "\n")
      .replace(/&amp;/g, "&").replace(/&nbsp;/g, " ")
      .replace(/&lt;/g, "<").replace(/&gt;/g, ">")
      .trim();
  } catch {
    return "";
  }
}

/* ── Skrapa flera sidor: start + om-oss + kontakt ──────── */
async function scrapeWebsite(rawUrl: string): Promise<string> {
  let base = rawUrl.trim();
  if (!/^https?:\/\//i.test(base)) base = "https://" + base;

  // Ta bort ev. avslutande slash
  base = base.replace(/\/+$/, "");

  // Vanliga svenska sidvägar för "om oss" och "kontakt"
  const candidatePaths = [
    "",
    "/info/om-oss/",
    "/om-oss/",
    "/om-oss",
    "/info/kontakta-oss/",
    "/kontakt/",
    "/kontakt",
  ];

  const seen = new Set<string>();
  const chunks: string[] = [];

  for (const path of candidatePaths) {
    const url = base + path;
    if (seen.has(url)) continue;
    seen.add(url);

    const text = await scrapePage(url);
    if (text && text.length > 120) {
      // Märk upp varifrån texten kom så AI:n förstår kontexten
      const label = path === "" ? "STARTSIDA" : path.toUpperCase();
      chunks.push(`--- ${label} ---\n${text.slice(0, 2500)}`);
    }

    // Sluta när vi har gott om material (start + 2 sidor räcker)
    if (chunks.length >= 3) break;
  }

  return chunks.join("\n\n").slice(0, 7000);
}

/* ── Route handler ─────────────────────────────────────── */
export async function POST(request: Request) {
  try {
    const body = await request.json();

    let websiteContent = "";
    if (body.website?.trim()) {
      websiteContent = await scrapeWebsite(body.website);
    }

    const hasWebsiteContent = websiteContent.length > 150;

    const systemPrompt = `Du är expert på att analysera svenska företag för marknadsföringsändamål.
Du läser ett företags hemsida och bygger dels en marknadsföringsprofil, dels konkreta förslag på svar som företagaren själv hade gett om sin verksamhet.
Svara ALLTID med exakt giltig JSON — ingen förtext, inga backticks, inget annat. Svara på svenska.`;

    const userPrompt = `Analysera detta företag och bygg en detaljerad profil OCH föreslå svar på fyra nyckelfrågor.

Företagsnamn: ${body.companyName || ""}
${hasWebsiteContent ? `\nHEMSIDA (analyserad, flera sidor):\n${websiteContent}` : ""}

${body.bestCustomer || body.commonQuestion || body.differentiator || body.recentJob ? `BEFINTLIGA SVAR FRÅN ÄGAREN (om ifyllda — respektera dessa):
Bästa kunden: ${body.bestCustomer || "(tomt)"}
Vanligaste frågan: ${body.commonQuestion || "(tomt)"}
Vad skiljer dem: ${body.differentiator || "(tomt)"}
Nyligt jobb: ${body.recentJob || "(tomt)"}
` : ""}

${hasWebsiteContent
  ? `UPPGIFT: Läs hemsidan noga och FÖRESLÅ konkreta, specifika svar på de fyra frågorna nedan — som om du vore företagaren. Använd verkliga detaljer från hemsidan (tjänster, sätt att arbeta, vad som gör dem unika). Hitta INTE på saker som inte stöds av texten. Om ägaren redan fyllt i ett svar, behåll deras formulering.`
  : `UPPGIFT: Ingen hemsida tillgänglig. Basera allt på företagsnamnet och eventuella svar ägaren gett. Lämna förslagsfälten tomma om du inte har underlag.`}

Returnera exakt denna JSON:
{
  "companyName": "${body.companyName || ""}",
  "industry": "bransch (ett eller två ord)",
  "summary": "2-3 meningar som sammanfattar företaget så specifikt att ägaren känner igen sitt företag",
  "customers": ["specifik kundtyp", "specifik kundtyp 2", "specifik kundtyp 3"],
  "products": ["specifik tjänst/produkt 1", "specifik tjänst/produkt 2", "specifik tjänst/produkt 3"],
  "tone": ["tonlägesord 1", "tonlägesord 2", "tonlägesord 3"],
  "strengths": ["styrka 1", "styrka 2", "styrka 3"],
  "avoid": ["undvik 1", "undvik 2"],
  "contentGuidelines": ["riktlinje 1", "riktlinje 2", "riktlinje 3"],
  "suggestedAnswers": {
    "bestCustomer": "Konkret beskrivning av en typisk kund baserad på hemsidan — en verklig person, inte 'privatpersoner'. Tom sträng om inget underlag.",
    "commonQuestion": "Den fråga kunder troligen ställer oftast, utifrån vad hemsidan betonar. Tom sträng om inget underlag.",
    "differentiator": "Vad som konkret skiljer företaget från konkurrenter, med deras egna ord/koncept från hemsidan. Tom sträng om inget underlag.",
    "recentJob": "Ett trovärdigt exempel på ett typiskt uppdrag företaget utför, formulerat som en kort berättelse. Tom sträng om inget underlag."
  }
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

    // Plocka ut de föreslagna svaren till toppnivå så onboarding lätt kan läsa dem.
    // Ägarens egna ifyllda svar vinner alltid över AI:ns förslag.
    const suggested = profile.suggestedAnswers || {};
    profile.bestCustomer = (body.bestCustomer?.trim() || suggested.bestCustomer || "");
    profile.commonQuestion = (body.commonQuestion?.trim() || suggested.commonQuestion || "");
    profile.differentiator = (body.differentiator?.trim() || suggested.differentiator || "");
    profile.recentJob = (body.recentJob?.trim() || suggested.recentJob || "");

    return NextResponse.json(profile);

  } catch (error) {
    console.error("ANALYZE_COMPANY_ERROR:", error);
    return NextResponse.json(
      { error: "Kunde inte analysera företaget." },
      { status: 500 }
    );
  }
}
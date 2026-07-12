// ─────────────────────────────────────────────────────────────
// /api/campaign-analysis
// Tar emot ett komplett CampaignBrief och låter marknadschefen
// formulera en kampanjrekommendation. Strikt validerad JSON,
// hård timeout och inga tysta SDK-omförsök — routen svarar
// alltid, i alla kodvägar.
// ─────────────────────────────────────────────────────────────
import OpenAI from "openai";
import { NextResponse } from "next/server";
import { ANALYSIS_LIMITS, validateRecommendation } from "@/app/campaign-builder/analysis";
import type { CampaignBrief } from "@/app/campaign-builder/types";

// Låt inte plattformen döda funktionen mitt i modellanropet.
export const maxDuration = 60;

// maxRetries: 0 — SDK:ns tysta omförsök skulle annars kunna
// tredubbla svarstiden bortom klientens timeout.
const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY, maxRetries: 0 });

const clip = (s: unknown, n: number): string =>
  (typeof s === "string" ? s : "").replace(/\s+/g, " ").trim().slice(0, n);

const SYSTEM_PROMPT = `Du är en erfaren svensk marknadschef. Du har just intervjuat en företagare om en kampanj och ska nu ge din rekommendation.

REGLER:
1. Basera allt på underlaget. Hitta ALDRIG på företagsfakta, siffror eller resultat.
2. Lova aldrig försäljningsresultat.
3. Skriv på svenska, konkret och direkt användbart för en småföretagare.
4. Saknas något kritiskt: nämn det i "watchouts" i stället för att gissa.
5. Svara med EXAKT giltig JSON enligt schemat — ingen förtext, inga backticks.

JSON-schema (exakt dessa nycklar):
{
  "headline": "kampanjens bärande idé i en mening",
  "strategy": "strategin i 2-4 meningar",
  "coreMessage": "huvudbudskapet mot målgruppen, formulerat som det kan användas",
  "channels": [{ "name": "kanal", "motivation": "varför just denna kanal" }],
  "activities": ["konkret första aktivitet", "..."],
  "watchouts": ["risk eller lucka att bevaka", "..."]
}
channels: 2-4 poster. activities: 3-6 poster i genomförandeordning. watchouts: 0-4 poster.`;

function buildUserPrompt(brief: CampaignBrief): string {
  const b = brief.basics;
  const answers = Object.entries(brief.answers ?? {})
    .filter(([, v]) => clip(v, 1).length > 0)
    .map(([k, v]) => `- ${clip(k, 40)}: ${clip(v, 400)}`)
    .join("\n") || "(inga)";

  return `KAMPANJUNDERLAG FRÅN INTERVJUN:

Affärsmål: ${clip(brief.goalTitle, 120)} (${clip(brief.goal, 40)})
Produkt/tjänst: ${clip(b.product, 200)}
Beskrivning: ${clip(b.description, 400) || "(ej angiven)"}
Målgrupp: ${clip(b.targetAudience, 200) || "(ej angiven)"}
Geografiskt område: ${clip(b.geographicArea, 120) || "(ej angivet)"}
Period: ${clip(b.startDate, 20) || "?"} – ${clip(b.endDate, 20) || "?"}
Pris: ${clip(b.price, 80) || "(ej angivet)"}
Tillgänglighet: ${clip(b.availability, 200) || "(ej angiven)"}
Befintligt erbjudande: ${b.hasExistingOffer === "ja" ? clip(b.offerContent, 300) || "ja" : b.hasExistingOffer === "nej" ? "nej — formas i kampanjen" : "(ej angivet)"}

MÅLSPECIFIKA SVAR:
${answers}

Ge din kampanjrekommendation enligt reglerna och svara med endast JSON.`;
}

export async function POST(request: Request) {
  // Kort id för korrelation i loggen — ingen företagsdata loggas.
  const requestId = crypto.randomUUID().slice(0, 8);
  try {
    const raw = (await request.json()) as Partial<CampaignBrief>;

    if (!raw || typeof raw !== "object" || !clip(raw.goal, 40) || !raw.basics || !clip(raw.basics.product, 200)) {
      console.error(`CAMPAIGN_ANALYSIS_ERROR ${requestId}: InvalidBrief`);
      return NextResponse.json({ error: "Kampanjunderlaget är ofullständigt." }, { status: 400 });
    }

    const completion = await client.chat.completions.create(
      {
        model: "gpt-4o-mini",
        temperature: 0.5,
        max_tokens: 900,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: buildUserPrompt(raw as CampaignBrief) },
        ],
      },
      { timeout: ANALYSIS_LIMITS.TIMEOUT_MS },
    );

    const content = completion.choices[0]?.message?.content ?? "";
    let parsed: unknown;
    try {
      parsed = JSON.parse(content);
    } catch {
      console.error(`CAMPAIGN_ANALYSIS_ERROR ${requestId}: InvalidJson`);
      return NextResponse.json({ error: "Ogiltigt svar från analysen." }, { status: 502 });
    }

    const recommendation = validateRecommendation(parsed);
    if (!recommendation) {
      console.error(`CAMPAIGN_ANALYSIS_ERROR ${requestId}: SchemaValidationFailed`);
      return NextResponse.json({ error: "Analysen gav ett ofullständigt svar." }, { status: 502 });
    }

    return NextResponse.json(recommendation);
  } catch (error) {
    // Logga bara feltyp + request-id — aldrig känslig företagsinformation.
    const name = error instanceof Error ? error.name : "UnknownError";
    console.error(`CAMPAIGN_ANALYSIS_ERROR ${requestId}: ${name}`);
    return NextResponse.json({ error: "Analysen är inte tillgänglig just nu." }, { status: 500 });
  }
}

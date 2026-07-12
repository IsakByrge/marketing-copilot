// ─────────────────────────────────────────────────────────────
// /api/campaign-interview
// Dynamic Interview Engine. Tar emot intervjuns nuläge och avgör
// marknadschefens nästa drag (confirm/deepen/challenge/skip/finish).
// Genererar INGEN kampanjtext — bara intervjulogik. Strikt validerad JSON.
// ─────────────────────────────────────────────────────────────
import OpenAI from "openai";
import { NextResponse } from "next/server";
import {
  LIMITS,
  validateDecision,
  type InterviewDecision,
  type InterviewField,
  type InterviewRequest,
} from "@/app/campaign-builder/interview";

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const clip = (s: unknown, n: number): string =>
  (typeof s === "string" ? s : "").replace(/\s+/g, " ").trim().slice(0, n);

/* ── Systemprompt: intervjuns regler ────────────────────────── */
const SYSTEM_PROMPT = `Du är en erfaren marknadschef som INTERVJUAR en företagare för att förstå en kampanj så väl att du skulle kunna rekommendera en strategi. Du skapar INGEN kampanjtext, inga annonser och inga nyhetsbrev — du leder bara intervjun.

Efter varje svar avgör du nästa drag och svarar med EXAKT giltig JSON enligt schemat nedan. Ingen förtext, inga backticks, inget annat.

ABSOLUTA REGLER:
1. Fältet "response" måste ha ett konkret syfte som för intervjun framåt.
2. Svara ALDRIG med enbart "Bra", "Intressant", "Tack", "Okej" eller andra innehållslösa fraser.
3. Utmana (action "challenge") ENDAST när svaret är ett svagt antagande, motsäger ett tidigare svar, eller innebär en tydlig strategisk risk. Utmana aldrig annars.
4. Ställ exakt EN fråga åt gången i "nextQuestion".
5. Prioritera den information som mest påverkar strategin — fråga om det viktigaste härnäst.
6. Ställ INTE frågor vars svar redan går att härleda ur känd information eller företagsprofilen.
7. Avsluta (action "finish") när den kritiska informationen räcker. Normalt efter 6–9 relevanta frågor, men inget exakt antal.
8. Skilj tydligt på FAKTA (det företagaren sagt eller som står i profilen) och ANTAGANDEN. Presentera antaganden som antaganden, aldrig som fakta.
9. Hitta ALDRIG på företagsfakta. Är något okänt: fråga, eller lista det i missingCriticalInformation.
10. Lova ALDRIG försäljningsresultat och uppfinn ingen data.
11. Exponera aldrig ditt interna resonemang. "response" ska vara kort (1–2 meningar), på svenska och direkt användbart.

ACTIONS:
- "confirm": svaret räcker för fältet. Bekräfta kort med substans och gå vidare med nästa viktiga fråga.
- "deepen": svaret är oklart, brett eller ytligt. Be om mer precis information om samma sak.
- "challenge": svaret är ett svagt antagande, en motsägelse eller en strategisk risk. Problematisera vänligt och be om skärpning.
- "skip": ett planerat fält behövs inte givet vad du redan vet. Hoppa över det (ange dess nyckel i targetField om möjligt) och gå vidare med nästa relevanta fråga.
- "finish": kritisk information räcker för en rekommendation. Ingen nextQuestion.

reasonCategory: missing_information | weak_assumption | contradiction | strategic_opportunity | sufficient_information.

targetField: nyckeln för det fält nästa fråga gäller. Välj i första hand bland de angivna fältnycklarna.

JSON-schema (exakt dessa nycklar):
{
  "action": "confirm|deepen|challenge|skip|finish",
  "response": "det du säger till företagaren (kort, konkret)",
  "reasonCategory": "missing_information|weak_assumption|contradiction|strategic_opportunity|sufficient_information",
  "nextQuestion": "nästa fråga (utelämna vid finish)",
  "targetField": "fältnyckel om relevant",
  "canRecommend": true,
  "missingCriticalInformation": ["kort formulerad lucka", "..."]
}`;

function buildUserPrompt(req: InterviewRequest): string {
  const answered = req.answeredFields
    .map((f) => `- [${f.key}] ${f.label}: ${clip(f.value, 200) || "(tomt)"}`)
    .join("\n") || "(inga ännu)";

  const unanswered = req.unansweredFields
    .map((f) => `- [${f.key}] ${f.label}`)
    .join("\n") || "(inga)";

  const history = req.history
    .slice(-LIMITS.MAX_HISTORY)
    .map((h, i) => `${i + 1}. F: ${clip(h.question, LIMITS.MAX_HISTORY_FIELD_LEN)}\n   S: ${clip(h.answer, LIMITS.MAX_HISTORY_FIELD_LEN) || "(hoppade över)"}`)
    .join("\n") || "(tom)";

  const c = req.company;
  const companyBlock = c && (c.companyName || c.products?.length || c.customers?.length || c.bestCustomer)
    ? `KÄNDA FÖRETAGSFAKTA (endast dessa är fakta — hitta inte på mer):
Företag: ${clip(c.companyName, 120) || "(okänt)"}
Produkter/tjänster: ${(c.products ?? []).slice(0, 6).map((x) => clip(x, 60)).join(", ") || "(okänt)"}
Kundtyper: ${(c.customers ?? []).slice(0, 6).map((x) => clip(x, 60)).join(", ") || "(okänt)"}
Bästa kund: ${clip(c.bestCustomer, 160) || "(okänt)"}`
    : "KÄNDA FÖRETAGSFAKTA: (ingen företagsprofil tillgänglig — hitta inte på fakta)";

  return `KAMPANJENS MÅL: ${clip(req.goalTitle, 120)} (${clip(req.goal, 40)})

${companyBlock}

REDAN BESVARADE FÄLT:
${answered}

FÄLT SOM ÄNNU INTE ÄR BESVARADE:
${unanswered}

INTERVJUHISTORIK (äldst först):
${history}

SENASTE FRÅGAN: ${clip(req.lastQuestion, 300)}
SENASTE SVARET: ${clip(req.lastAnswer, LIMITS.MAX_ANSWER_LEN) || "(företagaren hoppade över frågan)"}

Antal AI-drag hittills i denna intervju: ${req.callCount} (rikta mot totalt 6–9 relevanta frågor).

Avgör nästa drag enligt reglerna och svara med endast JSON.`;
}

/** Säkert finish-beslut när gränsen nåtts — utan att anropa modellen. */
function forcedFinish(): InterviewDecision {
  return {
    action: "finish",
    response: "Jag har det jag behöver för att börja forma en rekommendation. Vi går vidare.",
    reasonCategory: "sufficient_information",
    canRecommend: true,
    missingCriticalInformation: [],
  };
}

export async function POST(request: Request) {
  try {
    const raw = (await request.json()) as Partial<InterviewRequest>;

    // Minimal defensiv normalisering av inkommande data.
    const req: InterviewRequest = {
      goal: clip(raw.goal, 40),
      goalTitle: clip(raw.goalTitle, 120),
      company: raw.company && typeof raw.company === "object" ? {
        companyName: clip(raw.company.companyName, 120),
        products: Array.isArray(raw.company.products) ? raw.company.products.slice(0, 6) : [],
        customers: Array.isArray(raw.company.customers) ? raw.company.customers.slice(0, 6) : [],
        bestCustomer: clip(raw.company.bestCustomer, 200),
      } : undefined,
      lastQuestion: clip(raw.lastQuestion, 300),
      lastAnswer: clip(raw.lastAnswer, LIMITS.MAX_ANSWER_LEN),
      history: Array.isArray(raw.history)
        ? raw.history.slice(-LIMITS.MAX_HISTORY).map((h) => ({
            question: clip(h?.question, LIMITS.MAX_HISTORY_FIELD_LEN),
            answer: clip(h?.answer, LIMITS.MAX_HISTORY_FIELD_LEN),
          }))
        : [],
      answeredFields: Array.isArray(raw.answeredFields)
        ? (raw.answeredFields as InterviewField[]).slice(0, 30).map((f) => ({ key: clip(f?.key, 40), label: clip(f?.label, 80), value: clip(f?.value, 200) }))
        : [],
      unansweredFields: Array.isArray(raw.unansweredFields)
        ? (raw.unansweredFields as InterviewField[]).slice(0, 30).map((f) => ({ key: clip(f?.key, 40), label: clip(f?.label, 80) }))
        : [],
      callCount: typeof raw.callCount === "number" && raw.callCount >= 0 ? Math.floor(raw.callCount) : 0,
    };

    if (!req.goal) {
      return NextResponse.json({ error: "Intervjun saknar mål." }, { status: 400 });
    }

    // Kostnadsspärr: avsluta utan modellanrop om taket nåtts.
    if (req.callCount >= LIMITS.MAX_AI_CALLS) {
      return NextResponse.json(forcedFinish());
    }

    const completion = await client.chat.completions.create(
      {
        model: "gpt-4o-mini",
        temperature: 0.4,
        max_tokens: 400,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: buildUserPrompt(req) },
        ],
      },
      { timeout: LIMITS.TIMEOUT_MS },
    );

    const content = completion.choices[0]?.message?.content ?? "";
    let parsed: unknown;
    try {
      parsed = JSON.parse(content);
    } catch {
      return NextResponse.json({ error: "Ogiltigt svar från intervjumotorn." }, { status: 502 });
    }

    const decision = validateDecision(parsed);
    if (!decision) {
      return NextResponse.json({ error: "Intervjumotorn gav ett ofullständigt svar." }, { status: 502 });
    }

    return NextResponse.json(decision);
  } catch (error) {
    // Logga aldrig känslig företagsinformation — bara felets art.
    const name = error instanceof Error ? error.name : "UnknownError";
    console.error("CAMPAIGN_INTERVIEW_ERROR:", name);
    return NextResponse.json({ error: "Intervjumotorn är inte tillgänglig just nu." }, { status: 500 });
  }
}

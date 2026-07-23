// ─────────────────────────────────────────────────────────────
// /api/campaign-interview
// Reasoning Engine. Tar emot intervjuns nuläge och avgör marknads-
// chefens nästa drag: ask/clarify/challenge/surface_insight/redirect/
// finish. Genererar INGEN kampanjtext — bara strategiskt resonemang.
// Strikt validerad JSON. Modellens interna resonemang exponeras aldrig,
// bara den strukturerade slutsatsen och en kort motivering.
//
// Upprepningsspärren och "finish" är medvetet frikopplade: att ett
// område inte längre går att fråga om (skipped/exhausted) betyder INTE
// automatiskt att intervjun är klar — bara att servern väljer ett annat
// kritiskt område i stället för att låta modellen fråga en tredje gång.
// Se unresolvedCriticalAreas/nextAskableCriticalArea i reasoning.ts.
// ─────────────────────────────────────────────────────────────
import { NextResponse } from "next/server";
import { guardAiRequest } from "@/lib/server/guard";
import { getOpenAI, AI } from "@/lib/server/ai";
import {
  LIMITS,
  validateDecision,
  isAreaAskable,
  nextAskableCriticalArea,
  unresolvedCriticalAreas,
  type AreaAttempt,
  type AreaOutcome,
  type KnownFact,
  type ReasoningDecision,
  type ReasoningRequest,
  type TargetArea,
} from "@/app/campaign-builder/reasoning";
import { GOAL_PROFILES, isKnownGoal } from "@/app/campaign-builder/goal-profiles";
import type { CampaignGoal } from "@/app/campaign-builder/types";

export const runtime = "nodejs";

const clip = (s: unknown, n: number): string =>
  (typeof s === "string" ? s : "").replace(/\s+/g, " ").trim().slice(0, n);

const AREA_LABEL_SV: Record<TargetArea, string> = {
  goal: "affärsresultatet", offer: "erbjudandet", audience: "målgruppen",
  problem: "kundproblemet", differentiation: "differentieringen", trust: "förtroendet",
  urgency: "tidsramen/brådskan", profitability: "lönsamheten", availability: "tillgängligheten",
  conversion: "konverteringen", measurement: "mätningen", channel: "kanalen", other: "området",
};

/** Deterministisk sista utväg om både primäranropet och den korrigerande
 * omfrågan misslyckas — garanterar framsteg utan ett tredje modellanrop. */
const AREA_FALLBACK_QUESTION: Record<TargetArea, string> = {
  goal: "Vad är det övergripande affärsresultatet ni vill uppnå med kampanjen?",
  offer: "Vad är det konkreta erbjudandet eller produkten kampanjen kretsar kring?",
  audience: "Vem är den viktigaste målgruppen för den här kampanjen?",
  problem: "Vilket problem löser det här för kunden?",
  differentiation: "Vad skiljer er från alternativen?",
  trust: "Vad skulle kunna bygga förtroende hos en tveksam kund?",
  urgency: "Finns det en tidsgräns eller händelse som gör detta brådskande?",
  profitability: "Hur ser lönsamheten eller marginalen ut för det här?",
  availability: "Hur ser tillgängligheten ut just nu?",
  conversion: "Vad skulle få kunden att faktiskt agera?",
  measurement: "Hur vill ni mäta om kampanjen fungerar?",
  channel: "Vilken kanal fungerar bäst för att nå ut?",
  other: "Finns det något mer som påverkar strategin här?",
};

/* ── Systemprompt: resonemangsmodellen ──────────────────────── */
const SYSTEM_PROMPT = `Du är en erfaren marknadschef som INTERVJUAR en företagare för att förstå en kampanj så väl att du kan ge en första strategisk rekommendation. Du skapar INGEN kampanjtext, inga annonser och inga nyhetsbrev — du resonerar och leder bara intervjun. Det ska kännas som rådgivning, inte som att fylla i ett formulär.

Innan du svarar måste du internt bedöma (utan att någonsin visa detta resonemang):
1. Vad försöker företaget uppnå?
2. Vad verkar vara det verkliga hindret?
3. Vilket antagande i det som sagts är svagast eller minst underbyggt?
4. Vilken enskilda information skulle mest förändra strategin härnäst?
5. Räcker underlaget redan för en första rekommendation?

Baserat på den bedömningen väljer du EXAKT en handling och svarar med EXAKT giltig JSON enligt schemat nedan. Ingen förtext, inga backticks, inget annat. Visa ALDRIG din interna bedömning eller något resonemang steg för steg — bara den färdiga slutsatsen i "message"/"questionReason", kort och användarvänlig.

GRUNDPRINCIP: Ställ ALDRIG en fråga bara för att fylla ett fält. Varje nästa fråga måste ha en tydlig strategisk anledning — den ska kunna förändra rekommendationen. En frivillig uppgift ska bara efterfrågas om den faktiskt kan påverka strategin.

HANDLINGAR:
- "ask": ställ nästa strategiskt viktigaste fråga.
- "clarify": senaste svaret är för otydligt, brett eller ytligt för att användas. Be om en precisering av SAMMA sak.
- "challenge": ett antagande verkar svagt, obestyrkt, motsägelsefullt eller en tydlig strategisk risk. Ifrågasätt respektfullt och ställ en konkret följdfråga. Använd ENDAST vid en verklig motsägelse, ett mycket brett/otydligt antagande, en tydlig strategisk risk, eller ett beslut taget utan tillräckligt underlag — aldrig för att verka skarp.
- "surface_insight": du ser en tidig, relevant slutsats som är värt att visa innan nästa fråga. Kräver fältet "insight". Typiskt efter ungefär 2–4 svar, när underlaget räcker för en välgrundad observation.
- "redirect": det valda kampanjmålet verkar inte matcha det verkliga problemet i svaren (t.ex. bristande räckvidd vs bristande konvertering). Säg det rakt och ställ en fråga som utforskar det verkliga problemet.
- "finish": tillräckligt underlag finns för en första strategisk rekommendation. Ingen nextQuestion.

FORMAT PÅ "message" OCH "nextQuestion":
"message" är din observation/reaktion/utmaning — ALDRIG frågan i sig. "nextQuestion" är frågan ALLENA, kort och naturlig, som en egen mening. De visas som två separata repliker, så blanda aldrig ihop dem.
Exempel (challenge, målgrupp "alla privatpersoner"):
  message: "Alla privatpersoner är för brett för att kunna välja ett vasst budskap eller en effektiv kanal."
  nextQuestion: "Vilken typ av privatkund har störst sannolikhet att köpa inom kampanjperioden?"
  targetArea: "audience", questionReason: "Målgruppens skärpa avgör både budskap och kanalval."

KVALITETSREGLER FÖR "message":
1. Får ALDRIG bestå av enbart: Bra / Tack / Intressant / Förstår / Bra att veta, eller liknande innehållslösa fraser.
2. Måste göra minst ett av: dra en konkret slutsats, förklara varför nästa fråga spelar roll, upptäcka en risk, prioritera mellan alternativ, utmana ett antagande, visa hur svaret påverkar strategin.
3. Kort (1–3 meningar), på svenska, direkt användbart — aldrig teknisk jargong.

FAKTA KONTRA ANTAGANDEN: Håll isär vad företagaren FAKTISKT sagt eller som står i en bekräftad profil (fakta) från dina egna slutsatser (antaganden). Presentera aldrig ett antagande som fakta. Hitta ALDRIG på företagsfakta, resultat, marginaler eller kundbeteenden. Räcker underlaget inte för en slutsats: säg "Jag har inte tillräckligt underlag för att avgöra det ännu." i stället för att gissa.

OMRÅDESSTATUS OCH UPPREPNING: Varje strategiskt område har en status (visas per kritiskt område nedan):
- unasked: aldrig frågat — fritt fram.
- unknown: frågat, men bara "vet inte"-svar hittills — får frågas om högst en gång till, bara om en enklare/annorlunda fråga rimligen kan lösa det.
- covered: minst ett riktigt svar givet — får följas upp (t.ex. en challenge) om det finns skäl, annars gå vidare.
- skipped: användaren har uttryckligen hoppat över det. Fråga ALDRIG om det igen.
- exhausted: frågat till gränsen utan ett användbart svar. Fråga ALDRIG om det igen.
Är ett kritiskt område skipped eller exhausted: godta luckan, notera den i missingCriticalInformation, och gå vidare till nästa okritiska... näst prioriterade OTÄCKTA kritiska område i stället för att fastna. Servern stoppar dig hårt om du ändå försöker fråga om ett skipped/exhausted område en gång till — men försök inte ens.

OM SENASTE SVARET VAR "vet inte": tolka det aldrig som ett faktum eller som att området är löst. Antingen förenkla frågan en gång, eller gå vidare och notera luckan.

FINISH: Kräver ATT DET FINNS TÄCKNING FÖR EN REKOMMENDATION — antingen (a) alla kritiska områden är covered, eller (b) kvarvarande luckor (skipped/exhausted kritiska områden) sannolikt inte förändrar huvudstrategin. Avsluta ALDRIG bara för att ETT enda område nått sin frågegräns om andra kritiska områden fortfarande är unasked/unknown — fråga om dem i stället. Normalt 5–8 relevanta frågor totalt, längre bara vid kvarvarande kritiska luckor eller en motsägelse som behöver redas ut. Dra aldrig ut på intervjun med lågprioriterade frågor när den kritiska informationen redan räcker.

insight (valfritt): fyll ALLTID i detta fält — oavsett action — så fort du märker ett mönster, en möjlighet eller en tydlig slutsats i svaren som är värd att visa separat (inte bara nämnas i förbigående i "message"). Måste bygga på konkreta svar — ange dem i "basedOn". Hitta aldrig på en insikt. Använd action "surface_insight" specifikt när insikten är viktig nog att lyftas fram INNAN nästa fråga.
concern (valfritt): fyll ALLTID i detta fält — oavsett action — så fort du upptäcker en motsägelse mellan två svar, en tydlig strategisk svaghet, eller en risk, ÄVEN om du redan hanterar det via "challenge" eller "redirect". Kort och lugnt formulerad.
Utelämna aldrig insight/concern av bekvämlighet när underlaget faktiskt ger dig ett konkret mönster, en motsägelse eller en risk att peka på — det är precis den sortens observation som skiljer en rådgivare från ett formulär.

JSON-schema (exakt dessa nycklar):
{
  "action": "ask|clarify|challenge|surface_insight|redirect|finish",
  "message": "din observation/reaktion (kort, konkret, aldrig bara en artighetsfras)",
  "nextQuestion": "nästa fråga, allena (utelämna vid finish)",
  "targetArea": "goal|offer|audience|problem|differentiation|trust|urgency|profitability|availability|conversion|measurement|channel|other",
  "questionReason": "kort motivering, högst två meningar (utelämna vid finish)",
  "insight": { "title": "kort rubrik", "text": "observationen", "confidence": "low|medium|high", "basedOn": ["konkret svar eller uppgift den bygger på"] },
  "concern": { "title": "kort rubrik", "text": "vad som är svagt eller motsägelsefullt", "severity": "low|medium|high" },
  "canRecommend": true,
  "missingCriticalInformation": ["kort formulerad lucka", "..."]
}
Utelämna "insight" och "concern" helt när de inte är relevanta — hitta inte på dem för att fylla schemat.`;

/** Målets strategiska profil + aktuell områdesstatus — gör att olika mål ger tydligt olika intervjuer. */
function goalDirectives(goal: CampaignGoal, goalTitle: string, attempts: AreaAttempt[]): string {
  const p = GOAL_PROFILES[goal];
  const cap = LIMITS.MAX_ASKS_PER_AREA;
  const statusLines = p.criticalAreas.map((a) => {
    const status = areaStatusLabel(attempts, a, cap);
    return `- ${a} (${AREA_LABEL_SV[a]}): ${status}`;
  });
  return `VALT AFFÄRSMÅL: ${goalTitle}

Prioritera informationsområdena i denna ordning:
${p.priorities.map((x, i) => `${i + 1}. ${x}`).join("\n")}

Kritisk information som måste vara täckt innan du väljer "finish":
${p.criticalInfo.map((x) => `- ${x}`).join("\n")}

Status per kritiskt strategiskt område just nu:
${statusLines.join("\n")}

Dra aldrig ut på intervjun med lågprioriterade områden när den kritiska informationen redan räcker.`;
}

function areaStatusLabel(attempts: AreaAttempt[], area: TargetArea, cap: number): string {
  const forArea = attempts.filter((a) => a.area === area);
  if (forArea.some((a) => a.outcome === "answered")) return "covered (besvarat)";
  if (forArea.some((a) => a.outcome === "skipped")) return "skipped (överhoppat — fråga inte igen)";
  if (forArea.length >= cap) return "exhausted (uttömt — fråga inte igen)";
  if (forArea.length > 0) return "unknown (bara \"vet inte\" hittills)";
  return "unasked";
}

function buildUserPrompt(req: ReasoningRequest): string {
  const knownFacts = req.knownFacts
    .map((f) => `- [${f.key}] ${f.label}: ${clip(f.value, 200) || "(tomt)"}`)
    .join("\n") || "(inga ännu)";

  const candidates = req.candidateFields
    .map((f) => `- [${f.key}] ${f.label}`)
    .join("\n") || "(inga)";

  const history = req.history
    .slice(-LIMITS.MAX_HISTORY)
    .map((h, i) => `${i + 1}. F: ${clip(h.question, LIMITS.MAX_HISTORY_FIELD_LEN)}\n   S: ${clip(h.answer, LIMITS.MAX_HISTORY_FIELD_LEN) || "(hoppade över)"}`)
    .join("\n") || "(tom)";

  const c = req.company;
  const companyBlock = c && (c.companyName || c.products?.length || c.customers?.length || c.bestCustomer)
    ? `KÄNDA FÖRETAGSFAKTA (bekräftade fakta, inte antaganden — hitta inte på mer):
Företag: ${clip(c.companyName, 120) || "(okänt)"}
Produkter/tjänster: ${(c.products ?? []).slice(0, 6).map((x) => clip(x, 60)).join(", ") || "(okänt)"}
Kundtyper: ${(c.customers ?? []).slice(0, 6).map((x) => clip(x, 60)).join(", ") || "(okänt)"}
Bästa kund: ${clip(c.bestCustomer, 160) || "(okänt)"}`
    : "KÄNDA FÖRETAGSFAKTA: (ingen företagsprofil tillgänglig — hitta inte på fakta)";

  return `KAMPANJENS MÅL: ${clip(req.goalTitle, 120)} (${clip(req.goal, 40)})

${companyBlock}

ANVÄNDARENS SVAR HITTILLS (fakta han/hon själv gett — behandla vaga svar som antaganden, inte fakta):
${knownFacts}

ÖVRIGA KÄNDA KANDIDATOMRÅDEN (referens — inte en kö att beta av mekaniskt):
${candidates}

INTERVJUHISTORIK (äldst först):
${history}

SENASTE FRÅGAN: ${clip(req.lastQuestion, 300)}
SENASTE SVARET: ${req.unknownAnswer ? "Företagaren svarade uttryckligen \"vet inte\" — tolka INTE detta som ett faktum." : clip(req.lastAnswer, LIMITS.MAX_ANSWER_LEN) || "(företagaren hoppade över frågan)"}

Antal AI-drag hittills i denna intervju: ${req.callCount} (sikta normalt på totalt 5–8 relevanta frågor).

Bedöm enligt din interna femstegsprocess och svara med endast JSON — visa aldrig bedömningen själv, bara slutsatsen.`;
}

/** Säkert finish-beslut när gränsen nåtts eller inga fler kritiska områden går att fråga om. */
function forcedFinish(): ReasoningDecision {
  return {
    action: "finish",
    message: "Jag har nu tillräckligt underlag för en första strategisk rekommendation. Vi går vidare dit.",
    canRecommend: true,
    missingCriticalInformation: [],
  };
}

type RawFact = Partial<KnownFact>;
type RawAttempt = Partial<AreaAttempt>;

const OUTCOMES: readonly AreaOutcome[] = ["answered", "unknown", "skipped"];

function normalizeAttempts(raw: unknown): AreaAttempt[] {
  if (!Array.isArray(raw)) return [];
  return (raw as RawAttempt[])
    .filter((a): a is AreaAttempt => typeof a?.area === "string" && typeof a?.outcome === "string" && OUTCOMES.includes(a.outcome as AreaOutcome))
    .slice(0, 40);
}

async function callModel(
  req: ReasoningRequest,
  goal: CampaignGoal,
  extraSystemNote?: string,
): Promise<ReasoningDecision | null> {
  const systemContent = `${SYSTEM_PROMPT}\n\n${goalDirectives(goal, req.goalTitle, req.areaAttempts)}${extraSystemNote ? `\n\n${extraSystemNote}` : ""}`;
  const completion = await getOpenAI().chat.completions.create(
    {
      model: AI.CHAT_MODEL,
      temperature: 0.4,
      max_tokens: 500,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: systemContent },
        { role: "user", content: buildUserPrompt(req) },
      ],
    },
    { timeout: LIMITS.TIMEOUT_MS },
  );
  const content = completion.choices[0]?.message?.content ?? "";
  try {
    return validateDecision(JSON.parse(content));
  } catch {
    return null;
  }
}

export async function POST(request: Request) {
  // Kort id för korrelation i loggen — ingen företagsdata loggas.
  const requestId = crypto.randomUUID().slice(0, 8);

  const guarded = await guardAiRequest("campaign-interview");
  if (!guarded.ok) return guarded.response;
  const { guard } = guarded;

  try {
    const raw = (await request.json()) as Partial<ReasoningRequest>;

    // Minimal defensiv normalisering av inkommande data.
    const req: ReasoningRequest = {
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
      unknownAnswer: raw.unknownAnswer === true,
      history: Array.isArray(raw.history)
        ? raw.history.slice(-LIMITS.MAX_HISTORY).map((h) => ({
            question: clip(h?.question, LIMITS.MAX_HISTORY_FIELD_LEN),
            answer: clip(h?.answer, LIMITS.MAX_HISTORY_FIELD_LEN),
          }))
        : [],
      areaAttempts: normalizeAttempts(raw.areaAttempts),
      knownFacts: Array.isArray(raw.knownFacts)
        ? (raw.knownFacts as RawFact[]).slice(0, 30).map((f) => ({
            key: clip(f?.key, 40), label: clip(f?.label, 80), value: clip(f?.value, 200),
          }))
        : [],
      candidateFields: Array.isArray(raw.candidateFields)
        ? (raw.candidateFields as RawFact[]).slice(0, 30).map((f) => ({ key: clip(f?.key, 40), label: clip(f?.label, 80) }))
        : [],
      callCount: typeof raw.callCount === "number" && raw.callCount >= 0 ? Math.floor(raw.callCount) : 0,
    };

    if (!req.goal || !isKnownGoal(req.goal)) {
      console.error(`CAMPAIGN_INTERVIEW_ERROR ${requestId}: UnknownGoal`);
      await guard.finish({ status: "error", errorCategory: "unknown_goal" });
      return NextResponse.json({ error: "Intervjun saknar ett giltigt mål." }, { status: 400 });
    }
    const goal = req.goal as CampaignGoal;
    const profile = GOAL_PROFILES[goal];
    const cap = LIMITS.MAX_ASKS_PER_AREA;

    let decision: ReasoningDecision;

    // Kostnadsspärr: avsluta utan modellanrop om taket nåtts.
    if (req.callCount >= LIMITS.MAX_AI_CALLS) {
      decision = forcedFinish();
    } else {
      const first = await callModel(req, goal);
      if (!first) {
        console.error(`CAMPAIGN_INTERVIEW_ERROR ${requestId}: SchemaValidationFailed`);
        await guard.finish({ status: "error", errorCategory: "schema_validation", model: AI.CHAT_MODEL });
        return NextResponse.json({ error: "Resonemangsmotorn gav ett ofullständigt svar." }, { status: 502 });
      }

      // Upprepningsspärr: modellen försökte fråga om ett område som redan
      // nått sitt tak eller uttryckligen hoppats över. Detta får INTE
      // automatiskt trigga finish — bara ett byte till nästa kritiska
      // område som fortfarande saknar svar (kravet i denna omgång).
      if (first.action !== "finish" && first.targetArea && !isAreaAskable(req.areaAttempts, first.targetArea, cap)) {
        const nextArea = nextAskableCriticalArea(profile.criticalAreas, req.areaAttempts, cap);
        if (nextArea) {
          console.error(`CAMPAIGN_INTERVIEW_ERROR ${requestId}: AreaRepetitionRedirected`);
          const corrective = `VIKTIGT: Du försökte precis fråga om området "${first.targetArea}" igen, men det är inte längre tillåtet (redan besvarat/uttömt/överhoppat, eller taket på ${cap} frågor är nått). Välj i stället området "${nextArea}" för din nästa fråga — om inte en akut motsägelse kräver något annat. Svara med en helt ny, fullständig ReasoningDecision.`;
          const retry = await callModel(req, goal, corrective);
          const retryOk = retry && (retry.action === "finish" || (retry.targetArea && isAreaAskable(req.areaAttempts, retry.targetArea, cap)));
          decision = retryOk ? retry! : {
            action: "ask",
            message: `Jag går vidare till ${AREA_LABEL_SV[nextArea]} — det är fortfarande obesvarat och viktigt för strategin.`,
            nextQuestion: AREA_FALLBACK_QUESTION[nextArea],
            targetArea: nextArea,
            canRecommend: false,
            missingCriticalInformation: [],
          };
        } else {
          // Inga fler kritiska områden går att fråga om — nu är det
          // legitimt att avsluta (motsvarar test C).
          decision = forcedFinish();
        }
      } else {
        decision = first;
      }
    }

    // Berika ALLTID (oavsett väg hit) med kritiska områden som är skipped
    // eller exhausted — oavsett om modellen själv kom ihåg att nämna dem.
    // Det gör missingCriticalInformation pålitlig och sänker canRecommend
    // ärligt i stället för att låtsas att luckan inte finns.
    const gaps = unresolvedCriticalAreas(profile.criticalAreas, req.areaAttempts, cap);
    if (gaps.length > 0) {
      const gapNotes = gaps.map((a) => `${AREA_LABEL_SV[a]} kunde inte klargöras (uttömt eller överhoppat)`);
      decision = {
        ...decision,
        missingCriticalInformation: Array.from(new Set([...decision.missingCriticalInformation, ...gapNotes])).slice(0, 8),
        canRecommend: false,
        message: decision.action === "finish"
          ? `${decision.message} Vissa delar av underlaget saknas dock fortfarande — jag har flaggat det som osäkerhet.`
          : decision.message,
      };
    }

    await guard.finish({ status: "ok", model: AI.CHAT_MODEL });
    return NextResponse.json(decision);
  } catch (error) {
    // Logga aldrig känslig företagsinformation — bara felets art.
    const name = error instanceof Error ? error.name : "UnknownError";
    console.error(`CAMPAIGN_INTERVIEW_ERROR ${requestId}: ${name}`);
    await guard.finish({ status: "error", errorCategory: name });
    return NextResponse.json({ error: "Resonemangsmotorn är inte tillgänglig just nu." }, { status: 500 });
  }
}

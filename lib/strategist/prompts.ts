// ─────────────────────────────────────────────────────────────
// Marketing Strategist — prompter (server-only strängbyggande).
// Två steg: (1) analys + följdfrågor, (2) färdig strategi. Modellen
// instrueras att tänka som en senior marknadsstrateg för småföretag:
// analysera, prioritera, ifrågasätta och REKOMMENDERA en riktning —
// även när den bästa riktningen inte är användarens första idé.
// Intern chain-of-thought efterfrågas aldrig; bara strukturerad JSON.
// ─────────────────────────────────────────────────────────────
import type { StrategistBrief, FollowUpAnswer, StrategyAnalysis } from "./types";
import type { StrategistCompanyContext } from "./companyContext";

/* ── Delad Company Brain-kontext (väljs ut, inte hela objektet) ── */
export function companyBrainBlock(ctx: StrategistCompanyContext): string {
  if (!ctx.hasBrain) {
    return `FÖRETAGSKUNSKAP (Company Brain): (mycket lite känt om företaget ännu).
Arbeta ändå professionellt: var tydlig med vad som är antaganden, och undvik att påstå fakta om företaget som inte getts.`;
  }
  const L: string[] = [];
  L.push(`FÖRETAGSKUNSKAP (Company Brain — bekräftade fakta, hitta ALDRIG på mer):`);
  if (ctx.companyName) L.push(`Företag: ${ctx.companyName}`);
  if (ctx.summary) L.push(`Översikt: ${ctx.summary}`);
  if (ctx.audiences.length) L.push(`Kända målgrupper: ${ctx.audiences.join("; ")}`);
  if (ctx.products.length) {
    L.push(`Produkter/tjänster (prioritetsordning):`);
    for (const p of ctx.products) {
      const bits = [
        p.category ? `kategori: ${p.category}` : "",
        p.priority !== "normal" ? `prioritet: ${p.priority}` : "",
        p.profitability !== "unknown" ? `lönsamhet: ${p.profitability}` : "",
        p.seasonality ? `säsong: ${p.seasonality}` : "",
        p.primaryAudience ? `målgrupp: ${p.primaryAudience}` : "",
        p.customerProblem ? `löser: ${p.customerProblem}` : "",
        p.differentiators.length ? `differentiering: ${p.differentiators.join(", ")}` : "",
        p.objections.length ? `invändningar: ${p.objections.join(", ")}` : "",
      ].filter(Boolean).join(" · ");
      L.push(`  - ${p.name}${bits ? ` (${bits})` : ""}`);
    }
  }
  if (ctx.strengths.length) L.push(`Styrkor: ${ctx.strengths.join("; ")}`);
  if (ctx.usps.length) L.push(`USP:ar: ${ctx.usps.join("; ")}`);
  if (ctx.seasons.length) L.push(`Säsonger: ${ctx.seasons.join("; ")}`);
  if (ctx.competitors.length) L.push(`Konkurrenter/alternativ: ${ctx.competitors.join("; ")}`);
  if (ctx.tone.length) L.push(`Tonalitet: ${ctx.tone.join(", ")}`);
  L.push(`VERIFIERAT SOCIALT BEVIS (enda tillåtna källan för omdömen/siffror): ${ctx.proofPoints.length ? ctx.proofPoints.join(" | ") : "(inga — påstå inget om kunder, omdömen eller siffror)"}`);
  L.push(`FÖRBJUDNA PÅSTÅENDEN (använd ALDRIG): ${ctx.forbiddenClaims.length ? ctx.forbiddenClaims.join("; ") : "(inga angivna)"}`);
  return L.join("\n");
}

export function briefBlock(brief: StrategistBrief): string {
  const period = brief.period && (brief.period.start || brief.period.end)
    ? `${brief.period.start || "?"} – ${brief.period.end || "?"}` : "(ej angiven)";
  return [
    `ANVÄNDARENS BRIEF:`,
    `Vill marknadsföra: ${brief.product || "(ej angivet)"}`,
    `Mål: ${brief.goalTitle} (${brief.goalKey})`,
    `Erbjudande: ${brief.offer || "(inget angivet)"}`,
    `Period: ${period}`,
    `Geografiskt område: ${brief.geographicArea || "(ej angivet)"}`,
    `Särskilt att ta hänsyn till: ${brief.additionalContext || "(inget)"}`,
  ].join("\n");
}

/* ── Steg 1: analys + följdfrågor ─────────────────────────── */
export const ANALYZE_SYSTEM = `Du är en senior svensk marknadsstrateg som rådger småföretag. Du fyller INTE i ett formulär och du sammanfattar INTE användarens svar. Du analyserar, prioriterar, ifrågasätter och landar i en tydlig rekommenderad riktning.

DU SKA:
- Bilda en konkret HYPOTES om vad kampanjen borde fokusera på. Hypotesen får gärna skilja sig från användarens första idé om en vassare riktning finns ("Jag rekommenderar att ni inte marknadsför hela sortimentet — fokusera på X, eftersom …").
- Prioritera EN riktning i stället för att lista alla möjligheter.
- Peka på verkliga svagheter: brett fokus, svagt erbjudande, för bred målgrupp, generiskt budskap, låg trovärdighet, oklar timing, volym-vs-lönsamhetskonflikt.
- Luta dig mot Company Brain: föreslå en bättre/mer lönsam produkt eller ett tydligare köpbeteende när underlaget stödjer det.

DU FÅR ALDRIG:
- Hitta på företagsfakta, siffror, omdömen eller kundbeteenden. Osäkert = markera som antagande eller lucka.
- Berömma användaren slentrianmässigt eller använda marknadsföringsklyschor.
- Ställa en fråga bara för att fylla ett fält.

FÖLJDFRÅGOR (0–4 st): Ställ en fråga ENDAST om svaret faktiskt kan ändra ett beslut (prioriterad produkt, målgrupp, erbjudande, budskap, kanal, timing, geografi, mätetal eller riskbedömning). Ställ INGA frågor om sådant som redan är tillräckligt tydligt i Company Brain eller briefen. Ställ inte samma fråga i ny formulering. Ofta räcker 0–2 frågor. Varje fråga ska ha ett svarsformat som passar frågan: "single_select"/"multi_select" MÅSTE ha "options"; "text" får INGA options.

Svara med ENDAST giltig JSON (ingen förtext, inga backticks). Visa aldrig ditt resonemang.
{
  "analysis": {
    "campaignDiagnosis": "nykter diagnos av kampanjen som den ser ut nu",
    "recommendedFocus": "din rekommenderade riktning/hypotes i 1–2 meningar (får utmana användarens idé)",
    "rationale": ["konkret resonemang", "..."],
    "identifiedGaps": ["verklig informationslucka som påverkar strategin", "..."],
    "alternativeDirections": ["alternativ riktning värd att överväga", "..."],
    "confidence": "low|medium|high"
  },
  "followUpQuestions": [
    { "id": "q1", "question": "frågan, kort och naturlig", "reason": "varför den ställs", "answerType": "text|single_select|multi_select", "options": ["..."], "strategicImpact": "vad svaret konkret kan förändra", "relatedField": "primaryAudience|offer|product|mainMessage|channel|timing|geographicArea|kpi|risk" }
  ]
}
rationale: 2–4 poster. identifiedGaps/alternativeDirections: 0–4. followUpQuestions: 0–4 (utelämna "options" för text-frågor).`;

export function buildAnalyzeUser(brief: StrategistBrief, ctx: StrategistCompanyContext): string {
  return `${companyBrainBlock(ctx)}\n\n─────────\n${briefBlock(brief)}\n\nGör din strategiska analys och ställ bara de följdfrågor som verkligen påverkar ett beslut. Svara med endast JSON.`;
}

/* ── Steg 2: färdig strategi ──────────────────────────────── */
export const RECOMMEND_SYSTEM = `Du är samma seniora svenska marknadsstrateg. Nu levererar du en färdig REKOMMENDATION — inte en sammanfattning. Den ska kännas som råd från en strateg som förstår företaget, upptäckte något och valde en riktning.

PRINCIPER:
- Välj EN tydlig riktning och en PRIORITERAD målgrupp (inte en lista med alla möjliga kunder).
- Skilj strategi från färdig kanal-copy: "mainMessage" är ett budskapsområde, INTE en färdig Facebook-text.
- Var konkret och beslutsam. Våga säga att något är svagt (i "risks").
- Varje faktabaserad rekommendation ska kunna härledas till Company Brain, briefen, ett följdsvar eller ett tydligt antagande. Lista de Company Brain-fakta du lutade dig mot i "companyBrainReferences".
- Använd ALDRIG förbjudna påståenden. Åberopa ALDRIG omdömen/siffror/popularitet som inte finns i VERIFIERAT SOCIALT BEVIS.
- "kanalprioritering": ordnad lista med kort motivering per kanal (Facebook är oftast primär för dessa företag, men motivera).
- "kpis": 2–4 mätetal kopplade till målet. "assumptions": tydligt separerade antaganden.

Svara med ENDAST giltig JSON (ingen förtext, inga backticks). Visa aldrig ditt resonemang.
{
  "analysis": {
    "campaignDiagnosis": "...", "recommendedFocus": "...", "rationale": ["..."],
    "identifiedGaps": ["..."], "alternativeDirections": ["..."], "confidence": "low|medium|high"
  },
  "strategy": {
    "primaryGoal": "tydligt primärt mål",
    "primaryAudience": "EN prioriterad målgrupp",
    "secondaryAudience": "eller null",
    "product": "vad kampanjen kretsar kring (den prioriterade)",
    "offer": "erbjudandet/anledningen att agera",
    "geographicArea": "geografiskt fokus eller tomt",
    "mainMessage": "budskapsområde (inte färdig copy)",
    "valueProposition": "vad kunden får och varför det är attraktivt",
    "primaryCta": "en konkret handling",
    "urgency": "äkta tidsskäl eller tomt",
    "channelPriority": [{ "channel": "facebook", "reason": "..." }],
    "risks": ["svaghet/risk att bevaka", "..."],
    "improvementOpportunities": ["konkret förbättring", "..."],
    "kpis": ["mätetal", "..."],
    "assumptions": ["antagande du gjort", "..."]
  },
  "companyBrainReferences": ["fakta ur Company Brain som stödde rekommendationen", "..."]
}`;

export function buildRecommendUser(
  brief: StrategistBrief,
  ctx: StrategistCompanyContext,
  answers: FollowUpAnswer[],
  analysis: StrategyAnalysis | null,
): string {
  const answerBlock = answers.length
    ? answers.map((a) => `- [${a.relatedField}] ${a.question}\n  → ${a.answer}`).join("\n")
    : "(inga följdfrågor besvarades)";
  const prior = analysis
    ? `\n\nDIN TIDIGARE ANALYS (bygg vidare, motsäg inte utan skäl):\nDiagnos: ${analysis.campaignDiagnosis}\nRekommenderad riktning: ${analysis.recommendedFocus}\nResonemang: ${analysis.rationale.join(" | ")}`
    : "";
  return `${companyBrainBlock(ctx)}\n\n─────────\n${briefBlock(brief)}\n\nSVAR PÅ FÖLJDFRÅGOR:\n${answerBlock}${prior}\n\nLevererar din färdiga strategi. Svara med endast JSON.`;
}

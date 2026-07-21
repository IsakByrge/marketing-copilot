// ─────────────────────────────────────────────────────────────
// POST /api/strategist/recommend
// Fas 4: färdig, strukturerad strategirekommendation (StrategyV2).
// Tar brief + följdsvar (+ ev. tidigare analys); bygger Company Brain-
// kontext server-side; validerar deterministiskt (rekommendation, risker,
// motiverade kanaler, KPI:er, inga förbjudna påståenden, inget overifierat
// social proof) och gör EN kontrollerad repair vid hårda problem.
// ─────────────────────────────────────────────────────────────
import { buildStrategistCompanyContext } from "@/lib/strategist/companyContext";
import { RECOMMEND_SYSTEM, buildRecommendUser } from "@/lib/strategist/prompts";
import { coerceRecommend } from "@/lib/strategist/validate";
import { callJson } from "@/lib/strategist/model";
import { parseBrief, parseAnswers, parseAnalysis } from "@/lib/strategist/request";

export const maxDuration = 60;

export async function POST(request: Request) {
  const requestId = crypto.randomUUID().slice(0, 8);
  try {
    const body = await request.json();
    const brief = parseBrief(body?.brief);
    if (!brief) return Response.json({ status: "error", error: "Ofullständig brief." }, { status: 400 });
    const answers = parseAnswers(body?.answers);
    const priorAnalysis = parseAnalysis(body?.analysis);

    const ctxResult = await buildStrategistCompanyContext();
    if (!ctxResult) return Response.json({ status: "error", error: "Du behöver vara inloggad." }, { status: 401 });
    const ctx = ctxResult.context;

    const user = buildRecommendUser(brief, ctx, answers, priorAnalysis);
    const first = await callJson(RECOMMEND_SYSTEM, user, { temperature: 0.5, maxTokens: 1800, signal: request.signal });
    let out = coerceRecommend(first.parsed, ctx, brief, answers);
    let calls = 1;

    if (!out.value || out.hardIssues.length) {
      const repairNote = `\n\nDITT FÖRRA SVAR HADE PROBLEM: ${out.hardIssues.join(", ") || "ogiltig JSON"}. Rätta ALLA problem (t.ex. lägg till en tydlig rekommendation, prioriterad målgrupp, budskap, CTA, motiverade kanaler och KPI:er; ta bort förbjudna påståenden och overifierat social proof) och svara med en HELT ny, komplett giltig JSON.`;
      const retry = await callJson(RECOMMEND_SYSTEM + repairNote, user, { temperature: 0.3, maxTokens: 1800, signal: request.signal });
      out = coerceRecommend(retry.parsed, ctx, brief, answers);
      calls = 2;
    }
    if (!out.value || out.hardIssues.length) {
      console.error(`STRATEGIST_RECOMMEND ${requestId}: HardFail ${out.hardIssues.join(",")}`);
      return Response.json({ status: "error", error: "Strategin kunde inte färdigställas. Försök igen." }, { status: 502 });
    }

    console.log(`STRATEGIST_RECOMMEND ${requestId}: ok calls=${calls} channels=${out.value.strategy.channelPriority.length} risks=${out.value.strategy.risks.length} kpis=${out.value.strategy.kpis.length} brain=${ctx.hasBrain}`);
    return Response.json({ status: "ok", strategy: out.value });
  } catch (error) {
    const name = error instanceof Error ? error.name : "UnknownError";
    console.error(`STRATEGIST_RECOMMEND ${requestId}: ${name}`);
    return Response.json({ status: "error", error: "Strategen är inte tillgänglig just nu." }, { status: 500 });
  }
}

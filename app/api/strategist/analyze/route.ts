// ─────────────────────────────────────────────────────────────
// POST /api/strategist/analyze
// Fas 2: strukturerad strategisk analys + 0–4 adaptiva följdfrågor.
// Företaget härleds server-side ur sessionen; Company Brain byggs till
// en minimerad kontext. Deterministisk validering ovanpå modellen; vid
// hårda problem görs EN kontrollerad repair — aldrig tyst generisk text.
// Loggar bara request-id + metrics, aldrig företagsinnehåll.
// ─────────────────────────────────────────────────────────────
import { buildStrategistCompanyContext } from "@/lib/strategist/companyContext";
import { ANALYZE_SYSTEM, buildAnalyzeUser } from "@/lib/strategist/prompts";
import { coerceAnalyze } from "@/lib/strategist/validate";
import { callJson, STRATEGIST_MODEL } from "@/lib/strategist/model";
import { parseBrief } from "@/lib/strategist/request";
import { guardAiRequest } from "@/lib/server/guard";

export const maxDuration = 60;

export async function POST(request: Request) {
  const requestId = crypto.randomUUID().slice(0, 8);

  const guarded = await guardAiRequest("strategist-analyze");
  if (!guarded.ok) return guarded.response;
  const { guard } = guarded;

  try {
    const brief = parseBrief(await request.json());
    if (!brief) {
      await guard.finish({ status: "error", errorCategory: "invalid_brief" });
      return Response.json({ status: "error", error: "Ofullständig brief." }, { status: 400 });
    }

    const ctxResult = await buildStrategistCompanyContext();
    if (!ctxResult) {
      await guard.finish({ status: "error", errorCategory: "unauthenticated" });
      return Response.json({ status: "error", error: "Du behöver vara inloggad." }, { status: 401 });
    }
    const ctx = ctxResult.context;

    const first = await callJson(ANALYZE_SYSTEM, buildAnalyzeUser(brief, ctx), { temperature: 0.5, maxTokens: 1200, signal: request.signal });
    let out = coerceAnalyze(first.parsed, ctx, brief);
    let calls = 1;
    let promptTokens = first.promptTokens;
    let completionTokens = first.completionTokens;

    // Kontrollerad repair vid hårda problem (aldrig tyst fallback).
    if (!out.value || out.hardIssues.length) {
      const repairNote = `\n\nDITT FÖRRA SVAR HADE PROBLEM: ${out.hardIssues.join(", ") || "ogiltig JSON"}. Rätta och svara med en HELT ny, komplett och giltig JSON enligt schemat.`;
      const retry = await callJson(ANALYZE_SYSTEM + repairNote, buildAnalyzeUser(brief, ctx), { temperature: 0.3, maxTokens: 1200, signal: request.signal });
      out = coerceAnalyze(retry.parsed, ctx, brief);
      calls = 2;
      promptTokens += retry.promptTokens;
      completionTokens += retry.completionTokens;
    }
    if (!out.value || out.hardIssues.length) {
      console.error(`STRATEGIST_ANALYZE ${requestId}: HardFail ${out.hardIssues.join(",")}`);
      await guard.finish({ status: "error", errorCategory: "hard_fail", model: STRATEGIST_MODEL, companyId: ctxResult.companyId, promptTokens, completionTokens });
      return Response.json({ status: "error", error: "Analysen kunde inte färdigställas. Försök igen." }, { status: 502 });
    }

    console.log(`STRATEGIST_ANALYZE ${requestId}: ok calls=${calls} qs=${out.value.followUpQuestions.length} conf=${out.value.analysis.confidence} brain=${ctx.hasBrain}`);
    await guard.finish({ status: "ok", model: STRATEGIST_MODEL, companyId: ctxResult.companyId, promptTokens, completionTokens });
    return Response.json({ status: "ok", analysis: out.value.analysis, followUpQuestions: out.value.followUpQuestions });
  } catch (error) {
    const name = error instanceof Error ? error.name : "UnknownError";
    console.error(`STRATEGIST_ANALYZE ${requestId}: ${name}`);
    await guard.finish({ status: "error", errorCategory: name });
    return Response.json({ status: "error", error: "Strategen är inte tillgänglig just nu." }, { status: 500 });
  }
}

// ─────────────────────────────────────────────────────────────
// POST /api/company/read-site
//
// Läser företagets egna webbplatser och föreslår vad som ska in i
// Company Brain. Skriver ingenting — sidan Vad jag vet visar förslagen
// och användaren väljer.
//
// Adresserna tas ur kontots egna Company Brain (websites). Bara om
// listan är tom får klienten skicka en adress, och den går genom samma
// SSRF-skydd som allt annat. Högst två sajter, robots.txt följs och
// högst en sida per sekund per sajt (se lib/siteReader/read.ts).
// ─────────────────────────────────────────────────────────────
import { guardAiRequest, safeError } from "@/lib/server/guard";
import { classifyAiError, modelUsageFrom } from "@/lib/server/aiError";
import { callChatJson, AI } from "@/lib/server/ai";
import { getCompanyBrain } from "@/lib/companyBrainServer";
import { readSite, normalizeRoot } from "@/lib/siteReader/read";
import { corpus } from "@/lib/siteReader/pages";
import { SITE_READER_SYSTEM, siteReaderPrompt, validateDraft } from "@/lib/siteReader/brainDraft";

export const runtime = "nodejs";
export const maxDuration = 120;

const MAX_SITES = 2;
const PAGES_PER_SITE = 30;
/** Läsningen får ta högst så här lång tid; resten av budgeten är modellens. */
const READ_BUDGET_MS = 55_000;

export async function POST(request: Request) {
  const requestId = crypto.randomUUID().slice(0, 8);

  const guarded = await guardAiRequest("read-site");
  if (!guarded.ok) return guarded.response;
  const { guard } = guarded;

  try {
    const body = await request.json().catch(() => null) as { url?: unknown } | null;
    const [brain, { data: company }] = await Promise.all([
      getCompanyBrain(),
      guard.supabase.from("companies").select("name")
        .eq("user_id", guard.user.id).order("created_at", { ascending: false }).limit(1).maybeSingle(),
    ]);

    const fromBrain = (brain?.websites ?? []).map((w) => w.url);
    const fromBody = typeof body?.url === "string" ? [body.url] : [];
    const roots = [...new Set((fromBrain.length ? fromBrain : fromBody)
      .map((u) => normalizeRoot(u)).filter((u): u is string => Boolean(u)))].slice(0, MAX_SITES);

    if (roots.length === 0) {
      await guard.finish({ status: "error", errorCategory: "no_website" });
      return safeError("Lägg till företagets webbadress under Webbplatser först.", 400);
    }

    // Sajterna läses parallellt; varje sajt har sitt eget tempo.
    const deadline = Date.now() + READ_BUDGET_MS;
    const results = await Promise.all(roots.map((r) => readSite(r, PAGES_PER_SITE, deadline)));
    const pages = results.flatMap((r) => r.pages);
    const notes = results.flatMap((r) => r.notes);

    if (pages.length === 0) {
      await guard.finish({ status: "error", errorCategory: "no_pages" });
      return safeError(notes[0] ?? "Hemsidan gick inte att läsa.", 502);
    }

    const result = await callChatJson(
      SITE_READER_SYSTEM,
      siteReaderPrompt(corpus(pages), typeof company?.name === "string" ? company.name : ""),
      { temperature: 0.2, maxTokens: 3_000 },
    );
    const draft = validateDraft(result.parsed, pages);

    await guard.finish({
      status: "ok", model: AI.CHAT_MODEL,
      promptTokens: result.promptTokens, completionTokens: result.completionTokens,
    });
    return Response.json({ draft, notes, pagesRead: pages.length, sites: roots });
  } catch (error) {
    const failure = classifyAiError(error, "läsningen av hemsidan");
    const usage = modelUsageFrom(error);
    console.error(`READ_SITE ${requestId}: ${failure.kind} ${failure.logTag}`);
    await guard.finish({ status: "error", errorCategory: `${failure.kind}:${failure.logTag}`, ...usage });
    return safeError(failure.message, failure.httpStatus);
  }
}

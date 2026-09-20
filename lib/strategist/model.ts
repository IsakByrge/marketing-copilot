// ─────────────────────────────────────────────────────────────
// Server-only modellanrop för Marketing Strategist. Lazy OpenAI-klient
// (samma mönster som FB-specialisten) så bygget inte kräver nyckeln vid
// import. maxRetries: 0. Strikt JSON. Ingen chain-of-thought.
// ─────────────────────────────────────────────────────────────
import OpenAI from "openai";
import { ModelJsonError } from "@/lib/server/aiError";

export const STRATEGIST_MODEL = process.env.STRATEGIST_MODEL || "gpt-4o";
export const STRATEGIST_TIMEOUT_MS = Number(process.env.STRATEGIST_TIMEOUT_MS) || 45_000;

let client: OpenAI | null = null;
function getClient(): OpenAI {
  if (!client) client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY, maxRetries: 0 });
  return client;
}

export interface CallResult {
  parsed: unknown;
  promptTokens: number;
  completionTokens: number;
}

/**
 * Läser modellens svar som JSON. Går det inte kastas ett ModelJsonError
 * som bär varför: `finish_reason = "length"` betyder att output-taket tog
 * slut mitt i svaret, allt annat är ogiltig JSON av annan anledning.
 *
 * Ren funktion, så att båda fallen går att testa utan nät (modelJson.test.mts).
 * Själva innehållet sparas aldrig — bara längden.
 */
export function parseModelJson(input: {
  content: string;
  finishReason: string | null;
  model: string;
  promptTokens: number;
  completionTokens: number;
}): unknown {
  try {
    return JSON.parse(input.content);
  } catch {
    throw new ModelJsonError({
      source: "strategist",
      finishReason: input.finishReason,
      contentLength: input.content.length,
      model: input.model,
      promptTokens: input.promptTokens,
      completionTokens: input.completionTokens,
    });
  }
}

export async function callJson(
  system: string,
  user: string,
  opts: { temperature?: number; maxTokens?: number; signal?: AbortSignal } = {},
): Promise<CallResult> {
  const completion = await getClient().chat.completions.create(
    {
      model: STRATEGIST_MODEL,
      temperature: opts.temperature ?? 0.5,
      max_tokens: opts.maxTokens ?? 1600,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
    },
    { timeout: STRATEGIST_TIMEOUT_MS, signal: opts.signal },
  );
  const choice = completion.choices[0];
  const content = choice?.message?.content ?? "";
  const promptTokens = completion.usage?.prompt_tokens ?? 0;
  const completionTokens = completion.usage?.completion_tokens ?? 0;
  return {
    parsed: parseModelJson({
      content,
      finishReason: choice?.finish_reason ?? null,
      model: STRATEGIST_MODEL,
      promptTokens,
      completionTokens,
    }),
    promptTokens,
    completionTokens,
  };
}

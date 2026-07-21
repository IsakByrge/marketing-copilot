// ─────────────────────────────────────────────────────────────
// Server-only modellanrop för Marketing Strategist. Lazy OpenAI-klient
// (samma mönster som FB-specialisten) så bygget inte kräver nyckeln vid
// import. maxRetries: 0. Strikt JSON. Ingen chain-of-thought.
// ─────────────────────────────────────────────────────────────
import OpenAI from "openai";

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
  const content = completion.choices[0]?.message?.content ?? "";
  return {
    parsed: JSON.parse(content),
    promptTokens: completion.usage?.prompt_tokens ?? 0,
    completionTokens: completion.usage?.completion_tokens ?? 0,
  };
}

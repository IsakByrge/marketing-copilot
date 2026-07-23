// ─────────────────────────────────────────────────────────────
// Central AI-konfiguration (Security Foundation).
//
// EN plats för modellval, tokenbudget och timeout. Klienten får
// ALDRIG välja modell, tokenbudget eller timeout — allt ägs här och
// styrs via miljövariabler med säkra defaultvärden.
//
// Lazy OpenAI-klient (samma mönster som lib/strategist/model.ts och
// FB-specialisten) så att bygget inte kräver nyckeln vid import.
// maxRetries: 0 — SDK:ns tysta omförsök skulle annars kunna
// tredubbla svarstiden bortom vår timeout.
// ─────────────────────────────────────────────────────────────
import OpenAI from "openai";

export const AI = {
  /** Textmodell för alla JSON-genererande routes. */
  CHAT_MODEL: process.env.AI_CHAT_MODEL || "gpt-4o-mini",
  /** Bildmodell. */
  IMAGE_MODEL: process.env.AI_IMAGE_MODEL || "gpt-image-1",
  /** Hård timeout på ett enskilt modellanrop. */
  TIMEOUT_MS: Number(process.env.AI_TIMEOUT_MS) || 45_000,
  /** Maximal tokenbudget per anrop (max_tokens). Klienten kan aldrig höja detta. */
  MAX_OUTPUT_TOKENS: Number(process.env.AI_MAX_OUTPUT_TOKENS) || 1_600,
} as const;

let client: OpenAI | null = null;
export function getOpenAI(): OpenAI {
  if (!client) client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY, maxRetries: 0 });
  return client;
}

export interface ChatJsonResult {
  parsed: unknown;
  raw: string;
  promptTokens: number;
  completionTokens: number;
}

/**
 * Ett JSON-genererande chat-anrop med central modell, tokentak och timeout.
 * Kastar vid nätverksfel/timeout/ogiltig JSON — anroparen ansvarar för att
 * fånga och översätta till ett begripligt svenskt fel.
 */
export async function callChatJson(
  system: string,
  user: string,
  opts: { temperature?: number; maxTokens?: number; signal?: AbortSignal } = {},
): Promise<ChatJsonResult> {
  const maxTokens = Math.min(opts.maxTokens ?? AI.MAX_OUTPUT_TOKENS, AI.MAX_OUTPUT_TOKENS);
  const completion = await getOpenAI().chat.completions.create(
    {
      model: AI.CHAT_MODEL,
      temperature: opts.temperature ?? 0.5,
      max_tokens: maxTokens,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
    },
    { timeout: AI.TIMEOUT_MS, signal: opts.signal },
  );
  const raw = completion.choices[0]?.message?.content ?? "";
  return {
    parsed: JSON.parse(raw),
    raw,
    promptTokens: completion.usage?.prompt_tokens ?? 0,
    completionTokens: completion.usage?.completion_tokens ?? 0,
  };
}

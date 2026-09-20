// ─────────────────────────────────────────────────────────────
// Säker parsning av modellgenererad JSON.
//
// `response_format: json_object` garanterar giltig JSON — utom när
// genereringen stoppas av output-taket. Då är svaret avhugget, och ett
// rått `JSON.parse` kastar ett `SyntaxError` som inte säger något om
// varför. I loggen blev det `fel:SyntaxError`, omöjligt att skilja från
// vilket annat internt fel som helst.
//
// Här delas de två fallen isär, en gång, för alla flöden som ber
// modellen om JSON:
//   finish_reason = "length"  → avhugget svar (taket tog slut)
//   allt annat                → ogiltig JSON av annan anledning
//
// ANSVARSFÖRDELNING: ai.ts äger modellkonfiguration och anrop,
// aiError.ts äger felklassificering, den här filen äger parsningen.
// Därför kan en egen modellimplementation (Facebook, strategen) använda
// samma parser utan att gå via callChatJson.
//
// Felet bär bara metadata om svaret — aldrig modellens text, aldrig
// användarens underlag. Testas i modelJson.test.mts.
// ─────────────────────────────────────────────────────────────
import { ModelJsonError } from "./aiError";

export interface ModelJsonInput {
  /** Modellens svarstext. Sparas aldrig i felet, bara dess längd. */
  content: string;
  /** `finish_reason` från modellen. "length" betyder att taket tog slut. */
  finishReason: string | null;
  /** Modellen som svarade, för raden i ai_usage_events. */
  model: string;
  promptTokens: number;
  completionTokens: number;
}

/**
 * Läser modellens svar som JSON, eller kastar ett `ModelJsonError` som
 * bär varför det inte gick. Kastar aldrig ett rått `SyntaxError`.
 */
export function parseModelJson(input: ModelJsonInput): unknown {
  try {
    return JSON.parse(input.content);
  } catch {
    throw new ModelJsonError({
      finishReason: input.finishReason,
      contentLength: input.content.length,
      model: input.model,
      promptTokens: input.promptTokens,
      completionTokens: input.completionTokens,
    });
  }
}

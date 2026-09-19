// ─────────────────────────────────────────────────────────────
// Vad som gick fel i ett modellanrop, sagt så att det går att agera på.
//
// Buggrapport 2026-09-19: Facebook-flödet visade "Det gick inte att skapa
// inlägget just nu" fyra gånger i rad. Orsaken var att OpenAI-nyckeln var
// slut på saldo (429 insufficient_quota). Loggen sa bara "Error", eftersom
// SDK:ns felklasser inte sätter `name`, och användaren fick samma mening
// som vid ett riktigt fel. Då går det inte att veta om man ska vänta,
// fylla på saldot eller rapportera en bugg.
//
// Tre slag:
//   saldo      — 401, 402 eller 429 från OpenAI: slut saldo, ogiltig nyckel
//                eller nådd anropskvot. Texten säger vilket.
//   tidsgrans  — anropet hann inte klart.
//   fel        — allt annat. Det är ett fel hos oss.
//
// Gäller alla routes som anropar modellen. Ren logik, inga beroenden.
// Testas i aiError.test.mts.
// ─────────────────────────────────────────────────────────────

export type AiErrorKind = "saldo" | "tidsgrans" | "fel";

export interface ClassifiedAiError {
  kind: AiErrorKind;
  /** HTTP-status för routes som svarar med JSON. Aldrig 429: klienten för
   *  produkttexter väntar ut 429 automatiskt, och slut saldo tar inte slut
   *  av att man väntar. */
  httpStatus: number;
  /** Visas för användaren. */
  message: string;
  /** För loggen och användningsloggen: felklass, status och kod. Aldrig
   *  innehåll ur anropet. */
  logTag: string;
}

/** Koder OpenAI använder när pengarna, inte takten, är problemet. */
const BALANCE_CODES = new Set([
  "insufficient_quota", "credit_balance_exhausted", "billing_hard_limit_reached", "billing_not_active",
]);
const TIMEOUT_CLASSES = new Set(["AbortError", "TimeoutError", "APIConnectionTimeoutError"]);

const HTTP: Record<AiErrorKind, number> = { saldo: 503, tidsgrans: 504, fel: 500 };

/**
 * `what` är det som skulle skapas, i bestämd form: "inlägget", "texterna",
 * "planen", "bilden". Det står i meningen användaren läser.
 */
export function classifyAiError(error: unknown, what: string): ClassifiedAiError {
  const e = (error ?? {}) as {
    name?: string; status?: number; code?: string | null; type?: string | null;
    constructor?: { name?: string }; error?: { code?: string; type?: string };
  };
  const ctorName = e.constructor?.name;
  const klass = ctorName && ctorName !== "Object" && ctorName !== "Error" ? ctorName : e.name ?? "UnknownError";
  const code = e.code ?? e.error?.code ?? undefined;
  const type = e.type ?? e.error?.type ?? undefined;
  const status = typeof e.status === "number" ? e.status : undefined;
  const logTag = [klass, status, code].filter((v) => v !== undefined && v !== null && v !== "").join(":");

  const balance = BALANCE_CODES.has(code ?? "") || BALANCE_CODES.has(type ?? "");

  if (status === 402 || (status === 429 && balance)) {
    return {
      kind: "saldo", httpStatus: HTTP.saldo, logTag,
      message: `AI-tjänsten har inget saldo kvar, så ${what} kunde inte skapas. Det är inget fel i ditt underlag. Saldot behöver fyllas på hos OpenAI — att försöka igen hjälper inte förrän dess.`,
    };
  }
  if (status === 401) {
    return {
      kind: "saldo", httpStatus: HTTP.saldo, logTag,
      message: `AI-tjänsten godtar inte vår API-nyckel, så ${what} kunde inte skapas. Det är inget fel i ditt underlag. Nyckeln behöver bytas — att försöka igen hjälper inte förrän dess.`,
    };
  }
  if (status === 429) {
    return {
      kind: "saldo", httpStatus: HTTP.saldo, logTag,
      message: `AI-tjänstens kvot för antal anrop är nådd just nu, så ${what} kunde inte skapas. Vänta en minut och försök igen — ditt underlag är kvar.`,
    };
  }
  if (TIMEOUT_CLASSES.has(klass) || TIMEOUT_CLASSES.has(e.name ?? "")) {
    return {
      kind: "tidsgrans", httpStatus: HTTP.tidsgrans, logTag,
      message: `Det tog för lång tid att skapa ${what}. Försök igen — ditt underlag är kvar.`,
    };
  }
  return {
    kind: "fel", httpStatus: HTTP.fel, logTag,
    message: `Något gick fel när ${what} skulle skapas. Försök igen. Händer det igen är det ett fel hos oss, inte i ditt underlag.`,
  };
}

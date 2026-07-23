// ─────────────────────────────────────────────────────────────
// Kostnads- och missbruksskydd för AI-routes (Security Foundation).
//
// Två enkla, hållbara skydd per (användare, funktion):
//   1. Samtidighetslås — avvisar ett andra ANROP medan ett redan pågår
//      (skyddar mot dubbelklick och parallell-spam).
//   2. Glidande fönster-rate-limit — högst N anrop per fönster.
//
// MEDVETET ENKELT (MVP): tillståndet ligger i processminnet. På en
// serverless-plattform (Vercel) betyder det att gränsen gäller per
// aktiv instans, inte globalt, och nollställs vid kallstart. Det räcker
// för att stoppa oavsiktlig spam och grovt missbruk i denna sprint. En
// delad räknare (Supabase/Redis) skjuts till en senare sprint och är
// noterad i säkerhetsrapporten. Trösklarna är konfigurerbara via env.
// ─────────────────────────────────────────────────────────────

export const RATE_LIMIT = {
  /** Max antal anrop per användare och funktion inom fönstret. */
  MAX_PER_WINDOW: Number(process.env.AI_RATE_LIMIT_MAX) || 20,
  /** Fönstrets längd i millisekunder. */
  WINDOW_MS: Number(process.env.AI_RATE_LIMIT_WINDOW_MS) || 60_000,
} as const;

type Key = string; // `${userId}:${feature}`

const inFlight = new Set<Key>();
const hits = new Map<Key, number[]>(); // key → tidsstämplar inom fönstret

export type LimitDecision =
  | { ok: true; release: () => void }
  | { ok: false; reason: "concurrent" | "rate"; retryAfterMs: number };

function keyFor(userId: string, feature: string): Key {
  return `${userId}:${feature}`;
}

/**
 * Försöker reservera en plats för ett AI-anrop. Anroparen MÅSTE kalla
 * `release()` när anropet är klart (i en finally) om ok === true.
 */
export function acquireSlot(userId: string, feature: string): LimitDecision {
  const key = keyFor(userId, feature);
  const now = Date.now();

  // 1) Samtidighet: bara ett pågående anrop per (användare, funktion).
  if (inFlight.has(key)) {
    return { ok: false, reason: "concurrent", retryAfterMs: 2_000 };
  }

  // 2) Rate: rensa gamla träffar och räkna inom fönstret.
  const windowStart = now - RATE_LIMIT.WINDOW_MS;
  const recent = (hits.get(key) ?? []).filter((t) => t > windowStart);
  if (recent.length >= RATE_LIMIT.MAX_PER_WINDOW) {
    const oldest = recent[0];
    hits.set(key, recent);
    return { ok: false, reason: "rate", retryAfterMs: Math.max(0, oldest + RATE_LIMIT.WINDOW_MS - now) };
  }

  recent.push(now);
  hits.set(key, recent);
  inFlight.add(key);

  // Opportunistisk städning så Map:en inte växer obegränsat.
  if (hits.size > 5_000) {
    for (const [k, arr] of hits) {
      const kept = arr.filter((t) => t > windowStart);
      if (kept.length === 0) hits.delete(k);
      else hits.set(k, kept);
    }
  }

  let released = false;
  return {
    ok: true,
    release() {
      if (released) return;
      released = true;
      inFlight.delete(key);
    },
  };
}

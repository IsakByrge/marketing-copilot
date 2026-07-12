// ─────────────────────────────────────────────────────────────
// Kampanjanalys — delade typer, tidsgränser och validering.
// Importeras av både API-routen (server) och campaign-builder (klient)
// så att kontraktet är exakt detsamma på båda sidor.
// ─────────────────────────────────────────────────────────────

export interface RecommendedChannel {
  name: string;
  motivation: string;
}

/** Marknadschefens färdiga rekommendation, byggd ur ett CampaignBrief. */
export interface CampaignRecommendation {
  /** Kampanjens bärande idé i en mening. */
  headline: string;
  /** Strategin i 2–4 meningar. */
  strategy: string;
  /** Huvudbudskapet mot målgruppen. */
  coreMessage: string;
  /** Rekommenderade kanaler med motivering. */
  channels: RecommendedChannel[];
  /** Konkreta första aktiviteter, i ordning. */
  activities: string[];
  /** Risker eller luckor att ha koll på (kan vara tom). */
  watchouts: string[];
}

/* ── Tidsgränser (UI:t får aldrig vänta längre än 45 s) ─────── */
export const ANALYSIS_LIMITS = {
  /** Timeout för modellanropet på servern (ms). */
  TIMEOUT_MS: 30_000,
  /** Klientens absoluta tak för fetch-anropet (ms) — under 45 s. */
  CLIENT_TIMEOUT_MS: 40_000,
  /** Max längd per textfält i svaret. */
  MAX_TEXT_LEN: 700,
  /** Max antal poster per lista. */
  MAX_LIST: 6,
} as const;

const str = (v: unknown, max: number): string =>
  typeof v === "string" ? v.trim().slice(0, max) : "";

const strList = (v: unknown, max: number): string[] =>
  Array.isArray(v)
    ? v.map((x) => str(x, ANALYSIS_LIMITS.MAX_TEXT_LEN)).filter((x) => x.length > 0).slice(0, max)
    : [];

/**
 * Defensiv validering av modellens JSON till en säker CampaignRecommendation.
 * Returnerar null om något är strukturellt fel — anroparen visar då ett fel.
 */
export function validateRecommendation(input: unknown): CampaignRecommendation | null {
  if (!input || typeof input !== "object") return null;
  const o = input as Record<string, unknown>;

  const headline = str(o.headline, 200);
  const strategy = str(o.strategy, ANALYSIS_LIMITS.MAX_TEXT_LEN);
  const coreMessage = str(o.coreMessage, ANALYSIS_LIMITS.MAX_TEXT_LEN);
  if (headline.length < 3 || strategy.length < 10 || coreMessage.length < 3) return null;

  const channels: RecommendedChannel[] = Array.isArray(o.channels)
    ? o.channels
        .map((c) => {
          const ch = c as Record<string, unknown>;
          return { name: str(ch?.name, 80), motivation: str(ch?.motivation, 300) };
        })
        .filter((c) => c.name.length > 0 && c.motivation.length > 0)
        .slice(0, ANALYSIS_LIMITS.MAX_LIST)
    : [];
  if (channels.length === 0) return null;

  const activities = strList(o.activities, ANALYSIS_LIMITS.MAX_LIST);
  if (activities.length === 0) return null;

  return {
    headline,
    strategy,
    coreMessage,
    channels,
    activities,
    watchouts: strList(o.watchouts, ANALYSIS_LIMITS.MAX_LIST),
  };
}

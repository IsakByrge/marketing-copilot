// ─────────────────────────────────────────────────────────────
// Användning och uppskattad kostnad.
//
// `ai_usage_events` har loggat varje AI-anrop sedan säkerhetssprinten
// utan att någonsin visas någonstans. Här läses den, och siffrorna
// delas i två sorter:
//
//   FAKTA        antal anrop, antal fel, tokens. Kommer direkt ur
//                loggen och kan alltid beläggas.
//   UPPSKATTNING kronor. Bygger på prislistan nedan, som är hårdkodad
//                och kommer att bli inaktuell. Därför märks den alltid
//                som uppskattning och priset visas öppet.
//
// Regeln i VISION.md — visa aldrig en siffra som inte kan beläggas —
// gäller. Uppskattningen är tillåten just för att den är märkt som
// sådan och för att antagandet syns.
//
// Skrivningen ligger kvar i usage.ts (logAiUsage). Den här filen läser
// bara — de har olika livslängd och olika anropare.
//
// Ren logik utom hämtningen. Testas i usageReport.test.mts.
// ─────────────────────────────────────────────────────────────

/**
 * Pris i USD per miljon tokens. Uppdatera vid prisändring — det är
 * det enda stället. Okända modeller kostar noll i uppskattningen
 * hellre än att gissa fel.
 */
export const PRICES: Record<string, { input: number; output: number }> = {
  "gpt-4o": { input: 2.5, output: 10 },
  "gpt-4o-mini": { input: 0.15, output: 0.6 },
};

/** Uppskattat styckpris för en bild i USD, per kvalitetsnivå. */
export const IMAGE_PRICE = { low: 0.02, high: 0.19 } as const;

export interface UsageRow {
  feature: string;
  model: string | null;
  status: string;
  prompt_tokens: number | null;
  completion_tokens: number | null;
}

export interface FeatureUsage {
  feature: string;
  calls: number;
  errors: number;
  promptTokens: number;
  completionTokens: number;
  /** USD. Noll för modeller som saknas i PRICES — aldrig en gissning. */
  estimatedUsd: number;
  /** Sant när minst ett anrop använde en modell utan känt pris. */
  hasUnknownModel: boolean;
}

export interface UsageSummary {
  calls: number;
  errors: number;
  estimatedUsd: number;
  hasUnknownModel: boolean;
  byFeature: FeatureUsage[];
}

const isImage = (model: string | null): boolean => Boolean(model?.includes("image"));

/** Kostnad för en enskild rad. Bildmodeller prissätts per styck. */
export function rowCost(row: UsageRow): { usd: number; known: boolean } {
  if (!row.model) return { usd: 0, known: false };

  if (isImage(row.model)) {
    // Kvalitet loggas inte, så vi antar det dyra alternativet. Hellre
    // en uppskattning som är för hög än en som lugnar i onödan.
    return { usd: IMAGE_PRICE.high, known: true };
  }

  const price = PRICES[row.model];
  if (!price) return { usd: 0, known: false };

  const inTok = row.prompt_tokens ?? 0;
  const outTok = row.completion_tokens ?? 0;
  return {
    usd: (inTok / 1_000_000) * price.input + (outTok / 1_000_000) * price.output,
    known: true,
  };
}

/** Aggregerar rader till en sammanfattning, sorterad efter kostnad. */
export function summarize(rows: UsageRow[]): UsageSummary {
  const map = new Map<string, FeatureUsage>();
  let unknown = false;

  for (const row of rows) {
    const key = row.feature || "okänd";
    const f = map.get(key) ?? {
      feature: key, calls: 0, errors: 0,
      promptTokens: 0, completionTokens: 0,
      estimatedUsd: 0, hasUnknownModel: false,
    };

    f.calls += 1;
    if (row.status !== "ok") f.errors += 1;
    f.promptTokens += row.prompt_tokens ?? 0;
    f.completionTokens += row.completion_tokens ?? 0;

    const { usd, known } = rowCost(row);
    f.estimatedUsd += usd;
    if (!known) {
      f.hasUnknownModel = true;
      unknown = true;
    }

    map.set(key, f);
  }

  const byFeature = [...map.values()].sort((a, b) => b.estimatedUsd - a.estimatedUsd);

  return {
    calls: byFeature.reduce((n, f) => n + f.calls, 0),
    errors: byFeature.reduce((n, f) => n + f.errors, 0),
    estimatedUsd: byFeature.reduce((n, f) => n + f.estimatedUsd, 0),
    hasUnknownModel: unknown,
    byFeature,
  };
}

/** Läser den inloggade användarens användning de senaste dagarna. */
export async function getUsage(days = 30): Promise<UsageSummary> {
  const empty: UsageSummary = {
    calls: 0, errors: 0, estimatedUsd: 0, hasUnknownModel: false, byFeature: [],
  };

  try {
    const { createClient } = await import("../supabase-server");
    const sb = await createClient();
    const { data: { user } } = await sb.auth.getUser();
    if (!user) return empty;

    const since = new Date(Date.now() - days * 86_400_000).toISOString();
    const { data } = await sb
      .from("ai_usage_events")
      .select("feature, model, status, prompt_tokens, completion_tokens")
      .eq("user_id", user.id)
      .gte("created_at", since)
      .limit(5_000);

    return summarize((data ?? []) as UsageRow[]);
  } catch (error) {
    console.warn("USAGE_READ_FAILED:", error instanceof Error ? error.name : "UnknownError");
    return empty;
  }
}

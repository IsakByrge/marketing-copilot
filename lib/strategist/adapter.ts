// ─────────────────────────────────────────────────────────────
// Strategi-adapter: normaliserar strategy_context (v1 platt ELLER
// v2 StrategyV2) till EN gemensam form som Facebook Specialist
// konsumerar. Ren funktion, inga sidoeffekter — körs på klient och
// server. Äldre v1-strategier fortsätter fungera utan migrering.
// ─────────────────────────────────────────────────────────────
import type { NormalizedStrategyContext, StrategyV2 } from "./types";

const s = (v: unknown): string | undefined => {
  const t = typeof v === "string" ? v.trim() : "";
  return t.length ? t : undefined;
};
const arr = (v: unknown, n = 12): string[] =>
  Array.isArray(v) ? v.filter((x): x is string => typeof x === "string" && x.trim().length > 0).map((x) => x.trim()).slice(0, n) : [];

/** Sant om objektet är en v2-strategi (StrategyV2). */
export function isStrategyV2(raw: unknown): raw is StrategyV2 {
  if (!raw || typeof raw !== "object") return false;
  const o = raw as Record<string, unknown>;
  return o.version === 2 && !!o.strategy && typeof o.strategy === "object";
}

/**
 * Normaliserar valfri strategy_context (v1/v2) till NormalizedStrategyContext.
 * Hittar aldrig på fält — saknas något lämnas det undefined.
 */
export function normalizeStrategyContext(raw: unknown): NormalizedStrategyContext {
  if (!raw || typeof raw !== "object") return {};

  if (isStrategyV2(raw)) {
    const v = raw as StrategyV2;
    const st = v.strategy ?? ({} as StrategyV2["strategy"]);
    const channels = Array.isArray(st.channelPriority)
      ? st.channelPriority.map((c) => s(c?.channel)).filter((x): x is string => !!x)
      : [];
    return {
      goal: s(st.primaryGoal) ?? s(v.brief?.goalTitle),
      goalKey: s(v.brief?.goalKey),
      product: s(st.product) ?? s(v.brief?.product),
      audience: s(st.primaryAudience),
      secondaryAudience: s(st.secondaryAudience ?? undefined),
      offer: s(st.offer) ?? s(v.brief?.offer),
      geographicArea: s(st.geographicArea) ?? s(v.brief?.geographicArea),
      deadline: s(v.brief?.period?.end),
      cta: s(st.primaryCta),
      mainMessage: s(st.mainMessage),
      valueProposition: s(st.valueProposition),
      urgency: s(st.urgency),
      channels,
      risks: arr(st.risks),
      assumptions: arr(st.assumptions),
    };
  }

  // v1: platt objekt (goal, goalKey, product, audience, mainMessage, offer,
  // price, geographicArea, deadline, cta, channels, risks). Läs som det är.
  const o = raw as Record<string, unknown>;
  return {
    goal: s(o.goal),
    goalKey: s(o.goalKey),
    product: s(o.product),
    audience: s(o.audience),
    offer: s(o.offer),
    price: s(o.price),
    geographicArea: s(o.geographicArea),
    deadline: s(o.deadline),
    cta: s(o.cta),
    mainMessage: s(o.mainMessage),
    channels: arr(o.channels),
    risks: arr(o.risks),
  };
}

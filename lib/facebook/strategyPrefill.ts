// ─────────────────────────────────────────────────────────────
// Explicit, typad mappning: sparad kampanjstrategi → Facebook-formulär.
//
// Campaign Builder är KÄLLAN. Facebook Specialist återanvänder de fält
// som kan härledas ur strategin och lämnar resten tomt (specialisten ber
// då användaren komplettera). Vi hittar ALDRIG på värden — saknas ett
// fält i strategin sätts motsvarande formulärfält inte alls.
//
// Detta bygger bara en arbetskopia för formuläret. Den autentiserade
// strategikontexten byggs fortfarande server-side i lib/facebook/context.ts
// — klienten kan inte injicera "fakta" som kommer från databasen.
// ─────────────────────────────────────────────────────────────
import type { FacebookContentGoal } from "@/app/content/facebook/types";

/** Delmängden av campaign_strategies.strategy_context som formuläret kan läsa.
 *  Allt valfritt — äldre rader saknar de nyare fälten (då förifylls färre fält). */
export interface StrategyContextForForm {
  goal?: string;      // läsbar måltitel (visning/fallback)
  goalKey?: string;   // CampaignGoal-enum, för pålitlig syfte-mappning
  product?: string;
  audience?: string;
  mainMessage?: string;
  offer?: string;
  price?: string;
  geographicArea?: string;
  deadline?: string;
  channels?: string[];
  risks?: string[];
}

/** Kanalspecifik arbetskopia. Endast fält som HÄRLETTS ur strategin sätts.
 *  desiredAction (CTA), requestedAngle, toneOverride och length saknar källa
 *  i strategin och förifylls därför aldrig här. */
export interface StrategyPrefill {
  goal?: FacebookContentGoal;
  productOrTopic?: string;
  audience?: string;
  offer?: string;
  price?: string;
  deadline?: string;
  geographicArea?: string;
  /** Svenska etiketter för de fält som faktiskt förifylldes (diskret märkning). */
  filledFields: string[];
}

/** CampaignGoal (Campaign Builder) → FacebookContentGoal. Explicit, ingen gissning. */
const GOAL_MAP: Record<string, FacebookContentGoal> = {
  "sell-product": "sell",
  "more-quotes": "leads",
  "store-visits": "store_visits",
  "fill-slots": "sell",
  "launch": "launch",
  "seasonal": "sell",
  "other": "other",
};

const clean = (v: unknown): string => (typeof v === "string" ? v.trim() : "");

/**
 * Bygger en förifyllnadsuppsättning ur strategikontexten.
 * Sätter bara fält som finns i strategin; övriga utelämnas (lämnas tomma i formuläret).
 */
export function mapStrategyToPrefill(ctx: StrategyContextForForm | null | undefined): StrategyPrefill {
  const p: StrategyPrefill = { filledFields: [] };
  if (!ctx) return p;

  const goalKey = clean(ctx.goalKey);
  if (goalKey && GOAL_MAP[goalKey]) { p.goal = GOAL_MAP[goalKey]; p.filledFields.push("Syfte"); }

  const product = clean(ctx.product);
  if (product) { p.productOrTopic = product; p.filledFields.push("Vad marknadsförs"); }

  const audience = clean(ctx.audience);
  if (audience) { p.audience = audience; p.filledFields.push("Målgrupp"); }

  const offer = clean(ctx.offer);
  if (offer) { p.offer = offer; p.filledFields.push("Erbjudande"); }

  const price = clean(ctx.price);
  if (price) { p.price = price; p.filledFields.push("Pris"); }

  const deadline = clean(ctx.deadline);
  if (deadline) { p.deadline = deadline; p.filledFields.push("Sista datum"); }

  const geo = clean(ctx.geographicArea);
  if (geo) { p.geographicArea = geo; p.filledFields.push("Geografiskt område"); }

  return p;
}

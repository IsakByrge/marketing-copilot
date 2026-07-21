// ─────────────────────────────────────────────────────────────
// Målalternativ för Marketing Strategist-briefen. Speglar CampaignGoal-
// enumet (app/campaign-builder/types.ts) med svenska etiketter/hintar.
// Klient- och server-säker (rena konstanter).
// ─────────────────────────────────────────────────────────────
import type { CampaignGoal } from "@/app/campaign-builder/types";

export const STRATEGIST_GOALS: { id: CampaignGoal; title: string; hint: string }[] = [
  { id: "sell-product", title: "Sälj mer av en produkt", hint: "Öka försäljningen av något specifikt" },
  { id: "more-quotes", title: "Få fler offertförfrågningar", hint: "Fler kunder som ber om offert" },
  { id: "store-visits", title: "Få fler besök till butik", hint: "Locka fler till den fysiska platsen" },
  { id: "fill-slots", title: "Fyll lediga tider", hint: "Fyll luckor i kalendern" },
  { id: "launch", title: "Lansera något nytt", hint: "Introducera en produkt eller tjänst" },
  { id: "seasonal", title: "Säsongskampanj", hint: "Anpassa efter säsong eller händelse" },
  { id: "other", title: "Annat mål", hint: "Beskriv själv i noteringen" },
];

export const CAMPAIGN_GOALS: readonly CampaignGoal[] = STRATEGIST_GOALS.map((g) => g.id);

export const GOAL_TITLES: Record<CampaignGoal, string> =
  Object.fromEntries(STRATEGIST_GOALS.map((g) => [g.id, g.title])) as Record<CampaignGoal, string>;

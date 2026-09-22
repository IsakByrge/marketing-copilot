// ─────────────────────────────────────────────────────────────
// Direktlänk till Facebook med ?strategy=<id>. Ren logik, inga
// sidoeffekter — sidan gör själva anropen.
//
// Facebook-sidan laddar de 20 senaste strategierna som vanlig lista.
// En kampanj (och "Kör igen") länkar via sitt exakta strategy_id, som
// kan vara äldre än så. Finns id:t inte i listan hämtas just den raden
// separat, och läggs först så att vald strategi faktiskt syns.
// ─────────────────────────────────────────────────────────────
import type { StrategyContextForForm } from "./strategyPrefill";

export interface StrategyOption {
  id: string;
  title: string;
  goal: string;
  context: StrategyContextForForm | null;
}

/** Rad från campaign_strategies (id,title,goal,strategy_context) → valbar strategi. */
export function toStrategyOption(r: Record<string, unknown>): StrategyOption {
  return {
    id: r.id as string,
    title: r.title as string,
    goal: r.goal as string,
    context: (r.strategy_context && typeof r.strategy_context === "object"
      ? r.strategy_context as StrategyContextForForm : null),
  };
}

export type LinkedStrategy =
  | { kind: "none" }                              // ingen ?strategy= i länken
  | { kind: "inList"; match: StrategyOption }     // finns bland de senaste
  | { kind: "lookup"; id: string };               // hämta just den raden separat

export function resolveLinkedStrategy(list: StrategyOption[], wanted: string | null): LinkedStrategy {
  const id = (wanted ?? "").trim();
  if (!id) return { kind: "none" };
  const match = list.find((s) => s.id === id);
  return match ? { kind: "inList", match } : { kind: "lookup", id };
}

/** Den länkade strategin först, utan dubblett. */
export function withLinkedFirst(list: StrategyOption[], linked: StrategyOption): StrategyOption[] {
  return [linked, ...list.filter((s) => s.id !== linked.id)];
}

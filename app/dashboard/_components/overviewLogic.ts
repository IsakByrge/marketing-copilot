// ─────────────────────────────────────────────────────────────────────
// Overview logic — derives the Recommendation Stack and the Business Brief
// summary from the user's REAL state only. No fabricated data: every item
// maps to a concrete, honest next step the product can actually deliver
// (complete Company Brain, generate a plan, act on a real plan opportunity,
// build a strategy). Pure and decoupled from client hooks so it is trivially
// unit-testable (see overviewLogic.test.mts).
// ─────────────────────────────────────────────────────────────────────

export type BrainLevel = "basic" | "useful" | "strong";

/** A real, derivable plan opportunity (from plans.opportunities). */
export interface OverviewOpportunity {
  title: string;
  relevance: string;
}

/** Everything the Overview needs, mapped from real hook data by the page. */
export interface OverviewState {
  hasCompany: boolean;
  companyName: string | null;
  brainLevel: BrainLevel | null;
  gapCount: number;
  hasPlan: boolean;
  opportunities: OverviewOpportunity[];
}

export type RecommendationKind = "onboarding" | "brain" | "plan" | "opportunity" | "strategy";

export interface RecommendationItem {
  id: string;
  kind: RecommendationKind;
  title: string;
  rationale: string;
  cta: string;
  /** Navigation target… */
  href?: string;
  /** …or a client-handled action instead of navigation. */
  action?: "generate-plan";
  /** Honest, rule-based estimate — never a fabricated metric. */
  effort: "low" | "medium";
}

export const MAX_RECOMMENDATIONS = 3;

/**
 * Ordered by urgency. Sliced to MAX_RECOMMENDATIONS by the caller-facing
 * `recommendations()`. Always yields at least one item.
 */
function buildAll(state: OverviewState): RecommendationItem[] {
  const items: RecommendationItem[] = [];

  if (!state.hasCompany) {
    items.push({
      id: "onboarding",
      kind: "onboarding",
      title: "Slutför onboarding",
      rationale:
        "Innan din marknadschef kan ge rekommendationer behövs en företagsprofil att utgå från.",
      cta: "Starta onboarding",
      href: "/onboarding",
      effort: "low",
    });
    return items;
  }

  // Company Brain quality gates the quality of every recommendation, so it
  // leads when weak.
  if (state.brainLevel === "basic") {
    items.push({
      id: "brain-basic",
      kind: "brain",
      title: "Bygg din Company Brain",
      rationale:
        "Grunderna om företaget saknas ännu. Ju mer din marknadschef vet, desto vassare blir varje rekommendation.",
      cta: "Komplettera företagskunskap",
      href: "/company",
      effort: "low",
    });
  } else if (state.gapCount > 0) {
    items.push({
      id: "brain-gaps",
      kind: "brain",
      title:
        state.gapCount === 1
          ? "Fyll en kunskapslucka i Company Brain"
          : `Fyll ${state.gapCount} kunskapsluckor i Company Brain`,
      rationale:
        "Några få kompletteringar stärker underlaget för strategi och innehåll märkbart.",
      cta: "Komplettera företagskunskap",
      href: "/company",
      effort: "low",
    });
  }

  if (!state.hasPlan) {
    items.push({
      id: "plan",
      kind: "plan",
      title: "Generera veckans marknadsplan",
      rationale:
        "Du har ingen aktuell plan. Din marknadschef sammanställer förslag på inlägg, nyhetsbrev och kampanjer utifrån företaget.",
      cta: "Generera veckoplan",
      action: "generate-plan",
      effort: "low",
    });
  }

  for (let i = 0; i < state.opportunities.length; i++) {
    const o = state.opportunities[i];
    if (!o.title.trim()) continue;
    items.push({
      id: `opportunity-${i}`,
      kind: "opportunity",
      title: `Ta vara på: ${o.title}`,
      rationale: o.relevance || "En möjlighet som din marknadschef identifierat i veckans plan.",
      cta: "Se i innehållet",
      href: "/content",
      effort: "medium",
    });
  }

  // Baseline forward step so the stack is never empty and always points to a
  // real strategic action.
  items.push({
    id: "strategy",
    kind: "strategy",
    title: "Bygg en kampanjstrategi",
    rationale:
      "Låt din marknadschef föreslå fokus, utmana svaga antaganden och ta fram ett komplett kampanjunderlag.",
    cta: "Öppna Strategi",
    href: "/campaign-builder",
    effort: "medium",
  });

  return items;
}

/** The prioritised recommendation stack (max MAX_RECOMMENDATIONS, ≥1). */
export function recommendations(state: OverviewState): RecommendationItem[] {
  return buildAll(state).slice(0, MAX_RECOMMENDATIONS);
}

/** Honest one-line brief for the greeting — reflects real attention count. */
export function briefSummary(state: OverviewState): string {
  if (!state.hasCompany) {
    return "Slutför onboarding så kan din marknadschef börja ge rekommendationer.";
  }
  const count = recommendations(state).length;
  if (count === 0) return "Allt ser lugnt ut just nu.";
  const noun = count === 1 ? "rekommendation" : "rekommendationer";
  return `Din marknadschef har ${count} ${noun} att fokusera på.`;
}

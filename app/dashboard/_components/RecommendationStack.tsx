import Link from "next/link";
import { IconArrowRight, IconSparkle } from "@/app/_shared/icons";
import type { RecommendationItem } from "./overviewLogic";
import { RecommendationCard } from "./RecommendationCard";

// The Recommendation Stack is the Overview's primary focus zone (Design
// System 2.0 §27/§28). It leads the page, above any supporting status.
export function RecommendationStack({
  items,
  onGeneratePlan,
  generating = false,
}: {
  items: RecommendationItem[];
  onGeneratePlan?: () => void;
  generating?: boolean;
}) {
  return (
    <section aria-labelledby="rec-stack-heading" className="rounded-lg border border-border bg-surface-sunken/60 p-4 sm:p-5">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 id="rec-stack-heading" className="flex items-center gap-2 text-sm font-semibold text-text-primary">
          <span aria-hidden className="text-primary">
            <IconSparkle size={18} />
          </span>
          Rekommenderade åtgärder
        </h2>
        <Link
          href="/campaign-builder"
          className="flex items-center gap-1 rounded text-xs font-medium text-primary transition-colors hover:text-primary-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
        >
          Öppna Strategi
          <IconArrowRight size={14} />
        </Link>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        {items.map((item, i) => (
          <RecommendationCard
            key={item.id}
            item={item}
            primary={i === 0}
            onGeneratePlan={onGeneratePlan}
            generating={generating}
          />
        ))}
      </div>
    </section>
  );
}

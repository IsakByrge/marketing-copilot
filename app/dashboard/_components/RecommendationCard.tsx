import { Button, ButtonLink, Card, Chip } from "@/app/_shared/primitives";
import {
  IconArrowRight, IconBuilder, IconCompany, IconOpportunity, IconRecommendation,
} from "@/app/_shared/icons";
import type { RecommendationItem, RecommendationKind } from "./overviewLogic";

const KIND_ICON: Record<RecommendationKind, (p: { size?: number }) => React.ReactNode> = {
  onboarding: IconArrowRight,
  brain: IconCompany,
  plan: IconRecommendation,
  opportunity: IconOpportunity,
  strategy: IconBuilder,
};

const EFFORT_LABEL: Record<RecommendationItem["effort"], string> = {
  low: "Låg insats",
  medium: "Medel insats",
};

export function RecommendationCard({
  item,
  primary = false,
  onGeneratePlan,
  generating = false,
}: {
  item: RecommendationItem;
  /** The single primary action in the stack — rendered with the primary CTA. */
  primary?: boolean;
  onGeneratePlan?: () => void;
  generating?: boolean;
}) {
  const Icon = KIND_ICON[item.kind];

  return (
    <Card
      padding="md"
      className={cardClass(primary)}
    >
      <div className="flex flex-1 flex-col gap-4">
        <div className="flex items-start gap-3">
          <span
            aria-hidden
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-primary-surface text-primary"
          >
            <Icon size={20} />
          </span>
          <div className="min-w-0">
            <h3 className="text-sm font-semibold leading-snug text-text-primary">{item.title}</h3>
          </div>
        </div>

        <p className="flex-1 text-sm leading-relaxed text-text-secondary">{item.rationale}</p>

        <div className="flex flex-wrap items-center gap-2">
          {primary && <Chip tone="primary">Prioriterad</Chip>}
          <Chip tone="neutral">{EFFORT_LABEL[item.effort]}</Chip>
        </div>
      </div>

      <div className="mt-5">
        {item.action === "generate-plan" ? (
          <Button
            variant={primary ? "primary" : "secondary"}
            loading={generating}
            onClick={onGeneratePlan}
            className="w-full"
          >
            {item.cta}
          </Button>
        ) : (
          <ButtonLink
            href={item.href ?? "#"}
            variant={primary ? "primary" : "secondary"}
            className="w-full"
          >
            {item.cta}
          </ButtonLink>
        )}
      </div>
    </Card>
  );
}

function cardClass(primary: boolean): string {
  const base = "flex h-full flex-col";
  return primary ? `${base} ring-1 ring-primary/20` : base;
}

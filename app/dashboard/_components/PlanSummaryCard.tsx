import { Button, ButtonLink, Card, Chip } from "@/app/_shared/primitives";

// This week's plan at a glance — real data from the latest generated plan.
// When none exists yet, an honest empty state offers to generate one.
export function PlanSummaryCard({
  focus,
  tags,
  postCount,
  campaignCount,
  onGeneratePlan,
  generating = false,
}: {
  focus: string | null;
  tags: string[];
  postCount: number;
  campaignCount: number;
  onGeneratePlan?: () => void;
  generating?: boolean;
}) {
  return (
    <Card padding="md" className="flex h-full flex-col">
      <h2 className="mb-1 text-sm font-semibold text-text-primary">Veckans plan</h2>

      {focus ? (
        <>
          <p className="text-sm leading-relaxed text-text-secondary">{focus}</p>

          {tags.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-1.5">
              {tags.slice(0, 4).map((t, i) => (
                <Chip key={i} tone="neutral">{t}</Chip>
              ))}
            </div>
          )}

          <dl className="mt-4 flex flex-1 items-end gap-6">
            <div>
              <dt className="text-xs text-text-tertiary">Inlägg</dt>
              <dd className="text-lg font-semibold text-text-primary">{postCount}</dd>
            </div>
            <div>
              <dt className="text-xs text-text-tertiary">Kampanjförslag</dt>
              <dd className="text-lg font-semibold text-text-primary">{campaignCount}</dd>
            </div>
          </dl>

          <div className="mt-5">
            <ButtonLink href="/content" variant="secondary" size="sm">
              Se allt innehåll
            </ButtonLink>
          </div>
        </>
      ) : (
        <>
          <p className="flex-1 text-sm leading-relaxed text-text-secondary">
            Ingen plan är genererad ännu. Din marknadschef kan sammanställa veckans inlägg,
            nyhetsbrev och kampanjförslag utifrån företaget.
          </p>
          <div className="mt-5">
            <Button variant="secondary" size="sm" loading={generating} onClick={onGeneratePlan}>
              Generera veckoplan
            </Button>
          </div>
        </>
      )}
    </Card>
  );
}

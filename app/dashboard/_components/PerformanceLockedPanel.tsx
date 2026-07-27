import { Card, Chip } from "@/app/_shared/primitives";
import { IconCampaigns } from "@/app/_shared/icons";

// Honest locked/empty state for performance (Design System 2.0 §21/§29).
// Revenue, conversions and channel performance require connected channels
// (Meta, Google) that don't exist yet — so we describe the value instead of
// fabricating numbers. No fake KPIs, no dead CTA, doesn't look broken.
export function PerformanceLockedPanel() {
  return (
    <Card padding="lg" className="flex flex-col items-start gap-4">
      <div className="flex w-full items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <span
            aria-hidden
            className="flex h-10 w-10 items-center justify-center rounded-md bg-surface-sunken text-text-tertiary"
          >
            <IconCampaigns size={20} />
          </span>
          <h2 className="text-sm font-semibold text-text-primary">Prestanda och kanaler</h2>
        </div>
        <Chip tone="neutral">Snart</Chip>
      </div>

      <p className="max-w-2xl text-sm leading-relaxed text-text-secondary">
        När du kopplar dina kanaler (t.ex. Meta och Google) visar din marknadschef verklig
        prestanda här — intäkter, konverteringar och hur varje kanal presterar över tid, med
        rekommendationer kopplade till resultatet. Tills dess visar vi inga siffror i stället för
        att gissa.
      </p>

      <div className="flex flex-wrap gap-2">
        {["Intäkter", "Konverteringar", "Kanalprestanda", "Kampanj-ROI"].map((label) => (
          <span
            key={label}
            className="rounded-full border border-dashed border-border px-3 py-1 text-xs text-text-tertiary"
          >
            {label}
          </span>
        ))}
      </div>
    </Card>
  );
}

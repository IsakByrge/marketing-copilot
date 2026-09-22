"use client";

// ─────────────────────────────────────────────────────────────
// "Ny kampanj": utgå från en sparad strategi, eller ta fram en ny i
// Kampanjbyggaren. Ett ark, två lägen — välj strategi, sätt namn och
// datum. Ingen wizard.
//
// company_id och strategy_id tas från den valda strategiraden, aldrig
// från "senaste företaget": RLS kräver att strategins företag är
// kampanjens företag.
// ─────────────────────────────────────────────────────────────
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Alert, Button, ButtonLink, Skeleton, cx, selectableSurface } from "@/app/_shared/primitives";
import { IconBuilder } from "@/app/_shared/icons";
import {
  prefillFromStrategy, readStrategy, strategiesAvailableForNewCampaign,
  type CampaignForm, type StrategyRow,
} from "@/lib/campaigns/logic";
import { createCampaignFromStrategy, listStrategiesForNewCampaign } from "@/lib/campaigns/store";
import { Sheet } from "./Sheet";
import { CampaignFormFields, SectionLabel, useCampaignFormSubmit } from "./parts";

function formatSavedAt(iso?: string): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleString("sv-SE", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
}

export function NewCampaignSheet({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [available, setAvailable] = useState<StrategyRow[]>([]);
  const [picked, setPicked] = useState<StrategyRow | null>(null);
  const [form, setForm] = useState<CampaignForm>({ title: "", startsOn: "", endsOn: "" });
  const { errors, error, saving, run } = useCampaignFormSubmit((f) =>
    picked ? createCampaignFromStrategy(picked, f) : Promise.resolve({ ok: false as const, error: "Välj en strategi först." }),
  );

  useEffect(() => {
    let cancelled = false;
    listStrategiesForNewCampaign().then((res) => {
      if (cancelled) return;
      if (!res.ok) setLoadError(res.error);
      else setAvailable(strategiesAvailableForNewCampaign(res.data.strategies, res.data.usedStrategyIds));
      setLoading(false);
    });
    return () => { cancelled = true; };
  }, []);

  function pick(s: StrategyRow) {
    setPicked(s);
    setForm(prefillFromStrategy(s));
  }

  async function create() {
    const id = await run(form);
    if (id) router.push(`/campaigns/${id}`);
  }

  /* ── Läge 2: namn och datum för vald strategi ─────────── */
  if (picked) {
    const view = readStrategy(picked);
    return (
      <Sheet title="Ny kampanj" onClose={onClose} busy={saving}>
        <form noValidate className="flex flex-col gap-5" onSubmit={(e) => { e.preventDefault(); void create(); }}>
          <div className="rounded border border-border bg-surface-sunken px-4 py-3">
            <p className="text-xs text-text-tertiary">Strategi</p>
            <p className="mt-0.5 text-sm font-medium">{picked.title || "Namnlös strategi"}</p>
            {view.direction && <p className="mt-1 text-[13px] leading-relaxed text-text-secondary">{view.direction}</p>}
          </div>
          <CampaignFormFields form={form} setForm={setForm} errors={errors} disabled={saving} />
          {error && <Alert tone="danger" title="Det gick inte">{error}</Alert>}
          <div className="flex flex-col gap-2">
            <Button type="submit" loading={saving} className="w-full">Skapa planerad kampanj</Button>
            <Button type="button" variant="ghost" disabled={saving} className="w-full" onClick={() => setPicked(null)}>
              Välj en annan strategi
            </Button>
          </div>
        </form>
      </Sheet>
    );
  }

  /* ── Läge 1: välj strategi eller ta fram en ny ────────── */
  return (
    <Sheet title="Ny kampanj" onClose={onClose}>
      <SectionLabel className="mb-2.5">Utgå från en sparad strategi</SectionLabel>
      {loading ? (
        <div className="flex flex-col gap-2">
          <Skeleton className="h-16 w-full rounded" />
          <Skeleton className="h-16 w-full rounded" />
        </div>
      ) : loadError ? (
        <Alert tone="danger" title="Det gick inte">{loadError}</Alert>
      ) : available.length === 0 ? (
        <p className="text-sm leading-relaxed text-text-secondary">
          Du har ingen sparad strategi utan kampanj. Vill du köra en tidigare kampanj en gång till
          använder du Kör igen på den.
        </p>
      ) : (
        <>
          <ul className="flex flex-col gap-2">
            {available.map((s) => (
              <li key={s.id}>
                <button
                  type="button"
                  onClick={() => pick(s)}
                  className={cx(
                    "block min-h-11 w-full rounded border px-4 py-3 text-left transition-colors",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40",
                    selectableSurface,
                  )}
                >
                  <span className="block text-[15px] font-medium">{s.title || "Namnlös strategi"}</span>
                  <span className="mt-0.5 block text-[13px] text-text-tertiary">
                    Strategi från {formatSavedAt(s.created_at)} · ännu ingen kampanj
                  </span>
                </button>
              </li>
            ))}
          </ul>
          <p className="mt-2.5 text-[13px] text-text-tertiary">
            Välj en strategi, sätt datum och kampanjen blir planerad.
          </p>
        </>
      )}

      <div className="my-5 h-px bg-border" />
      <SectionLabel className="mb-2.5">Eller börja från början</SectionLabel>
      <ButtonLink href="/campaign-builder" variant="secondary" className="w-full">
        <IconBuilder size={16} />
        Ta fram en ny strategi
      </ButtonLink>
      <p className="mt-2 text-[13px] leading-relaxed text-text-tertiary">
        Samma frågor som i Kampanjbyggaren. När strategin är klar gör du den till en kampanj därifrån.
      </p>
    </Sheet>
  );
}

"use client";

// ─────────────────────────────────────────────────────────────
// "Gör till kampanj" från Kampanjbyggarens resultat. Tar det FAKTISKA
// sparade strategi-id:t, läser raden och skapar kampanjen med radens
// company_id — aldrig "senaste företaget". Namn och period förifylls
// bara där strategin har säkra värden; annars anger användaren dem.
// ─────────────────────────────────────────────────────────────
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Alert, Button, Skeleton } from "@/app/_shared/primitives";
import { prefillFromStrategy, type CampaignForm, type StrategyRow } from "@/lib/campaigns/logic";
import { createCampaignFromStrategy, getStrategy } from "@/lib/campaigns/store";
import { Sheet } from "./Sheet";
import { CampaignFormFields, useCampaignFormSubmit } from "./parts";

export function MakeCampaignSheet({ strategyId, onClose }: { strategyId: string; onClose: () => void }) {
  const router = useRouter();
  const [row, setRow] = useState<StrategyRow | null>(null);
  const [loadError, setLoadError] = useState("");
  const [form, setForm] = useState<CampaignForm>({ title: "", startsOn: "", endsOn: "" });
  const { errors, error, saving, run } = useCampaignFormSubmit((f) =>
    row ? createCampaignFromStrategy(row, f) : Promise.resolve({ ok: false as const, error: "Strategin är inte laddad." }),
  );

  useEffect(() => {
    let cancelled = false;
    getStrategy(strategyId).then((res) => {
      if (cancelled) return;
      if (!res.ok) { setLoadError(res.error); return; }
      if (!res.data) { setLoadError("Strategin hittades inte. Den kan inte bli en kampanj."); return; }
      if (!res.data.company_id) { setLoadError("Strategin saknar företag och kan inte bli en kampanj."); return; }
      setRow(res.data);
      setForm(prefillFromStrategy(res.data));
    });
    return () => { cancelled = true; };
  }, [strategyId]);

  async function create() {
    const id = await run(form);
    if (id) router.push(`/campaigns/${id}`);
  }

  return (
    <Sheet title="Gör till kampanj" onClose={onClose} busy={saving}>
      {loadError ? (
        <Alert tone="danger" title="Det gick inte">{loadError}</Alert>
      ) : !row ? (
        <div className="flex flex-col gap-3">
          <Skeleton className="h-11 w-full rounded" />
          <Skeleton className="h-11 w-full rounded" />
        </div>
      ) : (
        <form noValidate className="flex flex-col gap-5" onSubmit={(e) => { e.preventDefault(); void create(); }}>
          <p className="text-sm text-text-secondary">
            Kampanjen blir planerad och använder strategin du just tog fram. Du startar den när det är dags.
          </p>
          <CampaignFormFields form={form} setForm={setForm} errors={errors} disabled={saving} />
          {error && <Alert tone="danger" title="Det gick inte">{error}</Alert>}
          <Button type="submit" loading={saving} className="w-full">Skapa planerad kampanj</Button>
        </form>
      )}
    </Sheet>
  );
}

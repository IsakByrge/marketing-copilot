"use client";

// ─────────────────────────────────────────────────────────────
// "Gör till kampanj" från Kampanjbyggarens resultat. Tar det FAKTISKA
// sparade strategi-id:t, läser raden och skapar kampanjen med radens
// company_id — aldrig "senaste företaget". Namn och period förifylls
// bara där strategin har säkra värden; annars anger användaren dem.
//
// Arket skapar bara den FÖRSTA kampanjen på en strategi. Har strategin
// redan en kampanj visas ingen formulärruta, utan vägen till den
// kampanjen: nästa körning görs med Kör igen där.
//
// Det är inte kosmetik. Sedan Campaigns v1 betyder flera rader med
// samma strategy_id flera KÖRNINGAR av samma strategi, och jämförelsen
// på en avslutad kampanj läser dem som en historik. En andra kampanj
// skapad härifrån vore inte en körning utan en dubblett, och den skulle
// hamna i den historiken. NewCampaignSheet har alltid filtrerat bort
// använda strategier; den här vägen gjorde det inte.
// ─────────────────────────────────────────────────────────────
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Alert, Button, ButtonLink, Skeleton } from "@/app/_shared/primitives";
import { prefillFromStrategy, type CampaignForm, type StrategyRow } from "@/lib/campaigns/logic";
import { createCampaignFromStrategy, getCampaignIdForStrategy, getStrategy } from "@/lib/campaigns/store";
import { Sheet } from "./Sheet";
import { CampaignFormFields, useCampaignFormSubmit } from "./parts";

export function MakeCampaignSheet({ strategyId, onClose }: { strategyId: string; onClose: () => void }) {
  const router = useRouter();
  const [row, setRow] = useState<StrategyRow | null>(null);
  const [loadError, setLoadError] = useState("");
  /** Id:t på kampanjen som redan använder strategin. Null = fritt fram. */
  const [befintligId, setBefintligId] = useState<string | null>(null);
  const [form, setForm] = useState<CampaignForm>({ title: "", startsOn: "", endsOn: "" });
  const { errors, error, saving, run } = useCampaignFormSubmit((f) =>
    row ? createCampaignFromStrategy(row, f) : Promise.resolve({ ok: false as const, error: "Strategin är inte laddad." }),
  );

  useEffect(() => {
    let cancelled = false;
    // Strategin och kontrollen hämtas samtidigt: de är oberoende, och
    // arket ska inte visa formuläret ett ögonblick innan spärren hunnit
    // svara. Båda måste vara klara innan något ritas.
    Promise.all([getStrategy(strategyId), getCampaignIdForStrategy(strategyId)]).then(([strat, befintlig]) => {
      if (cancelled) return;
      if (!strat.ok) { setLoadError(strat.error); return; }
      if (!strat.data) { setLoadError("Strategin hittades inte. Den kan inte bli en kampanj."); return; }
      if (!strat.data.company_id) { setLoadError("Strategin saknar företag och kan inte bli en kampanj."); return; }
      // Går kontrollen inte igenom blockerar vi inte skapandet — men vi
      // säger inte heller att strategin är ledig. Felet visas, och
      // användaren kan försöka igen.
      if (!befintlig.ok) { setLoadError(befintlig.error); return; }
      setBefintligId(befintlig.data);
      setRow(strat.data);
      setForm(prefillFromStrategy(strat.data));
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
      ) : befintligId ? (
        /* Strategin är upptagen. Ingen formulärruta — bara vägen vidare. */
        <div className="flex flex-col gap-5">
          <Alert tone="info" title="Strategin används redan av en kampanj">
            Vill du köra den igen gör du det från kampanjen, med Kör igen. Då blir det
            en ny körning av samma strategi i stället för en till kampanj.
          </Alert>
          <div className="flex flex-col gap-2">
            <ButtonLink href={`/campaigns/${befintligId}`} className="w-full justify-center">
              Öppna kampanjen
            </ButtonLink>
            <Button type="button" variant="ghost" className="w-full" onClick={onClose}>
              Stäng
            </Button>
          </div>
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

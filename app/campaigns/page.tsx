"use client";

// ─────────────────────────────────────────────────────────────
// Kampanjer — riktiga kampanjer ur public.campaigns, grupperade
// Pågår / Planerade / Avslutade. Tomma grupper visas inte; saknas
// kampanjer helt visas ett ärligt tomläge.
//
// Veckoplanens kampanjförslag visas inte längre här. De är utkast i
// planen (se Innehåll), inte kampanjer någon kör.
//
// Kortets titel är öppna-handlingen och täcker hela kortet (stretched
// link). Kontextuella handlingar — Skapa inlägg, Kör igen — är riktiga
// knappar ovanpå länkytan.
// ─────────────────────────────────────────────────────────────
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import AppShell from "@/app/_shared/AppShell";
import { Alert, Button, ButtonLink, Card, EmptyState, Skeleton } from "@/app/_shared/primitives";
import { IconArrowRight, IconCampaigns, IconPlus, IconRerun } from "@/app/_shared/icons";
import {
  groupCampaigns, hasAnyResult, readStrategy, timingNote, todayIso,
  type Campaign,
} from "@/lib/campaigns/logic";
import { listCampaigns, rerunCampaign } from "@/lib/campaigns/store";
import { NewCampaignSheet } from "./_components/NewCampaignSheet";
import { ResultsLine, RerunSheet, SectionLabel, StatusLine } from "./_components/parts";

function CardTitle({ campaign, large }: { campaign: Campaign; large?: boolean }) {
  return (
    <Link
      href={`/campaigns/${campaign.id}`}
      className={
        "font-medium leading-snug text-text-primary hover:underline hover:underline-offset-4 " +
        "after:absolute after:inset-0 after:rounded-lg after:content-[''] " +
        "focus-visible:outline-none focus-visible:after:ring-2 focus-visible:after:ring-primary/40 " +
        (large ? "text-[19px]" : "text-[17px]")
      }
    >
      {campaign.title}
    </Link>
  );
}

function ActiveCard({ c, today }: { c: Campaign; today: string }) {
  const view = readStrategy(c.strategy);
  return (
    <Card className="relative p-4 sm:p-6">
      <StatusLine campaign={c} today={today} note={timingNote(c, today)} />
      <h3 className="mt-2.5"><CardTitle campaign={c} large /></h3>
      {view.direction && <p className="mt-1.5 text-sm leading-relaxed text-text-secondary">{view.direction}</p>}
      <div className="my-4 h-px bg-border" />
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="flex gap-2.5 text-sm leading-relaxed">
          <IconArrowRight size={16} className="mt-0.5 shrink-0 text-primary" />
          Nästa steg: skapa ett Facebook-inlägg från kampanjens strategi.
        </p>
        <ButtonLink href={`/content/facebook?strategy=${encodeURIComponent(c.strategy_id)}`} size="sm" className="relative z-10 w-full sm:w-auto">
          Skapa inlägg
        </ButtonLink>
      </div>
      {hasAnyResult(c) && (
        <div className="mt-3 flex flex-wrap items-baseline gap-x-1.5 text-[13px]">
          <span className="text-text-tertiary">Inlagt hittills:</span>
          <ResultsLine r={c} className="text-[13px]" />
        </div>
      )}
    </Card>
  );
}

function PlannedCard({ c, today }: { c: Campaign; today: string }) {
  const view = readStrategy(c.strategy);
  return (
    <Card padding="sm" className="relative">
      <StatusLine campaign={c} today={today} note={timingNote(c, today)} />
      <h3 className="mt-2"><CardTitle campaign={c} /></h3>
      {view.direction && <p className="mt-1 line-clamp-2 text-sm leading-relaxed text-text-secondary">{view.direction}</p>}
    </Card>
  );
}

function EndedCard({ c, today, onRerun }: { c: Campaign; today: string; onRerun: () => void }) {
  const results = hasAnyResult(c);
  return (
    <Card padding="sm" className="relative">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-6">
        <div className="min-w-0">
          <StatusLine campaign={c} today={today} />
          <h3 className="mt-2"><CardTitle campaign={c} /></h3>
          {results ? (
            <ResultsLine r={c} className="mt-2" />
          ) : (
            <p className="mt-2 text-[13px] text-text-tertiary">Inga resultat inlagda.</p>
          )}
          {c.learning && (
            <p className="mt-1.5 line-clamp-2 text-sm leading-relaxed text-text-secondary">
              <span className="font-medium text-text-primary">Lärdom:</span> {c.learning}
            </p>
          )}
        </div>
        <Button variant="secondary" size="sm" onClick={onRerun} className="relative z-10 w-full shrink-0 sm:w-auto">
          <IconRerun size={15} />
          Kör igen
        </Button>
      </div>
    </Card>
  );
}

export default function CampaignsPage() {
  const router = useRouter();
  const [campaigns, setCampaigns] = useState<Campaign[] | null>(null);
  const [error, setError] = useState("");
  const [newOpen, setNewOpen] = useState(false);
  const [rerunOf, setRerunOf] = useState<Campaign | null>(null);
  const today = todayIso();

  const load = useCallback(async () => {
    setError("");
    const res = await listCampaigns();
    if (res.ok) setCampaigns(res.data);
    else { setError(res.error); setCampaigns((prev) => prev ?? []); }
  }, []);

  useEffect(() => {
    let cancelled = false;
    listCampaigns().then((res) => {
      if (cancelled) return;
      if (res.ok) setCampaigns(res.data);
      else { setError(res.error); setCampaigns([]); }
    });
    return () => { cancelled = true; };
  }, []);

  const groups = campaigns ? groupCampaigns(campaigns) : null;

  return (
    <AppShell>
      <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-10 lg:py-12">
        <header className="mb-8 sm:flex sm:items-start sm:justify-between sm:gap-6">
          <div>
            <h1 className="text-[clamp(1.5rem,3.2vw,1.85rem)] font-semibold leading-[1.25] tracking-tight">
              Kampanjer
            </h1>
            <p className="mt-2 max-w-xl text-[15px] leading-relaxed text-text-secondary">
              Det du kör, det du har planerat och det du har lärt dig.
            </p>
          </div>
          <Button onClick={() => setNewOpen(true)} className="mt-4 w-full shrink-0 sm:mt-1 sm:w-auto">
            <IconPlus size={16} />
            Ny kampanj
          </Button>
        </header>

        {error && (
          <Alert tone="danger" title="Det gick inte" className="mb-6">
            {error}{" "}
            <button type="button" onClick={() => void load()} className="inline-flex min-h-11 items-center font-medium text-text-primary underline underline-offset-4 sm:min-h-0">
              Försök igen
            </button>
          </Alert>
        )}

        {!groups ? (
          <div className="flex flex-col gap-3">
            <Skeleton className="h-40 w-full rounded-lg" />
            <Skeleton className="h-24 w-full rounded-lg" />
          </div>
        ) : campaigns!.length === 0 ? (
          !error && (
            <EmptyState
              icon={<IconCampaigns size={19} />}
              title="Du har inga kampanjer ännu."
              body="En kampanj är en strategi som du kör under en bestämd period. Börja med Ny kampanj — från en sparad strategi eller en ny."
            />
          )
        ) : (
          <div className="flex flex-col gap-10">
            {groups.active.length > 0 && (
              <section>
                <SectionLabel className="mb-3">Pågår</SectionLabel>
                <div className="flex flex-col gap-3">
                  {groups.active.map((c) => <ActiveCard key={c.id} c={c} today={today} />)}
                </div>
              </section>
            )}
            {groups.planned.length > 0 && (
              <section>
                <SectionLabel className="mb-3">{groups.planned.length === 1 ? "Planerad" : "Planerade"}</SectionLabel>
                <div className="flex flex-col gap-3">
                  {groups.planned.map((c) => <PlannedCard key={c.id} c={c} today={today} />)}
                </div>
              </section>
            )}
            {groups.ended.length > 0 && (
              <section>
                <SectionLabel className="mb-3">Avslutade</SectionLabel>
                <div className="flex flex-col gap-3">
                  {groups.ended.map((c) => (
                    <EndedCard key={c.id} c={c} today={today} onRerun={() => setRerunOf(c)} />
                  ))}
                </div>
              </section>
            )}
          </div>
        )}
      </div>

      {newOpen && <NewCampaignSheet onClose={() => setNewOpen(false)} />}
      {rerunOf && (
        <RerunSheet
          campaign={rerunOf}
          today={today}
          onClose={() => setRerunOf(null)}
          onCreate={async (f) => {
            const res = await rerunCampaign(rerunOf, f);
            if (res.ok) router.push(`/campaigns/${res.data}`);
            return res;
          }}
        />
      )}
    </AppShell>
  );
}

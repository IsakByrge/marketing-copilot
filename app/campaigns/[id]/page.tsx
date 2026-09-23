"use client";

// ─────────────────────────────────────────────────────────────
// En kampanj. Inga flikar — statusen styr ordningen på sidan:
//
//   Planerad:  riktning → Starta kampanjen → Facebook
//   Pågår:     riktning → Skapa Facebook-inlägg → resultat → Avsluta
//   Avslutad:  lärdom → resultat → Kör igen → notering → strategin
//
// RLS skyddar raden; sidan filtrerar ändå på användaren och visar
// ett ärligt "finns inte" när raden inte kommer tillbaka. Ingen
// ändring visas som lyckad förrän Supabase har bekräftat den.
// ─────────────────────────────────────────────────────────────
import { use, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import AppShell from "@/app/_shared/AppShell";
import { Alert, Button, ButtonLink, Card, EmptyState, Skeleton } from "@/app/_shared/primitives";
import { IconCampaigns, IconRerun, IconSparkle } from "@/app/_shared/icons";
import { hasAnyResult, timingNote, todayIso, type Campaign } from "@/lib/campaigns/logic";
import {
  endCampaign, getCampaign, rerunCampaign, startCampaign, updateCampaignResults, updateLearning,
} from "@/lib/campaigns/store";
import {
  LearningSheet, RerunSheet, ResultFigures, ResultsLine, ResultsSheet, SectionLabel, StatusLine, StrategyBlock,
} from "../_components/parts";

type SheetKind = "results" | "end" | "learning" | "rerun" | null;

function BackLink() {
  return (
    <Link
      href="/campaigns"
      className="-ml-1 inline-flex min-h-11 items-center gap-1.5 rounded px-1 text-sm text-text-secondary hover:text-text-primary sm:min-h-0 sm:py-1"
    >
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <path d="M15 5 8 12l7 7" />
      </svg>
      Kampanjer
    </Link>
  );
}

function facebookHref(c: Campaign) {
  return `/content/facebook?strategy=${encodeURIComponent(c.strategy_id)}`;
}

export default function CampaignDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const [campaign, setCampaign] = useState<Campaign | null>(null);
  const [state, setState] = useState<"loading" | "ready" | "missing" | "error">("loading");
  const [loadError, setLoadError] = useState("");
  const [sheet, setSheet] = useState<SheetKind>(null);
  const [starting, setStarting] = useState(false);
  const [actionError, setActionError] = useState("");
  const today = todayIso();

  useEffect(() => {
    let cancelled = false;
    getCampaign(id).then((res) => {
      if (cancelled) return;
      if (!res.ok) { setLoadError(res.error); setState("error"); return; }
      if (!res.data) { setState("missing"); return; }
      setCampaign(res.data);
      setState("ready");
    });
    return () => { cancelled = true; };
  }, [id]);

  async function start(c: Campaign) {
    if (starting) return;
    setActionError("");
    setStarting(true);
    const res = await startCampaign(c);
    setStarting(false);
    if (res.ok) setCampaign(res.data);
    else setActionError(res.error);
  }

  /* ── Laddning, fel, finns inte ─────────────────────────── */
  if (state !== "ready" || !campaign) {
    return (
      <AppShell>
        <div className="mx-auto max-w-2xl px-4 py-6 sm:px-6 lg:py-12">
          <BackLink />
          <div className="mt-5">
            {state === "loading" && (
              <div className="flex flex-col gap-3">
                <Skeleton className="h-6 w-40" />
                <Skeleton className="h-9 w-3/4" />
                <Skeleton className="mt-3 h-36 w-full rounded-lg" />
              </div>
            )}
            {state === "error" && (
              <Alert tone="danger" title="Det gick inte">
                {loadError}{" "}
                <button type="button" onClick={() => window.location.reload()} className="inline-flex min-h-11 items-center font-medium text-text-primary underline underline-offset-4 sm:min-h-0">
                  Ladda om
                </button>
              </Alert>
            )}
            {state === "missing" && (
              <EmptyState
                icon={<IconCampaigns size={19} />}
                title="Kampanjen finns inte."
                body="Den kan ha tagits bort, eller så hör länken till ett annat konto."
                action={<ButtonLink href="/campaigns" variant="secondary">Till Kampanjer</ButtonLink>}
              />
            )}
          </div>
        </div>
      </AppShell>
    );
  }

  const c = campaign;
  const results = hasAnyResult(c);

  return (
    <AppShell>
      <div className="mx-auto max-w-2xl px-4 py-6 sm:px-6 lg:py-12">
        <BackLink />
        <div className="mt-4">
          <StatusLine campaign={c} today={today} note={timingNote(c, today)} />
          <h1 className="mt-2.5 text-[clamp(1.5rem,3.2vw,1.85rem)] font-semibold leading-[1.25] tracking-tight">
            {c.title}
          </h1>
        </div>

        {actionError && <Alert tone="danger" title="Det gick inte" className="mt-5">{actionError}</Alert>}

        {/* ── Planerad ───────────────────────────────────── */}
        {c.status === "planned" && (
          <div className="mt-6 flex flex-col gap-4">
            <StrategyBlock campaign={c} />
            <div>
              <Button onClick={() => void start(c)} loading={starting} className="w-full sm:w-auto">
                Starta kampanjen
              </Button>
              <p className="mt-2 text-[13px] text-text-tertiary">
                Status ändras bara när du väljer det, inte automatiskt på datum.
              </p>
            </div>
            <div>
              <ButtonLink href={facebookHref(c)} variant="secondary" className="w-full sm:w-auto">
                <IconSparkle size={16} />
                Förbered ett Facebook-inlägg
              </ButtonLink>
              <p className="mt-2 text-[13px] text-text-tertiary">
                Facebook-formuläret fylls i från kampanjens strategi.
              </p>
            </div>
          </div>
        )}

        {/* ── Pågår ──────────────────────────────────────── */}
        {c.status === "active" && (
          <div className="mt-6 flex flex-col">
            <StrategyBlock campaign={c} />
            <ButtonLink href={facebookHref(c)} className="mt-4 w-full sm:w-auto sm:self-start">
              <IconSparkle size={16} />
              Skapa Facebook-inlägg
            </ButtonLink>
            <p className="mt-2 text-[13px] text-text-tertiary">
              Facebook-formuläret fylls i från kampanjens strategi.
            </p>

            <section className="mt-8">
              <SectionLabel className="mb-3">{results ? "Resultat hittills" : "Resultat"}</SectionLabel>
              <Card padding="sm">
                {results ? (
                  <>
                    <ResultsLine r={c} className="text-base" />
                    {c.result_note && <p className="mt-2 text-[13px] leading-relaxed text-text-secondary">{c.result_note}</p>}
                  </>
                ) : (
                  <p className="text-sm text-text-secondary">Inga resultat inlagda ännu.</p>
                )}
                <Button variant="secondary" onClick={() => setSheet("results")} className="mt-3 w-full sm:w-auto">
                  {results ? "Uppdatera resultat" : "Lägg in resultat"}
                </Button>
              </Card>
            </section>

            <div className="mt-8 border-t border-border pt-4 sm:flex sm:items-center sm:gap-3">
              <Button variant="ghost" onClick={() => setSheet("end")} className="w-full sm:w-auto">
                Avsluta kampanjen
              </Button>
              <p className="mt-1 text-center text-xs text-text-tertiary sm:mt-0 sm:text-left">
                Då skriver du en lärdom och kan köra den igen.
              </p>
            </div>
          </div>
        )}

        {/* ── Avslutad ───────────────────────────────────── */}
        {c.status === "ended" && (
          <div className="mt-6 flex flex-col">
            <Card padding="sm" className="border-primary/20 bg-primary/5">
              <div className="flex items-center justify-between gap-3">
                <SectionLabel>Lärdom</SectionLabel>
                <button
                  type="button"
                  onClick={() => setSheet("learning")}
                  className="-my-2 inline-flex min-h-11 items-center px-1 text-[13px] font-medium text-primary underline underline-offset-4 sm:min-h-0"
                >
                  {c.learning ? "Ändra" : "Skriv lärdom"}
                </button>
              </div>
              {c.learning ? (
                <p className="mt-2 whitespace-pre-line text-base leading-relaxed">{c.learning}</p>
              ) : (
                <p className="mt-2 text-sm text-text-secondary">Ingen lärdom sparad.</p>
              )}
            </Card>

            <section className="mt-8">
              <div className="mb-3 flex items-center justify-between gap-3">
                <SectionLabel>Resultat</SectionLabel>
                {results && (
                  <button
                    type="button"
                    onClick={() => setSheet("results")}
                    className="-my-2 inline-flex min-h-11 items-center px-1 text-[13px] font-medium text-primary underline underline-offset-4 sm:min-h-0"
                  >
                    Ändra
                  </button>
                )}
              </div>
              {results ? (
                <ResultFigures r={c} />
              ) : (
                <Card padding="sm">
                  <p className="text-sm text-text-secondary">Inga resultat inlagda.</p>
                  <Button variant="secondary" onClick={() => setSheet("results")} className="mt-3 w-full sm:w-auto">
                    Lägg in resultat
                  </Button>
                </Card>
              )}
            </section>

            <Button onClick={() => setSheet("rerun")} className="mt-6 w-full sm:w-auto sm:self-start">
              <IconRerun size={16} />
              Kör igen
            </Button>
            <p className="mt-2 text-[13px] text-text-tertiary">
              Samma strategi, nya datum.{c.learning ? " Lärdomen följer med som referens." : ""}
            </p>

            {c.result_note && (
              <section className="mt-8">
                <SectionLabel className="mb-2">Notering</SectionLabel>
                <p className="whitespace-pre-line text-sm leading-relaxed text-text-secondary">{c.result_note}</p>
              </section>
            )}

            <section className="mt-8">
              <SectionLabel className="mb-2">Strategin</SectionLabel>
              <StrategyBlock campaign={c} tone="quiet" />
            </section>
          </div>
        )}
      </div>

      {sheet === "results" && (
        <ResultsSheet
          campaign={c}
          onClose={() => setSheet(null)}
          onSave={async (r) => {
            const res = await updateCampaignResults(c.id, r);
            if (res.ok) setCampaign(res.data);
            return res;
          }}
        />
      )}
      {(sheet === "end" || sheet === "learning") && (
        <LearningSheet
          mode={sheet === "end" ? "end" : "edit"}
          initial={c.learning ?? ""}
          onClose={() => setSheet(null)}
          onSave={async (text) => {
            const res = sheet === "end" ? await endCampaign(c, text) : await updateLearning(c, text);
            if (res.ok) setCampaign(res.data);
            return res;
          }}
        />
      )}
      {sheet === "rerun" && (
        <RerunSheet
          campaign={c}
          today={today}
          onClose={() => setSheet(null)}
          onCreate={async (f) => {
            const res = await rerunCampaign(c, f);
            if (res.ok) {
              setSheet(null);
              router.push(`/campaigns/${res.data}`);
            }
            return res;
          }}
        />
      )}
    </AppShell>
  );
}

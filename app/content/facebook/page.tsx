"use client";

// ─────────────────────────────────────────────────────────────
// Content Engine 1.0 — Facebook Specialist (vy)
// En fokuserad specialistupplevelse ovanpå det delade mörka
// designsystemet (Shell + theme + ui). Före: fokuserade val +
// "Redan känt" ur Company Brain. Under: ärlig, strömmad process-
// indikator (steg markeras klart först när servern är klar).
// Efter: rekommenderad vinkel, FB-lik preview, två alternativ,
// bildbrief, kvalitetsstatus, antaganden/luckor och riktiga actions.
// ─────────────────────────────────────────────────────────────
import { useEffect, useMemo, useRef, useState } from "react";
import { createClient } from "@/lib/supabase-browser";
import AppShell from "@/app/_shared/AppShell";
// themeLight ar kvar ENBART for FacebookPreview nedan. Den harmar
// Facebooks eget utseende med flit - det ar hela poangen med en
// forhandsvisning - och ska darfor inte folja vart designsystem.
import { T, fontSans } from "@/app/_shared/themeLight";
import {
  Alert, Button, ButtonLink, Card, Chip as StatusChip, EmptyState, Input,
  Spinner, ToggleChip, cx, selectedSurface, selectableSurface,
} from "@/app/_shared/primitives";
import { Textarea } from "@/app/_shared/Textarea";
import { IconContent, IconSparkle, IconCheck, IconX } from "@/app/_shared/icons";
import ImageMaker from "@/app/_shared/ImageMaker";
import { briefToSubject } from "@/lib/server/imagePrompt";
import { useCompanyBrain } from "@/app/_shared/useCompanyBrain";
import { tillgangligaOrter } from "@/app/_shared/locations";
import {
  GOAL_OPTIONS, ANGLE_OPTIONS, LENGTH_OPTIONS, TONE_SUGGESTIONS,
  type FacebookBrief, type FacebookContentGoal, type FacebookAngle, type FacebookLength,
  type FacebookSpecialistResult, type FacebookPostVariant, type FacebookQualityChecks,
  type FacebookUserStatus, type FacebookImageBrief,
} from "./types";
import { mapStrategyToPrefill, type StrategyContextForForm } from "@/lib/facebook/strategyPrefill";

/* ── Strömmande generering (NDJSON) ──────────────────────── */
type Phase = "reading" | "drafting" | "reviewing" | "revising" | "done";
type StreamHandlers = {
  onPhase: (p: Phase) => void;
  onResult: (r: FacebookSpecialistResult) => void;
  onBlocked: (q: string, missing: string[]) => void;
  onError: (msg: string) => void;
};

async function streamGenerate(brief: FacebookBrief, h: StreamHandlers, signal: AbortSignal) {
  const res = await fetch("/api/content/facebook", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(brief),
    signal,
  });
  if (!res.ok || !res.body) {
    let msg = "Det gick inte att skapa inlägget just nu.";
    try { const j = await res.json(); if (j?.error) msg = j.error; } catch {}
    h.onError(msg);
    return;
  }
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buf = "";
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += decoder.decode(value, { stream: true });
    let nl;
    while ((nl = buf.indexOf("\n")) >= 0) {
      const raw = buf.slice(0, nl).trim();
      buf = buf.slice(nl + 1);
      if (!raw) continue;
      let msg: Record<string, unknown>;
      try { msg = JSON.parse(raw); } catch { continue; }
      if (msg.type === "phase") h.onPhase(msg.phase as Phase);
      else if (msg.type === "result") h.onResult(msg.result as FacebookSpecialistResult);
      else if (msg.type === "blocked") h.onBlocked(String(msg.question ?? ""), (msg.missingInformation as string[]) ?? []);
      else if (msg.type === "error") h.onError(String(msg.error ?? "Något gick fel."));
    }
  }
}

/* ── Små, sid-lokala byggstenar ──────────────────────────── */

/** Sidhuvud. Samma rytm som Idag, Innehåll, Historik och Kampanjstrategi. */
function PageHeader({ eyebrow, title, subtitle }: { eyebrow: string; title: string; subtitle?: string }) {
  return (
    <header className="mb-8">
      <p className="text-xs font-semibold uppercase tracking-[0.12em] text-text-tertiary">{eyebrow}</p>
      <h1 className="mt-3 text-[clamp(1.5rem,3.2vw,1.85rem)] font-semibold leading-[1.25] tracking-tight">{title}</h1>
      {subtitle && <p className="mt-3 max-w-xl text-[15px] leading-relaxed text-text-secondary">{subtitle}</p>}
    </header>
  );
}

/** Sektionsetikett. Versaler är kvar med flit — samma mönster som övriga sidor. */
function SectionLabel({ children }: { children: React.ReactNode }) {
  return <p className="text-xs font-semibold uppercase tracking-[0.12em] text-text-tertiary">{children}</p>;
}

/** Etiketterat fält. Gemener och halvfet, som resten av appen. */
function Field({ label, hint, optional, children }: {
  label: string; hint?: string; optional?: boolean; children: React.ReactNode;
}) {
  return (
    <div>
      <p className="mb-2 flex items-baseline gap-2 font-sans text-sm font-medium text-text-primary">
        {label}
        {optional && <span className="font-normal text-text-tertiary">— valfritt</span>}
      </p>
      {hint && <p className="mb-2.5 text-xs leading-relaxed text-text-tertiary">{hint}</p>}
      {children}
    </div>
  );
}

/** Kopiera-knapp med kvittering. Samma beteende som förut. */
function CopyButton({ getText, variant = "primary", label = "Kopiera" }: {
  getText: () => string; variant?: "primary" | "secondary"; label?: string;
}) {
  const [copied, setCopied] = useState(false);
  function copy() {
    navigator.clipboard.writeText(getText());
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }
  return (
    <Button variant={variant} onClick={copy}>{copied ? "✓ Kopierat" : label}</Button>
  );
}

/**
 * Arbetsindikator med riktiga steg.
 *
 * Stegen kommer från strömmen, inte från en timer — de rör sig när
 * servern faktiskt byter fas. Därför får den visa progress, till
 * skillnad från Kampanjstrategins panel som medvetet inte gör det.
 */
function LoadingPanel({ title, steps, activeStep }: { title: string; steps: string[]; activeStep: number }) {
  return (
    <div className="fade-up max-w-md">
      <div className="mb-5 flex items-center gap-2.5">
        {/* pulseDot ligger i globals.css och neutraliseras av
            prefers-reduced-motion-blocket dar. */}
        <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-primary" style={{ animation: "pulseDot 1.4s ease infinite" }} />
        <span className="text-xs font-semibold uppercase tracking-[0.12em] text-primary">{title}</span>
      </div>
      <ol className="flex flex-col gap-1">
        {steps.map((s, i) => {
          const done = i < activeStep;
          const active = i === activeStep;
          return (
            <li
              key={i}
              aria-current={active ? "step" : undefined}
              className={cx(
                "flex items-center gap-3 rounded-lg border px-3.5 py-2.5 transition-colors",
                active ? "border-primary/30 bg-primary/10" : "border-transparent",
                !done && !active && "opacity-40",
              )}
            >
              <span
                aria-hidden
                className={cx(
                  "flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-full border text-[10px] text-primary",
                  done ? "border-primary/30 bg-primary/10" : active ? "border-primary/30" : "border-border-strong",
                )}
              >
                {done ? "✓" : active ? <Spinner className="h-2 w-2 border" /> : null}
              </span>
              <span className={cx("text-sm", done || active ? "text-text-secondary" : "text-text-tertiary")}>{s}</span>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

function Segmented<V extends string>({ value, onChange, options }: {
  value: V; onChange: (v: V) => void; options: { value: V; label: string }[];
}) {
  return (
    <div className="inline-flex flex-wrap gap-1 rounded-lg border border-border-strong bg-surface-sunken p-1">
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            onClick={() => onChange(o.value)}
            aria-pressed={active}
            className={cx(
              "inline-flex min-h-11 cursor-pointer items-center justify-center rounded border px-3.5 py-2 text-sm transition-colors",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40",
              active
                ? cx(selectedSurface, "font-medium text-text-primary")
                : "border-transparent text-text-tertiary hover:text-text-primary",
            )}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

/** Behåller namnet Chip — anropsställena är många och oförändrade.
 *  Bygger nu på ToggleChip, samma val-kontroll som Kampanjstrategin. */
function Chip({ label, active, onClick }: { label: string; active?: boolean; onClick?: () => void }) {
  return <ToggleChip active={active} onClick={onClick}>{label}</ToggleChip>;
}

function KnownChips({ label, items }: { label: string; items: string[] }) {
  if (!items.length) return null;
  return (
    <div className="mb-2.5">
      <p className="mb-1.5 text-xs text-text-tertiary">{label}</p>
      <div className="flex flex-wrap gap-1.5">
        {items.map((it, i) => <StatusChip key={i}>{it}</StatusChip>)}
      </div>
    </div>
  );
}

/* ── Sidan ───────────────────────────────────────────────── */
type Phase4 = "input" | "generating" | "result";

export default function FacebookSpecialistPage() {
  const { brain, loaded, hasCompany, companyName, companyId } = useCompanyBrain();

  // Val
  const [goal, setGoal] = useState<FacebookContentGoal>("sell");
  const [underlag, setUnderlag] = useState<"strategy" | "product" | "other">("other");
  const [productId, setProductId] = useState<string>("");
  const [strategyId, setStrategyId] = useState<string>("");
  const [strategies, setStrategies] = useState<{ id: string; title: string; goal: string; context: StrategyContextForForm | null }[]>([]);
  // Diskret märkning: vilka fält som förifylldes från den valda strategin.
  const [prefilledFields, setPrefilledFields] = useState<string[]>([]);
  // Fel när en ?strategy=-länk inte kunde öppnas (borttagen/annat konto/ogiltig).
  const [strategyLinkError, setStrategyLinkError] = useState("");
  // Sant om användaren rört formuläret sedan senaste (om)fyllning — styr varning vid strategibyte.
  const formTouchedRef = useRef(false);
  const touch = () => { formTouchedRef.current = true; };

  // Brief-fält (per-inlägg, skriver aldrig över Company Brain)
  const [productOrTopic, setProductOrTopic] = useState("");
  const [audience, setAudience] = useState("");
  const [offer, setOffer] = useState("");
  const [price, setPrice] = useState("");
  const [deadline, setDeadline] = useState("");
  const [geo, setGeo] = useState("");
  const [desiredAction, setDesiredAction] = useState("");
  const [angle, setAngle] = useState<FacebookAngle>("specialist_recommendation");
  const [tone, setTone] = useState("");
  const [length, setLength] = useState<FacebookLength>("normal");
  const [notes, setNotes] = useState("");

  // Flöde
  const [phase, setPhase] = useState<Phase4>("input");
  const [activeStep, setActiveStep] = useState(0);
  const [sawRevising, setSawRevising] = useState(false);
  const [result, setResult] = useState<FacebookSpecialistResult | null>(null);
  const [error, setError] = useState("");
  const [followUp, setFollowUp] = useState<{ question: string; missing: string[] } | null>(null);

  const selectedProduct = useMemo(() => brain.products.find((p) => p.id === productId) ?? null, [brain.products, productId]);
  const toneDefault = brain.tone.join(", ");

  // Platshallarna var hardkodade bilverkstadsexempel - "Vinterservice med
  // rekonditionering och lackskydd", "15% pa forsta besoket", "fran 1 495
  // kr", "Vasteras med omnejd". For ett bemanningsforetag gissar de fel
  // bransch, och en platshallare som gissar fel ar samre an ingen alls.
  // Harled dem ur foretagsdatan nar den racker till, annars
  // branschneutralt. Ingen paahittad data: bara det anvandaren skrivit in.
  // Priset far medvetet INGEN sifferexempel - en paahittad prisnivaa ar
  // precis den sortens gissning vi inte ska visa.
  const platshallare = useMemo(() => {
    const orter = tillgangligaOrter(brain.locations, brain.companySummary);
    return {
      amne: brain.products[0]?.name
        ? `t.ex. ${brain.products[0].name}`
        : "t.ex. produkten eller tjänsten inlägget handlar om",
      malgrupp: brain.primaryCustomers[0]
        ? `t.ex. ${brain.primaryCustomers[0]}`
        : "t.ex. de kunder du helst vill nå",
      ort: orter[0] ? `t.ex. ${orter[0]} med omnejd` : "t.ex. orten ni finns på, med omnejd",
      cta: brain.preferredCallsToAction[0]
        ? `t.ex. ${brain.preferredCallsToAction[0]}`
        : "t.ex. vad läsaren ska göra efter att ha läst",
    };
  }, [brain.products, brain.primaryCustomers, brain.locations, brain.companySummary, brain.preferredCallsToAction]);

  // Skriver in strategins värden i formulärets arbetskopia. Rör BARA de fält
  // som kan härledas ur strategin; CTA/vinkel/ton/längd lämnas orörda (ingen källa).
  // Anropas från event-handlern och den asynkrona laddningen — aldrig synkront
  // i en effekt-kropp (skulle bryta mot react-hooks/set-state-in-effect).
  function applyStrategyPrefill(ctx: StrategyContextForForm | null) {
    const p = mapStrategyToPrefill(ctx);
    if (p.goal !== undefined) setGoal(p.goal);
    setProductOrTopic(p.productOrTopic ?? "");
    setAudience(p.audience ?? "");
    setOffer(p.offer ?? "");
    setPrice(p.price ?? "");
    setDeadline(p.deadline ?? "");
    setGeo(p.geographicArea ?? "");
    setDesiredAction(p.desiredAction ?? "");
    setPrefilledFields(p.filledFields);
    formTouchedRef.current = false;
  }

  // Ladda sparade kampanjstrategier (RLS). Saknas tabellen ännu → tyst tomt.
  // strategy_context läses med (RLS-skyddat) så formuläret kan förifyllas.
  // Direktnavigering från Campaign Builder (/content/facebook?strategy=<id>)
  // hanteras här: när strategin finns i användarens lista förväljs och förifylls
  // den direkt (setState sker i en async-callback, inte synkront i effektkroppen).
  // Direktlänk från Innehåll: /content/facebook?amne=<text> förifyller
  // ämnesfältet så ett grovt veckoplansutkast kan tas vidare till den
  // riktiga motorn utan att skrivas in på nytt.
  useEffect(() => {
    const topic = new URLSearchParams(window.location.search).get("amne");
    if (!topic) return;
    // Sätts utanför den synkrona effektkroppen — samma skäl som i
    // strategi-effekten nedan: undviker kaskad-render. useSearchParams
    // vore alternativet, men den här sidan förrenderas statiskt och
    // skulle då behöva en Suspense-gräns runt hela klientträdet.
    queueMicrotask(() => setProductOrTopic(topic.slice(0, 500)));
  }, []);

  useEffect(() => {
    const wanted = new URLSearchParams(window.location.search).get("strategy");
    (async () => {
      try {
        const sb = createClient();
        const { data: { user } } = await sb.auth.getUser();
        if (!user) return;
        const { data } = await sb
          .from("campaign_strategies")
          .select("id,title,goal,strategy_context")
          .eq("user_id", user.id)
          .order("created_at", { ascending: false })
          .limit(20);
        if (!data) {
          if (wanted) setStrategyLinkError("Kunde inte öppna kampanjstrategin från länken. Välj en strategi manuellt nedan.");
          return;
        }
        const list = data.map((r) => ({
          id: r.id as string, title: r.title as string, goal: r.goal as string,
          context: (r.strategy_context && typeof r.strategy_context === "object"
            ? r.strategy_context as StrategyContextForForm : null),
        }));
        setStrategies(list);
        if (!wanted) return;
        const match = list.find((s) => s.id === wanted);
        if (match) {
          setUnderlag("strategy"); setStrategyId(match.id); applyStrategyPrefill(match.context);
        } else {
          // Id saknas i användarens lista: borttagen, annat konto eller ogiltigt id.
          // Krascha inte — visa ett begripligt meddelande och fall tillbaka till manuellt val.
          setStrategyLinkError("Vi hittade inte kampanjstrategin från länken — den kan ha tagits bort eller tillhöra ett annat konto. Välj en strategi manuellt nedan.");
          if (list.length) setUnderlag("strategy");
        }
      } catch {
        // Tabellen kanske inte migrerad ännu, eller nätverksfel.
        if (wanted) setStrategyLinkError("Kunde inte öppna kampanjstrategin från länken just nu. Välj en strategi manuellt nedan.");
      }
    })();
  }, []);

  // Klick på en strategi. Varnar innan osparade manuella ändringar ersätts och
  // förifyller EN gång i event-handlern (strategierna är laddade när listan syns).
  function handleSelectStrategy(id: string) {
    if (id === strategyId) return;
    if (formTouchedRef.current &&
        !window.confirm("Du har egna ändringar i formuläret. Vill du ersätta dem med värden från den valda kampanjstrategin?")) {
      return;
    }
    const strat = strategies.find((s) => s.id === id);
    setStrategyId(id);
    applyStrategyPrefill(strat ? strat.context : null);
    setStrategyLinkError(""); // manuellt val löser ett ev. länkfel
  }

  // Förifyll brief-fält när användaren VÄLJER en produkt (redigerbart, per
  // inlägg). Sker i klick-handlern, inte i en effekt — och skriver bara i
  // tomma fält, så manuella ändringar aldrig skrivs över.
  function pickProduct(p: (typeof brain.products)[number]) {
    touch();
    setProductId(p.id);
    setProductOrTopic((prev) => prev || [p.name, p.description].filter(Boolean).join(" — "));
    setAudience((prev) => prev || p.primaryAudience || brain.primaryCustomers[0] || "");
  }

  function buildBrief(overrides: Partial<FacebookBrief> = {}): FacebookBrief {
    return {
      goal,
      productOrTopic: productOrTopic.trim(),
      audience: audience.trim(),
      offer: offer.trim() || undefined,
      price: price.trim() || undefined,
      deadline: deadline.trim() || undefined,
      geographicArea: geo.trim() || undefined,
      desiredAction: desiredAction.trim(),
      requestedAngle: angle,
      toneOverride: tone.trim() || undefined,
      length,
      additionalNotes: notes.trim() || undefined,
      productId: underlag === "product" && productId ? productId : undefined,
      campaignStrategyId: underlag === "strategy" && strategyId ? strategyId : undefined,
      ...overrides,
    };
  }

  // Skyddar mot dubbla genereringsanrop (t.ex. snabb dubbelklick innan
  // React hunnit byta fas). Ref:en är synkron, till skillnad från state.
  const runningRef = useRef(false);

  async function run(brief: FacebookBrief) {
    if (runningRef.current) return;
    runningRef.current = true;
    setPhase("generating");
    setActiveStep(0);
    setSawRevising(false);
    setError("");
    setFollowUp(null);
    const controller = new AbortController();
    try {
      await streamGenerate(brief, {
        onPhase: (p) => {
          if (p === "reading") setActiveStep(0);
          else if (p === "drafting") setActiveStep(1);
          else if (p === "reviewing") setActiveStep(2);
          else if (p === "revising") { setSawRevising(true); setActiveStep(3); }
          else if (p === "done") setActiveStep(4);
        },
        onResult: (r) => { setResult(r); setPhase("result"); },
        onBlocked: (q, missing) => { setFollowUp({ question: q, missing }); setPhase("input"); },
        onError: (msg) => { setError(msg); setPhase("input"); },
      }, controller.signal);
    } catch {
      setError("Det gick inte att skapa inlägget just nu. Dina uppgifter är kvar och du kan försöka igen.");
      setPhase("input");
    } finally {
      runningRef.current = false;
    }
  }

  const loadingSteps = ["Läser företagskunskap", "Skriver första utkast", "Kvalitetssäkrar", sawRevising ? "Förbättrar utifrån granskning" : "Kvalitetsgranskad"];

  if (loaded && !hasCompany) {
    return (
      <AppShell>
        <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-10 lg:py-12">
          <PageHeader eyebrow="Facebook" title="Skriv ett Facebook-inlägg."
            subtitle="Anpassat efter ditt företag, ditt mål och vilka du vill nå." />
          <EmptyState icon={<IconContent size={19} />} title="Ingen företagskunskap ännu."
            body="Jag skriver utifrån det du berättat om företaget. Fyll i det först."
            action={<ButtonLink href="/onboarding">Starta onboarding</ButtonLink>} />
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-10 lg:py-12">
        {phase !== "result" && (
          <PageHeader
            eyebrow={companyName ? `${companyName} · Facebook` : "Facebook"}
            title="Skriv ett Facebook-inlägg."
            subtitle="Anpassat efter ditt företag, ditt mål och vilka du vill nå."
          />
        )}

        {phase === "input" && (
          <div className="fade-up flex flex-col gap-9">
            {followUp && (
              <Card padding="sm" className="border-primary/20 bg-primary/5">
                <div className="mb-2 flex items-center gap-2 text-primary">
                  <IconSparkle size={15} />
                  <span className="text-xs font-semibold uppercase tracking-[0.12em]">En sak till</span>
                </div>
                <p className="text-[15px] leading-relaxed">{followUp.question}</p>
              </Card>
            )}
            {error && <Alert tone="danger" title="Det gick inte">{error}</Alert>}
            {strategyLinkError && <Alert tone="danger" title="Det gick inte">{strategyLinkError}</Alert>}

            {/* 1. Syfte */}
            <section>
              <SectionLabel>1 · Syfte</SectionLabel>
              <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {GOAL_OPTIONS.map((o) => {
                  const active = goal === o.value;
                  return (
                    <button key={o.value} type="button" onClick={() => { touch(); setGoal(o.value); }} aria-pressed={active}
                      className={cx(
                        "cursor-pointer rounded-lg border px-3.5 py-3 text-left transition-colors",
                        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2 focus-visible:ring-offset-background",
                        active ? selectedSurface : selectableSurface,
                      )}>
                      <span className={cx("block text-sm font-medium", active ? "text-text-primary" : "text-text-secondary")}>{o.label}</span>
                      <span className="mt-0.5 block text-xs text-text-tertiary">{o.hint}</span>
                    </button>
                  );
                })}
              </div>
            </section>

            {/* 2. Underlag */}
            <section>
              <SectionLabel>2 · Underlag</SectionLabel>
              <div className="mb-3.5 mt-3">
                <Segmented value={underlag} onChange={setUnderlag}
                  options={[
                    ...(strategies.length ? [{ value: "strategy" as const, label: "Kampanjstrategi" }] : []),
                    { value: "product" as const, label: "En av era produkter" },
                    { value: "other" as const, label: "Något annat" },
                  ]} />
              </div>

              {underlag === "strategy" && (
                <div className="flex flex-col gap-2">
                  {strategies.map((s) => (
                    <button key={s.id} type="button" onClick={() => handleSelectStrategy(s.id)} aria-pressed={strategyId === s.id}
                      className={cx(
                        "cursor-pointer rounded-lg border px-4 py-3.5 text-left transition-colors",
                        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2 focus-visible:ring-offset-background",
                        strategyId === s.id ? selectedSurface : selectableSurface,
                      )}>
                      <span className="block text-[15px]">{s.title}</span>
                      <span className="mt-0.5 block text-xs text-text-tertiary">{s.goal}</span>
                    </button>
                  ))}
                  {strategyId && (
                    <div className="mt-1 flex items-start gap-2 rounded-lg border border-primary/20 bg-primary/5 px-3.5 py-2.5">
                      <span className="mt-0.5 shrink-0 text-primary"><IconSparkle size={14} /></span>
                      <p className="text-xs leading-relaxed text-text-secondary">
                        {prefilledFields.length
                          ? <>Hämtat från kampanjstrategin: <span className="text-text-primary">{prefilledFields.join(", ")}</span>. Justera fritt — ändringar gäller bara det här inlägget och rör inte strategin.</>
                          : "Den här strategin saknar fält som kan förifyllas automatiskt — fyll i nedan."}
                      </p>
                    </div>
                  )}
                </div>
              )}

              {underlag === "product" && (
                <div>
                  {brain.products.length === 0 ? (
                    <p className="text-sm text-text-tertiary">
                      Inga produkter tillagda ännu. Välj “Något annat” och beskriv fritt, eller lägg till produkter under Vad jag vet.
                    </p>
                  ) : (
                    <div className="flex flex-wrap gap-2">
                      {brain.products.map((p) => (
                        <Chip key={p.id} label={p.name} active={productId === p.id} onClick={() => pickProduct(p)} />
                      ))}
                    </div>
                  )}
                  {selectedProduct && (
                    <Card padding="sm" className="mt-4">
                      <div className="mb-3 flex items-center gap-2 text-primary">
                        <IconContent size={14} />
                        <span className="text-xs font-semibold uppercase tracking-[0.12em]">Redan känt om {selectedProduct.name}</span>
                      </div>
                      <KnownChips label="Differentiering" items={selectedProduct.differentiators} />
                      <KnownChips label="Vanliga invändningar" items={selectedProduct.commonObjections} />
                      {selectedProduct.seasonality && <KnownChips label="Säsong" items={[selectedProduct.seasonality]} />}
                      <p className="mt-1.5 text-xs text-text-tertiary">
                        Det här används automatiskt. Justeringar nedan gäller bara det här inlägget — företagskunskapen ändras inte.
                      </p>
                    </Card>
                  )}
                </div>
              )}

              <div className="mt-4 flex flex-col gap-4">
                <Field label="Vad marknadsförs" hint={underlag === "product" ? "Förifyllt från produkten — justera fritt för det här inlägget." : undefined}>
                  <Textarea value={productOrTopic} onChange={(e) => { touch(); setProductOrTopic(e.target.value); }} rows={2}
                    placeholder={platshallare.amne} />
                </Field>
                <Field label="Målgrupp för inlägget">
                  <Input value={audience} onChange={(e) => { touch(); setAudience(e.target.value); }}
                    placeholder={platshallare.malgrupp} />
                </Field>
              </div>
            </section>

            {/* 3. Erbjudande / anledning att agera */}
            <section>
              <SectionLabel>3 · Erbjudande & handling</SectionLabel>
              <div className="mt-3 grid gap-3.5 sm:grid-cols-2">
                <Field label="Erbjudande" optional><Input value={offer} onChange={(e) => { touch(); setOffer(e.target.value); }} placeholder="t.ex. ett erbjudande som gäller nu" /></Field>
                <Field label="Pris" optional><Input value={price} onChange={(e) => { touch(); setPrice(e.target.value); }} placeholder="t.ex. ett pris eller prisintervall" /></Field>
                <Field label="Sista datum" optional><Input value={deadline} onChange={(e) => { touch(); setDeadline(e.target.value); }} placeholder="t.ex. sista dagen erbjudandet gäller" /></Field>
                <Field label="Geografiskt område" optional><Input value={geo} onChange={(e) => { touch(); setGeo(e.target.value); }} placeholder={platshallare.ort} /></Field>
              </div>
              <div className="mt-3.5">
                <Field label="Önskad CTA — vad ska läsaren göra?">
                  <Input value={desiredAction} onChange={(e) => { touch(); setDesiredAction(e.target.value); }} placeholder={platshallare.cta} />
                </Field>
              </div>
            </section>

            {/* 4. Vinkel */}
            <section>
              <SectionLabel>4 · Vinkel</SectionLabel>
              <div className="mt-3 flex flex-wrap gap-2">
                {ANGLE_OPTIONS.map((o) => <Chip key={o.value} label={o.label} active={angle === o.value} onClick={() => { touch(); setAngle(o.value); }} />)}
              </div>
            </section>

            {/* 5. Ton */}
            <section>
              <SectionLabel>5 · Ton</SectionLabel>
              <p className="mb-3 mt-2 text-xs leading-relaxed text-text-tertiary">
                {toneDefault ? <>Hämtad från företagskunskapen: <span className="text-text-secondary">{toneDefault}</span>. Välj en tillfällig justering nedan om du vill.</> : "Välj en ton för det här inlägget."}
              </p>
              <div className="flex flex-wrap gap-2">
                {TONE_SUGGESTIONS.map((tOpt) => <Chip key={tOpt} label={tOpt} active={tone === tOpt} onClick={() => { touch(); setTone(tone === tOpt ? "" : tOpt); }} />)}
              </div>
            </section>

            {/* 6. Längd */}
            <section>
              <SectionLabel>6 · Längd</SectionLabel>
              <div className="mt-3 flex flex-wrap gap-2">
                {LENGTH_OPTIONS.map((o) => (
                  <button key={o.value} type="button" onClick={() => { touch(); setLength(o.value); }} aria-pressed={length === o.value}
                    className={cx(
                      "min-w-[150px] cursor-pointer rounded-lg border px-4 py-2.5 text-left transition-colors",
                      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2 focus-visible:ring-offset-background",
                      length === o.value ? selectedSurface : selectableSurface,
                    )}>
                    <span className={cx("block text-sm font-medium", length === o.value ? "text-text-primary" : "text-text-secondary")}>{o.label}</span>
                    <span className="mt-0.5 block text-xs text-text-tertiary">{o.hint}</span>
                  </button>
                ))}
              </div>
            </section>

            <div>
              <Field label="Övrigt till specialisten" optional>
                <Textarea value={notes} onChange={(e) => { touch(); setNotes(e.target.value); }} rows={2} placeholder="t.ex. något du vill att inlägget lyfter fram" />
              </Field>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <Button onClick={() => run(buildBrief())}>Skapa Facebook-inlägg</Button>
              <span className="text-xs text-text-tertiary">
                Ett utkast skrivs, kvalitetssäkras och förbättras vid behov.
              </span>
            </div>
          </div>
        )}

        {phase === "generating" && (
          <div className="pt-5">
            <LoadingPanel title="Jag skriver inlägget" steps={loadingSteps} activeStep={activeStep} />
          </div>
        )}

        {phase === "result" && result && (
          <ResultView
            result={result}
            companyName={companyName}
            companyId={companyId}
            lastBrief={buildBrief()}
            onBack={() => setPhase("input")}
            onRegenerate={run}
            buildBrief={buildBrief}
          />
        )}
      </div>
    </AppShell>
  );
}

/* ── Resultatvy ──────────────────────────────────────────── */
const CHECK_LABELS: Record<keyof FacebookQualityChecks, string> = {
  companySpecific: "Företagsspecifik", audienceSpecific: "Målgruppsanpassad", clearHook: "Tydlig hook",
  clearCustomerValue: "Kundnytta", credibleClaims: "Trovärdiga påståenden", correctTone: "Rätt ton",
  clearCTA: "Tydlig CTA", appropriateLength: "Rimlig längd", readableFormatting: "Läsbar formatering",
  noForbiddenClaims: "Inga förbjudna påståenden", naturalSwedish: "Naturlig svenska",
  honestSocialProof: "Ärligt socialt bevis", noEmptyClosing: "Konkret avslut",
  noBannedPhrases: "Inga tomma fraser", mentionsProductAndOffer: "Produkt och erbjudande",
  noInventedUrgency: "Ingen påhittad brådska",
};

/** Användarvänlig huvudstatus — den primära signalen (poängtalet är sekundärt). */
const USER_STATUS_MAP: Record<FacebookUserStatus, { tone: "success" | "warning" | "danger"; prick: string; t: string }> = {
  ready: { tone: "success", prick: "bg-success", t: "Publiceringsklar" },
  review: { tone: "warning", prick: "bg-warning", t: "Behöver granskas" },
  incomplete: { tone: "danger", prick: "bg-danger", t: "Behöver kompletteras" },
};

function StatusBadge({ status }: { status: FacebookUserStatus }) {
  const map = USER_STATUS_MAP[status];
  return (
    <StatusChip tone={map.tone}>
      <span aria-hidden className={cx("h-1.5 w-1.5 rounded-full", map.prick)} />
      {map.t}
    </StatusChip>
  );
}

/* Diskreta engagemangsikoner — visuell preview, aldrig med påhittade siffror. */
function EngageIcon({ kind }: { kind: "like" | "comment" | "share" }) {
  const common = { width: 17, height: 17, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.6, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
  if (kind === "like") return <svg {...common}><path d="M7 10v11M2 13v6a2 2 0 0 0 2 2h13.3a2 2 0 0 0 2-1.6l1.4-7A2 2 0 0 0 19.7 10H14V5a2.5 2.5 0 0 0-4.8-1L7 10H4a2 2 0 0 0-2 2Z" /></svg>;
  if (kind === "comment") return <svg {...common}><path d="M21 11.5a8.5 8.5 0 0 1-12.3 7.6L3 21l1.9-5.7A8.5 8.5 0 1 1 21 11.5Z" /></svg>;
  return <svg {...common}><path d="M4 12v7a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-7M16 6l-4-4-4 4M12 2v13" /></svg>;
}

const PREVIEW_CLAMP = 360; // tecken innan "Visa mer" (påverkar aldrig redigering)

function FacebookPreview({ companyName, text, imageBrief, edited }: {
  companyName: string; text: string; imageBrief: FacebookImageBrief; edited?: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  const isLong = text.length > PREVIEW_CLAMP;
  const shown = isLong && !expanded ? text.slice(0, PREVIEW_CLAMP).replace(/\s+\S*$/, "") : text;
  const initial = (companyName || "F").charAt(0).toUpperCase();
  const mediaHint = imageBrief.concept || imageBrief.subject || "Bild enligt bildbriefen nedan";

  return (
    <div style={{ background: T.surface, borderRadius: 14, overflow: "hidden", border: `1px solid ${T.line2}`, boxShadow: "0 24px 60px -34px rgba(0,0,0,0.65)", maxWidth: 560 }}>
      {/* Huvud: avatar, företagsnamn, neutral tidsindikator (organiskt, ingen "Sponsrad") */}
      <div style={{ display: "flex", alignItems: "center", gap: 11, padding: "13px 15px" }}>
        <span style={{ width: 40, height: 40, borderRadius: "50%", flexShrink: 0, background: "linear-gradient(135deg,#8b6bf2,#5b8def)", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontFamily: fontSans, fontWeight: 600, fontSize: "1.05rem" }}>
          {initial}
        </span>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontFamily: fontSans, fontSize: "0.9rem", fontWeight: 600, color: T.text, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
            {companyName || "Ditt företag"}
            {edited && <span style={{ marginLeft: 8, fontSize: "0.75rem", fontWeight: 400, color: T.orange }}>✎ redigerad</span>}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 5, fontFamily: fontSans, fontSize: "0.75rem", color: T.text3 }}>
            Just nu · <span aria-hidden>🌐</span>
          </div>
        </div>
      </div>

      {/* Inläggstext med "Visa mer" för långa texter */}
      <div style={{ padding: "0 15px 13px", fontFamily: fontSans, fontSize: "0.94rem", fontWeight: 300, color: T.text, lineHeight: 1.62, whiteSpace: "pre-line", wordBreak: "break-word" }}>
        {shown}{isLong && !expanded && <span style={{ color: T.text3 }}>… </span>}
        {isLong && (
          <button type="button" onClick={() => setExpanded((e) => !e)} className="mcx-focusable"
            style={{ background: "none", border: "none", padding: 0, cursor: "pointer", color: T.text3, fontFamily: fontSans, fontSize: "0.9rem", fontWeight: 500 }}>
            {expanded ? "Visa mindre" : "Visa mer"}
          </button>
        )}
      </div>

      {/* Medieyta kopplad till bildbriefen (placeholder, aldrig påhittad bild) */}
      <div style={{ height: 190, background: `linear-gradient(135deg, ${T.purpleDim}, ${T.blueDim})`, borderTop: `1px solid ${T.line}`, borderBottom: `1px solid ${T.line}`, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 6, padding: "0 24px", textAlign: "center" }}>
        <span aria-hidden style={{ color: T.purpleBright, opacity: 0.8 }}><IconContent size={20} /></span>
        <span style={{ fontFamily: fontSans, fontSize: "0.76rem", fontWeight: 300, color: T.text3, lineHeight: 1.5, maxWidth: 340 }}>{mediaHint}</span>
      </div>

      {/* Diskret engagemangsrad — visuell preview, inga reaktioner/kommentarer/antal */}
      <div style={{ display: "flex", padding: "6px 8px" }}>
        {([["like", "Gilla"], ["comment", "Kommentera"], ["share", "Dela"]] as const).map(([k, label]) => (
          <div key={k} style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 8, padding: "9px 6px", color: T.text3, fontFamily: fontSans, fontSize: "0.82rem", fontWeight: 400 }}>
            <EngageIcon kind={k} /> {label}
          </div>
        ))}
      </div>
    </div>
  );
}

function VariantCard({ v }: { v: FacebookPostVariant }) {
  return (
    <Card padding="sm">
      <div className="mb-2.5 flex items-center justify-between gap-2.5">
        <span className="text-xs font-semibold uppercase tracking-[0.12em] text-primary">{v.angle}</span>
        <CopyButton getText={() => `${v.postText}\n\n${v.callToAction}${v.hashtags.length ? "\n\n" + v.hashtags.map((h) => "#" + h).join(" ") : ""}`} variant="secondary" label="Kopiera" />
      </div>
      <p className="whitespace-pre-line text-sm leading-relaxed text-text-secondary">{v.postText}</p>
      {v.hashtags.length > 0 && (
        <div className="mt-2.5 flex flex-wrap gap-1.5">
          {v.hashtags.map((h, i) => <span key={i} className="text-xs text-primary">#{h}</span>)}
        </div>
      )}
    </Card>
  );
}

function ResultView({ result, companyName, companyId, lastBrief, onBack, onRegenerate, buildBrief }: {
  result: FacebookSpecialistResult;
  companyName: string;
  companyId: string | null;
  lastBrief: FacebookBrief;
  onBack: () => void;
  onRegenerate: (b: FacebookBrief) => void;
  buildBrief: (o?: Partial<FacebookBrief>) => FacebookBrief;
}) {
  const primary = result.primary;
  const [editing, setEditing] = useState(false);
  const [editedText, setEditedText] = useState(primary.postText);
  const [edited, setEdited] = useState(false);
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [showTone, setShowTone] = useState(false);
  const [showAngle, setShowAngle] = useState(false);

  const displayText = edited ? editedText : primary.postText;

  function confirmIfEdited(): boolean {
    if (!edited) return true;
    return window.confirm("Du har redigerat texten manuellt. Om du skapar en ny version försvinner dina ändringar. Vill du fortsätta?");
  }

  function regen(overrides: Partial<FacebookBrief>) {
    if (!confirmIfEdited()) return;
    onRegenerate(buildBrief(overrides));
  }

  /** Sparar paret AI-original → din version, så framtida inlägg låter som du. */
  async function rememberEdit() {
    if (!edited || editedText === primary.postText) return;
    try {
      await fetch("/api/text-edits", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          kind: "facebook_post",
          original: primary.postText,
          edited: editedText,
          label: primary.label,
          companyId,
        }),
      });
    } catch {
      // Tyst med flit — minnet får aldrig stå i vägen för arbetet.
    }
  }

  async function saveDraft() {
    setSaveState("saving");
    try {
      const sb = createClient();
      const { data: { user } } = await sb.auth.getUser();
      if (!user) { setSaveState("error"); return; }
      const { error } = await sb.from("content_drafts").insert({
        user_id: user.id,
        company_id: companyId,
        channel: "facebook",
        brief: lastBrief,
        result,
        edited,
        edited_text: edited ? editedText : null,
      });
      if (error) throw error;
      void rememberEdit();
      setSaveState("saved");
      setTimeout(() => setSaveState("idle"), 2500);
    } catch {
      setSaveState("error");
    }
  }

  const fullCopy = `${displayText}\n\n${primary.callToAction}${primary.hashtags.length ? "\n\n" + primary.hashtags.map((h) => "#" + h).join(" ") : ""}`;

  return (
    <div className="fade-up">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <StatusBadge status={result.qualityReview.userStatus} />
          <span className="text-xs text-text-tertiary">
            Vinkel: <span className="text-text-secondary">{result.recommendedAngle}</span>
          </span>
        </div>
        <Button variant="secondary" onClick={onBack}>← Ändra underlag</Button>
      </div>

      {result.qualityReview.statusReason && (
        <p className="mb-4 max-w-2xl text-sm leading-relaxed text-text-secondary">
          {result.qualityReview.statusReason}
        </p>
      )}

      {result.angleReason && (
        <p className="mb-5 max-w-2xl text-sm leading-relaxed text-text-tertiary">
          {result.angleReason}
        </p>
      )}

      {/* Primär */}
      <div className="mb-3.5 grid gap-4">
        {editing ? (
          <div>
            <Textarea value={editedText} rows={10} onChange={(e) => { setEditedText(e.target.value); setEdited(true); }} />
            <div className="mt-2 flex gap-2">
              <Button variant="secondary" onClick={() => setEditing(false)}>Klar</Button>
              {edited && <span className="self-center text-xs text-warning">✎ Redigerad</span>}
            </div>
          </div>
        ) : (
          <FacebookPreview companyName={companyName} text={displayText} imageBrief={primary.imageBrief} edited={edited} />
        )}
      </div>

      <div className="mb-5 flex flex-wrap items-baseline gap-2.5">
        <span className="text-xs text-text-tertiary">CTA:</span>
        <span className="text-sm text-text-secondary">{primary.callToAction}</span>
      </div>

      {/* Actions */}
      <div className="mb-2.5 flex flex-wrap gap-2">
        <CopyButton getText={() => { void rememberEdit(); return fullCopy; }} label="Kopiera" />
        <Button variant="secondary" onClick={() => setEditing((e) => !e)}>{editing ? "Stäng redigering" : "Redigera"}</Button>
        <Button variant="secondary" onClick={() => regen({})}>Skapa ny variant</Button>
        <Button variant="secondary" onClick={() => regen({ length: "short" })}>Förkorta</Button>
        <Button variant="secondary" onClick={() => regen({ length: "detailed" })}>Förläng</Button>
        <Button variant="secondary" onClick={() => setShowTone((s) => !s)}>Ändra ton</Button>
        <Button variant="secondary" onClick={() => setShowAngle((s) => !s)}>Byt vinkel</Button>
        <Button variant="secondary" onClick={saveDraft} disabled={saveState === "saving"}>
          {saveState === "saving" ? "Sparar…" : saveState === "saved" ? "✓ Sparad" : "Spara som utkast"}
        </Button>
      </div>
      {saveState === "error" && <div className="mb-2.5"><Alert tone="danger" title="Det gick inte">Kunde inte spara utkastet. Är migrationen för content_drafts körd?</Alert></div>}

      {showTone && (
        <div className="mb-4 mt-1.5 flex flex-wrap gap-1.5">
          {TONE_SUGGESTIONS.map((tOpt) => <Chip key={tOpt} label={tOpt} onClick={() => { setShowTone(false); regen({ toneOverride: tOpt }); }} />)}
        </div>
      )}
      {showAngle && (
        <div className="mb-4 mt-1.5 flex flex-wrap gap-1.5">
          {ANGLE_OPTIONS.filter((o) => o.value !== "specialist_recommendation").map((o) =>
            <Chip key={o.value} label={o.label} onClick={() => { setShowAngle(false); regen({ requestedAngle: o.value }); }} />)}
        </div>
      )}

      {/* Alternativ */}
      {result.alternatives.length > 0 && (
        <section className="mt-8">
          <SectionLabel>Alternativa vinklar</SectionLabel>
          <div className="mt-3 grid gap-3.5 sm:grid-cols-2">
            {result.alternatives.map((v) => <VariantCard key={v.id} v={v} />)}
          </div>
        </section>
      )}

      {/* Bildbrief */}
      <section className="mt-8">
        <SectionLabel>Bildbrief</SectionLabel>
        <Card padding="sm" className="mt-3 flex flex-col gap-2">
          <BriefRow label="Idé" value={primary.imageBrief.concept} />
          <BriefRow label="Motiv" value={primary.imageBrief.subject} />
          <BriefRow label="Komposition" value={primary.imageBrief.composition} />
          {primary.imageBrief.textOverlay && <BriefRow label="Text i bild" value={primary.imageBrief.textOverlay} />}
          {primary.imageBrief.avoid.length > 0 && <BriefRow label="Undvik" value={primary.imageBrief.avoid.join(", ")} />}
        </Card>

        {/* Briefen är redan skriven — bilden skapas bara om du väljer det.
            Aldrig automatiskt: en bild kostar hundra gånger mer än texten. */}
        <div className="mt-3">
          <ImageMaker
            initialPrompt={briefToSubject(primary.imageBrief)}
            avoid={primary.imageBrief.avoid}
          />
        </div>
      </section>

      {/* Kvalitetsstatus — status + motivering är primärt, poängtalet sekundärt */}
      <section className="mt-8">
        <div className="flex flex-wrap items-center gap-2.5">
          <SectionLabel>Kvalitetskontroll</SectionLabel>
          <StatusBadge status={result.qualityReview.userStatus} />
          <span className="text-xs text-text-tertiary">internt {result.qualityReview.overallScore}/100</span>
        </div>
        {result.qualityReview.statusReason && (
          <p className="mt-2.5 max-w-2xl text-sm leading-relaxed text-text-secondary">{result.qualityReview.statusReason}</p>
        )}
        <div className="mt-3.5 grid gap-1.5 sm:grid-cols-2">
          {(Object.keys(CHECK_LABELS) as (keyof FacebookQualityChecks)[]).map((k) => {
            const ok = result.qualityReview.checks[k];
            return (
              <div key={k} className="flex items-center gap-2 rounded bg-surface px-2.5 py-2">
                <span className={cx("flex", ok ? "text-success" : "text-warning")}>{ok ? <IconCheck size={14} /> : <IconX size={14} />}</span>
                <span className={cx("text-xs", ok ? "text-text-secondary" : "text-text-tertiary")}>{CHECK_LABELS[k]}</span>
              </div>
            );
          })}
        </div>
        {result.qualityReview.issues.length > 0 && (
          <ul className="mt-3 list-disc pl-[18px] text-sm leading-relaxed text-text-tertiary">
            {result.qualityReview.issues.map((it, i) => <li key={i}>{it}</li>)}
          </ul>
        )}
        {result.qualityReview.revisionSummary && (
          <p className="mt-2.5 text-xs leading-relaxed text-text-tertiary">{result.qualityReview.revisionSummary}</p>
        )}
      </section>

      {/* Antaganden & luckor */}
      {(result.assumptions.length > 0 || result.missingInformation.length > 0) && (
        <section className="mt-8">
          {result.assumptions.length > 0 && (
            <div className="mb-3.5">
              <SectionLabel>Antaganden</SectionLabel>
              <ul className="mt-2.5 list-disc pl-[18px] text-sm leading-relaxed text-text-tertiary">
                {result.assumptions.map((a, i) => <li key={i}>{a}</li>)}
              </ul>
            </div>
          )}
          {result.missingInformation.length > 0 && (
            <div>
              <SectionLabel>Skulle höjt kvaliteten</SectionLabel>
              <ul className="mt-2.5 list-disc pl-[18px] text-sm leading-relaxed text-text-tertiary">
                {result.missingInformation.map((m, i) => <li key={i}>{m}</li>)}
              </ul>
            </div>
          )}
        </section>
      )}
    </div>
  );
}

function BriefRow({ label, value }: { label: string; value: string }) {
  if (!value) return null;
  return (
    <div className="flex gap-3">
      <span className="w-24 shrink-0 pt-0.5 text-xs font-semibold uppercase tracking-[0.06em] text-text-tertiary">{label}</span>
      <span className="text-sm leading-relaxed text-text-secondary">{value}</span>
    </div>
  );
}

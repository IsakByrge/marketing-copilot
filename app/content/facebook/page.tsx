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
import Shell from "@/app/_shared/Shell";
import { T, fontSans, fontSerif, transition } from "@/app/_shared/theme";
import {
  PageHeader, PrimaryButton, GhostButton, Field, TextInput, TextArea,
  LoadingPanel, ErrorNote, EmptyState, CopyButton, SectionLabel,
} from "@/app/_shared/ui";
import { IconContent, IconSparkle, IconCheck, IconX } from "@/app/_shared/icons";
import { useCompanyBrain } from "@/app/_shared/useCompanyBrain";
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
function Segmented<V extends string>({ value, onChange, options }: {
  value: V; onChange: (v: V) => void; options: { value: V; label: string }[];
}) {
  return (
    <div style={{ display: "inline-flex", gap: 4, padding: 4, background: T.surface2, border: `1px solid ${T.line2}`, borderRadius: 12, flexWrap: "wrap" }}>
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button key={o.value} type="button" onClick={() => onChange(o.value)} className="mcx-focusable"
            style={{
              fontFamily: fontSans, fontSize: "0.82rem", fontWeight: active ? 500 : 400,
              padding: "8px 14px", borderRadius: 9, cursor: "pointer", transition,
              border: `1px solid ${active ? T.purpleBorder : "transparent"}`,
              background: active ? T.purpleDim : "transparent",
              color: active ? T.text : T.text3,
            }}>
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

function Chip({ label, active, onClick }: { label: string; active?: boolean; onClick?: () => void }) {
  return (
    <button type="button" onClick={onClick} className="mcx-focusable"
      style={{
        fontFamily: fontSans, fontSize: "0.8rem", fontWeight: active ? 500 : 400,
        padding: "7px 13px", borderRadius: 999, cursor: onClick ? "pointer" : "default", transition,
        border: `1px solid ${active ? T.purpleBorder : T.line2}`,
        background: active ? T.purpleDim : "transparent",
        color: active ? T.purpleBright : T.text3,
      }}>
      {label}
    </button>
  );
}

function KnownChips({ label, items }: { label: string; items: string[] }) {
  if (!items.length) return null;
  return (
    <div style={{ marginBottom: 10 }}>
      <div style={{ fontFamily: fontSans, fontSize: "0.7rem", fontWeight: 400, color: T.text4, marginBottom: 6 }}>{label}</div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
        {items.map((it, i) => <Chip key={i} label={it} />)}
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
    setPrefilledFields(p.filledFields);
    formTouchedRef.current = false;
  }

  // Ladda sparade kampanjstrategier (RLS). Saknas tabellen ännu → tyst tomt.
  // strategy_context läses med (RLS-skyddat) så formuläret kan förifyllas.
  // Direktnavigering från Campaign Builder (/content/facebook?strategy=<id>)
  // hanteras här: när strategin finns i användarens lista förväljs och förifylls
  // den direkt (setState sker i en async-callback, inte synkront i effektkroppen).
  useEffect(() => {
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
        if (!data) return;
        const list = data.map((r) => ({
          id: r.id as string, title: r.title as string, goal: r.goal as string,
          context: (r.strategy_context && typeof r.strategy_context === "object"
            ? r.strategy_context as StrategyContextForForm : null),
        }));
        setStrategies(list);
        const wanted = new URLSearchParams(window.location.search).get("strategy");
        const match = wanted ? list.find((s) => s.id === wanted) : undefined;
        if (match) { setUnderlag("strategy"); setStrategyId(match.id); applyStrategyPrefill(match.context); }
      } catch { /* tabellen kanske inte migrerad ännu */ }
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
      <Shell>
        <div style={{ maxWidth: 720, margin: "0 auto", padding: "56px 40px 100px" }}>
          <PageHeader eyebrow="Facebook Specialist" title="Skapa Facebook-inlägg som passar ditt företag."
            subtitle="Skapa Facebook-inlägg som är anpassade efter ditt företag, ditt mål och din målgrupp." />
          <EmptyState icon={<IconContent size={19} />} title="Ingen företagskunskap ännu."
            body="Facebook-specialisten skriver utifrån ditt företag. Skapa en företagsprofil först."
            action={<PrimaryButton href="/onboarding">Starta onboarding</PrimaryButton>} />
        </div>
      </Shell>
    );
  }

  return (
    <Shell>
      <div style={{ maxWidth: 880, margin: "0 auto", padding: "48px 40px 110px" }}>
        {phase !== "result" && (
          <PageHeader
            eyebrow={companyName ? `${companyName} · Facebook Specialist` : "Facebook Specialist"}
            title="Facebook Specialist"
            subtitle="Skapa Facebook-inlägg som är anpassade efter ditt företag, ditt mål och din målgrupp."
          />
        )}

        {phase === "input" && (
          <div className="fade-up" style={{ display: "flex", flexDirection: "column", gap: 34 }}>
            {followUp && (
              <div style={{ padding: "18px 20px", borderRadius: 14, background: T.purpleDim, border: `1px solid ${T.purpleBorder}` }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8, color: T.purpleBright }}>
                  <IconSparkle size={15} />
                  <span style={{ fontFamily: fontSans, fontSize: "0.7rem", fontWeight: 500, letterSpacing: "0.12em", textTransform: "uppercase" }}>En sak till</span>
                </div>
                <p style={{ fontFamily: fontSans, fontSize: "0.95rem", fontWeight: 300, color: T.text, lineHeight: 1.6 }}>{followUp.question}</p>
              </div>
            )}
            {error && <ErrorNote>{error}</ErrorNote>}

            {/* 1. Syfte */}
            <section>
              <SectionLabel>1 · Syfte</SectionLabel>
              <div style={{ marginTop: 12, display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(210px, 1fr))", gap: 8 }}>
                {GOAL_OPTIONS.map((o) => {
                  const active = goal === o.value;
                  return (
                    <button key={o.value} type="button" onClick={() => { touch(); setGoal(o.value); }} aria-pressed={active} className="mcx-focusable"
                      style={{
                        textAlign: "left", padding: "12px 14px", borderRadius: 11, cursor: "pointer", transition,
                        background: active ? T.purpleDim : T.surface,
                        border: `1px solid ${active ? T.purpleBorder : T.line}`,
                      }}>
                      <div style={{ fontFamily: fontSans, fontSize: "0.85rem", fontWeight: 500, color: active ? T.text : T.text2 }}>{o.label}</div>
                      <div style={{ fontFamily: fontSans, fontSize: "0.73rem", fontWeight: 300, color: T.text3, marginTop: 2 }}>{o.hint}</div>
                    </button>
                  );
                })}
              </div>
            </section>

            {/* 2. Underlag */}
            <section>
              <SectionLabel>2 · Underlag</SectionLabel>
              <div style={{ marginTop: 12, marginBottom: 14 }}>
                <Segmented value={underlag} onChange={setUnderlag}
                  options={[
                    ...(strategies.length ? [{ value: "strategy" as const, label: "Kampanjstrategi" }] : []),
                    { value: "product" as const, label: "Produkt ur Company Brain" },
                    { value: "other" as const, label: "Något annat" },
                  ]} />
              </div>

              {underlag === "strategy" && (
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {strategies.map((s) => (
                    <button key={s.id} type="button" onClick={() => handleSelectStrategy(s.id)} className="mcx-focusable"
                      style={{
                        textAlign: "left", padding: "14px 16px", borderRadius: 11, cursor: "pointer", transition,
                        background: strategyId === s.id ? T.purpleDim : T.surface,
                        border: `1px solid ${strategyId === s.id ? T.purpleBorder : T.line}`,
                      }}>
                      <div style={{ fontFamily: fontSerif, fontSize: "1rem", color: T.text }}>{s.title}</div>
                      <div style={{ fontFamily: fontSans, fontSize: "0.76rem", fontWeight: 300, color: T.text3, marginTop: 2 }}>{s.goal}</div>
                    </button>
                  ))}
                  {strategyId && (
                    <div style={{ display: "flex", alignItems: "flex-start", gap: 8, marginTop: 4, padding: "11px 14px", borderRadius: 11, background: T.purpleDim, border: `1px solid ${T.purpleBorder}` }}>
                      <span style={{ color: T.purpleBright, flexShrink: 0, marginTop: 1 }}><IconSparkle size={14} /></span>
                      <p style={{ fontFamily: fontSans, fontSize: "0.76rem", fontWeight: 300, color: T.text2, lineHeight: 1.55 }}>
                        {prefilledFields.length
                          ? <>Hämtat från kampanjstrategin: <span style={{ color: T.text }}>{prefilledFields.join(", ")}</span>. Justera fritt — ändringar gäller bara det här inlägget och rör inte strategin.</>
                          : "Den här strategin saknar fält som kan förifyllas automatiskt — fyll i nedan."}
                      </p>
                    </div>
                  )}
                </div>
              )}

              {underlag === "product" && (
                <div>
                  {brain.products.length === 0 ? (
                    <p style={{ fontFamily: fontSans, fontSize: "0.85rem", fontWeight: 300, color: T.text3 }}>
                      Inga produkter i Company Brain ännu. Välj “Något annat” och beskriv fritt, eller lägg till produkter under Företagskunskap.
                    </p>
                  ) : (
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                      {brain.products.map((p) => (
                        <Chip key={p.id} label={p.name} active={productId === p.id} onClick={() => pickProduct(p)} />
                      ))}
                    </div>
                  )}
                  {selectedProduct && (
                    <div style={{ marginTop: 16, padding: "16px 18px", borderRadius: 12, background: T.surface, border: `1px solid ${T.line}` }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12, color: T.purpleBright }}>
                        <IconContent size={14} />
                        <span style={{ fontFamily: fontSans, fontSize: "0.68rem", fontWeight: 500, letterSpacing: "0.12em", textTransform: "uppercase" }}>Redan känt om {selectedProduct.name}</span>
                      </div>
                      <KnownChips label="Differentiering" items={selectedProduct.differentiators} />
                      <KnownChips label="Vanliga invändningar" items={selectedProduct.commonObjections} />
                      {selectedProduct.seasonality && <KnownChips label="Säsong" items={[selectedProduct.seasonality]} />}
                      <p style={{ fontFamily: fontSans, fontSize: "0.73rem", fontWeight: 300, color: T.text4, marginTop: 6 }}>
                        Specialisten använder detta automatiskt. Justeringar nedan gäller bara det här inlägget — Company Brain ändras inte.
                      </p>
                    </div>
                  )}
                </div>
              )}

              <div style={{ marginTop: 16, display: "flex", flexDirection: "column", gap: 16 }}>
                <Field label="Vad marknadsförs" hint={underlag === "product" ? "Förifyllt från produkten — justera fritt för det här inlägget." : undefined}>
                  <TextArea value={productOrTopic} onChange={(e) => { touch(); setProductOrTopic(e.target.value); }} rows={2}
                    placeholder="t.ex. Vinterservice med rekonditionering och lackskydd" />
                </Field>
                <Field label="Målgrupp för inlägget">
                  <TextInput value={audience} onChange={(e) => { touch(); setAudience(e.target.value); }}
                    placeholder={brain.primaryCustomers[0] ? `t.ex. ${brain.primaryCustomers[0]}` : "t.ex. villaägare i närområdet"} />
                </Field>
              </div>
            </section>

            {/* 3. Erbjudande / anledning att agera */}
            <section>
              <SectionLabel>3 · Erbjudande & handling</SectionLabel>
              <div style={{ marginTop: 12, display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 14 }}>
                <Field label="Erbjudande" optional><TextInput value={offer} onChange={(e) => { touch(); setOffer(e.target.value); }} placeholder="t.ex. 15% på första besöket" /></Field>
                <Field label="Pris" optional><TextInput value={price} onChange={(e) => { touch(); setPrice(e.target.value); }} placeholder="t.ex. från 1 495 kr" /></Field>
                <Field label="Sista datum" optional><TextInput value={deadline} onChange={(e) => { touch(); setDeadline(e.target.value); }} placeholder="t.ex. 20 juni" /></Field>
                <Field label="Geografiskt område" optional><TextInput value={geo} onChange={(e) => { touch(); setGeo(e.target.value); }} placeholder="t.ex. Västerås med omnejd" /></Field>
              </div>
              <div style={{ marginTop: 14 }}>
                <Field label="Önskad CTA — vad ska läsaren göra?">
                  <TextInput value={desiredAction} onChange={(e) => { touch(); setDesiredAction(e.target.value); }} placeholder="t.ex. Boka tid online, ring oss, besök butiken" />
                </Field>
              </div>
            </section>

            {/* 4. Vinkel */}
            <section>
              <SectionLabel>4 · Vinkel</SectionLabel>
              <div style={{ marginTop: 12, display: "flex", flexWrap: "wrap", gap: 8 }}>
                {ANGLE_OPTIONS.map((o) => <Chip key={o.value} label={o.label} active={angle === o.value} onClick={() => { touch(); setAngle(o.value); }} />)}
              </div>
            </section>

            {/* 5. Ton */}
            <section>
              <SectionLabel>5 · Ton</SectionLabel>
              <p style={{ fontFamily: fontSans, fontSize: "0.78rem", fontWeight: 300, color: T.text3, margin: "8px 0 12px" }}>
                {toneDefault ? <>Förvald från Company Brain: <span style={{ color: T.text2 }}>{toneDefault}</span>. Välj en tillfällig justering nedan om du vill.</> : "Välj en ton för det här inlägget."}
              </p>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                {TONE_SUGGESTIONS.map((tOpt) => <Chip key={tOpt} label={tOpt} active={tone === tOpt} onClick={() => { touch(); setTone(tone === tOpt ? "" : tOpt); }} />)}
              </div>
            </section>

            {/* 6. Längd */}
            <section>
              <SectionLabel>6 · Längd</SectionLabel>
              <div style={{ marginTop: 12, display: "flex", flexWrap: "wrap", gap: 8 }}>
                {LENGTH_OPTIONS.map((o) => (
                  <button key={o.value} type="button" onClick={() => { touch(); setLength(o.value); }} aria-pressed={length === o.value} className="mcx-focusable"
                    style={{
                      textAlign: "left", padding: "11px 15px", borderRadius: 11, cursor: "pointer", transition, minWidth: 150,
                      background: length === o.value ? T.purpleDim : T.surface,
                      border: `1px solid ${length === o.value ? T.purpleBorder : T.line}`,
                    }}>
                    <div style={{ fontFamily: fontSans, fontSize: "0.85rem", fontWeight: 500, color: length === o.value ? T.text : T.text2 }}>{o.label}</div>
                    <div style={{ fontFamily: fontSans, fontSize: "0.72rem", fontWeight: 300, color: T.text3, marginTop: 2 }}>{o.hint}</div>
                  </button>
                ))}
              </div>
            </section>

            <div>
              <Field label="Övrigt till specialisten" optional>
                <TextArea value={notes} onChange={(e) => { touch(); setNotes(e.target.value); }} rows={2} placeholder="t.ex. lyft att vi är familjeägda sedan 1998" />
              </Field>
            </div>

            <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
              <PrimaryButton onClick={() => run(buildBrief())}>Skapa Facebook-inlägg</PrimaryButton>
              <span style={{ fontFamily: fontSans, fontSize: "0.76rem", fontWeight: 300, color: T.text4 }}>
                Specialisten skriver ett utkast, kvalitetssäkrar det och förbättrar vid behov.
              </span>
            </div>
          </div>
        )}

        {phase === "generating" && (
          <div style={{ paddingTop: 20 }}>
            <LoadingPanel title="Facebook Specialist arbetar" steps={loadingSteps} activeStep={activeStep} />
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
    </Shell>
  );
}

/* ── Resultatvy ──────────────────────────────────────────── */
const CHECK_LABELS: Record<keyof FacebookQualityChecks, string> = {
  companySpecific: "Företagsspecifik", audienceSpecific: "Målgruppsanpassad", clearHook: "Tydlig hook",
  clearCustomerValue: "Kundnytta", credibleClaims: "Trovärdiga påståenden", correctTone: "Rätt ton",
  clearCTA: "Tydlig CTA", appropriateLength: "Rimlig längd", readableFormatting: "Läsbar formatering",
  noForbiddenClaims: "Inga förbjudna påståenden", naturalSwedish: "Naturlig svenska",
  honestSocialProof: "Ärligt socialt bevis",
};

/** Användarvänlig huvudstatus — den primära signalen (poängtalet är sekundärt). */
const USER_STATUS_MAP: Record<FacebookUserStatus, { c: string; bg: string; t: string }> = {
  ready: { c: T.green, bg: T.greenDim, t: "Publiceringsklar" },
  review: { c: T.orange, bg: T.orangeDim, t: "Behöver granskas" },
  incomplete: { c: T.red, bg: T.redDim, t: "Behöver kompletteras" },
};

function StatusBadge({ status }: { status: FacebookUserStatus }) {
  const map = USER_STATUS_MAP[status];
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 7, padding: "5px 12px", borderRadius: 999, background: map.bg, border: `1px solid ${map.c}44`, color: map.c, fontFamily: fontSans, fontSize: "0.74rem", fontWeight: 500 }}>
      <span style={{ width: 6, height: 6, borderRadius: "50%", background: map.c }} /> {map.t}
    </span>
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
        <span style={{ width: 40, height: 40, borderRadius: "50%", flexShrink: 0, background: "linear-gradient(135deg,#8b6bf2,#5b8def)", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontFamily: fontSerif, fontWeight: 600, fontSize: "1.05rem" }}>
          {initial}
        </span>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontFamily: fontSans, fontSize: "0.9rem", fontWeight: 600, color: T.text, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
            {companyName || "Ditt företag"}
            {edited && <span style={{ marginLeft: 8, fontSize: "0.68rem", fontWeight: 400, color: T.orange }}>✎ redigerad</span>}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 5, fontFamily: fontSans, fontSize: "0.72rem", color: T.text3 }}>
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
    <div style={{ background: T.surface, border: `1px solid ${T.line}`, borderRadius: 14, padding: "18px 20px" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10, gap: 10 }}>
        <span style={{ fontFamily: fontSans, fontSize: "0.7rem", fontWeight: 500, letterSpacing: "0.1em", textTransform: "uppercase", color: T.purpleBright }}>{v.angle}</span>
        <CopyButton getText={() => `${v.postText}\n\n${v.callToAction}${v.hashtags.length ? "\n\n" + v.hashtags.map((h) => "#" + h).join(" ") : ""}`} variant="ghost" label="Kopiera" />
      </div>
      <p style={{ fontFamily: fontSans, fontSize: "0.9rem", fontWeight: 300, color: T.text2, lineHeight: 1.7, whiteSpace: "pre-line" }}>{v.postText}</p>
      {v.hashtags.length > 0 && (
        <div style={{ marginTop: 10, display: "flex", flexWrap: "wrap", gap: 6 }}>
          {v.hashtags.map((h, i) => <span key={i} style={{ fontFamily: fontSans, fontSize: "0.78rem", color: T.blue }}>#{h}</span>)}
        </div>
      )}
    </div>
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
      setSaveState("saved");
      setTimeout(() => setSaveState("idle"), 2500);
    } catch {
      setSaveState("error");
    }
  }

  const fullCopy = `${displayText}\n\n${primary.callToAction}${primary.hashtags.length ? "\n\n" + primary.hashtags.map((h) => "#" + h).join(" ") : ""}`;

  return (
    <div className="fade-up">
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12, flexWrap: "wrap", gap: 12 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
          <StatusBadge status={result.qualityReview.userStatus} />
          <span style={{ fontFamily: fontSans, fontSize: "0.78rem", color: T.text3 }}>
            Vinkel: <span style={{ color: T.text2 }}>{result.recommendedAngle}</span>
          </span>
        </div>
        <GhostButton onClick={onBack}>← Ändra underlag</GhostButton>
      </div>

      {result.qualityReview.statusReason && (
        <p style={{ fontFamily: fontSans, fontSize: "0.86rem", fontWeight: 300, color: T.text2, lineHeight: 1.6, marginBottom: 18, maxWidth: 620 }}>
          {result.qualityReview.statusReason}
        </p>
      )}

      {result.angleReason && (
        <p style={{ fontFamily: fontSans, fontSize: "0.84rem", fontWeight: 300, color: T.text3, lineHeight: 1.6, marginBottom: 22, maxWidth: 620 }}>
          {result.angleReason}
        </p>
      )}

      {/* Primär */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 16, marginBottom: 14 }}>
        {editing ? (
          <div>
            <TextArea value={editedText} rows={10} onChange={(e) => { setEditedText(e.target.value); setEdited(true); }} />
            <div style={{ marginTop: 8, display: "flex", gap: 8 }}>
              <GhostButton onClick={() => setEditing(false)}>Klar</GhostButton>
              {edited && <span style={{ fontFamily: fontSans, fontSize: "0.76rem", color: T.orange, alignSelf: "center" }}>✎ Redigerad</span>}
            </div>
          </div>
        ) : (
          <FacebookPreview companyName={companyName} text={displayText} imageBrief={primary.imageBrief} edited={edited} />
        )}
      </div>

      <div style={{ display: "flex", alignItems: "baseline", gap: 10, marginBottom: 20, flexWrap: "wrap" }}>
        <span style={{ fontFamily: fontSans, fontSize: "0.8rem", color: T.text3 }}>CTA:</span>
        <span style={{ fontFamily: fontSans, fontSize: "0.86rem", color: T.text2 }}>{primary.callToAction}</span>
      </div>

      {/* Actions */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 10 }}>
        <CopyButton getText={() => fullCopy} label="Kopiera" />
        <GhostButton onClick={() => setEditing((e) => !e)}>{editing ? "Stäng redigering" : "Redigera"}</GhostButton>
        <GhostButton onClick={() => regen({})}>Skapa ny variant</GhostButton>
        <GhostButton onClick={() => regen({ length: "short" })}>Förkorta</GhostButton>
        <GhostButton onClick={() => regen({ length: "detailed" })}>Förläng</GhostButton>
        <GhostButton onClick={() => setShowTone((s) => !s)}>Ändra ton</GhostButton>
        <GhostButton onClick={() => setShowAngle((s) => !s)}>Byt vinkel</GhostButton>
        <GhostButton onClick={saveDraft} disabled={saveState === "saving"}>
          {saveState === "saving" ? "Sparar…" : saveState === "saved" ? "✓ Sparad" : "Spara som utkast"}
        </GhostButton>
      </div>
      {saveState === "error" && <div style={{ marginBottom: 10 }}><ErrorNote>Kunde inte spara utkastet. Är migrationen för content_drafts körd?</ErrorNote></div>}

      {showTone && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, margin: "6px 0 16px" }}>
          {TONE_SUGGESTIONS.map((tOpt) => <Chip key={tOpt} label={tOpt} onClick={() => { setShowTone(false); regen({ toneOverride: tOpt }); }} />)}
        </div>
      )}
      {showAngle && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, margin: "6px 0 16px" }}>
          {ANGLE_OPTIONS.filter((o) => o.value !== "specialist_recommendation").map((o) =>
            <Chip key={o.value} label={o.label} onClick={() => { setShowAngle(false); regen({ requestedAngle: o.value }); }} />)}
        </div>
      )}

      {/* Alternativ */}
      {result.alternatives.length > 0 && (
        <section style={{ marginTop: 30 }}>
          <SectionLabel>Alternativa vinklar</SectionLabel>
          <div style={{ marginTop: 12, display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 14 }}>
            {result.alternatives.map((v) => <VariantCard key={v.id} v={v} />)}
          </div>
        </section>
      )}

      {/* Bildbrief */}
      <section style={{ marginTop: 30 }}>
        <SectionLabel>Bildbrief</SectionLabel>
        <div style={{ marginTop: 12, padding: "18px 20px", borderRadius: 14, background: T.surface, border: `1px solid ${T.line}`, display: "flex", flexDirection: "column", gap: 8 }}>
          <BriefRow label="Idé" value={primary.imageBrief.concept} />
          <BriefRow label="Motiv" value={primary.imageBrief.subject} />
          <BriefRow label="Komposition" value={primary.imageBrief.composition} />
          {primary.imageBrief.textOverlay && <BriefRow label="Text i bild" value={primary.imageBrief.textOverlay} />}
          {primary.imageBrief.avoid.length > 0 && <BriefRow label="Undvik" value={primary.imageBrief.avoid.join(", ")} />}
        </div>
      </section>

      {/* Kvalitetsstatus — status + motivering är primärt, poängtalet sekundärt */}
      <section style={{ marginTop: 30 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          <SectionLabel>Kvalitetskontroll</SectionLabel>
          <StatusBadge status={result.qualityReview.userStatus} />
          <span style={{ fontFamily: fontSans, fontSize: "0.7rem", color: T.text4 }}>internt {result.qualityReview.overallScore}/100</span>
        </div>
        {result.qualityReview.statusReason && (
          <p style={{ fontFamily: fontSans, fontSize: "0.82rem", fontWeight: 300, color: T.text2, lineHeight: 1.6, margin: "10px 0 0", maxWidth: 620 }}>{result.qualityReview.statusReason}</p>
        )}
        <div style={{ marginTop: 14, display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 6 }}>
          {(Object.keys(CHECK_LABELS) as (keyof FacebookQualityChecks)[]).map((k) => {
            const ok = result.qualityReview.checks[k];
            return (
              <div key={k} style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 10px", borderRadius: 9, background: T.surface }}>
                <span style={{ color: ok ? T.green : T.orange, display: "flex" }}>{ok ? <IconCheck size={14} /> : <IconX size={14} />}</span>
                <span style={{ fontFamily: fontSans, fontSize: "0.8rem", fontWeight: 300, color: ok ? T.text2 : T.text3 }}>{CHECK_LABELS[k]}</span>
              </div>
            );
          })}
        </div>
        {result.qualityReview.issues.length > 0 && (
          <ul style={{ margin: "12px 0 0", paddingLeft: 18, fontFamily: fontSans, fontSize: "0.82rem", fontWeight: 300, color: T.text3, lineHeight: 1.7 }}>
            {result.qualityReview.issues.map((it, i) => <li key={i}>{it}</li>)}
          </ul>
        )}
        {result.qualityReview.revisionSummary && (
          <p style={{ marginTop: 10, fontFamily: fontSans, fontSize: "0.8rem", fontWeight: 300, color: T.text4, lineHeight: 1.6 }}>{result.qualityReview.revisionSummary}</p>
        )}
      </section>

      {/* Antaganden & luckor */}
      {(result.assumptions.length > 0 || result.missingInformation.length > 0) && (
        <section style={{ marginTop: 30 }}>
          {result.assumptions.length > 0 && (
            <div style={{ marginBottom: 14 }}>
              <SectionLabel>Antaganden</SectionLabel>
              <ul style={{ margin: "10px 0 0", paddingLeft: 18, fontFamily: fontSans, fontSize: "0.82rem", fontWeight: 300, color: T.text3, lineHeight: 1.7 }}>
                {result.assumptions.map((a, i) => <li key={i}>{a}</li>)}
              </ul>
            </div>
          )}
          {result.missingInformation.length > 0 && (
            <div>
              <SectionLabel>Skulle höjt kvaliteten</SectionLabel>
              <ul style={{ margin: "10px 0 0", paddingLeft: 18, fontFamily: fontSans, fontSize: "0.82rem", fontWeight: 300, color: T.text3, lineHeight: 1.7 }}>
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
    <div style={{ display: "flex", gap: 12 }}>
      <span style={{ flexShrink: 0, width: 96, fontFamily: fontSans, fontSize: "0.72rem", fontWeight: 500, letterSpacing: "0.06em", textTransform: "uppercase", color: T.text4, paddingTop: 2 }}>{label}</span>
      <span style={{ fontFamily: fontSans, fontSize: "0.86rem", fontWeight: 300, color: T.text2, lineHeight: 1.6 }}>{value}</span>
    </div>
  );
}

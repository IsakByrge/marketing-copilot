"use client";

// ─────────────────────────────────────────────────────────────
// Kampanjstrategi (rutten heter fortfarande /campaign-builder).
// Fyra tydliga faser — inte ett långt formulär, inte en falsk chatt:
//   1. Kort underlag (kompakt formulär, förifyllt ur Company Brain)
//   2. Analys (server gör en strukturerad analys)
//   3. 0–4 adaptiva följdfrågor (endast beslutspåverkande, rätt widget)
//   4. Rekommendation (beslut och affärsnytta först)
// Strategin sparas som StrategyV2 och kan öppnas direkt i Facebook
// Specialist via ett riktigt strategi-id.
//
// Sidan är flyttad från inline-stilar och themeLight till primitives.
// Ingen affärslogik, inga texter och ingen fältordning är ändrad — bara
// hur det ritas. Sidan hade 75 style-block och sin egen uppsättning av
// knappar, chips och fält, vilket är hur den hann glida ifrån resten av
// appen i typsnittsvikt, etikettstil och träffytor.
// ─────────────────────────────────────────────────────────────
import { useMemo, useRef, useState } from "react";
import AppShell from "@/app/_shared/AppShell";
import { useCompanyBrain } from "@/app/_shared/useCompanyBrain";
import { tillgangligaOrter } from "@/app/_shared/locations";
import {
  Alert, Button, ButtonLink, Card, EmptyState, Input, ToggleChip, cx,
  selectedSurface, selectableSurface,
} from "@/app/_shared/primitives";
import { Textarea } from "@/app/_shared/Textarea";
import { IconBuilder } from "@/app/_shared/icons";
import { STRATEGIST_GOALS } from "@/lib/strategist/goals";
import { saveStrategyV2 } from "@/lib/campaignStrategyStore";
import { MakeCampaignSheet } from "@/app/campaigns/_components/MakeCampaignSheet";
import type {
  StrategistBrief, StrategyAnalysis, FollowUpQuestion, FollowUpAnswer, StrategyV2,
} from "@/lib/strategist/types";
import type { CampaignGoal } from "@/app/campaign-builder/types";

type Phase = "brief" | "analyzing" | "questions" | "recommending" | "result";
/** Var den sparade strategin befinner sig. En kampanj kan bara skapas ur ett riktigt, sparat id. */
type SaveState = "idle" | "saving" | "saved" | "failed";

/* ── Nätverk ─────────────────────────────────────────────────── */
async function postJson<T>(url: string, body: unknown): Promise<T> {
  const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || data?.status === "error") throw new Error(data?.error || "Något gick fel.");
  return data as T;
}

/* ── Små byggstenar ──────────────────────────────────────────── */

/** Fältetikett. Gemener och halvfet, som i resten av appen — tidigare
 *  spärrade versaler, vilket bara den här sidan och Facebook gjorde. */
function Label({ children, optional }: { children: React.ReactNode; optional?: boolean }) {
  return (
    <p className="mb-2 flex items-baseline gap-2 font-sans text-sm font-medium text-text-primary">
      {children}
      {optional && <span className="font-normal text-text-tertiary">— valfritt</span>}
    </p>
  );
}

/** Sektionsetikett inuti ett kort. Versaler här är kvar med flit: det är
 *  samma mönster som Idag, Innehåll och Historik använder. */
function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="mb-2 text-xs font-semibold uppercase tracking-[0.12em] text-text-tertiary">
      {children}
    </p>
  );
}

/* ── Fasindikator ────────────────────────────────────────────── */
const PHASE_STEPS: { key: Phase[]; label: string }[] = [
  { key: ["brief"], label: "Underlag" },
  { key: ["analyzing"], label: "Analys" },
  { key: ["questions"], label: "Frågor" },
  { key: ["recommending", "result"], label: "Rekommendation" },
];
function PhaseIndicator({ phase }: { phase: Phase }) {
  const activeIdx = PHASE_STEPS.findIndex((s) => s.key.includes(phase));
  return (
    <ol className="mb-8 flex flex-wrap gap-2">
      {PHASE_STEPS.map((s, i) => {
        const done = i < activeIdx, active = i === activeIdx;
        return (
          <li
            key={s.label}
            aria-current={active ? "step" : undefined}
            className={cx(
              "flex items-center gap-2 rounded-full border px-3 py-1.5",
              active ? "border-primary/30 bg-primary/10" : "border-border",
              !done && !active && "opacity-45",
            )}
          >
            <span
              aria-hidden
              className={cx(
                "flex h-[18px] w-[18px] items-center justify-center rounded-full border text-xs font-semibold text-primary",
                done ? "border-primary/30 bg-primary/10" : active ? "border-primary/30" : "border-border-strong",
              )}
            >
              {done ? "✓" : i + 1}
            </span>
            <span className={cx("text-xs", active ? "font-medium text-text-primary" : "text-text-tertiary")}>
              {s.label}
            </span>
          </li>
        );
      })}
    </ol>
  );
}

/* ═══════════════════════════════════════════════════════════════ */
export default function MarketingStrategistPage() {
  const { brain, loaded, hasCompany, companyName } = useCompanyBrain();

  const [phase, setPhase] = useState<Phase>("brief");
  const [error, setError] = useState("");
  const runningRef = useRef(false);

  // Brief
  const [product, setProduct] = useState("");
  const [goalKey, setGoalKey] = useState<CampaignGoal | "">("");
  const [offer, setOffer] = useState("");
  const [periodStart, setPeriodStart] = useState("");
  const [periodEnd, setPeriodEnd] = useState("");
  const [geo, setGeo] = useState("");
  const [notes, setNotes] = useState("");

  // Analys + frågor + svar + strategi
  const [analysis, setAnalysis] = useState<StrategyAnalysis | null>(null);
  const [questions, setQuestions] = useState<FollowUpQuestion[]>([]);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [strategy, setStrategy] = useState<StrategyV2 | null>(null);
  const [savedStrategyId, setSavedStrategyId] = useState<string | null>(null);
  const [saveState, setSaveState] = useState<SaveState>("idle");
  // Varje ny rekommendation sparas som en ny rad. Räknaren ser till att ett
  // sent svar från en tidigare sparning aldrig skriver över det senaste id:t.
  const saveSeq = useRef(0);

  const goalTitle = useMemo(() => STRATEGIST_GOALS.find((g) => g.id === goalKey)?.title ?? "", [goalKey]);
  const canSubmitBrief = product.trim().length > 1 && !!goalKey;

  function buildBrief(): StrategistBrief {
    return {
      product: product.trim(),
      goalKey: goalKey as CampaignGoal,
      goalTitle,
      offer: offer.trim() || undefined,
      period: periodStart || periodEnd ? { start: periodStart || undefined, end: periodEnd || undefined } : undefined,
      geographicArea: geo.trim() || undefined,
      additionalContext: notes.trim() || undefined,
    };
  }

  async function runRecommend(brief: StrategistBrief, ans: FollowUpAnswer[], prior: StrategyAnalysis | null) {
    setPhase("recommending");
    try {
      const data = await postJson<{ strategy: StrategyV2 }>("/api/strategist/recommend", { brief, answers: ans, analysis: prior });
      setStrategy(data.strategy);
      setPhase("result");
      // Spara best-effort → strategi-id för direktflödet till Facebook Specialist.
      const seq = ++saveSeq.current;
      setSavedStrategyId(null);
      setSaveState("saving");
      saveStrategyV2(data.strategy).then((id) => {
        if (seq !== saveSeq.current) return;
        setSavedStrategyId(id);
        setSaveState(id ? "saved" : "failed");
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Kunde inte skapa strategin.");
      setPhase("questions");
    }
  }

  async function startAnalysis() {
    if (runningRef.current || !canSubmitBrief) return;
    runningRef.current = true;
    setError("");
    setPhase("analyzing");
    const brief = buildBrief();
    try {
      const data = await postJson<{ analysis: StrategyAnalysis; followUpQuestions: FollowUpQuestion[] }>("/api/strategist/analyze", brief);
      setAnalysis(data.analysis);
      setQuestions(data.followUpQuestions);
      setAnswers({});
      if (data.followUpQuestions.length === 0) {
        await runRecommend(brief, [], data.analysis);
      } else {
        setPhase("questions");
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Analysen kunde inte köras.");
      setPhase("brief");
    } finally {
      runningRef.current = false;
    }
  }

  function submitAnswers() {
    const ans: FollowUpAnswer[] = questions
      .map((q) => ({ questionId: q.id, question: q.question, answer: (answers[q.id] ?? "").trim(), relatedField: q.relatedField }))
      .filter((a) => a.answer.length > 0);
    void runRecommend(buildBrief(), ans, analysis);
  }

  function reset() {
    setPhase("brief"); setAnalysis(null); setQuestions([]); setAnswers({}); setStrategy(null); setSavedStrategyId(null); setSaveState("idle"); saveSeq.current++; setError("");
  }

  /* ── Tomläge: ingen företagsprofil ─────────────────────────── */
  if (loaded && !hasCompany) {
    return (
      <AppShell>
        <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-10 lg:py-12">
          <Header companyName="" />
          <EmptyState
            icon={<IconBuilder size={19} />}
            title="Ingen företagskunskap ännu."
            body="Strategin blir vassare med en företagsprofil, men du kan börja ändå."
            action={<ButtonLink href="/onboarding">Starta onboarding</ButtonLink>}
          />
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-10 lg:py-12">
        <Header companyName={companyName} />
        <PhaseIndicator phase={phase} />
        {error && phase !== "analyzing" && phase !== "recommending" && (
          <Alert tone="danger" title="Det gick inte" className="mb-5">{error}</Alert>
        )}

        {phase === "brief" && (
          <BriefForm
            brain={brain}
            product={product} setProduct={setProduct}
            goalKey={goalKey} setGoalKey={setGoalKey}
            offer={offer} setOffer={setOffer}
            periodStart={periodStart} setPeriodStart={setPeriodStart}
            periodEnd={periodEnd} setPeriodEnd={setPeriodEnd}
            geo={geo} setGeo={setGeo}
            notes={notes} setNotes={setNotes}
            canSubmit={canSubmitBrief} onSubmit={startAnalysis}
          />
        )}

        {phase === "analyzing" && <AnalyzingPanel title="Analyserar underlaget" />}
        {phase === "recommending" && <AnalyzingPanel title="Formar rekommendationen" />}

        {phase === "questions" && (
          <QuestionsView
            analysis={analysis} questions={questions} answers={answers} setAnswers={setAnswers}
            onBack={() => setPhase("brief")} onSubmit={submitAnswers}
          />
        )}

        {phase === "result" && strategy && (
          <ResultView strategy={strategy} savedStrategyId={savedStrategyId} saveState={saveState} onAdjust={() => setPhase(questions.length ? "questions" : "brief")} onRestart={reset} />
        )}
      </div>
    </AppShell>
  );
}

function Header({ companyName }: { companyName: string }) {
  return (
    <header className="mb-8">
      <p className="text-xs font-semibold uppercase tracking-[0.12em] text-text-tertiary">
        {companyName ? `${companyName} · Kampanjstrategi` : "Kampanjstrategi"}
      </p>
      <h1 className="mt-3 text-[clamp(1.5rem,3.2vw,1.85rem)] font-semibold leading-[1.25] tracking-tight">
        Tänk igenom kampanjen först.
      </h1>
      <p className="mt-3 max-w-xl text-[15px] leading-relaxed text-text-secondary">
        Ge ett kort underlag. Det vägs mot din företagskunskap, du får bara de frågor
        som faktiskt påverkar valet — och sedan en rekommenderad riktning.
      </p>
    </header>
  );
}

/* ── Fas 1: brief ────────────────────────────────────────────── */
function BriefForm(p: {
  brain: ReturnType<typeof useCompanyBrain>["brain"];
  product: string; setProduct: (v: string) => void;
  goalKey: CampaignGoal | ""; setGoalKey: (v: CampaignGoal) => void;
  offer: string; setOffer: (v: string) => void;
  periodStart: string; setPeriodStart: (v: string) => void;
  periodEnd: string; setPeriodEnd: (v: string) => void;
  geo: string; setGeo: (v: string) => void;
  notes: string; setNotes: (v: string) => void;
  canSubmit: boolean; onSubmit: () => void;
}) {
  const products = p.brain.products ?? [];

  // Platshallarna var hardkodade gasolexempel - "Gasolbyte infor
  // grillsasongen", "Fyll gasolflaskan". For ett bemanningsforetag ar det
  // en gissning om fel bransch, och en platshallare som gissar fel ar
  // samre an ingen alls. Harled dem ur foretagsdatan nar den racker till,
  // annars branschneutralt. Ingen paahittad data: bara det anvandaren
  // sjalv skrivit in.
  const orter = tillgangligaOrter(p.brain.locations, p.brain.companySummary);
  const produktExempel = products[0]?.name
    ? `t.ex. ${products[0].name}`
    : "t.ex. produkten eller tjänsten du vill lyfta";
  const ortExempel = orter[0]
    ? `t.ex. ${orter[0]} med omnejd`
    : "t.ex. orten ni finns på, med omnejd";
  return (
    <div className="flex flex-col gap-8">
      <section>
        <Label>Vad vill du marknadsföra?</Label>
        <Input value={p.product} onChange={(e) => p.setProduct(e.target.value)} placeholder={produktExempel} />
        {products.length > 0 && (
          <div className="mt-2.5 flex flex-wrap items-center gap-2">
            <span className="text-xs text-text-tertiary">Ur företagskunskapen:</span>
            {products.slice(0, 6).map((pr) => (
              <ToggleChip key={pr.id} onClick={() => p.setProduct(pr.name)}>{pr.name}</ToggleChip>
            ))}
          </div>
        )}
      </section>

      <section>
        <Label>Vad vill du uppnå?</Label>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {STRATEGIST_GOALS.map((g) => {
            const active = p.goalKey === g.id;
            return (
              <button
                key={g.id}
                type="button"
                onClick={() => p.setGoalKey(g.id)}
                aria-pressed={active}
                className={cx(
                  "cursor-pointer rounded-lg border px-3.5 py-3 text-left transition-colors",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2 focus-visible:ring-offset-background",
                  active ? selectedSurface : selectableSurface,
                )}
              >
                <span className={cx("block text-sm font-medium", active ? "text-text-primary" : "text-text-secondary")}>
                  {g.title}
                </span>
                <span className="mt-0.5 block text-xs text-text-tertiary">{g.hint}</span>
              </button>
            );
          })}
        </div>
      </section>

      <section>
        <Label optional>Finns ett konkret erbjudande?</Label>
        <Input value={p.offer} onChange={(e) => p.setOffer(e.target.value)} placeholder="t.ex. ett erbjudande som gäller under perioden" />
      </section>

      <div className="grid gap-4 sm:grid-cols-2">
        <section>
          <Label optional>Period — från</Label>
          <Input type="date" value={p.periodStart} onChange={(e) => p.setPeriodStart(e.target.value)} />
        </section>
        <section>
          <Label optional>Period — till</Label>
          <Input type="date" value={p.periodEnd} onChange={(e) => p.setPeriodEnd(e.target.value)} />
        </section>
      </div>

      <section>
        <Label optional>Geografiskt område</Label>
        <Input value={p.geo} onChange={(e) => p.setGeo(e.target.value)} placeholder={ortExempel} />
      </section>

      <section>
        <Label optional>Något särskilt att ta hänsyn till?</Label>
        <Textarea value={p.notes} onChange={(e) => p.setNotes(e.target.value)} rows={2} placeholder="t.ex. vi vill inte rabattera, konkurrent öppnade nyligen…" />
      </section>

      <div className="flex flex-wrap items-center gap-3">
        <Button onClick={p.onSubmit} disabled={!p.canSubmit}>Analysera underlaget</Button>
        <span className="text-xs text-text-tertiary">
          Vad du vill marknadsföra och vad du vill uppnå räcker för att börja.
        </span>
      </div>
    </div>
  );
}

/* ── Fas 2/rekommendation: arbetsindikator (ärlig, inga fejkade steg) ── */
function AnalyzingPanel({ title }: { title: string }) {
  const dims = ["Läser företagskunskap", "Bedömer erbjudandet", "Prioriterar målgrupp", "Väger produkt och köpbeteende", "Identifierar risker", "Tar fram rekommendation"];
  return (
    <div className="fade-up max-w-md pt-2">
      <div className="mb-5 flex items-center gap-2.5">
        {/* pulseDot ligger i globals.css och neutraliseras av
            prefers-reduced-motion-blocket dar. */}
        <span aria-hidden className="h-2 w-2 rounded-full bg-primary" style={{ animation: "pulseDot 1.4s ease infinite" }} />
        <span className="text-xs font-semibold uppercase tracking-[0.12em] text-primary">{title}</span>
      </div>
      <ul className="flex flex-col gap-2">
        {dims.map((d) => (
          <li key={d} className="flex items-center gap-3 text-sm text-text-tertiary">
            <span aria-hidden className="h-[5px] w-[5px] shrink-0 rounded-full bg-border-strong" />
            {d}
          </li>
        ))}
      </ul>
    </div>
  );
}

/* ── Fas 3: följdfrågor ──────────────────────────────────────── */
function QuestionsView({ analysis, questions, answers, setAnswers, onBack, onSubmit }: {
  analysis: StrategyAnalysis | null; questions: FollowUpQuestion[];
  answers: Record<string, string>; setAnswers: (fn: (prev: Record<string, string>) => Record<string, string>) => void;
  onBack: () => void; onSubmit: () => void;
}) {
  const set = (id: string, v: string) => setAnswers((prev) => ({ ...prev, [id]: v }));
  const toggleMulti = (id: string, opt: string) => setAnswers((prev) => {
    const cur = (prev[id] ?? "").split(" | ").filter(Boolean);
    const next = cur.includes(opt) ? cur.filter((x) => x !== opt) : [...cur, opt];
    return { ...prev, [id]: next.join(" | ") };
  });

  return (
    <div className="fade-up flex flex-col gap-5">
      {analysis?.recommendedFocus && (
        <Card padding="sm" className="border-primary/20 bg-primary/5">
          <SectionLabel>Preliminär riktning</SectionLabel>
          <p className="text-lg leading-snug">{analysis.recommendedFocus}</p>
        </Card>
      )}
      <p className="text-sm leading-relaxed text-text-secondary">Några få frågor som faktiskt påverkar strategin:</p>

      {questions.map((q, i) => {
        const val = answers[q.id] ?? "";
        return (
          <Card key={q.id} padding="sm">
            <div className="mb-1.5 flex gap-2.5">
              <span className="shrink-0 text-sm font-medium text-primary">{i + 1}.</span>
              <p className="text-[15px] leading-snug">{q.question}</p>
            </div>
            {q.reason && <p className="mb-3 ml-[22px] text-xs leading-relaxed text-text-tertiary">{q.reason}</p>}
            <div className="ml-[22px]">
              {q.answerType === "text" && (
                <Textarea value={val} onChange={(e) => set(q.id, e.target.value)} rows={2} placeholder="Skriv ditt svar…" />
              )}
              {q.answerType === "single_select" && (
                <div className="flex flex-wrap gap-2">
                  {(q.options ?? []).map((o) => (
                    <ToggleChip key={o} active={val === o} onClick={() => set(q.id, val === o ? "" : o)}>{o}</ToggleChip>
                  ))}
                </div>
              )}
              {q.answerType === "multi_select" && (
                <div className="flex flex-wrap gap-2">
                  {(q.options ?? []).map((o) => (
                    <ToggleChip key={o} active={val.split(" | ").includes(o)} onClick={() => toggleMulti(q.id, o)}>{o}</ToggleChip>
                  ))}
                </div>
              )}
            </div>
          </Card>
        );
      })}

      <div className="flex flex-wrap items-center gap-3">
        <Button onClick={onSubmit}>Skapa strategin</Button>
        <Button variant="secondary" onClick={onBack}>Ändra underlaget</Button>
      </div>
    </div>
  );
}

/* ── Fas 4: rekommendation ───────────────────────────────────── */
function Block({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <Card padding="sm">
      <SectionLabel>{label}</SectionLabel>
      <div className="text-sm leading-relaxed text-text-secondary">{children}</div>
    </Card>
  );
}
function List({ items, muted }: { items: string[]; muted?: boolean }) {
  if (!items.length) return null;
  return (
    <ul className={cx("flex list-disc flex-col gap-1.5 pl-[18px] text-sm leading-relaxed", muted ? "text-text-tertiary" : "text-text-secondary")}>
      {items.map((it, i) => <li key={i}>{it}</li>)}
    </ul>
  );
}

// Här låg CONFIDENCE: chippet "Låg / Medelhög / Hög säkerhet" ur
// analysis.confidence. Det var modellens skattning av sin egen strategi,
// visad som ett mått — precis den förtroendegrad VISION.md förbjuder.
// Fältet ligger kvar i datamodellen och i AI-kontraktet; det renderas
// bara inte. Rekommendationens "Varför" bär beslutet i stället.

function ResultView({ strategy, savedStrategyId, saveState, onAdjust, onRestart }: {
  strategy: StrategyV2; savedStrategyId: string | null; saveState: SaveState; onAdjust: () => void; onRestart: () => void;
}) {
  const [makeCampaign, setMakeCampaign] = useState(false);
  const s = strategy.strategy;
  const a = strategy.analysis;

  // Fällan ska aldrig stå tom: finns inget att visa renderas den inte.
  const harDetaljer =
    Boolean(s.urgency)
    || s.channelPriority.length > 0
    || s.risks.length > 0
    || s.improvementOpportunities.length > 0
    || strategy.companyBrainReferences.length > 0;

  return (
    <div className="fade-up flex flex-col gap-4">
      {/* Beslut först: rekommenderad riktning */}
      <Card className="border-primary/20 bg-primary/5">
        <div className="mb-2.5">
          <SectionLabel>Rekommenderad riktning</SectionLabel>
        </div>
        <p className="text-[clamp(1.25rem,3.4vw,1.6rem)] font-medium leading-[1.3] tracking-tight">
          {a.recommendedFocus}
        </p>
        {a.rationale.length > 0 && (
          <div className="mt-4">
            <SectionLabel>Varför</SectionLabel>
            <List items={a.rationale} />
          </div>
        )}
      </Card>

      {/* Nästa steg — högst upp för snabb åtgärd */}
      <div className="flex flex-wrap items-center gap-2.5">
        {/* Kampanjer → Ny kampanj → strategi → kampanj. Knappen väntar på det
            faktiska sparade id:t; ingen kampanj skapas ur en osparad strategi. */}
        <Button onClick={() => setMakeCampaign(true)} disabled={!savedStrategyId} loading={saveState === "saving"}>
          Gör till kampanj
        </Button>
        <ButtonLink variant="secondary" href={savedStrategyId ? `/content/facebook?strategy=${encodeURIComponent(savedStrategyId)}` : "/content/facebook"}>
          Skapa Facebook-inlägg
        </ButtonLink>
        <Button variant="secondary" onClick={onAdjust}>Justera strategin</Button>
        <Button variant="secondary" onClick={onRestart}>Ny strategi</Button>
      </div>
      {saveState === "failed" && (
        <Alert tone="warning" title="Strategin sparades inte">
          Den kan därför inte bli en kampanj eller väljas i Facebook-flödet. Försök med Justera strategin eller Ny strategi.
        </Alert>
      )}
      {makeCampaign && savedStrategyId && (
        <MakeCampaignSheet strategyId={savedStrategyId} onClose={() => setMakeCampaign(false)} />
      )}

      {/* Kärnan — det man faktiskt arbetar med när strategin ska bli
          innehåll. Fem fält, alltid öppna. */}
      <div className="grid gap-3 sm:grid-cols-2">
        <Block label="Kampanjmål">{s.primaryGoal}</Block>
        <Block label="Primär målgrupp">
          {s.primaryAudience}
          {s.secondaryAudience && <div className="mt-1.5 text-xs text-text-tertiary">Sekundär: {s.secondaryAudience}</div>}
        </Block>
        <Block label="Erbjudande / värdeproposition">
          {s.offer && <div>{s.offer}</div>}
          {s.valueProposition && <div className={s.offer ? "mt-1.5" : undefined}>{s.valueProposition}</div>}
        </Block>
        <Block label="Huvudbudskap">{s.mainMessage}</Block>
        <Block label="Primär CTA">{s.primaryCta}</Block>
      </div>

      {/* Resten av strategin, ett tryck bort. Den stod öppen på samma nivå
          som kärnan, så beslutet drunknade i sitt eget underlag. Native
          <details> som i ReviewPane — ingen ny komponent, inget state.

          s.kpis och s.assumptions renderas inte längre någonstans:
          mätetalen antyder en uppföljning produkten inte gör, antagandena
          är modellens självrapportering. Båda ligger kvar i StrategyCore
          och i AI-kontraktet, orörda. */}
      {harDetaljer && (
        <details className="rounded-lg border border-border bg-surface-sunken">
          <summary className="flex min-h-11 cursor-pointer items-center px-4 text-sm text-text-secondary sm:min-h-0 sm:py-3">
            Visa hela strategin
          </summary>
          <div className="flex flex-col gap-3 border-t border-border p-4">
            {s.urgency && <Block label="Anledning att agera nu">{s.urgency}</Block>}

            {s.channelPriority.length > 0 && (
              <Block label="Rekommenderad kanalordning">
                <div className="flex flex-col gap-2.5">
                  {s.channelPriority.map((c, i) => (
                    <div key={i} className="flex gap-2.5">
                      <span className="shrink-0 text-sm font-semibold text-primary">{i + 1}.</span>
                      <div>
                        <strong className="font-medium capitalize text-text-primary">{c.channel}</strong>
                        <span className="text-text-tertiary"> — {c.reason}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </Block>
            )}

            {s.risks.length > 0 && (
              <Card padding="sm" className="border-warning/20 bg-warning-surface">
                <SectionLabel>Risker &amp; svagheter</SectionLabel>
                <List items={s.risks} />
              </Card>
            )}

            {s.improvementOpportunities.length > 0 && (
              <Block label="Förbättringsmöjligheter"><List items={s.improvementOpportunities} /></Block>
            )}

            {strategy.companyBrainReferences.length > 0 && (
              <p className="text-xs leading-relaxed text-text-tertiary">
                Byggt på företagskunskap: {strategy.companyBrainReferences.join(" · ")}
              </p>
            )}
          </div>
        </details>
      )}
    </div>
  );
}

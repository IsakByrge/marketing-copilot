"use client";

// ─────────────────────────────────────────────────────────────
// Marketing Strategist 2.0 (ligger kvar på /campaign-builder t.v.).
// Fyra tydliga faser — inte ett långt formulär, inte en falsk chatt:
//   1. Kort brief (kompakt formulär, förifyllt ur Company Brain)
//   2. Strategen analyserar (server gör en strukturerad analys)
//   3. 0–4 adaptiva följdfrågor (endast beslutspåverkande, rätt widget)
//   4. Rekommendation (beslut och affärsnytta först)
// Strategin sparas som StrategyV2 och kan öppnas direkt i Facebook
// Specialist via ett riktigt strategi-id.
// ─────────────────────────────────────────────────────────────
import { useMemo, useRef, useState } from "react";
import Link from "next/link";
import Shell from "@/app/_shared/Shell";
import { useCompanyBrain } from "@/app/_shared/useCompanyBrain";
import { STRATEGIST_GOALS } from "@/lib/strategist/goals";
import { saveStrategyV2 } from "@/lib/campaignStrategyStore";
import type {
  StrategistBrief, StrategyAnalysis, FollowUpQuestion, FollowUpAnswer, StrategyV2,
} from "@/lib/strategist/types";
import type { CampaignGoal } from "@/app/campaign-builder/types";

const T = {
  bg: "#0a0a10", surface: "#131319", surface2: "#191921", surfaceHover: "#1e1e27",
  line: "rgba(255,255,255,0.07)", line2: "rgba(255,255,255,0.13)",
  text: "#f5f5f8", text2: "#aeb2c2", text3: "#6f7386", text4: "#4b4e5c",
  gold: "#8b6bf2", goldBright: "#a78bfa", goldDim: "rgba(139,107,242,0.14)", goldBorder: "rgba(139,107,242,0.35)",
  green: "#3ecf8e", greenDim: "rgba(62,207,142,0.13)", orange: "#f0a058", orangeDim: "rgba(240,160,88,0.13)",
  red: "#f0616b", redDim: "rgba(240,97,107,0.13)",
};
const sans = "var(--font-outfit), sans-serif";
const serif = "var(--font-cormorant), serif";

type Phase = "brief" | "analyzing" | "questions" | "recommending" | "result";

/* ── Nätverk ─────────────────────────────────────────────────── */
async function postJson<T>(url: string, body: unknown): Promise<T> {
  const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || data?.status === "error") throw new Error(data?.error || "Något gick fel.");
  return data as T;
}

/* ── Små byggstenar ──────────────────────────────────────────── */
function Label({ children, optional }: { children: React.ReactNode; optional?: boolean }) {
  return (
    <label style={{ display: "flex", alignItems: "baseline", gap: 8, fontFamily: sans, fontSize: "0.68rem", fontWeight: 500, letterSpacing: "0.1em", textTransform: "uppercase", color: T.text3, marginBottom: 9 }}>
      {children}{optional && <span style={{ fontWeight: 300, letterSpacing: "0.02em", textTransform: "none", color: T.text4 }}>— valfritt</span>}
    </label>
  );
}
const fieldStyle: React.CSSProperties = {
  width: "100%", background: T.surface2, border: `1px solid ${T.line2}`, borderRadius: 10,
  padding: "13px 15px", outline: "none", fontSize: "0.92rem", fontWeight: 300, color: T.text, fontFamily: sans, boxSizing: "border-box",
};
function TextInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} style={{ ...fieldStyle, ...props.style }}
    onFocus={(e) => { e.target.style.borderColor = T.gold; e.target.style.boxShadow = `0 0 0 3px ${T.goldDim}`; props.onFocus?.(e); }}
    onBlur={(e) => { e.target.style.borderColor = T.line2; e.target.style.boxShadow = "none"; props.onBlur?.(e); }} />;
}
function TextArea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea {...props} style={{ ...fieldStyle, resize: "vertical", lineHeight: 1.6, minHeight: 84, ...props.style }}
    onFocus={(e) => { e.target.style.borderColor = T.gold; e.target.style.boxShadow = `0 0 0 3px ${T.goldDim}`; props.onFocus?.(e); }}
    onBlur={(e) => { e.target.style.borderColor = T.line2; e.target.style.boxShadow = "none"; props.onBlur?.(e); }} />;
}
function Chip({ label, active, onClick }: { label: string; active?: boolean; onClick?: () => void }) {
  return (
    <button type="button" onClick={onClick} className="mcx-focusable"
      style={{
        fontFamily: sans, fontSize: "0.8rem", fontWeight: active ? 500 : 400, padding: "7px 13px", borderRadius: 999,
        cursor: onClick ? "pointer" : "default", transition: "all .18s",
        border: `1px solid ${active ? T.goldBorder : T.line2}`, background: active ? T.goldDim : "transparent",
        color: active ? T.goldBright : T.text3,
      }}>{label}</button>
  );
}
function PrimaryButton({ children, onClick, href, disabled }: { children: React.ReactNode; onClick?: () => void; href?: string; disabled?: boolean }) {
  const st: React.CSSProperties = {
    display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 9, fontFamily: sans, fontSize: "0.86rem", fontWeight: 500,
    padding: "13px 22px", borderRadius: 10, textDecoration: "none", border: "none",
    background: disabled ? T.surface2 : `linear-gradient(155deg, ${T.gold}, #6f4fe0)`, color: disabled ? T.text4 : "#fff",
    cursor: disabled ? "default" : "pointer", boxShadow: disabled ? "none" : `0 8px 24px -8px ${T.goldBorder}`,
  };
  if (href && !disabled) return <Link href={href} style={st}>{children}</Link>;
  return <button onClick={onClick} disabled={disabled} style={st}>{children}</button>;
}
function GhostButton({ children, onClick }: { children: React.ReactNode; onClick?: () => void }) {
  return <button onClick={onClick} style={{ fontFamily: sans, fontSize: "0.82rem", fontWeight: 400, padding: "12px 20px", borderRadius: 10, background: "transparent", border: `1px solid ${T.line2}`, color: T.text2, cursor: "pointer" }}>{children}</button>;
}
function SectionLabel({ children }: { children: React.ReactNode }) {
  return <div style={{ fontFamily: sans, fontSize: "0.66rem", fontWeight: 500, letterSpacing: "0.12em", textTransform: "uppercase", color: T.goldBright, marginBottom: 8 }}>{children}</div>;
}

/* ── Fasindikator ────────────────────────────────────────────── */
const PHASE_STEPS: { key: Phase[]; label: string }[] = [
  { key: ["brief"], label: "Brief" },
  { key: ["analyzing"], label: "Analys" },
  { key: ["questions"], label: "Frågor" },
  { key: ["recommending", "result"], label: "Rekommendation" },
];
function PhaseIndicator({ phase }: { phase: Phase }) {
  const activeIdx = PHASE_STEPS.findIndex((s) => s.key.includes(phase));
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 32 }}>
      {PHASE_STEPS.map((s, i) => {
        const done = i < activeIdx, active = i === activeIdx;
        return (
          <div key={s.label} style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 12px", borderRadius: 999, background: active ? T.goldDim : "transparent", border: `1px solid ${active ? T.goldBorder : T.line}`, opacity: done || active ? 1 : 0.45 }}>
            <span style={{ width: 18, height: 18, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "0.62rem", fontWeight: 600, background: done ? T.goldDim : "transparent", border: `1px solid ${done || active ? T.goldBorder : T.line2}`, color: T.goldBright }}>{done ? "✓" : i + 1}</span>
            <span style={{ fontFamily: sans, fontSize: "0.76rem", fontWeight: active ? 500 : 400, color: active ? T.text : T.text3 }}>{s.label}</span>
          </div>
        );
      })}
    </div>
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
      saveStrategyV2(data.strategy).then((id) => setSavedStrategyId(id));
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
    setPhase("brief"); setAnalysis(null); setQuestions([]); setAnswers({}); setStrategy(null); setSavedStrategyId(null); setError("");
  }

  /* ── Tomläge: ingen företagsprofil ─────────────────────────── */
  if (loaded && !hasCompany) {
    return (
      <Shell>
        <div style={{ maxWidth: 720, margin: "0 auto", padding: "56px 24px 100px" }}>
          <Header companyName="" />
          <div style={{ padding: "36px 28px", borderRadius: 16, background: T.surface, border: `1px dashed ${T.line2}` }}>
            <p style={{ fontFamily: sans, fontSize: "0.98rem", fontWeight: 500, color: T.text, marginBottom: 8 }}>Ingen företagskunskap ännu.</p>
            <p style={{ fontFamily: sans, fontSize: "0.88rem", fontWeight: 300, color: T.text3, lineHeight: 1.65, marginBottom: 18 }}>Strategen blir vassare med en företagsprofil, men du kan börja ändå.</p>
            <PrimaryButton href="/onboarding">Starta onboarding →</PrimaryButton>
          </div>
        </div>
      </Shell>
    );
  }

  return (
    <Shell>
      <div style={{ maxWidth: 860, margin: "0 auto", padding: "44px 24px 120px" }}>
        <Header companyName={companyName} />
        <PhaseIndicator phase={phase} />
        {error && phase !== "analyzing" && phase !== "recommending" && (
          <div style={{ marginBottom: 20, padding: "12px 16px", borderRadius: 10, background: T.redDim, border: `1px solid ${T.red}44`, fontFamily: sans, fontSize: "0.85rem", fontWeight: 300, color: T.text2 }}>{error}</div>
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

        {phase === "analyzing" && <AnalyzingPanel title="Strategen analyserar ditt underlag" />}
        {phase === "recommending" && <AnalyzingPanel title="Formar rekommendationen" />}

        {phase === "questions" && (
          <QuestionsView
            analysis={analysis} questions={questions} answers={answers} setAnswers={setAnswers}
            onBack={() => setPhase("brief")} onSubmit={submitAnswers}
          />
        )}

        {phase === "result" && strategy && (
          <ResultView strategy={strategy} savedStrategyId={savedStrategyId} onAdjust={() => setPhase(questions.length ? "questions" : "brief")} onRestart={reset} />
        )}
      </div>
    </Shell>
  );
}

function Header({ companyName }: { companyName: string }) {
  return (
    <div style={{ marginBottom: 30 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 9, fontFamily: sans, fontSize: "0.66rem", fontWeight: 500, letterSpacing: "0.14em", textTransform: "uppercase", color: T.goldBright }}>
        <span style={{ width: 16, height: 1, background: T.goldBright, opacity: 0.6 }} />
        {companyName ? `${companyName} · Marketing Strategist` : "Marketing Strategist"}
      </div>
      <h1 style={{ fontFamily: serif, fontWeight: 300, fontSize: "clamp(1.9rem,4vw,2.5rem)", letterSpacing: "-0.01em", color: T.text, margin: "12px 0 8px", lineHeight: 1.08 }}>Låt strategen tänka först.</h1>
      <p style={{ fontFamily: sans, fontSize: "0.92rem", fontWeight: 300, color: T.text3, lineHeight: 1.6, maxWidth: 540 }}>Ge en kort brief. Strategen läser din företagskunskap, analyserar, ställer bara de frågor som spelar roll — och rekommenderar en riktning.</p>
    </div>
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
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 30 }}>
      <section>
        <Label>Vad vill du marknadsföra?</Label>
        <TextInput value={p.product} onChange={(e) => p.setProduct(e.target.value)} placeholder="t.ex. Gasolbyte inför grillsäsongen" />
        {products.length > 0 && (
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 10 }}>
            <span style={{ fontFamily: sans, fontSize: "0.7rem", color: T.text4, alignSelf: "center" }}>Ur Company Brain:</span>
            {products.slice(0, 6).map((pr) => <Chip key={pr.id} label={pr.name} onClick={() => p.setProduct(pr.name)} />)}
          </div>
        )}
      </section>

      <section>
        <Label>Vad vill du uppnå?</Label>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(210px, 1fr))", gap: 8 }}>
          {STRATEGIST_GOALS.map((g) => {
            const active = p.goalKey === g.id;
            return (
              <button key={g.id} type="button" onClick={() => p.setGoalKey(g.id)} aria-pressed={active} className="mcx-focusable"
                style={{ textAlign: "left", padding: "12px 14px", borderRadius: 11, cursor: "pointer", background: active ? T.goldDim : T.surface, border: `1px solid ${active ? T.goldBorder : T.line}` }}>
                <div style={{ fontFamily: sans, fontSize: "0.85rem", fontWeight: 500, color: active ? T.text : T.text2 }}>{g.title}</div>
                <div style={{ fontFamily: sans, fontSize: "0.72rem", fontWeight: 300, color: T.text3, marginTop: 2 }}>{g.hint}</div>
              </button>
            );
          })}
        </div>
      </section>

      <section>
        <Label optional>Finns ett konkret erbjudande?</Label>
        <TextInput value={p.offer} onChange={(e) => p.setOffer(e.target.value)} placeholder="t.ex. Fyll gasolflaskan – vänta medan du handlar" />
      </section>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 16 }}>
        <section>
          <Label optional>Period — från</Label>
          <TextInput type="date" value={p.periodStart} onChange={(e) => p.setPeriodStart(e.target.value)} />
        </section>
        <section>
          <Label optional>Period — till</Label>
          <TextInput type="date" value={p.periodEnd} onChange={(e) => p.setPeriodEnd(e.target.value)} />
        </section>
      </div>

      <section>
        <Label optional>Geografiskt område</Label>
        <TextInput value={p.geo} onChange={(e) => p.setGeo(e.target.value)} placeholder="t.ex. Norrköping med omnejd" />
      </section>

      <section>
        <Label optional>Något särskilt strategen ska ta hänsyn till?</Label>
        <TextArea value={p.notes} onChange={(e) => p.setNotes(e.target.value)} rows={2} placeholder="t.ex. vi vill inte rabattera, konkurrent öppnade nyligen…" />
      </section>

      <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
        <PrimaryButton onClick={p.onSubmit} disabled={!p.canSubmit}>Låt strategen analysera →</PrimaryButton>
        <span style={{ fontFamily: sans, fontSize: "0.76rem", fontWeight: 300, color: T.text4 }}>Produkt och mål räcker för att börja.</span>
      </div>
    </div>
  );
}

/* ── Fas 2/rekommendation: arbetsindikator (ärlig, inga fejkade steg) ── */
function AnalyzingPanel({ title }: { title: string }) {
  const dims = ["Läser företagskunskap", "Bedömer erbjudandet", "Prioriterar målgrupp", "Väger produkt och köpbeteende", "Identifierar risker", "Tar fram rekommendation"];
  return (
    <div className="fade-up" style={{ maxWidth: 460, paddingTop: 8 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 20 }}>
        <span style={{ width: 8, height: 8, borderRadius: "50%", background: T.goldBright, animation: "pulseDot 1.4s ease infinite" }} />
        <span style={{ fontFamily: sans, fontSize: "0.7rem", fontWeight: 500, letterSpacing: "0.14em", textTransform: "uppercase", color: T.goldBright }}>{title}</span>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {dims.map((d) => (
          <div key={d} style={{ display: "flex", alignItems: "center", gap: 12, fontFamily: sans, fontSize: "0.85rem", fontWeight: 300, color: T.text3 }}>
            <span style={{ width: 5, height: 5, borderRadius: "50%", background: T.goldBorder }} />{d}
          </div>
        ))}
      </div>
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
    <div className="fade-up" style={{ display: "flex", flexDirection: "column", gap: 22 }}>
      {analysis?.recommendedFocus && (
        <div style={{ padding: "16px 18px", borderRadius: 14, background: T.goldDim, border: `1px solid ${T.goldBorder}` }}>
          <SectionLabel>Strategens preliminära riktning</SectionLabel>
          <p style={{ fontFamily: serif, fontStyle: "italic", fontSize: "1.15rem", fontWeight: 400, color: T.text, lineHeight: 1.5 }}>{analysis.recommendedFocus}</p>
        </div>
      )}
      <p style={{ fontFamily: sans, fontSize: "0.86rem", fontWeight: 300, color: T.text3, lineHeight: 1.6 }}>Några få frågor som faktiskt påverkar strategin:</p>

      {questions.map((q, i) => {
        const val = answers[q.id] ?? "";
        return (
          <div key={q.id} style={{ padding: "18px 20px", borderRadius: 14, background: T.surface, border: `1px solid ${T.line}` }}>
            <div style={{ display: "flex", gap: 10, marginBottom: 6 }}>
              <span style={{ flexShrink: 0, fontFamily: sans, fontSize: "0.78rem", color: T.goldBright, fontWeight: 500 }}>{i + 1}.</span>
              <p style={{ fontFamily: sans, fontSize: "0.98rem", fontWeight: 400, color: T.text, lineHeight: 1.5 }}>{q.question}</p>
            </div>
            {q.reason && <p style={{ fontFamily: sans, fontSize: "0.76rem", fontWeight: 300, color: T.text3, lineHeight: 1.55, margin: "0 0 12px 22px" }}>{q.reason}</p>}
            <div style={{ marginLeft: 22 }}>
              {q.answerType === "text" && (
                <TextArea value={val} onChange={(e) => set(q.id, e.target.value)} rows={2} placeholder="Skriv ditt svar…" />
              )}
              {q.answerType === "single_select" && (
                <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                  {(q.options ?? []).map((o) => <Chip key={o} label={o} active={val === o} onClick={() => set(q.id, val === o ? "" : o)} />)}
                </div>
              )}
              {q.answerType === "multi_select" && (
                <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                  {(q.options ?? []).map((o) => <Chip key={o} label={o} active={(val.split(" | ")).includes(o)} onClick={() => toggleMulti(q.id, o)} />)}
                </div>
              )}
            </div>
          </div>
        );
      })}

      <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
        <PrimaryButton onClick={onSubmit}>Skapa min strategi →</PrimaryButton>
        <GhostButton onClick={onBack}>← Ändra briefen</GhostButton>
      </div>
    </div>
  );
}

/* ── Fas 4: rekommendation ───────────────────────────────────── */
function Block({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ padding: "16px 18px", borderRadius: 12, background: T.surface, border: `1px solid ${T.line}` }}>
      <SectionLabel>{label}</SectionLabel>
      <div style={{ fontFamily: sans, fontSize: "0.9rem", fontWeight: 300, color: T.text2, lineHeight: 1.6 }}>{children}</div>
    </div>
  );
}
function List({ items, color }: { items: string[]; color?: string }) {
  if (!items.length) return null;
  return (
    <ul style={{ margin: 0, paddingLeft: 18, display: "flex", flexDirection: "column", gap: 6 }}>
      {items.map((it, i) => <li key={i} style={{ fontFamily: sans, fontSize: "0.86rem", fontWeight: 300, color: color ?? T.text2, lineHeight: 1.55 }}>{it}</li>)}
    </ul>
  );
}
const CONFIDENCE = { low: { t: "Låg säkerhet", c: T.orange }, medium: { t: "Medelhög säkerhet", c: T.goldBright }, high: { t: "Hög säkerhet", c: T.green } };

function ResultView({ strategy, savedStrategyId, onAdjust, onRestart }: {
  strategy: StrategyV2; savedStrategyId: string | null; onAdjust: () => void; onRestart: () => void;
}) {
  const s = strategy.strategy;
  const a = strategy.analysis;
  const conf = CONFIDENCE[a.confidence] ?? CONFIDENCE.medium;
  return (
    <div className="fade-up" style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {/* Beslut först: rekommenderad riktning */}
      <div style={{ padding: "22px 22px", borderRadius: 16, background: `linear-gradient(160deg, ${T.goldDim}, ${T.surface})`, border: `1px solid ${T.goldBorder}` }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, flexWrap: "wrap", marginBottom: 10 }}>
          <SectionLabel>Rekommenderad riktning</SectionLabel>
          <span style={{ fontFamily: sans, fontSize: "0.7rem", fontWeight: 500, color: conf.c }}>● {conf.t}</span>
        </div>
        <p style={{ fontFamily: serif, fontWeight: 400, fontSize: "clamp(1.35rem,3.4vw,1.8rem)", lineHeight: 1.28, color: T.text, letterSpacing: "-0.01em" }}>{a.recommendedFocus}</p>
        {a.rationale.length > 0 && (
          <div style={{ marginTop: 16 }}>
            <div style={{ fontFamily: sans, fontSize: "0.66rem", fontWeight: 500, letterSpacing: "0.1em", textTransform: "uppercase", color: T.text3, marginBottom: 8 }}>Varför</div>
            <List items={a.rationale} />
          </div>
        )}
      </div>

      {/* Nästa steg — högst upp för snabb åtgärd */}
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
        {savedStrategyId
          ? <PrimaryButton href={`/content/facebook?strategy=${encodeURIComponent(savedStrategyId)}`}>Skapa Facebook-inlägg →</PrimaryButton>
          : <PrimaryButton href="/content/facebook">Skapa Facebook-inlägg →</PrimaryButton>}
        <GhostButton onClick={onAdjust}>Justera strategin</GhostButton>
        <GhostButton onClick={onRestart}>Ny strategi</GhostButton>
      </div>

      {/* Strukturerad strategi */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 12 }}>
        <Block label="Kampanjmål">{s.primaryGoal}</Block>
        <Block label="Primär målgrupp">
          {s.primaryAudience}
          {s.secondaryAudience && <div style={{ marginTop: 6, fontSize: "0.8rem", color: T.text3 }}>Sekundär: {s.secondaryAudience}</div>}
        </Block>
        <Block label="Erbjudande / värdeproposition">
          {s.offer && <div>{s.offer}</div>}
          {s.valueProposition && <div style={{ marginTop: s.offer ? 6 : 0, color: T.text2 }}>{s.valueProposition}</div>}
        </Block>
        <Block label="Huvudbudskap">{s.mainMessage}</Block>
        <Block label="Primär CTA">{s.primaryCta}</Block>
        {s.urgency && <Block label="Anledning att agera nu">{s.urgency}</Block>}
      </div>

      {s.channelPriority.length > 0 && (
        <Block label="Rekommenderad kanalordning">
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {s.channelPriority.map((c, i) => (
              <div key={i} style={{ display: "flex", gap: 10 }}>
                <span style={{ flexShrink: 0, fontFamily: sans, fontSize: "0.8rem", fontWeight: 600, color: T.goldBright }}>{i + 1}.</span>
                <div><strong style={{ fontWeight: 500, color: T.text, textTransform: "capitalize" }}>{c.channel}</strong><span style={{ color: T.text3 }}> — {c.reason}</span></div>
              </div>
            ))}
          </div>
        </Block>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 12 }}>
        {s.risks.length > 0 && <div style={{ padding: "16px 18px", borderRadius: 12, background: T.orangeDim, border: `1px solid ${T.orange}33` }}><SectionLabel>Risker & svagheter</SectionLabel><List items={s.risks} color={T.text2} /></div>}
        {s.improvementOpportunities.length > 0 && <Block label="Förbättringsmöjligheter"><List items={s.improvementOpportunities} /></Block>}
        {s.kpis.length > 0 && <Block label="Mätetal (KPI)"><List items={s.kpis} /></Block>}
        {s.assumptions.length > 0 && <div style={{ padding: "16px 18px", borderRadius: 12, background: T.surface2, border: `1px solid ${T.line}` }}><SectionLabel>Antaganden</SectionLabel><List items={s.assumptions} color={T.text3} /></div>}
      </div>

      {strategy.companyBrainReferences.length > 0 && (
        <p style={{ fontFamily: sans, fontSize: "0.74rem", fontWeight: 300, color: T.text4, lineHeight: 1.6 }}>
          Byggt på företagskunskap: {strategy.companyBrainReferences.join(" · ")}
        </p>
      )}
    </div>
  );
}

"use client";

// ─────────────────────────────────────────────────────────────
// Marketing Copilot 2.0 — Campaign Builder
// Dynamic Interview Engine: efter varje relevant svar frågar frontend
// /api/campaign-interview vad marknadschefen ska göra härnäst
// (confirm/deepen/challenge/skip/finish). Intervjun är inte längre
// ett förutbestämt manus. Faller tillbaka till ett skriptat läge om
// AI-anropet misslyckas. Ingen kampanjtext genereras här.
// ─────────────────────────────────────────────────────────────
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  buildFieldRegistry, fmtDate, daysBetween, getGoal, GOALS,
  type Ctx, type CompanyLite, type FieldEntry, type NodeKind,
} from "./config";
import {
  EMPTY_BASICS,
  type CampaignBasics, type CampaignBrief, type CampaignGoal, type GoalSpecificAnswers, type YesNo,
} from "./types";
import {
  LIMITS, validateDecision,
  type InterviewDecision, type InterviewField, type InterviewRequest,
} from "./interview";
import {
  ANALYSIS_LIMITS, validateRecommendation,
  type CampaignRecommendation,
} from "./analysis";

const IS_DEV = process.env.NODE_ENV !== "production";

const T = {
  bg: "#2a2f3a", surface: "#323845", surface2: "#3a4050",
  line: "rgba(255,255,255,0.10)", line2: "rgba(255,255,255,0.18)",
  text: "#ffffff", text2: "#cbd5e0", text3: "#a0aec0",
  gold: "#c9a96e", goldDim: "rgba(201,169,110,0.15)", goldBorder: "rgba(201,169,110,0.30)",
};

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/* ── Meddelanden i transkriptet ─────────────────────────────── */
type Msg =
  | { role: "ai"; kind: "prompt" | "reaction" | "note"; text: string; nodeId?: string }
  | { role: "user"; text: string; nodeId: string };

/** Den fråga som just nu ställs (kan komma från registret eller AI:n). */
interface CurrentQuestion {
  targetField: string;
  text: string;
  kind: NodeKind;
  optional?: boolean;
  placeholder?: string;
  suggestions?: string[];
}

/* ── Hooks ──────────────────────────────────────────────────── */
function useIsMobile() {
  const [mobile, setMobile] = useState(false);
  useEffect(() => {
    const check = () => setMobile(window.innerWidth < 640);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);
  return mobile;
}

/* ── Marknadschefens avatar ─────────────────────────────────── */
function Avatar({ dim }: { dim?: boolean }) {
  return (
    <span aria-hidden style={{
      flexShrink: 0, width: 30, height: 30, borderRadius: "50%",
      display: "flex", alignItems: "center", justifyContent: "center",
      border: `1px solid ${T.goldBorder}`, background: T.goldDim,
      opacity: dim ? 0.6 : 1, marginTop: 2,
    }}>
      <span style={{
        fontFamily: "var(--font-cormorant), serif", fontWeight: 500,
        fontSize: "0.9rem", color: T.gold, lineHeight: 1,
      }}>M</span>
    </span>
  );
}

/* ── En AI-bubbla ───────────────────────────────────────────── */
function AiBubble({ text, kind }: { text: string; kind: "prompt" | "reaction" | "note" }) {
  const isPrompt = kind === "prompt";
  return (
    <div style={{ display: "flex", gap: 12, alignItems: "flex-start", animation: "fadeUp .4s ease both" }}>
      <Avatar dim={kind === "reaction"} />
      <p style={{
        maxWidth: 480,
        fontFamily: isPrompt ? "var(--font-cormorant), serif" : "var(--font-outfit), sans-serif",
        fontWeight: 300,
        fontSize: isPrompt ? "1.32rem" : "0.92rem",
        lineHeight: isPrompt ? 1.35 : 1.65,
        letterSpacing: isPrompt ? "-0.01em" : "0",
        color: kind === "reaction" ? T.text3 : T.text,
        paddingTop: isPrompt ? 2 : 4,
      }}>
        {text}
      </p>
    </div>
  );
}

/* ── Användarens svar ───────────────────────────────────────── */
function UserBubble({ text }: { text: string }) {
  return (
    <div style={{ display: "flex", justifyContent: "flex-end", animation: "fadeUp .4s ease both" }}>
      <p style={{
        maxWidth: 440, padding: "11px 18px", borderRadius: "2px",
        background: T.surface, border: `1px solid ${T.line2}`,
        fontFamily: "var(--font-outfit), sans-serif", fontSize: "0.92rem",
        fontWeight: 300, lineHeight: 1.55, color: T.text2, whiteSpace: "pre-line",
      }}>
        {text}
      </p>
    </div>
  );
}

/* ── "Tänker"-indikator ─────────────────────────────────────── */
function Thinking() {
  return (
    <div style={{ display: "flex", gap: 12, alignItems: "center", animation: "fadeIn .3s ease both" }}>
      <Avatar />
      <span style={{ display: "flex", gap: 5, paddingTop: 2 }}>
        {[0, 1, 2].map((i) => (
          <span key={i} style={{
            width: 6, height: 6, borderRadius: "50%", background: T.gold,
            animation: "blink 1.2s ease infinite", animationDelay: `${i * 0.18}s`,
          }} />
        ))}
      </span>
    </div>
  );
}

/* ── Sammanfattning: syntetiserad "förståelse" ──────────────── */
function synthesize(brief: CampaignBrief): { paragraph: string; thoughts: string[] } {
  const { basics, answers } = brief;
  const goalPhrase: Record<CampaignGoal, string> = {
    "sell-product": "sälja mer av",
    "more-quotes": "få fler offertförfrågningar på",
    "store-visits": "få fler att besöka butiken för",
    "fill-slots": "fylla lediga tider för",
    "launch": "lansera",
    "seasonal": "driva en säsongskampanj för",
    "other": "nå ditt mål med",
  };
  const parts: string[] = [];
  const what = basics.product.trim() || "erbjudandet";
  parts.push(`Du vill ${goalPhrase[brief.goal]} ${what}`);
  if (basics.targetAudience.trim()) parts.push(`riktat mot ${basics.targetAudience.trim()}`);
  if (basics.geographicArea.trim()) parts.push(`i ${basics.geographicArea.trim()}`);
  let paragraph = parts.join(" ") + ".";

  const period = basics.startDate || basics.endDate
    ? ` Kampanjen löper ${basics.startDate ? fmtDate(basics.startDate) : "?"}–${basics.endDate ? fmtDate(basics.endDate) : "?"}`
    : "";
  const dur = daysBetween(basics.startDate, basics.endDate);
  const durNote = dur !== null ? (dur <= 7 ? ", ett kort och intensivt fönster." : dur <= 31 ? ", en lagom kampanjlängd." : ", med gott om tid att bygga upp den.") : ".";
  if (period) paragraph += period + durNote;

  // Ett par "första tankar" som antyder att analysen redan börjat.
  const thoughts: string[] = [];
  const a = (id: string) => (answers[id] ?? "").trim();

  if (basics.hasExistingOffer === "ja" && basics.offerContent.trim()) {
    thoughts.push(`Erbjudandet ”${basics.offerContent.trim()}” blir kampanjens nav — allt budskap ska peka mot det.`);
  } else {
    thoughts.push("Vi saknar ännu ett skarpt erbjudande — det är det första jag skulle vilja spika, för det avgör slagkraften.");
  }

  if (basics.availability && /slut|få\b|begränsa|restnot|kö|väntetid/i.test(basics.availability)) {
    thoughts.push("Den begränsade tillgången kan vi vända till en styrka: knapphet skapar brådska helt naturligt.");
  }

  // Målspecifik tanke som refererar till användarens egna svar när det går.
  if (brief.goal === "sell-product" && a("differentiator")) {
    thoughts.push(`Jag lutar redan åt en vinkel byggd på det som skiljer er åt: ”${a("differentiator")}”.`);
  } else if (brief.goal === "more-quotes" && a("barrier")) {
    thoughts.push(`Kampanjens jobb blir att undanröja tröskeln du nämnde: ”${a("barrier")}”.`);
  } else if (brief.goal === "store-visits" && a("reason")) {
    thoughts.push(`Anledningen att besöka er — ”${a("reason")}” — blir den röda tråden i budskapet.`);
  } else if (brief.goal === "launch" && a("whatsNew")) {
    thoughts.push(`Det nya — ”${a("whatsNew")}” — är exakt det vi ska bygga förväntan kring.`);
  } else if (brief.goal === "seasonal" && a("season")) {
    thoughts.push(`Vi tajmar allt mot ”${a("season")}” och slår till precis när behovet vaknar.`);
  } else if (brief.goal === "fill-slots") {
    thoughts.push("Här blir tempo och tydlig tidsgräns viktigast — brådska fyller tider snabbare än rabatt.");
  } else if (brief.goal === "other" && a("action")) {
    thoughts.push(`Allt kokar ner till en tydlig uppmaning: ”${a("action")}”.`);
  }

  return { paragraph, thoughts: thoughts.slice(0, 3) };
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ padding: "18px 0", borderBottom: `1px solid ${T.line}` }}>
      <div style={{ fontSize: "0.61rem", fontWeight: 400, letterSpacing: "0.14em", textTransform: "uppercase", color: T.text3, marginBottom: 7 }}>
        {label}
      </div>
      <p style={{ fontSize: "0.94rem", fontWeight: 300, color: value ? T.text2 : T.text3, lineHeight: 1.7, whiteSpace: "pre-line" }}>
        {value || "—"}
      </p>
    </div>
  );
}

function SummaryView({ brief }: { brief: CampaignBrief }) {
  const cfg = getGoal(brief.goal);
  const { basics, answers } = brief;
  const { paragraph, thoughts } = synthesize(brief);
  const period = basics.startDate || basics.endDate
    ? `${basics.startDate ? fmtDate(basics.startDate) : "?"} → ${basics.endDate ? fmtDate(basics.endDate) : "?"}`
    : "";
  const offer = basics.hasExistingOffer === "ja"
    ? (basics.offerContent || "Ja")
    : basics.hasExistingOffer === "nej" ? "Inget befintligt erbjudande — formas i kampanjen" : "";

  return (
    <div style={{ animation: "fadeUp .5s ease both" }}>
      <div style={{ display: "flex", gap: 12, alignItems: "flex-start", marginBottom: 20 }}>
        <Avatar />
        <h1 style={{
          fontFamily: "var(--font-cormorant), serif", fontWeight: 300,
          fontSize: "clamp(1.9rem,5vw,2.6rem)", lineHeight: 1.05, letterSpacing: "-0.02em",
          color: T.text, paddingTop: 2,
        }}>
          Det här har jag förstått<br /><em style={{ color: T.gold, fontStyle: "italic" }}>om din kampanj.</em>
        </h1>
      </div>

      {/* Syntetiserad förståelse — låter som början på en analys */}
      <p style={{ fontSize: "1.02rem", fontWeight: 300, color: T.text2, lineHeight: 1.75, maxWidth: 520, marginBottom: 28, paddingLeft: 42 }}>
        {paragraph}
      </p>

      {thoughts.length > 0 && (
        <div style={{ paddingLeft: 42, marginBottom: 40, display: "flex", flexDirection: "column", gap: 12 }}>
          <div style={{ fontSize: "0.61rem", fontWeight: 400, letterSpacing: "0.16em", textTransform: "uppercase", color: T.gold }}>
            Mina första tankar
          </div>
          {thoughts.map((t, i) => (
            <div key={i} style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
              <span style={{ color: T.gold, flexShrink: 0, marginTop: 8, width: 5, height: 5, borderRadius: "50%", background: T.gold, display: "block" }} />
              <p style={{ fontSize: "0.9rem", fontWeight: 300, color: T.text2, lineHeight: 1.65 }}>{t}</p>
            </div>
          ))}
        </div>
      )}

      {/* Strukturerad genomgång */}
      <div style={{ borderTop: `1px solid ${T.line}` }}>
        <SummaryRow label="Affärsmål" value={cfg?.title ?? brief.goalTitle} />
        <SummaryRow label="Vad som marknadsförs" value={[basics.product, basics.description].filter(Boolean).join(" — ")} />
        <SummaryRow label="Målgrupp" value={basics.targetAudience} />
        <SummaryRow label="Erbjudande" value={offer} />
        <SummaryRow label="Period" value={period} />
        <SummaryRow label="Geografiskt område" value={basics.geographicArea} />
        {(basics.price || basics.margin || basics.availability) && (
          <SummaryRow label="Villkor" value={[
            basics.price && `Pris: ${basics.price}`,
            basics.margin && `Marginal: ${basics.margin}`,
            basics.availability && `Tillgänglighet: ${basics.availability}`,
          ].filter(Boolean).join("\n")} />
        )}
      </div>

      {cfg && (
        <div style={{ marginTop: 28 }}>
          <div style={{ fontSize: "0.61rem", fontWeight: 400, letterSpacing: "0.16em", textTransform: "uppercase", color: T.text3, marginBottom: 4 }}>
            Vad du berättade
          </div>
          <div style={{ borderTop: `1px solid ${T.line}`, marginTop: 12 }}>
            {cfg.questions.filter((q) => (answers[q.id] ?? "").trim()).map((q) => (
              <SummaryRow key={q.id} label={q.prompt({ record: {}, goal: brief.goal })} value={answers[q.id] ?? ""} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/* ── Utvecklingspanel: rå CampaignBrief (endast dev) ────────── */
function BriefDevPanel({ brief }: { brief: CampaignBrief }) {
  return (
    <div style={{ marginTop: 36, background: "#1f232c", border: `1px solid ${T.line}`, borderRadius: 2, overflow: "hidden", animation: "fadeUp .4s ease both" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "12px 18px", borderBottom: `1px solid ${T.line}`, fontSize: "0.61rem", fontWeight: 400, letterSpacing: "0.14em", textTransform: "uppercase", color: T.text3 }}>
        <span style={{ width: 6, height: 6, borderRadius: "50%", background: T.gold, display: "block" }} />
        Utvecklingspanel · CampaignBrief
      </div>
      <pre style={{ margin: 0, padding: "18px", overflowX: "auto", fontSize: "0.76rem", lineHeight: 1.6, color: T.text2, fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace" }}>
        {JSON.stringify(brief, null, 2)}
      </pre>
    </div>
  );
}

/* ── Debugläge: senaste intervjubeslutet (endast dev) ───────── */
function DecisionDebug({ decision, calls }: { decision: InterviewDecision; calls: number }) {
  const rows: [string, string][] = [
    ["action", decision.action],
    ["reasonCategory", decision.reasonCategory],
    ["targetField", decision.targetField ?? "—"],
    ["canRecommend", String(decision.canRecommend)],
    ["missingCriticalInformation", decision.missingCriticalInformation.join(" · ") || "—"],
    ["ai-anrop", `${calls} / ${LIMITS.MAX_AI_CALLS}`],
  ];
  return (
    <div style={{ marginBottom: 12, background: "#1f232c", border: `1px dashed ${T.line2}`, borderRadius: 2, padding: "10px 14px" }}>
      <div style={{ fontSize: "0.58rem", fontWeight: 400, letterSpacing: "0.16em", textTransform: "uppercase", color: T.gold, marginBottom: 8 }}>
        Debug · Interview Engine (dev)
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "auto 1fr", gap: "3px 14px", fontSize: "0.72rem", fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace" }}>
        {rows.map(([k, v]) => (
          <div key={k} style={{ display: "contents" }}>
            <span style={{ color: T.text3 }}>{k}</span>
            <span style={{ color: T.text2 }}>{v}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ── Diskret felruta (inte tekniskt) ────────────────────────── */
function ErrorNote({ text }: { text: string }) {
  return (
    <div style={{
      marginBottom: 12, padding: "10px 14px", borderRadius: 2,
      background: "rgba(201,169,110,0.06)", border: `1px solid ${T.goldBorder}`,
      fontSize: "0.8rem", fontWeight: 300, color: T.text2, lineHeight: 1.5,
    }}>
      {text}
    </div>
  );
}

/* ── Root ───────────────────────────────────────────────────── */
export default function CampaignBuilderPage() {
  const isMobile = useIsMobile();
  const pad = isMobile ? 20 : 56;

  const [company, setCompany] = useState<CompanyLite | null>(null);
  const [goal, setGoal] = useState<CampaignGoal | null>(null);
  const [record, setRecord] = useState<Record<string, string>>({});
  const [handled, setHandled] = useState<string[]>([]);
  const [history, setHistory] = useState<{ question: string; answer: string }[]>([]);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [current, setCurrent] = useState<CurrentQuestion | null>(null);
  const [phase, setPhase] = useState<"goal" | "interview" | "summary">("goal");
  const [thinking, setThinking] = useState(false);
  const [draft, setDraft] = useState("");
  const [created, setCreated] = useState<CampaignBrief | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [fallbackMode, setFallbackMode] = useState(false);
  const [aiCalls, setAiCalls] = useState(0);
  const [lastDecision, setLastDecision] = useState<InterviewDecision | null>(null);
  const [analysis, setAnalysis] = useState<CampaignRecommendation | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [analysisError, setAnalysisError] = useState<string | null>(null);

  const busy = useRef(false);
  const analysisBusy = useRef(false);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | HTMLTextAreaElement | null>(null);

  // Läs ev. tidigare företagsanalys (read-only) för att kunna föreslå.
  useEffect(() => {
    try {
      const raw = localStorage.getItem("marketing-copilot-company-profile")
        ?? localStorage.getItem("marketing-copilot-company-input");
      if (!raw) return;
      const p = JSON.parse(raw);
      setCompany({
        companyName: p.companyName,
        products: Array.isArray(p.products) ? p.products.filter(Boolean) : [],
        customers: Array.isArray(p.customers) ? p.customers.filter(Boolean) : [],
        bestCustomer: p.bestCustomer,
      });
    } catch { /* ignorera trasig data */ }
  }, []);

  const registry = useMemo(() => buildFieldRegistry(goal), [goal]);
  const registryMap = useMemo(() => new Map(registry.map((e) => [e.key, e])), [registry]);
  const ctx: Ctx = useMemo(() => ({ record, goal, company }), [record, goal, company]);

  // Öppningshälsning + målfrågan.
  useEffect(() => {
    const greeting = company?.companyName
      ? `Hej! Jag är din marknadschef för det här. Vi ska bygga en kampanj för ${company.companyName} — svara som du pratar, så tänker jag med dig.`
      : "Hej! Jag är din marknadschef för det här. Jag ställer några frågor, en i taget — svara som du pratar, så tänker jag med dig.";
    setMessages([
      { role: "ai", kind: "note", text: greeting },
      { role: "ai", kind: "prompt", text: "Först och främst — vad vill du uppnå med den här kampanjen?", nodeId: "goal" },
    ]);
  }, [company]);

  // Autoscroll när transkriptet växer.
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, thinking, phase, analyzing, analysis]);

  // Fokusera inmatningen när en ny fråga väntar.
  useEffect(() => {
    if (phase === "interview" && current && !thinking && current.kind !== "yesno") {
      inputRef.current?.focus();
    }
  }, [current, thinking, phase]);

  const displayValue = useCallback((kind: NodeKind, value: string): string => {
    if (!value.trim()) return "Hoppar över det här";
    if (kind === "yesno") return value === "ja" ? "Ja" : "Nej";
    if (kind === "date") return fmtDate(value);
    return value;
  }, []);

  const push = useCallback((msg: Msg) => setMessages((m) => [...m, msg]), []);

  const questionFrom = useCallback((entry: FieldEntry, rec: Record<string, string>): CurrentQuestion => {
    const c: Ctx = { record: rec, goal, company };
    return {
      targetField: entry.key,
      text: entry.question(c),
      kind: entry.kind,
      optional: entry.optional,
      placeholder: entry.placeholder,
      suggestions: entry.suggestions?.(c).filter(Boolean),
    };
  }, [goal, company]);

  /* Nästa obesvarade, relevanta fält (skriptat läge). */
  const nextField = useCallback((rec: Record<string, string>, done: string[]): FieldEntry | null => {
    const relevant = registry.filter((e) => !e.relevant || e.relevant(rec));
    return relevant.find((e) => !done.includes(e.key)) ?? null;
  }, [registry]);

  /* Skriptad framdrift (används i fallback-läge och som säker väg). */
  const localAdvance = useCallback(async (
    rec: Record<string, string>, done: string[],
    react?: { entry: FieldEntry; value: string },
  ) => {
    if (react) {
      setThinking(true);
      await sleep(500);
      setThinking(false);
      push({ role: "ai", kind: "reaction", text: react.entry.react(react.value, { record: rec, goal, company }), nodeId: react.entry.key });
    }
    const next = nextField(rec, done);
    if (!next) { setPhase("summary"); setCurrent(null); return; }
    setThinking(true);
    await sleep(450);
    setThinking(false);
    const q = questionFrom(next, rec);
    push({ role: "ai", kind: "prompt", text: q.text, nodeId: q.targetField });
    setCurrent(q);
  }, [nextField, questionFrom, push, goal, company]);

  /* ── Målval ───────────────────────────────────────────────── */
  const pickGoal = useCallback(async (goalId: CampaignGoal) => {
    if (busy.current || phase !== "goal") return;
    busy.current = true;
    const cfg = getGoal(goalId);
    // Nollställ allt intervjutillstånd — ett nytt mål får aldrig ärva
    // svar, historik eller följdfrågor från ett tidigare mål.
    setRecord({});
    setHandled([]);
    setHistory([]);
    setAiCalls(0);
    setLastDecision(null);
    setError(null);
    setGoal(goalId);
    setPhase("interview");
    push({ role: "user", text: cfg?.title ?? goalId, nodeId: "goal" });

    setThinking(true);
    await sleep(650);
    setThinking(false);
    push({ role: "ai", kind: "reaction", text: cfg?.intro ?? "Okej — då sätter vi igång.", nodeId: "goal" });

    // Första frågan är alltid det första grundfältet (produkt/tjänst).
    const reg = buildFieldRegistry(goalId);
    const first = reg[0];
    setThinking(true);
    await sleep(500);
    setThinking(false);
    const c: Ctx = { record: {}, goal: goalId, company };
    const q: CurrentQuestion = {
      targetField: first.key, text: first.question(c), kind: first.kind,
      optional: first.optional, placeholder: first.placeholder,
      suggestions: first.suggestions?.(c).filter(Boolean),
    };
    push({ role: "ai", kind: "prompt", text: q.text, nodeId: q.targetField });
    setCurrent(q);
    busy.current = false;
  }, [phase, company, push]);

  /* ── Bygg CampaignBrief ur ett record ─────────────────────── */
  const briefFrom = useCallback((rec: Record<string, string>): CampaignBrief => {
    const b: CampaignBasics = { ...EMPTY_BASICS };
    (Object.keys(EMPTY_BASICS) as (keyof CampaignBasics)[]).forEach((k) => {
      if (k === "hasExistingOffer") b.hasExistingOffer = (rec.hasExistingOffer as YesNo) || "";
      else (b[k] as string) = rec[k] ?? "";
    });
    const cfg = getGoal(goal);
    const answers: GoalSpecificAnswers = {};
    cfg?.questions.forEach((qn) => { answers[qn.id] = rec[`q_${qn.id}`] ?? ""; });
    return { goal: goal as CampaignGoal, goalTitle: cfg?.title ?? "", basics: b, answers, createdAt: new Date().toISOString() };
  }, [goal]);

  /* ── Anropa intervjumotorn ────────────────────────────────── */
  const askEngine = useCallback(async (
    rec: Record<string, string>, done: string[],
    hist: { question: string; answer: string }[],
    lastQuestion: string, lastAnswer: string, callCount: number,
  ): Promise<InterviewDecision> => {
    const relevant = registry.filter((e) => !e.relevant || e.relevant(rec));
    const answeredFields: InterviewField[] = relevant
      .filter((e) => done.includes(e.key))
      .map((e) => ({ key: e.key, label: e.label, value: (rec[e.key] ?? "").slice(0, 200) }));
    const unansweredFields: InterviewField[] = relevant
      .filter((e) => !done.includes(e.key))
      .map((e) => ({ key: e.key, label: e.label }));

    const body: InterviewRequest = {
      goal: goal ?? "",
      goalTitle: getGoal(goal)?.title ?? "",
      company: company ? {
        companyName: company.companyName,
        products: company.products?.slice(0, 6),
        customers: company.customers?.slice(0, 6),
        bestCustomer: company.bestCustomer,
      } : undefined,
      lastQuestion: lastQuestion.slice(0, 300),
      lastAnswer: lastAnswer.slice(0, LIMITS.MAX_ANSWER_LEN),
      history: hist.slice(-LIMITS.MAX_HISTORY),
      answeredFields,
      unansweredFields,
      callCount,
    };

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), LIMITS.TIMEOUT_MS + 3000);
    try {
      const res = await fetch("/api/campaign-interview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        signal: controller.signal,
      });
      if (!res.ok) throw new Error(`status ${res.status}`);
      const data = await res.json();
      const decision = validateDecision(data);
      if (!decision) throw new Error("invalid decision");
      return decision;
    } finally {
      clearTimeout(timer);
    }
  }, [registry, goal, company]);

  /* ── Svara på aktuell fråga ───────────────────────────────── */
  const answer = useCallback(async (rawValue: string) => {
    if (busy.current || phase !== "interview" || !current) return;
    const value = rawValue.trim();
    if (!value && !current.optional) return; // validering: obligatoriskt fält
    busy.current = true;
    setError(null);
    setDraft("");

    const key = current.targetField;
    const question = current.text;
    const nextRecord = { ...record, [key]: value };
    const nextHandled = handled.includes(key) ? handled : [...handled, key];
    const nextHistory = [...history, { question, answer: value }].slice(-LIMITS.MAX_HISTORY - 4);

    setRecord(nextRecord);
    setHandled(nextHandled);
    setHistory(nextHistory);
    push({ role: "user", text: displayValue(current.kind, value), nodeId: key });
    setCurrent(null); // lås inmatning medan beslutet hämtas

    const entry = registryMap.get(key);

    // Fallback-läge: helt lokal framdrift, inga anrop.
    if (fallbackMode) {
      await localAdvance(nextRecord, nextHandled, entry ? { entry, value } : undefined);
      busy.current = false;
      return;
    }

    // Adaptivt läge: fråga motorn.
    setThinking(true);
    try {
      const decision = await askEngine(nextRecord, nextHandled, nextHistory, question, value, aiCalls);
      setThinking(false);
      const nextCalls = aiCalls + 1;
      setAiCalls(nextCalls);
      setLastDecision(decision);
      push({ role: "ai", kind: "reaction", text: decision.response, nodeId: key });

      if (decision.action === "finish" || nextCalls >= LIMITS.MAX_AI_CALLS) {
        await sleep(420);
        setPhase("summary");
        setCurrent(null);
      } else {
        const tField = decision.targetField && decision.targetField.trim()
          ? decision.targetField.trim()
          : `extra_${nextHistory.length}`;
        const known = registryMap.get(tField);
        setThinking(true);
        await sleep(460);
        setThinking(false);
        const c: Ctx = { record: nextRecord, goal, company };
        // Skyddsnät: svarar modellen med en fältnyckel i stället för en
        // fråga används registrets egen frågetext.
        const rawQ = (decision.nextQuestion ?? "").trim();
        const q: CurrentQuestion = {
          targetField: tField,
          text: known && !rawQ.includes(" ") ? known.question(c) : rawQ,
          kind: known?.kind ?? "text",
          optional: known?.optional,
          placeholder: known?.placeholder,
          suggestions: known?.suggestions?.(c).filter(Boolean),
        };
        push({ role: "ai", kind: "prompt", text: q.text, nodeId: q.targetField });
        setCurrent(q);
      }
    } catch {
      // Anropet misslyckades → gå över till skriptat läge och fortsätt.
      setThinking(false);
      setFallbackMode(true);
      setError("Jag tappade uppkopplingen ett ögonblick — men vi behöver inte börja om. Vi fortsätter här.");
      push({ role: "ai", kind: "note", text: "Vi kör vidare med mina planerade frågor så länge — allt du redan berättat finns kvar." });
      await localAdvance(nextRecord, nextHandled);
    } finally {
      // Loading-state får aldrig bli hängande, oavsett kodväg.
      setThinking(false);
      busy.current = false;
    }
  }, [phase, current, record, handled, history, fallbackMode, aiCalls, registryMap, displayValue, push, localAdvance, askEngine, goal, company]);

  /* ── Tillbaka och ändra (från sammanfattningen) ───────────── */
  const editLast = useCallback(() => {
    if (busy.current || handled.length === 0) return;
    const key = handled[handled.length - 1];
    const promptMsg = [...messages].reverse().find((x) => x.role === "ai" && x.kind === "prompt" && x.nodeId === key);
    const entry = registryMap.get(key);

    setMessages((m) => {
      const cut = m.findIndex((x) => x.role === "user" && x.nodeId === key);
      return cut === -1 ? m : m.slice(0, cut);
    });
    setHandled((h) => h.slice(0, -1));
    setHistory((h) => h.slice(0, -1));
    setCreated(null);
    setError(null);
    setAnalysis(null);
    setAnalysisError(null);
    setPhase("interview");
    setDraft(entry && (entry.kind === "date" || entry.kind === "yesno") ? "" : (record[key] ?? ""));
    setCurrent({
      targetField: key,
      text: promptMsg?.text ?? entry?.question(ctx) ?? "Vill du ändra ditt svar?",
      kind: entry?.kind ?? "text",
      optional: entry?.optional,
      placeholder: entry?.placeholder,
      suggestions: entry?.suggestions?.(ctx).filter(Boolean),
    });
  }, [handled, messages, registryMap, record, ctx]);

  /* ── Kör analysen (skapar kampanjrekommendationen) ────────── */
  const runAnalysis = useCallback(async () => {
    if (analysisBusy.current) return; // spärr mot dubbla submissions
    analysisBusy.current = true;
    setAnalyzing(true);
    setAnalysisError(null);

    const brief = briefFrom(record);
    if (IS_DEV) console.log("CampaignBrief", brief);
    setCreated(brief);

    // Klientens absoluta tak — UI:t får aldrig vänta längre än så.
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), ANALYSIS_LIMITS.CLIENT_TIMEOUT_MS);
    try {
      const res = await fetch("/api/campaign-analysis", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(brief),
        signal: controller.signal,
      });
      if (!res.ok) throw new Error(`status ${res.status}`);
      const data = await res.json();
      const rec = validateRecommendation(data);
      if (!rec) throw new Error("invalid recommendation");
      setAnalysis(rec);
    } catch (err) {
      const timedOut = err instanceof DOMException && err.name === "AbortError";
      setAnalysisError(timedOut
        ? "Analysen tog för lång tid den här gången. Allt du berättat finns kvar — försök igen."
        : "Analysen kunde inte slutföras just nu. Allt du berättat finns kvar — försök igen.");
    } finally {
      clearTimeout(timer);
      setAnalyzing(false);
      analysisBusy.current = false;
    }
  }, [briefFrom, record]);

  // Progress (0–1). Adaptivt → uppskattat mot ~8 relevanta frågor.
  const progress = phase === "summary" ? 1
    : phase === "goal" ? 0.04
    : Math.min(handled.length / 8, 0.95);

  const inputLocked = thinking || busy.current || !current;

  return (
    <main style={{ minHeight: "100svh", background: T.bg, display: "flex", flexDirection: "column" }}>
      {/* Nav + progress */}
      <nav style={{
        position: "sticky", top: 0, zIndex: 100,
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: `0 ${pad}px`, height: 56,
        background: "rgba(42,47,58,0.95)", backdropFilter: "blur(20px)",
        borderBottom: `1px solid ${T.line}`,
      }}>
        <Link href="/" style={{ fontFamily: "var(--font-cormorant), serif", fontWeight: 500, fontSize: "1.1rem", letterSpacing: "0.08em", textTransform: "uppercase", color: T.text }}>
          Marketing<span style={{ color: T.gold }}>Copilot</span>
        </Link>
        <span style={{ display: "flex", alignItems: "center", gap: 10, fontSize: "0.66rem", fontWeight: 400, letterSpacing: "0.14em", textTransform: "uppercase", color: T.gold }}>
          <span style={{ width: 5, height: 5, borderRadius: "50%", background: T.gold, animation: phase === "summary" && !analyzing ? "none" : "blink 1.6s ease infinite", display: "block" }} />
          {phase === "summary"
            ? (analyzing ? "Analyserar…" : analysis ? "Analys klar" : "Sammanfattning")
            : fallbackMode ? "Intervju (offline)" : "Intervju"}
        </span>
      </nav>
      <div style={{ height: 2, background: T.line }}>
        <div style={{ height: "100%", width: `${progress * 100}%`, background: T.gold, transition: "width .5s ease", opacity: 0.8 }} />
      </div>

      {/* Transkript */}
      <div ref={scrollRef} style={{ flex: 1, overflowY: "auto" }}>
        <div style={{ maxWidth: 640, margin: "0 auto", padding: `40px ${pad}px 32px`, display: "flex", flexDirection: "column", gap: 22 }}>
          {phase === "summary" ? (
            <>
              <SummaryView brief={briefFrom(record)} />
              {analyzing && (
                <div style={{ display: "flex", gap: 12, alignItems: "center", paddingLeft: 42 }}>
                  <Thinking />
                  <span style={{ fontSize: "0.85rem", fontWeight: 300, color: T.text3 }}>
                    Analyserar underlaget och formar en rekommendation…
                  </span>
                </div>
              )}
              {analysis && <RecommendationView rec={analysis} />}
              {IS_DEV && created && <BriefDevPanel brief={created} />}
            </>
          ) : (
            <>
              {messages.map((m, i) =>
                m.role === "user"
                  ? <UserBubble key={i} text={m.text} />
                  : <AiBubble key={i} text={m.text} kind={m.kind} />
              )}
              {thinking && <Thinking />}
            </>
          )}
        </div>
      </div>

      {/* Komposition / åtgärder */}
      <div style={{
        position: "sticky", bottom: 0, background: "linear-gradient(to top, rgba(42,47,58,1) 70%, rgba(42,47,58,0))",
        borderTop: phase === "summary" ? "none" : `1px solid ${T.line}`,
      }}>
        <div style={{ maxWidth: 640, margin: "0 auto", padding: `18px ${pad}px 28px` }}>
          {IS_DEV && phase === "interview" && lastDecision && <DecisionDebug decision={lastDecision} calls={aiCalls} />}
          {error && phase !== "summary" && <ErrorNote text={error} />}
          {analysisError && phase === "summary" && !analyzing && <ErrorNote text={analysisError} />}

          {phase === "goal" ? (
            <GoalCards disabled={busy.current || thinking} onPick={pickGoal} isMobile={isMobile} />
          ) : phase === "summary" ? (
            <SummaryActions
              onBack={editLast}
              onAnalyze={runAnalysis}
              analyzing={analyzing}
              done={!!analysis}
              hasError={!!analysisError}
              isMobile={isMobile}
            />
          ) : current ? (
            <Composer
              kind={current.kind}
              placeholder={current.placeholder}
              optional={current.optional}
              suggestions={current.suggestions ?? []}
              draft={draft}
              setDraft={setDraft}
              onSubmit={answer}
              disabled={inputLocked}
              inputRef={inputRef}
              isMobile={isMobile}
            />
          ) : (
            <p style={{ fontSize: "0.8rem", color: T.text3, fontWeight: 300 }}>Ett ögonblick…</p>
          )}
        </div>
      </div>

      <style>{`
        @keyframes fadeUp { from{opacity:0;transform:translateY(10px)} to{opacity:1;transform:translateY(0)} }
        @keyframes fadeIn { from{opacity:0} to{opacity:1} }
        @keyframes blink { 0%,100%{opacity:1} 50%{opacity:.25} }
        input::placeholder, textarea::placeholder { color: #718096; }
        input[type="date"] { color-scheme: dark; }
      `}</style>
    </main>
  );
}

/* ── Målval — kort ──────────────────────────────────────────── */
function GoalCards({ onPick, disabled, isMobile }: {
  onPick: (g: CampaignGoal) => void; disabled: boolean; isMobile: boolean;
}) {
  return (
    <div role="radiogroup" aria-label="Affärsmål" style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: 10, paddingTop: 4 }}>
      {GOALS.map((g) => (
        <button key={g.id} type="button" role="radio" aria-checked={false} disabled={disabled}
          onClick={() => onPick(g.id)}
          style={{
            display: "flex", alignItems: "center", gap: 14, textAlign: "left",
            padding: "14px 16px", borderRadius: 2, cursor: disabled ? "default" : "pointer",
            background: T.surface, border: `1px solid ${T.line}`, transition: "border-color .18s, background .18s",
          }}
          onMouseOver={(e) => { if (!disabled) { e.currentTarget.style.borderColor = T.goldBorder; e.currentTarget.style.background = T.goldDim; } }}
          onMouseOut={(e) => { e.currentTarget.style.borderColor = T.line; e.currentTarget.style.background = T.surface; }}
        >
          <span style={{ flexShrink: 0, width: 38, height: 38, borderRadius: 2, display: "flex", alignItems: "center", justifyContent: "center", color: T.gold, background: "rgba(201,169,110,0.08)" }}>
            {g.icon}
          </span>
          <span style={{ display: "flex", flexDirection: "column", gap: 3, minWidth: 0 }}>
            <span style={{ fontSize: "0.92rem", fontWeight: 400, color: T.text }}>{g.title}</span>
            <span style={{ fontSize: "0.76rem", fontWeight: 300, color: T.text3, lineHeight: 1.4 }}>{g.description}</span>
          </span>
        </button>
      ))}
    </div>
  );
}

/* ── Kompositionsraden (byter form efter frågetyp) ──────────── */
function Composer({ kind, placeholder, optional, draft, setDraft, onSubmit, disabled, suggestions, inputRef, isMobile }: {
  kind: NodeKind;
  placeholder?: string;
  optional?: boolean;
  draft: string;
  setDraft: (v: string) => void;
  onSubmit: (v: string) => void;
  disabled: boolean;
  suggestions: string[];
  inputRef: React.RefObject<HTMLInputElement | HTMLTextAreaElement | null>;
  isMobile: boolean;
}) {
  const canSend = optional || draft.trim() !== "";

  /* Ja / Nej */
  if (kind === "yesno") {
    return (
      <div style={{ display: "flex", gap: 10 }}>
        {(["ja", "nej"] as const).map((v) => (
          <button key={v} type="button" disabled={disabled} onClick={() => onSubmit(v)}
            style={{
              flex: 1, padding: "15px 22px", borderRadius: 2,
              fontFamily: "var(--font-outfit), sans-serif", fontSize: "0.82rem", fontWeight: 400,
              letterSpacing: "0.06em", cursor: disabled ? "default" : "pointer", transition: "all .18s",
              background: "transparent", border: `1px solid ${T.line2}`, color: T.text2,
            }}
            onMouseOver={(e) => { if (!disabled) { e.currentTarget.style.borderColor = T.gold; e.currentTarget.style.color = T.text; } }}
            onMouseOut={(e) => { e.currentTarget.style.borderColor = T.line2; e.currentTarget.style.color = T.text2; }}
          >
            {v === "ja" ? "Ja" : "Nej"}
          </button>
        ))}
      </div>
    );
  }

  /* Text / textarea / datum */
  const isArea = kind === "textarea";
  const baseStyle: React.CSSProperties = {
    width: "100%", background: T.surface2, border: `1px solid ${T.line2}`, borderRadius: 2,
    padding: "13px 15px", outline: "none", fontSize: "0.95rem", fontWeight: 300, color: T.text,
    fontFamily: "var(--font-outfit), sans-serif", transition: "border-color .2s",
  };

  return (
    <div>
      {suggestions.length > 0 && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 12 }}>
          <span style={{ fontSize: "0.68rem", color: T.text3, alignSelf: "center", letterSpacing: "0.04em" }}>Förslag:</span>
          {suggestions.map((s, i) => (
            <button key={i} type="button" disabled={disabled} onClick={() => setDraft(s)}
              style={{
                padding: "6px 13px", borderRadius: 2, background: T.goldDim, border: `1px solid ${T.goldBorder}`,
                color: T.gold, fontSize: "0.78rem", fontWeight: 300, cursor: disabled ? "default" : "pointer",
                fontFamily: "var(--font-outfit), sans-serif",
              }}>
              {s}
            </button>
          ))}
        </div>
      )}

      <div style={{ display: "flex", gap: 10, alignItems: "flex-end" }}>
        {isArea ? (
          <textarea
            ref={inputRef as React.RefObject<HTMLTextAreaElement>}
            value={draft} rows={2} disabled={disabled}
            placeholder={placeholder ?? "Skriv ditt svar…"}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) { e.preventDefault(); if (canSend && !disabled) onSubmit(draft); } }}
            style={{ ...baseStyle, resize: "none", lineHeight: 1.55, minHeight: 52 }}
            onFocus={(e) => (e.target.style.borderColor = T.gold)}
            onBlur={(e) => (e.target.style.borderColor = T.line2)}
          />
        ) : (
          <input
            ref={inputRef as React.RefObject<HTMLInputElement>}
            type={kind === "date" ? "date" : "text"}
            value={draft} disabled={disabled}
            placeholder={placeholder ?? "Skriv ditt svar…"}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); if (canSend && !disabled) onSubmit(draft); } }}
            style={baseStyle}
            onFocus={(e) => (e.target.style.borderColor = T.gold)}
            onBlur={(e) => (e.target.style.borderColor = T.line2)}
          />
        )}
        <button type="button" disabled={disabled || !canSend} onClick={() => onSubmit(draft)}
          aria-label="Skicka svar"
          style={{
            flexShrink: 0, height: 48, padding: "0 22px", borderRadius: 2, border: "none",
            background: (disabled || !canSend) ? T.surface2 : T.gold,
            color: (disabled || !canSend) ? T.text3 : T.bg,
            cursor: (disabled || !canSend) ? "default" : "pointer",
            fontFamily: "var(--font-outfit), sans-serif", fontSize: "0.75rem", fontWeight: 400,
            letterSpacing: "0.1em", textTransform: "uppercase", transition: "all .2s",
          }}>
          Svara →
        </button>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 16, marginTop: 10, minHeight: 20 }}>
        {optional && (
          <button type="button" disabled={disabled} onClick={() => onSubmit("")}
            style={{ background: "none", border: "none", color: T.text3, fontSize: "0.78rem", fontWeight: 300, cursor: disabled ? "default" : "pointer", padding: 0, fontFamily: "var(--font-outfit), sans-serif" }}>
            Hoppa över — vi kan fortsätta ändå
          </button>
        )}
        {isArea && !isMobile && (
          <span style={{ marginLeft: "auto", fontSize: "0.7rem", color: T.text3, opacity: 0.7 }}>⌘/Ctrl + Enter för att svara</span>
        )}
      </div>
    </div>
  );
}

/* ── Marknadschefens rekommendation ─────────────────────────── */
function RecommendationView({ rec }: { rec: CampaignRecommendation }) {
  const sectionLabel: React.CSSProperties = {
    fontSize: "0.61rem", fontWeight: 400, letterSpacing: "0.16em",
    textTransform: "uppercase", color: T.gold, marginBottom: 10,
  };
  return (
    <div style={{ animation: "fadeUp .5s ease both", borderTop: `1px solid ${T.line2}`, paddingTop: 32, display: "flex", flexDirection: "column", gap: 28 }}>
      <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
        <Avatar />
        <h2 style={{
          fontFamily: "var(--font-cormorant), serif", fontWeight: 300,
          fontSize: "clamp(1.6rem,4vw,2.1rem)", lineHeight: 1.15, letterSpacing: "-0.02em",
          color: T.text, paddingTop: 2,
        }}>
          {rec.headline}
        </h2>
      </div>

      <div style={{ paddingLeft: 42 }}>
        <div style={sectionLabel}>Strategi</div>
        <p style={{ fontSize: "0.96rem", fontWeight: 300, color: T.text2, lineHeight: 1.75, maxWidth: 520 }}>{rec.strategy}</p>
      </div>

      <div style={{ paddingLeft: 42 }}>
        <div style={sectionLabel}>Huvudbudskap</div>
        <p style={{
          fontFamily: "var(--font-cormorant), serif", fontStyle: "italic",
          fontSize: "1.25rem", fontWeight: 400, color: T.text, lineHeight: 1.45, maxWidth: 520,
          borderLeft: `2px solid ${T.gold}`, paddingLeft: 16,
        }}>
          {rec.coreMessage}
        </p>
      </div>

      <div style={{ paddingLeft: 42 }}>
        <div style={sectionLabel}>Kanaler</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {rec.channels.map((c, i) => (
            <div key={i} style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
              <span style={{ flexShrink: 0, marginTop: 8, width: 5, height: 5, borderRadius: "50%", background: T.gold, display: "block" }} />
              <p style={{ fontSize: "0.9rem", fontWeight: 300, color: T.text2, lineHeight: 1.65 }}>
                <strong style={{ fontWeight: 400, color: T.text }}>{c.name}</strong> — {c.motivation}
              </p>
            </div>
          ))}
        </div>
      </div>

      <div style={{ paddingLeft: 42 }}>
        <div style={sectionLabel}>Första aktiviteter</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {rec.activities.map((a, i) => (
            <div key={i} style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
              <span style={{ flexShrink: 0, fontSize: "0.78rem", color: T.gold, fontWeight: 400, marginTop: 2, minWidth: 16 }}>{i + 1}.</span>
              <p style={{ fontSize: "0.9rem", fontWeight: 300, color: T.text2, lineHeight: 1.65 }}>{a}</p>
            </div>
          ))}
        </div>
      </div>

      {rec.watchouts.length > 0 && (
        <div style={{ paddingLeft: 42 }}>
          <div style={{ ...sectionLabel, color: T.text3 }}>Att bevaka</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {rec.watchouts.map((w, i) => (
              <p key={i} style={{ fontSize: "0.84rem", fontWeight: 300, color: T.text3, lineHeight: 1.6 }}>· {w}</p>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/* ── Åtgärder på sammanfattningen ───────────────────────────── */
function SummaryActions({ onBack, onAnalyze, analyzing, done, hasError, isMobile }: {
  onBack: () => void; onAnalyze: () => void;
  analyzing: boolean; done: boolean; hasError: boolean; isMobile: boolean;
}) {
  const primaryDisabled = analyzing || done;
  const primaryLabel = analyzing ? "Analyserar…"
    : done ? "✓ Rekommendationen är klar"
    : hasError ? "Försök igen →"
    : "Skapa kampanjrekommendation →";
  return (
    <div style={{ display: "flex", gap: 12, flexDirection: isMobile ? "column-reverse" : "row", alignItems: "center", borderTop: `1px solid ${T.line}`, paddingTop: 20 }}>
      <button type="button" onClick={onBack} disabled={analyzing} style={{
        fontFamily: "var(--font-outfit), sans-serif", fontSize: "0.75rem", fontWeight: 400, letterSpacing: "0.1em",
        textTransform: "uppercase", padding: "13px 26px", borderRadius: 2, border: `1px solid ${T.line2}`,
        background: "transparent", color: T.text3, cursor: analyzing ? "default" : "pointer", transition: "all .2s",
        width: isMobile ? "100%" : "auto", opacity: analyzing ? 0.5 : 1,
      }}
        onMouseOver={(e) => { if (!analyzing) { e.currentTarget.style.borderColor = T.gold; e.currentTarget.style.color = T.text; } }}
        onMouseOut={(e) => { e.currentTarget.style.borderColor = T.line2; e.currentTarget.style.color = T.text3; }}
      >
        Tillbaka och ändra
      </button>
      <button type="button" onClick={onAnalyze} disabled={primaryDisabled} style={{
        fontFamily: "var(--font-outfit), sans-serif", fontSize: "0.78rem", fontWeight: 400, letterSpacing: "0.12em",
        textTransform: "uppercase", padding: "14px 32px", borderRadius: 2, border: "none",
        background: primaryDisabled ? T.surface2 : T.gold, color: primaryDisabled ? T.text3 : T.bg,
        cursor: primaryDisabled ? "default" : "pointer", transition: "all .2s",
        marginLeft: isMobile ? 0 : "auto", width: isMobile ? "100%" : "auto",
      }}>
        {primaryLabel}
      </button>
    </div>
  );
}

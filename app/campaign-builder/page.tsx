"use client";

// ─────────────────────────────────────────────────────────────
// Marketing Copilot 2.0 — Campaign Builder
// En konversation, inte ett formulär. Marknadschefen ställer en fråga
// i taget, reagerar personligt och "tänker" mellan frågorna.
// Ingen AI anropas — upplevelsen är skriptad men kontextberoende.
// ─────────────────────────────────────────────────────────────
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  buildNodes, fmtDate, daysBetween, getGoal, GOALS,
  type Ctx, type CompanyLite, type ConvNode,
} from "./config";
import {
  EMPTY_BASICS,
  type CampaignBasics, type CampaignBrief, type CampaignGoal, type GoalSpecificAnswers, type YesNo,
} from "./types";

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
            {cfg.questions.map((q) => (
              <SummaryRow key={q.id} label={q.prompt({ record: {}, goal: brief.goal })} value={answers[q.id] ?? ""} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/* ── Utvecklingspanel ───────────────────────────────────────── */
function DevPanel({ brief }: { brief: CampaignBrief }) {
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

/* ── Root ───────────────────────────────────────────────────── */
export default function CampaignBuilderPage() {
  const isMobile = useIsMobile();
  const pad = isMobile ? 20 : 56;

  const [company, setCompany] = useState<CompanyLite | null>(null);
  const [goal, setGoal] = useState<CampaignGoal | null>(null);
  const [record, setRecord] = useState<Record<string, string>>({});
  const [messages, setMessages] = useState<Msg[]>([]);
  const [idx, setIdx] = useState(0);
  const [phase, setPhase] = useState<"interview" | "summary">("interview");
  const [thinking, setThinking] = useState(false);
  const [draft, setDraft] = useState("");
  const [created, setCreated] = useState<CampaignBrief | null>(null);

  const busy = useRef(false);
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

  const nodes = useMemo(() => buildNodes(goal, record), [goal, record]);
  const ctx: Ctx = useMemo(() => ({ record, goal, company }), [record, goal, company]);
  const current = nodes[idx];

  // Öppningshälsning + första frågan.
  useEffect(() => {
    const greeting = company?.companyName
      ? `Hej! Jag är din marknadschef för det här. Vi ska bygga en kampanj för ${company.companyName} — svara som du pratar, så tänker jag med dig.`
      : "Hej! Jag är din marknadschef för det här. Jag ställer några frågor, en i taget — svara som du pratar, så tänker jag med dig.";
    setMessages([
      { role: "ai", kind: "note", text: greeting },
      { role: "ai", kind: "prompt", text: buildNodes(null, {})[0].prompt({ record: {}, goal: null, company }), nodeId: "goal" },
    ]);
  }, [company]);

  // Autoscroll när transkriptet växer.
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, thinking, phase]);

  // Fokusera inmatningen när en ny fråga väntar.
  useEffect(() => {
    if (phase === "interview" && !thinking && current?.kind !== "goal" && current?.kind !== "yesno") {
      inputRef.current?.focus();
    }
  }, [idx, thinking, phase, current?.kind]);

  const displayValue = useCallback((node: ConvNode, value: string): string => {
    if (!value.trim()) return "Hoppar över det här";
    if (node.kind === "goal") return getGoal(value as CampaignGoal)?.title ?? value;
    if (node.kind === "yesno") return value === "ja" ? "Ja" : "Nej";
    if (node.kind === "date") return fmtDate(value);
    return value;
  }, []);

  const submit = useCallback(async (rawValue: string) => {
    if (busy.current || phase !== "interview") return;
    const node = current;
    if (!node) return;
    const value = rawValue.trim();
    if (!value && !node.optional && node.kind !== "goal") return; // validering

    busy.current = true;
    setDraft("");

    // Uppdaterade värden att räkna vidare på (undvik stale state).
    const nextGoal = node.kind === "goal" ? (value as CampaignGoal) : goal;
    const nextRecord = { ...record, [node.id]: value };
    const nextCtx: Ctx = { record: nextRecord, goal: nextGoal, company };

    setMessages((m) => [...m, { role: "user", text: displayValue(node, value), nodeId: node.id }]);
    if (node.kind === "goal") setGoal(nextGoal);
    setRecord(nextRecord);

    // Marknadschefen "tänker" och reagerar.
    setThinking(true);
    await sleep(720);
    setThinking(false);
    setMessages((m) => [...m, { role: "ai", kind: "reaction", text: node.react(value, nextCtx), nodeId: node.id }]);

    // Nästa fråga (räknat på uppdaterad nodlista).
    const nextNodes = buildNodes(nextGoal, nextRecord);
    const nextIdx = idx + 1;
    if (nextIdx < nextNodes.length) {
      setThinking(true);
      await sleep(680);
      setThinking(false);
      const nextNode = nextNodes[nextIdx];
      setMessages((m) => [...m, { role: "ai", kind: "prompt", text: nextNode.prompt(nextCtx), nodeId: nextNode.id }]);
      setIdx(nextIdx);
    } else {
      setIdx(nextIdx);
      setPhase("summary");
    }
    busy.current = false;
  }, [current, phase, goal, record, company, idx, displayValue]);

  // Gå tillbaka ett steg och låt användaren ändra sitt svar.
  const stepBack = useCallback(() => {
    if (busy.current) return;
    const targetIdx = phase === "summary" ? nodes.length - 1 : idx - 1;
    if (targetIdx < 0) return;
    const node = nodes[targetIdx];

    setMessages((m) => {
      const cut = m.findIndex((x) => x.role === "user" && x.nodeId === node.id);
      return cut === -1 ? m : m.slice(0, cut); // behåll frågan, ta bort svar + reaktion + ev. nästa fråga
    });
    setDraft(node.kind === "date" || node.kind === "yesno" ? "" : (record[node.id] ?? ""));
    setRecord((r) => { const c = { ...r }; delete c[node.id]; return c; });
    setPhase("interview");
    setCreated(null);
    setIdx(targetIdx);
  }, [phase, nodes, idx, record]);

  /* ── Bygg CampaignBrief ur record ─────────────────────────── */
  const buildBrief = useCallback((): CampaignBrief => {
    const b: CampaignBasics = { ...EMPTY_BASICS };
    (Object.keys(EMPTY_BASICS) as (keyof CampaignBasics)[]).forEach((k) => {
      if (k === "hasExistingOffer") b.hasExistingOffer = (record.hasExistingOffer as YesNo) || "";
      else (b[k] as string) = record[k] ?? "";
    });
    const cfg = getGoal(goal);
    const answers: GoalSpecificAnswers = {};
    cfg?.questions.forEach((qn) => { answers[qn.id] = record[`q_${qn.id}`] ?? ""; });
    return { goal: goal as CampaignGoal, goalTitle: cfg?.title ?? "", basics: b, answers, createdAt: new Date().toISOString() };
  }, [record, goal]);

  const handleCreate = useCallback(() => {
    const brief = buildBrief();
    console.log("CampaignBrief", brief);
    setCreated(brief);
  }, [buildBrief]);

  // Progress (0–1) genom intervjun.
  const totalGuess = goal ? nodes.length : 12;
  const progress = phase === "summary" ? 1 : Math.min(idx / Math.max(totalGuess - 1, 1), 0.96);

  const suggestions = current?.suggestions?.(ctx).filter(Boolean) ?? [];

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
          <span style={{ width: 5, height: 5, borderRadius: "50%", background: T.gold, animation: "blink 1.6s ease infinite", display: "block" }} />
          {phase === "summary" ? "Analys påbörjad" : "Intervju"}
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
              <SummaryView brief={buildBrief()} />
              {created && <DevPanel brief={created} />}
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
          {phase === "summary" ? (
            <SummaryActions onBack={stepBack} onCreate={handleCreate} created={!!created} isMobile={isMobile} />
          ) : current ? (
            <Composer
              node={current}
              draft={draft}
              setDraft={setDraft}
              onSubmit={submit}
              onBack={idx > 0 ? stepBack : undefined}
              disabled={thinking || busy.current}
              suggestions={suggestions}
              inputRef={inputRef}
              isMobile={isMobile}
            />
          ) : null}
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

/* ── Kompositionsraden (byter form efter frågetyp) ──────────── */
function Composer({ node, draft, setDraft, onSubmit, onBack, disabled, suggestions, inputRef, isMobile }: {
  node: ConvNode;
  draft: string;
  setDraft: (v: string) => void;
  onSubmit: (v: string) => void;
  onBack?: () => void;
  disabled: boolean;
  suggestions: string[];
  inputRef: React.RefObject<HTMLInputElement | HTMLTextAreaElement | null>;
  isMobile: boolean;
}) {
  const canSend = node.optional || node.kind === "goal" || draft.trim() !== "";

  /* Målval — kort */
  if (node.kind === "goal") {
    return (
      <div role="radiogroup" aria-label="Affärsmål" style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: 10, paddingTop: 4 }}>
        {GOALS.map((g) => (
          <button key={g.id} type="button" role="radio" aria-checked={false} disabled={disabled}
            onClick={() => onSubmit(g.id)}
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

  /* Ja / Nej */
  if (node.kind === "yesno") {
    return (
      <div>
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
        {onBack && <BackLink onBack={onBack} disabled={disabled} />}
      </div>
    );
  }

  /* Text / textarea / datum */
  const isArea = node.kind === "textarea";
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
            placeholder={node.placeholder ?? "Skriv ditt svar…"}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) { e.preventDefault(); if (canSend) onSubmit(draft); } }}
            style={{ ...baseStyle, resize: "none", lineHeight: 1.55, minHeight: 52 }}
            onFocus={(e) => (e.target.style.borderColor = T.gold)}
            onBlur={(e) => (e.target.style.borderColor = T.line2)}
          />
        ) : (
          <input
            ref={inputRef as React.RefObject<HTMLInputElement>}
            type={node.kind === "date" ? "date" : "text"}
            value={draft} disabled={disabled}
            placeholder={node.placeholder ?? "Skriv ditt svar…"}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); if (canSend) onSubmit(draft); } }}
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
        {onBack && <BackLink onBack={onBack} disabled={disabled} inline />}
        {node.optional && (
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

function BackLink({ onBack, disabled, inline }: { onBack: () => void; disabled: boolean; inline?: boolean }) {
  return (
    <button type="button" disabled={disabled} onClick={onBack}
      style={{
        background: "none", border: "none", color: T.text3, fontSize: "0.78rem", fontWeight: 300,
        cursor: disabled ? "default" : "pointer", padding: 0, marginTop: inline ? 0 : 12,
        fontFamily: "var(--font-outfit), sans-serif",
      }}>
      ← Ändra föregående svar
    </button>
  );
}

/* ── Åtgärder på sammanfattningen ───────────────────────────── */
function SummaryActions({ onBack, onCreate, created, isMobile }: {
  onBack: () => void; onCreate: () => void; created: boolean; isMobile: boolean;
}) {
  return (
    <div style={{ display: "flex", gap: 12, flexDirection: isMobile ? "column-reverse" : "row", alignItems: "center", borderTop: `1px solid ${T.line}`, paddingTop: 20 }}>
      <button type="button" onClick={onBack} style={{
        fontFamily: "var(--font-outfit), sans-serif", fontSize: "0.75rem", fontWeight: 400, letterSpacing: "0.1em",
        textTransform: "uppercase", padding: "13px 26px", borderRadius: 2, border: `1px solid ${T.line2}`,
        background: "transparent", color: T.text3, cursor: "pointer", transition: "all .2s", width: isMobile ? "100%" : "auto",
      }}
        onMouseOver={(e) => { e.currentTarget.style.borderColor = T.gold; e.currentTarget.style.color = T.text; }}
        onMouseOut={(e) => { e.currentTarget.style.borderColor = T.line2; e.currentTarget.style.color = T.text3; }}
      >
        Tillbaka och ändra
      </button>
      <button type="button" onClick={onCreate} style={{
        fontFamily: "var(--font-outfit), sans-serif", fontSize: "0.78rem", fontWeight: 400, letterSpacing: "0.12em",
        textTransform: "uppercase", padding: "14px 32px", borderRadius: 2, border: "none",
        background: T.gold, color: T.bg, cursor: "pointer", transition: "all .2s",
        marginLeft: isMobile ? 0 : "auto", width: isMobile ? "100%" : "auto",
      }}>
        {created ? "✓ Underlaget är klart" : "Skapa kampanjrekommendation →"}
      </button>
    </div>
  );
}

"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";

const T = {
  bg: "#2a2f3a", surface: "#323845", surface2: "#3a4050",
  line: "rgba(255,255,255,0.10)", line2: "rgba(255,255,255,0.18)",
  text: "#ffffff", text2: "#cbd5e0", text3: "#a0aec0",
  gold: "#c9a96e", goldDim: "rgba(201,169,110,0.15)", goldBorder: "rgba(201,169,110,0.30)",
};

type CompanyProfile = {
  companyName: string; industry: string; summary: string;
  customers: string[]; products: string[]; tone: string[];
  strengths: string[]; avoid: string[]; contentGuidelines: string[];
  bestCustomer?: string;
  commonQuestion?: string;
  differentiator?: string;
  recentJob?: string;
  _websiteScraped?: boolean;
};

const STEPS_WITH_WEBSITE = [
  "Läser hemsidan…",
  "Identifierar kunder…",
  "Identifierar tjänster…",
  "Föreslår svar åt dig…",
  "Bygger Company Brain…",
];

const PLAN_STEPS = [
  "Skapar sociala medier…",
  "Skriver nyhetsbrev…",
  "Bygger kampanjförslag…",
  "Identifierar möjligheter…",
];

function StepList({ steps, current }: { steps: string[]; current: number }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
      {steps.map((s, i) => {
        const done = i < current;
        const active = i === current;
        return (
          <div key={i} style={{
            display: "flex", alignItems: "center", gap: 16,
            padding: "13px 18px", borderRadius: 2,
            background: active ? T.goldDim : "transparent",
            border: `1px solid ${active ? T.goldBorder : "transparent"}`,
            opacity: i > current ? .25 : 1,
            transition: "all .35s",
          }}>
            <div style={{
              width: 22, height: 22, borderRadius: 2, flexShrink: 0,
              display: "flex", alignItems: "center", justifyContent: "center",
              background: done ? T.goldDim : "transparent",
              border: `1px solid ${done || active ? T.goldBorder : T.line2}`,
              fontSize: "0.65rem", color: T.gold,
            }}>
              {done ? "✓" : active ? (
                <div style={{ width: 8, height: 8, borderRadius: "50%", border: "1.5px solid rgba(201,169,110,.25)", borderTopColor: T.gold, animation: "spin .7s linear infinite" }} />
              ) : null}
            </div>
            <span style={{ fontSize: "0.88rem", fontWeight: 300, color: done || active ? T.text : T.text3 }}>
              {s}
            </span>
          </div>
        );
      })}
    </div>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div>
      <label style={{ display: "block", fontSize: "0.63rem", fontWeight: 400, letterSpacing: "0.16em", textTransform: "uppercase" as const, color: T.text3, marginBottom: 6 }}>
        {label}
      </label>
      {hint && <p style={{ fontSize: "0.78rem", fontWeight: 300, color: T.text3, lineHeight: 1.6, marginBottom: 10 }}>{hint}</p>}
      {children}
    </div>
  );
}

const inputStyle = {
  width: "100%", background: "transparent", border: "none",
  borderBottom: `1px solid rgba(255,255,255,0.18)`, padding: "10px 0",
  outline: "none", fontSize: "1rem", fontWeight: 300, color: "#ffffff",
  fontFamily: "var(--font-outfit), sans-serif", transition: "border-color .2s",
};

const textareaStyle = {
  ...inputStyle,
  resize: "none" as const, lineHeight: 1.75,
};

function focusGold(e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement>) {
  e.target.style.borderBottomColor = T.gold;
}
function blurLine(e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement>) {
  e.target.style.borderBottomColor = T.line2;
}

/* ── STEG 1: Namn + hemsida ────────────────────────────── */
function StartScreen({ onAnalyze, onManual }: {
  onAnalyze: (name: string, website: string) => void;
  onManual: (name: string) => void;
}) {
  const [name, setName] = useState("");
  const [website, setWebsite] = useState("");
  const [showManual, setShowManual] = useState(false);
  const isMobile = typeof window !== "undefined" && window.innerWidth < 640;

  const canAnalyze = name.trim() && website.trim();
  const canManual = name.trim();

  return (
    <div style={{ animation: "fadeUp .5s ease both" }}>
      <div style={{ marginBottom: 48 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, fontSize: "0.63rem", fontWeight: 400, letterSpacing: "0.18em", textTransform: "uppercase" as const, color: T.gold, marginBottom: 20 }}>
          <span style={{ width: 16, height: 1, background: T.gold, opacity: .5, display: "block" }} />
          Company Brain
        </div>
        <h1 style={{ fontFamily: "var(--font-cormorant), serif", fontWeight: 300, fontSize: isMobile ? "clamp(2.2rem,9vw,3rem)" : "clamp(2.6rem,5vw,3.8rem)", lineHeight: .95, letterSpacing: "-0.02em", color: T.text, marginBottom: 16 }}>
          Låt AI:n lära känna<br /><em style={{ color: T.gold, fontStyle: "italic" }}>ditt företag.</em>
        </h1>
        <p style={{ fontSize: "0.9rem", fontWeight: 300, color: T.text2, lineHeight: 1.75, maxWidth: 440 }}>
          Skriv din hemsida så läser AI:n den och fyller i resten åt dig. Du behöver bara bekräfta.
        </p>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 36, marginBottom: 40 }}>
        <Field label="Företagsnamn">
          <input value={name} onChange={e => setName(e.target.value)}
            placeholder="t.ex. Gasolfyllarna Norrköping"
            style={inputStyle} onFocus={focusGold} onBlur={blurLine}
          />
        </Field>

        {!showManual && (
          <Field label="Hemsida" hint="AI:n läser din hemsida och föreslår svar på alla frågor — du justerar bara.">
            <input value={website} onChange={e => setWebsite(e.target.value)}
              placeholder="t.ex. shop.gasolfyllarna.se"
              style={inputStyle} onFocus={focusGold} onBlur={blurLine}
            />
            {website.trim() && (
              <p style={{ marginTop: 8, fontSize: "0.75rem", color: T.gold, display: "flex", alignItems: "center", gap: 6 }}>
                <span>✓</span> AI:n analyserar din hemsida
              </p>
            )}
          </Field>
        )}
      </div>

      {!showManual ? (
        <>
          <button onClick={() => onAnalyze(name, website)}
            disabled={!canAnalyze} style={{
              fontFamily: "var(--font-outfit), sans-serif", fontSize: "0.78rem", fontWeight: 400,
              letterSpacing: "0.12em", textTransform: "uppercase" as const,
              padding: "14px 32px", borderRadius: 2, border: "none",
              background: canAnalyze ? T.gold : T.surface2,
              color: canAnalyze ? T.bg : T.text3,
              cursor: canAnalyze ? "pointer" : "not-allowed",
              transition: "all .2s", width: isMobile ? "100%" : "auto",
            }}>
            Analysera hemsidan →
          </button>
          <p style={{ marginTop: 24, fontSize: "0.8rem", color: T.text3 }}>
            Ingen hemsida?{" "}
            <button onClick={() => setShowManual(true)} style={{ background: "none", border: "none", color: T.gold, cursor: "pointer", fontSize: "0.8rem", padding: 0, textDecoration: "underline", textUnderlineOffset: 3 }}>
              Fyll i manuellt
            </button>
          </p>
        </>
      ) : (
        <>
          <button onClick={() => onManual(name)}
            disabled={!canManual} style={{
              fontFamily: "var(--font-outfit), sans-serif", fontSize: "0.78rem", fontWeight: 400,
              letterSpacing: "0.12em", textTransform: "uppercase" as const,
              padding: "14px 32px", borderRadius: 2, border: "none",
              background: canManual ? T.gold : T.surface2,
              color: canManual ? T.bg : T.text3,
              cursor: canManual ? "pointer" : "not-allowed",
              transition: "all .2s", width: isMobile ? "100%" : "auto",
            }}>
            Fortsätt manuellt →
          </button>
          <p style={{ marginTop: 24, fontSize: "0.8rem", color: T.text3 }}>
            <button onClick={() => setShowManual(false)} style={{ background: "none", border: "none", color: T.gold, cursor: "pointer", fontSize: "0.8rem", padding: 0, textDecoration: "underline", textUnderlineOffset: 3 }}>
              ← Använd hemsida istället
            </button>
          </p>
        </>
      )}
    </div>
  );
}

/* ── Laddningsskärm under analys ───────────────────────── */
function AnalyzingScreen() {
  const [step, setStep] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setStep(p => Math.min(p + 1, STEPS_WITH_WEBSITE.length - 1)), 700);
    return () => clearInterval(t);
  }, []);
  return (
    <div style={{ animation: "fadeUp .5s ease both" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: "0.63rem", fontWeight: 400, letterSpacing: "0.18em", textTransform: "uppercase" as const, color: T.gold, marginBottom: 24 }}>
        <div style={{ width: 6, height: 6, borderRadius: "50%", background: T.gold, animation: "pulseDot 1.4s ease infinite" }} />
        Läser din hemsida
      </div>
      <h1 style={{ fontFamily: "var(--font-cormorant), serif", fontWeight: 300, fontSize: "clamp(2.2rem,5vw,3.2rem)", lineHeight: .95, letterSpacing: "-0.02em", color: T.text, marginBottom: 16 }}>
        AI:n analyserar<br /><em style={{ color: T.gold, fontStyle: "italic" }}>ditt företag.</em>
      </h1>
      <p style={{ fontSize: "0.88rem", fontWeight: 300, color: T.text2, lineHeight: 1.75, marginBottom: 48, maxWidth: 400 }}>
        AI:n läser din hemsida och föreslår svar åt dig — du behöver bara bekräfta dem på nästa steg.
      </p>
      <StepList steps={STEPS_WITH_WEBSITE} current={step} />
    </div>
  );
}

/* ── STEG 2: Förifyllda fält att bekräfta/justera ──────── */
function ConfirmScreen({ profile, prefilled, onConfirm }: {
  profile: CompanyProfile;
  prefilled: boolean;
  onConfirm: (answers: { bestCustomer: string; commonQuestion: string; differentiator: string; recentJob: string }) => void;
}) {
  const [bestCustomer, setBestCustomer] = useState(profile.bestCustomer || "");
  const [commonQuestion, setCommonQuestion] = useState(profile.commonQuestion || "");
  const [differentiator, setDifferentiator] = useState(profile.differentiator || "");
  const [recentJob, setRecentJob] = useState(profile.recentJob || "");
  const isMobile = typeof window !== "undefined" && window.innerWidth < 640;

  const canSubmit = bestCustomer.trim() && commonQuestion.trim() && differentiator.trim();

  return (
    <div style={{ animation: "fadeUp .5s ease both" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, fontSize: "0.63rem", fontWeight: 400, letterSpacing: "0.18em", textTransform: "uppercase" as const, color: T.gold, marginBottom: 20 }}>
        <span>{prefilled ? "✓" : ""}</span> {prefilled ? "AI:n har fyllt i åt dig" : "Berätta om företaget"}
      </div>

      <h1 style={{ fontFamily: "var(--font-cormorant), serif", fontWeight: 300, fontSize: isMobile ? "clamp(2rem,8vw,2.8rem)" : "clamp(2.4rem,5vw,3.4rem)", lineHeight: .95, letterSpacing: "-0.02em", color: T.text, marginBottom: 16 }}>
        {prefilled ? <>Stämmer det här<br /><em style={{ color: T.gold, fontStyle: "italic" }}>om er?</em></> : <>Fyll i de fyra<br /><em style={{ color: T.gold, fontStyle: "italic" }}>frågorna.</em></>}
      </h1>
      <p style={{ fontSize: "0.9rem", fontWeight: 300, color: T.text2, lineHeight: 1.75, maxWidth: 440, marginBottom: 44 }}>
        {prefilled
          ? "AI:n läste din hemsida och gissade svaren. Läs igenom, ändra det som är fel — det här styr all marknadsföring."
          : "Fyra konkreta frågor. Var specifik — generiska svar ger generisk marknadsföring."}
      </p>

      <div style={{ display: "flex", flexDirection: "column", gap: 36, marginBottom: 48 }}>
        <Field label="Er bästa kund" hint="Vem är de, vad gör de, varför anlitar de er?">
          <textarea value={bestCustomer} onChange={e => setBestCustomer(e.target.value)}
            placeholder="t.ex. Husbilsägare 50–70 år som behöver fylla gastank inför semestern."
            rows={3} style={textareaStyle} onFocus={focusGold} onBlur={blurLine}
          />
        </Field>

        <Field label="Vad frågar folk om mest?" hint="Det avslöjar vad marknadsföringen ska svara på.">
          <textarea value={commonQuestion} onChange={e => setCommonQuestion(e.target.value)}
            placeholder="t.ex. Hur lång tid tar det? Fyller ni alla typer av flaskor?"
            rows={3} style={textareaStyle} onFocus={focusGold} onBlur={blurLine}
          />
        </Field>

        <Field label="Vad skiljer er från konkurrenterna?" hint="Varför väljer kunder er framför någon annan?">
          <textarea value={differentiator} onChange={e => setDifferentiator(e.target.value)}
            placeholder="t.ex. Vi fyller i lösvikt — du betalar bara för det som faktiskt fylls i flaskan."
            rows={3} style={textareaStyle} onFocus={focusGold} onBlur={blurLine}
          />
        </Field>

        <Field label="Ett jobb ni gjort nyligen" hint="Valfritt men kraftfullt — ett konkret exempel ger AI:n verkligt material.">
          <textarea value={recentJob} onChange={e => setRecentJob(e.target.value)}
            placeholder="t.ex. En familj kom in dagen innan semestern — vi fyllde deras 33-liters tank på 20 minuter."
            rows={3} style={textareaStyle} onFocus={focusGold} onBlur={blurLine}
          />
        </Field>
      </div>

      <button onClick={() => onConfirm({ bestCustomer, commonQuestion, differentiator, recentJob })}
        disabled={!canSubmit} style={{
          fontFamily: "var(--font-outfit), sans-serif", fontSize: "0.78rem", fontWeight: 400,
          letterSpacing: "0.12em", textTransform: "uppercase" as const,
          padding: "14px 32px", borderRadius: 2, border: "none",
          background: canSubmit ? T.gold : T.surface2,
          color: canSubmit ? T.bg : T.text3,
          cursor: canSubmit ? "pointer" : "not-allowed",
          transition: "all .2s", width: isMobile ? "100%" : "auto",
        }}>
        Skapa veckoplan →
      </button>
    </div>
  );
}

/* ── Laddningsskärm under plansgenerering ──────────────── */
function GeneratingScreen() {
  const [step, setStep] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setStep(p => Math.min(p + 1, PLAN_STEPS.length - 1)), 950);
    return () => clearInterval(t);
  }, []);
  return (
    <div style={{ animation: "fadeUp .5s ease both" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: "0.63rem", fontWeight: 400, letterSpacing: "0.18em", textTransform: "uppercase" as const, color: T.gold, marginBottom: 24 }}>
        <div style={{ width: 6, height: 6, borderRadius: "50%", background: T.gold, animation: "pulseDot 1.4s ease infinite" }} />
        Genererar veckoplan
      </div>
      <h1 style={{ fontFamily: "var(--font-cormorant), serif", fontWeight: 300, fontSize: "clamp(2.2rem,5vw,3.2rem)", lineHeight: .95, letterSpacing: "-0.02em", color: T.text, marginBottom: 16 }}>
        Bygger din första<br /><em style={{ color: T.gold, fontStyle: "italic" }}>marknadsplan.</em>
      </h1>
      <p style={{ fontSize: "0.88rem", fontWeight: 300, color: T.text2, lineHeight: 1.75, marginBottom: 48, maxWidth: 380 }}>
        AI:n bygger din första marknadsplan baserat på din Company Brain.
      </p>
      <StepList steps={PLAN_STEPS} current={step} />
    </div>
  );
}

export default function OnboardingPage() {
  const router = useRouter();
  const [screen, setScreen] = useState<"start" | "analyzing" | "confirm" | "generating">("start");
  const [profile, setProfile] = useState<CompanyProfile | null>(null);
  const [prefilled, setPrefilled] = useState(false);
  const isMobile = typeof window !== "undefined" && window.innerWidth < 640;
  const pad = isMobile ? 20 : 56;

  // Hemsidevägen: skrapa + föreslå svar, gå sedan till bekräftelse
  async function handleAnalyze(name: string, website: string) {
    setScreen("analyzing");

    const input = { companyName: name, website: website.trim() };

    const [result] = await Promise.all([
      fetch("/api/analyze-company", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      }).then(r => r.json()).catch(() => null),
      new Promise(r => setTimeout(r, 3500)),
    ]);

    const p: CompanyProfile = result || {
      companyName: name, industry: "",
      summary: "", customers: [], products: [], tone: [],
      strengths: [], avoid: [], contentGuidelines: [],
    };
    p.companyName = name;

    // Spara råinput också (hemsida) för framtida bruk
    localStorage.setItem("marketing-copilot-company-input", JSON.stringify({ ...input, ...p }));

    setProfile(p);
    setPrefilled(!!(result && result._websiteScraped));
    setScreen("confirm");
  }

  // Manuell väg: hoppa direkt till tomma fält
  function handleManual(name: string) {
    const p: CompanyProfile = {
      companyName: name, industry: "",
      summary: "", customers: [], products: [], tone: [],
      strengths: [], avoid: [], contentGuidelines: [],
      bestCustomer: "", commonQuestion: "", differentiator: "", recentJob: "",
    };
    setProfile(p);
    setPrefilled(false);
    setScreen("confirm");
  }

  // Steg 2 klart: bygg slutlig profil och generera plan
  async function handleConfirm(answers: { bestCustomer: string; commonQuestion: string; differentiator: string; recentJob: string }) {
    if (!profile) return;
    setScreen("generating");

    // Slå ihop AI-profilen med ägarens (ev. justerade) svar
    const finalProfile: CompanyProfile = {
      ...profile,
      bestCustomer: answers.bestCustomer,
      commonQuestion: answers.commonQuestion,
      differentiator: answers.differentiator,
      recentJob: answers.recentJob,
    };

    // Fyll luckor om AI:n inte gav profilfält (t.ex. manuell väg)
    if (!finalProfile.summary) {
      finalProfile.summary = `${profile.companyName} hjälper sina kunder med professionella tjänster och lösningar.`;
    }
    if (!finalProfile.customers?.length && answers.bestCustomer) {
      finalProfile.customers = [answers.bestCustomer.split(" ").slice(0, 8).join(" ")];
    }
    if (!finalProfile.strengths?.length && answers.differentiator) {
      finalProfile.strengths = [answers.differentiator.split(" ").slice(0, 8).join(" ")];
    }

    localStorage.setItem("marketing-copilot-company-profile", JSON.stringify(finalProfile));

    const [result] = await Promise.all([
      fetch("/api/generate-plan", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ companyProfile: finalProfile }),
      }).then(r => r.json()).catch(() => null),
      new Promise(r => setTimeout(r, 4200)),
    ]);

    if (result) {
      localStorage.setItem("marketing-copilot-plan", JSON.stringify({ id: "ai-generated-plan", ...result }));
    }

    router.push("/dashboard");
  }

  return (
    <main style={{ minHeight: "100svh", background: T.bg }}>
      <nav style={{
        position: "sticky", top: 0, zIndex: 100,
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: `0 ${pad}px`, height: 56,
        background: "rgba(42,47,58,0.95)", backdropFilter: "blur(20px)",
        borderBottom: `1px solid ${T.line}`,
      }}>
        <span style={{ fontFamily: "var(--font-cormorant), serif", fontWeight: 500, fontSize: "1.1rem", letterSpacing: "0.08em", textTransform: "uppercase", color: T.text }}>
          Marketing<span style={{ color: T.gold }}>Copilot</span>
        </span>
        <div style={{ fontSize: "0.68rem", fontWeight: 300, color: screen === "confirm" ? T.gold : T.text3, letterSpacing: "0.04em", display: "flex", alignItems: "center", gap: 6 }}>
          {screen === "start" && "Under 2 minuter"}
          {(screen === "analyzing" || screen === "generating") && <><div style={{ width: 5, height: 5, borderRadius: "50%", background: T.gold, animation: "pulseDot 1.4s ease infinite" }} />Arbetar…</>}
          {screen === "confirm" && <><span>✓</span> Nästan klar</>}
        </div>
      </nav>

      <div style={{ maxWidth: 580, margin: "0 auto", padding: `64px ${pad}px 100px` }}>
        {screen === "start" && <StartScreen onAnalyze={handleAnalyze} onManual={handleManual} />}
        {screen === "analyzing" && <AnalyzingScreen />}
        {screen === "confirm" && profile && <ConfirmScreen profile={profile} prefilled={prefilled} onConfirm={handleConfirm} />}
        {screen === "generating" && <GeneratingScreen />}
      </div>

      <style>{`
        @keyframes fadeUp { from{opacity:0;transform:translateY(14px)} to{opacity:1;transform:translateY(0)} }
        @keyframes spin { to{transform:rotate(360deg)} }
        @keyframes pulseDot { 0%,100%{opacity:1} 50%{opacity:.3} }
        input::placeholder, textarea::placeholder { color: #718096; }
      `}</style>
    </main>
  );
}
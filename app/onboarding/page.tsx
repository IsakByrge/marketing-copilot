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
};

const STEPS_WITH_WEBSITE = [
  "Analyserar hemsida…",
  "Identifierar kunder…",
  "Identifierar produkter och tjänster…",
  "Identifierar tonalitet…",
  "Identifierar styrkor…",
  "Bygger Company Brain…",
];

const STEPS_WITHOUT_WEBSITE = [
  "Analyserar företagsbeskrivning…",
  "Identifierar kunder…",
  "Identifierar produkter och tjänster…",
  "Identifierar tonalitet…",
  "Bygger Company Brain…",
];

const PLAN_STEPS = [
  "Skapar sociala medier…",
  "Skriver nyhetsbrev…",
  "Bygger kampanjförslag…",
  "Identifierar möjligheter…",
];

// ── Shared components ─────────────────────────────────────

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

// ── Screen 1: Input ───────────────────────────────────────
function InputScreen({ onSubmit }: { onSubmit: (name: string, website: string, desc: string) => void }) {
  const [name, setName] = useState("");
  const [website, setWebsite] = useState("");
  const [desc, setDesc] = useState("");
  const isMobile = typeof window !== "undefined" && window.innerWidth < 640;
  const canSubmit = name.trim() && desc.trim();

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
          Svara på några enkla frågor. På mindre än två minuter bygger vi en Company Brain som driver all din marknadsföring.
        </p>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 36, marginBottom: 48 }}>

        {/* Företagsnamn */}
        <div>
          <label style={{ display: "block", fontSize: "0.63rem", fontWeight: 400, letterSpacing: "0.16em", textTransform: "uppercase" as const, color: T.text3, marginBottom: 10 }}>Företagsnamn</label>
          <input value={name} onChange={e => setName(e.target.value)} placeholder="t.ex. Lindqvists VVS"
            style={{ width: "100%", background: "transparent", border: "none", borderBottom: `1px solid ${T.line2}`, padding: "10px 0", outline: "none", fontSize: "1.1rem", fontWeight: 300, color: T.text, fontFamily: "var(--font-outfit), sans-serif", transition: "border-color .2s" }}
            onFocus={e => e.target.style.borderBottomColor = T.gold}
            onBlur={e => e.target.style.borderBottomColor = T.line2}
          />
        </div>

        {/* Hemsida */}
        <div>
          <label style={{ display: "block", fontSize: "0.63rem", fontWeight: 400, letterSpacing: "0.16em", textTransform: "uppercase" as const, color: T.text3, marginBottom: 10 }}>
            Hemsida <span style={{ color: T.text3, fontStyle: "italic", textTransform: "none", letterSpacing: 0 }}>— valfritt men rekommenderat</span>
          </label>
          <input value={website} onChange={e => setWebsite(e.target.value)} placeholder="t.ex. lindqvistsvvs.se"
            style={{ width: "100%", background: "transparent", border: "none", borderBottom: `1px solid ${T.line2}`, padding: "10px 0", outline: "none", fontSize: "1.1rem", fontWeight: 300, color: T.text, fontFamily: "var(--font-outfit), sans-serif", transition: "border-color .2s" }}
            onFocus={e => e.target.style.borderBottomColor = T.gold}
            onBlur={e => e.target.style.borderBottomColor = T.line2}
          />
          {website.trim() ? (
            <p style={{ marginTop: 8, fontSize: "0.75rem", fontWeight: 300, color: T.gold, display: "flex", alignItems: "center", gap: 6 }}>
              <span>✓</span> AI:n kommer analysera din hemsida för en mer träffsäker Company Brain
            </p>
          ) : (
            <p style={{ marginTop: 8, fontSize: "0.75rem", fontWeight: 300, color: T.text3, lineHeight: 1.6 }}>
              Om du anger din hemsida kan AI:n analysera innehållet och skapa en mer träffsäker Company Brain.
            </p>
          )}
        </div>

        {/* Beskrivning */}
        <div>
          <label style={{ display: "block", fontSize: "0.63rem", fontWeight: 400, letterSpacing: "0.16em", textTransform: "uppercase" as const, color: T.text3, marginBottom: 10 }}>Berätta om företaget</label>
          <textarea value={desc} onChange={e => setDesc(e.target.value)}
            placeholder="Vad gör ni, vilka kunder hjälper ni och hur vill ni uppfattas? Skriv fritt med egna ord."
            rows={4}
            style={{ width: "100%", background: "transparent", border: "none", borderBottom: `1px solid ${T.line2}`, padding: "10px 0", outline: "none", fontSize: "1rem", fontWeight: 300, color: T.text, fontFamily: "var(--font-outfit), sans-serif", resize: "none", lineHeight: 1.75, transition: "border-color .2s" }}
            onFocus={e => e.target.style.borderBottomColor = T.gold}
            onBlur={e => e.target.style.borderBottomColor = T.line2}
          />
        </div>
      </div>

      <button onClick={() => onSubmit(name, website, desc)} disabled={!canSubmit} style={{
        fontFamily: "var(--font-outfit), sans-serif", fontSize: "0.78rem", fontWeight: 400,
        letterSpacing: "0.12em", textTransform: "uppercase" as const,
        padding: "14px 32px", borderRadius: 2, border: "none",
        background: canSubmit ? T.gold : T.surface2,
        color: canSubmit ? T.bg : T.text3,
        cursor: canSubmit ? "pointer" : "not-allowed",
        transition: "all .2s", width: isMobile ? "100%" : "auto",
      }}>
        Bygg Company Brain →
      </button>
    </div>
  );
}

// ── Screen 2: Building ────────────────────────────────────
function BuildingScreen({ hasWebsite }: { hasWebsite: boolean }) {
  const [step, setStep] = useState(0);
  const steps = hasWebsite ? STEPS_WITH_WEBSITE : STEPS_WITHOUT_WEBSITE;

  useEffect(() => {
    const t = setInterval(() => setStep(p => Math.min(p + 1, steps.length - 1)), hasWebsite ? 550 : 650);
    return () => clearInterval(t);
  }, []);

  return (
    <div style={{ animation: "fadeUp .5s ease both" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: "0.63rem", fontWeight: 400, letterSpacing: "0.18em", textTransform: "uppercase" as const, color: T.gold, marginBottom: 24 }}>
        <div style={{ width: 6, height: 6, borderRadius: "50%", background: T.gold, animation: "pulseDot 1.4s ease infinite" }} />
        Bygger Company Brain
      </div>
      <h1 style={{ fontFamily: "var(--font-cormorant), serif", fontWeight: 300, fontSize: "clamp(2.2rem,5vw,3.2rem)", lineHeight: .95, letterSpacing: "-0.02em", color: T.text, marginBottom: 16 }}>
        AI:n analyserar<br /><em style={{ color: T.gold, fontStyle: "italic" }}>ditt företag.</em>
      </h1>
      <p style={{ fontSize: "0.88rem", fontWeight: 300, color: T.text2, lineHeight: 1.75, marginBottom: 48, maxWidth: 400 }}>
        AI:n {hasWebsite ? "läser din hemsida och " : ""}analyserar företaget och bygger grunden för all framtida marknadsföring.
      </p>
      <StepList steps={steps} current={step} />
    </div>
  );
}

// ── Screen 3: Brain reveal ────────────────────────────────
function BrainScreen({ profile, onCreatePlan }: { profile: CompanyProfile; onCreatePlan: () => void }) {
  const isMobile = typeof window !== "undefined" && window.innerWidth < 640;

  const fields = [
    { label: "Bransch", value: profile.industry },
    { label: "Kunder", value: profile.customers?.join(", ") },
    { label: "Tjänster", value: profile.products?.join(", ") },
    { label: "Tonläge", value: profile.tone?.join(", ") },
    { label: "Styrkor", value: profile.strengths?.join(", ") },
    { label: "Riktlinjer", value: profile.contentGuidelines?.join(", ") },
  ].filter(f => f.value);

  return (
    <div style={{ animation: "fadeUp .55s ease both" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, fontSize: "0.63rem", fontWeight: 400, letterSpacing: "0.18em", textTransform: "uppercase" as const, color: T.gold, marginBottom: 20 }}>
        <span>✓</span> Company Brain klar
      </div>

      <h1 style={{ fontFamily: "var(--font-cormorant), serif", fontWeight: 300, fontSize: isMobile ? "clamp(2rem,8vw,2.8rem)" : "clamp(2.4rem,5vw,3.4rem)", lineHeight: .95, letterSpacing: "-0.02em", color: T.text, marginBottom: 28 }}>
        AI:n har förstått<br /><em style={{ color: T.gold, fontStyle: "italic" }}>{profile.companyName}.</em>
      </h1>

      {/* Summary — the "wow" moment */}
      <div style={{ background: T.surface, border: `1px solid ${T.goldBorder}`, borderRadius: 2, padding: "24px 28px", marginBottom: 32, position: "relative", overflow: "hidden" }}>
        <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 1, background: `linear-gradient(90deg, transparent, ${T.gold}, transparent)`, opacity: .5 }} />
        <div style={{ fontSize: "0.6rem", fontWeight: 400, letterSpacing: "0.14em", textTransform: "uppercase" as const, color: T.gold, marginBottom: 12, opacity: .7 }}>Sammanfattning</div>
        <p style={{ fontFamily: "var(--font-cormorant), serif", fontWeight: 400, fontStyle: "italic", fontSize: isMobile ? "1.1rem" : "1.25rem", lineHeight: 1.65, color: T.text }}>
          "{profile.summary}"
        </p>
      </div>

      {/* Fields */}
      <div style={{ borderTop: `1px solid ${T.line}`, marginBottom: 40 }}>
        {fields.map(f => (
          <div key={f.label} style={{
            display: "grid", gridTemplateColumns: isMobile ? "1fr" : "100px 1fr",
            gap: isMobile ? 4 : 20, padding: "15px 0", borderBottom: `1px solid ${T.line}`,
          }}>
            <span style={{ fontSize: "0.62rem", fontWeight: 400, letterSpacing: "0.12em", textTransform: "uppercase" as const, color: T.text3, paddingTop: 2 }}>{f.label}</span>
            <span style={{ fontSize: "0.88rem", fontWeight: 300, color: T.text2, lineHeight: 1.7 }}>{f.value}</span>
          </div>
        ))}
      </div>

      <button onClick={onCreatePlan} style={{
        fontFamily: "var(--font-outfit), sans-serif", fontSize: "0.78rem", fontWeight: 400,
        letterSpacing: "0.12em", textTransform: "uppercase" as const,
        padding: "14px 32px", borderRadius: 2, border: "none",
        background: T.gold, color: T.bg, cursor: "pointer",
        transition: "all .2s", width: isMobile ? "100%" : "auto",
      }}>
        Skapa veckoplan →
      </button>
    </div>
  );
}

// ── Screen 4: Generating plan ─────────────────────────────
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

// ── Root ──────────────────────────────────────────────────
export default function OnboardingPage() {
  const router = useRouter();
  const [screen, setScreen] = useState<"input" | "building" | "brain" | "generating">("input");
  const [hasWebsite, setHasWebsite] = useState(false);
  const [profile, setProfile] = useState<CompanyProfile | null>(null);
  const isMobile = typeof window !== "undefined" && window.innerWidth < 640;
  const pad = isMobile ? 20 : 56;

  async function handleSubmit(name: string, website: string, desc: string) {
    const trimmedSite = website.trim();
    setHasWebsite(!!trimmedSite);
    setScreen("building");

    const input = {
      companyName: name, website: trimmedSite, industry: "", products: "",
      customers: "", description: desc, tone: "", avoid: "", previousPosts: desc,
    };
    localStorage.setItem("marketing-copilot-company-input", JSON.stringify(input));

    // Minimum animation time
    const [result] = await Promise.all([
      fetch("/api/analyze-company", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      }).then(r => r.json()).catch(() => null),
      new Promise(r => setTimeout(r, trimmedSite ? 3800 : 3200)),
    ]);

    const p: CompanyProfile = result || {
      companyName: name, industry: "",
      summary: `${name} hjälper sina kunder med professionella tjänster och lösningar.`,
      customers: ["Privatpersoner", "Företag"],
      products: [desc.split(" ").slice(0, 5).join(" ")],
      tone: ["Professionellt", "Tillgängligt"],
      strengths: ["Lokalt", "Kunnigt"],
      avoid: ["Aggressivt säljspråk"],
      contentGuidelines: ["Konkret och faktabaserat"],
    };

    localStorage.setItem("marketing-copilot-company-profile", JSON.stringify(p));
    setProfile(p);
    setScreen("brain");
  }

  async function handleCreatePlan() {
    setScreen("generating");

    const savedProfile = localStorage.getItem("marketing-copilot-company-profile");
    const companyProfile = savedProfile ? JSON.parse(savedProfile) : profile;

    const [result] = await Promise.all([
      fetch("/api/generate-plan", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ companyProfile }),
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
        <div style={{ fontSize: "0.68rem", fontWeight: 300, color: screen === "brain" ? T.gold : T.text3, letterSpacing: "0.04em", display: "flex", alignItems: "center", gap: 6 }}>
          {screen === "input" && "Under 2 minuter"}
          {(screen === "building" || screen === "generating") && <><div style={{ width: 5, height: 5, borderRadius: "50%", background: T.gold, animation: "pulseDot 1.4s ease infinite" }} />Arbetar…</>}
          {screen === "brain" && <><span>✓</span> Company Brain klar</>}
        </div>
      </nav>

      <div style={{ maxWidth: 580, margin: "0 auto", padding: `64px ${pad}px 100px` }}>
        {screen === "input" && <InputScreen onSubmit={handleSubmit} />}
        {screen === "building" && <BuildingScreen hasWebsite={hasWebsite} />}
        {screen === "brain" && profile && <BrainScreen profile={profile} onCreatePlan={handleCreatePlan} />}
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
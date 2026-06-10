"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

const T = {
  bg: "#0a0908", surface: "#111009", surface2: "#181510",
  line: "rgba(255,248,235,0.08)", line2: "rgba(255,248,235,0.13)",
  text: "#f5f0e8", text2: "rgba(245,240,232,0.55)", text3: "rgba(245,240,232,0.30)",
  gold: "#c9a96e", goldDim: "rgba(201,169,110,0.10)", goldBorder: "rgba(201,169,110,0.22)",
};

type FormData = {
  companyName: string;
  industry: string;
  description: string;
  customers: string;
  products: string;
};

type CompanyProfile = {
  companyName: string;
  industry: string;
  summary: string;
  customers: string[];
  products: string[];
  tone: string[];
  strengths: string[];
  avoid: string[];
  contentGuidelines: string[];
};

const INDUSTRIES = ["Bilverkstad","VVS","Elektriker","Måleri","Städ","Fastighetsservice","Redovisning","Gasol","Annat"];
const CUSTOMER_EXAMPLES = ["Villaägare","Småföretag","Bilägare","Fastighetsägare","Privatpersoner","Företag"];
const PRODUCT_EXAMPLES = ["Rekond","Lackskydd","Däckhotell","Serviceavtal","Installation","Service","Rådgivning"];

function Tag({ label, onClick, active }: { label: string; onClick: () => void; active?: boolean }) {
  return (
    <button onClick={onClick} style={{
      fontSize: "0.78rem", fontWeight: 300, padding: "6px 14px", borderRadius: 2,
      cursor: "pointer", transition: "all .15s",
      background: active ? T.goldDim : T.surface2,
      border: `1px solid ${active ? T.goldBorder : T.line2}`,
      color: active ? T.gold : T.text2,
    }}>
      {label}
    </button>
  );
}

function Field({ label, value, onChange, placeholder, type = "input" }: {
  label: string; value: string; onChange: (v: string) => void;
  placeholder: string; type?: "input" | "textarea";
}) {
  return (
    <div>
      <label style={{ display: "block", fontSize: "0.67rem", fontWeight: 400, letterSpacing: "0.14em", textTransform: "uppercase" as const, color: T.text3, marginBottom: 10 }}>
        {label}
      </label>
      {type === "input" ? (
        <input value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder}
          style={{ width: "100%", background: "transparent", border: "none", borderBottom: `1px solid ${T.line2}`, padding: "10px 0", outline: "none", fontSize: "1.1rem", fontWeight: 300, color: T.text, fontFamily: "var(--font-outfit), sans-serif", transition: "border-color .2s" }}
          onFocus={e => e.target.style.borderBottomColor = T.gold}
          onBlur={e => e.target.style.borderBottomColor = T.line2}
        />
      ) : (
        <textarea value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} rows={3}
          style={{ width: "100%", background: "transparent", border: "none", borderBottom: `1px solid ${T.line2}`, padding: "10px 0", outline: "none", fontSize: "1.1rem", fontWeight: 300, color: T.text, fontFamily: "var(--font-outfit), sans-serif", resize: "none", lineHeight: 1.7, transition: "border-color .2s" }}
          onFocus={e => e.target.style.borderBottomColor = T.gold}
          onBlur={e => e.target.style.borderBottomColor = T.line2}
        />
      )}
    </div>
  );
}

function ProgressDots({ total, current }: { total: number; current: number }) {
  return (
    <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
      {Array.from({ length: total }).map((_, i) => (
        <div key={i} style={{
          width: i === current ? 20 : 6, height: 6, borderRadius: 3,
          background: i <= current ? T.gold : T.line2,
          opacity: i <= current ? 1 : .4,
          transition: "all .3s",
        }} />
      ))}
    </div>
  );
}

function Btn({ children, onClick, disabled, full }: { children: React.ReactNode; onClick?: () => void; disabled?: boolean; full?: boolean }) {
  return (
    <button onClick={onClick} disabled={disabled} style={{
      fontFamily: "var(--font-outfit), sans-serif", fontSize: "0.75rem", fontWeight: 400,
      letterSpacing: "0.12em", textTransform: "uppercase" as const,
      padding: "13px 28px", borderRadius: 2, border: "none",
      background: disabled ? T.surface2 : T.gold,
      color: disabled ? T.text3 : T.bg,
      cursor: disabled ? "not-allowed" : "pointer",
      transition: "all .2s", width: full ? "100%" : "auto",
      display: "inline-flex", alignItems: "center", gap: 8,
    }}>
      {children}
    </button>
  );
}

// ── Screens ──────────────────────────────────────────────

function Screen1({ data, setData, onNext }: { data: FormData; setData: (d: FormData) => void; onNext: () => void }) {
  const isMobile = typeof window !== "undefined" && window.innerWidth < 640;
  return (
    <div style={{ animation: "fadeUp .5s ease both" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, fontSize: "0.63rem", fontWeight: 400, letterSpacing: "0.18em", textTransform: "uppercase" as const, color: T.gold, marginBottom: 20 }}>
        <span style={{ width: 16, height: 1, background: T.gold, opacity: .5, display: "block" }} />
        Onboarding · Steg 1 av 3
      </div>
      <h1 style={{ fontFamily: "var(--font-cormorant), serif", fontWeight: 300, fontSize: isMobile ? "clamp(2rem,8vw,2.8rem)" : "clamp(2.4rem,5vw,3.5rem)", lineHeight: .95, letterSpacing: "-0.02em", color: T.text, marginBottom: 14 }}>
        Låt AI:n lära känna<br /><em style={{ color: T.gold, fontStyle: "italic" }}>ditt företag.</em>
      </h1>
      <p style={{ fontSize: "0.9rem", fontWeight: 300, color: T.text2, lineHeight: 1.75, marginBottom: 48, maxWidth: 440 }}>
        Svara på några enkla frågor. På två minuter bygger vi en Company Brain som används för all marknadsföring.
      </p>
      <div style={{ display: "flex", flexDirection: "column", gap: 32, marginBottom: 48 }}>
        <Field label="Företagsnamn" value={data.companyName} onChange={v => setData({ ...data, companyName: v })} placeholder="t.ex. Isaks Bilvård" />
        <div>
          <label style={{ display: "block", fontSize: "0.67rem", fontWeight: 400, letterSpacing: "0.14em", textTransform: "uppercase" as const, color: T.text3, marginBottom: 12 }}>Bransch</label>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {INDUSTRIES.map(b => (
              <Tag key={b} label={b} active={data.industry === b} onClick={() => setData({ ...data, industry: b })} />
            ))}
          </div>
        </div>
        <Field label="Kort beskrivning" value={data.description} onChange={v => setData({ ...data, description: v })} placeholder="t.ex. Vi erbjuder professionell bilvård för privatpersoner och företag i Stockholm." type="textarea" />
      </div>
      <Btn onClick={onNext} disabled={!data.companyName || !data.industry}>Fortsätt →</Btn>
    </div>
  );
}

function Screen2({ data, setData, onNext, onBack }: { data: FormData; setData: (d: FormData) => void; onNext: () => void; onBack: () => void }) {
  const isMobile = typeof window !== "undefined" && window.innerWidth < 640;
  function toggleExample(ex: string) {
    const current = data.customers;
    if (current.includes(ex)) {
      setData({ ...data, customers: current.replace(ex, "").replace(/,\s*,/g, ",").replace(/^,\s*|,\s*$/g, "").trim() });
    } else {
      setData({ ...data, customers: current ? `${current}, ${ex}` : ex });
    }
  }
  return (
    <div style={{ animation: "fadeUp .5s ease both" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, fontSize: "0.63rem", fontWeight: 400, letterSpacing: "0.18em", textTransform: "uppercase" as const, color: T.gold, marginBottom: 20 }}>
        <span style={{ width: 16, height: 1, background: T.gold, opacity: .5, display: "block" }} />
        Onboarding · Steg 2 av 3
      </div>
      <h1 style={{ fontFamily: "var(--font-cormorant), serif", fontWeight: 300, fontSize: isMobile ? "clamp(2rem,8vw,2.8rem)" : "clamp(2.4rem,5vw,3.5rem)", lineHeight: .95, letterSpacing: "-0.02em", color: T.text, marginBottom: 14 }}>
        Vilka <em style={{ color: T.gold, fontStyle: "italic" }}>hjälper ni?</em>
      </h1>
      <p style={{ fontSize: "0.9rem", fontWeight: 300, color: T.text2, lineHeight: 1.75, marginBottom: 48, maxWidth: 440 }}>
        Beskriv era kunder med egna ord.
      </p>
      <div style={{ display: "flex", flexDirection: "column", gap: 24, marginBottom: 48 }}>
        <Field label="Vilka är era vanligaste kunder?" value={data.customers} onChange={v => setData({ ...data, customers: v })} placeholder="t.ex. Privatpersoner med bil, småföretagare" type="textarea" />
        <div>
          <div style={{ fontSize: "0.63rem", fontWeight: 400, letterSpacing: "0.12em", textTransform: "uppercase" as const, color: T.text3, marginBottom: 10 }}>Snabbval</div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {CUSTOMER_EXAMPLES.map(ex => (
              <Tag key={ex} label={ex} active={data.customers.includes(ex)} onClick={() => toggleExample(ex)} />
            ))}
          </div>
        </div>
      </div>
      <div style={{ display: "flex", gap: 10 }}>
        <button onClick={onBack} style={{ fontFamily: "var(--font-outfit), sans-serif", fontSize: "0.72rem", fontWeight: 400, letterSpacing: "0.1em", textTransform: "uppercase" as const, padding: "13px 20px", borderRadius: 2, border: `1px solid ${T.line2}`, background: "transparent", color: T.text3, cursor: "pointer" }}>← Tillbaka</button>
        <Btn onClick={onNext} disabled={!data.customers.trim()}>Fortsätt →</Btn>
      </div>
    </div>
  );
}

function Screen3({ data, setData, onNext, onBack }: { data: FormData; setData: (d: FormData) => void; onNext: () => void; onBack: () => void }) {
  const isMobile = typeof window !== "undefined" && window.innerWidth < 640;
  function toggleExample(ex: string) {
    const current = data.products;
    if (current.includes(ex)) {
      setData({ ...data, products: current.replace(ex, "").replace(/,\s*,/g, ",").replace(/^,\s*|,\s*$/g, "").trim() });
    } else {
      setData({ ...data, products: current ? `${current}, ${ex}` : ex });
    }
  }
  return (
    <div style={{ animation: "fadeUp .5s ease both" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, fontSize: "0.63rem", fontWeight: 400, letterSpacing: "0.18em", textTransform: "uppercase" as const, color: T.gold, marginBottom: 20 }}>
        <span style={{ width: 16, height: 1, background: T.gold, opacity: .5, display: "block" }} />
        Onboarding · Steg 3 av 3
      </div>
      <h1 style={{ fontFamily: "var(--font-cormorant), serif", fontWeight: 300, fontSize: isMobile ? "clamp(2rem,8vw,2.8rem)" : "clamp(2.4rem,5vw,3.5rem)", lineHeight: .95, letterSpacing: "-0.02em", color: T.text, marginBottom: 14 }}>
        Vad <em style={{ color: T.gold, fontStyle: "italic" }}>erbjuder ni?</em>
      </h1>
      <p style={{ fontSize: "0.9rem", fontWeight: 300, color: T.text2, lineHeight: 1.75, marginBottom: 48, maxWidth: 440 }}>
        Berätta vilka produkter eller tjänster ni säljer.
      </p>
      <div style={{ display: "flex", flexDirection: "column", gap: 24, marginBottom: 48 }}>
        <Field label="Produkter och tjänster" value={data.products} onChange={v => setData({ ...data, products: v })} placeholder="t.ex. Rekond, lackskydd, däckhotell och serviceavtal" type="textarea" />
        <div>
          <div style={{ fontSize: "0.63rem", fontWeight: 400, letterSpacing: "0.12em", textTransform: "uppercase" as const, color: T.text3, marginBottom: 10 }}>Snabbval</div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {PRODUCT_EXAMPLES.map(ex => (
              <Tag key={ex} label={ex} active={data.products.includes(ex)} onClick={() => toggleExample(ex)} />
            ))}
          </div>
        </div>
      </div>
      <div style={{ display: "flex", gap: 10 }}>
        <button onClick={onBack} style={{ fontFamily: "var(--font-outfit), sans-serif", fontSize: "0.72rem", fontWeight: 400, letterSpacing: "0.1em", textTransform: "uppercase" as const, padding: "13px 20px", borderRadius: 2, border: `1px solid ${T.line2}`, background: "transparent", color: T.text3, cursor: "pointer" }}>← Tillbaka</button>
        <Btn onClick={onNext} disabled={!data.products.trim()}>Bygg Company Brain →</Btn>
      </div>
    </div>
  );
}

function Screen4() {
  const steps = [
    "Analyserar kunder…",
    "Identifierar tjänster…",
    "Skapar tonalitet…",
    "Bygger Company Brain…",
  ];
  const [current, setCurrent] = useState(0);
  useState(() => {
    const interval = setInterval(() => setCurrent(p => Math.min(p + 1, steps.length - 1)), 700);
    return () => clearInterval(interval);
  });
  return (
    <div style={{ animation: "fadeUp .5s ease both" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, fontSize: "0.63rem", fontWeight: 400, letterSpacing: "0.18em", textTransform: "uppercase" as const, color: T.gold, marginBottom: 20 }}>
        <div style={{ width: 5, height: 5, borderRadius: "50%", background: T.gold, animation: "pulseDot 1.5s ease infinite" }} />
        AI-analys pågår
      </div>
      <h1 style={{ fontFamily: "var(--font-cormorant), serif", fontWeight: 300, fontSize: "clamp(2rem,5vw,3rem)", lineHeight: .95, letterSpacing: "-0.02em", color: T.text, marginBottom: 14 }}>
        AI:n analyserar<br /><em style={{ color: T.gold, fontStyle: "italic" }}>ditt företag.</em>
      </h1>
      <p style={{ fontSize: "0.88rem", fontWeight: 300, color: T.text2, lineHeight: 1.75, marginBottom: 48, maxWidth: 400 }}>
        AI:n bygger grunden för all framtida marknadsföring.
      </p>
      <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
        {steps.map((s, i) => (
          <div key={i} style={{
            display: "flex", alignItems: "center", gap: 14, padding: "12px 16px", borderRadius: 2,
            background: i === current ? T.goldDim : "transparent",
            border: `1px solid ${i === current ? T.goldBorder : "transparent"}`,
            opacity: i > current ? .3 : 1, transition: "all .3s",
          }}>
            <div style={{ width: 20, height: 20, borderRadius: 2, display: "flex", alignItems: "center", justifyContent: "center", background: i < current ? T.goldDim : "transparent", border: `1px solid ${i <= current ? T.goldBorder : T.line2}`, fontSize: "0.65rem", color: T.gold, flexShrink: 0 }}>
              {i < current ? "✓" : i === current ? <div style={{ width: 8, height: 8, borderRadius: "50%", border: "1.5px solid rgba(201,169,110,.3)", borderTopColor: T.gold, animation: "spin .7s linear infinite" }} /> : ""}
            </div>
            <span style={{ fontSize: "0.85rem", fontWeight: 300, color: i <= current ? T.text : T.text3 }}>{s}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function Screen5({ profile, onNext }: { profile: CompanyProfile | null; onNext: () => void }) {
  const isMobile = typeof window !== "undefined" && window.innerWidth < 640;
  if (!profile) return null;

  const fields = [
    ["Bransch", profile.industry],
    ["Kunder", profile.customers?.join(", ")],
    ["Tjänster", profile.products?.join(", ")],
    ["Tonläge", profile.tone?.join(", ")],
    ["Styrkor", profile.strengths?.join(", ")],
  ].filter(([, v]) => v);

  return (
    <div style={{ animation: "fadeUp .5s ease both" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, fontSize: "0.63rem", fontWeight: 400, letterSpacing: "0.18em", textTransform: "uppercase" as const, color: T.gold, marginBottom: 20 }}>
        <span style={{ width: 16, height: 1, background: T.gold, opacity: .5, display: "block" }} />
        Company Brain
      </div>
      <h1 style={{ fontFamily: "var(--font-cormorant), serif", fontWeight: 300, fontSize: isMobile ? "clamp(2rem,8vw,2.8rem)" : "clamp(2.4rem,5vw,3.2rem)", lineHeight: .95, letterSpacing: "-0.02em", color: T.text, marginBottom: 14 }}>
        AI:n har förstått<br /><em style={{ color: T.gold, fontStyle: "italic" }}>{profile.companyName}.</em>
      </h1>

      {/* Summary quote */}
      <div style={{ background: T.surface, border: `1px solid ${T.line2}`, borderRadius: 2, padding: "20px 24px", marginBottom: 32, marginTop: 24 }}>
        <div style={{ fontSize: "0.62rem", fontWeight: 400, letterSpacing: "0.12em", textTransform: "uppercase" as const, color: T.text3, marginBottom: 10 }}>Sammanfattning</div>
        <p style={{ fontFamily: "var(--font-cormorant), serif", fontSize: "1.15rem", fontWeight: 400, fontStyle: "italic", color: T.text, lineHeight: 1.6 }}>
          "{profile.summary}"
        </p>
      </div>

      {/* Fields */}
      <div style={{ borderTop: `1px solid ${T.line}`, marginBottom: 40 }}>
        {fields.map(([label, value]) => (
          <div key={label} style={{ display: "flex", gap: 20, padding: "14px 0", borderBottom: `1px solid ${T.line}`, flexDirection: isMobile ? "column" : "row", gap: isMobile ? 4 : 20 }}>
            <span style={{ fontSize: "0.63rem", fontWeight: 400, letterSpacing: "0.1em", textTransform: "uppercase" as const, color: T.text3, width: isMobile ? "auto" : 100, flexShrink: 0 }}>{label}</span>
            <span style={{ fontSize: "0.85rem", fontWeight: 300, color: T.text2, lineHeight: 1.65 }}>{value}</span>
          </div>
        ))}
      </div>

      <Btn onClick={onNext} full>Skapa veckoplan →</Btn>
    </div>
  );
}

function Screen6() {
  const steps = ["Skapar sociala medier…", "Skriver nyhetsbrev…", "Bygger kampanjer…", "Skapar möjligheter…"];
  const [current, setCurrent] = useState(0);
  useState(() => {
    const interval = setInterval(() => setCurrent(p => Math.min(p + 1, steps.length - 1)), 900);
    return () => clearInterval(interval);
  });
  return (
    <div style={{ animation: "fadeUp .5s ease both" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, fontSize: "0.63rem", fontWeight: 400, letterSpacing: "0.18em", textTransform: "uppercase" as const, color: T.gold, marginBottom: 20 }}>
        <div style={{ width: 5, height: 5, borderRadius: "50%", background: T.gold, animation: "pulseDot 1.5s ease infinite" }} />
        Genererar veckoplan
      </div>
      <h1 style={{ fontFamily: "var(--font-cormorant), serif", fontWeight: 300, fontSize: "clamp(2rem,5vw,3rem)", lineHeight: .95, letterSpacing: "-0.02em", color: T.text, marginBottom: 14 }}>
        AI:n bygger din<br /><em style={{ color: T.gold, fontStyle: "italic" }}>första marknadsplan.</em>
      </h1>
      <p style={{ fontSize: "0.88rem", fontWeight: 300, color: T.text2, lineHeight: 1.75, marginBottom: 48, maxWidth: 400 }}>
        Baserat på din Company Brain skapas nu färdigt innehåll för veckan.
      </p>
      <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
        {steps.map((s, i) => (
          <div key={i} style={{
            display: "flex", alignItems: "center", gap: 14, padding: "12px 16px", borderRadius: 2,
            background: i === current ? T.goldDim : "transparent",
            border: `1px solid ${i === current ? T.goldBorder : "transparent"}`,
            opacity: i > current ? .3 : 1, transition: "all .3s",
          }}>
            <div style={{ width: 20, height: 20, borderRadius: 2, display: "flex", alignItems: "center", justifyContent: "center", background: i < current ? T.goldDim : "transparent", border: `1px solid ${i <= current ? T.goldBorder : T.line2}`, fontSize: "0.65rem", color: T.gold, flexShrink: 0 }}>
              {i < current ? "✓" : i === current ? <div style={{ width: 8, height: 8, borderRadius: "50%", border: "1.5px solid rgba(201,169,110,.3)", borderTopColor: T.gold, animation: "spin .7s linear infinite" }} /> : ""}
            </div>
            <span style={{ fontSize: "0.85rem", fontWeight: 300, color: i <= current ? T.text : T.text3 }}>{s}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Main ──────────────────────────────────────────────────

export default function OnboardingPage() {
  const router = useRouter();
  const [screen, setScreen] = useState(1);
  const [data, setData] = useState<FormData>({ companyName: "", industry: "", description: "", customers: "", products: "" });
  const [profile, setProfile] = useState<CompanyProfile | null>(null);

  const isMobile = typeof window !== "undefined" && window.innerWidth < 640;
  const pad = isMobile ? 20 : 56;

  const progress = screen <= 3 ? ((screen - 1) / 2) * 100 : 100;

  async function analyzeCompany() {
    setScreen(4);
    try {
      localStorage.setItem("marketing-copilot-company-input", JSON.stringify({
        companyName: data.companyName,
        website: "",
        industry: data.industry,
        products: data.products,
        customers: data.customers,
        tone: "",
        avoid: "",
        previousPosts: data.description,
      }));
      const res = await fetch("/api/analyze-company", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          companyName: data.companyName,
          industry: data.industry,
          products: data.products,
          customers: data.customers,
          description: data.description,
        }),
      });
      if (!res.ok) throw new Error();
      const result = await res.json();
      localStorage.setItem("marketing-copilot-company-profile", JSON.stringify(result));
      setProfile(result);
      setTimeout(() => setScreen(5), 800);
    } catch {
      // fallback profile
      const fallback: CompanyProfile = {
        companyName: data.companyName,
        industry: data.industry,
        summary: `${data.companyName} erbjuder ${data.products} till ${data.customers}.`,
        customers: data.customers.split(",").map(s => s.trim()).filter(Boolean),
        products: data.products.split(",").map(s => s.trim()).filter(Boolean),
        tone: ["Professionellt", "Hjälpsamt", "Tillgängligt"],
        strengths: ["Lokalt", "Kunnigt", "Pålitligt"],
        avoid: ["Aggressivt säljspråk"],
        contentGuidelines: ["Konkret och faktabaserat"],
      };
      localStorage.setItem("marketing-copilot-company-profile", JSON.stringify(fallback));
      setProfile(fallback);
      setTimeout(() => setScreen(5), 800);
    }
  }

  async function generatePlan() {
    setScreen(6);
    try {
      const savedProfile = localStorage.getItem("marketing-copilot-company-profile");
      const companyProfile = savedProfile ? JSON.parse(savedProfile) : profile;
      const res = await fetch("/api/generate-plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ companyProfile }),
      });
      if (!res.ok) throw new Error();
      const plan = await res.json();
      localStorage.setItem("marketing-copilot-plan", JSON.stringify({ id: "ai-generated-plan", ...plan }));
      setTimeout(() => router.push("/dashboard"), 800);
    } catch {
      setTimeout(() => router.push("/dashboard"), 1200);
    }
  }

  return (
    <main style={{ minHeight: "100svh", background: T.bg }}>

      {/* Nav */}
      <nav style={{ position: "sticky", top: 0, zIndex: 100, display: "flex", alignItems: "center", justifyContent: "space-between", padding: `0 ${pad}px`, height: 56, background: "rgba(10,9,8,0.92)", backdropFilter: "blur(20px)", borderBottom: `1px solid ${T.line}` }}>
        <span style={{ fontFamily: "var(--font-cormorant), serif", fontWeight: 500, fontSize: "1.1rem", letterSpacing: "0.08em", textTransform: "uppercase", color: T.text }}>
          Marketing<span style={{ color: T.gold }}>Copilot</span>
        </span>
        {screen <= 3 && <ProgressDots total={3} current={screen - 1} />}
      </nav>

      {/* Progress bar */}
      <div style={{ height: 2, background: T.line }}>
        <div style={{ height: "100%", background: T.gold, opacity: .5, width: `${progress}%`, transition: "width .5s ease" }} />
      </div>

      {/* Content */}
      <div style={{ maxWidth: 600, margin: "0 auto", padding: `60px ${pad}px 100px` }}>
        {screen === 1 && <Screen1 data={data} setData={setData} onNext={() => setScreen(2)} />}
        {screen === 2 && <Screen2 data={data} setData={setData} onNext={() => setScreen(3)} onBack={() => setScreen(1)} />}
        {screen === 3 && <Screen3 data={data} setData={setData} onNext={analyzeCompany} onBack={() => setScreen(2)} />}
        {screen === 4 && <Screen4 />}
        {screen === 5 && <Screen5 profile={profile} onNext={generatePlan} />}
        {screen === 6 && <Screen6 />}
      </div>

      <style>{`
        @keyframes fadeUp { from { opacity:0; transform:translateY(12px); } to { opacity:1; transform:translateY(0); } }
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes pulseDot { 0%,100%{opacity:1} 50%{opacity:.3} }
        input::placeholder, textarea::placeholder { color: rgba(245,240,232,0.28); }
        @media (max-width: 640px) {
          nav { padding: 0 20px !important; }
        }
      `}</style>
    </main>
  );
}
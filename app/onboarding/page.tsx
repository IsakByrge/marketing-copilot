"use client";

import { useState } from "react";

const T = {
  bg: "#0a0908",
  surface: "#111009",
  surface2: "#181510",
  line: "rgba(255,248,235,0.08)",
  line2: "rgba(255,248,235,0.13)",
  text: "#f5f0e8",
  text2: "rgba(245,240,232,0.55)",
  text3: "rgba(245,240,232,0.30)",
  gold: "#c9a96e",
  goldDim: "rgba(201,169,110,0.10)",
};

export default function OnboardingPage() {
  const [form, setForm] = useState({
    companyName: "",
    website: "",
    industry: "",
    products: "",
    customers: "",
    tone: "",
    avoid: "",
    previousPosts: "",
  });

  const [isAnalyzing, setIsAnalyzing] = useState(false);

  function updateField(field: string, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  async function analyzeCompany() {
    try {
      setIsAnalyzing(true);
      localStorage.setItem("marketing-copilot-company-input", JSON.stringify(form));
      localStorage.removeItem("marketing-copilot-plan");
      const response = await fetch("/api/analyze-company", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (!response.ok) throw new Error("Kunde inte analysera företaget");
      const profile = await response.json();
      localStorage.setItem("marketing-copilot-company-profile", JSON.stringify(profile));
      window.location.href = "/profile";
    } catch (error) {
      console.error(error);
      alert("Kunde inte analysera företaget.");
    } finally {
      setIsAnalyzing(false);
    }
  }

  const fields = [
    { key: "companyName", label: "Företagsnamn", placeholder: "Ex. Gasolfyllarna", type: "input" },
    { key: "website", label: "Hemsida", placeholder: "Ex. https://gasolfyllarna.se", type: "input" },
    { key: "industry", label: "Bransch", placeholder: "Ex. Gasol, VVS, bilverkstad, webshop", type: "input" },
    { key: "products", label: "Vad säljer ni?", placeholder: "Ex. Gasolpåfyllning, gasolflaskor och rådgivning kring säker gasolhantering.", type: "textarea" },
    { key: "customers", label: "Vilka är era kunder?", placeholder: "Ex. Campingägare, husbilsägare, grillkunder och privatpersoner som behöver fylla på gasol.", type: "textarea" },
    { key: "tone", label: "Hur vill ni uppfattas?", placeholder: "Ex. Lokala, hjälpsamma, trygga, kunniga och enkla att ha att göra med.", type: "textarea" },
    { key: "avoid", label: "Vad vill ni undvika?", placeholder: "Ex. Aggressivt säljspråk, clickbait, överdrivna erbjudanden.", type: "textarea" },
    { key: "previousPosts", label: "Klistra in tidigare inlägg", placeholder: "Klistra gärna in 3–5 tidigare inlägg, kampanjtexter eller nyhetsbrev så AI:n lär sig tonaliteten.", type: "textarea" },
  ];

  const filled = Object.values(form).filter(v => v.trim()).length;
  const progress = Math.round((filled / fields.length) * 100);

  return (
    <main style={{ minHeight: "100svh", background: T.bg, paddingTop: 0 }}>

      {/* Nav */}
      <nav style={{
        position: "sticky", top: 0, zIndex: 100,
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "0 48px", height: 56,
        background: "rgba(10,9,8,0.9)", backdropFilter: "blur(20px)",
        borderBottom: `1px solid ${T.line}`,
      }}>
        <a href="/" style={{
          fontFamily: "var(--font-cormorant), serif",
          fontWeight: 500, fontSize: "1.1rem",
          letterSpacing: "0.08em", textTransform: "uppercase",
          color: T.text, textDecoration: "none",
        }}>
          Marketing<span style={{ color: T.gold }}>Copilot</span>
        </a>
        <div style={{ fontSize: "0.7rem", fontWeight: 300, color: T.text3, letterSpacing: "0.06em" }}>
          {filled} / {fields.length} fält ifyllda
        </div>
      </nav>

      {/* Progress bar */}
      <div style={{ height: 2, background: T.line }}>
        <div style={{
          height: "100%", background: T.gold, opacity: .6,
          width: `${progress}%`, transition: "width .4s ease",
        }} />
      </div>

      <div style={{ maxWidth: 760, margin: "0 auto", padding: "60px 48px 100px" }}>

        {/* Header */}
        <div style={{ marginBottom: 64 }}>
          <div style={{
            display: "flex", alignItems: "center", gap: 12,
            fontSize: "0.67rem", fontWeight: 400, letterSpacing: "0.18em",
            textTransform: "uppercase", color: T.gold, marginBottom: 20,
          }}>
            <span style={{ width: 20, height: 1, background: T.gold, opacity: .5, display: "block" }} />
            Onboarding
          </div>
          <h1 style={{
            fontFamily: "var(--font-cormorant), serif",
            fontWeight: 300, fontSize: "clamp(2.4rem, 5vw, 4rem)",
            lineHeight: 1.0, letterSpacing: "-0.02em",
            color: T.text, marginBottom: 16,
          }}>
            Lär upp din<br />
            <em style={{ fontStyle: "italic", color: T.gold }}>AI-marknadschef.</em>
          </h1>
          <p style={{
            fontSize: "0.95rem", fontWeight: 300,
            color: T.text2, lineHeight: 1.8, maxWidth: 480,
          }}>
            Berätta hur företaget fungerar, vilka kunder ni hjälper och hur ni
            vill låta. Det här blir grunden för allt innehåll.
          </p>
        </div>

        {/* Fields */}
        <div style={{ borderTop: `1px solid ${T.line}` }}>
          {fields.map((f) => (
            <div key={f.key} style={{ padding: "32px 0", borderBottom: `1px solid ${T.line}` }}>
              <label style={{
                display: "block", marginBottom: 12,
                fontSize: "0.67rem", fontWeight: 400,
                letterSpacing: "0.14em", textTransform: "uppercase",
                color: T.text3,
              }}>
                {f.label}
              </label>
              {f.type === "input" ? (
                <input
                  value={form[f.key as keyof typeof form]}
                  onChange={(e) => updateField(f.key, e.target.value)}
                  placeholder={f.placeholder}
                  style={{
                    width: "100%", background: "transparent",
                    border: "none", borderBottom: `1px solid ${T.line2}`,
                    padding: "10px 0", outline: "none",
                    fontSize: "1.05rem", fontWeight: 300,
                    color: T.text, transition: "border-color .2s",
                    fontFamily: "var(--font-outfit), sans-serif",
                  }}
                  onFocus={e => e.target.style.borderBottomColor = T.gold}
                  onBlur={e => e.target.style.borderBottomColor = T.line2}
                  placeholder-style={{ color: T.text3 } as React.CSSProperties}
                />
              ) : (
                <textarea
                  value={form[f.key as keyof typeof form]}
                  onChange={(e) => updateField(f.key, e.target.value)}
                  placeholder={f.placeholder}
                  rows={f.key === "previousPosts" ? 6 : 3}
                  style={{
                    width: "100%", background: "transparent",
                    border: "none", borderBottom: `1px solid ${T.line2}`,
                    padding: "10px 0", outline: "none", resize: "vertical",
                    fontSize: "1.05rem", fontWeight: 300, lineHeight: 1.75,
                    color: T.text, transition: "border-color .2s",
                    fontFamily: "var(--font-outfit), sans-serif",
                  }}
                  onFocus={e => e.target.style.borderBottomColor = T.gold}
                  onBlur={e => e.target.style.borderBottomColor = T.line2}
                />
              )}
            </div>
          ))}
        </div>

        {/* Submit */}
        <div style={{ marginTop: 48, display: "flex", justifyContent: "flex-end" }}>
          <button
            onClick={analyzeCompany}
            disabled={isAnalyzing || !form.companyName.trim()}
            style={{
              fontFamily: "var(--font-outfit), sans-serif",
              fontSize: "0.75rem", fontWeight: 400,
              letterSpacing: "0.12em", textTransform: "uppercase",
              padding: "14px 32px", borderRadius: 2, border: "none",
              background: isAnalyzing || !form.companyName.trim() ? T.surface2 : T.gold,
              color: isAnalyzing || !form.companyName.trim() ? T.text3 : T.bg,
              cursor: isAnalyzing || !form.companyName.trim() ? "not-allowed" : "pointer",
              transition: "all .2s",
              display: "flex", alignItems: "center", gap: 10,
            }}
          >
            {isAnalyzing && (
              <span style={{
                width: 14, height: 14, borderRadius: "50%",
                border: `1.5px solid rgba(201,169,110,.3)`,
                borderTopColor: T.bg,
                display: "inline-block",
                animation: "spin .7s linear infinite",
              }} />
            )}
            {isAnalyzing ? "Analyserar..." : "Analysera företaget →"}
          </button>
        </div>
      </div>

      <style>{`
        input::placeholder, textarea::placeholder { color: ${T.text3}; }
        @keyframes spin { to { transform: rotate(360deg); } }
        @media (max-width: 640px) {
          nav { padding: 0 20px !important; }
          div[style*="padding: 60px 48px"] { padding: 40px 20px 80px !important; }
        }
      `}</style>
    </main>
  );
}
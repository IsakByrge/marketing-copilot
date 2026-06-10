"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

const T = {
  bg: "#2a2f3a", surface: "#323845", surface2: "#3a4050",
  line: "rgba(255,255,255,0.10)", line2: "rgba(255,255,255,0.18)",
  text: "#ffffff", text2: "#cbd5e0", text3: "#a0aec0",
  gold: "#c9a96e", goldDim: "rgba(201,169,110,0.15)", goldBorder: "rgba(201,169,110,0.30)",
};

type Newsletter = { subject: string; preview: string; body: string; cta: string; };
type MarketingPlan = { company: string; focus: string; newsletter?: Newsletter; };

export default function NewsletterPage() {
  const [plan, setPlan] = useState<MarketingPlan | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem("marketing-copilot-plan");
    if (saved) try { setPlan(JSON.parse(saved)); } catch {}
  }, []);

  function copyAll() {
    if (!plan?.newsletter) return;
    const n = plan.newsletter;
    navigator.clipboard.writeText(
      `ÄMNESRAD: ${n.subject}\nFÖRHANDSVISNING: ${n.preview}\n\n${n.body}\n\n${n.cta}`
    );
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  if (!plan) return (
    <main style={{ minHeight: "100svh", background: T.bg, padding: "80px 48px" }}>
      <p style={{ fontSize: "0.88rem", fontWeight: 300, color: T.text2 }}>Laddar nyhetsbrev…</p>
    </main>
  );

  const n = plan.newsletter;
  if (!n) return (
    <main style={{ minHeight: "100svh", background: T.bg, padding: "80px 48px" }}>
      <Link href="/plan" style={{ fontSize: "0.7rem", fontWeight: 400, letterSpacing: "0.1em", textTransform: "uppercase", color: T.text3, textDecoration: "none" }}>← Till planen</Link>
      <p style={{ marginTop: 80, fontSize: "1rem", fontWeight: 300, color: T.text2 }}>Inget nyhetsbrev hittades.</p>
    </main>
  );

  const blocks = [
    { label: "Ämnesrad", content: n.subject },
    { label: "Förhandsvisning", content: n.preview },
    { label: "Innehåll", content: n.body },
    { label: "Call to action", content: n.cta },
  ];

  return (
    <main style={{ minHeight: "100svh", background: T.bg }}>

      {/* Nav */}
      <nav style={{
        position: "sticky", top: 0, zIndex: 100,
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "0 48px", height: 56,
        background: "rgba(42,47,58,0.95)", backdropFilter: "blur(20px)",
        borderBottom: `1px solid ${T.line}`,
      }}>
        <Link href="/plan" style={{ fontSize: "0.7rem", fontWeight: 400, letterSpacing: "0.1em", textTransform: "uppercase", color: T.text3, textDecoration: "none" }}
          onMouseOver={e => (e.currentTarget as HTMLElement).style.color = T.text2}
          onMouseOut={e => (e.currentTarget as HTMLElement).style.color = T.text3}
        >
          ← Planen
        </Link>
        <button onClick={copyAll} style={{
          fontFamily: "var(--font-outfit), sans-serif", fontSize: "0.68rem", fontWeight: 400,
          letterSpacing: "0.1em", textTransform: "uppercase", padding: "7px 16px",
          borderRadius: 2, border: "none", background: T.gold, color: T.bg,
          cursor: "pointer", transition: "all .2s",
        }}>
          {copied ? "✓ Kopierat" : "Kopiera allt"}
        </button>
      </nav>

      <div style={{ maxWidth: 800, margin: "0 auto", padding: "60px 48px 100px" }}>

        {/* Header */}
        <div style={{ marginBottom: 56 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12, fontSize: "0.65rem", fontWeight: 400, letterSpacing: "0.18em", textTransform: "uppercase", color: T.gold, marginBottom: 16 }}>
            <span style={{ width: 18, height: 1, background: T.gold, opacity: .5, display: "block" }} />
            {plan.company} · Nyhetsbrev
          </div>
          <h1 style={{ fontFamily: "var(--font-cormorant), serif", fontWeight: 300, fontSize: "clamp(2.2rem,5vw,3.8rem)", lineHeight: .95, letterSpacing: "-0.02em", color: T.text, marginBottom: 16 }}>
            {n.subject}
          </h1>
          <p style={{ fontSize: "0.82rem", fontWeight: 300, color: T.text3, letterSpacing: "0.04em" }}>
            Färdigt att skicka
          </p>
        </div>

        {/* Email preview */}
        <div style={{ background: T.surface, border: `1px solid ${T.line2}`, borderRadius: 2, overflow: "hidden", marginBottom: 40 }}>
          <div style={{ background: T.surface2, borderBottom: `1px solid ${T.line}`, padding: "12px 20px", display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ display: "flex", gap: 5 }}>
              {[0,1,2].map(i => <div key={i} style={{ width: 9, height: 9, borderRadius: "50%", background: "rgba(255,255,255,0.10)" }} />)}
            </div>
            <span style={{ fontSize: "0.68rem", fontWeight: 400, letterSpacing: "0.08em", textTransform: "uppercase", color: T.text3 }}>
              E-post förhandsvisning
            </span>
          </div>
          <div style={{ padding: "20px 24px" }}>
            <div style={{ fontSize: "0.72rem", fontWeight: 400, letterSpacing: "0.08em", textTransform: "uppercase", color: T.text3, marginBottom: 6 }}>Ämne</div>
            <div style={{ fontSize: "1rem", fontWeight: 400, color: T.text, marginBottom: 12 }}>{n.subject}</div>
            <div style={{ fontSize: "0.72rem", fontWeight: 400, letterSpacing: "0.08em", textTransform: "uppercase", color: T.text3, marginBottom: 6 }}>Förhandsvisning</div>
            <div style={{ fontSize: "0.85rem", fontWeight: 300, color: T.text2 }}>{n.preview}</div>
          </div>
        </div>

        {/* Content blocks */}
        <div style={{ borderTop: `1px solid ${T.line}` }}>
          {blocks.map(b => (
            <div key={b.label} style={{ padding: "28px 0", borderBottom: `1px solid ${T.line}` }}>
              <div style={{ fontSize: "0.63rem", fontWeight: 400, letterSpacing: "0.14em", textTransform: "uppercase", color: T.text3, marginBottom: 12 }}>{b.label}</div>
              <p style={{ fontSize: "1rem", fontWeight: 300, color: T.text2, lineHeight: 1.8, maxWidth: 620, whiteSpace: "pre-line" }}>{b.content}</p>
            </div>
          ))}
        </div>

        {/* Actions */}
        <div style={{ display: "flex", gap: 10, marginTop: 36, flexWrap: "wrap" }}>
          <button onClick={copyAll} style={{ fontFamily: "var(--font-outfit), sans-serif", fontSize: "0.72rem", fontWeight: 400, letterSpacing: "0.1em", textTransform: "uppercase", padding: "11px 24px", borderRadius: 2, border: "none", background: T.gold, color: T.bg, cursor: "pointer" }}>
            {copied ? "✓ Kopierat" : "Kopiera nyhetsbrev"}
          </button>
          <button style={{ fontFamily: "var(--font-outfit), sans-serif", fontSize: "0.72rem", fontWeight: 400, letterSpacing: "0.1em", textTransform: "uppercase", padding: "11px 18px", borderRadius: 2, border: `1px solid ${T.line2}`, background: "transparent", color: T.text3, cursor: "pointer" }}>Bra</button>
          <button style={{ fontFamily: "var(--font-outfit), sans-serif", fontSize: "0.72rem", fontWeight: 400, letterSpacing: "0.1em", textTransform: "uppercase", padding: "11px 18px", borderRadius: 2, border: `1px solid ${T.line2}`, background: "transparent", color: T.text3, cursor: "pointer" }}>Mindre bra</button>
        </div>
      </div>

      <style>{`
        @media (max-width: 640px) {
          nav { padding: 0 20px !important; }
          div[style*="padding: 60px 48px"] { padding: 40px 20px 80px !important; }
        }
      `}</style>
    </main>
  );
}
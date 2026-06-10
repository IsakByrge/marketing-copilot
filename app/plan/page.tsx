"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

const T = {
  bg: "#2a2f3a", surface: "#323845", surface2: "#3a4050",
  line: "rgba(255,255,255,0.10)", line2: "rgba(255,255,255,0.18)",
  text: "#ffffff", text2: "#cbd5e0", text3: "#a0aec0",
  gold: "#c9a96e", goldDim: "rgba(201,169,110,0.15)",
};

type MarketingPlan = {
  company: string;
  focus: string;
  tags: string[];
  posts: { title: string; text: string; cta: string; image: string; }[];
  newsletter: { subject: string; preview: string; body: string; cta: string; };
  campaigns: { title: string; goal: string; message: string; channels: string; cta: string; }[];
};

function NavBack() {
  return (
    <Link href="/dashboard" style={{
      fontSize: "0.7rem", fontWeight: 400, letterSpacing: "0.1em",
      textTransform: "uppercase", color: T.text3, textDecoration: "none",
      display: "inline-flex", alignItems: "center", gap: 8, transition: "color .2s",
    }}
    onMouseOver={e => (e.currentTarget as HTMLElement).style.color = T.text2}
    onMouseOut={e => (e.currentTarget as HTMLElement).style.color = T.text3}
    >
      ← Dashboard
    </Link>
  );
}

export default function PlanPage() {
  const [plan, setPlan] = useState<MarketingPlan | null>(null);

  useEffect(() => {
    const saved = localStorage.getItem("marketing-copilot-plan");
    if (!saved) return;
    try { setPlan(JSON.parse(saved)); } catch (e) { console.error(e); }
  }, []);

  if (!plan) {
    return (
      <main style={{ minHeight: "100svh", background: T.bg, padding: "80px 48px" }}>
        <div style={{ maxWidth: 800, margin: "0 auto" }}>
          <NavBack />
          <p style={{ marginTop: 80, fontSize: "1rem", fontWeight: 300, color: T.text2 }}>
            Ingen plan hittades. Gå till dashboard och generera en plan.
          </p>
        </div>
      </main>
    );
  }

  const week = (() => {
    const d = new Date(), j = new Date(d.getFullYear(), 0, 1);
    return Math.ceil(((d.getTime() - j.getTime()) / 86400000 + j.getDay() + 1) / 7);
  })();

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
        <a href="/" style={{
          fontFamily: "var(--font-cormorant), serif",
          fontWeight: 500, fontSize: "1.1rem",
          letterSpacing: "0.08em", textTransform: "uppercase",
          color: T.text, textDecoration: "none",
        }}>
          Marketing<span style={{ color: T.gold }}>Copilot</span>
        </a>
        <NavBack />
      </nav>

      <div style={{ maxWidth: 1000, margin: "0 auto", padding: "60px 48px 100px" }}>

        {/* Header */}
        <div style={{ marginBottom: 64 }}>
          <div style={{
            display: "flex", alignItems: "center", gap: 12,
            fontSize: "0.67rem", fontWeight: 400, letterSpacing: "0.18em",
            textTransform: "uppercase", color: T.gold, marginBottom: 20,
          }}>
            <span style={{ width: 20, height: 1, background: T.gold, opacity: .5, display: "block" }} />
            Marknadsplan · Vecka {week}
          </div>

          <h1 style={{
            fontFamily: "var(--font-cormorant), serif",
            fontWeight: 300, fontSize: "clamp(2.6rem, 5vw, 4.5rem)",
            lineHeight: 0.95, letterSpacing: "-0.02em",
            color: T.text, marginBottom: 20,
          }}>
            Din plan för{" "}
            <em style={{ fontStyle: "italic", color: T.gold }}>{plan.company}</em>.
          </h1>

          <p style={{
            fontSize: "1rem", fontWeight: 300,
            color: T.text2, lineHeight: 1.8,
            maxWidth: 560, marginBottom: 24,
          }}>
            {plan.focus}
          </p>

          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {plan.tags.map((tag, i) => (
              <span key={i} style={{
                fontSize: "0.65rem", fontWeight: 400,
                letterSpacing: "0.1em", textTransform: "uppercase",
                color: T.text3, border: `1px solid ${T.line2}`,
                padding: "4px 12px", borderRadius: 2,
              }}>
                {tag}
              </span>
            ))}
          </div>
        </div>

        {/* Posts */}
        <div style={{ display: "flex", flexDirection: "column", gap: 2, marginBottom: 2 }}>
          {plan.posts.map((post, i) => (
            <Link key={i} href={`/post/${i}`} style={{
              display: "block", padding: "28px 32px",
              background: T.surface, border: `1px solid ${T.line}`,
              borderRadius: 2, textDecoration: "none",
              transition: "border-color .2s, background .2s",
            }}
            onMouseOver={e => { const el = e.currentTarget as HTMLElement; el.style.borderColor = T.line2; el.style.background = T.surface2; }}
            onMouseOut={e => { const el = e.currentTarget as HTMLElement; el.style.borderColor = T.line; el.style.background = T.surface; }}
            >
              <div style={{
                fontSize: "0.62rem", fontWeight: 400,
                letterSpacing: "0.14em", textTransform: "uppercase",
                color: T.text3, marginBottom: 10,
              }}>
                Inlägg {i + 1}
              </div>
              <h2 style={{
                fontFamily: "var(--font-cormorant), serif",
                fontWeight: 400, fontSize: "1.5rem",
                letterSpacing: "-0.01em", lineHeight: 1.2,
                color: T.text, marginBottom: 10,
              }}>
                {post.title}
              </h2>
              <p style={{
                fontSize: "0.85rem", fontWeight: 300,
                color: T.text2, lineHeight: 1.7,
                maxWidth: 640,
              }}>
                {post.text}
              </p>
              <div style={{
                marginTop: 16, fontSize: "0.68rem",
                fontWeight: 400, letterSpacing: "0.1em",
                textTransform: "uppercase", color: T.gold,
              }}>
                {post.cta} →
              </div>
            </Link>
          ))}
        </div>

        {/* Newsletter + Campaign */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 2, marginTop: 2 }}>
          {[
            { href: "/newsletter", label: "Nyhetsbrev", title: plan.newsletter?.subject ?? "Nyhetsbrev" },
            { href: "/campaign", label: "Kampanj", title: plan.campaigns?.[0]?.title ?? "Kampanj" },
          ].map((item) => (
            <Link key={item.href} href={item.href} style={{
              display: "block", padding: "28px 32px",
              background: T.surface, border: `1px solid ${T.line}`,
              borderRadius: 2, textDecoration: "none",
              transition: "border-color .2s, background .2s",
            }}
            onMouseOver={e => { const el = e.currentTarget as HTMLElement; el.style.borderColor = T.line2; el.style.background = T.surface2; }}
            onMouseOut={e => { const el = e.currentTarget as HTMLElement; el.style.borderColor = T.line; el.style.background = T.surface; }}
            >
              <div style={{
                fontSize: "0.62rem", fontWeight: 400,
                letterSpacing: "0.14em", textTransform: "uppercase",
                color: T.text3, marginBottom: 10,
              }}>
                {item.label}
              </div>
              <h2 style={{
                fontFamily: "var(--font-cormorant), serif",
                fontWeight: 400, fontSize: "1.5rem",
                letterSpacing: "-0.01em", lineHeight: 1.2,
                color: T.text,
              }}>
                {item.title}
              </h2>
            </Link>
          ))}
        </div>
      </div>

      <style>{`
        @media (max-width: 640px) {
          nav { padding: 0 20px !important; }
          div[style*="padding: 60px 48px"] { padding: 40px 20px 80px !important; }
          div[style*="grid-template-columns: 1fr 1fr"] { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </main>
  );
}
"use client";

import Link from "next/link";
import { use, useEffect, useState } from "react";

const T = {
  bg: "#0a0908", surface: "#111009", surface2: "#181510",
  line: "rgba(255,248,235,0.08)", line2: "rgba(255,248,235,0.13)",
  text: "#f5f0e8", text2: "rgba(245,240,232,0.55)", text3: "rgba(245,240,232,0.30)",
  gold: "#c9a96e", goldDim: "rgba(201,169,110,0.10)", goldBorder: "rgba(201,169,110,0.22)",
};

type MarketingPost = { title: string; text: string; cta: string; image: string; };
type MarketingPlan = { company: string; focus: string; posts: MarketingPost[]; };

export default function PostPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [plan, setPlan] = useState<MarketingPlan | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem("marketing-copilot-plan");
    if (saved) try { setPlan(JSON.parse(saved)); } catch {}
  }, []);

  function copyPost() {
    if (!post) return;
    navigator.clipboard.writeText(`${post.title}\n\n${post.text}\n\n${post.cta}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  if (!plan) return (
    <main style={{ minHeight: "100svh", background: T.bg, padding: "80px 48px" }}>
      <p style={{ fontSize: "0.88rem", fontWeight: 300, color: T.text2 }}>Laddar inlägg…</p>
    </main>
  );

  const index = Number(id);
  const post = plan.posts[index];

  if (!post) return (
    <main style={{ minHeight: "100svh", background: T.bg, padding: "80px 48px" }}>
      <Link href="/plan" style={{ fontSize: "0.7rem", fontWeight: 400, letterSpacing: "0.1em", textTransform: "uppercase", color: T.text3, textDecoration: "none" }}>← Till planen</Link>
      <p style={{ marginTop: 80, fontSize: "1rem", fontWeight: 300, color: T.text2 }}>Inlägget kunde inte hittas.</p>
    </main>
  );

  const blocks = [
    { label: "Text", content: post.text },
    { label: "Call to action", content: post.cta },
    { label: "Bildidé", content: post.image },
  ];

  return (
    <main style={{ minHeight: "100svh", background: T.bg }}>

      {/* Nav */}
      <nav style={{
        position: "sticky", top: 0, zIndex: 100,
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "0 48px", height: 56,
        background: "rgba(10,9,8,0.92)", backdropFilter: "blur(20px)",
        borderBottom: `1px solid ${T.line}`,
      }}>
        <Link href="/plan" style={{ fontSize: "0.7rem", fontWeight: 400, letterSpacing: "0.1em", textTransform: "uppercase", color: T.text3, textDecoration: "none", transition: "color .2s" }}
          onMouseOver={e => (e.currentTarget as HTMLElement).style.color = T.text2}
          onMouseOut={e => (e.currentTarget as HTMLElement).style.color = T.text3}
        >
          ← Planen
        </Link>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {index > 0 && (
            <Link href={`/post/${index - 1}`} style={{ fontFamily: "var(--font-outfit), sans-serif", fontSize: "0.68rem", fontWeight: 400, letterSpacing: "0.1em", textTransform: "uppercase", padding: "7px 14px", borderRadius: 2, border: `1px solid ${T.line2}`, background: "transparent", color: T.text3, textDecoration: "none" }}>← Föregående</Link>
          )}
          {index < plan.posts.length - 1 && (
            <Link href={`/post/${index + 1}`} style={{ fontFamily: "var(--font-outfit), sans-serif", fontSize: "0.68rem", fontWeight: 400, letterSpacing: "0.1em", textTransform: "uppercase", padding: "7px 14px", borderRadius: 2, border: `1px solid ${T.line2}`, background: "transparent", color: T.text3, textDecoration: "none" }}>Nästa →</Link>
          )}
          <button onClick={copyPost} style={{
            fontFamily: "var(--font-outfit), sans-serif", fontSize: "0.68rem", fontWeight: 400,
            letterSpacing: "0.1em", textTransform: "uppercase", padding: "7px 16px",
            borderRadius: 2, border: "none", background: T.gold, color: T.bg,
            cursor: "pointer", transition: "all .2s",
          }}>
            {copied ? "✓ Kopierat" : "Kopiera"}
          </button>
        </div>
      </nav>

      <div style={{ maxWidth: 800, margin: "0 auto", padding: "60px 48px 100px" }}>

        {/* Header */}
        <div style={{ marginBottom: 56 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12, fontSize: "0.65rem", fontWeight: 400, letterSpacing: "0.18em", textTransform: "uppercase", color: T.gold, marginBottom: 16 }}>
            <span style={{ width: 18, height: 1, background: T.gold, opacity: .5, display: "block" }} />
            {plan.company} · Inlägg {index + 1} av {plan.posts.length}
          </div>
          <h1 style={{ fontFamily: "var(--font-cormorant), serif", fontWeight: 300, fontSize: "clamp(2.4rem,5vw,4rem)", lineHeight: .95, letterSpacing: "-0.02em", color: T.text, marginBottom: 16 }}>
            {post.title}
          </h1>
          <p style={{ fontSize: "0.85rem", fontWeight: 300, color: T.text3, letterSpacing: "0.04em" }}>
            Färdigt att publicera
          </p>
        </div>

        {/* Content blocks */}
        <div style={{ borderTop: `1px solid ${T.line}` }}>
          {blocks.map(b => (
            <div key={b.label} style={{ padding: "28px 0", borderBottom: `1px solid ${T.line}` }}>
              <div style={{ fontSize: "0.63rem", fontWeight: 400, letterSpacing: "0.14em", textTransform: "uppercase", color: T.text3, marginBottom: 12 }}>{b.label}</div>
              <p style={{ fontSize: "1rem", fontWeight: 300, color: T.text2, lineHeight: 1.8, maxWidth: 620 }}>{b.content}</p>
            </div>
          ))}
        </div>

        {/* Actions */}
        <div style={{ display: "flex", gap: 10, marginTop: 36, flexWrap: "wrap" }}>
          <button onClick={copyPost} style={{ fontFamily: "var(--font-outfit), sans-serif", fontSize: "0.72rem", fontWeight: 400, letterSpacing: "0.1em", textTransform: "uppercase", padding: "11px 24px", borderRadius: 2, border: "none", background: T.gold, color: T.bg, cursor: "pointer" }}>
            {copied ? "✓ Kopierat" : "Kopiera inlägg"}
          </button>
          <button style={{ fontFamily: "var(--font-outfit), sans-serif", fontSize: "0.72rem", fontWeight: 400, letterSpacing: "0.1em", textTransform: "uppercase", padding: "11px 18px", borderRadius: 2, border: `1px solid ${T.line2}`, background: "transparent", color: T.text3, cursor: "pointer" }}>
            Bra
          </button>
          <button style={{ fontFamily: "var(--font-outfit), sans-serif", fontSize: "0.72rem", fontWeight: 400, letterSpacing: "0.1em", textTransform: "uppercase", padding: "11px 18px", borderRadius: 2, border: `1px solid ${T.line2}`, background: "transparent", color: T.text3, cursor: "pointer" }}>
            Mindre bra
          </button>
        </div>

        {/* Post navigation */}
        <div style={{ display: "flex", gap: 2, marginTop: 48, borderTop: `1px solid ${T.line}`, paddingTop: 28 }}>
          {plan.posts.map((p, i) => (
            <Link key={i} href={`/post/${i}`} style={{
              flex: 1, padding: "10px 8px", textAlign: "center",
              background: i === index ? T.goldDim : T.surface,
              border: `1px solid ${i === index ? T.goldBorder : T.line}`,
              borderRadius: 2, textDecoration: "none", transition: "all .15s",
            }}>
              <div style={{ fontSize: "0.6rem", fontWeight: 400, letterSpacing: "0.1em", textTransform: "uppercase", color: i === index ? T.gold : T.text3 }}>
                {i + 1}
              </div>
            </Link>
          ))}
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
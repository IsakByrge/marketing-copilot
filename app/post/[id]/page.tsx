"use client";

import Link from "next/link";
import { use, useEffect, useState } from "react";

const T = {
  bg: "#2a2f3a", surface: "#323845", surface2: "#3a4050",
  line: "rgba(255,255,255,0.10)", line2: "rgba(255,255,255,0.18)",
  text: "#ffffff", text2: "#cbd5e0", text3: "#a0aec0",
  gold: "#c9a96e", goldDim: "rgba(201,169,110,0.15)", goldBorder: "rgba(201,169,110,0.30)",
};

type MarketingPost = { title: string; text: string; cta: string; image: string; };
type MarketingPlan = { company: string; focus: string; posts: MarketingPost[]; };

export default function PostPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [plan, setPlan] = useState<MarketingPlan | null>(null);
  const [copied, setCopied] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [generatingImage, setGeneratingImage] = useState(false);
const [generatedImage, setGeneratedImage] = useState<string | null>(null);

  useEffect(() => {
    const saved = localStorage.getItem("marketing-copilot-plan");
    if (saved) try { setPlan(JSON.parse(saved)); } catch {}
    const check = () => setIsMobile(window.innerWidth < 640);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  function copyPost() {
    if (!post) return;
    navigator.clipboard.writeText(`${post.title}\n\n${post.text}\n\n${post.cta}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }
  async function generateImage() {
  if (!post || !plan) return;
  setGeneratingImage(true);
  try {
    const response = await fetch("/api/generate-image", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt: post.image, companyName: plan.company }),
    });
    const data = await response.json();
    if (data.url) setGeneratedImage(data.url);
  } catch (e) { console.error(e); }
  finally { setGeneratingImage(false); }
}

  if (!plan) return (
    <main style={{ minHeight: "100svh", background: T.bg, padding: "80px 20px" }}>
      <p style={{ fontSize: "0.88rem", fontWeight: 300, color: T.text2 }}>Laddar inlägg…</p>
    </main>
  );

  const index = Number(id);
  const post = plan.posts[index];

  if (!post) return (
    <main style={{ minHeight: "100svh", background: T.bg, padding: "80px 20px" }}>
      <Link href="/plan" style={{ fontSize: "0.7rem", fontWeight: 400, letterSpacing: "0.1em", textTransform: "uppercase", color: T.text3, textDecoration: "none" }}>← Till planen</Link>
      <p style={{ marginTop: 80, fontSize: "1rem", fontWeight: 300, color: T.text2 }}>Inlägget kunde inte hittas.</p>
    </main>
  );

  const pad = isMobile ? 20 : 48;

  const blocks = [
    { label: "Text", content: post.text },
    { label: "Call to action", content: post.cta },
  ];

  return (
    <main style={{ minHeight: "100svh", background: T.bg }}>

      {/* Nav */}
      <nav style={{
        position: "sticky", top: 0, zIndex: 100,
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: `0 ${pad}px`, height: 56,
        background: "rgba(42,47,58,0.95)", backdropFilter: "blur(20px)",
        borderBottom: `1px solid ${T.line}`,
        gap: 8,
      }}>
        <Link href="/plan" style={{
          fontSize: "0.7rem", fontWeight: 400, letterSpacing: "0.1em",
          textTransform: "uppercase", color: T.text3, textDecoration: "none",
          flexShrink: 0,
        }}>
          ← {isMobile ? "" : "Planen"}
        </Link>

        <div style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
          {/* Prev/next only on desktop */}
          {!isMobile && index > 0 && (
            <Link href={`/post/${index - 1}`} style={{ fontFamily: "var(--font-outfit), sans-serif", fontSize: "0.68rem", fontWeight: 400, letterSpacing: "0.1em", textTransform: "uppercase", padding: "7px 12px", borderRadius: 2, border: `1px solid ${T.line2}`, background: "transparent", color: T.text3, textDecoration: "none" }}>← Föregående</Link>
          )}
          {!isMobile && index < plan.posts.length - 1 && (
            <Link href={`/post/${index + 1}`} style={{ fontFamily: "var(--font-outfit), sans-serif", fontSize: "0.68rem", fontWeight: 400, letterSpacing: "0.1em", textTransform: "uppercase", padding: "7px 12px", borderRadius: 2, border: `1px solid ${T.line2}`, background: "transparent", color: T.text3, textDecoration: "none" }}>Nästa →</Link>
          )}
          {/* On mobile: show inlägg X/Y */}
          {isMobile && (
            <span style={{ fontSize: "0.68rem", fontWeight: 300, color: T.text3, letterSpacing: "0.06em" }}>
              {index + 1} / {plan.posts.length}
            </span>
          )}
          <button onClick={copyPost} style={{
            fontFamily: "var(--font-outfit), sans-serif",
            fontSize: "0.68rem", fontWeight: 400,
            letterSpacing: "0.1em", textTransform: "uppercase",
            padding: "7px 14px", borderRadius: 2,
            border: "none", background: T.gold, color: T.bg,
            cursor: "pointer", flexShrink: 0,
          }}>
            {copied ? "✓" : "Kopiera"}
          </button>
        </div>
      </nav>

      <div style={{ maxWidth: 800, margin: "0 auto", padding: `48px ${pad}px 100px` }}>

        {/* Header */}
        <div style={{ marginBottom: 48 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, fontSize: "0.63rem", fontWeight: 400, letterSpacing: "0.18em", textTransform: "uppercase", color: T.gold, marginBottom: 14 }}>
            <span style={{ width: 16, height: 1, background: T.gold, opacity: .5, display: "block" }} />
            {plan.company} · Inlägg {index + 1} av {plan.posts.length}
          </div>
          <h1 style={{
            fontFamily: "var(--font-cormorant), serif", fontWeight: 300,
            fontSize: isMobile ? "clamp(2rem,8vw,2.8rem)" : "clamp(2.4rem,5vw,4rem)",
            lineHeight: .95, letterSpacing: "-0.02em", color: T.text, marginBottom: 12,
          }}>
            {post.title}
          </h1>
          <p style={{ fontSize: "0.8rem", fontWeight: 300, color: T.text3, letterSpacing: "0.04em" }}>
            Färdigt att publicera
          </p>
        </div>

        {/* Content blocks */}
<div style={{ borderTop: `1px solid ${T.line}` }}>
  {blocks.map(b => (
    <div key={b.label} style={{ padding: "24px 0", borderBottom: `1px solid ${T.line}` }}>
      <div style={{ fontSize: "0.62rem", fontWeight: 400, letterSpacing: "0.14em", textTransform: "uppercase", color: T.text3, marginBottom: 10 }}>{b.label}</div>
      <p style={{ fontSize: isMobile ? "0.95rem" : "1rem", fontWeight: 300, color: T.text2, lineHeight: 1.8 }}>{b.content}</p>
    </div>
  ))}

  {/* Bildsektion */}
  <div style={{ padding: "24px 0", borderBottom: `1px solid ${T.line}` }}>
    <div style={{ fontSize: "0.62rem", fontWeight: 400, letterSpacing: "0.14em", textTransform: "uppercase", color: T.text3, marginBottom: 10 }}>Bildidé</div>
    <p style={{ fontSize: isMobile ? "0.95rem" : "1rem", fontWeight: 300, color: T.text2, lineHeight: 1.8, marginBottom: 16 }}>{post.image}</p>

    {generatedImage ? (
      <div>
        <img src={generatedImage} alt="Genererad bild" style={{ width: "100%", borderRadius: 2, border: `1px solid ${T.line}` }} />
        <button onClick={generateImage} disabled={generatingImage} style={{ marginTop: 12, fontFamily: "var(--font-outfit), sans-serif", fontSize: "0.68rem", fontWeight: 400, letterSpacing: "0.1em", textTransform: "uppercase", padding: "7px 14px", borderRadius: 2, border: `1px solid ${T.line2}`, background: "transparent", color: T.text3, cursor: "pointer" }}>
          Generera ny
        </button>
      </div>
    ) : (
      <button onClick={generateImage} disabled={generatingImage} style={{
        display: "inline-flex", alignItems: "center", gap: 8,
        fontFamily: "var(--font-outfit), sans-serif", fontSize: "0.72rem", fontWeight: 400,
        letterSpacing: "0.1em", textTransform: "uppercase", padding: "11px 22px",
        borderRadius: 2, border: `1px solid ${T.line2}`, background: "transparent",
        color: generatingImage ? T.text3 : T.text2, cursor: generatingImage ? "not-allowed" : "pointer",
      }}>
        {generatingImage && <span style={{ width: 12, height: 12, borderRadius: "50%", border: `1.5px solid ${T.line2}`, borderTopColor: T.gold, display: "inline-block", animation: "spin .7s linear infinite" }} />}
        {generatingImage ? "Genererar…" : "✦ Generera bild"}
      </button>
    )}
  </div>
</div>

        {/* Actions */}
        <div style={{ display: "flex", gap: 8, marginTop: 32, flexWrap: "wrap" }}>
          <button onClick={copyPost} style={{
            fontFamily: "var(--font-outfit), sans-serif", fontSize: "0.72rem", fontWeight: 400,
            letterSpacing: "0.1em", textTransform: "uppercase",
            padding: "11px 22px", borderRadius: 2, border: "none",
            background: T.gold, color: T.bg, cursor: "pointer",
            flex: isMobile ? 1 : "none",
          }}>
            {copied ? "✓ Kopierat" : "Kopiera inlägg"}
          </button>
          <button style={{ fontFamily: "var(--font-outfit), sans-serif", fontSize: "0.72rem", fontWeight: 400, letterSpacing: "0.1em", textTransform: "uppercase", padding: "11px 16px", borderRadius: 2, border: `1px solid ${T.line2}`, background: "transparent", color: T.text3, cursor: "pointer" }}>Bra</button>
          <button style={{ fontFamily: "var(--font-outfit), sans-serif", fontSize: "0.72rem", fontWeight: 400, letterSpacing: "0.1em", textTransform: "uppercase", padding: "11px 16px", borderRadius: 2, border: `1px solid ${T.line2}`, background: "transparent", color: T.text3, cursor: "pointer" }}>Mindre bra</button>
        </div>

        {/* Post navigation dots */}
        <div style={{ display: "flex", gap: 2, marginTop: 40, borderTop: `1px solid ${T.line}`, paddingTop: 24 }}>
          {plan.posts.map((_, i) => (
            <Link key={i} href={`/post/${i}`} style={{
              flex: 1, padding: isMobile ? "8px 4px" : "10px 8px",
              textAlign: "center",
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

        {/* Mobile prev/next */}
        {isMobile && (
          <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
            {index > 0 ? (
              <Link href={`/post/${index - 1}`} style={{ flex: 1, textAlign: "center", fontFamily: "var(--font-outfit), sans-serif", fontSize: "0.68rem", fontWeight: 400, letterSpacing: "0.1em", textTransform: "uppercase", padding: "11px", borderRadius: 2, border: `1px solid ${T.line2}`, color: T.text3, textDecoration: "none" }}>← Föregående</Link>
            ) : <div style={{ flex: 1 }} />}
            {index < plan.posts.length - 1 ? (
              <Link href={`/post/${index + 1}`} style={{ flex: 1, textAlign: "center", fontFamily: "var(--font-outfit), sans-serif", fontSize: "0.68rem", fontWeight: 400, letterSpacing: "0.1em", textTransform: "uppercase", padding: "11px", borderRadius: 2, border: `1px solid ${T.line2}`, color: T.text3, textDecoration: "none" }}>Nästa →</Link>
            ) : <div style={{ flex: 1 }} />}
          </div>
        )}
      </div>
    </main>
  );
}
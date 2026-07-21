"use client";

import Link from "next/link";
import { use, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase-browser";

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
  const [uploadedImage, setUploadedImage] = useState<File | null>(null);
  const [editedImage, setEditedImage] = useState<string | null>(null);
  const [editingImage, setEditingImage] = useState(false);
  const [feedback, setFeedback] = useState<"up" | "down" | null>(null);
  const [feedbackSaved, setFeedbackSaved] = useState(false);

  const index = Number(id);

  useEffect(() => {
    const saved = localStorage.getItem("marketing-copilot-plan");
    let parsedPlan: MarketingPlan | null = null;
    if (saved) try { parsedPlan = JSON.parse(saved); } catch {}
    // parsedPlan används synkront nedan; state-uppdateringen defereras ur effektkroppen.
    if (parsedPlan) { const p = parsedPlan; queueMicrotask(() => setPlan(p)); }
    const check = () => setIsMobile(window.innerWidth < 640);
    check();
    window.addEventListener("resize", check);

    (async () => {
      try {
        if (!parsedPlan) return;
        const sb = createClient();
        const { data: { user } } = await sb.auth.getUser();
        if (!user) return;
        const { data } = await sb
          .from("content_feedback")
          .select("rating_text")
          .eq("user_id", user.id)
          .eq("company_name", parsedPlan.company)
          .eq("post_index", index)
          .limit(1);
        if (data && data[0]) setFeedback(data[0].rating_text === "up" ? "up" : "down");
      } catch {}
    })();

    return () => window.removeEventListener("resize", check);
  }, [index]);

  function copyPost() {
    if (!post) return;
    navigator.clipboard.writeText(`${post.title}\n\n${post.text}\n\n${post.cta}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  async function saveFeedback(rating: "up" | "down") {
    if (!plan || !post) return;
    setFeedback(rating);
    setFeedbackSaved(true);
    setTimeout(() => setFeedbackSaved(false), 2000);

    try {
      const sb = createClient();
      const { data: { user } } = await sb.auth.getUser();
      if (!user) return;
      await sb.from("content_feedback").upsert({
        user_id: user.id,
        company_name: plan.company,
        post_index: index,
        post_title: post.title,
        rating_text: rating,
      }, { onConflict: "user_id,company_name,post_index" });
    } catch (e) {
      console.warn("Kunde inte spara feedback:", e);
    }
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
      if (data.image) setGeneratedImage(data.image);
    } catch (e) { console.error(e); }
    finally { setGeneratingImage(false); }
  }

  async function editImage() {
    if (!post || !plan || !uploadedImage) return;
    setEditingImage(true);
    try {
      const formData = new FormData();
      formData.append("image", uploadedImage);
      formData.append("prompt", post.image);
      formData.append("companyName", plan.company);

      const response = await fetch("/api/edit-image", {
        method: "POST",
        body: formData,
      });
      const data = await response.json();
      if (data.image) setEditedImage(data.image);
    } catch (e) { console.error(e); }
    finally { setEditingImage(false); }
  }

  if (!plan) return (
    <main style={{ minHeight: "100svh", background: T.bg, padding: "80px 20px" }}>
      <p style={{ fontSize: "0.88rem", fontWeight: 300, color: T.text2 }}>Laddar inlägg…</p>
    </main>
  );

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

  const displayImage = editedImage || generatedImage;

  return (
    <main style={{ minHeight: "100svh", background: T.bg }}>

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
          {!isMobile && index > 0 && (
            <Link href={`/post/${index - 1}`} style={{ fontFamily: "var(--font-outfit), sans-serif", fontSize: "0.68rem", fontWeight: 400, letterSpacing: "0.1em", textTransform: "uppercase", padding: "7px 12px", borderRadius: 2, border: `1px solid ${T.line2}`, background: "transparent", color: T.text3, textDecoration: "none" }}>← Föregående</Link>
          )}
          {!isMobile && index < plan.posts.length - 1 && (
            <Link href={`/post/${index + 1}`} style={{ fontFamily: "var(--font-outfit), sans-serif", fontSize: "0.68rem", fontWeight: 400, letterSpacing: "0.1em", textTransform: "uppercase", padding: "7px 12px", borderRadius: 2, border: `1px solid ${T.line2}`, background: "transparent", color: T.text3, textDecoration: "none" }}>Nästa →</Link>
          )}
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

        <div style={{ borderTop: `1px solid ${T.line}` }}>
          {blocks.map(b => (
            <div key={b.label} style={{ padding: "24px 0", borderBottom: `1px solid ${T.line}` }}>
              <div style={{ fontSize: "0.62rem", fontWeight: 400, letterSpacing: "0.14em", textTransform: "uppercase", color: T.text3, marginBottom: 10 }}>{b.label}</div>
              <p style={{ fontSize: isMobile ? "0.95rem" : "1rem", fontWeight: 300, color: T.text2, lineHeight: 1.8 }}>{b.content}</p>
            </div>
          ))}

          <div style={{ padding: "24px 0", borderBottom: `1px solid ${T.line}` }}>
            <div style={{ fontSize: "0.62rem", fontWeight: 400, letterSpacing: "0.14em", textTransform: "uppercase", color: T.text3, marginBottom: 10 }}>Bild</div>
            <p style={{ fontSize: isMobile ? "0.95rem" : "1rem", fontWeight: 300, color: T.text2, lineHeight: 1.8, marginBottom: 16 }}>{post.image}</p>

            {displayImage && (
              <div style={{ marginBottom: 16 }}>
                <img src={displayImage} alt="Bild" style={{ width: "100%", borderRadius: 2, border: `1px solid ${T.line}` }} />
              </div>
            )}

            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <div>
                <label style={{ display: "block", fontSize: "0.62rem", fontWeight: 400, letterSpacing: "0.1em", textTransform: "uppercase", color: T.text3, marginBottom: 8 }}>
                  Ladda upp din produktbild
                </label>
                <input
                  type="file"
                  accept="image/*"
                  onChange={e => setUploadedImage(e.target.files?.[0] || null)}
                  style={{ fontSize: "0.8rem", color: T.text2, background: "transparent", border: "none", cursor: "pointer" }}
                />
                {uploadedImage && (
                  <p style={{ marginTop: 4, fontSize: "0.72rem", color: T.gold }}>✓ {uploadedImage.name}</p>
                )}
              </div>

              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                {uploadedImage && (
                  <button onClick={editImage} disabled={editingImage} style={{
                    display: "inline-flex", alignItems: "center", gap: 8,
                    fontFamily: "var(--font-outfit), sans-serif", fontSize: "0.72rem", fontWeight: 400,
                    letterSpacing: "0.1em", textTransform: "uppercase", padding: "11px 22px",
                    borderRadius: 2, border: "none", background: T.gold,
                    color: T.bg, cursor: editingImage ? "not-allowed" : "pointer",
                  }}>
                    {editingImage && <span style={{ width: 12, height: 12, borderRadius: "50%", border: `1.5px solid rgba(0,0,0,0.2)`, borderTopColor: T.bg, display: "inline-block", animation: "spin .7s linear infinite" }} />}
                    {editingImage ? "Redigerar…" : "✦ Placera i ny miljö"}
                  </button>
                )}

                <button onClick={generateImage} disabled={generatingImage} style={{
                  display: "inline-flex", alignItems: "center", gap: 8,
                  fontFamily: "var(--font-outfit), sans-serif", fontSize: "0.72rem", fontWeight: 400,
                  letterSpacing: "0.1em", textTransform: "uppercase", padding: "11px 22px",
                  borderRadius: 2, border: `1px solid ${T.line2}`, background: "transparent",
                  color: generatingImage ? T.text3 : T.text2, cursor: generatingImage ? "not-allowed" : "pointer",
                }}>
                  {generatingImage && <span style={{ width: 12, height: 12, borderRadius: "50%", border: `1.5px solid ${T.line2}`, borderTopColor: T.gold, display: "inline-block", animation: "spin .7s linear infinite" }} />}
                  {generatingImage ? "Genererar…" : "Generera AI-bild"}
                </button>
              </div>
            </div>
          </div>
        </div>

        <div style={{ display: "flex", gap: 8, marginTop: 32, flexWrap: "wrap", alignItems: "center" }}>
          <button onClick={copyPost} style={{
            fontFamily: "var(--font-outfit), sans-serif", fontSize: "0.72rem", fontWeight: 400,
            letterSpacing: "0.1em", textTransform: "uppercase",
            padding: "11px 22px", borderRadius: 2, border: "none",
            background: T.gold, color: T.bg, cursor: "pointer",
            flex: isMobile ? 1 : "none",
          }}>
            {copied ? "✓ Kopierat" : "Kopiera inlägg"}
          </button>

          <button onClick={() => saveFeedback("up")} style={{
            fontFamily: "var(--font-outfit), sans-serif", fontSize: "0.72rem", fontWeight: 400,
            letterSpacing: "0.1em", textTransform: "uppercase", padding: "11px 16px", borderRadius: 2,
            border: `1px solid ${feedback === "up" ? T.goldBorder : T.line2}`,
            background: feedback === "up" ? T.goldDim : "transparent",
            color: feedback === "up" ? T.gold : T.text3, cursor: "pointer", transition: "all .15s",
          }}>
            👍 Bra
          </button>

          <button onClick={() => saveFeedback("down")} style={{
            fontFamily: "var(--font-outfit), sans-serif", fontSize: "0.72rem", fontWeight: 400,
            letterSpacing: "0.1em", textTransform: "uppercase", padding: "11px 16px", borderRadius: 2,
            border: `1px solid ${feedback === "down" ? T.goldBorder : T.line2}`,
            background: feedback === "down" ? T.goldDim : "transparent",
            color: feedback === "down" ? T.gold : T.text3, cursor: "pointer", transition: "all .15s",
          }}>
            👎 Mindre bra
          </button>

          {feedbackSaved && (
            <span style={{ fontSize: "0.72rem", fontWeight: 300, color: T.gold, letterSpacing: "0.04em" }}>
              ✓ Tack, AI:n lär sig
            </span>
          )}
        </div>

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

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </main>
  );
}
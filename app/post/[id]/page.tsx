"use client";

// ─────────────────────────────────────────────────────────────
// Socialt inlägg — enskild post ur marketing-copilot-plan
// (localStorage). All logik är oförändrad: feedback-tummar
// (Supabase content_feedback, samma upsert/select), AI-bild-
// generering (/api/generate-image) och bildredigering
// (/api/edit-image) med exakt samma anrop och fält som förut.
// Bara presentationen är migrerad till Shell + det delade
// designsystemet. Tillbaka-länken pekade tidigare på /plan
// (oåtkomlig från navigationen) — pekar nu på /content.
// ─────────────────────────────────────────────────────────────
import Link from "next/link";
import { use, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase-browser";
import Shell from "@/app/_shared/Shell";
import { T, fontSans, transition } from "@/app/_shared/theme";
import { PageHeader, GhostButton, PrimaryButton, CopyButton, ResultBlock, ResultCard, EmptyState } from "@/app/_shared/ui";
import { IconContent } from "@/app/_shared/icons";

type MarketingPost = { title: string; text: string; cta: string; image: string };
type MarketingPlan = { company: string; focus: string; posts: MarketingPost[] };

export default function PostPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [plan, setPlan] = useState<MarketingPlan | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [generatingImage, setGeneratingImage] = useState(false);
  const [generatedImage, setGeneratedImage] = useState<string | null>(null);
  const [uploadedImage, setUploadedImage] = useState<File | null>(null);
  const [editedImage, setEditedImage] = useState<string | null>(null);
  const [editingImage, setEditingImage] = useState(false);
  const [feedback, setFeedback] = useState<"up" | "down" | null>(null);
  const [feedbackSaved, setFeedbackSaved] = useState(false);

  const index = Number(id);

  useEffect(() => {
    function loadPlan(): MarketingPlan | null {
      const saved = localStorage.getItem("marketing-copilot-plan");
      let parsed: MarketingPlan | null = null;
      if (saved) try { parsed = JSON.parse(saved); setPlan(parsed); } catch { /* ignorera trasig data */ }
      setLoaded(true);
      return parsed;
    }
    const parsedPlan = loadPlan();

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
      } catch { /* feedback är kosmetisk — ingen felhantering krävs */ }
    })();
  }, [index]);

  const post = plan?.posts[index];

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

  const displayImage = editedImage || generatedImage;

  return (
    <Shell>
      <div style={{ maxWidth: 800, margin: "0 auto", padding: "56px 40px 100px" }}>
        {!loaded ? (
          <div className="skel" style={{ width: "100%", height: 200, borderRadius: 16 }} />
        ) : !post ? (
          <>
            <PageHeader eyebrow="Socialt inlägg" title="Inlägget kunde inte hittas." />
            <EmptyState
              icon={<IconContent size={19} />}
              title="Inget inlägg här."
              body="Innehållet kan ha bytts ut sedan du senast var här."
              action={<GhostButton href="/content">Till Innehåll</GhostButton>}
            />
          </>
        ) : (
          <div className="fade-up">
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8, flexWrap: "wrap", gap: 12 }}>
              <PageHeader
                eyebrow={`${plan!.company} · Inlägg ${index + 1} av ${plan!.posts.length}`}
                title={post.title}
                subtitle="Färdigt att publicera."
              />
              <CopyButton getText={() => `${post.title}\n\n${post.text}\n\n${post.cta}`} />
            </div>

            <ResultCard>
              <ResultBlock label="Text" content={post.text} />
              <ResultBlock label="Call to action" content={post.cta} />

              <div style={{ padding: "22px 0" }}>
                <div style={{ fontFamily: fontSans, fontSize: "0.68rem", fontWeight: 500, letterSpacing: "0.1em", textTransform: "uppercase", color: T.text3, marginBottom: 10 }}>Bild</div>
                <p style={{ fontFamily: fontSans, fontSize: "0.9rem", fontWeight: 300, color: T.text2, lineHeight: 1.75, marginBottom: 18 }}>{post.image}</p>

                {displayImage && (
                  <div style={{ marginBottom: 18 }}>
                    <img src={displayImage} alt="Genererad bild" style={{ width: "100%", borderRadius: 12, border: `1px solid ${T.line}` }} />
                  </div>
                )}

                <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                  <div>
                    <label style={{ display: "block", fontFamily: fontSans, fontSize: "0.68rem", fontWeight: 500, letterSpacing: "0.1em", textTransform: "uppercase", color: T.text3, marginBottom: 8 }}>
                      Ladda upp din produktbild
                    </label>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={(e) => setUploadedImage(e.target.files?.[0] || null)}
                      style={{ fontFamily: fontSans, fontSize: "0.82rem", color: T.text2, background: "transparent", border: "none", cursor: "pointer" }}
                    />
                    {uploadedImage && (
                      <p style={{ marginTop: 6, fontFamily: fontSans, fontSize: "0.76rem", color: T.purpleBright }}>✓ {uploadedImage.name}</p>
                    )}
                  </div>

                  <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                    {uploadedImage && (
                      <PrimaryButton onClick={editImage}>{editingImage ? "Redigerar…" : "✦ Placera i ny miljö"}</PrimaryButton>
                    )}
                    <GhostButton onClick={generateImage}>{generatingImage ? "Genererar…" : "Generera AI-bild"}</GhostButton>
                  </div>
                </div>
              </div>
            </ResultCard>

            <div style={{ display: "flex", gap: 10, marginTop: 28, flexWrap: "wrap", alignItems: "center" }}>
              <CopyButton getText={() => `${post.title}\n\n${post.text}\n\n${post.cta}`} label="Kopiera inlägg" />

              <button type="button" onClick={() => saveFeedback("up")} className="mcx-focusable" style={{
                fontFamily: fontSans, fontSize: "0.82rem", fontWeight: 400,
                padding: "12px 18px", borderRadius: 10, cursor: "pointer", transition,
                border: `1px solid ${feedback === "up" ? T.purpleBorder : T.line2}`,
                background: feedback === "up" ? T.purpleDim : "transparent",
                color: feedback === "up" ? T.purpleBright : T.text3,
              }}>
                👍 Bra
              </button>
              <button type="button" onClick={() => saveFeedback("down")} className="mcx-focusable" style={{
                fontFamily: fontSans, fontSize: "0.82rem", fontWeight: 400,
                padding: "12px 18px", borderRadius: 10, cursor: "pointer", transition,
                border: `1px solid ${feedback === "down" ? T.purpleBorder : T.line2}`,
                background: feedback === "down" ? T.purpleDim : "transparent",
                color: feedback === "down" ? T.purpleBright : T.text3,
              }}>
                👎 Mindre bra
              </button>

              {feedbackSaved && (
                <span style={{ fontFamily: fontSans, fontSize: "0.78rem", fontWeight: 400, color: T.purpleBright }}>
                  ✓ Tack, AI:n lär sig
                </span>
              )}
            </div>

            {plan!.posts.length > 1 && (
              <div style={{ display: "flex", gap: 2, marginTop: 36, borderTop: `1px solid ${T.line}`, paddingTop: 22 }}>
                {plan!.posts.map((_, i) => (
                  <Link key={i} href={`/post/${i}`} style={{
                    flex: 1, padding: "9px 6px", textAlign: "center", textDecoration: "none",
                    background: i === index ? T.purpleDim : T.surface,
                    border: `1px solid ${i === index ? T.purpleBorder : T.line}`,
                    borderRadius: 8, transition,
                  }}>
                    <span style={{ fontFamily: fontSans, fontSize: "0.68rem", fontWeight: 500, color: i === index ? T.purpleBright : T.text3 }}>
                      {i + 1}
                    </span>
                  </Link>
                ))}
              </div>
            )}

            <div style={{ display: "flex", gap: 10, marginTop: 18, flexWrap: "wrap" }}>
              {index > 0 && <GhostButton href={`/post/${index - 1}`}>← Föregående</GhostButton>}
              {index < (plan!.posts.length - 1) && <GhostButton href={`/post/${index + 1}`}>Nästa →</GhostButton>}
              <GhostButton href="/content">Till Innehåll</GhostButton>
            </div>
          </div>
        )}
      </div>
    </Shell>
  );
}

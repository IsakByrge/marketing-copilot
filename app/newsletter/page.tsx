"use client";

// ─────────────────────────────────────────────────────────────
// Nyhetsbrev — visar det senast genererade nyhetsbrevet ur
// marketing-copilot-plan (localStorage). Samma datakälla och
// samma innehåll som förut, bara migrerad till Shell + det
// delade designsystemet. Tillbaka-länken pekade tidigare på
// /plan, som inte längre nås från någonstans i navigationen —
// pekar nu på /content (Innehåll), den riktiga efterträdaren.
// ─────────────────────────────────────────────────────────────
import { useEffect, useState } from "react";
import Shell from "@/app/_shared/Shell";
import { T, fontSans } from "@/app/_shared/theme";
import { PageHeader, GhostButton, CopyButton, ResultBlock, ResultCard, EmptyState } from "@/app/_shared/ui";
import { IconContent } from "@/app/_shared/icons";

type Newsletter = { subject: string; preview: string; body: string; cta: string };
type MarketingPlan = { company: string; focus: string; newsletter?: Newsletter };

export default function NewsletterPage() {
  const [plan, setPlan] = useState<MarketingPlan | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    function load() {
      const saved = localStorage.getItem("marketing-copilot-plan");
      if (saved) try { setPlan(JSON.parse(saved)); } catch { /* ignorera trasig data */ }
      setLoaded(true);
    }
    load();
  }, []);

  const n = plan?.newsletter;
  const fullText = n ? `ÄMNESRAD: ${n.subject}\nFÖRHANDSVISNING: ${n.preview}\n\n${n.body}\n\n${n.cta}` : "";

  return (
    <Shell>
      <div style={{ maxWidth: 800, margin: "0 auto", padding: "56px 40px 100px" }}>
        {!loaded ? (
          <div className="skel" style={{ width: "100%", height: 200, borderRadius: 16 }} />
        ) : !n ? (
          <>
            <PageHeader eyebrow="Nyhetsbrev" title="Inget nyhetsbrev hittades." />
            <EmptyState
              icon={<IconContent size={19} />}
              title="Inget nyhetsbrev genererat ännu."
              body="Skapa ett i Campaign Builder eller via en snabbåtgärd på Idag."
              action={<GhostButton href="/content">Till Innehåll</GhostButton>}
            />
          </>
        ) : (
          <div className="fade-up">
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8, flexWrap: "wrap", gap: 12 }}>
              <PageHeader eyebrow={`${plan!.company} · Nyhetsbrev`} title={n.subject} subtitle="Färdigt att skicka." />
              <CopyButton getText={() => fullText} label="Kopiera allt" />
            </div>

            {/* E-post förhandsvisning */}
            <div style={{ background: T.surface, border: `1px solid ${T.line}`, borderRadius: 16, overflow: "hidden", marginBottom: 28 }}>
              <div style={{ background: T.surface2, borderBottom: `1px solid ${T.line}`, padding: "12px 20px", display: "flex", alignItems: "center", gap: 10 }}>
                <div style={{ display: "flex", gap: 5 }}>
                  {[0, 1, 2].map((i) => <div key={i} style={{ width: 8, height: 8, borderRadius: "50%", background: "rgba(255,255,255,0.10)" }} />)}
                </div>
                <span style={{ fontFamily: fontSans, fontSize: "0.68rem", fontWeight: 500, letterSpacing: "0.1em", textTransform: "uppercase", color: T.text3 }}>
                  E-post förhandsvisning
                </span>
              </div>
              <div style={{ padding: "20px 24px" }}>
                <div style={{ fontFamily: fontSans, fontSize: "0.68rem", fontWeight: 500, letterSpacing: "0.1em", textTransform: "uppercase", color: T.text3, marginBottom: 6 }}>Ämne</div>
                <div style={{ fontFamily: fontSans, fontSize: "1rem", fontWeight: 400, color: T.text, marginBottom: 14 }}>{n.subject}</div>
                <div style={{ fontFamily: fontSans, fontSize: "0.68rem", fontWeight: 500, letterSpacing: "0.1em", textTransform: "uppercase", color: T.text3, marginBottom: 6 }}>Förhandsvisning</div>
                <div style={{ fontFamily: fontSans, fontSize: "0.88rem", fontWeight: 300, color: T.text2 }}>{n.preview}</div>
              </div>
            </div>

            <ResultCard>
              <ResultBlock label="Innehåll" content={n.body} />
              <ResultBlock label="Call to action" content={n.cta} />
            </ResultCard>

            <div style={{ display: "flex", gap: 10, marginTop: 28, flexWrap: "wrap" }}>
              <CopyButton getText={() => fullText} label="Kopiera nyhetsbrev" />
              <GhostButton href="/content">Till Innehåll</GhostButton>
            </div>
          </div>
        )}
      </div>
    </Shell>
  );
}

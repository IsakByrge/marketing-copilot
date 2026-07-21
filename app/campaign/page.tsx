"use client";

// ─────────────────────────────────────────────────────────────
// Kampanjidé — visar ett AI-genererat kampanjförslag ur
// marketing-copilot-plan (localStorage). Samma datakälla, samma
// växlarlogik mellan flera förslag, bara migrerad till Shell +
// det delade designsystemet. Tillbaka-länken pekade tidigare på
// /plan (oåtkomlig från navigationen) — pekar nu på /content.
// ─────────────────────────────────────────────────────────────
import { useEffect, useState } from "react";
import Shell from "@/app/_shared/Shell";
import { T, fontSans } from "@/app/_shared/theme";
import { PageHeader, GhostButton, CopyButton, ResultBlock, ResultCard, EmptyState } from "@/app/_shared/ui";
import { IconCampaigns } from "@/app/_shared/icons";

type Campaign = { title: string; goal: string; message: string; channels: string; cta: string };
type MarketingPlan = { company: string; focus: string; campaigns?: Campaign[] };

export default function CampaignPage() {
  const [plan, setPlan] = useState<MarketingPlan | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [active, setActive] = useState(0);

  useEffect(() => {
    function load() {
      const saved = localStorage.getItem("marketing-copilot-plan");
      if (saved) try { setPlan(JSON.parse(saved)); } catch { /* ignorera trasig data */ }
      setLoaded(true);
    }
    load();
  }, []);

  const campaigns = plan?.campaigns ?? [];
  const campaign = campaigns[active];
  const fullText = campaign
    ? `${campaign.title}\n\nMål: ${campaign.goal}\n\nBudskap: ${campaign.message}\n\nKanaler: ${campaign.channels}\n\nCTA: ${campaign.cta}`
    : "";

  return (
    <Shell>
      <div style={{ maxWidth: 800, margin: "0 auto", padding: "56px 40px 100px" }}>
        {!loaded ? (
          <div className="skel" style={{ width: "100%", height: 200, borderRadius: 16 }} />
        ) : !campaign ? (
          <>
            <PageHeader eyebrow="Kampanjidé" title="Ingen kampanj hittades." />
            <EmptyState
              icon={<IconCampaigns size={19} />}
              title="Inget kampanjförslag genererat ännu."
              body="Skapa en strategi i Campaign Builder, eller generera en veckoplan från Idag."
              action={<GhostButton href="/content">Till Innehåll</GhostButton>}
            />
          </>
        ) : (
          <div className="fade-up">
            {campaigns.length > 1 && (
              <div style={{ display: "flex", gap: 8, marginBottom: 32, flexWrap: "wrap" }}>
                {campaigns.map((c, i) => (
                  <button key={i} type="button" onClick={() => setActive(i)} className="mcx-focusable" style={{
                    flex: "1 1 160px", padding: "12px 16px", borderRadius: 12, cursor: "pointer", textAlign: "left",
                    background: active === i ? T.purpleDim : T.surface,
                    border: `1px solid ${active === i ? T.purpleBorder : T.line}`,
                    transition: "all .2s",
                  }}>
                    <div style={{ fontFamily: fontSans, fontSize: "0.62rem", fontWeight: 500, letterSpacing: "0.1em", textTransform: "uppercase", color: active === i ? T.purpleBright : T.text3, marginBottom: 4 }}>
                      Kampanj {i + 1}
                    </div>
                    <div style={{ fontFamily: fontSans, fontSize: "0.85rem", fontWeight: 400, color: active === i ? T.text : T.text2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {c.title}
                    </div>
                  </button>
                ))}
              </div>
            )}

            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8, flexWrap: "wrap", gap: 12 }}>
              <PageHeader
                eyebrow={`${plan!.company} · Kampanjidé ${active + 1}`}
                title={campaign.title}
                subtitle="Kampanjbrief med mål, budskap, kanalval och CTA."
              />
              <CopyButton getText={() => fullText} />
            </div>

            <ResultCard>
              <ResultBlock label="Mål" content={campaign.goal} />
              <ResultBlock label="Budskap" content={campaign.message} />
              <ResultBlock label="Kanaler" content={campaign.channels} />
              <ResultBlock label="Call to action" content={campaign.cta} />
            </ResultCard>

            <div style={{ display: "flex", gap: 10, marginTop: 28, flexWrap: "wrap" }}>
              <CopyButton getText={() => fullText} label="Kopiera kampanj" />
              <GhostButton href="/content">Till Innehåll</GhostButton>
            </div>
          </div>
        )}
      </div>
    </Shell>
  );
}

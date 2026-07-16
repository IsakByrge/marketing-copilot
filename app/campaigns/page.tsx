"use client";

// ─────────────────────────────────────────────────────────────
// Kampanjer — ingen datamodell spårar ännu "aktiva" kampanjer med
// status/datum/kanal (Campaign Builder sparar inget kampanjresultat
// än), så det ärliga tomläget visas alltid för den delen. Däremot
// visas riktiga kampanjförslag från senaste marknadsplanen, tydligt
// märkta som förslag — inte som pågående kampanjer.
// ─────────────────────────────────────────────────────────────
import Link from "next/link";
import Shell from "@/app/_shared/Shell";
import { T, fontSerif, fontSans } from "@/app/_shared/theme";
import { PageHeader, PrimaryButton, EmptyState } from "@/app/_shared/ui";
import { IconCampaigns } from "@/app/_shared/icons";
import { useAccountData } from "@/app/_shared/useAccountData";

export default function CampaignsPage() {
  const { plan, loaded } = useAccountData();

  return (
    <Shell>
      <div style={{ maxWidth: 900, margin: "0 auto", padding: "56px 40px 80px" }}>
        <PageHeader eyebrow="Kampanjer" title="Dina kampanjer." subtitle="Aktiva kampanjer och kampanjförslag samlade på ett ställe." />

        {!loaded ? (
          <div className="skel" style={{ width: "100%", height: 160, borderRadius: 14 }} />
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 44 }}>
            <section>
              <SectionLabel>Aktiva kampanjer</SectionLabel>
              <div style={{ marginTop: 14 }}>
                <EmptyState
                  icon={<IconCampaigns size={19} />}
                  title="Du har inga aktiva kampanjer ännu."
                  body="Börja med att låta din marknadschef skapa en strategi tillsammans med dig."
                  action={<PrimaryButton href="/campaign-builder">Skapa första kampanjen</PrimaryButton>}
                />
              </div>
            </section>

            {plan?.campaigns && plan.campaigns.length > 0 && (
              <section>
                <SectionLabel>Kampanjförslag från din senaste marknadsplan</SectionLabel>
                <p style={{ fontFamily: fontSans, fontSize: "0.8rem", fontWeight: 300, color: T.text4, marginTop: 6, marginBottom: 16 }}>
                  Utkast från AI:n — inte startade eller aktiva.
                </p>
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  {plan.campaigns.map((c, i) => (
                    <Link key={i} href="/campaign" style={{
                      display: "block", padding: "20px 22px", borderRadius: 14,
                      background: T.surface, border: `1px solid ${T.line}`, textDecoration: "none",
                    }}
                      onMouseOver={(e) => (e.currentTarget.style.borderColor = T.line2)}
                      onMouseOut={(e) => (e.currentTarget.style.borderColor = T.line)}
                    >
                      <h3 style={{ fontFamily: fontSerif, fontWeight: 400, fontSize: "1.1rem", color: T.text, marginBottom: 6 }}>{c.title}</h3>
                      <p style={{ fontFamily: fontSans, fontSize: "0.82rem", fontWeight: 300, color: T.text2, lineHeight: 1.6 }}>{c.goal}</p>
                    </Link>
                  ))}
                </div>
              </section>
            )}
          </div>
        )}
      </div>
    </Shell>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ fontFamily: fontSans, fontSize: "0.68rem", fontWeight: 500, letterSpacing: "0.1em", textTransform: "uppercase", color: T.text3 }}>
      {children}
    </div>
  );
}

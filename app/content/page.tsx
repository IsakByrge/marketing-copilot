"use client";

// ─────────────────────────────────────────────────────────────
// Innehåll — allt innehåll AI:n tagit fram i den senaste
// marknadsplanen. Ren presentation ovanpå riktig data (samma
// Supabase-källa som Idag) och länkar in till de befintliga,
// oförändrade sidorna /post/[id], /newsletter och /campaign.
// ─────────────────────────────────────────────────────────────
import Link from "next/link";
import Shell from "@/app/_shared/Shell";
import { T, fontSerif, fontSans } from "@/app/_shared/theme";
import { PageHeader, PrimaryButton, GhostButton, EmptyState } from "@/app/_shared/ui";
import { IconContent } from "@/app/_shared/icons";
import { useAccountData } from "@/app/_shared/useAccountData";

export default function ContentPage() {
  const { profile, plan, loaded } = useAccountData();

  return (
    <Shell>
      <div style={{ maxWidth: 900, margin: "0 auto", padding: "56px 40px 80px" }}>
        <PageHeader
          eyebrow="Innehåll"
          title="Det senaste din marknadschef skapat."
          subtitle="Sociala inlägg, nyhetsbrev och kampanjförslag från din senaste marknadsplan."
        />

        {!loaded ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <div className="skel" style={{ width: "100%", height: 80, borderRadius: 12 }} />
            <div className="skel" style={{ width: "100%", height: 80, borderRadius: 12 }} />
          </div>
        ) : !profile ? (
          <EmptyState
            icon={<IconContent size={19} />}
            title="Ingen företagsprofil ännu."
            body="Jag behöver känna till företaget innan jag kan skapa innehåll."
            action={<PrimaryButton href="/onboarding">Starta onboarding</PrimaryButton>}
          />
        ) : !plan ? (
          <EmptyState
            icon={<IconContent size={19} />}
            title="Inget innehåll skapat än."
            body="Låt din marknadschef bygga en strategi först, eller skapa ett enskilt inlägg direkt."
            action={
              <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                <PrimaryButton href="/campaign-builder">Starta Campaign Builder</PrimaryButton>
                <GhostButton href="/create">Skapa ett inlägg</GhostButton>
              </div>
            }
          />
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 48 }}>
            {plan.posts?.length > 0 && (
              <section>
                <SectionLabel>Sociala inlägg · {plan.posts.length} st</SectionLabel>
                <div style={{ borderTop: `1px solid ${T.line}`, marginTop: 14 }}>
                  {plan.posts.map((post, i) => (
                    <Link key={i} href={`/post/${i}`} style={{
                      display: "flex", alignItems: "center", gap: 16, padding: "18px 4px",
                      borderBottom: `1px solid ${T.line}`, textDecoration: "none",
                    }}
                      onMouseOver={(e) => (e.currentTarget.style.paddingLeft = "10px")}
                      onMouseOut={(e) => (e.currentTarget.style.paddingLeft = "4px")}
                    >
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <h3 style={{ fontFamily: fontSerif, fontWeight: 400, fontSize: "1.1rem", color: T.text, marginBottom: 4 }}>{post.title}</h3>
                        <p style={{ fontFamily: fontSans, fontSize: "0.82rem", fontWeight: 300, color: T.text3, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{post.text}</p>
                      </div>
                      <span style={{ color: T.purpleBright, fontSize: "0.8rem", flexShrink: 0 }}>→</span>
                    </Link>
                  ))}
                </div>
              </section>
            )}

            {plan.newsletter && (
              <section>
                <SectionLabel>Nyhetsbrev</SectionLabel>
                <div style={{ marginTop: 14, padding: "22px 24px", borderRadius: 14, background: T.surface, border: `1px solid ${T.line}` }}>
                  <h3 style={{ fontFamily: fontSerif, fontWeight: 400, fontSize: "1.2rem", color: T.text, marginBottom: 8 }}>{plan.newsletter.subject}</h3>
                  <p style={{ fontFamily: fontSans, fontSize: "0.85rem", fontWeight: 300, color: T.text3, lineHeight: 1.6, marginBottom: 16 }}>{plan.newsletter.preview}</p>
                  <GhostButton href="/newsletter">Öppna nyhetsbrevet</GhostButton>
                </div>
              </section>
            )}

            {plan.campaigns?.length > 0 && (
              <section>
                <SectionLabel>Kampanjförslag · {plan.campaigns.length} st</SectionLabel>
                <div style={{ marginTop: 14, display: "flex", flexDirection: "column", gap: 10 }}>
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

            <p style={{ fontFamily: fontSans, fontSize: "0.78rem", fontWeight: 300, color: T.text4 }}>
              Kampanjförslagen ovan är AI-genererade utkast, inte aktiva kampanjer. Bygg en strategi i{" "}
              <Link href="/campaign-builder" style={{ color: T.purpleBright }}>Campaign Builder</Link> för att gå från idé till underlag.
            </p>
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

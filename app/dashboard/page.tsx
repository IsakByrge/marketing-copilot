"use client";

// ─────────────────────────────────────────────────────────────
// "Idag" — huvuddashboarden efter inloggning.
// All datahämtning (företagsprofil, senaste plan, generatePlan)
// är oförändrad affärslogik, återanvänd rakt av från den tidigare
// dashboarden. Det som är nytt är presentationen: en fokuserad
// hero-rekommendation, snabbåtgärder, ett ärligt kampanj-tomläge
// och ärliga insikter — aldrig påhittad AI-analys.
// ─────────────────────────────────────────────────────────────
import Link from "next/link";
import { useEffect, useState } from "react";
import Shell, { firstNameFromEmail } from "@/app/_shared/Shell";
import { T, heroGlow, fontSerif, fontSans, transition } from "@/app/_shared/theme";
import { Eyebrow, PrimaryButton, GhostButton } from "@/app/_shared/ui";
import {
  IconOpportunity, IconContent, IconCampaigns,
} from "@/app/_shared/icons";
import { useAccountData, type CompanyProfile, type MarketingPlan, type Opportunity } from "@/app/_shared/useAccountData";
import { createClient } from "@/lib/supabase-browser";

function useIsMobile() {
  const [mobile, setMobile] = useState(false);
  useEffect(() => {
    const check = () => setMobile(window.innerWidth < 720);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);
  return mobile;
}

/* ── Hero: dagens rekommendation ─────────────────────────────── */
function Hero({ profile, plan, isMobile, onGenerate, generating }: {
  profile: CompanyProfile; plan: MarketingPlan | null; isMobile: boolean;
  onGenerate: () => void; generating: boolean;
}) {
  const hasRecommendation = !!plan?.focus;
  const eyebrow = hasRecommendation ? "MIN REKOMMENDATION IDAG" : "CAMPAIGN BUILDER";
  const headline = hasRecommendation
    ? plan!.focus
    : "Bygg nästa kampanj runt ett tydligt affärsmål.";
  const body = hasRecommendation
    ? (plan!.tags?.length
        ? `Jag lutar åt att prioritera ${plan!.tags.slice(0, 3).join(", ").toLowerCase()} för ${profile.companyName} just nu.`
        : `Det här är veckans fokus för ${profile.companyName}.`)
    : "Jag hjälper dig att välja strategi, utmana svaga antaganden och skapa ett komplett kampanjunderlag.";

  return (
    <div style={{
      position: "relative", overflow: "hidden",
      background: T.surface, border: `1px solid ${T.line}`, borderRadius: 20,
      padding: isMobile ? "32px 24px" : "48px 52px",
      boxShadow: "0 30px 80px -40px rgba(0,0,0,0.6)",
    }}>
      <div aria-hidden style={{ position: "absolute", inset: 0, background: heroGlow, pointerEvents: "none" }} />
      <div aria-hidden style={{
        position: "absolute", inset: 0, opacity: 0.5, pointerEvents: "none",
        backgroundImage: "linear-gradient(rgba(255,255,255,0.025) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.025) 1px, transparent 1px)",
        backgroundSize: "42px 42px",
        maskImage: "radial-gradient(ellipse 70% 60% at 75% 30%, black, transparent)",
      }} />

      <div style={{ position: "relative", maxWidth: 620 }}>
        <Eyebrow>{eyebrow}</Eyebrow>
        <h1 style={{
          fontFamily: fontSerif, fontWeight: 300, fontSize: isMobile ? "clamp(1.9rem,7vw,2.5rem)" : "clamp(2.3rem,3.4vw,3.1rem)",
          lineHeight: 1.08, letterSpacing: "-0.015em", color: T.text, margin: "18px 0 16px",
        }}>
          {headline}
        </h1>
        <p style={{ fontFamily: fontSans, fontSize: "1rem", fontWeight: 300, color: T.text2, lineHeight: 1.7, marginBottom: 30, maxWidth: 520 }}>
          {body}
        </p>
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
          <PrimaryButton href="/campaign-builder">Starta Campaign Builder</PrimaryButton>
          {hasRecommendation ? (
            <GhostButton href="/content">Se senaste analys</GhostButton>
          ) : (
            <GhostButton onClick={onGenerate} disabled={generating}>
              {generating ? "Genererar veckoplan…" : "Eller generera en veckoplan"}
            </GhostButton>
          )}
        </div>
      </div>
    </div>
  );
}

/* ── Snabbåtgärder ────────────────────────────────────────────── */
const QUICK_ACTIONS: { label: string; href?: string; icon: string }[] = [
  { label: "Nyhetsbrev", href: "/create", icon: "✉" },
  { label: "Facebook-inlägg", href: "/create", icon: "▤" },
  { label: "Instagram-inlägg", href: "/create", icon: "◎" },
  { label: "Kampanj", href: "/campaign-builder", icon: "✦" },
  { label: "Annons", icon: "▣" },
  { label: "Landningssida", icon: "▭" },
];

function QuickActions({ isMobile }: { isMobile: boolean }) {
  return (
    <section>
      <Eyebrow color={T.text3}>Skapa snabbt</Eyebrow>
      <div style={{
        marginTop: 16, display: "grid",
        gridTemplateColumns: isMobile ? "repeat(2, 1fr)" : "repeat(6, 1fr)", gap: 10,
      }}>
        {QUICK_ACTIONS.map((a) => {
          const disabled = !a.href;
          const content = (
            <>
              <span aria-hidden style={{ fontSize: "1.1rem", color: disabled ? T.text4 : T.purpleBright }}>{a.icon}</span>
              <span style={{ fontFamily: fontSans, fontSize: "0.78rem", fontWeight: 400, color: disabled ? T.text4 : T.text2, textAlign: "center" }}>{a.label}</span>
              {disabled && (
                <span style={{ fontFamily: fontSans, fontSize: "0.6rem", fontWeight: 500, letterSpacing: "0.08em", textTransform: "uppercase", color: T.text4 }}>
                  Kommer snart
                </span>
              )}
            </>
          );
          const style: React.CSSProperties = {
            display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 8,
            padding: "20px 12px", borderRadius: 12, textDecoration: "none",
            background: T.surface, border: `1px solid ${T.line}`,
            cursor: disabled ? "default" : "pointer", transition,
            opacity: disabled ? 0.55 : 1,
          };
          if (disabled) return <div key={a.label} style={style} aria-disabled="true">{content}</div>;
          return (
            <Link key={a.label} href={a.href!} style={style}
              onMouseOver={(e) => { e.currentTarget.style.borderColor = T.purpleBorder; e.currentTarget.style.background = T.surfaceHover; }}
              onMouseOut={(e) => { e.currentTarget.style.borderColor = T.line; e.currentTarget.style.background = T.surface; }}
            >
              {content}
            </Link>
          );
        })}
      </div>
    </section>
  );
}

/* ── Aktiva kampanjer ────────────────────────────────────────── */
function ActiveCampaigns() {
  // Det finns i dagsläget ingen datamodell som spårar "aktiva" kampanjer
  // (Campaign Builder sparar ännu inget kampanjresultat) — det ärliga
  // tomläget visas alltid tills den funktionen finns, i stället för att
  // presentera kampanjförslag som om de vore aktiva kampanjer.
  return (
    <section>
      <Eyebrow color={T.text3}>Aktiva kampanjer</Eyebrow>
      <div style={{
        marginTop: 16, padding: "40px 32px", borderRadius: 16,
        background: T.surface, border: `1px dashed ${T.line2}`,
        display: "flex", flexDirection: "column", alignItems: "flex-start", gap: 14,
      }}>
        <span aria-hidden style={{
          width: 40, height: 40, borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "center",
          background: T.purpleDim, border: `1px solid ${T.purpleBorder}`, color: T.purpleBright,
        }}>
          <IconCampaigns size={18} />
        </span>
        <div>
          <p style={{ fontFamily: fontSans, fontSize: "0.95rem", fontWeight: 500, color: T.text, marginBottom: 6 }}>
            Du har inga aktiva kampanjer ännu.
          </p>
          <p style={{ fontFamily: fontSans, fontSize: "0.85rem", fontWeight: 300, color: T.text3, lineHeight: 1.6 }}>
            Börja med att låta din marknadschef skapa en strategi.
          </p>
        </div>
        <PrimaryButton href="/campaign-builder">Skapa första kampanjen</PrimaryButton>
      </div>
    </section>
  );
}

/* ── Insikter och möjligheter ─────────────────────────────────── */
function Insights({ opportunities }: { opportunities: Opportunity[] }) {
  const hasData = opportunities.length > 0;
  return (
    <section>
      <Eyebrow color={T.text3}>Insikter och möjligheter</Eyebrow>
      {hasData ? (
        <div style={{ marginTop: 16, display: "flex", flexDirection: "column", gap: 10 }}>
          {opportunities.slice(0, 3).map((o, i) => (
            <div key={i} style={{ padding: "18px 20px", borderRadius: 12, background: T.surface, border: `1px solid ${T.line}` }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                <span style={{ color: T.blue, display: "flex" }}><IconOpportunity size={14} /></span>
                <span style={{ fontFamily: fontSans, fontSize: "0.62rem", fontWeight: 500, letterSpacing: "0.1em", textTransform: "uppercase", color: T.blue }}>Möjlighet</span>
                {o.date && <span style={{ marginLeft: "auto", fontFamily: fontSans, fontSize: "0.68rem", color: T.text3 }}>{o.date}</span>}
              </div>
              <h3 style={{ fontFamily: fontSerif, fontWeight: 400, fontSize: "1.05rem", color: T.text, marginBottom: 4 }}>{o.title}</h3>
              <p style={{ fontFamily: fontSans, fontSize: "0.82rem", fontWeight: 300, color: T.text2, lineHeight: 1.6 }}>{o.relevance}</p>
            </div>
          ))}
        </div>
      ) : (
        <div style={{
          marginTop: 16, padding: "32px 28px", borderRadius: 16,
          background: T.surface, border: `1px solid ${T.line}`,
          display: "flex", flexDirection: "column", gap: 14, alignItems: "flex-start",
        }}>
          <p style={{ fontFamily: fontSans, fontSize: "0.88rem", fontWeight: 300, color: T.text2, lineHeight: 1.65, maxWidth: 440 }}>
            Jag behöver lära känna företaget bättre innan jag kan ge proaktiva rekommendationer.
          </p>
          <GhostButton href="/company">Komplettera företagskunskap</GhostButton>
        </div>
      )}
    </section>
  );
}

/* ── Root ────────────────────────────────────────────────────── */
export default function DashboardPage() {
  const isMobile = useIsMobile();
  const { profile, plan, setPlan, loaded, email } = useAccountData();
  const [isGenerating, setIsGenerating] = useState(false);
  const firstName = firstNameFromEmail(email);

  async function generatePlan() {
    if (!profile) return;
    setIsGenerating(true);
    try {
      const savedFiles = localStorage.getItem("marketing-copilot-brain-files");
      const brainFiles = savedFiles ? JSON.parse(savedFiles) : [];
      const sb = createClient();
      const { data: { user } } = await sb.auth.getUser();

      const response = await fetch("/api/generate-plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ companyProfile: profile, brainFiles, userId: user?.id }),
      });
      if (!response.ok) throw new Error("Kunde inte generera plan.");
      const newPlan = await response.json();
      localStorage.setItem("marketing-copilot-plan", JSON.stringify(newPlan));
      setPlan(newPlan);

      try {
        if (!user) throw new Error("Ingen inloggad användare");
        const { data: company } = await sb
          .from("companies")
          .upsert({
            name: profile.companyName, industry: profile.industry, summary: profile.summary,
            customers: profile.customers, products: profile.products, tone: profile.tone,
            strengths: profile.strengths, avoid: profile.avoid,
            content_guidelines: profile.contentGuidelines, user_id: user.id,
          }, { onConflict: "user_id,name" })
          .select().single();

        if (company) {
          await sb.from("plans").insert({
            company_id: company.id, user_id: user.id,
            focus: newPlan.focus, tags: newPlan.tags, posts: newPlan.posts,
            newsletter: newPlan.newsletter, campaigns: newPlan.campaigns,
            opportunities: newPlan.opportunities,
          });

          const savedRhythm = localStorage.getItem("marketing-copilot-rhythm");
          if (savedRhythm) {
            await sb.from("marketing_rhythm").upsert({
              company_id: company.id,
              user_id: user.id,
              rhythm: savedRhythm,
            }, { onConflict: "company_id" });
          }
        }
      } catch (sbError) {
        console.warn("Supabase sync misslyckades:", sbError);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsGenerating(false);
    }
  }

  const pad = isMobile ? 20 : 56;
  const greetingName = firstName ?? profile?.companyName?.split(" ")[0];

  return (
    <Shell>
      <div style={{ maxWidth: 1180, margin: "0 auto", padding: `${isMobile ? 32 : 56}px ${pad}px 80px` }}>
        {!loaded ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <div className="skel" style={{ width: 240, height: 14 }} />
            <div className="skel" style={{ width: "60%", height: 40 }} />
            <div className="skel" style={{ width: "100%", height: 220, borderRadius: 20, marginTop: 12 }} />
          </div>
        ) : !profile ? (
          <div className="fade-up" style={{ maxWidth: 560 }}>
            <Eyebrow>Kom igång</Eyebrow>
            <h1 style={{ fontFamily: fontSerif, fontWeight: 300, fontSize: "clamp(2rem,5vw,3rem)", color: T.text, margin: "16px 0 16px", lineHeight: 1.1 }}>
              Låt din marknadschef lära känna företaget.
            </h1>
            <p style={{ fontFamily: fontSans, fontSize: "0.95rem", fontWeight: 300, color: T.text2, lineHeight: 1.8, marginBottom: 28 }}>
              Innan jag kan ge rekommendationer behöver jag en företagsprofil att utgå från.
            </p>
            <PrimaryButton href="/onboarding">Starta onboarding</PrimaryButton>
          </div>
        ) : (
          <div className="fade-up" style={{ display: "flex", flexDirection: "column", gap: 44 }}>
            <div>
              <h1 style={{
                fontFamily: fontSerif, fontWeight: 300, fontSize: isMobile ? "clamp(1.8rem,7vw,2.4rem)" : "clamp(2.1rem,3.2vw,2.8rem)",
                letterSpacing: "-0.01em", color: T.text, marginBottom: 10, lineHeight: 1.1,
              }}>
                {greetingName ? `God morgon, ${greetingName}.` : "God morgon."}
              </h1>
              <p style={{ fontFamily: fontSans, fontSize: "1rem", fontWeight: 300, color: T.text3, lineHeight: 1.6 }}>
                Din marknadschef har sammanställt det viktigaste att fokusera på idag.
              </p>
            </div>

            <Hero profile={profile} plan={plan} isMobile={isMobile} onGenerate={generatePlan} generating={isGenerating} />
            <QuickActions isMobile={isMobile} />

            <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1.1fr 0.9fr", gap: 32, alignItems: "start" }}>
              <ActiveCampaigns />
              <Insights opportunities={plan?.opportunities ?? []} />
            </div>

            {plan && (
              <Link href="/content" style={{
                display: "flex", alignItems: "center", gap: 10, alignSelf: "flex-start",
                fontFamily: fontSans, fontSize: "0.8rem", fontWeight: 400, color: T.text3, textDecoration: "none",
              }}
                onMouseOver={(e) => (e.currentTarget.style.color = T.text)}
                onMouseOut={(e) => (e.currentTarget.style.color = T.text3)}
              >
                <IconContent size={14} />
                Se allt innehåll i din senaste plan →
              </Link>
            )}
          </div>
        )}
      </div>
    </Shell>
  );
}

"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

const T = {
  bg: "#0a0908", surface: "#111009", surface2: "#181510",
  line: "rgba(255,248,235,0.08)", line2: "rgba(255,248,235,0.13)",
  text: "#f5f0e8", text2: "rgba(245,240,232,0.55)", text3: "rgba(245,240,232,0.30)",
  gold: "#c9a96e", goldDim: "rgba(201,169,110,0.10)", goldBorder: "rgba(201,169,110,0.22)",
};

type CompanyProfile = {
  companyName: string; industry: string; summary: string;
  customers: string[]; products: string[]; tone: string[];
  strengths: string[]; avoid: string[]; contentGuidelines: string[];
};
type MarketingPost = { title: string; text: string; cta: string; image: string; };
type Newsletter = { subject: string; preview: string; body: string; cta: string; };
type Campaign = { title: string; goal: string; message: string; channels: string; cta: string; };
type MarketingPlan = { id?: string; company: string; focus: string; tags: string[]; posts: MarketingPost[]; newsletter: Newsletter; campaigns: Campaign[]; };
type View = "week" | "brain";
type Section = "social" | "newsletter" | "campaigns" | "opportunities";

function SLabel({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 10,
      fontSize: "0.65rem", fontWeight: 400, letterSpacing: "0.18em",
      textTransform: "uppercase", color: T.gold,
    }}>
      <span style={{ width: 18, height: 1, background: T.gold, opacity: .5, display: "block" }} />
      {children}
    </div>
  );
}

function NavBtn({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button onClick={onClick} style={{
      background: "none", border: "none", cursor: "pointer",
      fontSize: "0.7rem", fontWeight: 400, letterSpacing: "0.1em",
      textTransform: "uppercase", padding: "4px 0",
      color: active ? T.gold : T.text3,
      borderBottom: active ? `1px solid ${T.gold}` : "1px solid transparent",
      transition: "all .2s",
    }}>
      {children}
    </button>
  );
}

export default function DashboardPage() {
  const [profile, setProfile] = useState<CompanyProfile | null>(null);
  const [plan, setPlan] = useState<MarketingPlan | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [view, setView] = useState<View>("week");
  const [section, setSection] = useState<Section>("social");

  useEffect(() => {
    const savedProfile = localStorage.getItem("marketing-copilot-company-profile");
    const savedPlan = localStorage.getItem("marketing-copilot-plan");
    if (savedProfile) try { setProfile(JSON.parse(savedProfile)); } catch {}
    if (savedPlan) try { setPlan(JSON.parse(savedPlan)); } catch {}
  }, []);

  async function generatePlan() {
  if (!profile) return;
  setIsGenerating(true);
  try {
    // Hämta brain-filer från localStorage
    const savedFiles = localStorage.getItem("marketing-copilot-brain-files");
    const brainFiles = savedFiles ? JSON.parse(savedFiles) : [];
 
    const response = await fetch("/api/generate-plan", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        companyProfile: profile,
        brainFiles, // skickar med filer som kontext
      }),
    });
    if (!response.ok) throw new Error("Kunde inte generera plan.");
    const newPlan = await response.json();
    const planWithId = { id: "ai-generated-plan", ...newPlan };
    localStorage.setItem("marketing-copilot-plan", JSON.stringify(planWithId));
    setPlan(planWithId);
    setView("week");
    setSection("social");
  } catch (e) {
    console.error(e);
  } finally {
    setIsGenerating(false);
  }
}

  const week = (() => {
    const d = new Date(), j = new Date(d.getFullYear(), 0, 1);
    return Math.ceil(((d.getTime() - j.getTime()) / 86400000 + j.getDay() + 1) / 7);
  })();

  // Empty states
  if (!profile) return (
    <main style={{ minHeight: "100svh", background: T.bg, display: "flex", flexDirection: "column", justifyContent: "flex-end", padding: "80px 48px" }}>
      <SLabel>Marketing Copilot</SLabel>
      <h1 style={{ fontFamily: "var(--font-cormorant), serif", fontWeight: 300, fontSize: "clamp(3rem,7vw,6rem)", lineHeight: .95, letterSpacing: "-0.02em", color: T.text, margin: "24px 0 20px" }}>
        Lär AI:n ditt<br /><em style={{ color: T.gold, fontStyle: "italic" }}>företag först.</em>
      </h1>
      <p style={{ fontSize: "0.95rem", fontWeight: 300, color: T.text2, lineHeight: 1.8, maxWidth: 400, marginBottom: 36 }}>
        Skapa en företagsprofil så kan AI:n ta fram en veckoplan baserad på dina kunder, tjänster och tonläge.
      </p>
      <Link href="/onboarding" style={{ display: "inline-block", fontFamily: "var(--font-outfit), sans-serif", fontSize: "0.75rem", fontWeight: 400, letterSpacing: "0.12em", textTransform: "uppercase", padding: "13px 28px", borderRadius: 2, background: T.gold, color: T.bg, textDecoration: "none" }}>
        Starta onboarding
      </Link>
    </main>
  );

  if (!plan) return (
    <main style={{ minHeight: "100svh", background: T.bg, display: "flex", flexDirection: "column", justifyContent: "flex-end", padding: "80px 48px" }}>
      <div style={{ marginBottom: 40 }}>
        <Link href="/profile" style={{ fontSize: "0.7rem", fontWeight: 400, letterSpacing: "0.1em", textTransform: "uppercase", color: T.text3, textDecoration: "none" }}>← Företagsprofil</Link>
      </div>
      <SLabel>{profile.companyName}</SLabel>
      <h1 style={{ fontFamily: "var(--font-cormorant), serif", fontWeight: 300, fontSize: "clamp(3rem,7vw,6rem)", lineHeight: .95, letterSpacing: "-0.02em", color: T.text, margin: "24px 0 20px" }}>
        AI:n känner företaget.<br /><em style={{ color: T.gold, fontStyle: "italic" }}>Nu kan planen skapas.</em>
      </h1>
      <p style={{ fontSize: "0.95rem", fontWeight: 300, color: T.text2, lineHeight: 1.8, maxWidth: 400, marginBottom: 36 }}>
        Skapa fem inlägg, ett nyhetsbrev och två kampanjidéer baserat på företagets AI-profil.
      </p>
      <button onClick={generatePlan} disabled={isGenerating} style={{
        display: "inline-flex", alignItems: "center", gap: 10,
        fontFamily: "var(--font-outfit), sans-serif", fontSize: "0.75rem", fontWeight: 400,
        letterSpacing: "0.12em", textTransform: "uppercase", padding: "13px 28px",
        borderRadius: 2, background: isGenerating ? T.surface2 : T.gold,
        color: isGenerating ? T.text3 : T.bg, border: "none", cursor: isGenerating ? "not-allowed" : "pointer",
      }}>
        {isGenerating && <span style={{ width: 13, height: 13, borderRadius: "50%", border: `1.5px solid rgba(201,169,110,.3)`, borderTopColor: T.bg, display: "inline-block", animation: "spin .7s linear infinite" }} />}
        {isGenerating ? "Skapar planen…" : "Generera veckans plan"}
      </button>
    </main>
  );

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
        <button onClick={() => setView("week")} style={{ background: "none", border: "none", cursor: "pointer", padding: 0 }}>
          <span style={{ fontFamily: "var(--font-cormorant), serif", fontWeight: 500, fontSize: "1.1rem", letterSpacing: "0.08em", textTransform: "uppercase", color: T.text }}>
            Marketing<span style={{ color: T.gold }}>Copilot</span>
          </span>
        </button>
        <div style={{ display: "flex", alignItems: "center", gap: 28 }}>
          <NavBtn active={view === "week"} onClick={() => setView("week")}>Veckoplan</NavBtn>
          <NavBtn active={view === "brain"} onClick={() => setView("brain")}>Company Brain</NavBtn>
          <button onClick={generatePlan} disabled={isGenerating} style={{
            fontFamily: "var(--font-outfit), sans-serif", fontSize: "0.68rem", fontWeight: 400,
            letterSpacing: "0.1em", textTransform: "uppercase", padding: "7px 16px",
            borderRadius: 2, border: `1px solid ${T.line2}`, background: "transparent",
            color: T.text3, cursor: isGenerating ? "not-allowed" : "pointer", transition: "all .2s",
          }}>
            {isGenerating ? "Genererar…" : "Ny plan"}
          </button>
        </div>
      </nav>

      {view === "week" ? (
        <WeeklyPlanView plan={plan} section={section} setSection={setSection} week={week} />
      ) : (
        <BrainView profile={profile} />
      )}

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @media (max-width: 640px) {
          nav { padding: 0 20px !important; }
        }
      `}</style>
    </main>
  );
}

function WeeklyPlanView({ plan, section, setSection, week }: { plan: MarketingPlan; section: Section; setSection: (s: Section) => void; week: number }) {
  const sections = useMemo(() => [
    { id: "social" as const, icon: "📱", label: "Sociala medier", desc: `${plan.posts.length} inlägg` },
    { id: "newsletter" as const, icon: "📧", label: "Nyhetsbrev", desc: "1 st" },
    { id: "campaigns" as const, icon: "🎯", label: "Kampanjförslag", desc: `${plan.campaigns.length} förslag` },
    { id: "opportunities" as const, icon: "📅", label: "Möjligheter", desc: "Automatiskt" },
  ], [plan]);

  return (
    <div style={{ display: "grid", gridTemplateColumns: "280px 1fr", minHeight: "calc(100svh - 56px)" }}>
      {/* Sidebar */}
      <div style={{ borderRight: `1px solid ${T.line}`, padding: "28px 0" }}>
        <div style={{ padding: "0 24px 20px", borderBottom: `1px solid ${T.line}` }}>
          <div style={{ fontSize: "0.6rem", fontWeight: 400, letterSpacing: "0.12em", textTransform: "uppercase", color: T.text3, marginBottom: 6 }}>Vecka {week}</div>
          <div style={{ fontFamily: "var(--font-cormorant), serif", fontSize: "1rem", fontWeight: 400, color: T.text }}>Din plan är klar</div>
        </div>
        <div style={{ padding: "12px 12px" }}>
          {sections.map(s => (
            <button key={s.id} onClick={() => setSection(s.id)} style={{
              display: "flex", alignItems: "center", gap: 12, width: "100%",
              padding: "12px 14px", borderRadius: 2, marginBottom: 2,
              background: section === s.id ? T.goldDim : "transparent",
              border: `1px solid ${section === s.id ? T.goldBorder : "transparent"}`,
              cursor: "pointer", transition: "all .15s", textAlign: "left",
            }}>
              <div style={{ width: 32, height: 32, borderRadius: 2, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", fontSize: "0.9rem", background: section === s.id ? T.goldDim : T.surface2, border: `1px solid ${section === s.id ? T.goldBorder : T.line}` }}>
                {s.icon}
              </div>
              <div>
                <div style={{ fontSize: "0.82rem", fontWeight: 400, color: section === s.id ? T.text : T.text2 }}>{s.label}</div>
                <div style={{ fontSize: "0.68rem", fontWeight: 300, color: T.text3 }}>{s.desc}</div>
              </div>
            </button>
          ))}
        </div>
        <div style={{ padding: "16px 12px", borderTop: `1px solid ${T.line}`, marginTop: 8 }}>
          <button style={{ width: "100%", padding: "10px", borderRadius: 2, border: `1px solid ${T.line2}`, background: "transparent", fontFamily: "var(--font-outfit), sans-serif", fontSize: "0.7rem", fontWeight: 400, letterSpacing: "0.1em", textTransform: "uppercase", color: T.text3, cursor: "pointer" }}>
            Kopiera allt
          </button>
        </div>
      </div>

      {/* Main content */}
      <div style={{ overflowY: "auto", padding: "48px 56px" }}>
        {section === "social" && <SocialSection posts={plan.posts} />}
        {section === "newsletter" && <NewsletterSection newsletter={plan.newsletter} />}
        {section === "campaigns" && <CampaignSection campaigns={plan.campaigns} />}
        {section === "opportunities" && <OpportunitiesSection plan={plan} />}
      </div>
    </div>
  );
}

function SocialSection({ posts }: { posts: MarketingPost[] }) {
  return (
    <div>
      <SLabel>Sociala medier</SLabel>
      <h2 style={{ fontFamily: "var(--font-cormorant), serif", fontWeight: 300, fontSize: "clamp(2.5rem,4vw,3.5rem)", letterSpacing: "-0.02em", lineHeight: .95, color: T.text, margin: "16px 0 40px" }}>
        Färdiga inlägg.
      </h2>
      <div style={{ borderTop: `1px solid ${T.line}` }}>
        {posts.map((post, i) => (
          <Link key={i} href={`/post/${i}`} style={{
            display: "grid", gridTemplateColumns: "80px 1fr auto", gap: 24,
            alignItems: "center", padding: "24px 0", borderBottom: `1px solid ${T.line}`,
            textDecoration: "none", transition: "padding-left .2s",
          }}
          onMouseOver={e => (e.currentTarget as HTMLElement).style.paddingLeft = "8px"}
          onMouseOut={e => (e.currentTarget as HTMLElement).style.paddingLeft = "0"}
          >
            <div style={{ fontSize: "0.62rem", fontWeight: 400, letterSpacing: "0.12em", textTransform: "uppercase", color: T.text3 }}>Inlägg {i + 1}</div>
            <div>
              <h3 style={{ fontFamily: "var(--font-cormorant), serif", fontWeight: 400, fontSize: "1.4rem", letterSpacing: "-0.01em", color: T.text, marginBottom: 8 }}>{post.title}</h3>
              <p style={{ fontSize: "0.83rem", fontWeight: 300, color: T.text2, lineHeight: 1.7 }}>{post.text}</p>
            </div>
            <span style={{ fontSize: "0.65rem", fontWeight: 400, letterSpacing: "0.1em", textTransform: "uppercase", color: T.gold, flexShrink: 0 }}>Öppna →</span>
          </Link>
        ))}
      </div>
    </div>
  );
}

function NewsletterSection({ newsletter }: { newsletter: Newsletter }) {
  return (
    <div style={{ maxWidth: 680 }}>
      <SLabel>Nyhetsbrev</SLabel>
      <h2 style={{ fontFamily: "var(--font-cormorant), serif", fontWeight: 300, fontSize: "clamp(2rem,4vw,3rem)", letterSpacing: "-0.02em", lineHeight: 1.0, color: T.text, margin: "16px 0 20px" }}>
        {newsletter.subject}
      </h2>
      <p style={{ fontSize: "0.88rem", fontWeight: 300, color: T.text2, lineHeight: 1.8, marginBottom: 32 }}>{newsletter.preview}</p>
      <div style={{ borderTop: `1px solid ${T.line}`, borderBottom: `1px solid ${T.line}`, padding: "28px 0", marginBottom: 28 }}>
        <p style={{ fontSize: "0.95rem", fontWeight: 300, color: T.text, lineHeight: 1.85, whiteSpace: "pre-line" }}>{newsletter.body}</p>
      </div>
      <div style={{ display: "flex", gap: 10 }}>
        <Link href="/newsletter" style={{ fontFamily: "var(--font-outfit), sans-serif", fontSize: "0.72rem", fontWeight: 400, letterSpacing: "0.1em", textTransform: "uppercase", padding: "11px 22px", borderRadius: 2, background: T.gold, color: T.bg, textDecoration: "none" }}>Öppna</Link>
        <button style={{ fontFamily: "var(--font-outfit), sans-serif", fontSize: "0.72rem", fontWeight: 400, letterSpacing: "0.1em", textTransform: "uppercase", padding: "11px 22px", borderRadius: 2, border: `1px solid ${T.line2}`, background: "transparent", color: T.text3, cursor: "pointer" }}>Kopiera</button>
      </div>
    </div>
  );
}

function CampaignSection({ campaigns }: { campaigns: Campaign[] }) {
  return (
    <div>
      <SLabel>Kampanjförslag</SLabel>
      <h2 style={{ fontFamily: "var(--font-cormorant), serif", fontWeight: 300, fontSize: "clamp(2.5rem,4vw,3.5rem)", letterSpacing: "-0.02em", lineHeight: .95, color: T.text, margin: "16px 0 40px" }}>
        Två färdiga riktningar.
      </h2>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 2 }}>
        {campaigns.map((c, i) => (
          <Link key={i} href="/campaign" style={{
            display: "block", padding: "28px 28px", background: T.surface,
            border: `1px solid ${T.line}`, borderRadius: 2, textDecoration: "none", transition: "border-color .2s",
          }}
          onMouseOver={e => (e.currentTarget as HTMLElement).style.borderColor = T.line2}
          onMouseOut={e => (e.currentTarget as HTMLElement).style.borderColor = T.line}
          >
            <div style={{ fontSize: "0.62rem", fontWeight: 400, letterSpacing: "0.12em", textTransform: "uppercase", color: T.gold, marginBottom: 14 }}>Kampanj {i + 1}</div>
            <h3 style={{ fontFamily: "var(--font-cormorant), serif", fontWeight: 400, fontSize: "1.5rem", letterSpacing: "-0.01em", color: T.text, marginBottom: 10 }}>{c.title}</h3>
            <p style={{ fontSize: "0.8rem", fontWeight: 300, color: T.text2, lineHeight: 1.7 }}>{c.goal}</p>
            <div style={{ marginTop: 20, fontSize: "0.65rem", fontWeight: 400, letterSpacing: "0.1em", textTransform: "uppercase", color: T.gold }}>Öppna →</div>
          </Link>
        ))}
      </div>
    </div>
  );
}

function OpportunitiesSection({ plan }: { plan: MarketingPlan }) {
  return (
    <div style={{ maxWidth: 680 }}>
      <SLabel>Möjligheter</SLabel>
      <h2 style={{ fontFamily: "var(--font-cormorant), serif", fontWeight: 300, fontSize: "clamp(2.5rem,4vw,3.5rem)", letterSpacing: "-0.02em", lineHeight: .95, color: T.text, margin: "16px 0 40px" }}>
        Nästa saker att testa.
      </h2>
      <div style={{ borderTop: `1px solid ${T.line}` }}>
        {plan.tags?.slice(0, 5).map((tag, i) => (
          <div key={i} style={{ display: "flex", gap: 24, padding: "20px 0", borderBottom: `1px solid ${T.line}`, alignItems: "baseline" }}>
            <span style={{ fontFamily: "var(--font-cormorant), serif", fontWeight: 300, fontSize: "0.85rem", color: T.text3, flexShrink: 0, letterSpacing: "0.06em" }}>{String(i + 1).padStart(2, "0")}</span>
            <p style={{ fontSize: "1rem", fontWeight: 300, color: T.text2, lineHeight: 1.6 }}>{tag}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function BrainView({ profile }: { profile: CompanyProfile }) {
  const fields = [
    ["Bransch", profile.industry],
    ["Kunder", profile.customers?.join(", ")],
    ["Produkter", profile.products?.join(", ")],
    ["Tonläge", profile.tone?.join(", ")],
    ["Undvik", profile.avoid?.join(", ")],
  ];

  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", minHeight: "calc(100svh - 56px)" }}>
      {/* Left */}
      <div style={{ borderRight: `1px solid ${T.line}`, padding: "48px 56px", overflowY: "auto" }}>
        <SLabel>Company Brain</SLabel>
        <h1 style={{ fontFamily: "var(--font-cormorant), serif", fontWeight: 300, fontSize: "clamp(2.2rem,4vw,3.2rem)", letterSpacing: "-0.02em", lineHeight: 1.0, color: T.text, margin: "16px 0 16px" }}>
          Vad AI:n vet om <em style={{ fontStyle: "italic", color: T.gold }}>{profile.companyName}</em>.
        </h1>
        <p style={{ fontSize: "0.88rem", fontWeight: 300, color: T.text2, lineHeight: 1.8, marginBottom: 36 }}>
          Det här är grunden för allt innehåll som skapas i veckoplanen.
        </p>
        <div style={{ borderTop: `1px solid ${T.line}` }}>
          {fields.map(([label, value]) => value ? (
            <div key={label} style={{ display: "flex", gap: 20, padding: "16px 0", borderBottom: `1px solid ${T.line}` }}>
              <span style={{ fontSize: "0.65rem", fontWeight: 400, letterSpacing: "0.1em", textTransform: "uppercase", color: T.text3, width: 100, flexShrink: 0, paddingTop: 2 }}>{label}</span>
              <span style={{ fontSize: "0.85rem", fontWeight: 300, color: T.text2, lineHeight: 1.65 }}>{value}</span>
            </div>
          ) : null)}
        </div>
        <div style={{ marginTop: 28 }}>
          <Link href="/profile" style={{ fontFamily: "var(--font-outfit), sans-serif", fontSize: "0.7rem", fontWeight: 400, letterSpacing: "0.1em", textTransform: "uppercase", padding: "10px 20px", borderRadius: 2, border: `1px solid ${T.line2}`, background: "transparent", color: T.text3, textDecoration: "none" }}>
            Redigera brain
          </Link>
        </div>
      </div>

      {/* Right — orbit visual */}
      <div style={{ position: "relative", background: T.surface2, display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden" }}>
        <div style={{ position: "absolute", top: "50%", left: "50%", transform: "translate(-50%,-50%)", width: 300, height: 300, borderRadius: "50%", background: "radial-gradient(circle, rgba(201,169,110,0.07) 0%, transparent 70%)", pointerEvents: "none" }} />
        {[300, 220, 150, 80].map((s, i) => (
          <div key={i} style={{ position: "absolute", top: "50%", left: "50%", transform: "translate(-50%,-50%)", width: s, height: s, borderRadius: "50%", border: `1px solid ${i === 2 ? "rgba(201,169,110,0.2)" : T.line}` }} />
        ))}
        <div style={{ position: "absolute", top: "50%", left: "50%", transform: "translate(-50%,-50%)", width: 52, height: 52, borderRadius: "50%", background: T.goldDim, border: `1px solid ${T.goldBorder}`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: "1.2rem", zIndex: 2 }}>🧠</div>
        {[
          ["Hemsida", "8%", "50%", "translateX(-50%)"],
          ["Tjänster", "22%", "auto", "", "4%"],
          ["Kunder", "auto", "auto", "", "4%", "22%"],
          ["Tonläge", "auto", "50%", "translateX(-50%)", "", "4%"],
          ["Bransch", "auto", "4%", "", "", "22%"],
          ["Historik", "22%", "4%", ""],
        ].map(([label, top, left, transform, right, bottom], i) => (
          <div key={i} style={{
            position: "absolute",
            top: top !== "auto" ? top : undefined,
            bottom: bottom ? bottom : undefined,
            left: left !== "auto" ? left : undefined,
            right: right ? right : undefined,
            transform: transform || undefined,
            background: T.surface, border: `1px solid ${T.line2}`,
            borderRadius: 1, padding: "4px 9px",
            fontSize: "0.62rem", fontWeight: 300,
            letterSpacing: "0.08em", textTransform: "uppercase", color: T.text3,
          }}>{label}</div>
        ))}
      </div>
    </div>
  );
}
"use client";

import Link from "next/link";

export default function Home() {
  return (
    <main style={{ minHeight: "100svh", background: "#0a0908", display: "flex", flexDirection: "column" }}>

      {/* Nav */}
      <nav style={{
        position: "sticky", top: 0, zIndex: 100,
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "0 48px", height: 64,
        background: "rgba(10,9,8,0.88)", backdropFilter: "blur(20px)",
        borderBottom: "1px solid rgba(255,248,235,0.08)",
      }}>
        <span style={{
          fontFamily: "var(--font-cormorant), serif",
          fontWeight: 500, fontSize: "1.2rem",
          letterSpacing: "0.08em", textTransform: "uppercase",
          color: "#f5f0e8",
        }}>
          Marketing<span style={{ color: "#c9a96e" }}>Copilot</span>
        </span>
        <Link href="/onboarding" style={{
          fontFamily: "var(--font-outfit), sans-serif",
          fontSize: "0.72rem", fontWeight: 400,
          letterSpacing: "0.1em", textTransform: "uppercase",
          padding: "9px 22px", borderRadius: 2,
          border: "1px solid rgba(255,248,235,0.13)",
          background: "transparent", color: "rgba(245,240,232,0.6)",
          textDecoration: "none", transition: "all .2s",
        }}
        onMouseOver={e => { (e.currentTarget as HTMLElement).style.borderColor = "#c9a96e"; (e.currentTarget as HTMLElement).style.color = "#c9a96e"; }}
        onMouseOut={e => { (e.currentTarget as HTMLElement).style.borderColor = "rgba(255,248,235,0.13)"; (e.currentTarget as HTMLElement).style.color = "rgba(245,240,232,0.6)"; }}
        >
          Testa gratis
        </Link>
      </nav>

      {/* Hero */}
      <div style={{
        flex: 1, display: "flex", flexDirection: "column", justifyContent: "flex-end",
        padding: "80px 48px 64px", maxWidth: 1200, margin: "0 auto", width: "100%",
        position: "relative", overflow: "hidden",
      }}>
        {/* Background glow */}
        <div style={{
          position: "absolute", bottom: 0, left: 0,
          width: "50%", height: "60%",
          background: "radial-gradient(ellipse at bottom left, rgba(201,169,110,0.05) 0%, transparent 65%)",
          pointerEvents: "none",
        }} />
        {/* Large background numeral */}
        <div style={{
          position: "absolute", bottom: "-0.1em", right: "-0.05em",
          fontFamily: "var(--font-cormorant), serif",
          fontWeight: 300, fontSize: "clamp(200px, 30vw, 420px)",
          lineHeight: 1, color: "rgba(201,169,110,0.04)",
          userSelect: "none", pointerEvents: "none", letterSpacing: "-0.04em",
        }}>∞</div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 80, alignItems: "flex-end", position: "relative" }}>
          <div>
            {/* Eyebrow */}
            <div style={{
              display: "flex", alignItems: "center", gap: 12,
              fontSize: "0.67rem", fontWeight: 400, letterSpacing: "0.18em",
              textTransform: "uppercase", color: "#c9a96e", marginBottom: 28,
            }}>
              <span style={{ display: "block", width: 28, height: 1, background: "#c9a96e", opacity: .5 }} />
              AI-driven marknadschef
            </div>

            <h1 style={{
              fontFamily: "var(--font-cormorant), serif",
              fontWeight: 300, fontSize: "clamp(3rem, 6vw, 6rem)",
              lineHeight: 0.95, letterSpacing: "-0.02em",
              color: "#f5f0e8", marginBottom: 28,
            }}>
              Din marknadsföring<br />
              <em style={{ fontStyle: "italic", color: "#c9a96e" }}>för veckan</em><br />
              är redan klar.
            </h1>

            <p style={{
              fontSize: "0.95rem", fontWeight: 300,
              color: "rgba(245,240,232,0.55)", lineHeight: 1.8,
              maxWidth: 420, marginBottom: 40,
            }}>
              Varje vecka får du färdiga sociala medier-inlägg, nyhetsbrev och
              kampanjidéer — anpassade efter din bransch och säsong.
            </p>

            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              <Link href="/onboarding" style={{
                fontFamily: "var(--font-outfit), sans-serif",
                fontSize: "0.75rem", fontWeight: 400,
                letterSpacing: "0.12em", textTransform: "uppercase",
                padding: "13px 28px", borderRadius: 2,
                background: "#c9a96e", color: "#0a0908",
                textDecoration: "none", transition: "all .2s",
                display: "inline-block",
              }}>
                Kom igång gratis
              </Link>
              <Link href="/dashboard" style={{
                fontFamily: "var(--font-outfit), sans-serif",
                fontSize: "0.75rem", fontWeight: 400,
                letterSpacing: "0.1em", textTransform: "uppercase",
                padding: "13px 22px", borderRadius: 2,
                border: "1px solid rgba(255,248,235,0.13)",
                background: "transparent", color: "rgba(245,240,232,0.55)",
                textDecoration: "none", transition: "all .2s",
              }}>
                Se exempel
              </Link>
            </div>
          </div>

          {/* Preview card */}
          <div style={{
            border: "1px solid rgba(255,248,235,0.13)", borderRadius: 4,
            background: "#111009",
            boxShadow: "0 40px 100px rgba(0,0,0,0.5)",
            overflow: "hidden",
          }}>
            {/* Card header */}
            <div style={{
              background: "#181510", borderBottom: "1px solid rgba(255,248,235,0.08)",
              padding: "14px 20px", display: "flex", alignItems: "center", justifyContent: "space-between",
            }}>
              <span style={{
                fontFamily: "var(--font-cormorant), serif",
                fontSize: "1rem", fontWeight: 400, color: "#f5f0e8", letterSpacing: "0.01em",
              }}>
                Vecka 24 · Din plan är klar
              </span>
              <span style={{
                display: "flex", alignItems: "center", gap: 6,
                fontSize: "0.65rem", fontWeight: 400, letterSpacing: "0.08em",
                textTransform: "uppercase", color: "#c9a96e",
              }}>
                <span style={{ width: 5, height: 5, borderRadius: "50%", background: "#c9a96e", display: "inline-block" }} />
                Klar
              </span>
            </div>

            {/* Card items */}
            <div style={{ padding: "10px 10px" }}>
              {[
                { icon: "📧", label: "Nyhetsbrev", desc: "Färdigt att skicka", tag: "1 st" },
                { icon: "📱", label: "Sociala medier", desc: "Anpassade för din bransch", tag: "5 inlägg" },
                { icon: "🎯", label: "Kampanjidéer", desc: "Säsongsanpassade förslag", tag: "2 st" },
                { icon: "📅", label: "Möjligheter", desc: "Temadagar och trender", tag: "Auto" },
              ].map((item) => (
                <div key={item.label} style={{
                  display: "flex", alignItems: "center", gap: 12,
                  padding: "12px 12px", borderRadius: 2, marginBottom: 2,
                  border: "1px solid transparent", cursor: "pointer",
                  transition: "all .15s",
                }}
                onMouseOver={e => { (e.currentTarget as HTMLElement).style.background = "rgba(255,248,235,0.03)"; (e.currentTarget as HTMLElement).style.borderColor = "rgba(255,248,235,0.08)"; }}
                onMouseOut={e => { (e.currentTarget as HTMLElement).style.background = "transparent"; (e.currentTarget as HTMLElement).style.borderColor = "transparent"; }}
                >
                  <div style={{
                    width: 34, height: 34, borderRadius: 2, flexShrink: 0,
                    background: "rgba(255,248,235,0.04)",
                    border: "1px solid rgba(255,248,235,0.08)",
                    display: "flex", alignItems: "center", justifyContent: "center", fontSize: "0.95rem",
                  }}>
                    {item.icon}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: "0.82rem", fontWeight: 400, color: "#f5f0e8", marginBottom: 2 }}>{item.label}</div>
                    <div style={{ fontSize: "0.7rem", fontWeight: 300, color: "rgba(245,240,232,0.35)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{item.desc}</div>
                  </div>
                  <span style={{ fontSize: "0.62rem", fontWeight: 400, letterSpacing: "0.08em", textTransform: "uppercase", color: "rgba(201,169,110,0.7)", flexShrink: 0 }}>{item.tag}</span>
                </div>
              ))}
            </div>

            <div style={{ padding: "12px 20px 16px" }}>
              <Link href="/dashboard" style={{
                display: "block", textAlign: "center",
                fontFamily: "var(--font-outfit), sans-serif",
                fontSize: "0.72rem", fontWeight: 400,
                letterSpacing: "0.1em", textTransform: "uppercase",
                padding: "11px", borderRadius: 2,
                background: "#c9a96e", color: "#0a0908",
                textDecoration: "none",
              }}>
                Granska veckans plan →
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* Stats bar */}
      <div style={{ borderTop: "1px solid rgba(255,248,235,0.08)" }}>
        <div style={{ maxWidth: 1200, margin: "0 auto", display: "grid", gridTemplateColumns: "repeat(4, 1fr)" }}>
          {[
            ["2 min", "Per vecka"],
            ["5 +", "Färdiga inlägg"],
            ["0", "Egna idéer behövs"],
            ["↑", "Bättre varje vecka"],
          ].map(([n, l], i) => (
            <div key={i} style={{
              padding: "28px 48px",
              borderRight: i < 3 ? "1px solid rgba(255,248,235,0.08)" : "none",
            }}>
              <div style={{
                fontFamily: "var(--font-cormorant), serif",
                fontWeight: 300, fontSize: "2.4rem",
                letterSpacing: "-0.02em", color: "#f5f0e8",
                lineHeight: 1, marginBottom: 6,
              }}>{n}</div>
              <div style={{
                fontSize: "0.65rem", fontWeight: 300,
                letterSpacing: "0.08em", textTransform: "uppercase",
                color: "rgba(245,240,232,0.32)",
              }}>{l}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Mobile styles */}
      <style>{`
        @media (max-width: 768px) {
          nav { padding: 0 20px !important; }
          .hero-grid { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </main>
  );
}
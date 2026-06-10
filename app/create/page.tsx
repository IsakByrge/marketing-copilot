"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";

const T = {
  bg: "#2a2f3a", surface: "#323845", surface2: "#3a4050",
  line: "rgba(255,255,255,0.10)", line2: "rgba(255,255,255,0.18)",
  text: "#ffffff", text2: "#cbd5e0", text3: "#a0aec0",
  gold: "#c9a96e", goldDim: "rgba(201,169,110,0.15)", goldBorder: "rgba(201,169,110,0.30)",
};

type ContentType = {
  id: string;
  label: string;
  icon: string;
  description: string;
  placeholder: string;
};

type CompanyProfile = {
  companyName: string; industry: string; summary: string;
  customers: string[]; products: string[]; tone: string[];
  strengths: string[]; avoid: string[]; contentGuidelines: string[];
};

type GeneratedContent = {
  type: string;
  title: string;
  body: string;
  cta?: string;
  notes?: string;
};

const CONTENT_TYPES: ContentType[] = [
  { id: "social", label: "Socialt inlägg", icon: "📱", description: "Facebook eller Instagram", placeholder: "t.ex. Skapa ett inlägg om keramisk lackskyddsbehandling." },
  { id: "linkedin", label: "LinkedIn-inlägg", icon: "💼", description: "Professionellt expertinnehåll", placeholder: "t.ex. Skriv ett LinkedIn-inlägg om vikten av regelbundet underhåll." },
  { id: "newsletter", label: "Nyhetsbrev", icon: "📧", description: "Ämnesrad, innehåll och CTA", placeholder: "t.ex. Nyhetsbrev om vårens servicekampanj." },
  { id: "campaign", label: "Kampanj", icon: "🎯", description: "Kampanjbrief med budskap och kanaler", placeholder: "t.ex. Kampanj för Black Friday med fokus på serviceavtal." },
  { id: "offer", label: "Erbjudande", icon: "✦", description: "Konkret erbjudandetext", placeholder: "t.ex. Skapa ett erbjudande för däckbyte inkl. däckhotell." },
  { id: "case", label: "Kundcase", icon: "⭐", description: "Berättelse om ett kunduppdrag", placeholder: "t.ex. Kundcase om ett rekonduppdrag med fokus på kvalitet och förtroende." },
  { id: "custom", label: "Eget önskemål", icon: "✏️", description: "Beskriv fritt vad du behöver", placeholder: "Beskriv exakt vad du vill skapa. Ju mer specifik du är, desto bättre blir resultatet." },
];

async function generateContent(
  type: ContentType,
  request: string,
  profile: CompanyProfile
): Promise<GeneratedContent> {
  const month = new Date().toLocaleString("sv-SE", { month: "long" });

  const systemPrompt = `Du är en erfaren copywriter specialiserad på lokala svenska tjänsteföretag.
Skapa innehåll som känns skrivet av någon som KÄNNER företaget inifrån — inte av en AI.

FÖRETAGSPROFIL:
Företag: ${profile.companyName}
Bransch: ${profile.industry}
Sammanfattning: ${profile.summary}
Kunder: ${profile.customers?.join(", ")}
Tjänster: ${profile.products?.join(", ")}
Tonläge: ${profile.tone?.join(", ")}
Styrkor: ${profile.strengths?.join(", ")}
Undvik: ${profile.avoid?.join(", ")}
Riktlinjer: ${profile.contentGuidelines?.join(", ")}

KRITISKA REGLER:
- Använd företagets faktiska namn och specifika tjänster
- Följ tonläget exakt — matcha hur de vill uppfattas
- Undvik allt som finns i "Undvik"-listan
- Anpassa till ${month}
- Inga generiska AI-fraser som "Vi strävar efter kvalitet"
- Returnera ENDAST giltig JSON, ingen förtext, inga backticks`;

  const typeInstructions: Record<string, string> = {
    social: `Skapa ett socialt medieinlägg (Facebook/Instagram). Max 3 meningar. Konkret scenario. Direkt publiceringsfärdigt.
JSON: { "type": "Socialt inlägg", "title": "rubrik", "body": "inläggstext", "cta": "uppmaning", "notes": "bildidé" }`,
    linkedin: `Skapa ett LinkedIn-inlägg. Professionell ton, expertperspektiv, 2-3 stycken. Positions ${profile.companyName} som specialist.
JSON: { "type": "LinkedIn-inlägg", "title": "rubrik/hook", "body": "inläggstext", "cta": "avslutande uppmaning", "notes": "tips för publicering" }`,
    newsletter: `Skapa ett komplett nyhetsbrev med ämnesrad, förhandsvisning, rubrik, brödtext (2-3 stycken) och CTA.
JSON: { "type": "Nyhetsbrev", "title": "ämnesrad", "body": "FÖRHANDSVISNING: [text]\n\nRUBRIK: [rubrik]\n\n[brödtext stycke 1]\n\n[brödtext stycke 2]\n\n[brödtext stycke 3]", "cta": "call to action", "notes": "förhandsvisningstext" }`,
    campaign: `Skapa en kampanjbrief med titel, mål, budskap, kanalrekommendation och CTA.
JSON: { "type": "Kampanj", "title": "kampanjtitel", "body": "MÅL: [mål]\n\nBUDSKAP: [budskap]\n\nKANALER: [kanaler]\n\nTIDSRAM: [förslag]", "cta": "kampanjens CTA", "notes": "ytterligare råd" }`,
    offer: `Skapa en konkret erbjudandetext klar att publiceras. Specifik, lockande, tydlig.
JSON: { "type": "Erbjudande", "title": "erbjudandets rubrik", "body": "erbjudandetext", "cta": "uppmaning", "notes": "var detta passar bäst" }`,
    case: `Skapa ett kundcase i berättelseform. Problem → lösning → resultat. Bygger förtroende.
JSON: { "type": "Kundcase", "title": "casets rubrik", "body": "berättelsen i 3 stycken: situation, genomförande, resultat", "cta": "avslutande uppmaning", "notes": "hur detta kan användas" }`,
    custom: `Skapa exakt det användaren ber om. Följ alltid företagsprofilen.
JSON: { "type": "Innehåll", "title": "rubrik", "body": "innehållet", "cta": "eventuell CTA", "notes": "användningstips" }`,
  };

  const res = await fetch("/api/create-content", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      systemPrompt,
      userPrompt: `${typeInstructions[type.id] || typeInstructions.custom}\n\nAnvändarens önskemål: "${request}"`,
    }),
  });

  const data = await res.json();
  return data;
}

// ── Components ────────────────────────────────────────────

function TypeCard({ type, selected, onClick }: { type: ContentType; selected: boolean; onClick: () => void }) {
  return (
    <button onClick={onClick} style={{
      display: "flex", flexDirection: "column", alignItems: "flex-start",
      padding: "18px 20px", borderRadius: 2, cursor: "pointer",
      background: selected ? T.goldDim : T.surface,
      border: `1px solid ${selected ? T.goldBorder : T.line}`,
      transition: "all .15s", textAlign: "left", width: "100%",
    }}
    onMouseOver={e => { if (!selected) (e.currentTarget as HTMLElement).style.borderColor = T.line2; }}
    onMouseOut={e => { if (!selected) (e.currentTarget as HTMLElement).style.borderColor = T.line; }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
        <span style={{ fontSize: "1rem" }}>{type.icon}</span>
        <span style={{ fontSize: "0.88rem", fontWeight: 400, color: selected ? T.text : T.text2 }}>{type.label}</span>
      </div>
      <span style={{ fontSize: "0.72rem", fontWeight: 300, color: T.text3 }}>{type.description}</span>
    </button>
  );
}

function ResultView({ content, onNew }: { content: GeneratedContent; onNew: () => void }) {
  const [copied, setCopied] = useState(false);
  const isMobile = typeof window !== "undefined" && window.innerWidth < 640;

  function copy() {
    navigator.clipboard.writeText(`${content.title}\n\n${content.body}${content.cta ? "\n\n" + content.cta : ""}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  const sections = [
    { label: content.type, content: content.title, serif: true },
    { label: "Innehåll", content: content.body },
    content.cta ? { label: "Call to action", content: content.cta } : null,
    content.notes ? { label: "Tips", content: content.notes } : null,
  ].filter(Boolean) as { label: string; content: string; serif?: boolean }[];

  return (
    <div style={{ animation: "fadeUp .45s ease both" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 32, flexWrap: "wrap", gap: 12 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, fontSize: "0.63rem", fontWeight: 400, letterSpacing: "0.18em", textTransform: "uppercase" as const, color: T.gold }}>
          <span>✓</span> {content.type} klar
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={copy} style={{
            fontFamily: "var(--font-outfit), sans-serif", fontSize: "0.7rem", fontWeight: 400,
            letterSpacing: "0.1em", textTransform: "uppercase" as const,
            padding: "8px 18px", borderRadius: 2, border: "none",
            background: T.gold, color: T.bg, cursor: "pointer",
          }}>
            {copied ? "✓ Kopierat" : "Kopiera"}
          </button>
          <button onClick={onNew} style={{
            fontFamily: "var(--font-outfit), sans-serif", fontSize: "0.7rem", fontWeight: 400,
            letterSpacing: "0.1em", textTransform: "uppercase" as const,
            padding: "8px 16px", borderRadius: 2,
            border: `1px solid ${T.line2}`, background: "transparent",
            color: T.text3, cursor: "pointer",
          }}>
            Skapa nytt
          </button>
        </div>
      </div>

      <div style={{ borderTop: `1px solid ${T.line}` }}>
        {sections.map((s, i) => (
          <div key={i} style={{ padding: "24px 0", borderBottom: `1px solid ${T.line}` }}>
            <div style={{ fontSize: "0.62rem", fontWeight: 400, letterSpacing: "0.14em", textTransform: "uppercase" as const, color: T.text3, marginBottom: 12 }}>
              {s.label}
            </div>
            {s.serif ? (
              <p style={{ fontFamily: "var(--font-cormorant), serif", fontWeight: 400, fontSize: isMobile ? "1.6rem" : "2rem", lineHeight: 1.1, letterSpacing: "-0.01em", color: T.text }}>
                {s.content}
              </p>
            ) : (
              <p style={{ fontSize: "0.95rem", fontWeight: 300, color: T.text2, lineHeight: 1.85, whiteSpace: "pre-line", maxWidth: 640 }}>
                {s.content}
              </p>
            )}
          </div>
        ))}
      </div>

      <div style={{ marginTop: 32, display: "flex", gap: 8, flexWrap: "wrap" }}>
        <button onClick={copy} style={{ fontFamily: "var(--font-outfit), sans-serif", fontSize: "0.72rem", fontWeight: 400, letterSpacing: "0.1em", textTransform: "uppercase" as const, padding: "11px 24px", borderRadius: 2, border: "none", background: T.gold, color: T.bg, cursor: "pointer" }}>
          {copied ? "✓ Kopierat" : "Kopiera allt"}
        </button>
        <button onClick={onNew} style={{ fontFamily: "var(--font-outfit), sans-serif", fontSize: "0.72rem", fontWeight: 400, letterSpacing: "0.1em", textTransform: "uppercase" as const, padding: "11px 18px", borderRadius: 2, border: `1px solid ${T.line2}`, background: "transparent", color: T.text3, cursor: "pointer" }}>
          Skapa nytt →
        </button>
      </div>
    </div>
  );
}

// ── Main ──────────────────────────────────────────────────
export default function CreatePage() {
  const [profile, setProfile] = useState<CompanyProfile | null>(null);
  const [selectedType, setSelectedType] = useState<ContentType>(CONTENT_TYPES[0]);
  const [request, setRequest] = useState("");
  const [phase, setPhase] = useState<"select" | "generating" | "result">("select");
  const [result, setResult] = useState<GeneratedContent | null>(null);
  const [error, setError] = useState("");
  const isMobile = typeof window !== "undefined" && window.innerWidth < 640;
  const pad = isMobile ? 20 : 48;

  useEffect(() => {
    const saved = localStorage.getItem("marketing-copilot-company-profile");
    if (saved) try { setProfile(JSON.parse(saved)); } catch {}
  }, []);

  async function handleGenerate() {
    if (!profile) return;
    setPhase("generating");
    setError("");
    try {
      const content = await generateContent(selectedType, request || selectedType.placeholder, profile);
      setResult(content);
      setPhase("result");
    } catch (e) {
      setError("Något gick fel. Försök igen.");
      setPhase("select");
    }
  }

  function handleNew() {
    setPhase("select");
    setResult(null);
    setRequest("");
  }

  return (
    <main style={{ minHeight: "100svh", background: T.bg }}>

      {/* Nav */}
      <nav style={{
        position: "sticky", top: 0, zIndex: 100,
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: `0 ${pad}px`, height: 56,
        background: "rgba(42,47,58,0.95)", backdropFilter: "blur(20px)",
        borderBottom: `1px solid ${T.line}`,
      }}>
        <a href="/dashboard" style={{ fontFamily: "var(--font-cormorant), serif", fontWeight: 500, fontSize: "1.1rem", letterSpacing: "0.08em", textTransform: "uppercase", color: T.text, textDecoration: "none" }}>
          Marketing<span style={{ color: T.gold }}>Copilot</span>
        </a>
        <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
          <a href="/dashboard" style={{ fontSize: "0.7rem", fontWeight: 400, letterSpacing: "0.08em", textTransform: "uppercase", color: T.text3, textDecoration: "none" }}>Veckoplan</a>
          <span style={{ fontSize: "0.7rem", fontWeight: 400, letterSpacing: "0.08em", textTransform: "uppercase", color: T.gold, borderBottom: `1px solid ${T.gold}`, paddingBottom: 2 }}>Skapa nytt</span>
        </div>
      </nav>

      <div style={{ maxWidth: 900, margin: "0 auto", padding: `56px ${pad}px 100px` }}>

        {phase === "select" && (
          <div style={{ animation: "fadeUp .45s ease both" }}>
            {/* Header */}
            <div style={{ marginBottom: 48 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, fontSize: "0.63rem", fontWeight: 400, letterSpacing: "0.18em", textTransform: "uppercase" as const, color: T.gold, marginBottom: 16 }}>
                <span style={{ width: 16, height: 1, background: T.gold, opacity: .5, display: "block" }} />
                {profile ? `${profile.companyName} · Company Brain` : "Create New"}
              </div>
              <h1 style={{ fontFamily: "var(--font-cormorant), serif", fontWeight: 300, fontSize: isMobile ? "clamp(2rem,8vw,2.8rem)" : "clamp(2.4rem,5vw,3.5rem)", lineHeight: .95, letterSpacing: "-0.02em", color: T.text, marginBottom: 14 }}>
                Vad vill du <em style={{ color: T.gold, fontStyle: "italic" }}>skapa?</em>
              </h1>
              <p style={{ fontSize: "0.9rem", fontWeight: 300, color: T.text2, lineHeight: 1.75, maxWidth: 480 }}>
                Välj typ av innehåll och beskriv vad du behöver. AI:n använder din Company Brain och skapar träffsäkert innehåll direkt.
              </p>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr 1fr" : "repeat(4, 1fr)", gap: 2, marginBottom: 40 }}>
              {CONTENT_TYPES.map(type => (
                <TypeCard key={type.id} type={type} selected={selectedType.id === type.id} onClick={() => setSelectedType(type)} />
              ))}
            </div>

            {/* Request field */}
            <div style={{ marginBottom: 32 }}>
              <label style={{ display: "block", fontSize: "0.63rem", fontWeight: 400, letterSpacing: "0.16em", textTransform: "uppercase" as const, color: T.text3, marginBottom: 10 }}>
                Beskriv vad du vill ha <span style={{ color: T.text3, fontStyle: "italic", textTransform: "none", letterSpacing: 0 }}>— valfritt</span>
              </label>
              <textarea
                value={request}
                onChange={e => setRequest(e.target.value)}
                placeholder={selectedType.placeholder}
                rows={3}
                style={{
                  width: "100%", background: "transparent", border: "none",
                  borderBottom: `1px solid ${T.line2}`, padding: "10px 0",
                  outline: "none", fontSize: "0.95rem", fontWeight: 300,
                  color: T.text, fontFamily: "var(--font-outfit), sans-serif",
                  resize: "none", lineHeight: 1.75, transition: "border-color .2s",
                }}
                onFocus={e => e.target.style.borderBottomColor = T.gold}
                onBlur={e => e.target.style.borderBottomColor = T.line2}
              />
            </div>

            {/* Company Brain indicator */}
            {profile && (
              <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px 16px", background: T.surface, border: `1px solid ${T.line}`, borderRadius: 2, marginBottom: 28 }}>
                <span style={{ fontSize: "0.9rem" }}>🧠</span>
                <div>
                  <div style={{ fontSize: "0.72rem", fontWeight: 400, color: T.text2 }}>Company Brain aktiv</div>
                  <div style={{ fontSize: "0.68rem", fontWeight: 300, color: T.text3 }}>Innehållet anpassas efter {profile.companyName}s tonläge, kunder och tjänster</div>
                </div>
                <div style={{ marginLeft: "auto", width: 6, height: 6, borderRadius: "50%", background: T.gold, animation: "pulseDot 2s ease infinite" }} />
              </div>
            )}

            {error && <p style={{ fontSize: "0.82rem", color: "#e06060", marginBottom: 16 }}>{error}</p>}

            <button onClick={handleGenerate} disabled={!profile} style={{
              fontFamily: "var(--font-outfit), sans-serif", fontSize: "0.78rem", fontWeight: 400,
              letterSpacing: "0.12em", textTransform: "uppercase" as const,
              padding: "14px 32px", borderRadius: 2, border: "none",
              background: profile ? T.gold : T.surface2,
              color: profile ? T.bg : T.text3,
              cursor: profile ? "pointer" : "not-allowed",
              transition: "all .2s", width: isMobile ? "100%" : "auto",
              display: "inline-flex", alignItems: "center", gap: 10,
            }}>
              Skapa {selectedType.label} →
            </button>

            {!profile && (
              <p style={{ marginTop: 12, fontSize: "0.75rem", fontWeight: 300, color: T.text3 }}>
                <a href="/onboarding" style={{ color: T.gold, textDecoration: "none" }}>Skapa en Company Brain</a> för att använda den här funktionen.
              </p>
            )}
          </div>
        )}

        {phase === "generating" && (
          <div style={{ animation: "fadeUp .45s ease both" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: "0.63rem", fontWeight: 400, letterSpacing: "0.18em", textTransform: "uppercase" as const, color: T.gold, marginBottom: 24 }}>
              <div style={{ width: 6, height: 6, borderRadius: "50%", background: T.gold, animation: "pulseDot 1.4s ease infinite" }} />
              Skapar {selectedType.label}
            </div>
            <h1 style={{ fontFamily: "var(--font-cormorant), serif", fontWeight: 300, fontSize: "clamp(2rem,5vw,3rem)", lineHeight: .95, letterSpacing: "-0.02em", color: T.text, marginBottom: 16 }}>
              AI:n skriver<br /><em style={{ color: T.gold, fontStyle: "italic" }}>ditt innehåll.</em>
            </h1>
            <p style={{ fontSize: "0.88rem", fontWeight: 300, color: T.text2, lineHeight: 1.75, maxWidth: 400 }}>
              Baserat på din Company Brain och dina instruktioner.
            </p>
            <div style={{ marginTop: 40, display: "flex", gap: 3, flexDirection: "column", maxWidth: 400 }}>
              {["Läser Company Brain…", `Skapar ${selectedType.label.toLowerCase()}…`, "Anpassar till ditt tonläge…"].map((s, i) => (
                <div key={i} style={{ display: "flex", alignItems: "center", gap: 14, padding: "12px 16px", borderRadius: 2, background: i === 1 ? T.goldDim : "transparent", border: `1px solid ${i === 1 ? T.goldBorder : "transparent"}` }}>
                  <div style={{ width: 20, height: 20, borderRadius: 2, display: "flex", alignItems: "center", justifyContent: "center", background: i === 0 ? T.goldDim : "transparent", border: `1px solid ${i <= 1 ? T.goldBorder : T.line2}`, fontSize: "0.65rem", color: T.gold, flexShrink: 0 }}>
                    {i === 0 ? "✓" : i === 1 ? <div style={{ width: 8, height: 8, borderRadius: "50%", border: "1.5px solid rgba(201,169,110,.25)", borderTopColor: T.gold, animation: "spin .7s linear infinite" }} /> : ""}
                  </div>
                  <span style={{ fontSize: "0.85rem", fontWeight: 300, color: i <= 1 ? T.text : T.text3 }}>{s}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {phase === "result" && result && (
          <ResultView content={result} onNew={handleNew} />
        )}
      </div>

      <style>{`
        @keyframes fadeUp { from{opacity:0;transform:translateY(12px)} to{opacity:1;transform:translateY(0)} }
        @keyframes spin { to{transform:rotate(360deg)} }
        @keyframes pulseDot { 0%,100%{opacity:1} 50%{opacity:.3} }
        textarea::placeholder { color: #718096; }
      `}</style>
    </main>
  );
}
"use client";

// ─────────────────────────────────────────────────────────────
// Create — snabbt innehållsskapande (Nyhetsbrev, Facebook-inlägg,
// Instagram-inlägg m.fl. nås alla hit från dashboardens snabb-
// åtgärder). Design migrerad till det delade designsystemet
// (Shell + app/_shared/theme+ui). generateContent(), CONTENT_TYPES,
// systemprompten och anropet till /api/create-content är HELT
// oförändrade — bara presentationen är ny.
// ─────────────────────────────────────────────────────────────
import { useState, useEffect } from "react";
import Shell from "@/app/_shared/Shell";
import { T, fontSans } from "@/app/_shared/theme";
import {
  PageHeader, PrimaryButton, GhostButton, Field, TextArea, ChoiceCard,
  CopyButton, ResultBlock, ResultCard, LoadingPanel, ErrorNote, EmptyState,
} from "@/app/_shared/ui";
import { IconContent } from "@/app/_shared/icons";

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

function ResultView({ content, onNew }: { content: GeneratedContent; onNew: () => void }) {
  const sections = [
    { label: content.type, content: content.title, headline: true },
    { label: "Innehåll", content: content.body },
    content.cta ? { label: "Call to action", content: content.cta } : null,
    content.notes ? { label: "Tips", content: content.notes } : null,
  ].filter(Boolean) as { label: string; content: string; headline?: boolean }[];

  const fullText = `${content.title}\n\n${content.body}${content.cta ? "\n\n" + content.cta : ""}`;

  return (
    <div className="fade-up">
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24, flexWrap: "wrap", gap: 12 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 9, fontFamily: fontSans, fontSize: "0.68rem", fontWeight: 500, letterSpacing: "0.14em", textTransform: "uppercase", color: T.green }}>
          ✓ {content.type} klar
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <CopyButton getText={() => fullText} />
          <GhostButton onClick={onNew}>Skapa nytt</GhostButton>
        </div>
      </div>

      <ResultCard>
        {sections.map((s, i) => <ResultBlock key={i} label={s.label} content={s.content} headline={s.headline} />)}
      </ResultCard>
    </div>
  );
}

export default function CreatePage() {
  const [profile, setProfile] = useState<CompanyProfile | null>(null);
  const [selectedType, setSelectedType] = useState<ContentType>(CONTENT_TYPES[0]);
  const [request, setRequest] = useState("");
  const [phase, setPhase] = useState<"select" | "generating" | "result">("select");
  const [result, setResult] = useState<GeneratedContent | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    function load() {
      const saved = localStorage.getItem("marketing-copilot-company-profile");
      if (saved) try { setProfile(JSON.parse(saved)); } catch { /* ignorera trasig data */ }
    }
    load();
  }, []);

  async function handleGenerate() {
    if (!profile) return;
    setPhase("generating");
    setError("");
    try {
      const content = await generateContent(selectedType, request || selectedType.placeholder, profile);
      setResult(content);
      setPhase("result");
    } catch {
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
    <Shell>
      <div style={{ maxWidth: 860, margin: "0 auto", padding: "56px 40px 100px" }}>
        {phase === "select" && (
          <div className="fade-up">
            <PageHeader
              eyebrow={profile ? `${profile.companyName} · Företagskunskap` : "Skapa nytt"}
              title="Vad vill du skapa?"
              subtitle="Välj typ av innehåll och beskriv vad du behöver. AI:n använder din företagskunskap och skapar träffsäkert innehåll direkt."
            />

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))", gap: 10, marginBottom: 36 }}>
              {CONTENT_TYPES.map((type) => (
                <ChoiceCard
                  key={type.id} icon={type.icon} label={type.label} description={type.description}
                  selected={selectedType.id === type.id} onClick={() => setSelectedType(type)}
                />
              ))}
            </div>

            <div style={{ marginBottom: 28 }}>
              <Field label="Beskriv vad du vill ha" optional>
                <TextArea
                  value={request}
                  onChange={(e) => setRequest(e.target.value)}
                  placeholder={selectedType.placeholder}
                  rows={3}
                />
              </Field>
            </div>

            {profile && (
              <div style={{
                display: "flex", alignItems: "center", gap: 12, padding: "14px 18px",
                background: T.surface, border: `1px solid ${T.line}`, borderRadius: 12, marginBottom: 28,
              }}>
                <span aria-hidden style={{ color: T.purpleBright, display: "flex" }}><IconContent size={17} /></span>
                <div>
                  <div style={{ fontFamily: fontSans, fontSize: "0.82rem", fontWeight: 500, color: T.text2 }}>Företagskunskap aktiv</div>
                  <div style={{ fontFamily: fontSans, fontSize: "0.76rem", fontWeight: 300, color: T.text3 }}>Innehållet anpassas efter {profile.companyName}s tonläge, kunder och tjänster</div>
                </div>
                <span aria-hidden style={{ marginLeft: "auto", width: 6, height: 6, borderRadius: "50%", background: T.purpleBright, animation: "pulseDot 2s ease infinite", flexShrink: 0 }} />
              </div>
            )}

            {error && <div style={{ marginBottom: 20 }}><ErrorNote>{error}</ErrorNote></div>}

            {profile ? (
              <PrimaryButton onClick={handleGenerate}>Skapa {selectedType.label}</PrimaryButton>
            ) : (
              <EmptyState
                icon={<IconContent size={19} />}
                title="Ingen företagskunskap ännu."
                body="Skapa en företagsprofil för att använda den här funktionen."
                action={<PrimaryButton href="/onboarding">Starta onboarding</PrimaryButton>}
              />
            )}
          </div>
        )}

        {phase === "generating" && (
          <LoadingPanel
            title={`Skapar ${selectedType.label.toLowerCase()}`}
            steps={["Läser företagskunskap…", `Skriver ${selectedType.label.toLowerCase()}…`, "Anpassar till ditt tonläge…"]}
            activeStep={1}
          />
        )}

        {phase === "result" && result && (
          <ResultView content={result} onNew={handleNew} />
        )}
      </div>
    </Shell>
  );
}

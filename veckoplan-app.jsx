import { useState, useEffect, useRef } from "react";

/* ─── FONTS via @import in style tag ─────────────────── */
const FONT_URL = "https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,300;0,400;0,500;1,300;1,400&family=Outfit:wght@300;400;500&display=swap";

/* ─── MOBILE HOOK ───────────────────────────────────── */
function useIsMobile() {
  const [mob, setMob] = useState(typeof window !== "undefined" && window.innerWidth < 640);
  useEffect(() => {
    const fn = () => setMob(window.innerWidth < 640);
    window.addEventListener("resize", fn);
    fn();
    return () => window.removeEventListener("resize", fn);
  }, []);
  return mob;
}

/* ─── TOKENS ─────────────────────────────────────────── */
const T = {
  bg:      "#0a0908",
  surface: "#111009",
  surface2:"#181510",
  line:    "rgba(255,248,235,0.08)",
  line2:   "rgba(255,248,235,0.13)",
  text:    "#f5f0e8",
  text2:   "rgba(245,240,232,0.55)",
  text3:   "rgba(245,240,232,0.30)",
  gold:    "#c9a96e",
  goldDim: "rgba(201,169,110,0.10)",
};

/* ─── GLOBAL STYLES ──────────────────────────────────── */
const GLOBAL_CSS = `
  @import url('${FONT_URL}');
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  html, body { height: 100%; background: ${T.bg}; color: ${T.text}; font-family: 'Outfit', sans-serif; -webkit-font-smoothing: antialiased; overflow-x: hidden; }
  input, textarea, button, select { font-family: inherit; }
  ::placeholder { color: ${T.text3}; }
  ::-webkit-scrollbar { width: 4px; }
  ::-webkit-scrollbar-track { background: ${T.bg}; }
  ::-webkit-scrollbar-thumb { background: ${T.line2}; border-radius: 2px; }

  @keyframes fadeUp   { from { opacity:0; transform:translateY(16px); } to { opacity:1; transform:translateY(0); } }
  @keyframes fadeIn   { from { opacity:0; } to { opacity:1; } }
  @keyframes spin     { to { transform: rotate(360deg); } }
  @keyframes shimmer  { 0%,100%{opacity:.3} 50%{opacity:.7} }
  @keyframes pulseDot { 0%,100%{opacity:1} 50%{opacity:.3} }
  @keyframes rot      { from{transform:translate(-50%,-50%) rotate(0deg)} to{transform:translate(-50%,-50%) rotate(360deg)} }
  @keyframes rotRev   { from{transform:translate(-50%,-50%) rotate(0deg)} to{transform:translate(-50%,-50%) rotate(-360deg)} }

  .fade-up  { animation: fadeUp  .55s ease both; }
  .fade-in  { animation: fadeIn  .45s ease both; }
  .d1 { animation-delay:.08s; }
  .d2 { animation-delay:.16s; }
  .d3 { animation-delay:.24s; }
  .d4 { animation-delay:.32s; }
  .d5 { animation-delay:.40s; }

  /* SCROLLABLE CONTENT */
  .scroll-area { overflow-y: auto; flex: 1; }

  /* SHIMMER SKELETON */
  .skel { background: ${T.surface2}; border-radius: 2px; animation: shimmer 1.6s ease infinite; }
`;

/* ─── HELPERS ────────────────────────────────────────── */
function css(obj) {
  return Object.entries(obj)
    .map(([k, v]) => `${k.replace(/([A-Z])/g, m => `-${m.toLowerCase()}`)}:${v}`)
    .join(";");
}

function Label({ children, style = {} }) {
  return (
    <div style={{ display:"flex", alignItems:"center", gap:10, fontSize:"0.67rem", fontWeight:400, letterSpacing:"0.18em", textTransform:"uppercase", color:T.gold, marginBottom:20, ...style }}>
      <span style={{ display:"block", width:22, height:1, background:T.gold, opacity:.5 }}/>
      {children}
    </div>
  );
}

function Serif({ children, style = {} }) {
  return <span style={{ fontFamily:"'Cormorant Garamond', serif", ...style }}>{children}</span>;
}

function Btn({ children, variant = "primary", onClick, disabled, style = {}, full }) {
  const base = {
    fontFamily:"'Outfit',sans-serif", fontSize:"0.75rem", fontWeight:400,
    letterSpacing:"0.1em", textTransform:"uppercase", cursor:"pointer",
    border:"none", borderRadius:2, padding:"12px 28px", transition:"all .2s",
    display:"inline-flex", alignItems:"center", justifyContent:"center", gap:8,
    width: full ? "100%" : "auto",
    opacity: disabled ? .45 : 1,
    pointerEvents: disabled ? "none" : "auto",
  };
  if (variant === "primary") return (
    <button onClick={onClick} style={{ ...base, background:T.gold, color:T.bg, ...style }}>
      {children}
    </button>
  );
  if (variant === "ghost") return (
    <button onClick={onClick} style={{ ...base, background:"transparent", color:T.text2, border:`1px solid ${T.line2}`, ...style }}>
      {children}
    </button>
  );
  return <button onClick={onClick} style={{ ...base, background:T.surface, color:T.text2, border:`1px solid ${T.line}`, ...style }}>{children}</button>;
}

function Input({ label, value, onChange, placeholder, type = "text", style = {} }) {
  return (
    <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
      {label && <div style={{ fontSize:"0.7rem", fontWeight:400, letterSpacing:"0.1em", textTransform:"uppercase", color:T.text3 }}>{label}</div>}
      <input
        type={type}
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        style={{
          background:T.surface2, border:`1px solid ${T.line2}`, borderRadius:2,
          padding:"12px 16px", fontSize:"0.88rem", fontWeight:300, color:T.text,
          outline:"none", transition:"border-color .2s", width:"100%", ...style
        }}
        onFocus={e => e.target.style.borderColor = T.gold}
        onBlur={e => e.target.style.borderColor = T.line2}
      />
    </div>
  );
}

function Divider() {
  return <div style={{ height:1, background:T.line, margin:"0" }} />;
}

function Spinner() {
  return (
    <div style={{ width:18, height:18, border:`2px solid ${T.line2}`, borderTopColor:T.gold, borderRadius:"50%", animation:"spin .7s linear infinite", flexShrink:0 }} />
  );
}

/* ─── CLAUDE API ─────────────────────────────────────── */
async function callClaude(systemPrompt, userPrompt, maxTokens = 1500) {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "claude-sonnet-4-20250514",
      max_tokens: maxTokens,
      system: systemPrompt,
      messages: [{ role: "user", content: userPrompt }],
    }),
  });
  const data = await res.json();
  if (data.error) throw new Error(data.error.message);
  const text = data.content?.map(b => b.text || "").join("") || "";
  const match = text.replace(/```json[\s\S]*?```/g, s => s.slice(7,-3)).replace(/```/g,"").trim().match(/\{[\s\S]*\}/);
  if (!match) throw new Error("Ogiltigt svar från Claude");
  return JSON.parse(match[0]);
}

async function generateWeekPackage(company) {
  const week = (() => { const d=new Date(),j=new Date(d.getFullYear(),0,1); return Math.ceil(((d-j)/86400000+j.getDay()+1)/7); })();
  const month = new Date().toLocaleString("sv-SE",{month:"long"});
  const chatContext = company._chatTranscript
    ? `\nOnboarding-samtal (använd detta för djupare förståelse):\n${company._chatTranscript}`
    : "";

  const sys = `Du är en erfaren copywriter och marknadsstrateg specialiserad på lokala svenska tjänsteföretag.

DITT UPPDRAG: Skapa marknadsinnehåll som känns skrivet av någon som KÄNNER företaget inifrån — inte av en AI.

KRITISKA REGLER:
1. Använd ALLTID företagets faktiska namn, tjänster och detaljer från profilen
2. Referera till specifika produkter/tjänster vid namn — aldrig "era tjänster" generellt
3. Anpassa till ${month} och vecka ${week} — nämn säsongen, vädret, relevanta händelser
4. Matcha branschens verkliga språk — en gasolfirma pratar inte som en frisör
5. CTA:er ska vara konkreta handlingar, inte "Kontakta oss"

FÖRBJUDNA FRASER (använd ALDRIG dessa):
- "Vi strävar efter att leverera kvalitet"
- "Nöjda kunder är vår prioritet"  
- "Vi på [företag] är stolta"
- "Tveka inte att höra av dig"
- "Med lång erfarenhet"
- Alla generiska öppningar som kan gälla vilket företag som helst

BRA INNEHÅLL refererar till:
- Specifika scenarion kunden känner igen ("Din husbil står redo för sommaren, men är gasolen påfylld?")
- Konkreta siffror eller fakta om branschen
- Lokala/säsongsrelevanta uppmaningar
- Problemet FÖRE lösningen

Svara med exakt giltig JSON — ingen förtext, inga backticks.`;

  const user = `FÖRETAGSPROFIL:
Namn: ${company.name}
Bransch: ${company.industry || "Tjänsteföretag"}
Tjänster: ${company.services || "ej specificerat"}
Målgrupp: ${company.audience || "privatpersoner och företag"}
Tonläge: ${company.tone || "professionellt och tillgängligt"}
Vill sälja mer av: ${company.sellMore || "ej specificerat"}
Plats: ${company.location || "Sverige"}
${chatContext}

NULÄGE: ${month}, vecka ${week}

Generera ett komplett marknadspaket. Varje del ska kännas skriven specifikt för ${company.name} — inte ett generiskt tjänsteföretag.

{
  "newsletter": {
    "subject": "ämnesrad som skapar nyfikenhet, max 50 tecken, nämn gärna specifik tjänst eller scenario",
    "preview": "kompletterande text, max 85 tecken",
    "headline": "rubrik som fångar ett konkret problem eller behov",
    "body": "3 stycken: 1) konkret scenario kunden känner igen, 2) hur ${company.name} löser det specifikt, 3) varför just nu",
    "cta": "specifik uppmaning med tydlig handling"
  },
  "social": [
    { "platform": "Instagram", "text": "kort, visuellt, använd ett konkret scenario. Max 3 meningar.", "hashtags": "3-4 branschrelevanta hashtags" },
    { "platform": "Facebook", "text": "lite längre, mer berättande, riktar sig till lokala kunder", "hashtags": "" },
    { "platform": "Instagram", "text": "tips-format: 'Visste du att...' eller '3 tecken på att...'", "hashtags": "3-4 hashtags" },
    { "platform": "Facebook", "text": "bakom-kulisserna eller kundperspektiv", "hashtags": "" },
    { "platform": "Instagram", "text": "säsongsrelevant eller tidspress", "hashtags": "3-4 hashtags" }
  ],
  "linkedin": [
    { "headline": "expertperspektiv från branschen", "body": "2 stycken, yrkesperson-till-yrkesperson ton, konkret insikt" },
    { "headline": "vanligt misstag eller missuppfattning i branschen", "body": "2 stycken, pedagogiskt" },
    { "headline": "lokalt eller säsongsrelevant vinkel", "body": "2 stycken" }
  ],
  "campaigns": [
    { "title": "kampanjnamn", "type": "Säsongskampanj", "description": "specifik kampanj för ${month} med konkret erbjudande och deadline", "cta": "handlingsuppmaning med urgency" },
    { "title": "kampanjnamn", "type": "Serviceerbjudande", "description": "paketerbjudande eller tilläggstjänst kopplad till ${company.sellMore || 'huvudtjänst'}", "cta": "specifik knapptext" }
  ],
  "opportunities": [
    { "title": "konkret händelse/temadag i ${month}", "relevance": "exakt hur ${company.name} kan använda detta" },
    { "title": "säsongstrend eller beteende hos målgruppen nu", "relevance": "konkret innehållsidé" },
    { "title": "lokal eller branschspecifik möjlighet", "relevance": "hur man agerar på det" }
  ]
}`;

  return await callClaude(sys, user, 2000);
}

/* ─── NAV ────────────────────────────────────────────── */
function Nav({ view, setView, company }) {
  const isMobile = useIsMobile();
  return (
    <nav style={{
      position:"fixed", top:0, left:0, right:0, zIndex:200,
      display:"flex", alignItems:"center", justifyContent:"space-between",
      padding:`0 ${isMobile ? 20 : 40}px`, height:56,
      background:"rgba(10,9,8,0.92)", backdropFilter:"blur(20px)",
      borderBottom:`1px solid ${T.line}`,
    }}>
      <button onClick={() => setView("home")} style={{ background:"none", border:"none", cursor:"pointer", padding:0 }}>
        <Serif style={{ fontSize:"1.15rem", fontWeight:400, letterSpacing:"0.08em", textTransform:"uppercase", color:T.text }}>
          Vecko<span style={{ color:T.gold }}>plan</span>
        </Serif>
      </button>

      {company && (
        <div style={{ display:"flex", alignItems:"center", gap: isMobile ? 8 : 20 }}>
          {!isMobile && (
            <>
              <NavBtn active={view==="week"} onClick={() => setView("week")}>Veckoplan</NavBtn>
              <NavBtn active={view==="brain"} onClick={() => setView("brain")}>Company Brain</NavBtn>
            </>
          )}
          <div style={{ width:7, height:7, borderRadius:"50%", background:T.gold, animation:"pulseDot 2s ease infinite" }} />
          <span style={{ fontSize:"0.72rem", fontWeight:300, color:T.text3, letterSpacing:"0.04em", maxWidth:120, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{company.name}</span>
        </div>
      )}
    </nav>
  );
}

function NavBtn({ children, active, onClick }) {
  return (
    <button onClick={onClick} style={{
      background:"none", border:"none", cursor:"pointer",
      fontSize:"0.72rem", fontWeight:400, letterSpacing:"0.08em",
      textTransform:"uppercase", color: active ? T.gold : T.text3,
      transition:"color .2s", padding:"4px 0",
      borderBottom: active ? `1px solid ${T.gold}` : "1px solid transparent",
    }}>
      {children}
    </button>
  );
}

/* ─── ONBOARDING — Chattflöde ────────────────────────── */
const FIRST_QUESTION = "Hej! Vad heter ditt företag och vad gör ni för något?";

async function getNextQuestion(messages) {
  // Generate a smart follow-up based on what's been said
  const transcript = messages.map(m => `${m.role==="ai"?"AI":"Användare"}: ${m.text}`).join("\n");
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method:"POST",
    headers:{"Content-Type":"application/json"},
    body: JSON.stringify({
      model:"claude-sonnet-4-20250514",
      max_tokens:120,
      system:`Du onboardar ett lokalt svenskt tjänsteföretag till ett AI-marknadsföringsverktyg.
Ställ EN kort, specifik följdfråga baserad på vad användaren redan svarat.
Målet är att förstå: målgrupp, vad de vill sälja mer av, och tonläge.
Redan besvarat ${messages.filter(m=>m.role==="user").length} frågor.
Om 3+ svar redan finns: svara med exakt texten "KLAR"
Annars: skriv BARA följdfrågan — ingen hälsning, ingen förklaring. Max 20 ord.`,
      messages:[{role:"user", content:`Samtal hittills:
${transcript}

Vad är nästa fråga?`}]
    })
  });
  const d = await res.json();
  return d.content?.map(b=>b.text||"").join("").trim() || "KLAR";
}

async function buildProfileFromChat(messages) {
  const transcript = messages.map(m => `${m.role==="ai"?"AI":"Användare"}: ${m.text}`).join("\n");
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method:"POST",
    headers:{"Content-Type":"application/json"},
    body: JSON.stringify({
      model:"claude-sonnet-4-20250514",
      max_tokens:600,
      system:`Extrahera en detaljerad företagsprofil från detta onboarding-samtal.
Plocka ut ALLA specifika detaljer — produktnamn, tjänster, kundtyper, geografiska områden, prissättning, säsongsvariationer.
Svara med exakt giltig JSON. Ingen förtext. Svara på svenska.`,
      messages:[{role:"user", content:`Samtal:
${transcript}

Returnera:
{"name":"","industry":"","services":"lista alla nämnda tjänster/produkter","audience":"så specifik som möjligt","tone":"","sellMore":"","location":"","extras":"övriga viktiga detaljer från samtalet"}`}]
    })
  });
  const d = await res.json();
  const raw = d.content?.map(b=>b.text||"").join("") || "";
  const match = raw.replace(/\`\`\`json|\`\`\`/g,"").trim().match(/\{[\s\S]*\}/);
  if (!match) throw new Error("Parse failed");
  const profile = JSON.parse(match[0]);
  // Attach full transcript for richer week generation
  profile._chatTranscript = transcript;
  return profile;
}

function Onboarding({ onComplete }) {
  const [messages, setMessages] = useState([
    { role: "ai", text: FIRST_QUESTION }
  ]);
  const [input, setInput] = useState("");
  const [qIndex, setQIndex] = useState(0);
  const [building, setBuilding] = useState(false);
  const [done, setDone] = useState(false);
  const bottomRef = useRef(null);
  const inputRef = useRef(null);

  const isMobile = useIsMobile();
  const pad = isMobile ? 20 : 48;

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    if (!building) inputRef.current?.focus();
  }, [messages, building]);

  async function send() {
    const val = input.trim();
    if (!val || building) return;
    setInput("");

    const newMessages = [...messages, { role: "user", text: val }];
    setMessages(newMessages);

    // Ask Claude if we need more info or are ready
    setTimeout(async () => {
      try {
        const next = await getNextQuestion(newMessages);
        if (next === "KLAR" || next.includes("KLAR")) {
          setMessages(prev => [...prev, { role:"ai", text:"Perfekt — jag sätter ihop er profil nu." }]);
          setBuilding(true);
          const profile = await buildProfileFromChat(newMessages);
          setDone(true);
          setMessages(prev => [...prev, {
            role:"ai",
            text:`Klar! Jag känner nu till ${profile.name || "ert företag"} tillräckligt väl. Genererar er första veckoplan nu…`
          }]);
          setTimeout(() => onComplete(profile), 1000);
        } else {
          setMessages(prev => [...prev, { role:"ai", text:next }]);
          setQIndex(i => i + 1);
        }
      } catch(e) {
        // Fallback if API fails
        const answers = newMessages.filter(m=>m.role==="user");
        if (answers.length >= 3) {
          setBuilding(true);
          setMessages(prev => [...prev, { role:"ai", text:"Tack — genererar er veckoplan nu." }]);
          setTimeout(() => onComplete(parseFallback(newMessages)), 800);
        } else {
          setMessages(prev => [...prev, { role:"ai", text:"Berätta mer — vilka kunder vänder ni er till?" }]);
          setQIndex(i => i + 1);
        }
      }
    }, 500);
  }

  function parseFallback(msgs) {
    const answers = msgs.filter(m => m.role === "user").map(m => m.text);
    return {
      name: answers[0]?.split(/[,.]|och|&/)[0]?.trim() || "Ert företag",
      industry: "Tjänsteföretag",
      services: answers[0] || "",
      audience: answers[1] || "",
      sellMore: answers[2] || "",
      tone: "Professionellt",
      location: "",
    };
  }

  const progress = Math.min(100, Math.round((qIndex / 4) * 100));

  return (
    <div style={{ minHeight:"100svh", display:"flex", flexDirection:"column", paddingTop:56 }}>

      {/* Progress bar */}
      <div style={{ height:2, background:T.line }}>
        <div style={{
          height:"100%", background:T.gold,
          width:`${done ? 100 : progress}%`,
          transition:"width .6s ease",
          opacity:.7,
        }}/>
      </div>

      {/* Header */}
      <div style={{ padding:`24px ${pad}px 20px`, borderBottom:`1px solid ${T.line}` }}>
        <div style={{ display:"flex", alignItems:"center", gap:10, fontSize:"0.65rem", fontWeight:400, letterSpacing:"0.15em", textTransform:"uppercase", color:T.gold, marginBottom:8 }}>
          <span style={{ width:18, height:1, background:T.gold, opacity:.5, display:"block" }}/>
          Onboarding · {done ? "Klar" : `Fråga ${qIndex+1}`}
        </div>
        <Serif style={{ fontSize: isMobile ? "1.5rem" : "2rem", fontWeight:300, letterSpacing:"-0.01em", display:"block", lineHeight:1.1 }}>
          Låt oss lära känna<br/><em style={{ color:T.gold }}>ert företag.</em>
        </Serif>
      </div>

      {/* Chat messages */}
      <div style={{ flex:1, overflowY:"auto", padding:`28px ${pad}px`, display:"flex", flexDirection:"column", gap:16 }}>
        {messages.map((m, i) => (
          <div key={i} style={{
            display:"flex",
            justifyContent: m.role === "user" ? "flex-end" : "flex-start",
            animation:"fadeUp .4s ease both",
          }}>
            {m.role === "ai" && (
              <div style={{ width:24, height:24, borderRadius:"50%", background:T.goldDim, border:`1px solid rgba(201,169,110,.2)`, display:"flex", alignItems:"center", justifyContent:"center", fontSize:"0.7rem", flexShrink:0, marginRight:10, marginTop:2 }}>
                ✦
              </div>
            )}
            <div style={{
              maxWidth:"75%",
              padding:"12px 16px",
              borderRadius: m.role === "user" ? "12px 12px 2px 12px" : "12px 12px 12px 2px",
              background: m.role === "user" ? T.goldDim : T.surface,
              border: `1px solid ${m.role === "user" ? "rgba(201,169,110,.2)" : T.line}`,
              fontSize:"0.9rem", fontWeight:300, color: m.role === "user" ? T.text : T.text2,
              lineHeight:1.65,
              fontFamily: m.role === "ai" ? "'Cormorant Garamond', serif" : "inherit",
              fontSize: m.role === "ai" ? "1.05rem" : "0.88rem",
            }}>
              {m.text}
            </div>
          </div>
        ))}

        {building && !done && (
          <div style={{ display:"flex", alignItems:"center", gap:10 }}>
            <div style={{ width:24, height:24, borderRadius:"50%", background:T.goldDim, border:`1px solid rgba(201,169,110,.2)`, display:"flex", alignItems:"center", justifyContent:"center", fontSize:"0.7rem", flexShrink:0 }}>✦</div>
            <div style={{ display:"flex", gap:5, padding:"12px 16px", background:T.surface, border:`1px solid ${T.line}`, borderRadius:"12px 12px 12px 2px" }}>
              {[0,1,2].map(i => (
                <div key={i} style={{ width:5, height:5, borderRadius:"50%", background:T.gold, opacity:.4, animation:`pulseDot 1.2s ease ${i*.2}s infinite` }}/>
              ))}
            </div>
          </div>
        )}
        <div ref={bottomRef}/>
      </div>

      {/* Input */}
      {!building && (
        <div style={{ padding:`16px ${pad}px`, borderTop:`1px solid ${T.line}`, display:"flex", gap:10 }}>
          <input
            ref={inputRef}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === "Enter" && !e.shiftKey && send()}
            placeholder={qIndex === 0 ? "t.ex. Vi är Gasolfyllarna, vi säljer och fyller gasol…" : "Skriv ditt svar…"}
            style={{
              flex:1, background:T.surface2, border:`1px solid ${T.line2}`,
              borderRadius:2, padding:"11px 14px",
              fontSize:"0.88rem", fontWeight:300, color:T.text, outline:"none",
            }}
            onFocus={e => e.target.style.borderColor = T.gold}
            onBlur={e => e.target.style.borderColor = T.line2}
          />
          <button onClick={send} disabled={!input.trim()} style={{
            background: input.trim() ? T.gold : T.surface2,
            color: input.trim() ? T.bg : T.text3,
            border:"none", borderRadius:2, padding:"11px 18px",
            fontSize:"0.75rem", fontWeight:400, letterSpacing:"0.1em",
            textTransform:"uppercase", cursor: input.trim() ? "pointer" : "not-allowed",
            transition:"all .2s", flexShrink:0,
          }}>
            Skicka
          </button>
        </div>
      )}
    </div>
  );
}

/* ─── WEEK VIEW ──────────────────────────────────────── */
function WeekView({ company, pkg, loading, onRegenerate }) {
  const [active, setActive] = useState(null);
  const [copied, setCopied] = useState(null);
  const isMobile = useIsMobile();
  const pad = isMobile ? 20 : 40;

  const sections = pkg ? [
    { id:"newsletter", icon:"📧", label:"Nyhetsbrev", tag:"1 st", preview: pkg.newsletter?.subject },
    { id:"social",     icon:"📱", label:"Sociala medier", tag:`${pkg.social?.length || 5} inlägg`, preview:"Anpassade för din bransch" },
    { id:"linkedin",   icon:"💼", label:"LinkedIn", tag:"3 idéer", preview: pkg.linkedin?.[0]?.headline },
    { id:"campaigns",  icon:"🎯", label:"Kampanjförslag", tag:"2 förslag", preview: pkg.campaigns?.[0]?.title },
    { id:"opportunities", icon:"📅", label:"Möjligheter", tag:"3 st", preview: pkg.opportunities?.[0]?.title },
  ] : [];

  function copy(text) {
    navigator.clipboard.writeText(text).catch(() => {});
    setCopied(text.slice(0, 20));
    setTimeout(() => setCopied(null), 2000);
  }

  const weekNum = (() => {
    const d = new Date(); const jan1 = new Date(d.getFullYear(),0,1);
    return Math.ceil(((d - jan1) / 86400000 + jan1.getDay() + 1) / 7);
  })();

  return (
    <div style={{ minHeight:"100svh", display:"flex", flexDirection:"column", paddingTop:56 }}>

      {/* Header */}
      <div style={{ padding:`28px ${pad}px 24px`, borderBottom:`1px solid ${T.line}`, display:"flex", alignItems:"center", justifyContent:"space-between", flexWrap:"wrap", gap:12 }}>
        <div>
          <div style={{ fontSize:"0.62rem", fontWeight:400, letterSpacing:"0.12em", textTransform:"uppercase", color:T.text3, marginBottom:6 }}>
            Vecka {weekNum} · {new Date().getFullYear()}
          </div>
          <Serif style={{ fontSize: isMobile ? "1.5rem" : "2rem", fontWeight:300, letterSpacing:"-0.01em" }}>
            {loading ? "Genererar veckoplan…" : "Din marknadsplan är klar."}
          </Serif>
        </div>
        <div style={{ display:"flex", gap:8, alignItems:"center" }}>
          {loading ? <Spinner /> : (
            <>
              <div style={{ display:"flex", alignItems:"center", gap:6, fontSize:"0.68rem", fontWeight:400, letterSpacing:"0.08em", textTransform:"uppercase", color:T.gold }}>
                <div style={{ width:5, height:5, borderRadius:"50%", background:T.gold, animation:"pulseDot 2s ease infinite" }}/>
                Klar
              </div>
              <Btn variant="ghost" onClick={onRegenerate} style={{ fontSize:"0.68rem", padding:"8px 14px" }}>Generera ny</Btn>
            </>
          )}
        </div>
      </div>

      {/* MOBILE: show detail panel fullscreen when active */}
      {isMobile && active && pkg ? (
        <div style={{ flex:1, overflowY:"auto", padding:`20px ${pad}px 100px` }}>
          <button onClick={() => setActive(null)} style={{
            display:"flex", alignItems:"center", gap:8, background:"none", border:"none",
            cursor:"pointer", color:T.text3, fontSize:"0.72rem", fontWeight:400,
            letterSpacing:"0.08em", textTransform:"uppercase", marginBottom:20, padding:0,
          }}>
            ← Tillbaka
          </button>
          <DetailPanel id={active} pkg={pkg} copy={copy} copied={copied} />
        </div>
      ) : (
        <div style={{ flex:1, display:"flex", flexDirection: isMobile ? "column" : "row", overflow:"hidden" }}>

          {/* LEFT — List */}
          <div style={{
            borderRight: isMobile ? "none" : `1px solid ${T.line}`,
            overflowY: isMobile ? "visible" : "auto",
            flexShrink: 0,
            width: isMobile ? "100%" : "50%",
          }}>
            {loading ? (
              <div style={{ padding:`${pad}px` }}>
                {[1,2,3,4,5].map(i => (
                  <div key={i} style={{ display:"flex", gap:14, padding:"18px 0", borderBottom:`1px solid ${T.line}` }}>
                    <div className="skel" style={{ width:36, height:36, flexShrink:0 }} />
                    <div style={{ flex:1, display:"flex", flexDirection:"column", gap:8 }}>
                      <div className="skel" style={{ height:12, width:"60%" }} />
                      <div className="skel" style={{ height:10, width:"40%" }} />
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              sections.map(s => (
                <div key={s.id}
                  onClick={() => setActive(active === s.id ? null : s.id)}
                  style={{
                    display:"flex", alignItems:"center", gap:12, padding:`16px ${pad}px`,
                    borderBottom:`1px solid ${T.line}`, cursor:"pointer",
                    background: active === s.id ? T.surface : "transparent",
                    transition:"background .15s",
                  }}>
                  <div style={{
                    width:34, height:34, borderRadius:2, flexShrink:0,
                    background: active === s.id ? T.goldDim : T.surface2,
                    border:`1px solid ${active === s.id ? "rgba(201,169,110,0.25)" : T.line}`,
                    display:"flex", alignItems:"center", justifyContent:"center", fontSize:"0.95rem",
                  }}>
                    {s.icon}
                  </div>
                  <div style={{ flex:1, minWidth:0 }}>
                    <div style={{ fontSize:"0.85rem", fontWeight:400, color: active === s.id ? T.text : T.text2, marginBottom:2 }}>{s.label}</div>
                    <div style={{ fontSize:"0.7rem", fontWeight:300, color:T.text3, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{s.preview}</div>
                  </div>
                  <span style={{ fontSize:"0.62rem", fontWeight:400, letterSpacing:"0.08em", textTransform:"uppercase", color: active === s.id ? T.gold : T.text3, flexShrink:0 }}>{s.tag}</span>
                  <span style={{ color: active === s.id ? T.gold : T.text3, fontSize:"0.75rem" }}>→</span>
                </div>
              ))
            )}

            {pkg && !loading && (
              <div style={{ padding:`16px ${pad}px ${isMobile ? 80 : 16}px`, display:"flex", gap:8, flexWrap:"wrap" }}>
                <Btn variant="primary" onClick={() => copy(buildFullText(pkg))} style={{ fontSize:"0.68rem", padding:"9px 18px" }}>
                  {copied ? "✓ Kopierat" : "Kopiera allt"}
                </Btn>
                <Btn variant="ghost" style={{ fontSize:"0.68rem", padding:"9px 18px" }}>Schemalägg</Btn>
              </div>
            )}
          </div>

          {/* RIGHT — Detail (desktop only) */}
          {!isMobile && (
            <div className="scroll-area" style={{ flex:1, overflowY:"auto", padding:`28px ${pad}px`, maxHeight:"calc(100svh - 56px - 89px)" }}>
              {!pkg && !loading && (
                <div style={{ display:"flex", alignItems:"center", justifyContent:"center", height:200 }}>
                  <p style={{ fontSize:"0.85rem", fontWeight:300, color:T.text3 }}>Välj ett avsnitt till vänster</p>
                </div>
              )}
              {pkg && active && <DetailPanel id={active} pkg={pkg} copy={copy} copied={copied} />}
              {pkg && !active && (
                <div style={{ display:"flex", flexDirection:"column", gap:16, paddingTop:8 }}>
                  <p style={{ fontSize:"0.85rem", fontWeight:300, color:T.text3, lineHeight:1.7 }}>Välj ett avsnitt till vänster för att se och kopiera innehållet.</p>
                  <Serif style={{ fontSize:"1.1rem", fontWeight:300, color:T.text2, lineHeight:1.5 }}>
                    Genererat för <em style={{ color:T.gold }}>{company.name}</em> — {company.industry}
                  </Serif>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function DetailPanel({ id, pkg, copy, copied }) {
  const isMobile = useIsMobile();

  function CopyBtn({ text, label = "Kopiera" }) {
    return (
      <Btn variant="ghost" onClick={() => copy(text)} style={{ fontSize:"0.65rem", padding:"6px 12px" }}>
        {copied && text.startsWith(copied) ? "✓" : label}
      </Btn>
    );
  }

  function Block({ children, style = {} }) {
    return (
      <div style={{ background:T.surface, border:`1px solid ${T.line}`, borderRadius:2, padding:"20px 20px", marginBottom:12, ...style }}>
        {children}
      </div>
    );
  }

  function FieldLabel({ children }) {
    return <div style={{ fontSize:"0.62rem", fontWeight:400, letterSpacing:"0.12em", textTransform:"uppercase", color:T.text3, marginBottom:6 }}>{children}</div>;
  }

  function FieldText({ children }) {
    return <div style={{ fontSize:"0.85rem", fontWeight:300, color:T.text2, lineHeight:1.75, whiteSpace:"pre-wrap" }}>{children}</div>;
  }

  if (id === "newsletter" && pkg.newsletter) {
    const n = pkg.newsletter;
    const full = `ÄMNESRAD: ${n.subject}\n\n${n.headline}\n\n${n.body}\n\n${n.cta}`;
    return (
      <div className="fade-in">
        <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:20 }}>
          <Label style={{ marginBottom:0 }}>Nyhetsbrev</Label>
          <CopyBtn text={full} label="Kopiera allt" />
        </div>
        <Block>
          <FieldLabel>Ämnesrad</FieldLabel>
          <FieldText>{n.subject}</FieldText>
        </Block>
        <Block>
          <FieldLabel>Förhandsvisning</FieldLabel>
          <FieldText>{n.preview}</FieldText>
        </Block>
        <Block>
          <FieldLabel>Rubrik</FieldLabel>
          <Serif style={{ fontSize:"1.1rem", fontWeight:400, color:T.text, lineHeight:1.3 }}>{n.headline}</Serif>
        </Block>
        <Block>
          <FieldLabel>Innehåll</FieldLabel>
          <FieldText>{n.body}</FieldText>
        </Block>
        <Block>
          <FieldLabel>Call to action</FieldLabel>
          <div style={{ display:"inline-block", background:T.goldDim, border:`1px solid rgba(201,169,110,.25)`, borderRadius:2, padding:"8px 16px", fontSize:"0.82rem", fontWeight:400, color:T.gold }}>
            {n.cta}
          </div>
        </Block>
      </div>
    );
  }

  if (id === "social" && pkg.social) {
    return (
      <div className="fade-in">
        <Label style={{ marginBottom:20 }}>Sociala medier</Label>
        {pkg.social.map((p, i) => (
          <Block key={i}>
            <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:12 }}>
              <div style={{ fontSize:"0.65rem", fontWeight:400, letterSpacing:"0.1em", textTransform:"uppercase", color:T.text3 }}>
                {p.platform} · Inlägg {i+1}
              </div>
              <CopyBtn text={`${p.text}${p.hashtags ? "\n\n"+p.hashtags : ""}`} />
            </div>
            <FieldText>{p.text}</FieldText>
            {p.hashtags && (
              <div style={{ marginTop:10, fontSize:"0.78rem", fontWeight:300, color:T.gold, opacity:.7 }}>{p.hashtags}</div>
            )}
          </Block>
        ))}
      </div>
    );
  }

  if (id === "linkedin" && pkg.linkedin) {
    return (
      <div className="fade-in">
        <Label style={{ marginBottom:20 }}>LinkedIn</Label>
        {pkg.linkedin.map((p, i) => (
          <Block key={i}>
            <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:12 }}>
              <div style={{ fontSize:"0.65rem", fontWeight:400, letterSpacing:"0.1em", textTransform:"uppercase", color:T.text3 }}>Idé {i+1}</div>
              <CopyBtn text={`${p.headline}\n\n${p.body}`} />
            </div>
            <Serif style={{ fontSize:"1rem", fontWeight:400, color:T.text, lineHeight:1.3, marginBottom:10 }}>{p.headline}</Serif>
            <FieldText>{p.body}</FieldText>
          </Block>
        ))}
      </div>
    );
  }

  if (id === "campaigns" && pkg.campaigns) {
    return (
      <div className="fade-in">
        <Label style={{ marginBottom:20 }}>Kampanjförslag</Label>
        {pkg.campaigns.map((c, i) => (
          <Block key={i}>
            <div style={{ fontSize:"0.62rem", fontWeight:400, letterSpacing:"0.1em", textTransform:"uppercase", color:T.gold, marginBottom:10 }}>{c.type}</div>
            <Serif style={{ fontSize:"1.15rem", fontWeight:400, color:T.text, lineHeight:1.2, marginBottom:12 }}>{c.title}</Serif>
            <FieldText>{c.description}</FieldText>
            <div style={{ marginTop:16, display:"inline-block", background:T.goldDim, border:`1px solid rgba(201,169,110,.2)`, borderRadius:2, padding:"7px 14px", fontSize:"0.78rem", color:T.gold }}>
              {c.cta}
            </div>
          </Block>
        ))}
      </div>
    );
  }

  if (id === "opportunities" && pkg.opportunities) {
    return (
      <div className="fade-in">
        <Label style={{ marginBottom:20 }}>Möjligheter den här veckan</Label>
        {pkg.opportunities.map((o, i) => (
          <Block key={i} style={{ display:"flex", gap:14, alignItems:"flex-start" }}>
            <div style={{ width:6, height:6, borderRadius:"50%", background:T.gold, opacity:.5, marginTop:6, flexShrink:0 }} />
            <div>
              <div style={{ fontSize:"0.88rem", fontWeight:400, color:T.text, marginBottom:4 }}>{o.title}</div>
              <div style={{ fontSize:"0.8rem", fontWeight:300, color:T.text3, lineHeight:1.65 }}>{o.relevance}</div>
            </div>
          </Block>
        ))}
      </div>
    );
  }

  return null;
}

function buildFullText(pkg) {
  if (!pkg) return "";
  const n = pkg.newsletter || {};
  const lines = [
    "=== NYHETSBREV ===",
    `Ämnesrad: ${n.subject || ""}`,
    `\n${n.headline || ""}`,
    `\n${n.body || ""}`,
    `\nCTA: ${n.cta || ""}`,
    "\n\n=== SOCIALA MEDIER ===",
    ...(pkg.social || []).map((p,i) => `\n[${p.platform} ${i+1}]\n${p.text}${p.hashtags?"\n"+p.hashtags:""}`),
    "\n\n=== LINKEDIN ===",
    ...(pkg.linkedin || []).map((p,i) => `\n[Idé ${i+1}]\n${p.headline}\n${p.body}`),
    "\n\n=== KAMPANJER ===",
    ...(pkg.campaigns || []).map(c => `\n${c.title}\n${c.description}`),
  ];
  return lines.join("\n");
}

/* ─── COMPANY BRAIN ──────────────────────────────────── */
function BrainView({ company, onUpdate }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState({ ...company });
  const isMobile = useIsMobile();
  const pad = isMobile ? 20 : 40;

  const fields = [
    { key:"name", label:"Företagsnamn" },
    { key:"website", label:"Webbplats" },
    { key:"industry", label:"Bransch" },
    { key:"services", label:"Tjänster" },
    { key:"sellMore", label:"Vill sälja mer av" },
    { key:"audience", label:"Målgrupp" },
    { key:"tone", label:"Tonläge" },
  ];

  return (
    <div style={{ minHeight:"100svh", paddingTop:56 }}>
      <div style={{ padding:`28px ${pad}px 24px`, borderBottom:`1px solid ${T.line}`, display:"flex", alignItems:"center", justifyContent:"space-between", flexWrap:"wrap", gap:12 }}>
        <div>
          <Label style={{ marginBottom:8 }}>Company Brain</Label>
          <Serif style={{ fontSize: isMobile ? "1.6rem" : "2.2rem", fontWeight:300, letterSpacing:"-0.01em" }}>
            Vad AI:n vet om <em style={{ color:T.gold }}>{company.name}</em>
          </Serif>
        </div>
        {!editing && <Btn variant="ghost" onClick={() => setEditing(true)} style={{ fontSize:"0.68rem", padding:"8px 14px" }}>Redigera</Btn>}
      </div>

      {/* Orbit visual */}
      <div style={{ padding:`40px ${pad}px 0`, display:"flex", justifyContent:"center" }}>
        <div style={{ position:"relative", width:220, height:220 }}>
          {[
            { w:70, h:70, style:{ borderColor:"rgba(201,169,110,.2)" } },
            { w:130, h:130, animation:"rot 20s linear infinite" },
            { w:190, h:190, animation:"rotRev 30s linear infinite" },
            { w:220, h:220 },
          ].map((r, i) => (
            <div key={i} style={{
              position:"absolute", top:"50%", left:"50%",
              width:r.w, height:r.h, borderRadius:"50%",
              border:`1px solid ${T.line}`, transform:"translate(-50%,-50%)",
              animation: r.animation, ...r.style,
            }} />
          ))}
          <div style={{
            position:"absolute", top:"50%", left:"50%",
            transform:"translate(-50%,-50%)",
            width:48, height:48, borderRadius:"50%",
            background:T.goldDim, border:`1px solid rgba(201,169,110,.25)`,
            display:"flex", alignItems:"center", justifyContent:"center",
            fontSize:"1.1rem", zIndex:2,
          }}>🧠</div>
          {[
            ["Hemsida","top:0","left:50%","translateX(-50%)"],
            ["Tjänster","top:18%","right:-8px"],
            ["Historik","bottom:18%","right:-8px"],
            ["Tonläge","bottom:0","left:50%","translateX(-50%)"],
            ["Kunder","bottom:18%","left:-8px"],
            ["Bransch","top:18%","left:-8px"],
          ].map(([label, ...pos], i) => (
            <div key={i} style={{
              position:"absolute", background:T.surface2, border:`1px solid ${T.line2}`,
              borderRadius:1, padding:"3px 7px", fontSize:"0.58rem", fontWeight:300,
              letterSpacing:"0.06em", textTransform:"uppercase", color:T.text3,
              whiteSpace:"nowrap",
              top: pos[0]?.startsWith("top") ? pos[0].split(":")[1] : "auto",
              bottom: pos[0]?.startsWith("bottom") ? pos[0].split(":")[1] : "auto",
              left: pos[1]?.startsWith("left") ? pos[1].split(":")[1] : "auto",
              right: pos[1]?.startsWith("right") ? pos[1].split(":")[1] : "auto",
              transform: pos[2] || "none",
            }}>{label}</div>
          ))}
        </div>
      </div>

      {/* Fields */}
      <div style={{ padding:`32px ${pad}px`, maxWidth:640 }}>
        {editing ? (
          <div style={{ display:"flex", flexDirection:"column", gap:16 }}>
            {fields.map(f => (
              <Input key={f.key} label={f.label} value={draft[f.key] || ""} onChange={v => setDraft({...draft, [f.key]:v})} />
            ))}
            <div style={{ display:"flex", gap:10, marginTop:8 }}>
              <Btn onClick={() => { onUpdate(draft); setEditing(false); }}>Spara</Btn>
              <Btn variant="ghost" onClick={() => { setDraft({...company}); setEditing(false); }}>Avbryt</Btn>
            </div>
          </div>
        ) : (
          <div style={{ borderTop:`1px solid ${T.line}` }}>
            {fields.map(f => company[f.key] ? (
              <div key={f.key} style={{ display:"flex", gap:20, padding:"16px 0", borderBottom:`1px solid ${T.line}`, flexWrap: isMobile ? "wrap" : "nowrap" }}>
                <span style={{ fontSize:"0.68rem", fontWeight:400, letterSpacing:"0.1em", textTransform:"uppercase", color:T.text3, width:isMobile ? "100%" : 120, flexShrink:0 }}>{f.label}</span>
                <span style={{ fontSize:"0.88rem", fontWeight:300, color:T.text2 }}>{company[f.key]}</span>
              </div>
            ) : null)}
          </div>
        )}

        {/* Upload area */}
        {!editing && (
          <div style={{ marginTop:40 }}>
            <Label>Ladda upp material</Label>
            <div style={{
              border:`1px dashed ${T.line2}`, borderRadius:2, padding:"40px 24px",
              textAlign:"center", color:T.text3, fontSize:"0.82rem", fontWeight:300,
              lineHeight:1.7,
            }}>
              <div style={{ fontSize:"1.4rem", marginBottom:12, opacity:.4 }}>📁</div>
              Dra och släpp bilder, broschyrer, produktblad<br/>eller tidigare nyhetsbrev hit.
              <div style={{ marginTop:16 }}>
                <Btn variant="ghost" style={{ fontSize:"0.68rem", padding:"8px 14px" }}>Välj filer</Btn>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/* ─── HOME / SPLASH ──────────────────────────────────── */
function Home({ onStart }) {
  const isMobile = useIsMobile();
  const pad = isMobile ? 24 : 56;
  return (
    <div style={{ minHeight:"100svh", paddingTop:56, display:"flex", flexDirection:"column" }}>
      <div style={{ flex:1, display:"flex", flexDirection:"column", justifyContent:"flex-end", padding:`80px ${pad}px 56px`, position:"relative", overflow:"hidden" }}>

        {/* Background glow */}
        <div style={{ position:"absolute", bottom:0, left:0, width:"50vw", height:"50vh", background:"radial-gradient(ellipse at bottom left, rgba(201,169,110,0.05) 0%, transparent 65%)", pointerEvents:"none" }} />
        <div style={{ position:"absolute", bottom:"-0.15em", right:"-0.05em", fontFamily:"'Cormorant Garamond',serif", fontWeight:300, fontSize:"clamp(180px,30vw,400px)", lineHeight:1, color:"rgba(201,169,110,0.04)", userSelect:"none", pointerEvents:"none", letterSpacing:"-0.04em" }}>∞</div>
        <div style={{ height:1, background:T.line, position:"absolute", top:56, left:pad, right:pad }} />

        <div className="fade-up" style={{ marginBottom:32 }}>
          <div style={{ display:"flex", alignItems:"center", gap:12, fontSize:"0.68rem", fontWeight:400, letterSpacing:"0.18em", textTransform:"uppercase", color:T.gold, marginBottom:28 }}>
            <span style={{ display:"block", width:28, height:1, background:T.gold, opacity:.5 }}/>
            AI-driven marknadschef
          </div>
          <Serif style={{ fontSize:`clamp(3rem,${isMobile?"9vw":"7vw"},7rem)`, fontWeight:300, lineHeight:0.95, letterSpacing:"-0.01em", display:"block" }}>
            Din marknadsföring<br/>
            <em style={{ fontStyle:"italic", color:T.gold }}>för veckan</em><br/>
            är redan klar.
          </Serif>
        </div>

        <div className="fade-up d2" style={{ display:"flex", alignItems:isMobile?"flex-start":"flex-end", flexDirection:isMobile?"column":"row", justifyContent:"space-between", gap:28 }}>
          <p style={{ fontSize:"0.92rem", fontWeight:300, color:T.text2, lineHeight:1.8, maxWidth:400 }}>
            Varje måndag väntar ett färdigt marknadspaket — nyhetsbrev, sociala inlägg, kampanjidéer. Anpassat för just ditt företag. Du godkänner på 2 minuter.
          </p>
          <div style={{ display:"flex", flexDirection:"column", alignItems:isMobile?"flex-start":"flex-end", gap:10, flexShrink:0 }}>
            <Btn onClick={onStart}>Kom igång gratis</Btn>
            <span style={{ fontSize:"0.72rem", fontWeight:300, color:T.text3, letterSpacing:"0.04em" }}>Inget kreditkort · Klart på 15 min</span>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div style={{ display:"grid", gridTemplateColumns: isMobile ? "repeat(2,1fr)" : "repeat(4,1fr)", borderTop:`1px solid ${T.line}` }}>
        {[
          ["2 min","Per vecka"],
          ["5 +","Färdiga inlägg"],
          ["0","Egna idéer behövs"],
          ["↑","Bättre varje vecka"],
        ].map(([n,l],i) => (
          <div key={i} style={{ padding:`20px ${isMobile?12:32}px`, borderRight: i<3 ? `1px solid ${T.line}` : "none" }}>
            <Serif style={{ fontSize:isMobile?"1.4rem":"2rem", fontWeight:300, letterSpacing:"-0.02em", display:"block", marginBottom:4 }}>{n}</Serif>
            <div style={{ fontSize:"0.65rem", fontWeight:300, letterSpacing:"0.06em", textTransform:"uppercase", color:T.text3 }}>{l}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ─── MOBILE NAV BAR ─────────────────────────────────── */
function MobileTabBar({ view, setView }) {
  const isMobile = useIsMobile();
  if (!isMobile) return null;
  const tabs = [
    { id:"week", icon:"📅", label:"Veckan" },
    { id:"brain", icon:"🧠", label:"Brain" },
  ];
  return (
    <div style={{
      position:"fixed", bottom:0, left:0, right:0, zIndex:200,
      display:"flex", background:"rgba(10,9,8,0.95)", backdropFilter:"blur(20px)",
      borderTop:`1px solid ${T.line}`,
    }}>
      {tabs.map(t => (
        <button key={t.id} onClick={() => setView(t.id)} style={{
          flex:1, padding:"12px 0 16px", background:"none", border:"none", cursor:"pointer",
          display:"flex", flexDirection:"column", alignItems:"center", gap:4,
        }}>
          <span style={{ fontSize:"1.1rem" }}>{t.icon}</span>
          <span style={{ fontSize:"0.62rem", fontWeight:400, letterSpacing:"0.08em", textTransform:"uppercase", color: view === t.id ? T.gold : T.text3 }}>{t.label}</span>
        </button>
      ))}
    </div>
  );
}

/* ─── ROOT APP ───────────────────────────────────────── */
export default function App() {
  const [view, setView] = useState("home");      // home | onboarding | week | brain
  const [company, setCompany] = useState(null);
  const [pkg, setPkg] = useState(null);
  const [loading, setLoading] = useState(false);
  const isMobile = useIsMobile();

  async function handleOnboardingComplete(data) {
    setCompany(data);
    setView("week");
    setLoading(true);
    try {
      const result = await generateWeekPackage(data);
      setPkg(result);
    } catch (e) {
      console.error(e);
      setPkg(getFallbackPkg(data));
    }
    setLoading(false);
  }

  async function handleRegenerate() {
    if (!company) return;
    setLoading(true);
    setPkg(null);
    try {
      const result = await generateWeekPackage(company);
      setPkg(result);
    } catch {
      setPkg(getFallbackPkg(company));
    }
    setLoading(false);
  }

  function handleUpdateCompany(data) {
    setCompany(data);
  }

  return (
    <>
      <style>{GLOBAL_CSS}</style>
      <Nav view={view} setView={setView} company={company} />

      {view === "home"       && <Home onStart={() => setView("onboarding")} />}
      {view === "onboarding" && <Onboarding onComplete={handleOnboardingComplete} />}
      {view === "week"       && <WeekView company={company} pkg={pkg} loading={loading} onRegenerate={handleRegenerate} />}
      {view === "brain"      && <BrainView company={company} onUpdate={handleUpdateCompany} />}

      {company && isMobile && (view === "week" || view === "brain") && (
        <MobileTabBar view={view} setView={setView} />
      )}
    </>
  );
}

/* ─── FALLBACK DATA ──────────────────────────────────── */
function getFallbackPkg(company) {
  return {
    newsletter: {
      subject: `5 saker du bör veta om ${company.industry?.toLowerCase() || "din bransch"} i höst`,
      preview: "Det här är det bästa du kan göra för ditt hem den här säsongen.",
      headline: `Är din ${company.industry?.toLowerCase() || "anläggning"} redo?`,
      body: `Hösten är här och med den kommer nya utmaningar för ditt hem. Hos ${company.name} ser vi varje år hur viktigt det är att vara förberedd i tid.\n\nDet handlar inte om att vänta på att något går sönder — det handlar om att ta hand om det som fungerar, så att det fortsätter att fungera. Det sparar tid, pengar och onödig stress.\n\nBoka en genomgång med oss den här veckan och vi ser till att allt är i toppskick.`,
      cta: "Boka en tid nu →",
    },
    social: [
      { platform:"Instagram", text:`Visste du att regelbunden service kan förlänga livslängden på din installation med upp till 10 år? 💡 Boka din höstservice hos ${company.name} redan idag.`, hashtags:"#service #underhåll #proffs" },
      { platform:"Facebook",  text:`Hos ${company.name} hjälper vi dig att hålla koll på det som håller huset igång. Hör av dig så berättar vi mer!`, hashtags:"" },
      { platform:"Instagram", text:"Riktigt fint jobb klart idag! Det är dessa stunder som påminner oss om varför vi gör det vi gör. 🛠️", hashtags:"#hantverkare #stolta #proffs" },
      { platform:"Facebook",  text:`Visste du att vi erbjuder ${company.services || "kompletta tjänster"}? Kontakta oss för en kostnadsfri genomgång.`, hashtags:"" },
      { platform:"Instagram", text:"God morgon! En ny vecka med nya projekt. Har du något vi kan hjälpa till med? ☕", hashtags:"#måndag #hantverkare #lokalt" },
    ],
    linkedin: [
      { headline:`Varför förebyggande underhåll lönar sig — en guide från ${company.name}`, body:`De flesta väljer att ringa när något gått sönder. Vi har sett det hundratals gånger.\n\nMen det finns ett bättre sätt. Förebyggande underhåll kostar en bråkdel av akut reparation — och det ger dig sinnesro.\n\nHär är vad vi lärt oss efter år i branschen.` },
      { headline:"3 vanliga misstag som kostar onödiga pengar", body:`Som ${company.industry?.toLowerCase() || "hantverkare"} ser vi samma misstag om och om igen.\n\nDet handlar sällan om okunskap — det handlar om att man inte vet vad man inte vet.\n\nHär är de tre vanligaste — och hur du undviker dem.` },
      { headline:`Lokalt företagande: varför vi väljer att stanna i vår region`, body:`${company.name} hade kunnat växa nationellt. Vi valde att inte göra det.\n\nAnledningen är enkel: vi tror på att känna sina kunder. På att vara den man ringer, inte ett callcenter.\n\nDet är ett val vi är stolta över varje dag.` },
    ],
    campaigns: [
      { title:"Höstservice — boka nu, spara senare", type:"Säsongskampanj", description:`Boka din höstgenomgång hos ${company.name} under oktober och få 15% rabatt på servicen. Vi ser till att allt är i toppskick innan vintern sätter in.`, cta:"Boka höstservice" },
      { title:"Trygghetsavtal — fast pris, alltid prioritet", type:"Serviceerbjudande", description:"Med ett serviceavtal hos oss slipper du oroa dig. Fast månadsavgift, prioriterad hantering och fri rådgivning. Perfekt för villaägare som vill ha lugn i vardagen.", cta:"Läs mer om avtalet" },
    ],
    opportunities: [
      { title:"Höstsäsongen startar", relevance:"Perfekt tillfälle att kommunicera service och förberedelse inför vintern." },
      { title:"Världsdagen för Habitat (oktober)", relevance:"Knyt an till hemmet och vad det betyder — en naturlig koppling till era tjänster." },
      { title:"Smarta hem-trenden", relevance:"Många husägare funderar på uppgraderingar nu — positionera er som experten." },
    ],
  };
}

"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase-browser";

const T = {
  bg: "#2a2f3a", surface: "#323845", surface2: "#3a4050",
  line: "rgba(255,255,255,0.10)", line2: "rgba(255,255,255,0.18)",
  text: "#ffffff", text2: "#cbd5e0", text3: "#a0aec0",
  gold: "#c9a96e", goldDim: "rgba(201,169,110,0.15)", goldBorder: "rgba(201,169,110,0.30)",
};

const inputStyle = {
  width: "100%", background: "transparent", border: "none",
  borderBottom: `1px solid ${T.line2}`, padding: "12px 0",
  outline: "none", fontSize: "1rem", fontWeight: 300, color: T.text,
  fontFamily: "var(--font-outfit), sans-serif", transition: "border-color .2s",
};

export default function LoginPage() {
  const router = useRouter();
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit() {
    setError(null);
    if (!email.trim() || !password.trim()) {
      setError("Fyll i både e-post och lösenord.");
      return;
    }
    if (password.length < 6) {
      setError("Lösenordet måste vara minst 6 tecken.");
      return;
    }

    setLoading(true);
    const sb = createClient();

    try {
      if (mode === "signup") {
        const { error } = await sb.auth.signUp({ email: email.trim(), password });
        if (error) { setError(oversatt(error.message)); setLoading(false); return; }
      } else {
        const { error } = await sb.auth.signInWithPassword({ email: email.trim(), password });
        if (error) { setError(oversatt(error.message)); setLoading(false); return; }
      }

      const { data: { user } } = await sb.auth.getUser();
      if (user) {
        const { data: companies } = await sb
          .from("companies")
          .select("id")
          .eq("user_id", user.id)
          .limit(1);
        router.push(companies && companies.length > 0 ? "/dashboard" : "/onboarding");
      } else {
        router.push("/onboarding");
      }
    } catch {
      setError("Något gick fel. Försök igen.");
      setLoading(false);
    }
  }

  function oversatt(msg: string) {
    if (msg.includes("Invalid login credentials")) return "Fel e-post eller lösenord.";
    if (msg.includes("already registered")) return "E-posten är redan registrerad. Logga in istället.";
    if (msg.includes("User already registered")) return "E-posten är redan registrerad. Logga in istället.";
    return msg;
  }

  function handleFocus(e: React.FocusEvent<HTMLInputElement>) {
    e.target.style.borderBottomColor = T.gold;
  }
  function handleBlur(e: React.FocusEvent<HTMLInputElement>) {
    e.target.style.borderBottomColor = T.line2;
  }

  return (
    <main style={{ minHeight: "100svh", background: T.bg, display: "flex", flexDirection: "column" }}>
      <nav style={{
        display: "flex", alignItems: "center", justifyContent: "center",
        padding: "0 24px", height: 56, borderBottom: `1px solid ${T.line}`,
      }}>
        <span style={{ fontFamily: "var(--font-cormorant), serif", fontWeight: 500, fontSize: "1.1rem", letterSpacing: "0.08em", textTransform: "uppercase", color: T.text }}>
          Marketing<span style={{ color: T.gold }}>Copilot</span>
        </span>
      </nav>

      <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", padding: "24px" }}>
        <div style={{ width: "100%", maxWidth: 380, animation: "fadeUp .5s ease both" }}>

          <div style={{ display: "flex", alignItems: "center", gap: 10, fontSize: "0.63rem", fontWeight: 400, letterSpacing: "0.18em", textTransform: "uppercase", color: T.gold, marginBottom: 18 }}>
            <span style={{ width: 16, height: 1, background: T.gold, opacity: .5, display: "block" }} />
            {mode === "login" ? "Logga in" : "Skapa konto"}
          </div>

          <h1 style={{ fontFamily: "var(--font-cormorant), serif", fontWeight: 300, fontSize: "clamp(2.2rem,7vw,3rem)", lineHeight: .95, letterSpacing: "-0.02em", color: T.text, marginBottom: 12 }}>
            {mode === "login" ? <>Välkommen<br /><em style={{ color: T.gold, fontStyle: "italic" }}>tillbaka.</em></> : <>Kom igång<br /><em style={{ color: T.gold, fontStyle: "italic" }}>på en minut.</em></>}
          </h1>
          <p style={{ fontSize: "0.88rem", fontWeight: 300, color: T.text2, lineHeight: 1.7, marginBottom: 36 }}>
            {mode === "login" ? "Logga in för att se din marknadsföring." : "Skapa ett konto med e-post och lösenord."}
          </p>

          <div style={{ display: "flex", flexDirection: "column", gap: 24, marginBottom: 28 }}>
            <div>
              <label style={{ display: "block", fontSize: "0.62rem", fontWeight: 400, letterSpacing: "0.14em", textTransform: "uppercase", color: T.text3, marginBottom: 4 }}>E-post</label>
              <input type="email" value={email} onChange={e => setEmail(e.target.value)}
                onKeyDown={e => e.key === "Enter" && handleSubmit()}
                placeholder="namn@foretag.se" style={inputStyle} onFocus={handleFocus} onBlur={handleBlur} />
            </div>
            <div>
              <label style={{ display: "block", fontSize: "0.62rem", fontWeight: 400, letterSpacing: "0.14em", textTransform: "uppercase", color: T.text3, marginBottom: 4 }}>Lösenord</label>
              <input type="password" value={password} onChange={e => setPassword(e.target.value)}
                onKeyDown={e => e.key === "Enter" && handleSubmit()}
                placeholder="Minst 6 tecken" style={inputStyle} onFocus={handleFocus} onBlur={handleBlur} />
            </div>
          </div>

          {error && (
            <div style={{ marginBottom: 20, padding: "10px 14px", borderRadius: 2, background: "rgba(220,80,80,0.1)", border: "1px solid rgba(220,80,80,0.3)", fontSize: "0.8rem", color: "#f0a0a0" }}>
              {error}
            </div>
          )}

          <button onClick={handleSubmit} disabled={loading} style={{
            width: "100%", display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 10,
            fontFamily: "var(--font-outfit), sans-serif", fontSize: "0.78rem", fontWeight: 400,
            letterSpacing: "0.12em", textTransform: "uppercase", padding: "14px 32px",
            borderRadius: 2, border: "none", background: loading ? T.surface2 : T.gold,
            color: loading ? T.text3 : T.bg, cursor: loading ? "not-allowed" : "pointer", transition: "all .2s",
          }}>
            {loading && <span style={{ width: 13, height: 13, borderRadius: "50%", border: "1.5px solid rgba(201,169,110,.3)", borderTopColor: T.bg, display: "inline-block", animation: "spin .7s linear infinite" }} />}
            {loading ? "Ett ögonblick…" : mode === "login" ? "Logga in →" : "Skapa konto →"}
          </button>

          <div style={{ marginTop: 28, textAlign: "center" }}>
            <button onClick={() => { setMode(mode === "login" ? "signup" : "login"); setError(null); }} style={{
              background: "none", border: "none", cursor: "pointer",
              fontSize: "0.8rem", fontWeight: 300, color: T.text3, fontFamily: "var(--font-outfit), sans-serif",
            }}>
              {mode === "login" ? (
                <>Inget konto? <span style={{ color: T.gold }}>Skapa ett</span></>
              ) : (
                <>Har du redan konto? <span style={{ color: T.gold }}>Logga in</span></>
              )}
            </button>
          </div>

        </div>
      </div>

      <style>{`
        @keyframes fadeUp { from{opacity:0;transform:translateY(14px)} to{opacity:1;transform:translateY(0)} }
        @keyframes spin { to { transform: rotate(360deg); } }
        input::placeholder { color: #5a6577; }
      `}</style>
    </main>
  );
}
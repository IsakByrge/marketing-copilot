"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase-browser";
import { useRouter } from "next/navigation";

const T = {
  bg: "#2a2f3a", surface: "#323845", surface2: "#3a4050",
  line: "rgba(255,255,255,0.10)", line2: "rgba(255,255,255,0.18)",
  text: "#ffffff", text2: "#cbd5e0", text3: "#a0aec0",
  gold: "#c9a96e", goldDim: "rgba(201,169,110,0.15)", goldBorder: "rgba(201,169,110,0.30)",
};

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [step, setStep] = useState<"email" | "code">("email");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  async function sendCode() {
    if (!email) return;
    setLoading(true);
    setError(null);
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOtp({
  email,
  options: {
    emailRedirectTo: `${process.env.NEXT_PUBLIC_SITE_URL ?? window.location.origin}/auth/callback`,
    shouldCreateUser: true,
  },
});
    if (error) {
      setError(error.message);
    } else {
      setStep("code");
    }
    setLoading(false);
  }

  async function verifyCode() {
    if (!code) return;
    setLoading(true);
    setError(null);
    const supabase = createClient();
    const { error } = await supabase.auth.verifyOtp({
      email,
      token: code,
      type: "email",
    });
    if (error) {
      setError("Felaktig kod. Försök igen.");
    } else {
      router.push("/dashboard");
    }
    setLoading(false);
  }

  return (
    <main style={{ minHeight: "100svh", background: T.bg, display: "flex", flexDirection: "column", justifyContent: "flex-end", padding: "80px 48px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, fontSize: "0.65rem", fontWeight: 400, letterSpacing: "0.18em", textTransform: "uppercase", color: T.gold, marginBottom: 24 }}>
        <span style={{ width: 18, height: 1, background: T.gold, opacity: .5, display: "block" }} />
        Marketing Copilot
      </div>

      {step === "email" ? (
        <>
          <h1 style={{ fontFamily: "var(--font-cormorant), serif", fontWeight: 300, fontSize: "clamp(2.8rem,7vw,6rem)", lineHeight: .95, letterSpacing: "-0.02em", color: T.text, margin: "0 0 20px" }}>
            Välkommen<br /><em style={{ color: T.gold, fontStyle: "italic" }}>tillbaka.</em>
          </h1>
          <p style={{ fontSize: "0.95rem", fontWeight: 300, color: T.text2, lineHeight: 1.8, maxWidth: 400, marginBottom: 36 }}>
            Skriv in din e-post så skickar vi en engångskod — inget lösenord behövs.
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: 12, maxWidth: 400 }}>
            <input
              type="email"
              placeholder="din@epost.se"
              value={email}
              onChange={e => setEmail(e.target.value)}
              onKeyDown={e => e.key === "Enter" && sendCode()}
              style={{
                padding: "13px 16px", borderRadius: 2,
                border: `1px solid ${T.line2}`, background: T.surface,
                color: T.text, fontSize: "0.9rem", fontFamily: "var(--font-outfit), sans-serif",
                outline: "none",
              }}
            />
            {error && <p style={{ fontSize: "0.75rem", color: "#fc8181", margin: 0 }}>{error}</p>}
            <button
              onClick={sendCode}
              disabled={loading || !email}
              style={{
                display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 10,
                fontFamily: "var(--font-outfit), sans-serif", fontSize: "0.75rem", fontWeight: 400,
                letterSpacing: "0.12em", textTransform: "uppercase", padding: "13px 28px",
                borderRadius: 2, background: loading || !email ? T.surface2 : T.gold,
                color: loading || !email ? T.text3 : T.bg, border: "none",
                cursor: loading || !email ? "not-allowed" : "pointer",
              }}
            >
              {loading && <span style={{ width: 13, height: 13, borderRadius: "50%", border: `1.5px solid rgba(201,169,110,.3)`, borderTopColor: T.bg, display: "inline-block", animation: "spin .7s linear infinite" }} />}
              {loading ? "Skickar…" : "Skicka kod"}
            </button>
          </div>
        </>
      ) : (
        <>
          <h1 style={{ fontFamily: "var(--font-cormorant), serif", fontWeight: 300, fontSize: "clamp(2.8rem,7vw,6rem)", lineHeight: .95, letterSpacing: "-0.02em", color: T.text, margin: "0 0 20px" }}>
            Kolla<br /><em style={{ color: T.gold, fontStyle: "italic" }}>inkorgen.</em>
          </h1>
          <p style={{ fontSize: "0.95rem", fontWeight: 300, color: T.text2, lineHeight: 1.8, maxWidth: 400, marginBottom: 36 }}>
            Vi skickade en 6-siffrig kod till <span style={{ color: T.text }}>{email}</span>. Skriv in den nedan.
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: 12, maxWidth: 400 }}>
            <input
              type="text"
              inputMode="numeric"
              placeholder="123456"
              value={code}
              onChange={e => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
              onKeyDown={e => e.key === "Enter" && verifyCode()}
              style={{
                padding: "13px 16px", borderRadius: 2,
                border: `1px solid ${T.line2}`, background: T.surface,
                color: T.text, fontSize: "1.4rem", fontFamily: "var(--font-outfit), sans-serif",
                outline: "none", letterSpacing: "0.3em", textAlign: "center",
              }}
            />
            {error && <p style={{ fontSize: "0.75rem", color: "#fc8181", margin: 0 }}>{error}</p>}
            <button
              onClick={verifyCode}
              disabled={loading || code.length < 6}
              style={{
                display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 10,
                fontFamily: "var(--font-outfit), sans-serif", fontSize: "0.75rem", fontWeight: 400,
                letterSpacing: "0.12em", textTransform: "uppercase", padding: "13px 28px",
                borderRadius: 2, background: loading || code.length < 6 ? T.surface2 : T.gold,
                color: loading || code.length < 6 ? T.text3 : T.bg, border: "none",
                cursor: loading || code.length < 6 ? "not-allowed" : "pointer",
              }}
            >
              {loading && <span style={{ width: 13, height: 13, borderRadius: "50%", border: `1.5px solid rgba(201,169,110,.3)`, borderTopColor: T.bg, display: "inline-block", animation: "spin .7s linear infinite" }} />}
              {loading ? "Verifierar…" : "Logga in"}
            </button>
            <button
              onClick={() => { setStep("email"); setCode(""); setError(null); }}
              style={{ background: "none", border: "none", cursor: "pointer", fontSize: "0.7rem", fontWeight: 400, letterSpacing: "0.1em", textTransform: "uppercase", color: T.text3, padding: 0, textAlign: "left" }}
            >
              ← Ändra e-post
            </button>
          </div>
        </>
      )}

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        input::placeholder { color: ${T.text3}; }
        input:focus { border-color: ${T.goldBorder} !important; }
      `}</style>
    </main>
  );
}
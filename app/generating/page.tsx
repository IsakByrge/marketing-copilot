"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

const T = {
  bg: "#2a2f3a", surface: "#323845", surface2: "#3a4050",
  line: "rgba(255,255,255,0.10)", line2: "rgba(255,255,255,0.18)",
  text: "#ffffff", text2: "#cbd5e0", text3: "#a0aec0",
  gold: "#c9a96e", goldDim: "rgba(201,169,110,0.15)", goldBorder: "rgba(201,169,110,0.30)",
};

const STEPS = [
  "Läser företagsprofil…",
  "Analyserar bransch och säsong…",
  "Identifierar målgrupp och tonläge…",
  "Genererar sociala inlägg…",
  "Skriver nyhetsbrev…",
  "Bygger kampanjförslag…",
  "Färdigställer veckoplanen…",
];

export default function GeneratingPage() {
  const router = useRouter();
  const [currentStep, setCurrentStep] = useState(0);
  const [done, setDone] = useState(false);

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentStep(prev => {
        if (prev >= STEPS.length - 1) {
          clearInterval(interval);
          setDone(true);
          setTimeout(() => router.push("/dashboard"), 600);
          return prev;
        }
        return prev + 1;
      });
    }, 380);
    return () => clearInterval(interval);
  }, [router]);

  return (
    <main style={{
      minHeight: "100svh", background: T.bg,
      display: "flex", alignItems: "center", justifyContent: "center",
      padding: "40px 24px",
    }}>
      {/* Background glow */}
      <div style={{
        position: "fixed", top: "50%", left: "50%",
        transform: "translate(-50%, -50%)",
        width: 500, height: 500, borderRadius: "50%",
        background: "radial-gradient(circle, rgba(201,169,110,0.05) 0%, transparent 70%)",
        pointerEvents: "none",
      }} />

      <div style={{
        width: "100%", maxWidth: 480,
        background: T.surface, border: `1px solid ${T.line2}`,
        borderRadius: 4, overflow: "hidden",
        boxShadow: "0 40px 100px rgba(0,0,0,0.3)",
        position: "relative",
      }}>
        {/* Progress bar */}
        <div style={{ height: 2, background: T.line }}>
          <div style={{
            height: "100%", background: T.gold, opacity: .6,
            width: `${done ? 100 : Math.round((currentStep / (STEPS.length - 1)) * 100)}%`,
            transition: "width .4s ease",
          }} />
        </div>

        <div style={{ padding: "36px 36px 32px" }}>
          {/* Header */}
          <div style={{ marginBottom: 32 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, fontSize: "0.63rem", fontWeight: 400, letterSpacing: "0.18em", textTransform: "uppercase", color: T.gold, marginBottom: 14 }}>
              <div style={{ width: 5, height: 5, borderRadius: "50%", background: T.gold, animation: done ? "none" : "pulseDot 1.5s ease infinite" }} />
              {done ? "Klar" : "Arbetar"}
            </div>
            <h1 style={{ fontFamily: "var(--font-cormorant), serif", fontWeight: 300, fontSize: "2.2rem", lineHeight: .95, letterSpacing: "-0.02em", color: T.text }}>
              {done ? "Din veckoplan är klar." : "Skapar din\nmarknadsplan…"}
            </h1>
          </div>

          {/* Steps */}
          <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
            {STEPS.map((step, i) => {
              const isActive = i === currentStep && !done;
              const isDone = i < currentStep || done;
              return (
                <div key={i} style={{
                  display: "flex", alignItems: "center", gap: 14,
                  padding: "11px 14px", borderRadius: 2,
                  background: isActive ? T.goldDim : "transparent",
                  border: `1px solid ${isActive ? T.goldBorder : "transparent"}`,
                  transition: "all .3s",
                  opacity: i > currentStep && !done ? .3 : 1,
                }}>
                  <div style={{
                    width: 20, height: 20, borderRadius: 2, flexShrink: 0,
                    display: "flex", alignItems: "center", justifyContent: "center",
                    background: isDone ? T.goldDim : "transparent",
                    border: `1px solid ${isDone || isActive ? T.goldBorder : T.line2}`,
                    fontSize: "0.65rem", color: isDone ? T.gold : T.text3,
                  }}>
                    {isActive ? (
                      <div style={{ width: 8, height: 8, borderRadius: "50%", border: `1.5px solid rgba(201,169,110,.3)`, borderTopColor: T.gold, animation: "spin .7s linear infinite" }} />
                    ) : isDone ? "✓" : ""}
                  </div>
                  <span style={{ fontSize: "0.82rem", fontWeight: 300, color: isActive ? T.text : isDone ? T.text2 : T.text3 }}>
                    {step}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes pulseDot { 0%,100%{opacity:1} 50%{opacity:.3} }
      `}</style>
    </main>
  );
}
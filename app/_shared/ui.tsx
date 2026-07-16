"use client";

// ─────────────────────────────────────────────────────────────
// Små, delade presentationskomponenter för det nya designspråket.
// Ingen affärslogik — bara återanvänd visuell konsekvens mellan
// Idag, Innehåll, Företagskunskap, Kampanjer, Historik och de
// migrerade snabbflödena (Create, Nyhetsbrev, Kampanjidé, Inlägg).
// ─────────────────────────────────────────────────────────────
import Link from "next/link";
import { useState, type ReactNode } from "react";
import { T, fontSans, fontSerif, transition } from "./theme";
import { IconArrowRight } from "./icons";

export function Eyebrow({ children, color = T.purpleBright }: { children: React.ReactNode; color?: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 9, fontFamily: fontSans, fontSize: "0.68rem", fontWeight: 500, letterSpacing: "0.14em", textTransform: "uppercase", color }}>
      <span style={{ width: 16, height: 1, background: color, opacity: 0.6, display: "block" }} />
      {children}
    </div>
  );
}

export function PrimaryButton({ href, onClick, children }: { href?: string; onClick?: () => void; children: React.ReactNode }) {
  const style: React.CSSProperties = {
    display: "inline-flex", alignItems: "center", gap: 9,
    fontFamily: fontSans, fontSize: "0.86rem", fontWeight: 500,
    padding: "13px 22px", borderRadius: 10, textDecoration: "none", border: "none", cursor: "pointer",
    background: `linear-gradient(155deg, ${T.purple}, #6f4fe0)`,
    color: "#ffffff", boxShadow: `0 8px 24px -8px ${T.purpleGlow}`,
    transition,
  };
  const hover = (e: React.MouseEvent<HTMLElement>) => {
    e.currentTarget.style.boxShadow = `0 10px 32px -6px ${T.purpleGlow}`;
    e.currentTarget.style.transform = "translateY(-1px)";
  };
  const out = (e: React.MouseEvent<HTMLElement>) => {
    e.currentTarget.style.boxShadow = `0 8px 24px -8px ${T.purpleGlow}`;
    e.currentTarget.style.transform = "translateY(0)";
  };
  if (href) return <Link href={href} style={style} onMouseOver={hover} onMouseOut={out}>{children}<IconArrowRight size={15} /></Link>;
  return <button onClick={onClick} style={style} onMouseOver={hover} onMouseOut={out}>{children}<IconArrowRight size={15} /></button>;
}

export function GhostButton({ href, onClick, children, disabled }: { href?: string; onClick?: () => void; children: React.ReactNode; disabled?: boolean }) {
  const style: React.CSSProperties = {
    display: "inline-flex", alignItems: "center", gap: 8,
    fontFamily: fontSans, fontSize: "0.82rem", fontWeight: 400,
    padding: "12px 20px", borderRadius: 10, textDecoration: "none",
    background: "transparent", border: `1px solid ${T.line2}`, color: disabled ? T.text4 : T.text2,
    cursor: disabled ? "default" : "pointer", transition,
  };
  const hover = (e: React.MouseEvent<HTMLElement>) => { if (!disabled) { e.currentTarget.style.borderColor = T.purpleBorder; e.currentTarget.style.color = T.text; } };
  const out = (e: React.MouseEvent<HTMLElement>) => { e.currentTarget.style.borderColor = T.line2; e.currentTarget.style.color = disabled ? T.text4 : T.text2; };
  if (href && !disabled) return <Link href={href} style={style} onMouseOver={hover} onMouseOut={out}>{children}</Link>;
  return <button onClick={onClick} disabled={disabled} style={style} onMouseOver={hover} onMouseOut={out}>{children}</button>;
}

/** Sidhuvud som återanvänds av varje nav-destination — samma rytm som Idag. */
export function PageHeader({ eyebrow, title, subtitle }: { eyebrow: string; title: string; subtitle?: string }) {
  return (
    <div style={{ marginBottom: 40 }}>
      <Eyebrow>{eyebrow}</Eyebrow>
      <h1 style={{
        fontFamily: "var(--font-cormorant), serif", fontWeight: 300,
        fontSize: "clamp(1.9rem,4vw,2.6rem)", letterSpacing: "-0.01em", color: T.text,
        margin: "14px 0 10px", lineHeight: 1.08,
      }}>
        {title}
      </h1>
      {subtitle && (
        <p style={{ fontFamily: fontSans, fontSize: "0.92rem", fontWeight: 300, color: T.text3, lineHeight: 1.6, maxWidth: 560 }}>
          {subtitle}
        </p>
      )}
    </div>
  );
}

/** Generisk, premiumdesignad tomläges-yta — ärlig, aldrig påhittad data. */
export function EmptyState({ icon, title, body, action }: {
  icon: React.ReactNode; title: string; body: string; action?: React.ReactNode;
}) {
  return (
    <div style={{
      padding: "44px 36px", borderRadius: 16, background: T.surface, border: `1px dashed ${T.line2}`,
      display: "flex", flexDirection: "column", alignItems: "flex-start", gap: 14, maxWidth: 560,
    }}>
      <span aria-hidden style={{
        width: 42, height: 42, borderRadius: 11, display: "flex", alignItems: "center", justifyContent: "center",
        background: T.purpleDim, border: `1px solid ${T.purpleBorder}`, color: T.purpleBright,
      }}>
        {icon}
      </span>
      <div>
        <p style={{ fontFamily: fontSans, fontSize: "0.98rem", fontWeight: 500, color: T.text, marginBottom: 6 }}>{title}</p>
        <p style={{ fontFamily: fontSans, fontSize: "0.86rem", fontWeight: 300, color: T.text3, lineHeight: 1.65 }}>{body}</p>
      </div>
      {action}
    </div>
  );
}

/** Kompakt sektionsetikett — mindre framträdande än Eyebrow, för underrubriker inom en yta. */
export function SectionLabel({ children }: { children: ReactNode }) {
  return (
    <div style={{ fontFamily: fontSans, fontSize: "0.68rem", fontWeight: 500, letterSpacing: "0.1em", textTransform: "uppercase", color: T.text3 }}>
      {children}
    </div>
  );
}

const fieldBaseStyle: React.CSSProperties = {
  width: "100%", background: T.surface2, border: `1px solid ${T.line2}`, borderRadius: 10,
  padding: "13px 15px", outline: "none", fontSize: "0.92rem", fontWeight: 300, color: T.text,
  fontFamily: fontSans, transition,
};

/** Etikettad ram för ett formulärfält — konsekvent label/hint/felmeddelande. */
export function Field({ label, hint, error, optional, children }: {
  label: string; hint?: string; error?: string; optional?: boolean; children: ReactNode;
}) {
  return (
    <div>
      <label style={{
        display: "flex", alignItems: "baseline", gap: 8,
        fontFamily: fontSans, fontSize: "0.68rem", fontWeight: 500, letterSpacing: "0.1em",
        textTransform: "uppercase", color: T.text3, marginBottom: 9,
      }}>
        {label}
        {optional && <span style={{ fontWeight: 300, letterSpacing: "0.02em", textTransform: "none", color: T.text4 }}>— valfritt</span>}
      </label>
      {hint && <p style={{ fontFamily: fontSans, fontSize: "0.8rem", fontWeight: 300, color: T.text3, lineHeight: 1.55, marginBottom: 10 }}>{hint}</p>}
      {children}
      {error && <p style={{ marginTop: 8, fontFamily: fontSans, fontSize: "0.78rem", fontWeight: 400, color: T.red }}>{error}</p>}
    </div>
  );
}

type FieldElementProps = React.InputHTMLAttributes<HTMLInputElement> & { error?: boolean };
export function TextInput({ error, style, ...props }: FieldElementProps) {
  return (
    <input
      {...props}
      style={{ ...fieldBaseStyle, borderColor: error ? T.red : T.line2, ...style }}
      onFocus={(e) => { e.target.style.borderColor = error ? T.red : T.purple; e.target.style.boxShadow = `0 0 0 3px ${error ? T.redDim : T.purpleDim}`; props.onFocus?.(e); }}
      onBlur={(e) => { e.target.style.borderColor = error ? T.red : T.line2; e.target.style.boxShadow = "none"; props.onBlur?.(e); }}
    />
  );
}

type TextAreaElementProps = React.TextareaHTMLAttributes<HTMLTextAreaElement> & { error?: boolean };
export function TextArea({ error, style, ...props }: TextAreaElementProps) {
  return (
    <textarea
      {...props}
      style={{ ...fieldBaseStyle, resize: "vertical", lineHeight: 1.6, minHeight: 96, borderColor: error ? T.red : T.line2, ...style }}
      onFocus={(e) => { e.target.style.borderColor = error ? T.red : T.purple; e.target.style.boxShadow = `0 0 0 3px ${error ? T.redDim : T.purpleDim}`; props.onFocus?.(e); }}
      onBlur={(e) => { e.target.style.borderColor = error ? T.red : T.line2; e.target.style.boxShadow = "none"; props.onBlur?.(e); }}
    />
  );
}

/** Valbart kort — t.ex. innehållstyp eller kampanjväxlare. Full tangentbordsåtkomst. */
export function ChoiceCard({ icon, label, description, selected, onClick }: {
  icon?: ReactNode; label: string; description?: string; selected: boolean; onClick: () => void;
}) {
  return (
    <button
      type="button" onClick={onClick} aria-pressed={selected} className="mcx-focusable"
      style={{
        display: "flex", flexDirection: "column", alignItems: "flex-start", gap: 6,
        padding: "16px 18px", borderRadius: 12, cursor: "pointer", textAlign: "left", width: "100%",
        background: selected ? T.purpleDim : T.surface,
        border: `1px solid ${selected ? T.purpleBorder : T.line}`,
        transition,
      }}
      onMouseOver={(e) => { if (!selected) e.currentTarget.style.borderColor = T.line2; }}
      onMouseOut={(e) => { if (!selected) e.currentTarget.style.borderColor = T.line; }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
        {icon && <span aria-hidden style={{ fontSize: "1rem", color: selected ? T.purpleBright : T.text3 }}>{icon}</span>}
        <span style={{ fontFamily: fontSans, fontSize: "0.86rem", fontWeight: 500, color: selected ? T.text : T.text2 }}>{label}</span>
      </div>
      {description && <span style={{ fontFamily: fontSans, fontSize: "0.75rem", fontWeight: 300, color: T.text3 }}>{description}</span>}
    </button>
  );
}

/** Kopiera-knapp med inbyggd "Kopierat"-återkoppling — samma mönster överallt. */
export function CopyButton({ getText, variant = "primary", label = "Kopiera" }: {
  getText: () => string; variant?: "primary" | "ghost"; label?: string;
}) {
  const [copied, setCopied] = useState(false);
  function copy() {
    navigator.clipboard.writeText(getText());
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }
  const text = copied ? "✓ Kopierat" : label;
  return variant === "primary"
    ? <PrimaryButton onClick={copy}>{text}</PrimaryButton>
    : <GhostButton onClick={copy}>{text}</GhostButton>;
}

/** Ett block i en resultatyta — etikett + genererat innehåll. */
export function ResultBlock({ label, content, headline }: { label: string; content: string; headline?: boolean }) {
  return (
    <div style={{ padding: "22px 0", borderBottom: `1px solid ${T.line}` }}>
      <SectionLabel>{label}</SectionLabel>
      {headline ? (
        <p style={{ fontFamily: fontSerif, fontWeight: 400, fontSize: "clamp(1.5rem,3vw,2rem)", lineHeight: 1.15, letterSpacing: "-0.01em", color: T.text, marginTop: 10, maxWidth: 640 }}>
          {content}
        </p>
      ) : (
        <p style={{ fontFamily: fontSans, fontSize: "0.94rem", fontWeight: 300, color: T.text2, lineHeight: 1.8, whiteSpace: "pre-line", maxWidth: 640, marginTop: 10 }}>
          {content}
        </p>
      )}
    </div>
  );
}

/** Upphöjd yta som håller ett resultat — mörk, tydlig, aldrig ljusgrå. */
export function ResultCard({ children }: { children: ReactNode }) {
  return (
    <div style={{ background: T.surface, border: `1px solid ${T.line}`, borderRadius: 16, padding: "8px 24px", boxShadow: "0 20px 60px -32px rgba(0,0,0,0.55)" }}>
      {children}
    </div>
  );
}

/** Diskret, premium laddningspanel med stegvis progression. */
export function LoadingPanel({ title, steps, activeStep }: { title: string; steps: string[]; activeStep: number }) {
  return (
    <div className="fade-up" style={{ maxWidth: 420 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 9, marginBottom: 22 }}>
        <span style={{ width: 6, height: 6, borderRadius: "50%", background: T.purpleBright, animation: "pulseDot 1.4s ease infinite", display: "block" }} />
        <span style={{ fontFamily: fontSans, fontSize: "0.68rem", fontWeight: 500, letterSpacing: "0.14em", textTransform: "uppercase", color: T.purpleBright }}>{title}</span>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
        {steps.map((s, i) => {
          const done = i < activeStep;
          const active = i === activeStep;
          return (
            <div key={i} style={{
              display: "flex", alignItems: "center", gap: 13, padding: "10px 14px", borderRadius: 10,
              background: active ? T.purpleDim : "transparent",
              border: `1px solid ${active ? T.purpleBorder : "transparent"}`,
              opacity: !done && !active ? 0.4 : 1, transition,
            }}>
              <span style={{
                width: 18, height: 18, borderRadius: "50%", flexShrink: 0,
                display: "flex", alignItems: "center", justifyContent: "center",
                background: done ? T.purpleDim : "transparent",
                border: `1px solid ${done || active ? T.purpleBorder : T.line2}`,
                fontSize: "0.6rem", color: T.purpleBright,
              }}>
                {done ? "✓" : active ? (
                  <span style={{ width: 7, height: 7, borderRadius: "50%", border: `1.5px solid rgba(139,107,242,.3)`, borderTopColor: T.purpleBright, display: "block", animation: "spin .7s linear infinite" }} />
                ) : null}
              </span>
              <span style={{ fontFamily: fontSans, fontSize: "0.85rem", fontWeight: 300, color: done || active ? T.text2 : T.text3 }}>{s}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/** Diskret, icke-teknisk felruta. */
export function ErrorNote({ children }: { children: ReactNode }) {
  return (
    <div style={{
      display: "flex", alignItems: "flex-start", gap: 10, padding: "12px 16px", borderRadius: 10,
      background: T.redDim, border: `1px solid rgba(240,97,107,0.3)`,
      fontFamily: fontSans, fontSize: "0.85rem", fontWeight: 300, color: T.text2, lineHeight: 1.55,
    }}>
      {children}
    </div>
  );
}

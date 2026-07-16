"use client";

// ─────────────────────────────────────────────────────────────
// Små, delade presentationskomponenter för det nya designspråket.
// Ingen affärslogik — bara återanvänd visuell konsekvens mellan
// Idag, Innehåll, Företagskunskap, Kampanjer och Historik.
// ─────────────────────────────────────────────────────────────
import Link from "next/link";
import { T, fontSans, transition } from "./theme";
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

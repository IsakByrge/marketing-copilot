// ─────────────────────────────────────────────────────────────
// Delat designspråk för "Mission Control"-upplevelsen: Idag-
// dashboarden, huvudnavigationen och Campaign Builder.
//
// Detta är AVSIKTLIGT frikopplat från de befintliga guld/grafit-
// paletterna som varje äldre sida (create/newsletter/campaign/
// profile/onboarding/post/login) fortfarande definierar lokalt.
// Att byta denna fil påverkar inte de sidorna — de förblir orörda
// tills de eventuellt tas in i en senare sprint.
// ─────────────────────────────────────────────────────────────

export const T = {
  // Bakgrundsnivåer — flera diskreta mörka nivåer skapar djup utan
  // kraftiga borders.
  bg: "#0a0a10",
  bgElevated: "#0d0d14",
  sidebar: "#07070c",
  surface: "#131319",
  surface2: "#191921",
  surfaceHover: "#1e1e27",

  // Borders / linjer — mjuka, aldrig ljusa eller kraftiga.
  line: "rgba(255,255,255,0.07)",
  line2: "rgba(255,255,255,0.13)",
  lineSoft: "rgba(255,255,255,0.045)",

  // Text
  text: "#f5f5f8",
  text2: "#aeb2c2",
  text3: "#6f7386",
  text4: "#4b4e5c",

  // Primär accent: lila/violett
  purple: "#8b6bf2",
  purpleBright: "#a78bfa",
  purpleDim: "rgba(139,107,242,0.14)",
  purpleBorder: "rgba(139,107,242,0.35)",
  purpleGlow: "rgba(139,107,242,0.35)",

  // Sekundär accent: kall blå
  blue: "#5b8def",
  blueDim: "rgba(91,141,239,0.14)",
  blueBorder: "rgba(91,141,239,0.32)",

  // Statusfärger — sparsamt.
  green: "#3ecf8e",
  greenDim: "rgba(62,207,142,0.13)",
  orange: "#f0a058",
  orangeDim: "rgba(240,160,88,0.13)",
  red: "#f0616b",
  redDim: "rgba(240,97,107,0.13)",
} as const;

/** Radial glow som används bakom hero-ytor — diskret, aldrig gaming-UI. */
export const heroGlow =
  "radial-gradient(ellipse 620px 420px at 78% 22%, rgba(139,107,242,0.20) 0%, rgba(91,141,239,0.09) 40%, transparent 72%)";

/** Sidfotens gradient för sticky-paneler ovanpå scrollbart innehåll. */
export const fadeToTransparent = (color: string) =>
  `linear-gradient(to top, ${color} 65%, transparent)`;

export const fontSerif = "var(--font-cormorant), serif";
export const fontSans = "var(--font-outfit), sans-serif";

/** Standardövergång för hover/aktiva tillstånd — 180-300ms, aldrig studsig. */
export const transition = "all .2s cubic-bezier(.4,0,.2,1)";

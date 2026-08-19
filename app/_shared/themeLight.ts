// ─────────────────────────────────────────────────────────────
// Ljus motsvarighet till theme.ts — en migreringsbrygga.
//
// EN KÄLLA TILL SANNING: värdena nedan är inte färger utan pekare till
// designtokens i globals.css. Ändrar du en färg där slår den igenom
// både på sidor byggda med primitives (Tailwind-klasser) och på sidor
// som fortfarande använder inline-stilar. Tidigare fanns paletten på
// två ställen och kunde glida isär — det är precis den sortens fel som
// serif-regeln och den vita texten var.
//
// VILKET LAGER SKA JAG ANVÄNDA?
//   • Ny sida            → app/_shared/primitives.tsx. Alltid.
//   • Migrerad legacy    → uiLight.tsx + den här filen. Bara som brygga.
//   • Mörk legacy-sida   → theme.ts + ui.tsx. Rör dem inte.
//
// TAS BORT NÄR: sista sidan som importerar uiLight.tsx är omskriven på
// primitives. Just nu är det /content/facebook, /campaigns och /history.
// ─────────────────────────────────────────────────────────────

const token = (name: string) => `var(--color-${name})`;

export const T = {
  // Ytnivåer: papper → nedsänkt papper → vitt kort.
  bg: token("background"),
  bgElevated: token("surface"),
  sidebar: token("surface-sunken"),
  surface: token("surface"),
  surface2: token("surface-sunken"),
  surfaceHover: token("surface-sunken"),

  // Linjer
  line: token("border"),
  line2: token("border-strong"),
  lineSoft: token("border"),

  // Text
  text: token("text-primary"),
  text2: token("text-secondary"),
  text3: token("text-tertiary"),
  text4: token("text-tertiary"),

  // Primär accent. Nyckelnamnen är kvar från den mörka paletten så att
  // migrerade sidor slipper skrivas om — värdet är den gröna.
  purple: token("primary"),
  purpleBright: token("primary"),
  purpleDim: token("success-surface"),
  purpleBorder: token("border-strong"),
  purpleGlow: "transparent",

  // Sekundär accent — ingen egen token ännu, följer primär.
  blue: token("primary"),
  blueDim: token("success-surface"),
  blueBorder: token("border-strong"),

  // Status
  green: token("success"),
  greenDim: token("success-surface"),
  orange: token("warning"),
  orangeDim: token("warning-surface"),
  red: token("danger"),
  redDim: token("danger-surface"),
} as const;

/** Ingen glow i den ljusa designen — djupet kommer från ytnivåerna. */
export const heroGlow = "none";

export const fadeToTransparent = (color: string) =>
  `linear-gradient(180deg, ${color} 0%, transparent 100%)`;

/** Variant B är sans rakt igenom. Båda pekar på samma stack med flit. */
export const fontSerif = "var(--font-geist), ui-sans-serif, system-ui, sans-serif";
export const fontSans = "var(--font-geist), ui-sans-serif, system-ui, sans-serif";

export const transition = "all .2s cubic-bezier(.4,0,.2,1)";

// ─────────────────────────────────────────────────────────────
// Ljus motsvarighet till theme.ts, i variant B:s papperspalett.
//
// Exakt samma nycklar som den mörka `T`. Poängen är att en stor sida
// som Facebook Specialist (862 rader inline-stilar) kan migreras genom
// att byta importrad i stället för att skrivas om. Det som är
// affärslogik rörs inte alls.
//
// Värdena speglar designtokens i globals.css. Ändrar du dem där,
// ändra här också — den här filen finns bara för sidor som ännu
// använder inline-stilar i stället för primitives.
// ─────────────────────────────────────────────────────────────

export const T = {
  // Ytnivåer: papper → nedsänkt papper → vitt kort.
  bg: "#FAF7F1",
  bgElevated: "#FFFFFF",
  sidebar: "#F3EFE6",
  surface: "#FFFFFF",
  surface2: "#F3EFE6",
  surfaceHover: "#EFE9DC",

  // Linjer — varma och låga i kontrast, aldrig hårda.
  line: "#E8E1D5",
  line2: "#D8CFBE",
  lineSoft: "#F0EAE0",

  // Text
  text: "#1A1A18",
  text2: "#5C574E",
  text3: "#8A8377",
  text4: "#A8A093",

  // Primär accent: samma gröna som --color-primary.
  purple: "#125E4B",
  purpleBright: "#125E4B",
  purpleDim: "#E6EFEA",
  purpleBorder: "#BFD6CC",
  purpleGlow: "rgba(18,94,75,0.14)",

  // Sekundär accent
  blue: "#1F5E7A",
  blueDim: "#E4EEF2",
  blueBorder: "#C2D9E2",

  // Status — sparsamt.
  green: "#125E4B",
  greenDim: "#E6EFEA",
  orange: "#8A5A12",
  orangeDim: "#FAF0DC",
  red: "#A33228",
  redDim: "#FBEAE7",
} as const;

/** Ingen glow i den ljusa designen — djupet kommer från ytnivåerna. */
export const heroGlow = "none";

export const fadeToTransparent = (color: string) =>
  `linear-gradient(180deg, ${color} 0%, transparent 100%)`;

/** Variant B är sans rakt igenom. Båda pekar på samma stack med flit. */
export const fontSerif = "var(--font-geist), ui-sans-serif, system-ui, sans-serif";
export const fontSans = "var(--font-geist), ui-sans-serif, system-ui, sans-serif";

export const transition = "all .2s cubic-bezier(.4,0,.2,1)";

// ─────────────────────────────────────────────────────────────
// Temapreferens: ljust, mörkt eller systemets.
//
// Ren logik. Inga React-hookar, ingen Supabase, inget som kräver en
// webbläsare för att kunna testas — storage och matchMedia skickas in
// som argument där de behövs. Testas med tsx.
//
// ─── OM NYCKELN ──────────────────────────────────────────────
// Temat är en ENHETSPREFERENS, inte kontodata. Min telefon får vara
// mörk fast laptopen är ljus, och valet ska överleva utloggning.
//
// Därför ligger nyckeln UTANFÖR appStorage-namnrymden. clearAppStorage()
// raderar allt som börjar med "marketing-copilot-", och temat ska inte
// fångas av den städningen. Att i stället göra ett undantag i
// appStorageKeysToClear vore att bygga ett specialfall i kontodata-
// städningen för något som enkelt kan ligga bredvid. Se testet som
// låser fast detta.
// ─────────────────────────────────────────────────────────────

/** Vad användaren har valt. "system" följer operativsystemet. */
export type ThemePreference = "light" | "dark" | "system";

/** Vad som faktiskt målas. "system" finns inte här — den är upplöst. */
export type ResolvedTheme = "light" | "dark";

export const THEME_PREFERENCES: readonly ThemePreference[] = ["light", "dark", "system"];

/** Standard utan sparat val. */
export const DEFAULT_PREFERENCE: ThemePreference = "system";

/**
 * Nyckeln i localStorage.
 *
 * Prefixet "mc-" är MED FLIT ett annat än appStorage-namnrymdens
 * "marketing-copilot-". Byt inte till det senare — då raderas temat
 * vid utloggning.
 */
export const THEME_STORAGE_KEY = "mc-theme-preference";

/** Attributet på <html> som CSS:en läser. */
export const THEME_ATTRIBUTE = "data-theme";

/** Mediefrågan som avgör systemets tema. */
export const DARK_QUERY = "(prefers-color-scheme: dark)";

/** Rutter som ALLTID är ljusa, oavsett sparad preferens. Landningssidan
 *  och inloggningsflödet är låsta varumärkesytor. */
export const ALWAYS_LIGHT_PATHS: readonly string[] = ["/", "/login", "/auth/reset", "/auth/callback"];

/** Snävt: bara de tre kända värdena. Allt annat är skräp. */
export function isThemePreference(v: unknown): v is ThemePreference {
  return typeof v === "string" && (THEME_PREFERENCES as readonly string[]).includes(v);
}

/** Okänt eller saknat värde faller tillbaka på standarden. */
export function normalizePreference(v: unknown): ThemePreference {
  return isThemePreference(v) ? v : DEFAULT_PREFERENCE;
}

/**
 * Preferens + systemtema → det som faktiskt målas.
 *
 * Ett uttryckligt val vinner alltid. Bara "system" tittar på OS:et,
 * vilket är hela poängen: väljer användaren Mörkt ska ett OS-byte inte
 * ändra appen.
 */
export function resolveTheme(pref: ThemePreference, systemPrefersDark: boolean): ResolvedTheme {
  if (pref === "light") return "light";
  if (pref === "dark") return "dark";
  return systemPrefersDark ? "dark" : "light";
}

/** Sant när OS-ändringar ska slå igenom. Bara i systemläge. */
export function followsSystem(pref: ThemePreference): boolean {
  return pref === "system";
}

/** Publik yta? Då är temat ljust oavsett vad användaren valt. */
export function isAlwaysLightPath(pathname: string): boolean {
  const rent = (pathname || "/").split("?")[0].split("#")[0];
  const utanSlutslash = rent.length > 1 ? rent.replace(/\/+$/, "") : rent;
  return ALWAYS_LIGHT_PATHS.includes(utanSlutslash || "/");
}

/** Minsta bit av Storage den här modulen rör. Låter testet skicka in en
 *  attrapp, och en som kastar. */
export interface ThemeStorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

/**
 * Läser preferensen defensivt.
 *
 * localStorage kastar i privat läge, med blockerade kakor och i vissa
 * inbäddade webbvyer. Ett tema är inte värt ett undantag som stoppar
 * sidan — faller den, faller vi tillbaka på standarden.
 */
export function readPreference(storage: ThemeStorageLike | null | undefined): ThemePreference {
  try {
    return normalizePreference(storage?.getItem(THEME_STORAGE_KEY));
  } catch {
    return DEFAULT_PREFERENCE;
  }
}

/** Skriver defensivt. Returnerar false när skrivningen inte gick igenom,
 *  så att anroparen vet att valet inte överlever en omladdning. */
export function writePreference(
  storage: ThemeStorageLike | null | undefined,
  pref: ThemePreference,
): boolean {
  try {
    if (!storage) return false;
    storage.setItem(THEME_STORAGE_KEY, pref);
    return true;
  } catch {
    return false;
  }
}

/** Svenska etiketter i den ordning kontrollen visar dem. */
export const THEME_LABELS: Record<ThemePreference, string> = {
  light: "Ljust",
  dark: "Mörkt",
  system: "System",
};

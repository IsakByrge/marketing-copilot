// Deterministiskt test för temapreferensen. Ingen webbläsare, ingen DOM.
// Kör: tsx app/_shared/theme-preference.test.mts
import {
  DEFAULT_PREFERENCE, THEME_PREFERENCES, THEME_STORAGE_KEY, THEME_LABELS,
  ALWAYS_LIGHT_PATHS,
  followsSystem, isAlwaysLightPath, isThemePreference, normalizePreference,
  readPreference, resolveTheme, writePreference,
  type ThemeStorageLike,
} from "./theme-preference";
import { APP_STORAGE_PREFIX, appStorageKeysToClear } from "./appStorage";

let failures = 0;
function assert(cond: boolean, msg: string) {
  if (!cond) { failures++; console.error(`  ✗ ${msg}`); }
}

/** Attrapp som beter sig som localStorage. */
function fakeStorage(init: Record<string, string> = {}): ThemeStorageLike & { data: Record<string, string> } {
  const data = { ...init };
  return {
    data,
    getItem: (k) => (k in data ? data[k] : null),
    setItem: (k, v) => { data[k] = v; },
  };
}

/** Attrapp som kastar — privat läge, blockerade kakor, inbäddad webbvy. */
const kastande: ThemeStorageLike = {
  getItem() { throw new Error("SecurityError"); },
  setItem() { throw new Error("SecurityError"); },
};

/* ── Validering ───────────────────────────────────────── */
{
  for (const p of THEME_PREFERENCES) assert(isThemePreference(p), `${p} är en giltig preferens`);
  for (const skrap of ["", "LIGHT", "Dark", "auto", "oled", null, undefined, 0, 1, {}, []]) {
    assert(!isThemePreference(skrap), `${JSON.stringify(skrap)} är inte en giltig preferens`);
  }
  assert(THEME_PREFERENCES.length === 3, "exakt tre val");
  assert(DEFAULT_PREFERENCE === "system", "standarden utan sparat val är system");

  assert(normalizePreference("dark") === "dark", "giltigt värde behålls");
  assert(normalizePreference("OLED") === "system", "ogiltigt värde faller tillbaka på system");
  assert(normalizePreference(null) === "system", "saknat värde faller tillbaka på system");
  assert(normalizePreference(undefined) === "system", "undefined faller tillbaka på system");
}

/* ── Upplösning ───────────────────────────────────────── */
{
  assert(resolveTheme("light", false) === "light", "light + OS ljust → light");
  assert(resolveTheme("light", true) === "light", "light + OS mörkt → light ändå, uttryckligt val vinner");
  assert(resolveTheme("dark", false) === "dark", "dark + OS ljust → dark ändå");
  assert(resolveTheme("dark", true) === "dark", "dark + OS mörkt → dark");
  assert(resolveTheme("system", false) === "light", "system + OS ljust → light");
  assert(resolveTheme("system", true) === "dark", "system + OS mörkt → dark");

  assert(followsSystem("system"), "bara systemläget lyssnar på OS");
  assert(!followsSystem("light") && !followsSystem("dark"), "uttryckliga val lyssnar inte på OS");
}

/* ── Läsning och skrivning ────────────────────────────── */
{
  assert(readPreference(fakeStorage({ [THEME_STORAGE_KEY]: "dark" })) === "dark", "sparad preferens läses");
  assert(readPreference(fakeStorage()) === "system", "tom lagring ger standarden");
  assert(readPreference(fakeStorage({ [THEME_STORAGE_KEY]: "neon" })) === "system", "skräp i lagringen ger standarden");
  assert(readPreference(null) === "system", "ingen lagring alls ger standarden");
  assert(readPreference(undefined) === "system", "undefined lagring ger standarden");
  assert(readPreference(kastande) === "system", "lagring som kastar ger standarden i stället för att krascha");

  const s = fakeStorage();
  assert(writePreference(s, "dark") === true, "skrivning lyckas");
  assert(s.data[THEME_STORAGE_KEY] === "dark", "värdet hamnar under rätt nyckel");
  assert(readPreference(s) === "dark", "roundtrip: skrivet värde läses tillbaka");

  assert(writePreference(kastande, "light") === false, "skrivning som kastar rapporteras som misslyckad");
  assert(writePreference(null, "light") === false, "utan lagring rapporteras skrivningen som misslyckad");

  for (const p of THEME_PREFERENCES) {
    const r = fakeStorage();
    writePreference(r, p);
    assert(readPreference(r) === p, `roundtrip håller för ${p}`);
  }
}

/* ── Utloggning får INTE radera temat ─────────────────── */
{
  // clearAppStorage() raderar allt som börjar med APP_STORAGE_PREFIX.
  // Temat är en enhetspreferens och ska överleva utloggning — därför
  // ligger nyckeln utanför den namnrymden. Det här testet är beviset.
  assert(
    !THEME_STORAGE_KEY.startsWith(APP_STORAGE_PREFIX),
    `temanyckeln "${THEME_STORAGE_KEY}" ligger i appStorage-namnrymden och skulle raderas vid utloggning`,
  );

  const nycklar = [
    `${APP_STORAGE_PREFIX}plan`,
    `${APP_STORAGE_PREFIX}profile`,
    THEME_STORAGE_KEY,
    "helt-orelaterad-nyckel",
  ];
  const raderas = appStorageKeysToClear(nycklar);
  assert(!raderas.includes(THEME_STORAGE_KEY), "temanyckeln finns inte bland dem som raderas vid utloggning");
  assert(raderas.length === 2, "de två kontodatanycklarna raderas fortfarande");
  assert(raderas.every((k) => k.startsWith(APP_STORAGE_PREFIX)), "bara appens egna nycklar raderas");
}

/* ── Publika ytor är alltid ljusa ─────────────────────── */
{
  for (const p of ALWAYS_LIGHT_PATHS) assert(isAlwaysLightPath(p), `${p} är en låst ljus yta`);
  assert(isAlwaysLightPath("/"), "landningssidan är ljus");
  assert(isAlwaysLightPath("/login"), "inloggningen är ljus");
  assert(isAlwaysLightPath("/login/"), "slutslash spelar ingen roll");
  assert(isAlwaysLightPath("/login?mode=signup"), "querysträng spelar ingen roll");
  assert(isAlwaysLightPath("/login#hash"), "fragment spelar ingen roll");

  for (const p of ["/dashboard", "/innehall", "/campaigns", "/campaigns/abc", "/company", "/onboarding", "/content/facebook"]) {
    assert(!isAlwaysLightPath(p), `${p} är en appyta och följer temat`);
  }
  assert(!isAlwaysLightPath("/loginhelper"), "prefixmatchning får inte fånga andra rutter");
  assert(isAlwaysLightPath(""), "tom sökväg behandlas som roten");
}

/* ── Etiketter ────────────────────────────────────────── */
{
  assert(THEME_LABELS.light === "Ljust" && THEME_LABELS.dark === "Mörkt" && THEME_LABELS.system === "System", "svenska etiketter");
  assert(THEME_PREFERENCES.every((p) => THEME_LABELS[p]?.length > 0), "varje val har en etikett");
}

if (failures > 0) {
  console.error(`\n✗ theme-preference: ${failures} assertion(s) failed.`);
  process.exit(1);
}
console.log("\n✓ theme-preference: all assertions passed.");

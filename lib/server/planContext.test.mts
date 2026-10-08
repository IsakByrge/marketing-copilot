// Kör: npx tsx lib/server/planContext.test.mts
//      npx tsx lib/server/planContext.test.mts --print   (skriver ut företagsdelen av prompten)
//
// Kedjan företagsrad → veckoplanens prompt, utan Supabase och utan
// modellanrop. Testet säger vad modellen FÅR SE, inte vad den svarar.
//
// Varför det finns: "Vad jag vet" sparar bara till company_brain, medan
// planen läste sammanfattning, kunder, produkter, ton, styrkor och
// riktlinjer ur de platta kolumnerna från onboarding. Det användaren
// ändrade eller tog bort nådde alltså aldrig prompten.
//
// Testdatan är påhittad. Den liknar en gasolhandlare för att fallen ska
// vara igenkännliga, men ingenting här är en uppgift om ett riktigt
// företag.
import assert from "node:assert/strict";
import { buildPlanUserPrompt, planContextFromRow, type PlanCompanyRow } from "./planPrompt";

let passed = 0;
function test(name: string, fn: () => void) {
  try { fn(); passed++; }
  catch (e) { console.error(`FAIL: ${name}\n  ${e instanceof Error ? e.message : e}`); process.exitCode = 1; }
}

const NOW = new Date("2026-10-08T10:00:00Z");

/** Prompten så som routen bygger den, minus det som kommer ur andra tabeller. */
function promptFor(row: PlanCompanyRow): string {
  const { profile, brain } = planContextFromRow(row);
  return buildPlanUserPrompt({
    profile, brain, now: NOW, upcomingDates: "- (inga)",
    historyContext: "", feedbackContext: "", fileContext: "", editMemory: "",
  });
}

/** Företagsdelen: från profilen fram till faktaspärren. */
function foretagsdel(prompt: string): string {
  const a = prompt.indexOf("FÖRETAGSPROFIL");
  const b = prompt.indexOf("FAKTASPÄRR");
  return prompt.slice(a, b).replace(/\n{3,}/g, "\n\n").trim();
}

// ── Testdata ────────────────────────────────────────────────

/** Det onboarding skrev in. Ligger kvar orört i de platta kolumnerna. */
const ONBOARDING = {
  name: "Testgas Norrköping",
  industry: "Gasol",
  summary: "GAMMAL SAMMANFATTNING från onboarding.",
  customers: ["Gammal kundgrupp"],
  products: ["Gasol i lösvikt", "Gasolflaskor", "Gasolkaminer"],
  tone: ["Gammal ton"],
  strengths: ["Gammal styrka"],
  avoid: ["Gammalt förbud"],
  content_guidelines: ["Gammal riktlinje"],
} satisfies PlanCompanyRow;

const produkt = (id: string, name: string, extra: Record<string, unknown> = {}) => ({
  id, name, differentiators: [], commonObjections: [],
  profitability: "unknown", priority: "normal",
  source: "user_confirmed", confidence: "high", updatedAt: "2026-09-20T08:00:00.000Z",
  ...extra,
});

/** Det användaren sparat under Vad jag vet. Gasolkaminer är borttagen. */
const SPARAD_HJARNA = {
  companySummary: "NY SAMMANFATTNING: säljer gasol i webbshop och i egna depåer.",
  primaryCustomers: ["Husbilsägare", "Mindre restauranger"],
  strengths: ["Egna depåer"],
  uniqueSellingPoints: ["Påfyllning medan du väntar"],
  tone: ["Sakligt"],
  contentGuidelines: ["Säkerhet före sälj"],
  forbiddenClaims: ["marknadens billigaste"],
  preferredCallsToAction: ["Kom förbi depån"],
  commonCustomerObjections: [],
  proofPoints: [],
  competitors: [],
  locations: [],
  websites: [],
  products: [
    produkt("prod-intern-1", "Gasol i lösvikt", {
      priority: "high", profitability: "high", seasonality: "Hela året",
      differentiators: ["Du betalar bara för det som fylls"],
    }),
    produkt("prod-intern-2", "Gasolflaskor"),
  ],
  keySeasons: ["Husbilssäsong"],
  marketingGoals: ["Öka webbshopens försäljning", "Förbättra konverteringen"],
  lastReviewedAt: "2026-09-20T08:00:00.000Z",
};

const UPPDATERAD: PlanCompanyRow = { ...ONBOARDING, company_brain: SPARAD_HJARNA };

if (process.argv.includes("--print")) {
  console.log(foretagsdel(promptFor(UPPDATERAD)));
  console.log("\n─────────\n");
}

// ── A. Uppdaterad företagsinformation ───────────────────────

test("A1: den nya sammanfattningen når prompten", () => {
  assert.ok(promptFor(UPPDATERAD).includes("NY SAMMANFATTNING"));
});

test("A2: den gamla sammanfattningen från onboarding är borta", () => {
  assert.ok(!promptFor(UPPDATERAD).includes("GAMMAL SAMMANFATTNING"));
});

test("A3: målgrupper, styrkor, ton och riktlinjer kommer ur Company Brain", () => {
  const p = promptFor(UPPDATERAD);
  for (const ny of ["Husbilsägare", "Mindre restauranger", "Egna depåer", "Sakligt", "Säkerhet före sälj", "marknadens billigaste"]) {
    assert.ok(p.includes(ny), `saknar "${ny}"`);
  }
  for (const gammal of ["Gammal kundgrupp", "Gammal styrka", "Gammal ton", "Gammal riktlinje", "Gammalt förbud"]) {
    assert.ok(!p.includes(gammal), `"${gammal}" hänger kvar från onboarding`);
  }
});

// ── B. Borttagen produkt ────────────────────────────────────

test("B1: en produkt som tagits bort ur Company Brain står inte i prompten", () => {
  const p = promptFor(UPPDATERAD);
  assert.ok(p.includes("Gasolflaskor"), "kvarvarande produkt ska stå kvar");
  assert.ok(!p.includes("Gasolkaminer"), "borttagen produkt kom tillbaka ur onboardingprofilen");
});

test("B2: har användaren tagit bort ALLA produkter kommer ingen tillbaka", () => {
  const p = promptFor({ ...ONBOARDING, company_brain: { ...SPARAD_HJARNA, products: [] } });
  for (const namn of ONBOARDING.products) assert.ok(!p.includes(namn), `"${namn}" återinfördes genom fallback`);
  assert.ok(p.includes("nämn då ingen specifik tjänst alls"), "faktaspärren är inte i sitt strängaste läge");
});

test("B3: ett sparat men tömt fält fylls inte på ur onboarding", () => {
  const p = promptFor({ ...ONBOARDING, company_brain: { ...SPARAD_HJARNA, tone: [], strengths: [] } });
  assert.ok(!p.includes("Gammal ton"));
  assert.ok(!p.includes("Gammal styrka"));
});

// ── Äldre konton ────────────────────────────────────────────

test("äldre konto utan company_brain: onboardingprofilen bär planen som förut", () => {
  const p = promptFor(ONBOARDING);
  for (const v of ["GAMMAL SAMMANFATTNING", "Gammal kundgrupp", "Gasolkaminer", "Gammal ton", "Gammal styrka", "Gammal riktlinje", "Gammalt förbud"]) {
    assert.ok(p.includes(v), `saknar "${v}"`);
  }
});

test("hjärna som aldrig sparats via Vad jag vet (saknar lastReviewedAt): tomma fält fylls ur onboarding", () => {
  const p = promptFor({ ...ONBOARDING, company_brain: { marketingGoals: ["Fler besökare till depåerna"] } });
  assert.ok(p.includes("Fler besökare till depåerna"));
  assert.ok(p.includes("GAMMAL SAMMANFATTNING"));
  assert.ok(p.includes("Gasolkaminer"));
});

test("trasig company_brain kraschar inte och faller tillbaka på onboarding", () => {
  const p = promptFor({ ...ONBOARDING, company_brain: "inte ett objekt" });
  assert.ok(p.includes("GAMMAL SAMMANFATTNING"));
});

// ── C. Prioriterad produkt ──────────────────────────────────

test("C: prioritet, lönsamhet, säsong och differentiering når prompten", () => {
  const p = promptFor(UPPDATERAD);
  assert.match(p, /Gasol i lösvikt \(prioritet: high · lönsamhet: high · säsong: Hela året\)/);
  assert.ok(p.includes("Skiljer sig genom: Du betalar bara för det som fylls"));
});

// ── D. Marknadsföringsmål ───────────────────────────────────

test("D1: målen står i prompten", () => {
  const p = promptFor(UPPDATERAD);
  assert.ok(p.includes("Öka webbshopens försäljning"));
  assert.ok(p.includes("Förbättra konverteringen"));
});

test("D2: målen presenteras som affärsmål som styr veckans fokus och kampanjförslagen", () => {
  const p = promptFor(UPPDATERAD);
  assert.ok(p.includes("AFFÄRSMÅL"), "målen kallas inte affärsmål");
  assert.match(p, /"focus"[^\n]*\n?[^\n]*kampanjförslag/i);
  assert.ok(!p.includes("varje inlägg ska tjäna minst ett av dessa"), "målen beskrivs fortfarande bara som etiketter på inlägg");
});

// ── E. Saknad information ───────────────────────────────────

test("E1: tomma fält sägs vara okända i stället för att lämnas blanka", () => {
  const d = foretagsdel(promptFor({ name: "Nystartat AB" }));
  for (const rad of ["Sammanfattning", "Kunder", "Produkter och tjänster", "Tonalitet", "Styrkor"]) {
    assert.match(d, new RegExp(`${rad}: \\(inte angivet\\)`), `${rad} lämnas blank`);
  }
  assert.match(d, /gissning/i, "prompten säger inte vad en lucka betyder");
});

test("E2: utan underlag blir faktaspärren strängast och inga mål hittas på", () => {
  const p = promptFor({ name: "Nystartat AB" });
  assert.ok(p.includes("nämn då ingen specifik tjänst alls"), "faktaspärren är inte i sitt strängaste läge");
  assert.match(p, /\(inga mål angivna\)/);
  assert.ok(!/undefined|null/.test(foretagsdel(p)));
});

// ── Kontrollerad kontext ────────────────────────────────────

test("interna id:n och källmetadata skickas aldrig till modellen", () => {
  const p = promptFor(UPPDATERAD);
  for (const internt of ["prod-intern-1", "user_confirmed", "lastReviewedAt", "updatedAt"]) {
    assert.ok(!p.includes(internt), `"${internt}" läckte in i prompten`);
  }
});

console.log(`${passed} test ok`);

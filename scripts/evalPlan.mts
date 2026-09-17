// ─────────────────────────────────────────────────────────────
// npm run eval:plan
//
// Genererar en veckoplan mot en FAST testprofil och kontrollerar den
// mekaniskt. Kör INTE i CI: varje körning är ett riktigt OpenAI-anrop
// och kostar pengar. Kör den för hand när prompten ändrats.
//
// Testprofilen liknar Gasolfyllarna men är påhittad, så resultatet går
// att jämföra över tid utan att bero på vad som råkar stå i databasen
// just nu. En högprioriterad produkt i säsong och ett depåmål, eftersom
// det var precis de två sakerna planen missade.
//
// Skriptet använder SAMMA promptmodul som /api/generate-plan. Kopierar
// man prompten hit glider den isär, och då mäter evalen fel sak.
//
// Flaggor:
//   --runs=3      antal körningar (standard 1)
//   --print       skriv ut hela den sista planen som JSON
// ─────────────────────────────────────────────────────────────
import { readFileSync } from "node:fs";
import OpenAI from "openai";
import {
  PLAN_SYSTEM_PROMPT, buildPlanUserPrompt, POST_ROLES, LENGTH_LIMITS,
} from "@/lib/server/planPrompt";
import { RISKY_CTA_WORDS } from "@/lib/server/factGuard";
import { hittaForKorta, buildRepairPrompt, applyRepair, type PlanShape } from "@/lib/server/planRepair";
import { INTERNAL_TERMS } from "@/lib/server/factGuard";
import { hittaPlatshallare, antalStycken, normaliseraDag, valideraPlan } from "@/lib/server/planValidate";
import { lankarIText, vardnamn } from "@/app/_shared/websites";
import type { CompanyBrainContext } from "@/app/_shared/companyBrain";

// ── Miljö ───────────────────────────────────────────────────
// .env.local läses för hand: skriptet körs utanför Next-runtime.
for (const rad of readFileSync(".env.local", "utf8").split(/\r?\n/)) {
  const m = rad.match(/^([A-Z_]+)=(.*)$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim().replace(/^["']|["']$/g, "");
}
if (!process.env.OPENAI_API_KEY) {
  console.error("OPENAI_API_KEY saknas i .env.local.");
  process.exit(1);
}

// ── Testprofilen ────────────────────────────────────────────
const PRIORITERAD_PRODUKT = "Gasol i lösvikt";
const DEPAMAL = "Fler besökare till våra depåer";

const profile = {
  companyName: "Testgas Norrköping",
  industry: "Försäljning och påfyllning av gasol",
  summary: "Säljer gasol och tillbehör till privatpersoner och mindre företag, med egna depåer där kunder fyller på flaskor.",
  customers: ["Husbilsägare", "Villaägare med gasolgrill", "Mindre restauranger"],
  products: [PRIORITERAD_PRODUKT, "Gasolflaskor", "Slangar och regulatorer", "Gasolgrillar"],
  tone: ["Sakligt", "Vänligt", "Utan överdrifter"],
  strengths: ["Egna depåer", "Betalar bara för det som fylls"],
  avoid: ["Skrämselpropaganda"],
  contentGuidelines: ["Säkerhet före sälj"],
};

const brain: CompanyBrainContext = {
  summary: profile.summary,
  audiences: profile.customers,
  priorityProducts: [
    {
      name: PRIORITERAD_PRODUKT,
      description: "Kunden fyller sin egen flaska och betalar per kilo.",
      profitability: "high",
      priority: "high",
      objections: ["Tar det lång tid?", "Passar min flaska?"],
      differentiators: ["Betalar bara för det som faktiskt fylls"],
      seasonality: "Hela året",
    },
    {
      name: "Gasolgrillar",
      description: "Grillar för utomhusbruk.",
      profitability: "normal",
      priority: "low",
      objections: [],
      differentiators: [],
      seasonality: "April–augusti",
    },
  ],
  strengths: profile.strengths,
  usps: ["Egna depåer på tre orter"],
  tone: profile.tone,
  contentGuidelines: profile.contentGuidelines,
  forbiddenClaims: ["marknadens billigaste"],
  seasons: ["Grillsäsong", "Husbilssäsong"],
  marketingGoals: [DEPAMAL, "Fler återkommande påfyllningskunder"],
  preferredCallsToAction: ["Kom förbi depån", "Läs mer på webbplatsen"],
  proofPoints: [],
  locations: ["Norrköping", "Linköping", "Nyköping"],
  websites: [
    { url: "https://shop.testgas.se", purpose: "Webbshop – köp av produkter" },
    { url: "https://testgas.se", purpose: "Hemsida – information och depåer" },
  ],
};

// ── Kontroller ──────────────────────────────────────────────
const ord = (s: string) => (s ?? "").trim().split(/\s+/).filter(Boolean).length;

interface Post { roll?: string; dag?: string; produkt?: string; mal?: string; title?: string; text?: string; cta?: string }
interface Plan { intro?: string; posts?: Post[]; newsletter?: { body?: string; subject?: string; cta?: string }; campaigns?: unknown[] }

type Kontroll = { namn: string; ok: boolean; detalj: string };

/** Lovar rubriken en lista ska texten innehålla en. */
const LOVAR_LISTA = /\b(\d+|två|tre|fyra|fem|sex|sju)\s+(steg|saker|tips|sätt|misstag|punkter|råd|frågor)|checklista/i;
const HAR_LISTA = /(\n\s*[-•*\d]|^\s*\d[.)]\s)/m;

function kontrollera(plan: Plan): Kontroll[] {
  const k: Kontroll[] = [];
  const posts = plan.posts ?? [];

  k.push({
    namn: "fem inlägg",
    ok: posts.length === 5,
    detalj: `${posts.length} st`,
  });

  const roller = posts.map((p) => p.roll ?? "(saknas)");
  const unika = new Set(roller);
  k.push({
    namn: "fem olika roller",
    ok: unika.size === 5 && POST_ROLES.every((r) => unika.has(r)),
    detalj: roller.join(", "),
  });

  const allText = JSON.stringify(plan).toLowerCase();
  k.push({
    namn: "prioriterad produkt förekommer",
    ok: allText.includes(PRIORITERAD_PRODUKT.toLowerCase()),
    detalj: PRIORITERAD_PRODUKT,
  });

  // Ett inlagg FAR sakna mal. Det som inte far hanta ar ett mal som
  // inte finns i foretagsdatan.
  const angivnaMal = posts.map((p) => p.mal?.trim()).filter(Boolean) as string[];
  const kandaMal = brain.marketingGoals.map((g) => g.toLowerCase());
  const okanda = angivnaMal.filter((m) => !kandaMal.some((g) => m.toLowerCase().includes(g) || g.includes(m.toLowerCase())));
  k.push({
    namn: "mål finns i företagsdatan",
    ok: angivnaMal.length > 0 && okanda.length === 0,
    detalj: okanda.length ? `okänt: ${okanda.join(" | ")}` : `${angivnaMal.length}/${posts.length} har mål, alla kända`,
  });

  const langder = posts.map((p) => ord(p.text ?? ""));
  const utanfor = langder.filter((n) => n < LENGTH_LIMITS.POST_MIN_WORDS || n > LENGTH_LIMITS.POST_MAX_WORDS);
  k.push({
    namn: `inlägg ${LENGTH_LIMITS.POST_MIN_WORDS}-${LENGTH_LIMITS.POST_MAX_WORDS} ord`,
    ok: utanfor.length === 0,
    detalj: langder.join(", "),
  });

  const nlOrd = ord(plan.newsletter?.body ?? "");
  k.push({
    namn: `nyhetsbrev ${LENGTH_LIMITS.NEWSLETTER_MIN_WORDS}-${LENGTH_LIMITS.NEWSLETTER_MAX_WORDS} ord`,
    ok: nlOrd >= LENGTH_LIMITS.NEWSLETTER_MIN_WORDS && nlOrd <= LENGTH_LIMITS.NEWSLETTER_MAX_WORDS,
    detalj: `${nlOrd} ord`,
  });

  // CTA-ord som antyder en tjänst profilen inte har. "service" osv.
  const ctas = [...posts.map((p) => p.cta ?? ""), plan.newsletter?.cta ?? ""];
  const tillatet = profile.products.map((p) => p.toLowerCase());
  const misstankta = ctas.filter((c) => {
    const l = c.toLowerCase();
    const riskord = RISKY_CTA_WORDS.filter((w) => l.includes(w));
    if (riskord.length === 0) return false;
    // Ordet är ok om det faktiskt står i en produkt vi säljer.
    return !riskord.every((w) => tillatet.some((prod) => prod.includes(w)));
  });
  k.push({
    namn: "inga CTA utan täckning",
    ok: misstankta.length === 0,
    detalj: misstankta.length ? misstankta.join(" | ") : "alla rena",
  });

  const brutnaLoften = posts.filter(
    (p) => LOVAR_LISTA.test(p.title ?? "") && !HAR_LISTA.test(p.text ?? ""),
  );
  k.push({
    namn: "lista finns när rubriken lovar",
    ok: brutnaLoften.length === 0,
    detalj: brutnaLoften.length ? brutnaLoften.map((p) => p.title).join(" | ") : "inga löften brutna",
  });

  const dagar = posts.map((p) => p.dag ?? "");
  k.push({
    namn: "inläggen spridda över veckan",
    ok: new Set(dagar.filter(Boolean)).size >= 3,
    detalj: dagar.join(", "),
  });

  k.push({
    namn: "ingress skriven av modellen",
    ok: Boolean(plan.intro?.trim()),
    detalj: plan.intro?.slice(0, 60) ?? "(saknas)",
  });

  // ── Nya kontroller efter preview-granskningen ─────────────

  // 1. Platshallare i kundtext.
  const medPlatshallare = posts.flatMap((p) => [
    ...hittaPlatshallare(p.title), ...hittaPlatshallare(p.text), ...hittaPlatshallare(p.cta),
  ]).concat(hittaPlatshallare(plan.newsletter?.body), hittaPlatshallare(plan.newsletter?.cta));
  k.push({
    namn: "inga platshållare",
    ok: medPlatshallare.length === 0,
    detalj: medPlatshallare.length ? medPlatshallare.join(" ") : "inga",
  });

  // 2. Intern styrdata i kundtext.
  const kundtext = [
    ...posts.flatMap((p) => [p.title, p.text, p.cta]),
    plan.newsletter?.subject, plan.newsletter?.body, plan.newsletter?.cta,
  ].filter(Boolean).join(" ").toLowerCase();
  const internaTraffar = INTERNAL_TERMS.filter((t) => kundtext.includes(t));
  k.push({
    namn: "ingen intern styrdata i texten",
    ok: internaTraffar.length === 0,
    detalj: internaTraffar.length ? internaTraffar.join(", ") : "ren",
  });

  // 5. Konkurrerande losningar. Konservativ: flaggar varje omnamnande.
  const KONKURRENTER = ["vedkamin", "vedeldning", "elvärme", "elelement", "värmefläkt", "pelletsbrännare", "fjärrvärme"];
  const konkurrentTraffar = KONKURRENTER.filter((w) => kundtext.includes(w));
  k.push({
    namn: "inga konkurrerande lösningar",
    ok: konkurrentTraffar.length === 0,
    detalj: konkurrentTraffar.length ? konkurrentTraffar.join(", ") : "inga",
  });

  // Lankar som inte finns i foretagsdatan.
  const kandaVardnamn = new Set(
    brain.websites.map((w) => vardnamn(w.url)).filter(Boolean) as string[],
  );
  const alla = [
    ...posts.flatMap((p) => [p.title, p.text, p.cta]),
    plan.newsletter?.body, plan.newsletter?.cta,
  ].filter(Boolean) as string[];
  const okandaLankar = alla.flatMap(lankarIText).filter((l) => {
    const v = vardnamn(l);
    // Utan igenkannbart vardnamn ar det ingen lank, bara en mening med punkt.
    if (!v) return false;
    return ![...kandaVardnamn].some((k) => v === k || v.endsWith(`.${k}`));
  });
  k.push({
    namn: "inga påhittade länkar",
    ok: okandaLankar.length === 0,
    detalj: okandaLankar.length ? okandaLankar.join(" ") : "inga",
  });

  // 6. Nyhetsbrevets styckeindelning.
  const stycken = antalStycken(plan.newsletter?.body);
  k.push({
    namn: "nyhetsbrev 2-4 stycken",
    ok: stycken >= 2 && stycken <= 4,
    detalj: `${stycken} stycken`,
  });

  // 7. Veckodag med liten bokstav och svensk stavning.
  const dagFel = posts.map((p) => p.dag ?? "").filter((d) => d && (d !== d.toLowerCase() || normaliseraDag(d) === null));
  k.push({
    namn: "veckodagar med liten bokstav",
    ok: dagFel.length === 0,
    detalj: dagFel.length ? dagFel.join(", ") : "alla rätt",
  });

  return k;
}

// ── Körning ─────────────────────────────────────────────────
const runs = Number(process.argv.find((a) => a.startsWith("--runs="))?.split("=")[1] ?? 1);
const print = process.argv.includes("--print");

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const model = process.env.AI_CHAT_MODEL || "gpt-4o";

const userPrompt = buildPlanUserPrompt({
  profile, brain, now: new Date(),
  upcomingDates: "(inga särskilda datum i testprofilen)",
  historyContext: "", feedbackContext: "", fileContext: "", editMemory: "",
});

let sistaPlan: Plan | null = null;
const alla: Kontroll[][] = [];

for (let i = 1; i <= runs; i++) {
  process.stdout.write(`\nKörning ${i}/${runs} … `);
  const svar = await openai.chat.completions.create({
    model,
    messages: [
      { role: "system", content: PLAN_SYSTEM_PROMPT },
      { role: "user", content: userPrompt },
    ],
    response_format: { type: "json_object" },
    max_completion_tokens: 4000,
  });
  const raw = svar.choices[0]?.message?.content ?? "{}";
  let plan: Plan;
  try {
    plan = JSON.parse(raw);
  } catch {
    console.log("SVARET VAR INTE GILTIG JSON");
    continue;
  }
  // Samma reparationsrunda som routen kor, sa evalen mater hela kedjan
  // och inte bara forsta svaret.
  const forKorta = hittaForKorta(plan as PlanShape);
  if (forKorta.length > 0) {
    process.stdout.write(`(utokar ${forKorta.length}) `);
    const fix = await openai.chat.completions.create({
      model,
      messages: [
        { role: "system", content: PLAN_SYSTEM_PROMPT },
        { role: "user", content: buildRepairPrompt(plan as PlanShape, forKorta) },
      ],
      response_format: { type: "json_object" },
      max_completion_tokens: 4000,
    });
    try {
      const texts = JSON.parse(fix.choices[0]?.message?.content ?? "{}")?.texts;
      if (texts) plan = applyRepair(plan as PlanShape, texts) as Plan;
    } catch { /* behall originalet */ }
  }

  plan = valideraPlan(plan as PlanShape) as Plan;

  sistaPlan = plan;
  const k = kontrollera(plan);
  alla.push(k);
  const godkanda = k.filter((x) => x.ok).length;
  console.log(`${godkanda}/${k.length} godkända`);
  for (const x of k) {
    console.log(`  ${x.ok ? "✓" : "✗"} ${x.namn.padEnd(34)} ${x.detalj}`);
  }
}

// ── Sammanfattning ──────────────────────────────────────────
if (alla.length > 0) {
  console.log(`\n${"─".repeat(60)}\nSAMMANFATTNING över ${alla.length} körningar\n`);
  for (let i = 0; i < alla[0].length; i++) {
    const namn = alla[0][i].namn;
    const godkanda = alla.filter((k) => k[i]?.ok).length;
    console.log(`  ${godkanda === alla.length ? "✓" : "✗"} ${namn.padEnd(34)} ${godkanda}/${alla.length}`);
  }
}

if (print && sistaPlan) {
  console.log(`\n${"─".repeat(60)}\nSISTA PLANEN\n`);
  console.log(JSON.stringify(sistaPlan, null, 2));
}

const allaGodkanda = alla.every((k) => k.every((x) => x.ok));
process.exitCode = allaGodkanda ? 0 : 1;

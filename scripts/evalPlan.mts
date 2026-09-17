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
import {
  hittaPlatshallare, antalStycken, normaliseraDag, valideraPlan,
  sakerhetsordIText, arSakerhetsrad,
} from "@/lib/server/planValidate";
import { lankarIText, vardnamn } from "@/app/_shared/websites";
import { sasongsfelIText, forbjudnaSasongsord } from "@/lib/server/season";
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
interface Campaign { title?: string; produkt?: string }
interface Plan { intro?: string; posts?: Post[]; newsletter?: { body?: string; subject?: string; cta?: string }; campaigns?: Campaign[] }

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

  // 1. Sakerhetsrad. Kontrollen faller pa RAD - utrustning plus en
  // uppmaning att gora nagot med den. Att bara NAMNA en slang som
  // produkt ar ingen bugg; det blir en granskningsflagga i
  // granssnittet, och det ska det forbli.
  const texter = [
    ...posts.flatMap((p) => [p.title, p.text, p.cta]),
    plan.newsletter?.body, plan.newsletter?.cta,
  ].filter(Boolean) as string[];
  const rad = texter.filter(arSakerhetsrad);
  k.push({
    namn: "inga säkerhetsråd i texten",
    ok: rad.length === 0,
    detalj: rad.length ? rad.map((t) => t.slice(0, 50)).join(" | ") : "inga",
  });

  const namnd = [...new Set(texter.flatMap(sakerhetsordIText))];
  k.push({
    namn: "utrustning nämnd (flaggas för granskning)",
    ok: true,
    detalj: namnd.length ? namnd.join(", ") : "ingen",
  });

  // 2. Differentiator i det prioriterade inlägget.
  //
  // Kontrollen är SEMANTISK, inte ordagrann. Modellen skriver om USP:n
  // med egna ord — "betalar du bara för den gasol du faktiskt fyller"
  // i stället för "Betalar bara för det som faktiskt fylls" — och det
  // är precis vad den ska göra. Att kräva exakt formulering vore att
  // mäta papegojkonst, inte innehåll.
  //
  // Två vägar godkänns: tillräckligt många bärande ord ur en
  // differentiator, eller någon av de nyckelfraser som bär samma
  // innebörd. Fraserna hör till testprofilen och står därför här.
  const USP_NYCKELFRASER = [
    "betalar bara", "betala bara", "betalar du bara",
    "det som går i", "det som faktiskt", "den mängd du",
    "egen flaska", "din egen flaska", "per kilo",
  ];

  const prio = posts.find((p) => p.roll === "prioriterad_produkt");
  const diffar = brain.priorityProducts[0]?.differentiators ?? [];
  const prioText = `${prio?.title ?? ""} ${prio?.text ?? ""}`.toLowerCase();

  const barandeOrd = diffar.some((d) => {
    const ord = d.toLowerCase().split(/\s+/).filter((w) => w.length > 3);
    const funna = ord.filter((w) => prioText.includes(w));
    return ord.length > 0 && funna.length >= Math.min(3, ord.length);
  });
  const nyckelfras = USP_NYCKELFRASER.find((f) => prioText.includes(f));

  k.push({
    namn: "prioriterat inlägg bär produktens USP",
    ok: Boolean(prio) && (barandeOrd || Boolean(nyckelfras)),
    detalj: barandeOrd
      ? `bärande ord ur "${diffar[0] ?? ""}"`
      : nyckelfras
        ? `nyckelfras: "${nyckelfras}"`
        : `saknas: ${diffar[0] ?? "(ingen differentiator)"}`,
  });

  // 3. Depamalet pa det lokala inlagget, och minst tva mal totalt.
  const lokalt = posts.find((p) => p.roll === "lokalt");
  const depaMal = brain.marketingGoals.filter((g) => /dep[åa]|bes[öo]k|butik/i.test(g));
  const lokaltHarDepaMal = depaMal.length === 0
    || Boolean(lokalt?.mal && depaMal.some((g) => lokalt.mal!.toLowerCase().includes(g.toLowerCase().slice(0, 12))));
  k.push({
    namn: "lokalt inlägg har depåmålet",
    ok: lokaltHarDepaMal,
    detalj: lokalt?.mal || "(inget mål)",
  });

  const medMal = posts.filter((p) => p.mal?.trim()).length;
  k.push({
    namn: "minst två inlägg har mål",
    ok: brain.marketingGoals.length === 0 || medMal >= 2,
    detalj: `${medMal}/${posts.length}`,
  });

  // 4. Lank pa saljande och prioriterat inlagg.
  const medLank = posts.filter((p) => lankarIText(p.text).some((l) => vardnamn(l) !== null)).length;
  k.push({
    namn: "minst två inlägg har länk",
    ok: brain.websites.length === 0 || medLank >= 2,
    detalj: `${medLank}/${posts.length}`,
  });

  // 5. Kampanjtitlar och produktkoppling.
  const kampanjer = plan.campaigns ?? [];
  const slappaTitlar = kampanjer.filter((c) => /^kampanj f[öo]rs|^h[öo]stkampanj$|^v[åa]rkampanj$/i.test((c.title ?? "").trim()));
  k.push({
    namn: "kampanjer har konkreta titlar",
    ok: kampanjer.length > 0 && slappaTitlar.length === 0,
    detalj: slappaTitlar.length ? slappaTitlar.map((c) => c.title).join(" | ") : (kampanjer.map((c) => c.title).join(" | ") || "(inga)"),
  });

  const produktnamn = profile.products.map((p) => p.toLowerCase());
  const utanProdukt = kampanjer.filter((c) => {
    const p = (c.produkt ?? "").trim().toLowerCase();
    return !p || !produktnamn.some((n) => n.includes(p) || p.includes(n));
  });
  k.push({
    namn: "kampanjer kopplade till produkt",
    ok: kampanjer.length > 0 && utanProdukt.length === 0,
    detalj: utanProdukt.length ? `utan: ${utanProdukt.map((c) => c.title).join(" | ")}` : kampanjer.map((c) => c.produkt).join(" | "),
  });

  // 3. Sasongsord som hor till fel arstid, aven i kampanjtitlar.
  const sasongstexter = [
    ...texter,
    ...kampanjer.map((c) => c.title ?? ""),
  ];
  const sasongsfel = [...new Set(sasongstexter.flatMap((t) => sasongsfelIText(t)))];
  k.push({
    namn: "inga ord från fel årstid",
    ok: sasongsfel.length === 0,
    detalj: sasongsfel.length ? sasongsfel.join(", ") : `rent (förbjudet nu: ${forbjudnaSasongsord().slice(0, 3).join(", ")}…)`,
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

// ── Sjalvtest innan vi betalar for nagot ────────────────────
// De tre meningarna nedan publicerades i en riktig plan och skulle
// aldrig ha skrivits. De ligger har for att detektorn ska bevisa att
// den fangar dem INNAN evalen gor ett enda API-anrop. Slutar den
// fanga dem ar det inget att mata vidare.
const LACKTA_SAKERHETSRAD = [
  "Kontrollera gasolslangar för sprickor",
  "Se över regulatorn",
  "Rengör gasolkaminen",
];

const missade = LACKTA_SAKERHETSRAD.filter((m) => sakerhetsordIText(m).length === 0 || !arSakerhetsrad(m));
if (missade.length > 0) {
  console.error("SJÄLVTEST FALLERAR — detektorn missar meningar som redan publicerats:");
  for (const m of missade) console.error(`  ✗ ${m}`);
  process.exit(1);
}
console.log(`Självtest: ${LACKTA_SAKERHETSRAD.length}/${LACKTA_SAKERHETSRAD.length} kända säkerhetsråd fångas.`);

// ── Körning ─────────────────────────────────────────────────
const runs = Number(process.argv.find((a) => a.startsWith("--runs="))?.split("=")[1] ?? 1);
const print = process.argv.includes("--print");

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
// Samma upplösning som routen, så evalen mäter det prod faktiskt kör.
// --model=... överstyr för en jämförelse.
const modellFlagga = process.argv.find((a) => a.startsWith("--model="))?.split("=")[1];
const model = modellFlagga || process.env.PLAN_MODEL || process.env.AI_CHAT_MODEL || "gpt-4o-mini";
console.log(`Modell: ${model}`);

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

  plan = valideraPlan(plan as PlanShape, brain.websites) as Plan;

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

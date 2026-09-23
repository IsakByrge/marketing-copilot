// Deterministiskt test för Idag-rekommendationen. Ingen databas, inget nät.
// Kör: tsx lib/today/nextStep.test.mts
import { nextStep, RESULTS_DUE_DAYS, type NextStep, type NextStepInput } from "./nextStep";
import type { Campaign, CampaignStatus } from "../campaigns/logic";

let failures = 0;
function assert(cond: boolean, msg: string) {
  if (!cond) { failures++; console.error(`  ✗ ${msg}`); }
}

const TODAY = "2026-09-23";

/** En kampanj med allt tomt. Testen sätter bara det de bryr sig om. */
function campaign(over: Partial<Campaign> & { id: string; status: CampaignStatus }): Campaign {
  return {
    user_id: "u1",
    company_id: "c1",
    strategy_id: `s-${over.id}`,
    title: `Kampanj ${over.id}`,
    starts_on: "2026-09-01",
    ends_on: "2026-10-31",
    spend_amount: null,
    revenue_amount: null,
    result_type: null,
    result_count: null,
    result_note: null,
    learning: null,
    created_at: "2026-09-01T10:00:00Z",
    updated_at: "2026-09-01T10:00:00Z",
    strategy: null,
    ...over,
  };
}

function run(over: Partial<NextStepInput> = {}): NextStep | null {
  return nextStep({ campaigns: [], plan: { postCount: 5, createdAt: `${TODAY}T08:00:00Z` }, today: TODAY, ...over });
}

/* ── 1. Aktiv kampanj nära slut utan resultat ─────────── */
{
  const c = campaign({ id: "a", status: "active", ends_on: "2026-09-26" });
  const step = run({ campaigns: [c] });
  assert(step?.id === "campaign-results", "aktiv kampanj som slutar om 3 dagar utan resultat vinner");
  assert(step?.href === "/campaigns/a", "steget länkar till kampanjen");
  assert(step?.why === "Kampanjen slutar om 3 dagar och du har inte lagt in några resultat.", "varför-texten räknar dagarna ur slutdatumet");

  assert(run({ campaigns: [campaign({ id: "b", status: "active", ends_on: "2026-09-24" })] })?.why.includes("slutar i morgon") === true, "en dag kvar sägs som i morgon, aldrig 1 dagar");
  assert(run({ campaigns: [campaign({ id: "c", status: "active", ends_on: TODAY })] })?.why.includes("slutar i dag") === true, "sista dagen sägs som i dag");
  assert(run({ campaigns: [campaign({ id: "d", status: "active", ends_on: "2026-09-21" })] })?.why.includes("passerade sitt slutdatum för 2 dagar sedan") === true, "passerat slutdatum sägs rakt ut");
  assert(run({ campaigns: [campaign({ id: "e", status: "active", ends_on: "2026-09-22" })] })?.why.includes("för 1 dag sedan") === true, "en dag i dåtid böjs i singular");
}

/* ── Resultat inlagda tar bort regeln ─────────────────── */
{
  const c = campaign({ id: "a", status: "active", ends_on: "2026-09-26", spend_amount: 1200 });
  const step = run({ campaigns: [c] });
  assert(step?.id === "campaign-content", "med resultat inlagda faller regeln till nästa kampanjsteg");

  const nollad = campaign({ id: "a", status: "active", ends_on: "2026-09-26", spend_amount: 0 });
  assert(run({ campaigns: [nollad] })?.id === "campaign-content", "spenderat 0 räknas som inlagt, samma regel som på kampanjsidan");
}

/* ── Tröskeln ─────────────────────────────────────────── */
{
  const precis = campaign({ id: "a", status: "active", ends_on: "2026-09-26" });
  const strax = campaign({ id: "b", status: "active", ends_on: "2026-09-27" });
  assert(run({ campaigns: [precis] })?.id === "campaign-results", `exakt ${RESULTS_DUE_DAYS} dagar kvar träffar regeln`);
  assert(run({ campaigns: [strax] })?.id === "campaign-content", `${RESULTS_DUE_DAYS + 1} dagar kvar gör det inte`);
}

/* ── 2. Vanlig aktiv kampanj ──────────────────────────── */
{
  const c = campaign({ id: "a", status: "active", starts_on: "2026-09-16", ends_on: "2026-10-13" });
  const step = run({ campaigns: [c] });
  assert(step?.id === "campaign-content", "en pågående kampanj ger innehållssteget");
  assert(step?.href === "/content/facebook?strategy=s-a", "innehållssteget går till Facebook-flödet med strategins id");
  assert(step?.why === "Kampanjen pågår — dag 8 av 28.", "varför-texten använder kampanjsidans egen tidsrad");

  // Utanför perioden ger timingNote null — då faller texten tillbaka på perioden.
  const utanfor = campaign({ id: "b", status: "active", starts_on: "2026-10-01", ends_on: "2026-10-20" });
  assert(run({ campaigns: [utanfor] })?.why === "Kampanjen pågår 1 okt – 20 okt.", "utan tidsrad anges perioden i stället");
}

/* ── 3. Avslutad kampanj utan lärdom ──────────────────── */
{
  const c = campaign({ id: "a", status: "ended", ends_on: "2026-09-10" });
  const step = run({ campaigns: [c] });
  assert(step?.id === "campaign-learning", "avslutad kampanj utan lärdom ger lärdomssteget");
  assert(step?.href === "/campaigns/a", "lärdomssteget länkar till kampanjen");
  assert(step?.why === "Kampanjen är avslutad och har ingen lärdom sparad.", "varför-texten påstår inget datum för avslutet");

  const medLardom = campaign({ id: "b", status: "ended", ends_on: "2026-09-10", learning: "Fungerade bäst i Växjö." });
  assert(run({ campaigns: [medLardom] })?.id !== "campaign-learning", "med lärdom sparad är regeln nöjd");
  assert(run({ campaigns: [campaign({ id: "c", status: "ended", learning: "   " })] })?.id === "campaign-learning", "blanksteg räknas inte som en lärdom");
}

/* ── 4. Planerad kampanj vars startdatum passerat ─────── */
{
  const c = campaign({ id: "a", status: "planned", starts_on: "2026-09-20" });
  const step = run({ campaigns: [c] });
  assert(step?.id === "campaign-start", "planerad kampanj med passerat startdatum ger startsteget");
  assert(step?.why === "Startdatumet passerade för 3 dagar sedan och kampanjen står fortfarande som planerad.", "varför-texten räknar dagarna ur startdatumet");
  assert(run({ campaigns: [campaign({ id: "b", status: "planned", starts_on: TODAY })] })?.why.includes("skulle starta i dag") === true, "startdatum i dag får sin egen formulering");

  const framtida = campaign({ id: "c", status: "planned", starts_on: "2026-10-05" });
  assert(run({ campaigns: [framtida] })?.id === "content", "en planerad kampanj i framtiden är inget att göra i dag");
}

/* ── 5. Plan saknas eller är stale ────────────────────── */
{
  const utanPlan = run({ campaigns: [], plan: null });
  assert(utanPlan?.id === "plan-missing", "utan plan rekommenderas veckans förslag");
  assert(utanPlan?.action === "generate-plan" && !utanPlan?.href, "plansteget är en handling på sidan, inte en länk");
  assert(utanPlan?.why === "Du har inget veckoförslag än.", "varför-texten påstår inget mer än att planen saknas");

  const gammal = run({ plan: { postCount: 5, createdAt: "2026-09-09T08:00:00Z" } });
  assert(gammal?.id === "plan-stale", "en plan från en annan vecka räknas som inaktuell");
  assert(gammal?.why === "Ditt senaste förslag är från vecka 37.", "varför-texten anger veckan planen skrevs");

  // Samma vecka som TODAY (v39) — inte stale.
  assert(run({ plan: { postCount: 5, createdAt: "2026-09-21T08:00:00Z" } })?.id === "content", "en plan från samma vecka är färsk");
  // Saknat datum räknas som färskt, samma regel som isPlanStale.
  assert(run({ plan: { postCount: 5 } })?.id === "content", "plan utan datum behandlas som färsk");
}

/* ── 6. Fallback ──────────────────────────────────────── */
{
  const step = run();
  assert(step?.id === "content", "utan kampanjer och med färsk plan föreslås veckans innehåll");
  assert(step?.href === "/innehall", "innehållssteget går till Innehåll");
  assert(step?.why === "Veckans förslag innehåller 5 inlägg.", "varför-texten räknar inläggen i planen");

  assert(run({ plan: { postCount: 0, createdAt: `${TODAY}T08:00:00Z` } }) === null, "en färsk plan utan inlägg ger inget steg alls — hellre tyst än påhittat");
}

/* ── Prioritetsordningen ──────────────────────────────── */
{
  const resultat = campaign({ id: "r", status: "active", ends_on: "2026-09-25" });
  const aktiv = campaign({ id: "a", status: "active", ends_on: "2026-10-20", spend_amount: 500 });
  const avslutad = campaign({ id: "e", status: "ended", ends_on: "2026-09-10" });
  const planerad = campaign({ id: "p", status: "planned", starts_on: "2026-09-18" });
  const utanPlan = { plan: null };

  assert(run({ campaigns: [planerad, avslutad, aktiv, resultat], ...utanPlan })?.id === "campaign-results", "resultat slår aktiv, avslutad, planerad och plan");
  assert(run({ campaigns: [planerad, avslutad, aktiv], ...utanPlan })?.id === "campaign-content", "aktiv slår avslutad, planerad och plan");
  assert(run({ campaigns: [planerad, avslutad], ...utanPlan })?.id === "campaign-learning", "avslutad slår planerad och plan");
  assert(run({ campaigns: [planerad], ...utanPlan })?.id === "campaign-start", "planerad slår plan");
  assert(run({ campaigns: [], ...utanPlan })?.id === "plan-missing", "utan kampanjer bestämmer planen");

  // Flera kandidater i samma regel: den som slutar först brådskar mest.
  const sent = campaign({ id: "sent", status: "active", ends_on: "2026-09-26" });
  const tidigt = campaign({ id: "tidigt", status: "active", ends_on: "2026-09-24" });
  assert(run({ campaigns: [sent, tidigt] })?.href === "/campaigns/tidigt", "av två kampanjer utan resultat väljs den som slutar först");
}

/* ── Kampanjer som fortfarande laddas ─────────────────── */
{
  const step = run({ campaigns: null, plan: null });
  assert(step?.id === "plan-missing", "medan kampanjerna hämtas visas ett planbaserat steg — sidan väntar aldrig");
  assert(run({ campaigns: null })?.id === "content", "null är inte samma sak som tom lista");
}

/* ── En rekommendation, aldrig flera ──────────────────── */
{
  const alla = [
    campaign({ id: "r", status: "active", ends_on: "2026-09-25" }),
    campaign({ id: "e", status: "ended", ends_on: "2026-09-10" }),
    campaign({ id: "p", status: "planned", starts_on: "2026-09-18" }),
  ];
  const step = nextStep({ campaigns: alla, plan: null, today: TODAY });
  assert(step !== null && typeof step === "object" && !Array.isArray(step), "funktionen returnerar ett steg, aldrig en lista");
}

/* ── Varför-texten får bara innehålla indata ──────────── */
{
  // Varje tal i varje varför-text måste gå att härleda ur indata. Fångar
  // påhittade procentsatser, poäng och prognoser innan de hinner byggas in.
  const fall: Array<{ input: NextStepInput; tillatna: number[] }> = [
    { input: { campaigns: [campaign({ id: "a", status: "active", ends_on: "2026-09-26" })], plan: null, today: TODAY }, tillatna: [3] },
    { input: { campaigns: [campaign({ id: "a", status: "active", starts_on: "2026-09-16", ends_on: "2026-10-13" })], plan: null, today: TODAY }, tillatna: [8, 28] },
    { input: { campaigns: [campaign({ id: "a", status: "planned", starts_on: "2026-09-20" })], plan: null, today: TODAY }, tillatna: [3] },
    { input: { campaigns: [], plan: { postCount: 5, createdAt: "2026-09-09T08:00:00Z" }, today: TODAY }, tillatna: [37] },
    { input: { campaigns: [], plan: { postCount: 5, createdAt: `${TODAY}T08:00:00Z` }, today: TODAY }, tillatna: [5] },
  ];

  for (const { input, tillatna } of fall) {
    const step = nextStep(input);
    const tal = (step?.why.match(/\d+/g) ?? []).map(Number);
    assert(
      tal.every((n) => tillatna.includes(n)),
      `varför-texten innehåller bara härledda tal: "${step?.why}" (tillåtna: ${tillatna.join(", ")})`,
    );
  }

  // Inget steg får smyga in ett bedömningsord som VISION.md förbjuder.
  const forbjudet = /%|poäng|sannolik|troligen|viktigast|prognos|beräknas ge|förväntas/i;
  const varianter: NextStepInput[] = [
    { campaigns: [campaign({ id: "a", status: "active", ends_on: "2026-09-26" })], plan: null, today: TODAY },
    { campaigns: [campaign({ id: "a", status: "active" })], plan: null, today: TODAY },
    { campaigns: [campaign({ id: "a", status: "ended" })], plan: null, today: TODAY },
    { campaigns: [campaign({ id: "a", status: "planned", starts_on: "2026-09-01" })], plan: null, today: TODAY },
    { campaigns: [], plan: null, today: TODAY },
    { campaigns: [], plan: { postCount: 5, createdAt: `${TODAY}T08:00:00Z` }, today: TODAY },
  ];
  for (const v of varianter) {
    const step = nextStep(v);
    assert(!step || !forbjudet.test(step.why), `varför-texten är fri från bedömningar: "${step?.why}"`);
    assert(!step || !forbjudet.test(step.title), `titeln är fri från bedömningar: "${step?.title}"`);
  }
}

/* ── Varje steg är komplett ───────────────────────────── */
{
  const varianter: NextStepInput[] = [
    { campaigns: [campaign({ id: "a", status: "active", ends_on: "2026-09-26" })], plan: null, today: TODAY },
    { campaigns: [campaign({ id: "a", status: "active" })], plan: null, today: TODAY },
    { campaigns: [campaign({ id: "a", status: "ended" })], plan: null, today: TODAY },
    { campaigns: [campaign({ id: "a", status: "planned", starts_on: "2026-09-01" })], plan: null, today: TODAY },
    { campaigns: [], plan: null, today: TODAY },
    { campaigns: [], plan: { postCount: 2, createdAt: `${TODAY}T08:00:00Z` }, today: TODAY },
  ];
  for (const v of varianter) {
    const step = nextStep(v);
    assert(!!step, "varianten ger ett steg");
    if (!step) continue;
    assert(step.title.trim().length > 0, `${step.id} har en titel`);
    assert(step.why.trim().endsWith("."), `${step.id} har en varför-text som är en mening`);
    assert(step.cta.trim().length > 0, `${step.id} har en CTA`);
    assert(!!step.href !== !!step.action, `${step.id} har antingen en länk eller en handling, aldrig båda`);
  }
}

if (failures > 0) {
  console.error(`\n✗ today: ${failures} assertion(s) failed.`);
  process.exit(1);
}
console.log("\n✓ today: all assertions passed.");

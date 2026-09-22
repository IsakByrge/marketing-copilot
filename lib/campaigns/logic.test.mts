// Deterministiskt test för Campaigns v1-logiken. Ingen databas, inget nät.
// Kör: tsx lib/campaigns/logic.test.mts
import {
  roas, costPerResult, hasAnyResult, countLabel, costPerLabel,
  RESULT_TYPES, RESULT_TYPE_LABELS,
  formatKr, formatKrRounded, formatRatio, formatPeriod, timingNote,
  parseAmount, parseCount, parseResultsForm, resultsFormFrom,
  validateCampaignForm, buildCampaignFromStrategy, buildRerunPayload,
  nextStatus, canEditResults, groupCampaigns, readStrategy, prefillFromStrategy,
  strategiesAvailableForNewCampaign, normalizeCampaignRow,
  type Campaign, type CampaignResults, type StrategyRow,
} from "./logic";

let failures = 0;
function assert(cond: boolean, msg: string) {
  if (!cond) { failures++; console.error(`  ✗ ${msg}`); }
}

const noResults: CampaignResults = { spend_amount: null, revenue_amount: null, result_type: null, result_count: null, result_note: null };

/* ── ROAS ─────────────────────────────────────────────── */
{
  assert(Math.abs((roas({ spend_amount: 3600, revenue_amount: 18630 }) ?? 0) - 5.175) < 1e-9, "ROAS = omsättning / spenderat");
  assert(formatRatio(roas({ spend_amount: 3600, revenue_amount: 18630 })!) === "5,2", "ROAS visas med en decimal och komma");
  assert(roas({ spend_amount: null, revenue_amount: 100 }) === null, "ROAS kräver spenderat");
  assert(roas({ spend_amount: 100, revenue_amount: null }) === null, "ROAS kräver omsättning");
  assert(roas({ spend_amount: 0, revenue_amount: 100 }) === null, "ROAS räknas inte vid spenderat 0 (ingen division med noll)");
  assert(roas({ spend_amount: 100, revenue_amount: 0 }) === 0, "omsättning 0 ger ROAS 0 — ett riktigt utfall");
}

/* ── Kostnad per resultat ─────────────────────────────── */
{
  assert(Math.round(costPerResult({ spend_amount: 3600, result_count: 27 })!) === 133, "kostnad per resultat = spenderat / antal");
  assert(formatKrRounded(costPerResult({ spend_amount: 3600, result_count: 27 })!) === "133 kr", "kostnad avrundas till hela kronor");
  assert(costPerResult({ spend_amount: 3600, result_count: 0 }) === null, "antal 0 ger ingen kostnad per resultat");
  assert(costPerResult({ spend_amount: 0, result_count: 5 }) === null, "spenderat 0 ger ingen kostnad per resultat");
  assert(costPerResult({ spend_amount: null, result_count: 5 }) === null, "saknat spenderat ger ingen kostnad");
  assert(costPerResult({ spend_amount: 100, result_count: null }) === null, "saknat antal ger ingen kostnad");
}

/* ── Etiketter ────────────────────────────────────────── */
{
  assert(RESULT_TYPES.join() === "purchases,leads,bookings,store_visits,other", "resultattyperna matchar databasens check");
  assert(RESULT_TYPES.every((t) => RESULT_TYPE_LABELS[t]?.length > 0), "varje resultattyp har en svensk etikett");
  assert(RESULT_TYPE_LABELS.purchases === "Köp" && RESULT_TYPE_LABELS.store_visits === "Butiksbesök", "etiketterna är de beslutade");
  assert(countLabel(null) === "Resultat", "antal utan typ får neutral etikett");
  assert(costPerLabel("purchases") === "Kostnad per köp" && costPerLabel(null) === "Kostnad per resultat", "kostnadsetiketten följer typen");
  assert(!hasAnyResult(noResults), "tomma resultat är tomma");
  assert(hasAnyResult({ ...noResults, spend_amount: 0 }), "spenderat 0 räknas som inlagt");
  assert(!hasAnyResult({ ...noResults, result_note: "   " }), "en tom notering räknas inte");
}

/* ── Formatering ──────────────────────────────────────── */
{
  assert(formatKr(18630) === "18 630 kr", "tusentalsavgränsare och kr");
  assert(formatKr(1850.5) === "1 850,50 kr", "decimaler visas bara när de finns");
  assert(formatPeriod("2026-09-15", "2026-10-12", "2026-09-22") === "15 sep – 12 okt", "period i år utan år");
  assert(formatPeriod("2026-12-20", "2027-01-10", "2026-12-01") === "20 dec 2026 – 10 jan 2027", "period över årsskifte med år");
  assert(formatPeriod("2025-04-14", "2025-05-18", "2026-09-22") === "14 apr – 18 maj 2025", "förra årets period får år");
  const active = { status: "active" as const, starts_on: "2026-09-15", ends_on: "2026-10-12" };
  assert(timingNote(active, "2026-09-22") === "dag 8 av 28", "dag X av Y inom perioden");
  assert(timingNote(active, "2026-10-20") === null, "ingen dagrad efter perioden");
  assert(timingNote({ ...active, status: "planned", starts_on: "2026-11-03", ends_on: "2026-11-30" }, "2026-09-22") === "startar om 42 dagar", "planerad: dagar kvar till start");
  assert(timingNote({ ...active, status: "planned" }, "2026-09-22") === null, "planerad med passerat startdatum säger inget påhittat");
}

/* ── Inmatning ────────────────────────────────────────── */
{
  const a = (s: string) => parseAmount(s);
  assert(a("1 850").ok && (a("1 850") as { value: number }).value === 1850, "mellanslag i belopp tolkas");
  assert((a("1850,50") as { value: number }).value === 1850.5, "decimalkomma tolkas");
  assert((a("") as { value: null }).value === null, "tomt belopp är null");
  assert(!a("-5").ok, "negativt belopp avvisas");
  assert(!a("12,345").ok, "fler än två decimaler avvisas");
  assert(!a("abc").ok, "skräp avvisas");
  assert(!parseCount("2,5").ok && !parseCount("-1").ok, "antal måste vara ett helt, icke-negativt tal");
  assert((parseCount("0") as { value: number }).value === 0, "antal 0 är tillåtet");

  const parsed = parseResultsForm({ spend: "3 600", revenue: "18630", count: "27", type: "purchases", note: "  Bra kvällsbilder  " });
  assert(parsed.ok, "giltigt formulär tolkas");
  if (parsed.ok) {
    assert(Object.keys(parsed.value).sort().join() === "result_count,result_note,result_type,revenue_amount,spend_amount", "formuläret rör bara de fem resultatkolumnerna");
    assert(parsed.value.result_note === "Bra kvällsbilder", "notering trimmas");
  }
  const empty = parseResultsForm({ spend: "", revenue: "", count: "", type: null, note: " " });
  assert(empty.ok && !hasAnyResult(empty.value), "tomt formulär nollställer till null");
  const bad = parseResultsForm({ spend: "-1", revenue: "x", count: "1.5", type: null, note: "" });
  assert(!bad.ok && !!bad.errors.spend && !!bad.errors.revenue && !!bad.errors.count, "alla felaktiga fält får eget fel");
  const back = resultsFormFrom({ spend_amount: 1850.5, revenue_amount: null, result_count: 3, result_type: "leads", result_note: null });
  assert(back.spend === "1850,5" && back.revenue === "" && back.count === "3" && back.type === "leads", "befintliga resultat fylls i formuläret");
}

/* ── Formulär för ny kampanj ──────────────────────────── */
{
  assert(validateCampaignForm({ title: " Höst ", startsOn: "2026-09-15", endsOn: "2026-09-15" }).ok, "samma start- och slutdag är tillåten");
  const r = validateCampaignForm({ title: "", startsOn: "2026-09-15", endsOn: "2026-09-01" });
  assert(!r.ok && !!r.errors.title && !!r.errors.endsOn, "namn krävs och slut före start avvisas");
  const d = validateCampaignForm({ title: "X", startsOn: "", endsOn: "2026-02-30" });
  assert(!d.ok && !!d.errors.startsOn && !!d.errors.endsOn, "saknade och ogiltiga datum avvisas");
}

/* ── Ny kampanj ur strategi: id och företag från strategiraden ── */
const strategyA: StrategyRow = {
  id: "5a000000-0000-0000-0000-000000000001",
  title: "Verona – Höstvärme",
  goal: "Sälja mer",
  company_id: "ca000000-0000-0000-0000-000000000001",
  strategy_context: {
    version: 2,
    brief: { product: "Verona", goalKey: "sell-product", goalTitle: "Sälja mer", period: { start: "2026-09-15", end: "2026-10-12" } },
    analysis: { campaignDiagnosis: "", recommendedFocus: "Sälj Verona som kvällsvärme på altanen.", rationale: ["Kunderna vill förlänga utesäsongen.", " "], identifiedGaps: [], alternativeDirections: [], confidence: "medium" },
    strategy: { primaryGoal: "Sälja mer", primaryAudience: "Villaägare", product: "Verona", offer: "", geographicArea: "", mainMessage: "Värme på altanen", valueProposition: "", primaryCta: "Köp i butik", urgency: "", channelPriority: [{ channel: "facebook", reason: "" }], risks: [], improvementOpportunities: [], kpis: [], assumptions: [] },
    answers: [],
    companyBrainReferences: [],
  },
};
{
  const form = { title: "Höstvärme", startsOn: "2026-09-15", endsOn: "2026-10-12" };
  const p = buildCampaignFromStrategy(strategyA, form, "user-1");
  assert(!!p, "strategi med företag ger en payload");
  if (p) {
    assert(p.strategy_id === strategyA.id, "strategy_id är den valda strategins id");
    assert(p.company_id === strategyA.company_id, "company_id kommer direkt från strategiraden");
    assert(p.user_id === "user-1" && p.status === "planned", "ny kampanj är planerad och ägs av användaren");
    assert(p.spend_amount === null && p.revenue_amount === null && p.result_type === null && p.result_count === null && p.result_note === null && p.learning === null, "ny kampanj börjar utan resultat och lärdom");
  }
  assert(buildCampaignFromStrategy({ ...strategyA, company_id: null }, form, "user-1") === null, "strategi utan företag kan inte bli kampanj");
  const avail = strategiesAvailableForNewCampaign(
    [strategyA, { ...strategyA, id: "b", company_id: null }, { ...strategyA, id: "c" }],
    [strategyA.id],
  );
  assert(avail.map((s) => s.id).join() === "c", "valbara strategier: har företag och saknar kampanj");
}

/* ── Kör igen tömmer allt resultat ────────────────────── */
const endedCampaign: Campaign = {
  id: "old", user_id: "user-1", company_id: "ca000000-0000-0000-0000-000000000001", strategy_id: strategyA.id,
  title: "Verona – Höstvärme", status: "ended", starts_on: "2026-09-15", ends_on: "2026-10-12",
  spend_amount: 3600, revenue_amount: 18630, result_type: "purchases", result_count: 27,
  result_note: "Många frågade om 11 kg", learning: "Kvällsbilder sålde",
  created_at: "2026-09-10T10:00:00Z", updated_at: "2026-10-13T10:00:00Z", strategy: strategyA,
};
{
  const snapshot = JSON.stringify(endedCampaign);
  const p = buildRerunPayload(endedCampaign, { title: "Verona – Höstvärme 2027", startsOn: "2027-09-01", endsOn: "2027-09-30" }, "user-1");
  assert(!!p, "kör igen ger en payload");
  if (p) {
    assert(p.strategy_id === endedCampaign.strategy_id && p.company_id === endedCampaign.company_id, "samma strategi och företag");
    assert(p.starts_on === "2027-09-01" && p.ends_on === "2027-09-30" && p.status === "planned", "nya datum, status planerad");
    assert(p.spend_amount === null && p.revenue_amount === null && p.result_type === null && p.result_count === null, "inga resultat kopieras");
    assert(p.result_note === null && p.learning === null, "varken notering eller lärdom kopieras");
    assert(!("id" in p) && !("source_campaign_id" in p), "ny rad, ingen lineage");
  }
  assert(JSON.stringify(endedCampaign) === snapshot, "den gamla kampanjen muteras inte");
}

/* ── Statusövergångar ─────────────────────────────────── */
{
  assert(nextStatus("planned", "start") === "active", "planerad → pågår");
  assert(nextStatus("active", "end") === "ended", "pågår → avslutad");
  assert(nextStatus("planned", "end") === null, "planerad kan inte avslutas direkt");
  assert(nextStatus("active", "start") === null && nextStatus("ended", "start") === null, "bara planerad kan startas");
  assert(nextStatus("ended", "end") === null, "avslutad kan inte avslutas igen");
  assert(!canEditResults("planned") && canEditResults("active") && canEditResults("ended"), "resultat från pågår och framåt");
}

/* ── Gruppering ───────────────────────────────────────── */
{
  const mk = (id: string, status: Campaign["status"], starts: string, ends: string): Campaign =>
    ({ ...endedCampaign, id, status, starts_on: starts, ends_on: ends });
  const g = groupCampaigns([
    mk("e1", "ended", "2026-03-20", "2026-04-06"),
    mk("p1", "planned", "2026-11-03", "2026-11-30"),
    mk("e2", "ended", "2026-04-14", "2026-05-18"),
    mk("a1", "active", "2026-09-15", "2026-10-12"),
  ]);
  assert(g.active.map((c) => c.id).join() === "a1" && g.planned.map((c) => c.id).join() === "p1", "grupperas per status");
  assert(g.ended.map((c) => c.id).join() === "e2,e1", "avslutade: senast avslutad först");
}

/* ── Strategin läses defensivt ────────────────────────── */
{
  const v2 = readStrategy(strategyA);
  assert(v2.direction === "Sälj Verona som kvällsvärme på altanen.", "v2: riktningen är analysens rekommenderade fokus");
  assert(v2.rationale.length === 1, "v2: tomma resonemang filtreras bort");
  assert(v2.details.some((d) => d.label === "Målgrupp" && d.value === "Villaägare"), "v2: detaljer ur strategin");
  assert(!v2.details.some((d) => d.value === ""), "inga tomma detaljer");

  const v1 = readStrategy({ id: "v1", title: "Vårkampanj", goal: "Leads", company_id: "c", strategy_context: { goal: "Leads", mainMessage: "Boka service nu" }, recommendation: { headline: "Service före säsongen" } });
  assert(v1.direction === "Service före säsongen" && v1.rationale.length === 0, "v1: rubriken är riktningen, inget påhittat resonemang");

  const bare = readStrategy({ id: "x", title: "Strategi", goal: "Sälja", company_id: "c", strategy_context: {}, recommendation: {} });
  assert(bare.direction === null && bare.details.length === 0 && bare.title === "Strategi", "okänd struktur: ingen riktning, bara titel");
  assert(readStrategy(null).direction === null, "saknad strategi hanteras");
  assert(readStrategy({ id: "y", title: "", goal: "", company_id: null, strategy_context: "skräp" }).direction === null, "skräp i strategy_context kraschar inte");
}

/* ── Förifyllning ur strategin ────────────────────────── */
{
  const p = prefillFromStrategy(strategyA);
  assert(p.title === "Verona – Höstvärme" && p.startsOn === "2026-09-15" && p.endsOn === "2026-10-12", "namn och period från v2-briefen");
  const noPeriod = prefillFromStrategy({ ...strategyA, strategy_context: { goal: "x" } });
  assert(noPeriod.startsOn === "" && noPeriod.endsOn === "", "v1 saknar säkra datum → tomt, användaren anger");
  const reversed = prefillFromStrategy({ ...strategyA, strategy_context: { ...(strategyA.strategy_context as object), brief: { period: { start: "2026-10-12", end: "2026-09-15" } } } });
  assert(reversed.startsOn === "" && reversed.endsOn === "", "omvänd period förifylls inte");
}

/* ── Rader från databasen ─────────────────────────────── */
{
  const row = normalizeCampaignRow({ ...endedCampaign, spend_amount: "3600.00", revenue_amount: null, result_type: "clicks", strategy: [strategyA] });
  assert(!!row && row.spend_amount === 3600, "numeric som sträng blir tal");
  assert(!!row && row.result_type === null, "okänd resultattyp blir null");
  assert(!!row && row.strategy?.id === strategyA.id, "inbäddad strategi som lista hanteras");
  assert(normalizeCampaignRow({ ...endedCampaign, status: "paused" }) === null, "okänd status avvisas");
  assert(normalizeCampaignRow(null) === null, "tom rad avvisas");
}

if (failures > 0) {
  console.error(`\n✗ campaigns: ${failures} assertion(s) failed.`);
  process.exit(1);
}
console.log("\n✓ campaigns: all assertions passed.");

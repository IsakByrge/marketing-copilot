// ─────────────────────────────────────────────────────────────
// Campaigns v1 — ren logik. Ingen Supabase, inga sidoeffekter, så
// allt här kan testas (logic.test.mts) och delas av listan,
// detaljsidan och Kampanjbyggarens "Gör till kampanj".
//
// campaign_strategies = AI-genererad strategi.
// campaigns           = en faktisk körning av en strategi.
//
// Beräknade mått (ROAS, kostnad per resultat) lagras aldrig. De
// räknas här, bara när underlaget finns, och visas som beräknade.
// ─────────────────────────────────────────────────────────────
import { isStrategyV2, normalizeStrategyContext } from "../strategist/adapter";
import type { NormalizedStrategyContext } from "../strategist/types";

/* ── Typer ──────────────────────────────────────────────── */

export const CAMPAIGN_STATUSES = ["planned", "active", "ended"] as const;
export type CampaignStatus = (typeof CAMPAIGN_STATUSES)[number];

export const RESULT_TYPES = ["purchases", "leads", "bookings", "store_visits", "other"] as const;
export type ResultType = (typeof RESULT_TYPES)[number];

/** Svenska etiketter, i den ordning valen visas. */
export const RESULT_TYPE_LABELS: Record<ResultType, string> = {
  purchases: "Köp",
  leads: "Leads",
  bookings: "Bokningar",
  store_visits: "Butiksbesök",
  other: "Annat",
};

export const STATUS_LABELS: Record<CampaignStatus, string> = {
  planned: "Planerad",
  active: "Pågår",
  ended: "Avslutad",
};

/** Strategiraden så som kampanjerna behöver den. */
export interface StrategyRow {
  id: string;
  title: string;
  goal: string;
  company_id: string | null;
  created_at?: string;
  strategy_context: unknown;
  recommendation?: unknown;
}

export interface CampaignResults {
  spend_amount: number | null;
  revenue_amount: number | null;
  result_type: ResultType | null;
  result_count: number | null;
  result_note: string | null;
}

export interface Campaign extends CampaignResults {
  id: string;
  user_id: string;
  company_id: string;
  strategy_id: string;
  title: string;
  status: CampaignStatus;
  starts_on: string;
  ends_on: string;
  learning: string | null;
  created_at: string;
  updated_at: string;
  /** Inbäddad via strategy_id. Null om RLS eller nätet inte gav den. */
  strategy: StrategyRow | null;
}

/** Det som skickas vid INSERT. id, tider och default sätts av databasen. */
export interface CampaignInsert extends CampaignResults {
  user_id: string;
  company_id: string;
  strategy_id: string;
  title: string;
  status: "planned";
  starts_on: string;
  ends_on: string;
  learning: null;
}

export const TITLE_MAX = 120;
export const NOTE_MAX = 2000;
/** numeric(12,2) rymmer högst 10 siffror före decimalen. */
const AMOUNT_MAX = 9_999_999_999.99;
const COUNT_MAX = 2_147_483_647;

/* ── Normalisering av rader från databasen ─────────────── */

const str = (v: unknown): string => (typeof v === "string" ? v : "");
const strOrNull = (v: unknown): string | null => {
  const t = typeof v === "string" ? v.trim() : "";
  return t ? t : null;
};
/** PostgREST kan leverera numeric som sträng. Allt annat än ett ändligt tal blir null. */
export function toNumberOrNull(v: unknown): number | null {
  if (v === null || v === undefined || v === "") return null;
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : null;
}

export function isCampaignStatus(v: unknown): v is CampaignStatus {
  return typeof v === "string" && (CAMPAIGN_STATUSES as readonly string[]).includes(v);
}
export function isResultType(v: unknown): v is ResultType {
  return typeof v === "string" && (RESULT_TYPES as readonly string[]).includes(v);
}

export function normalizeStrategyRow(raw: unknown): StrategyRow | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const id = str(o.id);
  if (!id) return null;
  return {
    id,
    title: str(o.title),
    goal: str(o.goal),
    company_id: strOrNull(o.company_id),
    created_at: str(o.created_at) || undefined,
    strategy_context: o.strategy_context ?? null,
    recommendation: o.recommendation ?? null,
  };
}

/** Rad från campaigns (med inbäddad strategi) → Campaign. Null om raden saknar det nödvändiga. */
export function normalizeCampaignRow(raw: unknown): Campaign | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const id = str(o.id);
  if (!id || !isCampaignStatus(o.status)) return null;
  // Inbäddningen kan komma som objekt eller, beroende på klient, som lista.
  const embedded = Array.isArray(o.strategy) ? o.strategy[0] : o.strategy;
  return {
    id,
    user_id: str(o.user_id),
    company_id: str(o.company_id),
    strategy_id: str(o.strategy_id),
    title: str(o.title),
    status: o.status,
    starts_on: str(o.starts_on),
    ends_on: str(o.ends_on),
    spend_amount: toNumberOrNull(o.spend_amount),
    revenue_amount: toNumberOrNull(o.revenue_amount),
    result_type: isResultType(o.result_type) ? o.result_type : null,
    result_count: toNumberOrNull(o.result_count),
    result_note: strOrNull(o.result_note),
    learning: strOrNull(o.learning),
    created_at: str(o.created_at),
    updated_at: str(o.updated_at),
    strategy: normalizeStrategyRow(embedded),
  };
}

/* ── Beräknade mått ─────────────────────────────────────── */

/** ROAS = omsättning / spenderat. Bara när spenderat > 0 och omsättning finns. */
export function roas(r: Pick<CampaignResults, "spend_amount" | "revenue_amount">): number | null {
  const spend = r.spend_amount;
  const revenue = r.revenue_amount;
  if (spend === null || revenue === null) return null;
  if (!(spend > 0) || revenue < 0) return null;
  return revenue / spend;
}

/** Kostnad per resultat = spenderat / antal. Bara när båda är > 0. */
export function costPerResult(r: Pick<CampaignResults, "spend_amount" | "result_count">): number | null {
  const spend = r.spend_amount;
  const count = r.result_count;
  if (spend === null || count === null) return null;
  if (!(spend > 0) || !(count > 0)) return null;
  return spend / count;
}

/** Finns något alls inlagt? Styr "Resultat" mot "Resultat hittills". */
export function hasAnyResult(r: CampaignResults): boolean {
  return r.spend_amount !== null || r.revenue_amount !== null || r.result_count !== null
    || r.result_type !== null || (r.result_note !== null && r.result_note.trim() !== "");
}

/** Etikett för antalet: "Köp", "Leads" … eller neutralt "Resultat" utan typ. */
export function countLabel(type: ResultType | null): string {
  return type ? RESULT_TYPE_LABELS[type] : "Resultat";
}

/** "Kostnad per köp", "Kostnad per lead" … Neutral form för Annat och utan typ. */
export function costPerLabel(type: ResultType | null): string {
  switch (type) {
    case "purchases": return "Kostnad per köp";
    case "leads": return "Kostnad per lead";
    case "bookings": return "Kostnad per bokning";
    case "store_visits": return "Kostnad per butiksbesök";
    default: return "Kostnad per resultat";
  }
}

/* ── Formatering ────────────────────────────────────────── */

const NBSP = " ";

/** 18630 → "18 630 kr". Decimaler bara när de finns. */
export function formatKr(n: number): string {
  const hasDecimals = Math.round(n * 100) % 100 !== 0;
  const s = n.toLocaleString("sv-SE", {
    minimumFractionDigits: hasDecimals ? 2 : 0,
    maximumFractionDigits: hasDecimals ? 2 : 0,
  });
  return `${s.replace(/\s/g, NBSP)}${NBSP}kr`;
}

/** Heltal, avrundat: 133,33 → "133 kr". För beräknade kostnader. */
export function formatKrRounded(n: number): string {
  return formatKr(Math.round(n));
}

export function formatCount(n: number): string {
  return n.toLocaleString("sv-SE").replace(/\s/g, NBSP);
}

/** 5.175 → "5,2". */
export function formatRatio(n: number): string {
  return n.toLocaleString("sv-SE", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
}

const MONTHS = ["jan", "feb", "mar", "apr", "maj", "jun", "jul", "aug", "sep", "okt", "nov", "dec"];

function parseIsoDate(iso: string): { y: number; m: number; d: number } | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!m) return null;
  const y = Number(m[1]), mo = Number(m[2]), d = Number(m[3]);
  const dt = new Date(Date.UTC(y, mo - 1, d));
  if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== mo - 1 || dt.getUTCDate() !== d) return null;
  return { y, m: mo, d };
}

export function isIsoDate(v: unknown): v is string {
  return typeof v === "string" && parseIsoDate(v) !== null;
}

/** "15 sep – 12 okt", med år när perioden inte ligger i `todayIso`s år. */
export function formatPeriod(starts: string, ends: string, todayIso: string): string {
  const a = parseIsoDate(starts), b = parseIsoDate(ends), t = parseIsoDate(todayIso);
  if (!a || !b) return [starts, ends].filter(Boolean).join(" – ");
  const thisYear = t?.y;
  const fmt = (p: { y: number; m: number; d: number }, withYear: boolean) =>
    `${p.d} ${MONTHS[p.m - 1]}${withYear ? ` ${p.y}` : ""}`;
  const showYear = a.y !== b.y || a.y !== thisYear;
  return `${fmt(a, a.y !== b.y && showYear)} – ${fmt(b, showYear)}`;
}

/** Hela dagar mellan två ISO-datum (b − a). */
export function daysBetween(aIso: string, bIso: string): number | null {
  const a = parseIsoDate(aIso), b = parseIsoDate(bIso);
  if (!a || !b) return null;
  return Math.round((Date.UTC(b.y, b.m - 1, b.d) - Date.UTC(a.y, a.m - 1, a.d)) / 86_400_000);
}

/** Dagens datum som ISO i användarens tidszon. */
export function todayIso(now: Date = new Date()): string {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/**
 * Kort tidsrad ur datumen — bara fakta som följer av datumen och dagens
 * datum. Statusen ändras aldrig av datum; det här är bara text.
 *  - planerad, start framåt: "startar om 12 dagar" / "startar i dag"
 *  - pågår, inom perioden:   "dag 8 av 28"
 */
export function timingNote(c: Pick<Campaign, "status" | "starts_on" | "ends_on">, today: string): string | null {
  if (c.status === "planned") {
    const until = daysBetween(today, c.starts_on);
    if (until === null || until < 0) return null;
    if (until === 0) return "startar i dag";
    if (until === 1) return "startar i morgon";
    return `startar om ${until} dagar`;
  }
  if (c.status === "active") {
    const total = daysBetween(c.starts_on, c.ends_on);
    const done = daysBetween(c.starts_on, today);
    if (total === null || done === null || done < 0 || done > total) return null;
    return `dag ${done + 1} av ${total + 1}`;
  }
  return null;
}

/* ── Inmatning ──────────────────────────────────────────── */

export type Parsed<T> = { ok: true; value: T } | { ok: false; error: string };

/** "1 850", "1850,50", "1850.5" → 1850.5. Tomt → null. Negativt eller skräp → fel. */
export function parseAmount(input: string): Parsed<number | null> {
  const t = input.replace(/[\s ]/g, "").replace(/kr$/i, "").replace(",", ".");
  if (t === "") return { ok: true, value: null };
  if (!/^\d+(\.\d{1,2})?$/.test(t)) return { ok: false, error: "Skriv ett belopp i kronor, till exempel 1850 eller 1850,50." };
  const n = Number(t);
  if (!Number.isFinite(n) || n > AMOUNT_MAX) return { ok: false, error: "Beloppet är för stort." };
  return { ok: true, value: n };
}

/** "27" → 27. Tomt → null. Bara hela, icke-negativa tal. */
export function parseCount(input: string): Parsed<number | null> {
  const t = input.replace(/[\s ]/g, "");
  if (t === "") return { ok: true, value: null };
  if (!/^\d+$/.test(t)) return { ok: false, error: "Skriv ett helt antal, till exempel 27." };
  const n = Number(t);
  if (n > COUNT_MAX) return { ok: false, error: "Antalet är för stort." };
  return { ok: true, value: n };
}

export interface ResultsForm {
  spend: string;
  revenue: string;
  count: string;
  type: ResultType | null;
  note: string;
}

export type ResultsFormErrors = Partial<Record<"spend" | "revenue" | "count" | "note", string>>;

/** Formulär → exakt de fem resultatkolumnerna. Rör aldrig något annat. */
export function parseResultsForm(f: ResultsForm): { ok: true; value: CampaignResults } | { ok: false; errors: ResultsFormErrors } {
  const errors: ResultsFormErrors = {};
  const spend = parseAmount(f.spend);
  const revenue = parseAmount(f.revenue);
  const count = parseCount(f.count);
  if (!spend.ok) errors.spend = spend.error;
  if (!revenue.ok) errors.revenue = revenue.error;
  if (!count.ok) errors.count = count.error;
  const note = f.note.trim();
  if (note.length > NOTE_MAX) errors.note = `Högst ${NOTE_MAX} tecken.`;
  if (!spend.ok || !revenue.ok || !count.ok || errors.note) return { ok: false, errors };
  return {
    ok: true,
    value: {
      spend_amount: spend.value,
      revenue_amount: revenue.value,
      result_count: count.value,
      result_type: f.type,
      result_note: note || null,
    },
  };
}

/** Campaign → formulärets startvärden (för "Uppdatera resultat"). */
export function resultsFormFrom(c: CampaignResults): ResultsForm {
  const num = (n: number | null) => (n === null ? "" : String(n).replace(".", ","));
  return {
    spend: num(c.spend_amount),
    revenue: num(c.revenue_amount),
    count: c.result_count === null ? "" : String(c.result_count),
    type: c.result_type,
    note: c.result_note ?? "",
  };
}

export interface CampaignForm {
  title: string;
  startsOn: string;
  endsOn: string;
}

export type CampaignFormErrors = Partial<Record<keyof CampaignForm, string>>;

export function validateCampaignForm(f: CampaignForm): { ok: true; value: CampaignForm } | { ok: false; errors: CampaignFormErrors } {
  const errors: CampaignFormErrors = {};
  const title = f.title.trim();
  if (!title) errors.title = "Kampanjen behöver ett namn.";
  else if (title.length > TITLE_MAX) errors.title = `Högst ${TITLE_MAX} tecken.`;
  if (!isIsoDate(f.startsOn)) errors.startsOn = "Välj ett startdatum.";
  if (!isIsoDate(f.endsOn)) errors.endsOn = "Välj ett slutdatum.";
  if (!errors.startsOn && !errors.endsOn && f.endsOn < f.startsOn) errors.endsOn = "Slutdatum kan inte ligga före startdatum.";
  if (Object.keys(errors).length) return { ok: false, errors };
  return { ok: true, value: { title, startsOn: f.startsOn, endsOn: f.endsOn } };
}

/* ── Payloads ───────────────────────────────────────────── */

const EMPTY_RESULTS: CampaignResults = {
  spend_amount: null,
  revenue_amount: null,
  result_type: null,
  result_count: null,
  result_note: null,
};

/**
 * Ny kampanj ur en sparad strategi. company_id tas DIREKT från strategiraden
 * — RLS kräver att strategins företag är kampanjens företag. Saknar raden
 * company_id kan den inte bli en kampanj.
 */
export function buildCampaignFromStrategy(
  strategy: Pick<StrategyRow, "id" | "company_id">,
  form: CampaignForm,
  userId: string,
): CampaignInsert | null {
  if (!strategy.company_id || !strategy.id || !userId) return null;
  return {
    user_id: userId,
    company_id: strategy.company_id,
    strategy_id: strategy.id,
    title: form.title.trim(),
    status: "planned",
    starts_on: form.startsOn,
    ends_on: form.endsOn,
    ...EMPTY_RESULTS,
    learning: null,
  };
}

/**
 * "Kör igen": en NY rad med samma strategi och företag, nya datum och tomma
 * resultat. Den gamla kampanjen läses bara — inget från dess resultat,
 * notering eller lärdom följer med.
 */
export function buildRerunPayload(
  previous: Pick<Campaign, "strategy_id" | "company_id">,
  form: CampaignForm,
  userId: string,
): CampaignInsert | null {
  if (!previous.strategy_id || !previous.company_id || !userId) return null;
  return {
    user_id: userId,
    company_id: previous.company_id,
    strategy_id: previous.strategy_id,
    title: form.title.trim(),
    status: "planned",
    starts_on: form.startsOn,
    ends_on: form.endsOn,
    ...EMPTY_RESULTS,
    learning: null,
  };
}

/* ── Statusövergångar ───────────────────────────────────── */

export type CampaignAction = "start" | "end";

/** De enda övergångar appen stödjer: planerad → pågår → avslutad. */
export function nextStatus(current: CampaignStatus, action: CampaignAction): CampaignStatus | null {
  if (action === "start" && current === "planned") return "active";
  if (action === "end" && current === "active") return "ended";
  return null;
}

/** Resultat kan läggas in medan kampanjen pågår och ändras efteråt. */
export function canEditResults(status: CampaignStatus): boolean {
  return status === "active" || status === "ended";
}

/* ── Gruppering ─────────────────────────────────────────── */

export interface CampaignGroups {
  active: Campaign[];
  planned: Campaign[];
  ended: Campaign[];
}

export function groupCampaigns(list: Campaign[]): CampaignGroups {
  const byStartAsc = (a: Campaign, b: Campaign) => a.starts_on.localeCompare(b.starts_on) || b.created_at.localeCompare(a.created_at);
  const byEndDesc = (a: Campaign, b: Campaign) => b.ends_on.localeCompare(a.ends_on) || b.created_at.localeCompare(a.created_at);
  return {
    active: list.filter((c) => c.status === "active").sort(byStartAsc),
    planned: list.filter((c) => c.status === "planned").sort(byStartAsc),
    ended: list.filter((c) => c.status === "ended").sort(byEndDesc),
  };
}

/* ── Körningar av samma strategi ────────────────────────── */

/**
 * Hur många avslutade körningar detaljsidan visar, inklusive den man
 * står i. Historiken ska vara kompakt — det här är kampanjens lärande,
 * inte en analysvy. Ingen "visa alla".
 */
export const MAX_SYNLIGA_KORNINGAR = 3;

/**
 * Avslutade körningar av samma strategi, nyast först.
 *
 * BARA status "ended". En planerad eller pågående kampanj med samma
 * strategi är inte ett utfall och ska varken visas eller få sektionen
 * att dyka upp — v1 handlar om lärande från färdiga körningar.
 *
 * Kronologin går på starts_on: frågan är när kampanjen KÖRDES, inte när
 * raden skapades. created_at bryter lika datum. Sorteringen sker på en
 * kopia; anroparens lista rörs inte.
 */
export function endedRuns(list: Campaign[]): Campaign[] {
  return list
    .filter((c) => c.status === "ended")
    .sort(
      (a, b) =>
        b.starts_on.localeCompare(a.starts_on) || b.created_at.localeCompare(a.created_at),
    );
}

/** De mått två körningar kan jämföras med. Se runComparison. */
export type ComparisonMetric = "roas" | "cost_per_result";

export interface RunComparison {
  metric: ComparisonMetric;
  /** Färdig etikett: "ROAS" eller "Kostnad per köp". */
  label: string;
  /** Äldre körningens värde. */
  from: number;
  /** Nyare körningens värde. */
  to: number;
}

/**
 * Samma resultattyp OCH en typ som betyder något.
 *
 * null säger inte vad som räknades. "other" är en uppsamlingskategori —
 * samma lagrade värde i två körningar behöver inte vara samma sak, och
 * då får vi inte ställa talen mot varandra.
 */
function jamforbarResultattyp(a: ResultType | null, b: ResultType | null): boolean {
  return a !== null && a === b && a !== "other";
}

/**
 * Jämför de TVÅ SENASTE AVSLUTADE körningarna.
 *
 * Hierarkin är två steg, inte fyra:
 *   1. ROAS när båda har den. Kronor genom kronor — oberoende av vad
 *      som räknades, så resultattypen får skilja sig.
 *   2. Annars kostnad per resultat, men bara vid jämförbar resultattyp.
 *   3. Annars ingenting.
 *
 * result_count och revenue är MED FLIT inte fallback. Fler leads för
 * dubbla pengar är inte ett bättre utfall, och högre omsättning med
 * högre kostnad säger ingenting. De siffrorna visas per körning som
 * fakta; de bär ingen slutsats.
 *
 * Funktionen säger bara vilka två tal som gäller. Riktning, ord och
 * formatering äger gränssnittet — här finns ingen tröskel, ingen
 * signifikans och ingen tolkning.
 */
export function runComparison(list: Campaign[]): RunComparison | null {
  const [nyare, aldre] = endedRuns(list);
  if (!nyare || !aldre) return null;

  const roasNy = roas(nyare);
  const roasGammal = roas(aldre);
  if (roasNy !== null && roasGammal !== null) {
    return { metric: "roas", label: "ROAS", from: roasGammal, to: roasNy };
  }

  if (!jamforbarResultattyp(nyare.result_type, aldre.result_type)) return null;
  const cprNy = costPerResult(nyare);
  const cprGammal = costPerResult(aldre);
  if (cprNy === null || cprGammal === null) return null;

  return {
    metric: "cost_per_result",
    label: costPerLabel(nyare.result_type),
    from: cprGammal,
    to: cprNy,
  };
}

/* ── Strategin, läst defensivt ──────────────────────────── */

export interface StrategyView {
  /** Den strategiska riktningen, om den går att läsa säkert. */
  direction: string | null;
  /** Varför — bara v2 bär ett uttryckligt resonemang. */
  rationale: string[];
  /** Hela strategin som etikett/värde-par, bara fält som finns. */
  details: Array<{ label: string; value: string }>;
  /** Strategiradens titel och mål — reserv när riktningen saknas. */
  title: string;
  goal: string;
}

const clean = (v: unknown): string => (typeof v === "string" ? v.trim() : "");

/**
 * Läser riktning, resonemang och detaljer ur en strategirad, oavsett om den
 * är v1 (platt) eller v2 (StrategyV2). Hittar aldrig på text: saknas ett
 * fält lämnas det ute.
 */
export function readStrategy(row: StrategyRow | null): StrategyView {
  if (!row) return { direction: null, rationale: [], details: [], title: "", goal: "" };
  const ctx = row.strategy_context;
  let direction: string | null = null;
  let rationale: string[] = [];

  if (isStrategyV2(ctx)) {
    direction = clean(ctx.analysis?.recommendedFocus) || clean(ctx.strategy?.mainMessage) || null;
    rationale = Array.isArray(ctx.analysis?.rationale)
      ? ctx.analysis.rationale.map(clean).filter(Boolean).slice(0, 4)
      : [];
  } else {
    // v1: rekommendationens rubrik är den bärande idén; annars huvudbudskapet.
    const rec = row.recommendation && typeof row.recommendation === "object"
      ? (row.recommendation as Record<string, unknown>) : {};
    const n = normalizeStrategyContext(ctx);
    direction = clean(rec.headline) || clean(n.mainMessage) || null;
  }

  const n: NormalizedStrategyContext = normalizeStrategyContext(ctx);
  const details: StrategyView["details"] = [];
  const add = (label: string, v: string | undefined) => { const t = clean(v); if (t) details.push({ label, value: t }); };
  add("Mål", n.goal);
  add("Produkt", n.product);
  add("Målgrupp", n.audience);
  add("Sekundär målgrupp", n.secondaryAudience);
  add("Erbjudande", n.offer);
  add("Huvudbudskap", n.mainMessage && n.mainMessage !== direction ? n.mainMessage : undefined);
  add("Värdeerbjudande", n.valueProposition);
  add("Uppmaning", n.cta);
  add("Anledning att agera nu", n.urgency);
  add("Område", n.geographicArea);
  if (n.channels?.length) details.push({ label: "Kanaler", value: n.channels.join(", ") });
  if (n.risks?.length) details.push({ label: "Risker", value: n.risks.join(" · ") });
  if (n.assumptions?.length) details.push({ label: "Antaganden", value: n.assumptions.join(" · ") });

  return { direction, rationale, details, title: clean(row.title), goal: clean(row.goal) };
}

/**
 * Förifyllning för en ny kampanj ur en strategi: namnet från strategins
 * titel, perioden bara om v2-briefen har giltiga datum i rätt ordning.
 */
export function prefillFromStrategy(row: StrategyRow | null): CampaignForm {
  if (!row) return { title: "", startsOn: "", endsOn: "" };
  let startsOn = "";
  let endsOn = "";
  if (isStrategyV2(row.strategy_context)) {
    const p = row.strategy_context.brief?.period;
    if (isIsoDate(p?.start)) startsOn = p.start;
    if (isIsoDate(p?.end)) endsOn = p.end;
    if (startsOn && endsOn && endsOn < startsOn) { startsOn = ""; endsOn = ""; }
  }
  return { title: clean(row.title).slice(0, TITLE_MAX), startsOn, endsOn };
}

/** Strategier som kan bli en ny kampanj: har företag och har inte redan en kampanj. */
export function strategiesAvailableForNewCampaign(rows: StrategyRow[], usedStrategyIds: Iterable<string>): StrategyRow[] {
  const used = new Set(usedStrategyIds);
  return rows.filter((r) => !!r.company_id && !used.has(r.id));
}

// ─────────────────────────────────────────────────────────────
// Resultat per publicerat inlägg — ren logik.
//
// Steg 3 i veckoloopen. Företagaren säger om ett inlägg gick bra eller
// dåligt, och kan lägga till siffror hon läst av i Facebook eller
// Instagram. Appen räknar aldrig fram en siffra själv och visar inga
// siffror den inte fått.
//
// Relativa importer: testsviten körs med tsx utan tsconfig-alias.
// ─────────────────────────────────────────────────────────────
import { isChannel, type Channel } from "./published";

export const RATINGS = ["good", "bad"] as const;
export type Rating = (typeof RATINGS)[number];
export const RATING_LABELS: Record<Rating, string> = { good: "Gick bra", bad: "Gick sämre" };

export const METRICS = ["reach", "reactions", "comments", "clicks"] as const;
export type Metric = (typeof METRICS)[number];
export const METRIC_LABELS: Record<Metric, string> = {
  reach: "Räckvidd",
  reactions: "Reaktioner",
  comments: "Kommentarer",
  clicks: "Klick",
};

/** En publicerad rad som väntar på (eller har) ett resultat. */
export interface ResultRow {
  id: string;
  plan_id: string;
  item_key: string;
  channel: Channel;
  published_on: string;
  text: string;
  result_rating: Rating | null;
}

export function normalizeResultRows(raw: unknown): ResultRow[] {
  if (!Array.isArray(raw)) return [];
  const out: ResultRow[] = [];
  for (const r of raw as Array<Record<string, unknown>>) {
    if (!r || typeof r.id !== "string" || typeof r.plan_id !== "string") continue;
    if (typeof r.item_key !== "string" || !isChannel(r.channel)) continue;
    if (typeof r.published_on !== "string" || typeof r.text !== "string") continue;
    const rating = r.result_rating === "good" || r.result_rating === "bad" ? r.result_rating : null;
    out.push({
      id: r.id, plan_id: r.plan_id, item_key: r.item_key, channel: r.channel,
      published_on: r.published_on, text: r.text, result_rating: rating,
    });
  }
  return out;
}

function addDays(isoDate: string, n: number): string {
  const d = new Date(`${isoDate}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

/**
 * Inlägg som är mogna att bedöma: publicerade minst `minDays` dagar sedan,
 * högst `maxDays` dagar sedan, och utan resultat. Nyast först.
 * Ett inlägg från i dag är för färskt att säga något om, och ett från
 * förra månaden minns ingen.
 */
export function resultsDue(rows: ResultRow[], today: string, minDays = 1, maxDays = 21): ResultRow[] {
  const senast = addDays(today, -minDays);
  const tidigast = addDays(today, -maxDays);
  return rows
    .filter((r) => r.result_rating === null && r.published_on <= senast && r.published_on >= tidigast)
    .sort((a, b) => b.published_on.localeCompare(a.published_on));
}

/** Första raden ur den publicerade texten, för att känna igen inlägget. */
export function firstLine(text: string, max = 90): string {
  const rad = text.split("\n").map((r) => r.trim()).find(Boolean) ?? "";
  return rad.length > max ? `${rad.slice(0, max - 1).trimEnd()}…` : rad;
}

export type MetricsForm = Record<Metric, string>;
export type MetricsValue = Record<Metric, number | null>;

export const emptyMetricsForm = (): MetricsForm => ({ reach: "", reactions: "", comments: "", clicks: "" });

/**
 * Siffrorna som de skrivits. Tomt fält = null, inte noll: att inte veta
 * är något annat än att ingen reagerade. "1 200" och "1200" godtas.
 */
export function parseMetrics(f: MetricsForm): { ok: true; value: MetricsValue } | { ok: false; errors: Partial<Record<Metric, string>> } {
  const value = {} as MetricsValue;
  const errors: Partial<Record<Metric, string>> = {};
  for (const m of METRICS) {
    const s = (f[m] ?? "").replace(/[\s ]/g, "");
    if (!s) { value[m] = null; continue; }
    if (!/^\d{1,9}$/.test(s)) { errors[m] = "Skriv ett heltal."; continue; }
    value[m] = Number(s);
  }
  return Object.keys(errors).length ? { ok: false, errors } : { ok: true, value };
}

// ─────────────────────────────────────────────────────────────
// Veckoplanens kalender — datum som går att räkna ut, inte gissa.
//
// Möjligheterna under "På radarn" skrevs tidigare fritt av modellen.
// Den daterade "Höstlovet" till samma dag som planen skapades (höstlovet
// ligger vecka 44) och satte alla tre möjligheterna på samma datum.
// Ett datum kunden ser måste vara sant, så listan räknas fram här och
// modellen får bara VÄLJA ur den. Det den hittar på utöver listan
// sorteras bort av filterOpportunities.
//
// Ren modul: inga nätanrop, ingen Next-runtime. Testas i
// planCalendar.test.mts.
// ─────────────────────────────────────────────────────────────

export interface CalendarEntry {
  /** YYYY-MM-DD */
  date: string;
  title: string;
}

const DAY_MS = 86_400_000;

/** Ett datum som YYYY-MM-DD i Europe/Stockholm. Servern kör i UTC; en
 *  plan som skapas strax efter midnatt svensk tid ska räkna från rätt dag. */
export function stockholmIso(now: Date): string {
  return new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Europe/Stockholm", year: "numeric", month: "2-digit", day: "2-digit",
  }).format(now);
}

function iso(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function utc(y: number, m: number, d: number): Date {
  return new Date(Date.UTC(y, m - 1, d));
}

/** Påskdagen, gregoriansk (anonym algoritm). */
export function easterSunday(year: number): Date {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return utc(year, month, day);
}

const addDays = (d: Date, n: number) => new Date(d.getTime() + n * DAY_MS);

/** Första datumet från och med `from` som faller på veckodagen `weekday`
 *  (0 = söndag … 6 = lördag). */
function onOrAfter(from: Date, weekday: number): Date {
  return addDays(from, (weekday - from.getUTCDay() + 7) % 7);
}

/** Sista veckodagen `weekday` i månaden. */
function lastWeekdayOfMonth(year: number, month: number, weekday: number): Date {
  const last = utc(year, month + 1, 0);
  return addDays(last, -((last.getUTCDay() - weekday + 7) % 7));
}

/** Måndagen i ISO-vecka `week`. */
function isoWeekMonday(year: number, week: number): Date {
  const jan4 = utc(year, 1, 4);
  const mondayWeek1 = addDays(jan4, -((jan4.getUTCDay() + 6) % 7));
  return addDays(mondayWeek1, (week - 1) * 7);
}

/** Alla datum ett år som är värda att känna till för ett svenskt
 *  småföretag. Bara sådant som går att räkna ut exakt. Lov som skiljer
 *  sig mellan kommuner (sportlov, påsklov) är med flit utelämnade. */
export function swedishCalendar(year: number): CalendarEntry[] {
  const easter = easterSunday(year);
  const entries: Array<[Date, string]> = [
    [utc(year, 1, 1), "Nyårsdagen"],
    [utc(year, 1, 6), "Trettondedag jul"],
    [utc(year, 2, 14), "Alla hjärtans dag"],
    [lastWeekdayOfMonth(year, 3, 0), "Sommartid börjar – klockan ställs fram en timme"],
    [addDays(easter, -2), "Långfredagen"],
    [addDays(easter, -1), "Påskafton"],
    [easter, "Påskdagen"],
    [addDays(easter, 1), "Annandag påsk"],
    [utc(year, 4, 30), "Valborgsmässoafton"],
    [utc(year, 5, 1), "Första maj"],
    [addDays(easter, 39), "Kristi himmelsfärdsdag"],
    [lastWeekdayOfMonth(year, 5, 0), "Mors dag"],
    [addDays(easter, 49), "Pingstdagen"],
    [utc(year, 6, 6), "Sveriges nationaldag"],
    [onOrAfter(utc(year, 6, 19), 5), "Midsommarafton"],
    [lastWeekdayOfMonth(year, 10, 0), "Vintertid börjar – klockan ställs tillbaka en timme"],
    [isoWeekMonday(year, 44), "Höstlovet börjar (vecka 44 i de flesta kommuner)"],
    [utc(year, 10, 31), "Halloween"],
    [onOrAfter(utc(year, 10, 31), 6), "Alla helgons dag"],
    [utc(year, 11, 10), "Mårtensafton"],
    [addDays(onOrAfter(utc(year, 11, 1), 0), 7), "Fars dag"],
    [addDays(onOrAfter(utc(year, 11, 1), 4), 22), "Black Friday"],
    [onOrAfter(utc(year, 11, 27), 0), "Första advent"],
    [utc(year, 12, 13), "Lucia"],
    [utc(year, 12, 24), "Julafton"],
    [utc(year, 12, 31), "Nyårsafton"],
  ];
  return entries
    .map(([d, title]) => ({ date: iso(d), title }))
    .sort((a, b) => a.date.localeCompare(b.date));
}

/** Kalenderdatum från och med `todayIso` och `days` dagar framåt. */
export function upcomingCalendar(todayIso: string, days = 14): CalendarEntry[] {
  const [y] = todayIso.split("-").map(Number);
  const end = iso(addDays(new Date(`${todayIso}T00:00:00Z`), days));
  return [...swedishCalendar(y), ...swedishCalendar(y + 1)]
    .filter((e) => e.date >= todayIso && e.date <= end);
}

const WEEKDAYS = ["söndag", "måndag", "tisdag", "onsdag", "torsdag", "fredag", "lördag"];

/** Raden prompten får per datum: "2026-10-25 (söndag): Vintertid …". */
export function calendarLines(entries: CalendarEntry[]): string {
  if (entries.length === 0) return "(inga datum de närmaste två veckorna)";
  return entries.map((e) => {
    const wd = WEEKDAYS[new Date(`${e.date}T00:00:00Z`).getUTCDay()];
    return `- ${e.date} (${wd}): ${e.title}`;
  }).join("\n");
}

export interface Opportunity {
  title?: unknown;
  date?: unknown;
  relevance?: unknown;
  [k: string]: unknown;
}

const norm = (s: string) => s.toLowerCase().replace(/[^a-zåäö0-9 ]/g, " ").replace(/\s+/g, " ").trim();

/**
 * Behåller bara möjligheter vars datum står i listan, med listans titel.
 * Ett datum modellen hittat på försvinner hellre än att visas som sant.
 * Högst `max`, inga dubbletter.
 */
export function filterOpportunities(raw: unknown, allowed: CalendarEntry[], max = 3): Opportunity[] {
  if (!Array.isArray(raw)) return [];
  const out: Opportunity[] = [];
  const used = new Set<string>();
  for (const o of raw as Opportunity[]) {
    if (!o || typeof o !== "object" || typeof o.date !== "string") continue;
    const sameDay = allowed.filter((e) => e.date === (o.date as string).trim());
    if (sameDay.length === 0) continue;
    const t = typeof o.title === "string" ? norm(o.title) : "";
    const match = sameDay.find((e) => {
      const n = norm(e.title);
      const core = n.split(" ").slice(0, 2).join(" ");
      return t && (t.includes(core) || n.includes(t));
    }) ?? sameDay[0];
    const key = `${match.date}|${match.title}`;
    if (used.has(key)) continue;
    used.add(key);
    out.push({ ...o, date: match.date, title: match.title });
    if (out.length >= max) break;
  }
  return out;
}

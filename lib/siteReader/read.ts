// ─────────────────────────────────────────────────────────────
// Läser en sajt: robots.txt → sitemap → de viktigaste sidorna.
//
// Samma regler som produkttexternas hämtning (BESLUT.md): robots.txt
// följs, högst en sida per sekund per sajt (eller sajtens Crawl-delay),
// och allt går genom SSRF-skyddet i lib/server/ssrf.ts. URL:en kommer
// från användaren, så varje hopp kontrolleras.
// ─────────────────────────────────────────────────────────────
import { gunzipSync } from "node:zlib";
import { safeFetchWebsite, safeFetchBytes } from "@/lib/server/ssrf";
import { parseRobots, isAllowed, EMPTY_RULES, type RobotsRules } from "@/lib/server/robots";
import {
  sitemapsFromRobots, parseSitemap, rankSitemap, selectPages, linksFrom, extractPage,
  trimBoilerplate, type PageExtract,
} from "./pages";

const ROBOTS_AGENT = "marketingcopilotbot";
const MIN_DELAY_MS = 1000;
const MAX_CHILD_SITEMAPS = 4;
const MAX_SITEMAP_URLS = 5000;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export interface ReadSiteResult {
  root: string;
  pages: PageExtract[];
  /** Varför något inte gick, i klartext. Tom när allt gick bra. */
  notes: string[];
}

/** En normaliserad startadress, eller null. */
export function normalizeRoot(raw: string): string | null {
  const t = raw.trim();
  if (!t) return null;
  try {
    const u = new URL(/^https?:\/\//i.test(t) ? t : `https://${t}`);
    if (!/^https?:$/.test(u.protocol)) return null;
    return `${u.protocol}//${u.host}/`;
  } catch {
    return null;
  }
}

function sitemapText(body: Buffer): string {
  const gz = body.length > 2 && body[0] === 0x1f && body[1] === 0x8b;
  try {
    return (gz ? gunzipSync(body, { maxOutputLength: 20_000_000 }) : body).toString("utf8");
  } catch {
    return "";
  }
}

/**
 * Läser upp till `maxPages` sidor av sajten. Avbryter snällt när
 * `deadline` (epoch ms) passerats och returnerar det som hunnits läsas.
 */
export async function readSite(rawRoot: string, maxPages: number, deadline: number): Promise<ReadSiteResult> {
  const root = normalizeRoot(rawRoot);
  const notes: string[] = [];
  if (!root) return { root: rawRoot, pages: [], notes: ["Adressen gick inte att tolka."] };

  // Tempo: en förfrågan i taget, med paus emellan.
  let senast = 0;
  let delay = MIN_DELAY_MS;
  const vanta = async () => {
    const wait = senast + delay - Date.now();
    if (wait > 0) await sleep(wait);
    senast = Date.now();
  };
  const hinner = () => Date.now() + delay < deadline;

  // robots.txt
  let rules: RobotsRules = EMPTY_RULES;
  let sitemaps: string[] = [];
  await vanta();
  const robots = await safeFetchWebsite(`${root}robots.txt`);
  if (robots.ok) {
    rules = parseRobots(robots.html.slice(0, 500_000), ROBOTS_AGENT);
    sitemaps = sitemapsFromRobots(robots.html);
    if (rules.crawlDelayMs) delay = Math.max(MIN_DELAY_MS, Math.min(rules.crawlDelayMs, 10_000));
  }
  const tillaten = (path: string) => isAllowed(rules, path);

  // Sitemap: robots.txt först, annars standardplatserna.
  if (sitemaps.length === 0) sitemaps = [`${root}sitemap.xml`, `${root}sitemap_index.xml`];
  const urls: string[] = [];
  const kandidater = [...sitemaps];
  let oppnade = 0;
  while (kandidater.length && oppnade < MAX_CHILD_SITEMAPS + 2 && urls.length < MAX_SITEMAP_URLS && hinner()) {
    const sm = kandidater.shift()!;
    oppnade++;
    await vanta();
    const res = await safeFetchBytes(sm);
    if (!res.ok) continue;
    const parsed = parseSitemap(sitemapText(res.body));
    urls.push(...parsed.pages.slice(0, MAX_SITEMAP_URLS - urls.length));
    const barn = parsed.sitemaps
      .map((u) => ({ u, r: rankSitemap(u) }))
      .filter((x) => x.r >= 0)
      .sort((a, b) => b.r - a.r)
      .slice(0, MAX_CHILD_SITEMAPS)
      .map((x) => x.u);
    kandidater.unshift(...barn);
    if (parsed.pages.length && !parsed.sitemaps.length && kandidater.length === 0) break;
  }

  // Startsidan läses alltid. Utan sitemap blir dess länkar urvalet.
  const pages: PageExtract[] = [];
  await vanta();
  const start = await safeFetchWebsite(root);
  if (!start.ok) {
    notes.push(`${root}: ${start.error}`);
    return { root, pages, notes };
  }
  pages.push(extractPage(start.html, start.finalUrl));
  if (urls.length === 0) {
    urls.push(...linksFrom(start.html, start.finalUrl));
    notes.push(`${root}: ingen sitemap hittades, läste länkarna på startsidan.`);
  }

  // Startsidan är redan läst — även när sitemapen skriver den utan www.
  const utanWww = (u: string) => u.replace(/^https?:\/\/(www\.)?/i, "").replace(/\/$/, "");
  const lasta = new Set([utanWww(root), utanWww(start.finalUrl)]);
  const urval = selectPages(urls, root, maxPages, tillaten).filter((u) => !lasta.has(utanWww(u)));
  for (const url of urval) {
    if (pages.length >= maxPages || !hinner()) break;
    await vanta();
    const res = await safeFetchWebsite(url);
    if (!res.ok || lasta.has(utanWww(res.finalUrl))) continue;
    lasta.add(utanWww(res.finalUrl));
    pages.push(extractPage(res.html, res.finalUrl));
  }
  if (pages.length < Math.min(maxPages, urval.length + 1) && !hinner()) {
    notes.push(`${root}: hann läsa ${pages.length} sidor innan tiden tog slut.`);
  }
  return { root, pages: trimBoilerplate(pages), notes };
}

// ─────────────────────────────────────────────────────────────
// POST /api/product-texts/source
//
// Hämtar butikens egna produktsidor och lämnar tillbaka fakta att skriva
// ifrån: beskrivning, specifikationstabell, tillverkare, artikelnummer
// och dokument.
//
// Hämtningen sker här och inte i webbläsaren av tre skäl: CORS stoppar
// den i klienten, robots.txt måste läsas och följas, och URL:erna kommer
// ur en uppladdad fil och måste kontrolleras innan någon följer dem.
//
// TAKTEN ÄR MEDVETET LÅG. En sida i taget per värd, minst en sekund
// emellan, och sajtens egen Crawl-delay om den begärt en. Vi hämtar
// kundens egen butik — men en robot som hamrar blir en robot man
// blockerar, och då står hela funktionen still.
//
// Klienten cachar svaret i sitt arbetspass och frågar aldrig om samma
// artikel två gånger.
// ─────────────────────────────────────────────────────────────
import { lookup } from "node:dns/promises";
import { guardAiRequest, safeError } from "@/lib/server/guard";
import { parseHttpUrl, isPrivateAddress } from "@/lib/server/safeUrl";
import { parseRobots, isAllowed, EMPTY_RULES, type RobotsRules } from "@/lib/server/robots";
import { extractPageFacts, type PageResult } from "@/lib/productText/pageFacts";

export const runtime = "nodejs";
export const maxDuration = 60;

/** Så här många sidor per anrop. Klienten delar upp längre listor. */
export const MAX_SOURCE_BATCH = 10;

/** Vi säger vilka vi är. En robot som inte går att identifiera förtjänar att blockeras. */
const USER_AGENT = "MarketingCopilotBot/1.0 (+produkttexter; kontakta butiksägaren)";
/** Namnet vi letar efter i robots.txt, gement. */
const ROBOTS_AGENT = "marketingcopilotbot";

const FETCH_TIMEOUT_MS = 10_000;
/** Minsta paus mellan två hämtningar från samma värd. */
const MIN_DELAY_MS = 1_000;
/** Större sidor än så här är inte en produktsida. */
const MAX_BYTES = 1_500_000;
const MAX_REDIRECTS = 3;
/** Hur länge en robots.txt återanvänds. */
const ROBOTS_TTL_MS = 60 * 60 * 1_000;

/** Per instans, precis som rate limit-tabellen. Kallstart = ny cache, vilket
 *  betyder en extra robots.txt-hämtning, inte att reglerna kringgås. */
const robotsCache = new Map<string, { rules: RobotsRules; at: number }>();
const lastFetchAt = new Map<string, number>();

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Väntar tills det gått tillräckligt länge sedan förra hämtningen från värden. */
async function pace(origin: string, extraDelay: number): Promise<void> {
  const delay = Math.max(MIN_DELAY_MS, extraDelay);
  const previous = lastFetchAt.get(origin);
  if (previous !== undefined) {
    const wait = previous + delay - Date.now();
    if (wait > 0) await sleep(wait);
  }
  lastFetchAt.set(origin, Date.now());
}

/**
 * Kontrollerar att värdnamnet inte pekar inåt. Det finns ett teoretiskt
 * glapp mellan den här uppslagningen och själva hämtningen (DNS kan svara
 * annorlunda andra gången). Att täppa igen det kräver en egen socket-
 * hanterare; kontrollen här stoppar allt utom det angreppet, och URL:erna
 * kommer från användarens egen fil, inte från en främling.
 */
async function hostIsPublic(hostname: string): Promise<boolean> {
  try {
    const addresses = await lookup(hostname, { all: true });
    return addresses.length > 0 && addresses.every((a) => !isPrivateAddress(a.address));
  } catch {
    return false;
  }
}

/** Hämtar och cachar robots.txt för en origin. Går den inte att läsa: inga regler. */
async function robotsFor(origin: string): Promise<RobotsRules> {
  const cached = robotsCache.get(origin);
  if (cached && Date.now() - cached.at < ROBOTS_TTL_MS) return cached.rules;

  let rules = EMPTY_RULES;
  try {
    const res = await fetch(`${origin}/robots.txt`, {
      headers: { "User-Agent": USER_AGENT, Accept: "text/plain" },
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      redirect: "follow",
    });
    // 404 betyder att allt är tillåtet. 5xx betyder att vi inte vet — och då
    // låter vi bli att hämta, hellre än att anta att det är fritt fram.
    if (res.ok) {
      rules = parseRobots((await res.text()).slice(0, 500_000), ROBOTS_AGENT);
    } else if (res.status >= 500) {
      rules = { allow: [], disallow: ["/"], crawlDelayMs: null };
    }
  } catch {
    rules = { allow: [], disallow: ["/"], crawlDelayMs: null };
  }

  robotsCache.set(origin, { rules, at: Date.now() });
  return rules;
}

/**
 * Vilken teckenkodning sidan är skriven i. Svenska webbshoppar kör ofta
 * fortfarande ISO-8859-1; avkodar vi den som UTF-8 blir "mässing" till
 * "m?ssing" och hela underlaget blir oanvändbart. Okänd kodning faller
 * tillbaka på UTF-8, som är rätt i de allra flesta fall.
 */
function charsetOf(contentType: string, head: string): string {
  const fromHeader = contentType.match(/charset\s*=\s*["']?([\w-]+)/i)?.[1];
  // Saknas den i huvudet står den nästan alltid i en meta-tagg i sidans topp.
  const fromMeta =
    head.match(/<meta[^>]+charset\s*=\s*["']?([\w-]+)/i)?.[1] ??
    head.match(/<meta[^>]+content\s*=\s*["'][^"']*charset=([\w-]+)/i)?.[1];
  const raw = (fromHeader ?? fromMeta ?? "utf-8").toLowerCase();
  try {
    new TextDecoder(raw);
    return raw;
  } catch {
    return "utf-8";
  }
}

/** Läser svarskroppen upp till taket och avkodar den med sidans kodning. */
async function readCapped(res: Response, contentType: string): Promise<string> {
  const buffer = await readBytes(res);
  // Första kilobyten räcker för att hitta en meta-charset, och den biten är
  // ASCII i varje kodning vi bryr oss om.
  const head = new TextDecoder("latin1").decode(buffer.subarray(0, 2_048));
  return new TextDecoder(charsetOf(contentType, head)).decode(buffer);
}

/** Läser kroppen som bytes, med tak. */
async function readBytes(res: Response): Promise<Uint8Array> {
  const reader = res.body?.getReader();
  if (!reader) return new Uint8Array(await res.arrayBuffer()).subarray(0, MAX_BYTES);
  const chunks: Uint8Array[] = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
    size += value.byteLength;
    if (size >= MAX_BYTES) { await reader.cancel(); break; }
  }

  const out = new Uint8Array(Math.min(size, MAX_BYTES));
  let at = 0;
  for (const chunk of chunks) {
    if (at >= out.length) break;
    const slice = chunk.subarray(0, out.length - at);
    out.set(slice, at);
    at += slice.length;
  }
  return out;
}

/** Hämtar en sida med egna, kontrollerade omdirigeringar. */
async function fetchPage(startUrl: URL): Promise<{ html: string; finalUrl: string }> {
  let url = startUrl;
  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    if (!(await hostIsPublic(url.hostname))) throw new Error("private_host");

    const res = await fetch(url, {
      headers: { "User-Agent": USER_AGENT, Accept: "text/html,application/xhtml+xml" },
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      redirect: "manual",
    });

    if (res.status >= 300 && res.status < 400) {
      const location = res.headers.get("location");
      if (!location) throw new Error("bad_redirect");
      // Varje hopp kontrolleras på nytt — en omdirigering är en ny URL.
      const next = parseHttpUrl(new URL(location, url).toString());
      if (!next) throw new Error("bad_redirect");
      url = next;
      continue;
    }

    if (res.status === 404) throw new Error("not_found");
    if (!res.ok) throw new Error(`status_${res.status}`);

    const type = res.headers.get("content-type") ?? "";
    if (!/text\/html|application\/xhtml/i.test(type)) throw new Error("not_html");

    return { html: await readCapped(res, type), finalUrl: url.toString() };
  }
  throw new Error("too_many_redirects");
}

/** Översätter ett tekniskt fel till något som går att agera på. */
function reasonFor(error: unknown): string {
  const name = error instanceof Error ? error.message : "unknown";
  if (name === "private_host") return "Adressen pekar inte på en publik webbplats.";
  if (name === "not_found") return "Sidan finns inte längre (404).";
  if (name === "not_html") return "Adressen ledde inte till en webbsida.";
  if (name === "bad_redirect" || name === "too_many_redirects") return "Adressen ledde vidare för många gånger.";
  if (name === "TimeoutError" || name.includes("aborted")) return "Sidan svarade inte i tid.";
  if (name.startsWith("status_")) return `Sidan svarade ${name.slice(7)}.`;
  return "Sidan kunde inte hämtas.";
}

export async function POST(request: Request) {
  const requestId = crypto.randomUUID().slice(0, 8);

  const guarded = await guardAiRequest("product-text-sources");
  if (!guarded.ok) return guarded.response;
  const { guard } = guarded;

  try {
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      await guard.finish({ status: "error", errorCategory: "bad_json" });
      return safeError("Ogiltig förfrågan.", 400);
    }

    const raw = (body as Record<string, unknown> | null)?.urls;
    if (!Array.isArray(raw) || raw.length === 0 || raw.length > MAX_SOURCE_BATCH) {
      await guard.finish({ status: "error", errorCategory: "bad_urls" });
      return safeError(`Skicka mellan 1 och ${MAX_SOURCE_BATCH} adresser.`, 400);
    }

    const results: PageResult[] = [];
    for (const item of raw) {
      const original = typeof item === "string" ? item.trim().slice(0, 2_000) : "";
      const url = original ? parseHttpUrl(original) : null;

      if (!url) {
        results.push({ ok: false, url: original, reason: "Adressen går inte att använda." });
        continue;
      }

      try {
        const rules = await robotsFor(url.origin);
        if (!isAllowed(rules, url.pathname + url.search)) {
          results.push({ ok: false, url: original, reason: "robots.txt tillåter inte att sidan hämtas." });
          continue;
        }

        await pace(url.origin, rules.crawlDelayMs ?? 0);
        const { html, finalUrl } = await fetchPage(url);
        results.push({ ok: true, ...extractPageFacts(html, finalUrl) });
      } catch (error) {
        results.push({ ok: false, url: original, reason: reasonFor(error) });
      }
    }

    await guard.finish({ status: "ok", model: null });
    return Response.json({ results });
  } catch (error) {
    const name = error instanceof Error ? error.name : "UnknownError";
    console.error(`PRODUCT_TEXT_SOURCES ${requestId}: ${name}`);
    await guard.finish({ status: "error", errorCategory: name });
    return safeError("Kunde inte hämta produktsidorna just nu.", 500);
  }
}

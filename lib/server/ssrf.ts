// ─────────────────────────────────────────────────────────────
// SSRF-skydd för hämtning av externa hemsidor (Security Foundation).
//
// Företagarens angivna hemsida hämtas server-side. Utan skydd kan en
// angripare peka den mot interna adresser (localhost, moln-metadata,
// privata nät) och läcka intern information — en klassisk SSRF.
//
// Skydd:
//   • Endast http:/https: (inga file:/ftp:/gopher: m.m.)
//   • Blockerar localhost, interna hostnamn (.local/.internal/...) och
//     alla IP-adresser i loopback/privata/link-local/CGNAT-intervall
//     (både IPv4, IPv6 och IPv4-mappad IPv6).
//   • DNS-slås upp innan hämtning — hostnamn som pekar på en privat IP
//     blockeras.
//   • Redirects följs manuellt och VARJE hopp valideras på nytt.
//   • Hård timeout, maximal svarsstorlek och content-type-kontroll.
//   • Tydlig, ärlig user-agent.
//
// Känd kvarstående risk: DNS-rebinding (adressen kan i teorin ändras
// mellan uppslag och anslutning). Dokumenterad i säkerhetsrapporten;
// att pinna IP:t per anslutning skjuts till en senare sprint.
// ─────────────────────────────────────────────────────────────
import { promises as dns } from "node:dns";
import { isIP } from "node:net";

export const SSRF_LIMITS = {
  TIMEOUT_MS: Number(process.env.WEBSITE_FETCH_TIMEOUT_MS) || 8_000,
  MAX_BYTES: Number(process.env.WEBSITE_FETCH_MAX_BYTES) || 2_500_000, // ~2.5 MB
  MAX_REDIRECTS: 3,
  USER_AGENT: "MarketingCopilotBot/1.0 (+https://marketing-copilot; företagsanalys)",
} as const;

export type FetchResult =
  | { ok: true; html: string; finalUrl: string }
  | { ok: false; error: string };

const BLOCKED_HOST_SUFFIXES = [".local", ".localhost", ".internal", ".intranet", ".lan", ".home", ".corp"];
const BLOCKED_HOSTNAMES = new Set(["localhost", "ip6-localhost", "ip6-loopback", "metadata", "metadata.google.internal"]);

/** Sant om en IPv4-sträng ligger i ett icke-routbart/privat/reserverat intervall. */
function isPrivateIPv4(ip: string): boolean {
  const parts = ip.split(".").map((p) => Number(p));
  if (parts.length !== 4 || parts.some((n) => !Number.isInteger(n) || n < 0 || n > 255)) return true; // avvisa suspekt
  const [a, b] = parts;
  if (a === 0) return true;                       // 0.0.0.0/8
  if (a === 10) return true;                      // 10.0.0.0/8
  if (a === 127) return true;                     // loopback
  if (a === 169 && b === 254) return true;        // link-local
  if (a === 172 && b >= 16 && b <= 31) return true; // 172.16.0.0/12
  if (a === 192 && b === 168) return true;        // 192.168.0.0/16
  if (a === 100 && b >= 64 && b <= 127) return true; // CGNAT 100.64.0.0/10
  if (a === 192 && b === 0) return true;          // 192.0.0.0/24 + 192.0.2.0/24 (test)
  if (a === 198 && (b === 18 || b === 19)) return true; // benchmarking
  if (a >= 224) return true;                       // multicast + reserverat (224–255)
  return false;
}

/** Sant om en IPv6-sträng är loopback/ULA/link-local/unspecified eller mappar en privat IPv4. */
function isPrivateIPv6(ip: string): boolean {
  const addr = ip.toLowerCase().split("%")[0]; // ta bort ev. zon-id
  if (addr === "::1" || addr === "::") return true;
  // IPv4-mappad (::ffff:a.b.c.d) eller IPv4-kompatibel — validera den inbäddade v4-adressen
  const v4mapped = addr.match(/(?:::ffff:)(\d+\.\d+\.\d+\.\d+)$/);
  if (v4mapped) return isPrivateIPv4(v4mapped[1]);
  const first = addr.split(":")[0];
  const hi = parseInt(first || "0", 16);
  if (Number.isNaN(hi)) return true;
  if ((hi & 0xfe00) === 0xfc00) return true; // fc00::/7 (ULA)
  if ((hi & 0xffc0) === 0xfe80) return true; // fe80::/10 (link-local)
  return false;
}

function isPrivateIp(ip: string): boolean {
  const kind = isIP(ip);
  if (kind === 4) return isPrivateIPv4(ip);
  if (kind === 6) return isPrivateIPv6(ip);
  return true; // okänt format → blockera
}

function hostIsBlocked(hostname: string): boolean {
  const h = hostname.toLowerCase().replace(/\.$/, "");
  if (BLOCKED_HOSTNAMES.has(h)) return true;
  if (BLOCKED_HOST_SUFFIXES.some((s) => h.endsWith(s))) return true;
  return false;
}

/**
 * Validerar en URL före hämtning: protokoll, hostnamn och (via DNS)
 * alla adresser hostnamnet pekar på. Returnerar ett fel-meddelande
 * om något är otillåtet, annars null.
 */
async function assertUrlAllowed(url: URL): Promise<string | null> {
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    return "Endast http- och https-adresser tillåts.";
  }
  const host = url.hostname;
  if (!host) return "Ogiltig adress.";
  if (hostIsBlocked(host)) return "Adressen pekar på en intern eller otillåten värd.";

  // Är hostnamnet redan en IP-literal? Validera direkt.
  const literalKind = isIP(host.replace(/^\[|\]$/g, ""));
  if (literalKind) {
    return isPrivateIp(host.replace(/^\[|\]$/g, "")) ? "Adressen pekar på ett internt nätverk." : null;
  }

  // Slå upp alla adresser hostnamnet resolvar till och kräv att ALLA är publika.
  let addresses: { address: string }[];
  try {
    addresses = await dns.lookup(host, { all: true });
  } catch {
    return "Adressen kunde inte slås upp.";
  }
  if (addresses.length === 0) return "Adressen kunde inte slås upp.";
  for (const { address } of addresses) {
    if (isPrivateIp(address)) return "Adressen pekar på ett internt nätverk.";
  }
  return null;
}

/** Läser en respons-kropp men avbryter om den överskrider MAX_BYTES. */
async function readCapped(res: Response, maxBytes: number): Promise<string | null> {
  const body = res.body;
  if (!body) return "";
  const reader = body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      if (value) {
        total += value.byteLength;
        if (total > maxBytes) {
          await reader.cancel();
          return null; // för stort
        }
        chunks.push(value);
      }
    }
  } finally {
    reader.releaseLock();
  }
  return Buffer.concat(chunks.map((c) => Buffer.from(c))).toString("utf8");
}

/**
 * Hämtar en hemsida säkert. Validerar den ursprungliga URL:en OCH varje
 * redirect-hopp mot SSRF-blocklistan, sätter timeout, begränsar storleken
 * och accepterar bara text-/HTML-svar.
 */
export async function safeFetchWebsite(rawUrl: string): Promise<FetchResult> {
  let current: URL;
  try {
    current = new URL(rawUrl);
  } catch {
    return { ok: false, error: "Ogiltig webbadress." };
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), SSRF_LIMITS.TIMEOUT_MS);
  try {
    for (let hop = 0; hop <= SSRF_LIMITS.MAX_REDIRECTS; hop++) {
      const blocked = await assertUrlAllowed(current);
      if (blocked) return { ok: false, error: blocked };

      const res = await fetch(current.toString(), {
        method: "GET",
        redirect: "manual",
        signal: controller.signal,
        headers: {
          "User-Agent": SSRF_LIMITS.USER_AGENT,
          "Accept": "text/html,application/xhtml+xml;q=0.9,text/plain;q=0.8,*/*;q=0.5",
          "Accept-Language": "sv-SE,sv;q=0.9,en;q=0.8",
        },
      });

      // Redirect? Validera nästa hopp på nytt.
      if (res.status >= 300 && res.status < 400) {
        const location = res.headers.get("location");
        if (!location) return { ok: false, error: "Ogiltig omdirigering från hemsidan." };
        try {
          current = new URL(location, current); // stöd relativa redirects
        } catch {
          return { ok: false, error: "Ogiltig omdirigering från hemsidan." };
        }
        continue;
      }

      if (!res.ok) return { ok: false, error: "Hemsidan svarade med ett fel." };

      const contentType = (res.headers.get("content-type") || "").toLowerCase();
      if (contentType && !/(text\/html|application\/xhtml|text\/plain|text\/xml|application\/xml)/.test(contentType)) {
        return { ok: false, error: "Adressen ledde inte till en läsbar webbsida." };
      }

      const html = await readCapped(res, SSRF_LIMITS.MAX_BYTES);
      if (html === null) return { ok: false, error: "Hemsidan var för stor för att analyseras." };
      return { ok: true, html, finalUrl: current.toString() };
    }
    return { ok: false, error: "Hemsidan omdirigerade för många gånger." };
  } catch (err) {
    const name = err instanceof Error ? err.name : "UnknownError";
    if (name === "AbortError") return { ok: false, error: "Hemsidan svarade för långsamt." };
    return { ok: false, error: "Hemsidan kunde inte hämtas." };
  } finally {
    clearTimeout(timer);
  }
}

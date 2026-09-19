// ─────────────────────────────────────────────────────────────
// Skydd mot att servern luras hämta fel saker (SSRF).
//
// URL:erna kommer ur en CSV som användaren laddat upp. En rad som pekar
// på http://169.254.169.254/ eller http://localhost:5432/ skulle få vår
// server att hämta från sitt eget nät och lämna svaret vidare. Därför:
// bara http och https, bara vanliga portar, och aldrig en adress som
// pekar inåt.
//
// Ren logik, ingen DNS. Uppslagningen görs av anroparen, som kör varje
// svarsadress genom `isPrivateAddress` innan den hämtar.
//
// Testas i lib/productText/source.test.mts.
// ─────────────────────────────────────────────────────────────

/** Portar vi hämtar från. Allt annat är nästan alltid en intern tjänst. */
const ALLOWED_PORTS = new Set(["", "80", "443"]);

/** Värdnamn som alltid pekar på maskinen själv eller ett internt nät. */
const BLOCKED_SUFFIXES = [".local", ".internal", ".localhost", ".home.arpa"];
const BLOCKED_NAMES = new Set(["localhost", "ip6-localhost", "ip6-loopback"]);

/**
 * Tolkar och godkänner en URL för hämtning. Returnerar `null` när något
 * inte stämmer — anroparen ska då hoppa över raden, inte försöka laga den.
 */
export function parseHttpUrl(raw: string): URL | null {
  let url: URL;
  try {
    url = new URL((raw ?? "").trim());
  } catch {
    return null;
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") return null;
  // Inloggningsuppgifter i URL:en är antingen ett misstag eller ett försök.
  if (url.username || url.password) return null;
  if (!ALLOWED_PORTS.has(url.port)) return null;
  if (isBlockedHostname(url.hostname)) return null;
  return url;
}

/** Sant för värdnamn vi vägrar slå upp över huvud taget. */
export function isBlockedHostname(hostname: string): boolean {
  const h = (hostname ?? "").toLowerCase().replace(/\.$/, "");
  if (!h) return true;
  if (BLOCKED_NAMES.has(h)) return true;
  if (BLOCKED_SUFFIXES.some((s) => h.endsWith(s))) return true;
  // IPv6 skrivs inom hakparenteser i en URL.
  const bare = h.startsWith("[") && h.endsWith("]") ? h.slice(1, -1) : h;
  if (looksLikeIp(bare)) return isPrivateAddress(bare);
  return false;
}

const looksLikeIp = (v: string): boolean => /^[0-9.]+$/.test(v) || v.includes(":");

/**
 * Sant för adresser som pekar inåt: loopback, privata nät, link-local
 * (inklusive molnens metadatatjänst på 169.254.169.254), CGNAT och
 * IPv6-motsvarigheterna.
 */
export function isPrivateAddress(address: string): boolean {
  const a = (address ?? "").trim().toLowerCase();
  if (!a) return true;

  if (a.includes(":")) {
    // IPv4 inbäddad i IPv6, t.ex. ::ffff:127.0.0.1 — bedöm IPv4-delen.
    const embedded = a.match(/(\d+\.\d+\.\d+\.\d+)$/);
    if (embedded) return isPrivateAddress(embedded[1]);
    if (a === "::" || a === "::1") return true;
    // fc00::/7 (unique local), fe80::/10 (link-local).
    if (/^f[cd]/.test(a)) return true;
    if (/^fe[89ab]/.test(a)) return true;
    return false;
  }

  const parts = a.split(".");
  if (parts.length !== 4) return true; // Inte en adress vi kan bedöma — neka.
  const n = parts.map(Number);
  if (n.some((x) => !Number.isInteger(x) || x < 0 || x > 255)) return true;
  const [a0, a1] = n;

  if (a0 === 0 || a0 === 10 || a0 === 127) return true;
  if (a0 === 169 && a1 === 254) return true;          // link-local + metadata
  if (a0 === 172 && a1 >= 16 && a1 <= 31) return true; // 172.16/12
  if (a0 === 192 && a1 === 168) return true;
  if (a0 === 192 && a1 === 0) return true;             // 192.0.0/24, 192.0.2/24
  if (a0 === 100 && a1 >= 64 && a1 <= 127) return true; // CGNAT
  if (a0 >= 224) return true;                          // multicast + reserverat
  return false;
}

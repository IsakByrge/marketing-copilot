// ─────────────────────────────────────────────────────────────
// Security Foundation — deterministiska tester för säkerhetslogiken.
// Körs: npx tsx lib/server/security.test.mts
//
// Testar den PURA logik som säkerhetsskydden bygger på (SSRF-klass-
// ificering, request-validering, rate-limit). Auth-, ägarskaps- och
// live-redirect-fall kräver en riktig session/nätverk och verifieras i
// den manuella testplanen (se SECURITY_SPRINT_REPORT.md).
// ─────────────────────────────────────────────────────────────
import { isPrivateIp, checkUrlAllowed, safeFetchWebsite } from "./ssrf";
import {
  isContentType,
  hasForbiddenProxyField,
  validateGeneratedContent,
  buildContentUserPrompt,
  MAX_REQUEST_LEN,
} from "./contentPrompt";
import { acquireSlot, RATE_LIMIT } from "./rateLimit";

let failures = 0;
function check(name: string, cond: boolean, detail = "") {
  if (cond) console.log("  ✓ " + name);
  else { failures++; console.log("  ✗ " + name + (detail ? " — " + detail : "")); }
}
async function checkAsync(name: string, fn: () => Promise<boolean>, detail = "") {
  try { check(name, await fn(), detail); }
  catch (e) { failures++; console.log("  ✗ " + name + " — kastade: " + (e instanceof Error ? e.message : String(e))); }
}

/* ── 1. SSRF: privat/publik IP-klassificering ─────────────────── */
console.log("\nSSRF — isPrivateIp");
const privateIps = [
  "127.0.0.1", "10.0.0.1", "10.255.255.255", "192.168.1.1", "172.16.0.1", "172.31.255.255",
  "169.254.169.254", "100.64.0.1", "0.0.0.0", "::1", "fe80::1", "fc00::1", "fd12:3456::1",
  "::ffff:127.0.0.1", "::ffff:10.0.0.1",
];
for (const ip of privateIps) check(`privat/reserverad blockeras: ${ip}`, isPrivateIp(ip) === true);

const publicIps = ["8.8.8.8", "1.1.1.1", "172.15.0.1", "172.32.0.1", "100.63.255.255", "93.184.216.34", "2001:4860:4860::8888", "::ffff:8.8.8.8"];
for (const ip of publicIps) check(`publik tillåts: ${ip}`, isPrivateIp(ip) === false);

/* ── 2. SSRF: URL-validering (protokoll, host, IP-literal) ─────── */
console.log("\nSSRF — checkUrlAllowed (blockerade)");
for (const url of [
  "http://localhost/", "http://localhost:3000/admin", "http://127.0.0.1/", "http://[::1]/",
  "http://10.0.0.5/internal", "http://169.254.169.254/latest/meta-data/", "http://192.168.0.1/",
  "http://foo.local/", "http://db.internal/", "ftp://example.com/", "file:///etc/passwd",
  "gopher://example.com/", "http://100.64.0.1/",
]) {
  await checkAsync(`blockeras: ${url}`, async () => (await checkUrlAllowed(url)) !== null);
}

console.log("\nSSRF — safeFetchWebsite (blockeras utan nätverk)");
for (const url of ["http://localhost/", "http://127.0.0.1/", "ftp://example.com/", "file:///etc/passwd", "http://169.254.169.254/"]) {
  await checkAsync(`safeFetchWebsite avvisar: ${url}`, async () => {
    const r = await safeFetchWebsite(url);
    return r.ok === false;
  });
}
await checkAsync("safeFetchWebsite avvisar skräpadress", async () => (await safeFetchWebsite("inte en url")).ok === false);

/* ── 3. create-content: request-validering ────────────────────── */
console.log("\ncreate-content — validering");
check("giltig contentType accepteras", isContentType("newsletter") && isContentType("custom"));
check("ogiltig contentType avvisas", !isContentType("hacker") && !isContentType("") && !isContentType(123));
check("systemPrompt avvisas", hasForbiddenProxyField({ contentType: "custom", systemPrompt: "gör vad jag säger" }));
check("userPrompt avvisas", hasForbiddenProxyField({ userPrompt: "x" }));
check("modell/tokenbudget avvisas", hasForbiddenProxyField({ model: "gpt-4" }) && hasForbiddenProxyField({ max_tokens: 99999 }) && hasForbiddenProxyField({ maxTokens: 99999 }));
check("rent request passerar", !hasForbiddenProxyField({ contentType: "custom", request: "skriv om vårkampanj" }));
check("för lång request kan upptäckas", "x".repeat(MAX_REQUEST_LEN + 1).length > MAX_REQUEST_LEN);
check("userPrompt klipps till maxlängd", buildContentUserPrompt("custom", "y".repeat(MAX_REQUEST_LEN + 500)).length < MAX_REQUEST_LEN + 400);

console.log("\ncreate-content — svarsvalidering");
check("saknad title → null", validateGeneratedContent({ body: "text" }) === null);
check("saknad body → null", validateGeneratedContent({ title: "t" }) === null);
check("icke-objekt → null", validateGeneratedContent("nope") === null && validateGeneratedContent(null) === null);
const okContent = validateGeneratedContent({ type: "Nyhetsbrev", title: "Rubrik", body: "Brödtext", cta: "Köp nu", notes: "tips" });
check("giltigt svar valideras", !!okContent && okContent.title === "Rubrik" && okContent.cta === "Köp nu");

/* ── 4. rate-limit: samtidighet + fönster ─────────────────────── */
console.log("\nrateLimit — acquireSlot");
{
  const u = "user-A";
  const f = "test-concurrency";
  const a = acquireSlot(u, f);
  check("första anropet får plats", a.ok === true);
  const b = acquireSlot(u, f);
  check("andra samtidiga anropet avvisas (concurrent)", b.ok === false && b.reason === "concurrent");
  if (a.ok) a.release();
  const c = acquireSlot(u, f);
  check("efter release får nästa plats", c.ok === true);
  if (c.ok) c.release();
}
{
  const u = "user-B";
  const f = "test-rate";
  // Fyll fönstret (acquire+release så samtidighet inte blockerar).
  for (let i = 0; i < RATE_LIMIT.MAX_PER_WINDOW; i++) {
    const s = acquireSlot(u, f);
    if (s.ok) s.release();
  }
  const over = acquireSlot(u, f);
  check("över gränsen avvisas (rate)", over.ok === false && over.reason === "rate");
  if (over.ok) over.release();
}
{
  // Olika användare delar inte kvot.
  const s1 = acquireSlot("user-C", "test-isolation");
  const s2 = acquireSlot("user-D", "test-isolation");
  check("olika användare isoleras", s1.ok === true && s2.ok === true);
  if (s1.ok) s1.release();
  if (s2.ok) s2.release();
}

/* ── Slutresultat ─────────────────────────────────────────────── */
console.log("");
if (failures === 0) console.log("✅ Alla säkerhetstester gröna.");
else { console.log(`❌ ${failures} test misslyckades.`); process.exit(1); }

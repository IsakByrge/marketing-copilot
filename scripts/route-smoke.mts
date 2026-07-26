// ─────────────────────────────────────────────────────────────
// Route smoke-test. Hits every user-facing route against a running
// server and asserts none of them 5xx / crash. Public routes must
// answer 2xx; protected routes must either answer 2xx (authenticated
// session) or redirect (3xx) to /login (unauthenticated) — never 5xx.
//
// Usage:
//   1. npm run build && npm run start   (in one shell)
//   2. BASE_URL=http://localhost:3000 npm run smoke   (in another)
//
// BASE_URL defaults to http://localhost:3000 so it also works against
// a Vercel Preview URL: BASE_URL=https://<preview> npm run smoke
// This script does NOT manage the server or require a database — it is
// a black-box reachability check, safe to run in CI or against Preview.
// ─────────────────────────────────────────────────────────────

const BASE_URL = (process.env.BASE_URL ?? "http://localhost:3000").replace(/\/$/, "");

// Public routes — must answer 2xx without an authenticated session.
const PUBLIC_ROUTES = ["/", "/login", "/auth/callback"];

// Protected routes (see proxy.ts). Unauthenticated → redirect to /login.
const PROTECTED_ROUTES = [
  "/dashboard",
  "/campaign-builder",
  "/campaigns",
  "/content",
  "/content/facebook",
  "/company",
  "/history",
  "/onboarding",
  "/profile",
  "/create",
  "/newsletter",
  "/campaign",
  "/plan",
  "/generating",
];

type Result = { route: string; status: number | string; ok: boolean; note: string };

async function check(route: string, kind: "public" | "protected"): Promise<Result> {
  const url = `${BASE_URL}${route}`;
  try {
    const res = await fetch(url, { redirect: "manual", headers: { "user-agent": "route-smoke" } });
    const status = res.status;
    const location = res.headers.get("location") ?? "";

    if (status >= 500) {
      return { route, status, ok: false, note: "server error" };
    }
    if (kind === "public") {
      const ok = status >= 200 && status < 400;
      return { route, status, ok, note: ok ? "public reachable" : "expected 2xx/3xx" };
    }
    // protected: 2xx (has session) or 3xx→/login (no session) are both fine.
    const redirects = status >= 300 && status < 400;
    if (redirects) {
      const toLogin = location.includes("/login");
      return { route, status, ok: toLogin, note: toLogin ? "→ /login" : `redirect → ${location}` };
    }
    const ok = status >= 200 && status < 300;
    return { route, status, ok, note: ok ? "authenticated 2xx" : `unexpected ${status}` };
  } catch (err) {
    return { route, status: "ERR", ok: false, note: (err as Error).message };
  }
}

async function main() {
  console.log(`Route smoke-test against ${BASE_URL}\n`);
  const results: Result[] = [];
  for (const r of PUBLIC_ROUTES) results.push(await check(r, "public"));
  for (const r of PROTECTED_ROUTES) results.push(await check(r, "protected"));

  const pad = Math.max(...results.map(r => r.route.length));
  for (const r of results) {
    const mark = r.ok ? "✓" : "✗";
    console.log(`  ${mark} ${r.route.padEnd(pad)}  ${String(r.status).padEnd(4)} ${r.note}`);
  }

  const failed = results.filter(r => !r.ok);
  console.log("");
  if (failed.length > 0) {
    console.error(`✗ ${failed.length}/${results.length} route(s) failed the smoke-test.`);
    process.exit(1);
  }
  console.log(`✓ All ${results.length} routes passed the smoke-test.`);
}

main();

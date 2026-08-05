# 01 — Repository Overview

> **Audit snapshot:** branch `main`, generated 2026-07-27. This is a **read-only** audit — no
> source code was modified, no dependencies installed, no migrations run.

Marketing Copilot is a **Swedish-language AI marketing assistant** for small businesses. A signed-in
user can build a structured "Company Brain", generate a weekly marketing plan, run a 4-phase
Marketing Strategist, produce Facebook posts via a "Facebook Specialist" engine, create standalone
content in seven formats, and generate/edit images.

At the point of this audit, `main` contains **two foundation sprints already merged**:

1. **Security Foundation** — server-side auth on every AI route, SSRF hardening, rate limiting,
   AI usage logging, and the closing of the previously-open AI proxy (`lib/server/*`, migration `0003`).
2. **Design System Foundation** — a **new, dormant** light "emerald" design system (tokens in
   `globals.css` + primitives in `app/_shared/primitives.tsx` + Geist font) layered additively on
   top of the existing dark "Mission Control" UI. Nothing renders the emerald primitives yet;
   adoption is planned page-by-page in later sprints.

---

## Technology stack

| Concern | Choice | Version / detail |
|---|---|---|
| **Framework** | Next.js (App Router, Turbopack) | `16.2.7` |
| **Language** | TypeScript | `^5` (strict; `tsc --noEmit` clean) |
| **UI runtime** | React / React DOM | `19.2.4` |
| **Package manager** | npm | lockfile `package-lock.json`, lockfileVersion 3 |
| **Styling** | Tailwind CSS v4 (`@tailwindcss/postcss`) | `^4` — used by the new emerald primitives; legacy/frozen UI still uses inline `style` objects |
| **Fonts** | `next/font/google` | Geist (design system), Outfit (legacy sans), Cormorant Garamond (legacy serif) |
| **Database / BaaS** | Supabase (Postgres + Auth) | `@supabase/ssr ^0.12.0`, `@supabase/supabase-js ^2.108.1` |
| **Authentication** | Supabase Auth (email + password), cookie sessions | via `@supabase/ssr` |
| **AI provider** | OpenAI (Chat Completions + Images) | `openai ^6.42.0` |
| **Hosting** | Vercel (serverless functions + Middleware/Proxy) | inferred from config + memory |
| **Lint** | ESLint 9 + `eslint-config-next` | `^9` |
| **Tests** | Standalone `tsx` harnesses (no test runner) | `tsx ^4.23.1` |

### `package.json` scripts

| Script | Command | Purpose |
|---|---|---|
| `dev` | `next dev` | Local dev server |
| `build` | `next build` | Production build |
| `start` | `next start` | Serve production build |
| `lint` | `eslint` | Lint |
| `typecheck` | `tsc --noEmit` | Type check |
| `smoke` | `tsx scripts/route-smoke.mts` | Route smoke test (public 200 / protected 307→/login) |
| `test:prefill` | `tsx scripts/strategyPrefill.integration.mts` | Strategy-prefill integration test |
| `test:strategist` | `tsx lib/strategist/strategist.test.mts` | Strategist mapping/validation tests |
| `test:security` | `tsx lib/server/security.test.mts` | SSRF / request-validation / rate-limit tests |

---

## Authentication & session model

- **Supabase Auth** with email + password. Login/registration on `/login`.
- Sessions are **cookie-based** via `@supabase/ssr`. Three Supabase clients exist:
  - `lib/supabase-browser.ts` — RLS-scoped browser client (client components read/write directly).
  - `lib/supabase-server.ts` — server client bound to `next/headers` cookies (server-only).
  - `lib/supabase.ts` — anon client without a session (**legacy**, see tech debt).
- **Route protection** is enforced by `proxy.ts` (Next.js 16 Proxy / Middleware). Unauthenticated
  requests to protected paths are redirected to `/login`; a logged-in user hitting `/login` is sent
  to `/auth/callback`, which routes to `/onboarding` (no company yet) or `/dashboard`.
- **AI routes** additionally derive identity **server-side from the session** (`getAuthedUser()` in
  `lib/server/auth.ts`) and return 401 when unauthenticated — they no longer trust client-supplied IDs.

---

## Routing structure

Next.js **App Router** under `app/`. All pages are `"use client"` (there are effectively no React
Server Components). Route protection is centralised in `proxy.ts`.

- **18 page routes** (17 static `○` + 1 dynamic `ƒ` for `/post/[id]`).
- **10 API route handlers** under `app/api/**` (all dynamic `ƒ`).
- **1 Middleware/Proxy** (`proxy.ts`).

See `03_ROUTES.md` for the full route inventory and status.

---

## App structure

```
app/
  _shared/          Shared UI + client hooks (two design systems live here)
  api/              Route handlers (server): strategist/, content/facebook, images, plan, ...
  campaign-builder/ Marketing Strategist 2.0 UI (+ dead v1 modules)
  content/facebook/ Facebook Specialist UI
  <page dirs>/      dashboard, company, campaigns, content, history, create, plan, ...
lib/
  strategist/       Strategist engine (types, prompts, validate, adapter, ...)
  facebook/         Facebook Specialist engine (specialist, quality, context, prefill)
  server/           Security layer (auth, ai, ssrf, rateLimit, usage, guard, contentPrompt)
  supabase*.ts      Three Supabase clients
supabase/migrations/  0001, 0002, 0003 (additive; run manually)
scripts/            route-smoke, strategyPrefill integration test
proxy.ts            Route protection
```

Notably there are **no top-level `components/`, `hooks/`, or `types/` folders** — shared components
and hooks live in `app/_shared/`, and types live next to their domain (`lib/strategist/types.ts`,
`app/content/facebook/types.ts`). See `02_ARCHITECTURE.md`.

---

## Component structure

Two component layers coexist in `app/_shared/`:

| Layer | File | Status |
|---|---|---|
| **Mission Control (dark)** — active | `ui.tsx`, `Shell.tsx`, `theme.ts`, `icons.tsx` | Used by 7 newer pages + migrated quick-flows |
| **Emerald (light)** — dormant | `primitives.tsx` + tokens in `globals.css` | Built, tested, **not yet rendered anywhere** |

Full inventory in `04_COMPONENTS.md`; design-token evaluation in `05_DESIGN_SYSTEM.md`.

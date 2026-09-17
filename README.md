# Marketing Copilot

A Swedish-language AI marketing assistant for small businesses. A signed-in user builds a structured
**Company Brain**, generates a weekly marketing plan, runs the 4-phase **Marketing Strategist**,
produces Facebook posts via the **Facebook Specialist** engine, creates standalone content in seven
formats, and generates/edits images — all backed by their own company knowledge.

This README is the technical entry point for developers. Product/architecture write-ups live under
[Documentation](#documentation).

---

## Tech stack

| Concern | Choice |
|---|---|
| Framework | Next.js **16** (App Router, Turbopack) |
| Language | TypeScript (strict) |
| UI | React 19 |
| Styling | Tailwind CSS v4 (emerald design-system tokens); legacy pages use inline styles |
| Auth + DB | Supabase (Postgres + Auth, RLS) via `@supabase/ssr` |
| AI | OpenAI (Chat Completions + Images) via `openai` |
| Hosting | Vercel (serverless + Middleware/Proxy) |
| Package manager | npm (lockfile committed) |
| Node | **20 or 24** (CI runs 24; developed on 24.15.0) |

> ⚠ **Next.js 16 has breaking changes vs. earlier versions.** Before writing Next-specific code
> (routing, middleware/`proxy.ts`, config, server components), read the locally installed docs under
> `node_modules/next/dist/docs/` — see `AGENTS.md`.

---

## Local setup

```bash
# 1. Install dependencies (exact, from the lockfile)
npm ci

# 2. Configure environment
cp .env.example .env.local
#   then fill in real values in .env.local (see "Environment variables" below)

# 3. Run the dev server
npm run dev
# → http://localhost:3000
```

### Environment variables

All variables are documented in **`.env.example`** (names, placeholders, required/optional,
public/server-only). `.env.local` is gitignored; never commit real secrets.

Minimum to run:

| Variable | Purpose | Scope |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL | public |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon key (RLS-scoped) | public |
| `OPENAI_API_KEY` | OpenAI model + image calls | server-only |

Optional model/timeout/rate-limit/SSRF tuning vars have safe code defaults — see `.env.example`.

### Supabase configuration

1. Create a Supabase project; copy its URL + anon key into `.env.local`.
2. Apply the SQL migrations **in order** in the Supabase **SQL Editor** (the app does not run
   migrations). See [migration order](#database--migrations).
3. Confirm Row Level Security is enabled with the intended policies — see
   `docs/engineering/DATABASE_VERIFICATION.md`.

---

## Database & migrations

Migrations live in `supabase/migrations/` and are applied **manually, in ascending order**:

| Order | File | Adds |
|---|---|---|
| 0000 | `0000_baseline.sql` | base tables `companies`, `plans`, `content_feedback` (+ RLS) |
| 0001 | `0001_add_company_brain.sql` | `companies.company_brain` (JSONB) |
| 0002 | `0002_add_content_engine.sql` | `campaign_strategies`, `content_drafts` |
| 0003 | `0003_add_ai_usage_events.sql` | `ai_usage_events` |

All migrations are idempotent (`IF NOT EXISTS` + `DROP/CREATE POLICY`) and non-destructive. Full
verification and recovery guidance: **`docs/engineering/DATABASE_VERIFICATION.md`**.

> **Destructive migrations require explicit approval.** No `drop`/`truncate`/data-mutating SQL may be
> run against a shared or production database without sign-off from the repo owner.

---

## Commands

### Development

| Command | What it does |
|---|---|
| `npm run dev` | Start the dev server |
| `npm run build` | Production build |
| `npm run start` | Serve the production build (after `build`) |
| `npm run lint` | ESLint |
| `npm run typecheck` | `tsc --noEmit` |

### Tests

The project uses standalone `tsx` harnesses (no test-runner dependency):

| Command | Covers |
|---|---|
| `npm run smoke` | Route reachability against a **running server** (public 2xx / protected → `/login`, never 5xx). Needs the app started (`npm run build && npm run start`) and `BASE_URL` (defaults to `http://localhost:3000`). Black-box; no DB required. |
| `npm run test:prefill` | Strategy → Facebook prefill mapping |
| `npm run test:strategist` | Strategist mapping / validation / decision tree |
| `npm run test:security` | SSRF classification, request validation, rate-limiting |
| `npm run test:storage` | App storage clear-on-logout helper (pure-function check) |

CI (`.github/workflows/ci.yml`) runs lint → typecheck → build → smoke → all test harnesses on every
push and pull request.

---

## Branching & workflow

- **`main` is never committed to directly.** All work happens on a feature/chore branch and lands via
  pull request.
- Branch naming: `feat/…`, `fix/…`, `chore/…`, `docs/…`.
- Keep commits small and focused; do not push or merge without explicit approval.
- CI must be green (lint, typecheck, build, smoke, all tests) before merge.
- **Destructive database migrations require explicit approval** and are never run against production
  from a branch.

---

## Project layout (high level)

```
app/            App Router pages + API route handlers (app/api/**)
  _shared/      Shared UI (dark "Mission Control" + dormant emerald primitives), hooks, storage helper
lib/
  strategist/   Marketing Strategist engine
  facebook/     Facebook Specialist engine
  server/       Security layer: auth, ai, ssrf, rate-limit, usage, guard
  supabase*.ts  Supabase clients (browser / server / anon)
supabase/migrations/   0000–0003 (applied manually)
docs/engineering/      Engineering runbooks (DB verification, …)
scripts/        route-smoke + integration harnesses
proxy.ts        Route-protection Middleware
```

---

## Documentation

- **Engineering runbooks:** `docs/engineering/` (start with `DATABASE_VERIFICATION.md`).
- **Architecture / product audit:** `development-pack/` (repository overview, architecture, routes,
  components, design system, company brain, campaign builder, tech debt, roadmap).
- **Sprint / release history:** `SPRINT_REVIEW.md`, `RELEASE_REVIEW.md`,
  `RELEASE_CANDIDATE_REVIEW.md`, `SECURITY_SPRINT_REPORT.md` at the repo root.
- **Agent/build conventions:** `AGENTS.md` (and `CLAUDE.md`).

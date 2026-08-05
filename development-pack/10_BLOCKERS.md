# 10 — Blockers

Things that will **stop or endanger implementation** until resolved. Ordered by how early they bite.

## Hard blockers (resolve before building on top)

| # | Blocker | Impact | How to unblock |
|---|---|---|---|
| B1 | **Database schema is only partially in version control.** No baseline migration for `companies`, `plans`, `content_feedback`; RLS on those tables is unverifiable from the repo. | Cannot recreate a working DB from the repo; security of `generate-plan` rests on an unverified RLS assumption. | Export current schema + policies from Supabase and commit `supabase/migrations/0000_baseline.sql`. Verify `auth.uid() = user_id` RLS on all three tables. |
| B2 | **Migrations run manually — state unknown per environment.** `0002` (campaign_strategies, content_drafts) and `0003` (ai_usage_events) may not be applied in prod/preview. | Saving strategies/drafts fails, or usage logging silently no-ops, depending on environment. | Confirm `0002`+`0003` are applied everywhere; adopt a migration tracking approach (Supabase CLI or a checklist). |
| B3 | **Secrets / env not documented.** No `.env.example`; required vars are only discoverable by grepping `process.env`. | A fresh clone cannot run without reverse-engineering env vars. | Add `.env.example` (see `13_ENVIRONMENT.md`) and a real README. |

## Environmental / operational blockers

| # | Blocker | Impact | How to unblock |
|---|---|---|---|
| B4 | **Vercel Preview is SSO-protected (Deployment Protection).** Preview smoke tests are blocked without a `_vercel_share` bypass (noted in project memory). | Cannot run automated smoke tests against Preview URLs. | Generate a protection-bypass token, or run smoke tests locally (`npm run smoke` against a local server). |
| B5 | **Supabase host was unresolvable in prod on 2026-07-12** (per project memory) — DNS failure broke login/protected routes. | If recurring, all authenticated flows fail. | Verify Supabase project DNS/health before implementation; keep it on the pre-flight checklist. |
| B6 | **No CI.** Green checks are unenforced; a regression can merge. | Quality drift during multi-agent implementation. | Add a GitHub Actions workflow (lint/typecheck/build/tests). |

## Product / architecture blockers (block specific features, not all work)

| # | Blocker | Blocks |
|---|---|---|
| B7 | **Two company data models** — plan/onboarding use the flat profile, not Company Brain. | Any feature that assumes Company Brain edits affect the weekly plan. |
| B8 | **`strategy_context` mixes v1 + v2 shapes.** | SQL querying/analytics over strategies; must go through `normalizeStrategyContext()`. |
| B9 | **Emerald design system lacks Table/Dialog/Drawer/Sheet primitives.** | Any new data-list or modal page built "on the approved system". |
| B10 | **In-memory rate limiting + no cost cap.** | Safely exposing the app to untrusted/high traffic before DB-backed limits exist. |
| B11 | **`AGENTS.md` warns this Next.js version has breaking changes vs training data.** Read `node_modules/next/dist/docs/` before writing Next-specific code. | Any Next-API-level work (config, middleware, routing) done from memory. |

## NOT blockers (already handled — do not re-litigate)

- Open AI proxy, client-trusted `userId`, SSRF/prompt-injection, unguarded image routes, leaking
  provider errors, missing rate-limit/usage-logging — **all fixed** by the merged security sprint.
- Lint / typecheck / build / tests — **all green** on `main` at audit time.
- `.env.local` with real keys is correctly gitignored and not included in this pack.

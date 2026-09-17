# 08 — Technical Debt

Severity: **High** (blocks correctness/security/adoption), **Medium** (real cost, contained),
**Low** (hygiene). Verified against `main` at audit time.

> **Note on prior severities.** The security-foundation sprint (merged) resolved the previously
> High-severity AI-security items (open proxy, client-trusted `userId`, unguarded image routes,
> SSRF). Those are listed under "Resolved" at the bottom, not as open debt.

## High

| # | Item | Location | Why it's High |
|---|---|---|---|
| H1 | **No baseline migrations** for `companies`, `plans`, `content_feedback`. Schema cannot be recreated from the repo; a `0000_baseline.sql` is missing. | `supabase/migrations/` | Disaster-recovery + onboarding risk; RLS on these tables is unverifiable from code. |
| H2 | **RLS on the 3 original tables is unverifiable from the repo.** Migrations `0001`+ assume it exists. If misconfigured, `generate-plan`'s reliance on RLS becomes an IDOR path. | DB / `app/api/generate-plan/route.ts` | Security depends on an unversioned assumption. |
| H3 | **Two parallel company data models** (flat `CompanyProfile` vs Company Brain JSONB). The weekly plan + onboarding still use the flat model, so `/company` edits don't reach the most-used feature. | `app/_shared/companyBrain.ts` + legacy routes | Product correctness: user edits silently ignored. |
| H4 | **Migrations `0002` + `0003` may be unrun in production** (run manually). Without `ai_usage_events`, usage logging silently no-ops. | Supabase project | Ops/observability gap; must verify before relying on limits/logging. |
| H5 | **Design system ~0% adopted.** Three-to-four coexisting palettes; approved emerald system renders nowhere; missing Table/Dialog/Drawer/Sheet primitives. | `globals.css`, `theme.ts`, `primitives.tsx`, pages | Largest UX debt; every new page inherits the ambiguity. |

## Medium

| # | Item | Location | Why |
|---|---|---|---|
| M1 | **Duplicated color palettes.** The Mission Control `T` object is copy-pasted across several files; `/campaign-builder` has a *third* inline copy (calling its accent `gold` though it is purple). | 8+ files | Drift + maintenance cost. |
| M2 | **Rate limiting is in-memory** (per serverless instance, resets on cold start). Stops double-click/spam, not a distributed attacker. | `lib/server/rateLimit.ts` | Known limitation; needs shared counter (Supabase/Redis). |
| M3 | **No hard cost ceiling.** Usage is logged but there is no automatic soft-shutdown at a budget cap. | all AI routes | `gpt-4o` ×2–4 per strategy run, `gpt-image-1` per image. |
| M4 | **`campaign-analysis`/`campaign-interview` still take company facts in the request body** (used only in own prompt, no cross-user read) — should move to server-fetched Company Brain, or be deleted. | those two routes | Architecture inconsistency (and they're dead — see D1). |
| M5 | **Hardcoded holiday calendar + non-ISO week calc** in the plan route. | `app/api/generate-plan/route.ts` | Correctness around year boundaries; includes oddities like `"Black Friday (nästan)"`. |
| M6 | **No CI.** No GitHub Actions; lint/typecheck/build/tests are green but unenforced on PR. | repo | Regressions can merge silently. |
| M7 | **No test runner / no coverage.** Four standalone `tsx` harnesses; large areas untested (route handlers, Facebook Specialist engine, Company Brain functions, any React component, any Supabase call). | `scripts/`, `lib/**/*.test.mts` | Refactors are risky. |
| M8 | **`localStorage` not cleared on logout.** Next user on a shared machine can briefly see the previous user's plan/profile before Supabase load. | `app/_shared/useAccountData.ts` | Privacy on shared devices. |
| M9 | **All pages are `"use client"`** — no Server Components, no SSR data fetching; first paint always desktop, then JS breakpoint shifts layout on mobile. | every page | Perf + layout shift. |

## Low

| # | Item | Location |
|---|---|---|
| L1 | **Dead code** (see D-list below) — ~1,400 lines that compile/lint but reach no user. | various |
| L2 | **`content_drafts.updated_at` never updated** (no trigger, no code writes it). | `content_drafts` |
| L3 | **`content_drafts` written but never read** — no saved-drafts view. | app |
| L4 | **`campaign_strategies.strategy_context` holds two incompatible formats** (v1 flat / v2) — unqueryable in SQL. | DB |
| L5 | **`content_feedback.company_name` is text, not FK** — renaming the company silently drops feedback linkage. | DB |
| L6 | **`company_id` has no FK constraint** in the new tables — orphan rows possible. | DB |
| L7 | **README is unchanged create-next-app boilerplate**; no `.env.example`. | `README.md` |
| L8 | **`next.config.ts` is empty** — no image domains, no security headers. | `next.config.ts` |
| L9 | **Tailwind v4 partially used** — legacy/frozen UI still inline `style` objects; two `EmptyState`/`Field` component names collide across `ui.tsx` and `primitives.tsx`. | `app/_shared/` |
| L10 | **File name with a space:** `node update-colors.js` (root) — must be quoted in every toolchain. | root |
| L11 | **`design-reference.png` (1.6 MB)** committed at repo root. | root |
| L12 | **5 npm vulnerabilities** (4 high, 1 moderate) — all transitive via `next`/toolchain (`next`, `sharp`, `brace-expansion`, `js-yaml`, `postcss`). Not from directly-called prod deps. | `package-lock.json` |
| L13 | **Cyrillic char in a comment:** `lib/campaignStrategyStore.ts` contains `"Klient-sидан"`. | that file |

## Dead code / unused files (❌)

| # | What | Where |
|---|---|---|
| D1 | `POST /api/campaign-interview` + `POST /api/campaign-analysis` — no caller after v2 rewrite | `app/api/campaign-{interview,analysis}/` |
| D2 | v1 Campaign Builder modules: `config.tsx`, `reasoning.ts`, `goal-profiles.ts`, `analysis.ts` | `app/campaign-builder/` |
| D3 | `saveCampaignStrategy()`, `buildStrategyContext()` — v1 persistence, no caller | `lib/campaignStrategyStore.ts` |
| D4 | `lib/mockPlans.ts`, `lib/planStorage.ts`, `lib/generatedPlan.ts` — not imported | `lib/` |
| D5 | `lib/supabase.ts` — anon client without session (legacy pattern) | `lib/` |
| D6 | `veckoplan-app.jsx` (root), `node update-colors.js` (root) — prototype / one-off, excluded from lint | root |
| D7 | `public/*.svg` (file, globe, next, vercel, window) — unused create-next-app assets | `public/` |

## TODO / FIXME markers

**None.** A repo-wide search finds no `TODO`, `FIXME`, `HACK`, `XXX`, `@ts-ignore`,
`@ts-expect-error`, or `eslint-disable` markers. The equivalent intent is written as honest header
comments instead (e.g. `primitives.tsx` "dormant layer", `eslint.config.mjs` "candidates for
deletion").

## Architectural risks (summary)

- **Two code generations** side by side (legacy vs modern) — readers can edit the wrong file.
- **Two design systems + legacy palettes** — visual and structural fragmentation.
- **Schema/RLS partly outside version control** — the biggest single unknown.
- **JSONB-everything persistence** — fast to build, hard to query/measure/migrate later.

## Resolved by the merged security-foundation sprint (context)

Open AI proxy on `create-content`, client-trusted `userId` on `generate-plan`, SSRF +
prompt-injection on `analyze-company`, unguarded image routes, leaking provider errors, and
absence of rate-limit/usage-logging are **fixed** on `main`. See `RELEASE_REVIEW.md` /
`SECURITY_SPRINT_REPORT.md` at the repo root for the full record.

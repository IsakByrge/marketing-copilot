# 02 — Architecture

## Overview

Marketing Copilot is a **single Next.js 16 App Router application** deployed on Vercel, backed by
Supabase (Postgres + Auth) and OpenAI. The codebase shows **two clear generations of code side by
side**:

- **Legacy generation** — `generate-plan`, `analyze-company`, image routes, and the older pages.
  Client-heavy, minimal validation, inline prompts.
- **Modern generation** — the Strategist engine (`lib/strategist/`), the Facebook Specialist engine
  (`lib/facebook/`), and the shared **security layer** (`lib/server/`). Server-derived identity,
  deterministic validation, controlled repair, honest error handling, usage logging.

The security-foundation sprint brought the *legacy AI routes up to the modern security bar* (auth +
rate-limit + usage logging + safe errors) even where their prompt architecture is still legacy.

---

## Folders & domains

| Path | Domain / responsibility |
|---|---|
| `app/_shared/` | Shared design system(s) + client hooks. Two systems: dark "Mission Control" (`ui.tsx`, `Shell.tsx`, `theme.ts`, `icons.tsx`) and dormant light "emerald" (`primitives.tsx`). Hooks: `useAccountData`, `useCompanyBrain`. Domain model: `companyBrain.ts`. |
| `app/api/` | Server route handlers. Sub-domains: `strategist/{analyze,recommend}`, `content/facebook`, plus legacy `generate-plan`, `analyze-company`, `create-content`, `generate-image`, `edit-image`, and dead `campaign-analysis`/`campaign-interview`. |
| `app/campaign-builder/` | Marketing Strategist 2.0 UI (`page.tsx`) + **dead v1 modules** (`config.tsx`, `reasoning.ts`, `goal-profiles.ts`, `analysis.ts`). |
| `app/content/facebook/` | Facebook Specialist UI + shared brief/result `types.ts`. |
| `lib/strategist/` | Strategist engine: `types`, `prompts`, `model`, `validate`, `request`, `adapter`, `companyContext`, `goals`, tests. |
| `lib/facebook/` | Facebook Specialist engine: `specialist`, `quality`, `context`, `strategyPrefill`. |
| `lib/server/` | **Security layer** (see below). |
| `lib/` (root) | Supabase clients, `campaignStrategyStore`, `companyBrainServer`, dead `mockPlans`/`planStorage`/`generatedPlan`. |
| `supabase/migrations/` | `0001` company_brain, `0002` content engine, `0003` ai_usage_events. Additive, run manually. |
| `scripts/` | `route-smoke.mts`, `strategyPrefill.integration.mts`. |
| `proxy.ts` | Route-protection Middleware. |

---

## The security layer (`lib/server/`)

Shared helpers that every AI route composes:

| Module | Responsibility |
|---|---|
| `auth.ts` | `getAuthedUser()` (identity from session), `getUserCompany()`, `ownsCampaignStrategy()` (RLS-scoped ownership). |
| `ai.ts` | Central model/token-budget/timeout config (env-driven), lazy OpenAI client, `callChatJson()` with a hard output-token cap. |
| `ssrf.ts` | `safeFetchWebsite()` — protocol allowlist, private/loopback/link-local/CGNAT blocklist (IPv4/IPv6/IPv4-mapped), DNS validation before fetch, re-validation on every redirect hop, timeout + size limit. |
| `rateLimit.ts` | Per-(user, feature) sliding window + concurrency lock. **In-memory** (per serverless instance). |
| `usage.ts` | `logAiUsage()` → `ai_usage_events` (metadata only; never prompts/Company Brain/keys). Best-effort. |
| `guard.ts` | `guardAiRequest(feature)` binds auth + rate-limit and returns `finish()` (release lock + log); `safeError()` for safe Swedish error responses. |
| `contentPrompt.ts` | Server-owned prompt builder + validator for `create-content` (closed proxy). |

**Per-AI-route flow:** `guardAiRequest(feature)` → 401 if unauthenticated / 429 if spammed →
validate request → fetch company/Company Brain server-side → build prompt server-side → model call
with timeout → validate response → `finish()` (log). RLS (`auth.uid() = user_id`) makes resource
ownership a database guarantee, not just an application check.

---

## Providers, hooks, services

**Providers:** none. There is **no state-management library and no React Context providers** — the
app uses local `useState`/`useEffect` plus two shared hooks. Persistence is Supabase, with
`localStorage` as a cache/fallback.

**Hooks** (`app/_shared/`):

| Hook | Responsibility | Consumers |
|---|---|---|
| `useAccountData` | Loads profile + latest plan + history (falls back to `localStorage`). | `/dashboard`, `/content`, `/campaigns`, `/history` |
| `useCompanyBrain` | Loads/saves Company Brain JSONB via the browser client. | `/company` |

**Services / reusable modules:**

| Module | Responsibility | Reused by |
|---|---|---|
| `app/_shared/companyBrain.ts` | Types, `sanitizeBrain`, `migrateProfileToBrain`, completeness, gaps, AI context. | `/company`, `useCompanyBrain`, `companyBrainServer`, strategist `companyContext`, facebook `context` |
| `lib/strategist/adapter.ts` | v1/v2 strategy normalisation. | facebook `context`, `strategyPrefill`, tests |
| `lib/strategist/validate.ts` | Deterministic coercion + hard-issue detection. | both strategist routes |
| `lib/facebook/quality.ts` | Cliché / fabricated-proof detection, dedupe. | facebook `specialist` |
| `lib/companyBrainServer.ts` | `getCompanyBrainContext()` server-side. | `create-content` (now wired), strategist/facebook context |

---

## Server / client responsibility split

**Server** (route handlers + `lib/server/*`, `*Server`, `context` modules):
- All OpenAI keys and model calls.
- Identity derived from the authenticated Supabase session — never from client data.
- Prompt construction and all model-response validation.
- `lib/supabase-server.ts` imports `next/headers`, making it effectively impossible to bundle into a
  client component — an intentional "server-only" guard.

**Client** (`"use client"` — effectively every page):
- All UI and state.
- **Direct Supabase reads/writes** via the RLS-scoped browser client: `companies` (profile +
  `company_brain`), `plans`, `campaign_strategies`, `content_drafts`, `content_feedback`.

---

## API structure — two generations

| | Legacy (`generate-plan`, `analyze-company`, image routes) | Modern (`strategist/*`, `content/facebook`, `create-content`) |
|---|---|---|
| Response | `NextResponse.json()` | `Response.json()` / NDJSON stream |
| Auth | `guardAiRequest` (added in security sprint) | `guardAiRequest` + session-derived identity |
| Request validation | Minimal | Dedicated parse functions → 400 |
| Response validation | `JSON.parse` → straight to client | Deterministic coercion + one controlled repair |
| Logging | Type name (hardened in security sprint) | `requestId` + type name + usage row |
| `maxDuration` | Present on newer, mixed on older | 60 s / 120 s |
| Prompts | Inline in route | Dedicated prompt modules |

---

## ASCII architecture diagram

```
                          ┌──────────────────────────────────────────┐
                          │                BROWSER                    │
                          │   Next.js App Router pages ("use client") │
                          │   ─ two design systems in app/_shared/    │
                          │     • Mission Control (dark, active)      │
                          │     • Emerald (light, dormant)            │
                          │   ─ hooks: useAccountData, useCompanyBrain│
                          └───────┬───────────────────────┬──────────┘
                                  │ direct RLS reads/writes│ fetch()
                                  │ (browser Supabase)     │
                                  ▼                        ▼
        ┌─────────────────────────────┐      ┌──────────────────────────────────┐
        │   proxy.ts (Middleware)     │      │      app/api/**  route handlers   │
        │   session check →           │      │  ┌────────────────────────────┐   │
        │   redirect protected routes │      │  │  lib/server/ SECURITY LAYER│   │
        │   to /login                 │      │  │  guard → auth → rateLimit  │   │
        └─────────────┬───────────────┘      │  │  ai (OpenAI) │ ssrf │ usage│   │
                      │                       │  └───────┬─────────────┬──────┘   │
                      │                       │          │             │          │
                      │            ┌──────────┴──────┐   │             │          │
                      │            │ lib/strategist/ │   │             │          │
                      │            │ lib/facebook/   │───┘             │          │
                      │            │ companyBrain*   │                 │          │
                      │            └─────────────────┘                 │          │
                      ▼                                                ▼          ▼
        ┌──────────────────────────────┐              ┌──────────────┐  ┌────────────────┐
        │       Supabase               │              │   OpenAI     │  │ ai_usage_events│
        │  Auth + Postgres (RLS)       │◀─────────────│ Chat+Images  │  │  (metadata log)│
        │  companies · plans ·         │              └──────────────┘  └────────────────┘
        │  content_feedback ·          │
        │  campaign_strategies ·       │
        │  content_drafts ·            │
        │  ai_usage_events             │
        └──────────────────────────────┘
```

# 03 — Routes

Legend for the assessment columns: **✅ = yes**, **—/blank = no**, **⚠ = partial/caveat**.
"Production Ready" is a pragmatic judgement of whether the route is safe and complete enough to ship
as-is; "Needs Refactor" flags legacy design or architecture debt even where the route works.

## Page routes (App Router) — 18

| # | URL | Protected | Design system | Prod Ready | Legacy | Needs Refactor | Missing |
|---|---|---|---|:--:|:--:|:--:|---|
| 1 | `/` | No | Own third style (dark beige `#0a0908`) | ✅ | ⚠ | ⚠ | Hardcoded nav padding, no breakpoint |
| 2 | `/login` | No | Legacy | ✅ | ✅ | ⚠ | — |
| 3 | `/auth/callback` | No | Minimal | ✅ | — | — | — |
| 4 | `/onboarding` | Yes | Legacy | ✅ | ✅ | ⚠ | Desktop-first, fixed widths |
| 5 | `/dashboard` | Yes | Mission Control | ✅ | — | ⚠ | "Kommer snart" placeholders (Annons, Landningssida) |
| 6 | `/generating` | Yes | Legacy | ✅ | ✅ | ⚠ | Progress view only |
| 7 | `/plan` | Yes | Legacy | ✅ | ✅ | ✅ | Reads plan from `localStorage` |
| 8 | `/campaign-builder` | Yes | Mission Control (3rd inline palette copy) | ✅ | — | ⚠ | No session persistence; reload loses state |
| 9 | `/campaigns` | Yes | Mission Control | ⚠ | — | ✅ | **Shows old plan data, never lists saved strategies** |
| 10 | `/campaign` | Yes | Legacy | ⚠ | ✅ | ✅ | Reads plan from `localStorage` |
| 11 | `/content` | Yes | Mission Control | ✅ | — | ⚠ | Shows latest plan content only |
| 12 | `/content/facebook` | Yes | Mission Control | ✅ | — | — | Saved drafts never listed back |
| 13 | `/post/[id]` | Yes | Legacy | ✅ | ✅ | ✅ | Only image gen/feedback lives here; uses `<img>` (lint warning) |
| 14 | `/newsletter` | Yes | Legacy | ⚠ | ✅ | ✅ | Reads plan from `localStorage` |
| 15 | `/create` | Yes | Legacy | ✅ | ✅ | ⚠ | Now server-secured (`{contentType, request}` contract) but legacy design |
| 16 | `/company` | Yes | Mission Control | ✅ | — | — | Company Brain editor |
| 17 | `/history` | Yes | Mission Control | ✅ | — | — | — |
| 18 | `/profile` | Yes | Legacy | ⚠ | ✅ | ✅ | **Functionally overlaps `/company`** (two company-data pages) |

## API routes — 10

All AI routes are now guarded (`guardAiRequest` → 401/429), log usage, and return safe Swedish
errors after the security sprint. "Modern" = server-derived identity + deterministic validation.

| # | URL | Model | Style | Prod Ready | Legacy | Needs Refactor | Missing / notes |
|---|---|---|---|:--:|:--:|:--:|---|
| 1 | `POST /api/strategist/analyze` | `STRATEGIST_MODEL` (def `gpt-4o`) | Modern | ✅ | — | — | — |
| 2 | `POST /api/strategist/recommend` | `STRATEGIST_MODEL` (def `gpt-4o`) | Modern | ✅ | — | — | — |
| 3 | `POST /api/content/facebook` | `gpt-4o` draft + `gpt-4o-mini` review | Modern (NDJSON stream) | ✅ | — | — | — |
| 4 | `POST /api/create-content` | central `AI.CHAT_MODEL` | Modern (closed proxy) | ✅ | — | — | Prompt now server-owned |
| 5 | `POST /api/generate-plan` | `gpt-4o-mini` | Legacy prompt, secured | ✅ | ⚠ | ✅ | Identity now session-derived; hardcoded holiday calendar, non-ISO week calc |
| 6 | `POST /api/analyze-company` | `gpt-4o-mini` | Legacy prompt, secured | ✅ | ⚠ | ✅ | SSRF-safe fetch + prompt-injection framing added |
| 7 | `POST /api/generate-image` | central `AI.IMAGE_MODEL` (`gpt-image-1`) | Secured | ✅ | ⚠ | ⚠ | Generic errors, rate-limited |
| 8 | `POST /api/edit-image` | central `AI.IMAGE_MODEL` | Secured | ✅ | ⚠ | ⚠ | Size limit `EDIT_IMAGE_MAX_BYTES` |
| 9 | `POST /api/campaign-analysis` | central chat model | Secured but **dead** | — | ✅ | ✅ | **No caller** — v1 remnant |
| 10 | `POST /api/campaign-interview` | central chat model | Secured but **dead** | — | ✅ | ✅ | **No caller** — v1 remnant |

## Middleware

| Route | Purpose | Status |
|---|---|---|
| `proxy.ts` (Proxy / Middleware) | Session check; redirect unauthenticated users from protected routes to `/login`; redirect logged-in users off `/login`. Matcher excludes `_next/*`, `favicon.ico`, `api`. | ✅ Production ready |

## Summary

- **28 routes total** = 18 pages + 10 API handlers (+ 1 Middleware).
- **2 API routes are dead** (`campaign-analysis`, `campaign-interview`).
- **6 pages carry the legacy design** and are marked "Needs Refactor" for design-system unification.
- **`/campaigns` and `/profile`** are the two pages with genuine functional gaps (strategies never
  listed; overlaps `/company`).

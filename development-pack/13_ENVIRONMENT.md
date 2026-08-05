# 13 — Environment Variables

Discovered by scanning every `process.env.*` reference in the codebase. **Names only — all secret
values are masked/omitted.** `.env.local` exists locally, holds real keys, is correctly gitignored
(`.env*`), and is **not** included in this pack.

There is currently **no `.env.example`** in the repo (see `10_BLOCKERS.md` B3). This document is the
de-facto list; recommend committing it as `.env.example` with placeholder values.

## Required (app will not function without these)

| Variable | Used by | Purpose |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | `proxy.ts`, `lib/supabase-browser.ts`, `lib/supabase-server.ts`, `lib/supabase.ts` | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | same as above | Supabase anon/public key (RLS-scoped) |
| `OPENAI_API_KEY` | `lib/server/ai.ts`, `lib/strategist/model.ts`, `lib/facebook/specialist.ts` | OpenAI API key (server-only) |

> `NEXT_PUBLIC_*` values are exposed to the browser by design (Supabase anon key + URL); the OpenAI
> key is server-only and never prefixed `NEXT_PUBLIC_`.

## Optional — AI model / budget / timeout (have code defaults)

| Variable | Default | Used by |
|---|---|---|
| `AI_CHAT_MODEL` | central default | `lib/server/ai.ts` |
| `AI_IMAGE_MODEL` | `gpt-image-1` | `lib/server/ai.ts` |
| `AI_TIMEOUT_MS` | central default | `lib/server/ai.ts` |
| `AI_MAX_OUTPUT_TOKENS` | central cap | `lib/server/ai.ts` |
| `STRATEGIST_MODEL` | `gpt-4o` | `lib/strategist/model.ts` |
| `STRATEGIST_TIMEOUT_MS` | `45000` | `lib/strategist/model.ts` |
| `FACEBOOK_DRAFT_MODEL` | `gpt-4o` | `lib/facebook/specialist.ts`, `app/api/content/facebook/route.ts` |
| `FACEBOOK_REVIEW_MODEL` | `gpt-4o-mini` | `lib/facebook/specialist.ts` |
| `FACEBOOK_TIMEOUT_MS` | `45000` | `lib/facebook/specialist.ts` |

## Optional — abuse / SSRF / limits (have code defaults)

| Variable | Purpose | Used by |
|---|---|---|
| `AI_RATE_LIMIT_MAX` | Max requests per window per (user, feature) | `lib/server/rateLimit.ts` |
| `AI_RATE_LIMIT_WINDOW_MS` | Sliding-window size | `lib/server/rateLimit.ts` |
| `WEBSITE_FETCH_TIMEOUT_MS` | SSRF-safe website fetch timeout | `lib/server/ssrf.ts` |
| `WEBSITE_FETCH_MAX_BYTES` | SSRF-safe fetch size cap | `lib/server/ssrf.ts` |
| `EDIT_IMAGE_MAX_BYTES` | Upload size cap for image edit | `app/api/edit-image/route.ts` |

## Tooling only (not needed at runtime)

| Variable | Purpose | Used by |
|---|---|---|
| `BASE_URL` | Target base URL for the route-smoke script | `scripts/route-smoke.mts` |

## Suggested `.env.example` skeleton

```dotenv
# ── Required ──────────────────────────────────────────────
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
OPENAI_API_KEY=

# ── Optional: AI models / budgets / timeouts ─────────────
# AI_CHAT_MODEL=
# AI_IMAGE_MODEL=gpt-image-1
# AI_TIMEOUT_MS=
# AI_MAX_OUTPUT_TOKENS=
# STRATEGIST_MODEL=gpt-4o
# STRATEGIST_TIMEOUT_MS=45000
# FACEBOOK_DRAFT_MODEL=gpt-4o
# FACEBOOK_REVIEW_MODEL=gpt-4o-mini
# FACEBOOK_TIMEOUT_MS=45000

# ── Optional: abuse / SSRF / limits ──────────────────────
# AI_RATE_LIMIT_MAX=
# AI_RATE_LIMIT_WINDOW_MS=
# WEBSITE_FETCH_TIMEOUT_MS=
# WEBSITE_FETCH_MAX_BYTES=
# EDIT_IMAGE_MAX_BYTES=

# ── Tooling only ─────────────────────────────────────────
# BASE_URL=http://localhost:3000
```

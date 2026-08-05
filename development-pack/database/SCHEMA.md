# Database Schema & Assets

Supabase Postgres. **Important:** the three original tables (`companies`, `plans`,
`content_feedback`) were created manually in the Supabase dashboard **before** the migrations folder
existed — they have **no `CREATE TABLE` migration in the repo**. Only additive migrations are
version-controlled. The schema below for those tables is **reconstructed from the columns the code
actually reads/writes**, not from a canonical DDL.

Migration SQL files are copied verbatim under `database/migrations/`.

## Tables (6 total)

### `companies` — created outside the repo (no migration)
| Column | Type | Note |
|---|---|---|
| `id` | uuid | PK |
| `user_id` | uuid | owner (RLS key) |
| `name`, `industry`, `summary` | text | old flat profile |
| `customers`, `products`, `tone`, `strengths`, `avoid`, `content_guidelines` | text[] / jsonb | old flat profile |
| `best_customer`, … | text | onboarding answers |
| `company_brain` | **jsonb NOT NULL DEFAULT `'{}'`** | migration `0001` — full Company Brain 1.1 |
| `created_at` | timestamptz | used for `order desc limit 1` |

### `plans` — created outside the repo (no migration)
`id`, `user_id`, `company_id`, `focus`, `tags`, `posts` (jsonb), `newsletter` (jsonb),
`campaigns` (jsonb), `opportunities` (jsonb), `created_at`. Written with **INSERT** (never upsert) —
this is why `/history` works.

### `content_feedback` — created outside the repo (no migration)
`user_id`, `company_name` (**text, not FK**), `post_title`, `rating_text` (`up`/`down`). Written from
`/post/[id]` (upsert), read by `/api/generate-plan`.

### `campaign_strategies` — migration `0002`
| Column | Type | Note |
|---|---|---|
| `id` | uuid PK | `gen_random_uuid()` |
| `user_id` | uuid NOT NULL | FK → `auth.users(id) ON DELETE CASCADE` |
| `company_id` | uuid | **no FK constraint** |
| `title` | text NOT NULL | default `'Kampanjstrategi'` |
| `goal` | text NOT NULL | default `''` |
| `strategy_context` | jsonb NOT NULL | **v1 flat OR v2 `StrategyV2`** — read via adapter |
| `recommendation` | jsonb NOT NULL | full recommendation |
| `created_at` | timestamptz NOT NULL | |

Index: `campaign_strategies_user_created_idx (user_id, created_at desc)`.

### `content_drafts` — migration `0002`
| Column | Type | Note |
|---|---|---|
| `id` | uuid PK | |
| `user_id` | uuid NOT NULL | FK → `auth.users(id) ON DELETE CASCADE` |
| `company_id` | uuid | **no FK constraint** |
| `channel` | text NOT NULL | default `'facebook'` |
| `brief`, `result` | jsonb NOT NULL | |
| `edited` | boolean NOT NULL | default `false` |
| `edited_text` | text | |
| `created_at`, `updated_at` | timestamptz NOT NULL | **`updated_at` is never updated** — no trigger, no code writes it |

Index: `content_drafts_user_created_idx (user_id, created_at desc)`.

### `ai_usage_events` — migration `0003`
`id, user_id (FK→auth.users), company_id, feature, model, status, started_at, ended_at,
duration_ms, error_category, prompt_tokens, completion_tokens, created_at`. Two indexes
(`user_id, created_at` and `feature, created_at`). One metadata row per AI call; **never** stores
prompts, Company Brain content, keys, or cookies.

## RLS policies

| Table | RLS in repo? | Policies |
|---|---|---|
| `campaign_strategies` | ✅ (`0002`) | select/insert/update/delete on `auth.uid() = user_id` |
| `content_drafts` | ✅ (`0002`) | same four policies |
| `ai_usage_events` | ✅ (`0003`) | select + insert on `auth.uid() = user_id` (append-only — no update/delete policy) |
| `companies` | ⚠ **not verifiable from repo** | `0001` assumes row-level RLS `auth.uid() = user_id` already exists |
| `plans` | ⚠ **not verifiable from repo** | assumed, not versioned |
| `content_feedback` | ⚠ **not verifiable from repo** | assumed, not versioned |

## Functions / triggers

- **None in the repo.** No SQL functions, no triggers. `content_drafts.updated_at` has no update
  trigger (hence it never changes). `company_brain.lastReviewedAt` is maintained inside the JSONB
  instead of via a DB trigger.

## How migrations are run

**Manually** in the Supabase SQL Editor — the app does not run them, there is no Supabase CLI
wiring, and no migration state is tracked in the repo. All three migrations are idempotent
(`IF NOT EXISTS` + `DROP/CREATE POLICY`) and contain no secrets, project IDs, or connection strings.

## To verify in Supabase (cannot be confirmed from code)

1. Migrations `0002` and `0003` are actually applied in production/preview.
2. RLS is enabled with correct `auth.uid() = user_id` policies on `companies`, `plans`,
   `content_feedback`.
3. Commit the result as `supabase/migrations/0000_baseline.sql`.

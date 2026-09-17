# Database Verification

How the Supabase schema is version-controlled, how to verify it against a live project, and what
still requires manual confirmation in the Supabase Dashboard.

> **Golden rules**
> - Migrations are **run manually** in the Supabase SQL Editor. The app never runs them.
> - **Never run destructive SQL** (`drop table`, `drop column`, `truncate`, `delete`) against a
>   shared/production database.
> - `0000_baseline.sql` is reconstructed **from application code**, not dumped from production —
>   treat its unverified parts (below) as claims to confirm, not facts.

---

## Migration order

Apply in ascending numeric order. Each is idempotent (`IF NOT EXISTS` + `DROP/CREATE POLICY`).

| # | File | Creates / changes | Type |
|---|---|---|---|
| 0000 | `0000_baseline.sql` | Creates `companies`, `plans`, `content_feedback` (columns, PK/FK, unique constraints, RLS + policies). | Base tables |
| 0001 | `0001_add_company_brain.sql` | `ALTER TABLE companies ADD COLUMN company_brain jsonb NOT NULL DEFAULT '{}'`. | Additive column |
| 0002 | `0002_add_content_engine.sql` | Creates `campaign_strategies`, `content_drafts` (+ indexes + RLS policies). | New tables |
| 0003 | `0003_add_ai_usage_events.sql` | Creates `ai_usage_events` (+ indexes + RLS policies). | New table |

**Fresh/empty project:** run 0000 → 0001 → 0002 → 0003.
**Existing project where the base tables already exist:** 0000's `CREATE TABLE IF NOT EXISTS` is a
no-op on the tables; only its RLS `enable` + policy (re)creation would take effect — review those
statements before running, since they assert the intended `auth.uid() = user_id` model.

### What each migration creates or changes

- **0000** → `public.companies`, `public.plans`, `public.content_feedback`.
  - `plans.company_id → companies.id` (`on delete cascade`).
  - `*.user_id → auth.users.id` (`on delete cascade`).
  - `unique (user_id, name)` on companies; `unique (user_id, company_name, post_index)` on
    content_feedback — both **required by the app's upserts** and therefore code-verified.
- **0001** → adds `companies.company_brain` (JSONB). Existing rows get `'{}'`; the app migrates the
  flat columns into it in memory on first `/company` visit.
- **0002** → adds `campaign_strategies` and `content_drafts` with their own RLS policies.
- **0003** → adds `ai_usage_events` (append-only for clients: select+insert policies only).

---

## Verifying that 0002 and 0003 are applied

Run in the Supabase SQL Editor (all read-only):

```sql
-- Tables exist?
select table_name
from information_schema.tables
where table_schema = 'public'
  and table_name in ('campaign_strategies', 'content_drafts', 'ai_usage_events')
order by table_name;
-- Expect 3 rows. Missing rows → that migration has NOT been applied.

-- Key columns present (spot-check 0002 / 0003)?
select table_name, column_name, data_type
from information_schema.columns
where table_schema = 'public'
  and table_name in ('campaign_strategies', 'content_drafts', 'ai_usage_events')
order by table_name, ordinal_position;

-- Indexes from 0002 / 0003 present?
select indexname
from pg_indexes
where schemaname = 'public'
  and indexname in (
    'campaign_strategies_user_created_idx',
    'content_drafts_user_created_idx',
    'ai_usage_events_user_created_idx',
    'ai_usage_events_feature_created_idx'
  );
```

If `ai_usage_events` is missing, AI usage logging silently no-ops (logging is best-effort and
swallows the error) — the app still works, but no usage is recorded. If `campaign_strategies` /
`content_drafts` are missing, saving strategies / Facebook drafts fails.

---

## Verifying Row Level Security

```sql
-- RLS enabled on every app table?
select relname as table_name, relrowsecurity as rls_enabled
from pg_class
where relnamespace = 'public'::regnamespace
  and relname in (
    'companies', 'plans', 'content_feedback',
    'campaign_strategies', 'content_drafts', 'ai_usage_events'
  )
order by relname;
-- Every row must show rls_enabled = true.

-- Inspect the actual policies (compare against the migrations):
select tablename, policyname, cmd, qual, with_check
from pg_policies
where schemaname = 'public'
order by tablename, policyname;
```

Expected model for every table: `using (auth.uid() = user_id)` on read/update/delete and
`with check (auth.uid() = user_id)` on insert/update. `ai_usage_events` intentionally has **no**
update/delete policy (append-only).

**Behavioural check (safest, no SQL):** sign in as user A, create a company + plan; sign in as user
B; confirm B cannot see A's rows anywhere in the app. RLS is the only thing enforcing this.

---

## ⚠ Still requires confirmation in the Supabase Dashboard

These cannot be determined from the repository and are **blocking verification needs** before the
baseline can be treated as authoritative for the live database:

1. **Array column types** on `companies` (`customers`, `products`, `tone`, `strengths`, `avoid`,
   `content_guidelines`) and `plans.tags`. The baseline uses `text[]`; production may use `jsonb`.
   The app reads/writes plain string arrays, which both satisfy — but the DDL should match reality.
   Check with the `information_schema.columns` query above (`data_type` will read `ARRAY` for
   `text[]` vs `jsonb` for jsonb).
2. **RLS enabled + exact policies** on `companies`, `plans`, `content_feedback` (the three base
   tables). The baseline asserts the intended model; confirm the live policies match, or reconcile.
3. **Unused/audit columns** the app never touches (e.g. whether `content_feedback` actually has a
   `created_at`, or extra columns on `companies`). Compare the full `information_schema.columns`
   output for these tables against `0000_baseline.sql`.
4. **Whether the manual base tables were created with the same PK/FK/defaults** the baseline
   declares. Confirm `gen_random_uuid()` PK defaults and the `on delete cascade` FKs exist in prod.

Record the outcome of each check (and reconcile the baseline if reality differs) before relying on
`0000_baseline.sql` as a production-accurate schema.

---

## Rollback / recovery

- The additive migrations (0001–0003) are **non-destructive**; there is nothing to roll back after
  applying them. To "undo" 0002/0003 on a throwaway/dev project you would `drop table` the new
  tables — **never do this on production**, and it is out of scope for this sprint.
- `0000_baseline.sql` performs **no destructive operations** and cannot drop or alter existing base
  tables (it only `CREATE ... IF NOT EXISTS`), so running it cannot lose data. The only re-applied
  effect on an existing project is RLS enable + policy recreation; to revert a policy change, restore
  the previous policy definitions from git history.
- **Backups:** rely on the Supabase project's automatic backups / point-in-time recovery for real
  recovery. This repo does not manage backups.
- There is **no migration-state table and no Supabase CLI wiring** in this repo. Track applied
  migrations manually (e.g. a checklist per environment) until a migration tool is adopted.

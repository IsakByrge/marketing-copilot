-- ─────────────────────────────────────────────────────────────
-- 0000_baseline — original base tables (companies, plans,
-- content_feedback)
--
-- WHY THIS FILE EXISTS
-- These three tables were created MANUALLY in the Supabase dashboard
-- before this migrations folder existed, so they had no CREATE TABLE
-- migration. This file version-controls them so the schema is
-- reproducible for a fresh, empty Supabase project and reviewable in
-- git. Migrations 0001–0003 build additively on top of these tables.
--
-- HOW IT WAS DERIVED
-- The columns, keys, unique constraints and the RLS model below were
-- RECONSTRUCTED FROM APPLICATION CODE (every `.from("companies"|"plans"|
-- "content_feedback")` read/write/upsert). They are the columns the app
-- actually uses. This is NOT a dump of the live production schema.
--
-- ⚠ UNVERIFIED — MUST BE CONFIRMED AGAINST THE LIVE DB BEFORE TRUSTING
-- (see docs/engineering/DATABASE_VERIFICATION.md):
--   1. Exact TYPE of the array columns (text[] vs jsonb). The code only
--      ever reads/writes string arrays, which both types satisfy; this
--      file uses text[]. Confirm the production type.
--   2. Whether RLS is actually ENABLED and the exact POLICY definitions
--      on these tables. The policies below encode the app's INTENDED
--      security model (auth.uid() = user_id). Confirm they match prod.
--   3. Any columns the app never touches (e.g. an audit created_at on
--      content_feedback) — such columns cannot be seen from code.
--
-- SAFETY
--   • Idempotent: CREATE TABLE/INDEX IF NOT EXISTS + DROP POLICY IF
--     EXISTS before CREATE POLICY. Safe to run more than once.
--   • On an EXISTING project the tables already exist, so CREATE TABLE
--     IF NOT EXISTS is a no-op and NO columns/rows are altered. Only the
--     RLS enable + policy (re)creation would apply — review them first.
--   • NON-DESTRUCTIVE: no DROP TABLE, no DROP COLUMN, no data changes.
--   • DO NOT run against production without the verification in the doc
--     above. Intended primarily to stand up a fresh/empty project.
--   • company_brain is intentionally NOT here — migration 0001 adds it.
--
-- HOW IT RUNS: pasted manually into the Supabase SQL Editor. The app
-- does not run migrations. No secrets/project-ids/connection strings.
-- ─────────────────────────────────────────────────────────────

-- ── 1. companies ─────────────────────────────────────────────
-- One marketing company profile per row, owned by a user. The app
-- upserts on (user_id, name), so that pair MUST be unique.
create table if not exists public.companies (
  id                 uuid primary key default gen_random_uuid(),
  user_id            uuid not null references auth.users (id) on delete cascade,
  name               text not null,
  industry           text,
  summary            text,
  -- Flat legacy profile arrays. Code treats these as string arrays.
  -- ⚠ Type (text[] vs jsonb) unverified — see header note 1.
  customers          text[] not null default '{}',
  products           text[] not null default '{}',
  tone               text[] not null default '{}',
  strengths          text[] not null default '{}',
  avoid              text[] not null default '{}',
  content_guidelines text[] not null default '{}',
  -- Free-text onboarding answers.
  best_customer      text,
  common_question    text,
  differentiator     text,
  recent_job         text,
  created_at         timestamptz not null default now(),
  -- Required by the app's upsert(onConflict: "user_id,name").
  constraint companies_user_name_key unique (user_id, name)
);

create index if not exists companies_user_created_idx
  on public.companies (user_id, created_at desc);

-- ── 2. plans ─────────────────────────────────────────────────
-- A generated weekly marketing plan. Written with INSERT (never
-- upsert) so history accumulates; /history lists them.
create table if not exists public.plans (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null references auth.users (id) on delete cascade,
  company_id     uuid references public.companies (id) on delete cascade,
  focus          text,
  tags           text[] not null default '{}',   -- ⚠ type unverified (see note 1)
  posts          jsonb  not null default '[]'::jsonb,
  newsletter     jsonb  not null default '{}'::jsonb,
  campaigns      jsonb  not null default '[]'::jsonb,
  opportunities  jsonb  not null default '[]'::jsonb,
  created_at     timestamptz not null default now()
);

create index if not exists plans_company_created_idx
  on public.plans (company_id, created_at desc);
create index if not exists plans_user_created_idx
  on public.plans (user_id, created_at desc);

-- ── 3. content_feedback ──────────────────────────────────────
-- Thumbs up/down on a plan post, keyed by company NAME (text, not a
-- FK — renaming a company drops the link; a known limitation). The app
-- upserts on (user_id, company_name, post_index), so that triple MUST
-- be unique.
create table if not exists public.content_feedback (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users (id) on delete cascade,
  company_name  text not null,
  post_index    integer not null,
  post_title    text,
  rating_text   text not null,   -- 'up' | 'down'
  created_at    timestamptz not null default now(),  -- ⚠ presence in prod unverified (note 3)
  constraint content_feedback_user_company_post_key
    unique (user_id, company_name, post_index)
);

create index if not exists content_feedback_user_company_idx
  on public.content_feedback (user_id, company_name);

-- ── 4. Row Level Security ────────────────────────────────────
-- ⚠ This encodes the app's INTENDED model: a user may only touch their
-- own rows (auth.uid() = user_id). The app's browser client relies on
-- this, and /api/generate-plan relies on it for scoping. CONFIRM this
-- matches the live policies before trusting it (see the verification
-- doc). Re-running is safe: policies are dropped then recreated.

alter table public.companies        enable row level security;
alter table public.plans            enable row level security;
alter table public.content_feedback enable row level security;

-- companies
drop policy if exists "own companies - select" on public.companies;
drop policy if exists "own companies - insert" on public.companies;
drop policy if exists "own companies - update" on public.companies;
drop policy if exists "own companies - delete" on public.companies;
create policy "own companies - select" on public.companies
  for select using (auth.uid() = user_id);
create policy "own companies - insert" on public.companies
  for insert with check (auth.uid() = user_id);
create policy "own companies - update" on public.companies
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own companies - delete" on public.companies
  for delete using (auth.uid() = user_id);

-- plans
drop policy if exists "own plans - select" on public.plans;
drop policy if exists "own plans - insert" on public.plans;
drop policy if exists "own plans - update" on public.plans;
drop policy if exists "own plans - delete" on public.plans;
create policy "own plans - select" on public.plans
  for select using (auth.uid() = user_id);
create policy "own plans - insert" on public.plans
  for insert with check (auth.uid() = user_id);
create policy "own plans - update" on public.plans
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own plans - delete" on public.plans
  for delete using (auth.uid() = user_id);

-- content_feedback
drop policy if exists "own content_feedback - select" on public.content_feedback;
drop policy if exists "own content_feedback - insert" on public.content_feedback;
drop policy if exists "own content_feedback - update" on public.content_feedback;
drop policy if exists "own content_feedback - delete" on public.content_feedback;
create policy "own content_feedback - select" on public.content_feedback
  for select using (auth.uid() = user_id);
create policy "own content_feedback - insert" on public.content_feedback
  for insert with check (auth.uid() = user_id);
create policy "own content_feedback - update" on public.content_feedback
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own content_feedback - delete" on public.content_feedback
  for delete using (auth.uid() = user_id);

-- ─────────────────────────────────────────────────────────────
-- Content Engine 1.0 — Facebook Specialist
--
-- Lägger till TVÅ nya tabeller. INGA befintliga tabeller, kolumner
-- eller rader påverkas (companies, plans, content_feedback lämnas
-- helt orörda). Säker att köra flera gånger (IF NOT EXISTS +
-- DROP/CREATE POLICY-mönster nedan).
--
-- HUR DEN KÖRS (manuellt, körs INTE automatiskt av appen):
-- 1. Supabase-projektets SQL Editor (dashboard.supabase.com → projekt
--    → SQL Editor).
-- 2. Klistra in hela filen och kör.
-- 3. Ingen nedtid, inget backfill-jobb.
--
-- Inga hemligheter, projekt-ID:n eller anslutningssträngar i filen.
-- ─────────────────────────────────────────────────────────────

-- ── 1. campaign_strategies ───────────────────────────────────
-- Persisterar en färdig kampanjrekommendation från Campaign Builder
-- så att den kan väljas som underlag i Facebook Specialist. Detta är
-- ADDITIVT — det ändrar inte Campaign Builders resonemang; builder
-- skriver bara en rad hit efter att analysen är klar.
--
-- strategy_context är den FB-SÄKRA sammanfattningen (mål, budskap,
-- målgrupp, erbjudande, kanaler, cta, risker, undvik) — den innehåller
-- ALDRIG marginaler eller exakt ekonomi. recommendation håller hela
-- rekommendationen för visning på Kampanjer-sidan.

create table if not exists public.campaign_strategies (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid not null references auth.users (id) on delete cascade,
  company_id        uuid,
  title             text not null default 'Kampanjstrategi',
  goal              text not null default '',
  strategy_context  jsonb not null default '{}'::jsonb,
  recommendation    jsonb not null default '{}'::jsonb,
  created_at        timestamptz not null default now()
);

create index if not exists campaign_strategies_user_created_idx
  on public.campaign_strategies (user_id, created_at desc);

alter table public.campaign_strategies enable row level security;

drop policy if exists "own campaign_strategies - select" on public.campaign_strategies;
drop policy if exists "own campaign_strategies - insert" on public.campaign_strategies;
drop policy if exists "own campaign_strategies - update" on public.campaign_strategies;
drop policy if exists "own campaign_strategies - delete" on public.campaign_strategies;

create policy "own campaign_strategies - select" on public.campaign_strategies
  for select using (auth.uid() = user_id);
create policy "own campaign_strategies - insert" on public.campaign_strategies
  for insert with check (auth.uid() = user_id);
create policy "own campaign_strategies - update" on public.campaign_strategies
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own campaign_strategies - delete" on public.campaign_strategies
  for delete using (auth.uid() = user_id);

-- ── 2. content_drafts ────────────────────────────────────────
-- Lagrar ett sparat specialistresultat (kanal, brief, resultat,
-- redigeringsstatus). Ersätter INTE content_feedback (som är per-
-- plan-index-feedback) — detta är ett riktigt innehållslager.

create table if not exists public.content_drafts (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users (id) on delete cascade,
  company_id   uuid,
  channel      text not null default 'facebook',
  brief        jsonb not null default '{}'::jsonb,
  result       jsonb not null default '{}'::jsonb,
  edited       boolean not null default false,
  edited_text  text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create index if not exists content_drafts_user_created_idx
  on public.content_drafts (user_id, created_at desc);

alter table public.content_drafts enable row level security;

drop policy if exists "own content_drafts - select" on public.content_drafts;
drop policy if exists "own content_drafts - insert" on public.content_drafts;
drop policy if exists "own content_drafts - update" on public.content_drafts;
drop policy if exists "own content_drafts - delete" on public.content_drafts;

create policy "own content_drafts - select" on public.content_drafts
  for select using (auth.uid() = user_id);
create policy "own content_drafts - insert" on public.content_drafts
  for insert with check (auth.uid() = user_id);
create policy "own content_drafts - update" on public.content_drafts
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own content_drafts - delete" on public.content_drafts
  for delete using (auth.uid() = user_id);

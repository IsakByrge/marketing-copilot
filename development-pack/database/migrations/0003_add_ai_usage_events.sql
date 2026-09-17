-- ─────────────────────────────────────────────────────────────
-- Security Foundation — AI-användningslogg
--
-- Lägger till EN ny tabell (ai_usage_events). INGA befintliga tabeller,
-- kolumner eller rader påverkas (companies, plans, content_feedback,
-- campaign_strategies, content_drafts lämnas helt orörda). Idempotent
-- och säker att köra flera gånger (IF NOT EXISTS + DROP/CREATE POLICY).
--
-- VARFÖR: AI-routes saknade kostnads- och missbruksuppföljning. Denna
-- tabell lagrar EN metadata-rad per AI-anrop (vem, vilken funktion,
-- modell, status, tid, feltyp, uppskattad tokenanvändning) så att
-- användning kan följas upp och grovt missbruk upptäckas. Den lagrar
-- ALDRIG prompter, Company Brain-innehåll, nycklar eller cookies.
--
-- HUR DEN KÖRS (manuellt, körs INTE automatiskt av appen):
-- 1. Supabase-projektets SQL Editor.
-- 2. Klistra in hela filen och kör.
-- 3. Ingen nedtid, inget backfill-jobb.
--
-- Inga hemligheter, projekt-ID:n eller anslutningssträngar i filen.
-- ─────────────────────────────────────────────────────────────

create table if not exists public.ai_usage_events (
  id                 uuid primary key default gen_random_uuid(),
  user_id            uuid not null references auth.users (id) on delete cascade,
  company_id         uuid,
  feature            text not null,
  model              text,
  status             text not null default 'ok',
  started_at         timestamptz not null default now(),
  ended_at           timestamptz,
  duration_ms        integer,
  error_category     text,
  prompt_tokens      integer,
  completion_tokens  integer,
  created_at         timestamptz not null default now()
);

create index if not exists ai_usage_events_user_created_idx
  on public.ai_usage_events (user_id, created_at desc);

create index if not exists ai_usage_events_feature_created_idx
  on public.ai_usage_events (feature, created_at desc);

alter table public.ai_usage_events enable row level security;

-- Användaren får bara se och skriva SINA EGNA rader. Ingen update/delete-
-- policy => loggen är i praktiken append-only för klienten (RLS nekar
-- allt som inte uttryckligen tillåts).
drop policy if exists "own ai_usage_events - select" on public.ai_usage_events;
drop policy if exists "own ai_usage_events - insert" on public.ai_usage_events;

create policy "own ai_usage_events - select" on public.ai_usage_events
  for select using (auth.uid() = user_id);
create policy "own ai_usage_events - insert" on public.ai_usage_events
  for insert with check (auth.uid() = user_id);

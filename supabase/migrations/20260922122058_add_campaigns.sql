-- ─────────────────────────────────────────────────────────────
-- campaigns — Campaign v1: en faktisk körning av en strategi
--
-- INTE KÖRD ÄNNU. Körs manuellt i Supabase SQL Editor efter review.
--
-- campaign_strategies betyder fortsatt AI-genererad strategi.
-- campaigns betyder en planerad, pågående eller avslutad körning av
-- en sådan strategi. "Kör igen" skapar en ny rad med samma
-- strategy_id, nya datum och tomma resultat — ingen lineage-kolumn.
--
-- Additiv: skapar en ny tabell, två index och fyra policyer. Ingen
-- befintlig tabell ändras, ingen rad skrivs, inget backfillas.
-- Idempotent: går att köra flera gånger.
--
-- Resultatfälten är användarens egna, manuellt inlagda siffror.
-- ROAS och kostnad per resultat lagras INTE — de räknas fram i kod
-- när underlaget finns. updated_at sätts av applikationen vid update;
-- ingen trigger i v1.
--
-- ── OM strategy_id ON DELETE RESTRICT ───────────────────────
-- Medvetet: en kampanj får inte existera utan sin strategi. En
-- strategi med kampanjer går inte att ta bort; kampanjerna måste
-- tas bort först.
--
-- ── OM ÄGARSKAP I INSERT/UPDATE ─────────────────────────────
-- En främmande nyckel kontrolleras utan RLS. Utan extra villkor kunde
-- en användare alltså peka sin kampanj på någon annans strategi eller
-- företag, och RESTRICT skulle då hindra den andra användaren från att
-- ta bort sin egen strategi. WITH CHECK kräver därför att både
-- strategin och företaget ägs av samma användare, och att strategin
-- hör till samma företag som kampanjen. Ytterkolumnerna är
-- kvalificerade (campaigns.company_id) så att de inte binds till
-- subqueryns tabell.
--
-- HUR DEN KÖRS (manuellt, körs INTE automatiskt av appen):
-- 1. Supabase-projektets SQL Editor.
-- 2. Klistra in hela filen och kör.
--
-- Inga hemligheter, projekt-ID:n eller anslutningssträngar i filen.
-- ─────────────────────────────────────────────────────────────

-- ── 1. Tabellen ─────────────────────────────────────────────
create table if not exists public.campaigns (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references auth.users (id) on delete cascade,
  company_id      uuid not null references public.companies (id) on delete cascade,
  strategy_id     uuid not null references public.campaign_strategies (id) on delete restrict,

  title           text not null,
  status          text not null default 'planned',

  starts_on       date not null,
  ends_on         date not null,

  spend_amount    numeric(12, 2),
  revenue_amount  numeric(12, 2),
  result_type     text,
  result_count    integer,
  result_note     text,
  learning        text,

  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),

  constraint campaigns_status_check
    check (status in ('planned', 'active', 'ended')),
  constraint campaigns_dates_check
    check (ends_on >= starts_on),
  constraint campaigns_spend_amount_check
    check (spend_amount is null or spend_amount >= 0),
  constraint campaigns_revenue_amount_check
    check (revenue_amount is null or revenue_amount >= 0),
  constraint campaigns_result_type_check
    check (result_type is null or result_type in ('purchases', 'leads', 'bookings', 'store_visits', 'other')),
  constraint campaigns_result_count_check
    check (result_count is null or result_count >= 0)
);

-- ── 2. Index ────────────────────────────────────────────────
-- Listningen på /campaigns: egna kampanjer, nyast först. Stödjer också
-- RLS-villkoret på user_id.
create index if not exists campaigns_user_created_idx
  on public.campaigns (user_id, created_at desc);

-- Tidigare körningar av samma strategi ("Kör igen"), och RESTRICT-
-- kontrollen när en strategi tas bort.
create index if not exists campaigns_strategy_idx
  on public.campaigns (strategy_id);

-- ── 3. RLS ──────────────────────────────────────────────────
alter table public.campaigns enable row level security;

drop policy if exists "own campaigns - select" on public.campaigns;
drop policy if exists "own campaigns - insert" on public.campaigns;
drop policy if exists "own campaigns - update" on public.campaigns;
drop policy if exists "own campaigns - delete" on public.campaigns;

create policy "own campaigns - select" on public.campaigns
  for select to authenticated
  using ((select auth.uid()) = user_id);

create policy "own campaigns - insert" on public.campaigns
  for insert to authenticated
  with check (
    (select auth.uid()) = user_id
    and exists (
      select 1 from public.campaign_strategies s
      where s.id = campaigns.strategy_id
        and s.user_id = (select auth.uid())
        and s.company_id = campaigns.company_id
    )
    and exists (
      select 1 from public.companies c
      where c.id = campaigns.company_id
        and c.user_id = (select auth.uid())
    )
  );

create policy "own campaigns - update" on public.campaigns
  for update to authenticated
  using ((select auth.uid()) = user_id)
  with check (
    (select auth.uid()) = user_id
    and exists (
      select 1 from public.campaign_strategies s
      where s.id = campaigns.strategy_id
        and s.user_id = (select auth.uid())
        and s.company_id = campaigns.company_id
    )
    and exists (
      select 1 from public.companies c
      where c.id = campaigns.company_id
        and c.user_id = (select auth.uid())
    )
  );

create policy "own campaigns - delete" on public.campaigns
  for delete to authenticated
  using ((select auth.uid()) = user_id);

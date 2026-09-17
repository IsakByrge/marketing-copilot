-- ─────────────────────────────────────────────────────────────
-- Redigerad plantext — det du faktiskt skickar ut
--
-- Lägger till EN ny tabell (plan_text_edits) och EN hjälpfunktion
-- (set_updated_at). INGA befintliga tabeller, kolumner eller rader
-- påverkas. Idempotent och säker att köra flera gånger (IF NOT
-- EXISTS + DROP/CREATE på policyer och trigger).
--
-- REDAN KÖRD I PROD 2026-09-17. Den här filen versionshanterar det
-- som redan finns i databasen — kör den bara om du sätter upp en ny
-- miljö.
--
-- VARFÖR: veckoplanens texter i plans är AI:ns original och ska förbli
-- orörda — det är skillnaden mot din version som är värd något. Din
-- version behövde ändå en plats, en rad per (plan, inlägg). Tidigare
-- låg den i webbläsarens lagring, där den överlevde en utloggning och
-- följde fel konto. item_key är 'post-0', 'post-1', … eller 'nl'.
--
-- Tabellen lagrar faktiskt textinnehåll, precis som text_edits. RLS är
-- därför obligatorisk och strängare än på övriga tabeller: utöver att
-- raden ska ägas av användaren kräver insert och update att planen via
-- plans.company_id hör till ett företag användaren äger. user_id sätts
-- av kolumnens default auth.uid() — klienten skickar den aldrig.
--
-- HUR DEN KÖRS (manuellt, körs INTE automatiskt av appen):
-- 1. Supabase-projektets SQL Editor.
-- 2. Klistra in hela filen och kör.
-- 3. Ingen nedtid, inget backfill-jobb.
--
-- Inga hemligheter, projekt-ID:n eller anslutningssträngar i filen.
-- ─────────────────────────────────────────────────────────────

create table if not exists public.plan_text_edits (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users (id) on delete cascade,
  plan_id     uuid not null references public.plans (id) on delete cascade,
  item_key    text not null,
  edited_text text not null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (user_id, plan_id, item_key)
);

alter table public.plan_text_edits enable row level security;

drop policy if exists "own plan_text_edits - select" on public.plan_text_edits;
drop policy if exists "own plan_text_edits - insert" on public.plan_text_edits;
drop policy if exists "own plan_text_edits - update" on public.plan_text_edits;
drop policy if exists "own plan_text_edits - delete" on public.plan_text_edits;

create policy "own plan_text_edits - select" on public.plan_text_edits
  for select using (auth.uid() = user_id);

create policy "own plan_text_edits - delete" on public.plan_text_edits
  for delete using (auth.uid() = user_id);

create policy "own plan_text_edits - insert" on public.plan_text_edits
  for insert with check (
    auth.uid() = user_id
    and exists (
      select 1 from public.plans p
      join public.companies c on c.id = p.company_id
      where p.id = plan_id and c.user_id = auth.uid()
    )
  );

create policy "own plan_text_edits - update" on public.plan_text_edits
  for update using (auth.uid() = user_id)
  with check (
    auth.uid() = user_id
    and exists (
      select 1 from public.plans p
      join public.companies c on c.id = p.company_id
      where p.id = plan_id and c.user_id = auth.uid()
    )
  );

-- Delad hjälpfunktion: create or replace, så andra tabeller kan
-- använda samma trigger utan att den definieras två gånger.
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end $$;

drop trigger if exists plan_text_edits_updated_at on public.plan_text_edits;

create trigger plan_text_edits_updated_at
  before update on public.plan_text_edits
  for each row execute function public.set_updated_at();

-- 0011 — Vad som faktiskt publicerades, och hur det gick.
--
-- En rad per (plan, inlägg, kanal) som företagaren markerat som publicerad.
-- `text` är det som kopierades ut — inte planens original — så att nästa
-- vecka kan läsa vad som verkligen gick ut.
--
-- Resultatkolumnerna fylls i steg 3 ("Gick det bra?"). De ligger här redan
-- nu så att samma rad bär både publiceringen och utfallet, och så att det
-- blir en migration i stället för två. Siffrorna är företagarens egna,
-- avlästa i Facebook eller Instagram. Ingen av dem räknas fram av appen.
--
-- Måste köras före merge: Innehåll läser och skriver tabellen.

create table if not exists public.published_posts (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null default auth.uid() references auth.users (id) on delete cascade,
  plan_id         uuid not null references public.plans (id) on delete cascade,
  item_key        text not null,
  channel         text not null check (channel in ('facebook', 'instagram')),
  published_on    date not null default current_date,
  text            text not null,
  -- Steg 3. Null = inget svar ännu.
  result_rating   text check (result_rating in ('good', 'bad')),
  reach           integer check (reach >= 0),
  reactions       integer check (reactions >= 0),
  comments        integer check (comments >= 0),
  clicks          integer check (clicks >= 0),
  result_note     text,
  result_at       timestamptz,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (plan_id, item_key, channel)
);

create index if not exists published_posts_user_published_idx
  on public.published_posts (user_id, published_on desc);

alter table public.published_posts enable row level security;

drop policy if exists "own published_posts - select" on public.published_posts;
drop policy if exists "own published_posts - insert" on public.published_posts;
drop policy if exists "own published_posts - update" on public.published_posts;
drop policy if exists "own published_posts - delete" on public.published_posts;

create policy "own published_posts - select" on public.published_posts
  for select to authenticated using ((select auth.uid()) = user_id);

create policy "own published_posts - delete" on public.published_posts
  for delete to authenticated using ((select auth.uid()) = user_id);

-- Planen måste höra till ett företag som ägs av samma användare, så en
-- rad aldrig kan pekas mot någon annans plan.
create policy "own published_posts - insert" on public.published_posts
  for insert to authenticated with check (
    (select auth.uid()) = user_id
    and exists (
      select 1 from public.plans p
      join public.companies c on c.id = p.company_id
      where p.id = plan_id and c.user_id = (select auth.uid())
    )
  );

create policy "own published_posts - update" on public.published_posts
  for update to authenticated using ((select auth.uid()) = user_id)
  with check (
    (select auth.uid()) = user_id
    and exists (
      select 1 from public.plans p
      join public.companies c on c.id = p.company_id
      where p.id = plan_id and c.user_id = (select auth.uid())
    )
  );

-- set_updated_at finns sedan 0005. Fast search_path här, som advisorn
-- påpekat för funktionen; samma kropp, så befintliga triggers påverkas inte.
create or replace function public.set_updated_at()
returns trigger language plpgsql set search_path = '' as $$
begin new.updated_at = now(); return new; end $$;

drop trigger if exists published_posts_updated_at on public.published_posts;

create trigger published_posts_updated_at
  before update on public.published_posts
  for each row execute function public.set_updated_at();

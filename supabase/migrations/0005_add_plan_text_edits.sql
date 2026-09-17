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

create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end $$;

create trigger plan_text_edits_updated_at
  before update on public.plan_text_edits
  for each row execute function public.set_updated_at();

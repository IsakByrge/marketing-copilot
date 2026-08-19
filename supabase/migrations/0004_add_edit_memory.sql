-- ─────────────────────────────────────────────────────────────
-- Redigeringsminne — produktens röstinlärning
--
-- Lägger till EN ny tabell (text_edits). INGA befintliga tabeller,
-- kolumner eller rader påverkas. Idempotent och säker att köra flera
-- gånger (IF NOT EXISTS + DROP/CREATE POLICY).
--
-- VARFÖR: varje gång användaren redigerar en genererad text finns
-- skillnaden mellan AI:ns förslag och det som faktiskt publicerades.
-- Den skillnaden ÄR användarens röst, uttryckt som konkreta
-- korrigeringar. Tidigare kastades den bort. Här sparas den, och de
-- senaste paren matas tillbaka in i prompten så att texterna gradvis
-- låter som användaren i stället för som en modell.
--
-- Till skillnad från ai_usage_events lagrar den här tabellen faktiskt
-- textinnehåll — det är hela poängen. Därför är RLS obligatorisk och
-- strikt: bara ägaren når sina egna rader.
--
-- HUR DEN KÖRS (manuellt, körs INTE automatiskt av appen):
-- 1. Supabase-projektets SQL Editor.
-- 2. Klistra in hela filen och kör.
-- 3. Ingen nedtid, inget backfill-jobb.
--
-- Inga hemligheter, projekt-ID:n eller anslutningssträngar i filen.
-- ─────────────────────────────────────────────────────────────

create table if not exists public.text_edits (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users (id) on delete cascade,
  company_id   uuid,

  -- Vilken sorts text paret gäller: 'product_text', 'facebook_post',
  -- 'newsletter', 'plan_post'. Fri text med flit — nya kanaler ska inte
  -- kräva en migration.
  kind         text not null,

  -- AI:ns förslag och användarens version. Båda krävs; rader där de är
  -- identiska ska aldrig sparas (ingen signal).
  original     text not null,
  edited       text not null,

  -- Valfri etikett för sammanhang, t.ex. produktnamn eller inläggstitel.
  -- Används aldrig i prompten, bara för att kunna felsöka.
  label        text,

  created_at   timestamptz not null default now()
);

create index if not exists text_edits_user_kind_created_idx
  on public.text_edits (user_id, kind, created_at desc);

alter table public.text_edits enable row level security;

-- Användaren når bara sina egna rader. Delete tillåts så att ett par
-- som blev fel (t.ex. en råkad inklistring) går att ta bort — annars
-- skulle skräpdata påverka framtida texter permanent.
drop policy if exists "own text_edits - select" on public.text_edits;
drop policy if exists "own text_edits - insert" on public.text_edits;
drop policy if exists "own text_edits - delete" on public.text_edits;

create policy "own text_edits - select" on public.text_edits
  for select using (auth.uid() = user_id);
create policy "own text_edits - insert" on public.text_edits
  for insert with check (auth.uid() = user_id);
create policy "own text_edits - delete" on public.text_edits
  for delete using (auth.uid() = user_id);

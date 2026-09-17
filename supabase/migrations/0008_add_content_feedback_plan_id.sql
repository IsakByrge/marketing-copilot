-- ─────────────────────────────────────────────────────────────
-- content_feedback.plan_id — tummen ska gälla ETT inlägg i EN plan
--
-- INTE KÖRD ÄNNU.
--
-- ⚠ KÖR DEN DIREKT FÖRE MERGE TILL MAIN — INTE TIDIGARE.
-- Koden som ligger i produktion just nu gör upsert med
-- ON CONFLICT (user_id, company_name, post_index). Den nyckeln släpps
-- här. Körs migrationen medan den gamla koden fortfarande är live
-- slutar tummarna fungera i prod, med 42P10 vid varje försök, tills
-- den här grenen är utrullad. Fönstret ska vara så kort som möjligt:
-- kör migrationen, merga, invänta Vercel-bygget.
--
-- Lägger till en nullbar kolumn, byter unik nyckel och ersätter
-- tabellens ALL-policy med fyra riktade. Ingen rad ändras eller tas
-- bort. Idempotent: går att köra flera gånger.
--
-- VARFÖR: tabellen var unik på (user_id, company_name, post_index).
-- Inlägg 0 i en ny plan delade alltså rad med inlägg 0 i en gammal och
-- ärvde dess tumme. I gränssnittet såg det ut som att varje inlägg i en
-- nygenererad plan redan var gillat. Det förstörde också inlärningen:
-- generate-plan skickade in titlar från gamla planer som om användaren
-- tagit ställning till veckans texter.
--
-- ── OM DEN NYA NYCKELN ──────────────────────────────────────
-- Nyckeln är ETT VANLIGT unikt index, inte ett partiellt med
-- "where plan_id is not null". Det är med flit, och ger samma resultat:
-- i Postgres är NULL aldrig lika med NULL i ett unikt index, så rader
-- med plan_id = null krockar aldrig med varandra.
--
-- Skälet att INTE göra det partiellt är praktiskt: PostgREST:s upsert
-- skickar "ON CONFLICT (user_id, plan_id, post_index) DO UPDATE" utan
-- WHERE-sats. Postgres kan bara härleda ett PARTIELLT index om satsen
-- upprepar indexets predikat. Mot ett partiellt index hade varje
-- upsert från appen fallit med 42P10.
--
-- ── VAD SOM HÄNDER MED BEFINTLIGA RADER ─────────────────────
-- Ingenting. De behåller plan_id = null och ligger kvar. Appen visar
-- dem inte längre som tummar på enskilda inlägg — kopplingen var
-- aldrig pålitlig — men fortsätter läsa dem som signal om vilka ÄMNEN
-- och vilken TON användaren gillat. Ingen feedback går förlorad.
--
-- Efter migrationen har varje plan egna tummar, och historiken bevaras.
--
-- HUR DEN KÖRS (manuellt, körs INTE automatiskt av appen):
-- 1. Supabase-projektets SQL Editor.
-- 2. Klistra in hela filen och kör.
-- 3. Merga grenen direkt efteråt (se varningen överst).
--
-- Inga hemligheter, projekt-ID:n eller anslutningssträngar i filen.
-- ─────────────────────────────────────────────────────────────

-- ── 1. Kolumnen ─────────────────────────────────────────────
alter table public.content_feedback
  add column if not exists plan_id uuid references public.plans (id) on delete cascade;

-- ── 2. Släpp den gamla nyckeln ──────────────────────────────
-- Namnet är inte känt med säkerhet: tabellen skapades i Supabase-
-- gränssnittet, inte av en migration i repot. Blocken letar därför upp
-- varje unikt constraint respektive index som ligger på exakt de tre
-- kolumnerna och släpper det, i stället för att gissa ett namn. Hittas
-- inget händer ingenting — det är så filen blir idempotent.
--
-- attname är av typen "name", inte "text". Utan ::text jämförs name[]
-- med text[], och Postgres svarar "operator does not exist".
do $$
declare
  c record;
begin
  for c in
    select con.conname
    from pg_constraint con
    join pg_class rel on rel.oid = con.conrelid
    join pg_namespace ns on ns.oid = rel.relnamespace
    where ns.nspname = 'public'
      and rel.relname = 'content_feedback'
      and con.contype = 'u'
      and (
        select array_agg(att.attname::text order by att.attname)
        from unnest(con.conkey) as k(attnum)
        join pg_attribute att
          on att.attrelid = con.conrelid and att.attnum = k.attnum
      ) = array['company_name', 'post_index', 'user_id']
  loop
    execute format('alter table public.content_feedback drop constraint %I', c.conname);
    raise notice 'Släppte gammalt constraint: %', c.conname;
  end loop;
end $$;

-- Samma sak för ett fristående unikt index utan constraint.
do $$
declare
  i record;
begin
  for i in
    select idx.relname
    from pg_index ix
    join pg_class idx on idx.oid = ix.indexrelid
    join pg_class rel on rel.oid = ix.indrelid
    join pg_namespace ns on ns.oid = rel.relnamespace
    where ns.nspname = 'public'
      and rel.relname = 'content_feedback'
      and ix.indisunique
      and not exists (select 1 from pg_constraint con where con.conindid = idx.oid)
      and (
        select array_agg(att.attname::text order by att.attname)
        from unnest(ix.indkey::int2[]) as k(attnum)
        join pg_attribute att
          on att.attrelid = rel.oid and att.attnum = k.attnum
      ) = array['company_name', 'post_index', 'user_id']
  loop
    execute format('drop index public.%I', i.relname);
    raise notice 'Släppte gammalt unikt index: %', i.relname;
  end loop;
end $$;

-- ── 3. Den nya nyckeln ──────────────────────────────────────
-- En tumme per (användare, plan, inlägg). Rader med plan_id = null
-- omfattas inte, eftersom NULL aldrig är lika med NULL här.
create unique index if not exists content_feedback_user_plan_post_key
  on public.content_feedback (user_id, plan_id, post_index);

-- Uppslag när gränssnittet hämtar tummarna för den plan som visas.
create index if not exists content_feedback_user_plan_idx
  on public.content_feedback (user_id, plan_id)
  where plan_id is not null;

-- ── 4. Policyer ─────────────────────────────────────────────
-- Tabellen hade EN policy, "egen feedback" FOR ALL, som bara kollade
-- auth.uid() = user_id. Med plan_id i tabellen räcker det inte: raden
-- pekar nu på en plan, och en användare ska inte kunna skriva en tumme
-- som pekar på någon annans plan även om user_id är hens eget.
--
-- Samma mönster som plan_text_edits (0005), med en skillnad: plan_id
-- är nullbart här. Villkoret släpper därför igenom raden när plan_id
-- är null — det är de gamla raderna, som ska gå att läsa och rensa.
--
-- RLS är redan aktiverad på tabellen. Raden nedan är med för en ny
-- miljö och är en no-op när den redan är på.
alter table public.content_feedback enable row level security;

drop policy if exists "egen feedback" on public.content_feedback;
drop policy if exists "own content_feedback - select" on public.content_feedback;
drop policy if exists "own content_feedback - insert" on public.content_feedback;
drop policy if exists "own content_feedback - update" on public.content_feedback;
drop policy if exists "own content_feedback - delete" on public.content_feedback;

create policy "own content_feedback - select" on public.content_feedback
  for select using (
    auth.uid() = user_id
    and (
      plan_id is null
      or exists (
        select 1 from public.plans p
        join public.companies c on c.id = p.company_id
        where p.id = content_feedback.plan_id and c.user_id = auth.uid()
      )
    )
  );

create policy "own content_feedback - insert" on public.content_feedback
  for insert with check (
    auth.uid() = user_id
    and (
      plan_id is null
      or exists (
        select 1 from public.plans p
        join public.companies c on c.id = p.company_id
        where p.id = content_feedback.plan_id and c.user_id = auth.uid()
      )
    )
  );

create policy "own content_feedback - update" on public.content_feedback
  for update using (auth.uid() = user_id)
  with check (
    auth.uid() = user_id
    and (
      plan_id is null
      or exists (
        select 1 from public.plans p
        join public.companies c on c.id = p.company_id
        where p.id = content_feedback.plan_id and c.user_id = auth.uid()
      )
    )
  );

create policy "own content_feedback - delete" on public.content_feedback
  for delete using (auth.uid() = user_id);

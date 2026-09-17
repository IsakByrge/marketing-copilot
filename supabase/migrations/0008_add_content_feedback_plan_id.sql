-- ─────────────────────────────────────────────────────────────
-- content_feedback.plan_id — tummen ska gälla ETT inlägg i EN plan
--
-- INTE KÖRD ÄNNU.
--
-- Lägger till en nullbar kolumn, släpper den gamla unika nyckeln och
-- sätter en ny. Ingen rad ändras eller tas bort. RLS och policyer rörs
-- inte. Idempotent: går att köra flera gånger.
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
-- "where plan_id is not null". Det är med flit, och det ger samma
-- resultat:
--
-- I Postgres är NULL aldrig lika med NULL i ett unikt index (såvida
-- man inte skriver NULLS NOT DISTINCT). Rader med plan_id = null
-- krockar därför aldrig med varandra — de gamla raderna ligger kvar
-- precis som ett partiellt index hade gett.
--
-- Skälet att INTE göra det partiellt är praktiskt: PostgREST:s upsert
-- skickar "ON CONFLICT (user_id, plan_id, post_index) DO UPDATE" utan
-- WHERE-sats. Postgres kan bara härleda ett PARTIELLT index om satsen
-- upprepar indexets predikat. Mot ett partiellt index hade varje
-- upsert från appen fallit med 42P10, "no unique or exclusion
-- constraint matching the ON CONFLICT specification".
--
-- ── VAD SOM HÄNDER MED BEFINTLIGA RADER ─────────────────────
-- Ingenting. De behåller plan_id = null och ligger kvar. Appen visar
-- dem inte längre som tummar på enskilda inlägg — kopplingen var
-- aldrig pålitlig — men fortsätter läsa dem som signal om vilka ÄMNEN
-- och vilken TON användaren gillat. Ingen feedback går förlorad.
--
-- Efter migrationen har varje plan egna tummar, och historiken bevaras:
-- en tumme på inlägg 3 i veckans plan rör inte tummen på inlägg 3 i
-- förra veckans.
--
-- HUR DEN KÖRS (manuellt, körs INTE automatiskt av appen):
-- 1. Supabase-projektets SQL Editor.
-- 2. Klistra in hela filen och kör.
-- 3. Ingen nedtid, inget backfill-jobb.
--
-- Inga hemligheter, projekt-ID:n eller anslutningssträngar i filen.
-- ─────────────────────────────────────────────────────────────

-- ── 1. Kolumnen ─────────────────────────────────────────────
alter table public.content_feedback
  add column if not exists plan_id uuid references public.plans (id) on delete cascade;

-- ── 2. Släpp den gamla nyckeln ──────────────────────────────
-- Namnet är inte känt med säkerhet: tabellen skapades i Supabase-
-- gränssnittet, inte av en migration i repot. Blocket letar därför upp
-- varje unikt constraint som ligger på exakt de tre kolumnerna och
-- släpper det, i stället för att gissa ett namn. Hittas inget händer
-- ingenting — det är så den här filen blir idempotent.
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
        select array_agg(att.attname order by att.attname)
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
        select array_agg(att.attname order by att.attname)
        from unnest(ix.indkey) as k(attnum)
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

-- RLS är redan aktiverad och policyerna är oförändrade:
-- "own content_feedback - select/insert/update/delete" med
-- auth.uid() = user_id. En ny kolumn ärver dem automatiskt.

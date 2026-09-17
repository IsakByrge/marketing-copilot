-- ─────────────────────────────────────────────────────────────
-- content_feedback.plan_id — tummen ska gälla ETT inlägg i EN plan
--
-- Lägger till EN nullbar kolumn och ETT uppslagsindex på en befintlig
-- tabell. INGA rader ändras eller tas bort, inga constraints släpps,
-- inga policyer rörs, ingen RLS påverkas. Idempotent och säker att
-- köra flera gånger.
--
-- INTE KÖRD ÄNNU.
--
-- VARFÖR: tabellen är unik på (user_id, company_name, post_index).
-- Inlägg 0 i en ny plan delar alltså rad med inlägg 0 i en gammal och
-- ärver dess tumme. I gränssnittet syns det som att varje inlägg i en
-- nygenererad plan redan är gillat. Det förstör också inlärningen:
-- generate-plan skickar in titlar från gamla planer som om användaren
-- tagit ställning till veckans texter.
--
-- VARFÖR INGEN NY UNIK NYCKEL: en nyckel på (user_id, plan_id,
-- post_index) hade krockat med den befintliga på (user_id,
-- company_name, post_index) — två rader för samma företag och index
-- men olika planer bryter mot den gamla, och ON CONFLICT kan bara
-- peka på en nyckel i taget. Att släppa den gamla vore inte additivt.
-- Lösningen är i stället att raden UPPDATERAS: det finns fortsatt en
-- rad per (användare, företag, inläggsindex), och plan_id säger vilken
-- plan tummen senast gällde. Appen visar bara tummar vars plan_id
-- matchar den plan som visas.
--
-- FÖLJDEN: tummar samlas inte per plan över tid. Sätter du tummen på
-- inlägg 3 i veckans plan ersätter den tummen på inlägg 3 i förra
-- veckans. Det är rätt avvägning så länge gränssnittet bara visar en
-- plan i taget, och det är ärligare än att visa en tumme som gällde
-- en text användaren aldrig sett.
--
-- VAD SOM HÄNDER MED BEFINTLIGA RADER: ingenting. De behåller
-- plan_id = null och ligger kvar. Appen slutar visa dem som tummar på
-- enskilda inlägg — kopplingen var aldrig pålitlig — men fortsätter
-- skicka dem till prompten som signal om vilka ÄMNEN och vilken TON
-- användaren gillat. Ingen feedback går förlorad; den slutar bara
-- påstå mer än den vet.
--
-- Nullbar med flit: gamla rader har ingen plan att peka på, och att
-- gissa fram en vore att hitta på data.
--
-- HUR DEN KÖRS (manuellt, körs INTE automatiskt av appen):
-- 1. Supabase-projektets SQL Editor.
-- 2. Klistra in hela filen och kör.
-- 3. Ingen nedtid, inget backfill-jobb.
--
-- Inga hemligheter, projekt-ID:n eller anslutningssträngar i filen.
-- ─────────────────────────────────────────────────────────────

alter table public.content_feedback
  add column if not exists plan_id uuid references public.plans (id) on delete cascade;

-- Gränssnittet hämtar tummarna för den plan som visas.
create index if not exists content_feedback_user_plan_idx
  on public.content_feedback (user_id, plan_id)
  where plan_id is not null;

-- RLS är redan aktiverad på tabellen och policyerna är oförändrade:
-- "own content_feedback - select/insert/update/delete" med
-- auth.uid() = user_id. En ny kolumn ärver dem automatiskt.

-- ─────────────────────────────────────────────────────────────
-- Company Brain 1.1 — lägger till ett strukturerat, redigerbart
-- företagsminne på befintliga companies-tabellen.
--
-- MVP-VAL: ett enda JSONB-fält (company_brain) i stället för att
-- normalisera produkter/konkurrenter till egna tabeller. Detta är
-- avsiktligt — datamodellen (app/_shared/companyBrain.ts) är redan
-- strukturerad på applikationsnivå, och ett JSONB-fält kräver ingen
-- ny RLS-policy (ärver den som redan skyddar raden), inga nya
-- foreign keys och inga skrivningar på flera tabeller. Om Content
-- Engine senare behöver fråga enskilda produkter direkt i SQL kan
-- de normaliseras då.
--
-- SÄKERT ATT KÖRA FLERA GÅNGER: IF NOT EXISTS gör detta idempotent.
-- INGA BEFINTLIGA KOLUMNER ELLER RADER PÅVERKAS — gamla profilfält
-- (name, industry, summary, customers, products, tone, strengths,
-- avoid, content_guidelines, best_customer, ...) lämnas helt orörda.
-- Appen migrerar dem till Company Brain-formatet i minnet första
-- gången en användare besöker /company, och skriver bara till
-- company_brain — aldrig till de gamla kolumnerna.
--
-- HUR DEN KÖRS:
-- 1. Öppna Supabase-projektets SQL-editor (dashboard.supabase.com →
--    ditt projekt → SQL Editor).
-- 2. Klistra in hela denna fil och kör den.
-- 3. Ingen nedtid, inget backfill-jobb krävs — befintliga rader får
--    company_brain = NULL tills de sparas första gången i det nya
--    gränssnittet, och appen hanterar NULL som "inget företagsminne
--    sparat ännu" (bygger ett kompatibelt sådant ur de gamla fälten).
--
-- Inga hemligheter, projekt-ID:n eller anslutningssträngar i denna fil.
-- ─────────────────────────────────────────────────────────────

alter table public.companies
  add column if not exists company_brain jsonb not null default '{}'::jsonb;

comment on column public.companies.company_brain is
  'Company Brain 1.1 — strukturerad företagskunskap (se app/_shared/companyBrain.ts::CompanyBrain). Tomt objekt = inget sparat ännu; appen migrerar då från de äldre kolumnerna i minnet.';

-- RLS: inga nya policies behövs. Radnivå-säkerheten som redan begränsar
-- SELECT/INSERT/UPDATE på companies till auth.uid() = user_id gäller
-- automatiskt även för den nya kolumnen, eftersom RLS-policies verkar på
-- HELA raden, inte per kolumn.

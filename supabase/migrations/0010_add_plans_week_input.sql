-- 0010 — Veckans underlag på planen.
--
-- Det företagaren skriver om veckan innan planen skapas ("Vad händer hos
-- er den här veckan?"). Sparas med planen så att det går att se vad en
-- plan byggdes på, och så att nästa vecka kan läsa det.
--
-- Null = inget underlag lämnades, och alla planer före den här migrationen.
-- Ingen ny policy behövs: "own plans" gäller hela raden.
--
-- MÅSTE köras före merge. Dashboarden skriver week_input vid insert, och
-- PostgREST avvisar hela insert-satsen med 42703 om kolumnen saknas — då
-- sparas ingen plan alls (samma fel som före 0006).

alter table public.plans
  add column if not exists week_input text;

comment on column public.plans.week_input is
  'Företagarens eget underlag för veckan, skrivet innan planen skapades. Null = inget lämnat.';

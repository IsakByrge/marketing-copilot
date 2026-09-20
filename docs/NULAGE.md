# Nuläge

Skrivet 2026-09-20 mot commit `3a0b54c` (gren `fix/ai-felmeddelanden`, allt utom
PR #16 är merge:at till `main`).

Varje påstående här är läst ur koden eller frågat av produktdatabasen. Det jag
inte kunnat verifiera är märkt **[OVERIFIERAT]** med skälet.

Så verifierades schemat: alla tabeller och kolumner nedan frågades via
PostgREST mot `https://kyvenaoyvggrzzztmjxt.supabase.co` med anon-nyckeln
(`select=<kolumn>&limit=1`). Finns inte tabellen svarar PostgREST `PGRST205`,
saknas kolumnen `42703`. Alla åtta tabeller och varje namngiven kolumn svarade
utan fel.

---

## 1. Vad appen kan göra idag

Sju arbetande ytor, alla bakom inloggning:

| Yta | Vad den gör | Läge |
|---|---|---|
| Onboarding | Läser företagets hemsida, föreslår svar, ställer fyra frågor, genererar första veckoplanen | Klar |
| Idag (`/dashboard`) | Visar senaste veckoplanen, genererar en ny | Klar |
| Innehåll (`/innehall`) | Planens inlägg och nyhetsbrev, redigering, tummar, kopiering, bildgenerering | Klar |
| Produkttexter (`/produkttexter`) | CSV in, texter skrivs artikel för artikel, CSV ut för import | Klar |
| Facebook (`/content/facebook`) | Ett inlägg med två alternativ, granskat och kvalitetsmärkt | Klar |
| Kampanjstrategi (`/campaign-builder`) | Underlag, analys, följdfrågor, rekommendation | Klar |
| Historik (`/history`) | Tidigare veckoplaner | Klar |
| Kampanjer (`/campaigns`) | Visar planens kampanjförslag | Halvbyggd, se avsnitt 8 |

Appen har noll användare enligt `CLAUDE.md`. **[OVERIFIERAT]** — jag kan inte
räkna rader i `auth.users` eller `companies` med anon-nyckeln, RLS döljer allt.

---

## 2. Huvudfunktioner och användarflöden

### Onboarding → första planen
`app/onboarding/page.tsx`. Namn och hemsida → `POST /api/analyze-company`, som
hämtar sidan via `lib/server/ssrf.ts` (`safeFetchWebsite`) och låter modellen
föreslå profilfält. Användaren bekräftar eller ändrar fyra frågor (bästa kund,
vanligaste frågan, differentiator, ett nyligen utfört jobb). Företaget upsertas
i `companies`, därefter `POST /api/generate-plan`, och planen sparas som en rad
i `plans`. Misslyckas något visas serverns besked, och vid misslyckad plan
kommer man tillbaka till frågorna med svaren kvar (PR #16).

### Veckoplan
`POST /api/generate-plan` bygger prompten i `lib/server/planPrompt.ts`, kör ett
modellanrop, räknar orden i svaret och kör vid behov **en** reparationsrunda
(`lib/server/planRepair.ts`) för texter under golvet, validerar (`planValidate.ts`)
och returnerar. Dashboard skriver in raden i `plans`. Fem inlägg med bestämda
roller (`saljande`, `tips`, `prioriterad_produkt`, `lokalt`, `socialt`), ett
nyhetsbrev, kampanjförslag och möjligheter.

### Produkttexter
Fyra steg i `app/produkttexter/page.tsx`: välj CSV, bekräfta kolumner, arbeta i
listan, granska och exportera. Arbetspasset ligger i webbläsarens IndexedDB
(`app/produkttexter/_lib/db.ts`) — filen lämnar aldrig datorn. Servern får bara
de valda artiklarnas fält. Per batch: ett nyckelordsanrop, ett skrivanrop och
vid behov ett omskrivningsanrop. Export är hela katalogen med `Ignore=1` på allt
utom det godkända.

### Facebook Specialist
`POST /api/content/facebook` strömmar NDJSON med faser. Motorn
(`lib/facebook/specialist.ts`) gör högst tre anrop: utkast (med två alternativ),
granskning, och högst en revision. Deterministiska kontroller efter modellen
äger längd, förbjudna påståenden, social proof, klichéer, produkt och
erbjudande, samt påhittad brådska.

### Kampanjstrategi
`POST /api/strategist/analyze` → 0–4 följdfrågor → `POST /api/strategist/recommend`.
Resultatet sparas i `campaign_strategies` och kan öppnas i Facebook-flödet via
strategi-id.

---

## 3. Navigation och viktigaste sidorna

Rutter skyddas i `proxy.ts` (Next 16 har döpt om `middleware` till `proxy`,
bekräftat i `node_modules/next/dist/docs/.../proxy.md`; versionen är 16.2.7 med
React 19.2.4). Skyddade prefix: `/dashboard`, `/onboarding`, `/campaign-builder`,
`/campaigns`, `/content`, `/company`, `/history`, `/produkttexter`, `/innehall`.
Inloggad besökare på `/login` skickas till `/auth/callback`.

Menyn i `app/_shared/AppShell.tsx`, desktopordning: Idag, Innehåll,
Produkttexter, Facebook, Kampanjbyggaren, Historik, Vad jag vet. På mobil ligger
fyra i bottenraden (Idag, Innehåll, Produkttexter, Facebook) och resten bakom
"Mer". `/campaigns` har ingen egen menypost och nås via "Mer".

Publika sidor: `/` (landningssida med Veckans bräda), `/login`, `/auth/reset`,
`/auth/callback`.

---

## 4. Company Brain

**Vad som lagras.** Ett jsonb-fält, `companies.company_brain` (verifierat i
prod). Strukturen ligger i `app/_shared/companyBrain.ts`: `companySummary`,
`primaryCustomers`, `strengths`, `uniqueSellingPoints`, `tone`,
`contentGuidelines`, `forbiddenClaims`, `preferredCallsToAction`,
`commonCustomerObjections`, `proofPoints`, `competitors`, `locations`,
`websites`, `products`, `keySeasons`, `marketingGoals`, `lastReviewedAt`.

De gamla kolumnerna från onboardingen finns kvar bredvid och är verifierade i
prod: `industry`, `summary`, `customers`, `products`, `tone`, `strengths`,
`avoid`, `content_guidelines`, `best_customer`, `common_question`,
`differentiator`, `recent_job`.

**Hur det skapas.** Onboardingen fyller de gamla kolumnerna. `company_brain`
byggs vid första läsningen ur dem (`useCompanyBrain.ts` och
`lib/companyBrainServer.ts` gör samma migrering var för sig) och redigeras sedan
på `/company`.

**Hur AI:n använder det.** Serversidan läser alltid själv, aldrig via klienten:
`getCompanyBrainContext()` (minimerad kontext) och `getCompanyBrain()`
(fullständig). Det går in i planprompten (`brainBlock`), faktaspärren
(`factGuardBlock`), Facebook-kontexten (`lib/facebook/context.ts`),
produkttexternas prompt och strategens kontext.

**Hur det uppdateras.** `/company` skriver hela objektet med `update` på
`company_brain` och sätter `lastReviewedAt`. Sidan visar kunskapsnivå
(`basic`/`useful`/`strong`) och högst tre kunskapsluckor åt gången — en
deterministisk nivå, aldrig en procentsats.

---

## 5. AI-arkitekturen

**Provider: OpenAI, ingen annan.** Inga andra modell-API:er förekommer i koden.

**Modeller (standardvärden i koden):**

| Var | Variabel | Standard |
|---|---|---|
| Alla JSON-routes | `AI_CHAT_MODEL` | `gpt-4o-mini` |
| Veckoplanen | `PLAN_MODEL` | `gpt-4o-mini` |
| Bilder | `AI_IMAGE_MODEL` | `gpt-image-1` |
| Strategen | `STRATEGIST_MODEL` | `gpt-4o` |
| Facebook utkast | `FACEBOOK_DRAFT_MODEL` | `gpt-4o` |
| Facebook granskning | `FACEBOOK_REVIEW_MODEL` | `gpt-4o-mini` |

**[OVERIFIERAT]**: vilka värden som faktiskt är satta i prod. Vercel svarade
403 Forbidden på `filter_project_envs` — kontot får inte lista projektets
miljövariabler. Tabellen visar alltså fallbacken i koden, inte driftläget.

**API-routes (14 st).** Med modell: `analyze-company`, `campaign-analysis`,
`campaign-interview`, `content/facebook`, `create-content`, `edit-image`,
`generate-image`, `generate-plan`, `product-texts`, `strategist/analyze`,
`strategist/recommend`. Utan modell: `product-texts/source` (hämtar
produktsidor), `text-edits` (sparar redigeringspar), `usage` (kostnadsvy).

**Så är prompterna byggda.** Servern äger varje prompt. Klienten skickar
strukturerad data, aldrig prompttext — `contentPrompt.ts` avvisar uttryckligen
fält som skulle återöppna den gamla öppna proxyn. Delade block:
`factGuard.ts` (faktaspärr, används av plan, Facebook, produkttexter och
strategen), `voice.ts` (skrivregler och förbjudna fraser), `season.ts` och
`locations.ts` (planen), `editMemory.ts` (användarens egna omskrivningar).

**Tool calling används inte.** Ingen förekomst av `tools:`, `tool_choice`,
`functions:` eller `function_call` i repot. Allt går via
`response_format: { type: "json_object" }` och egen validering av svaret.

**Kontext skickas som text.** Ingen RAG, inga embeddings, ingen vektordatabas.
Kontexten byggs server-side ur Company Brain, briefen och eventuell
kampanjstrategi, och kapas med uttalade gränser (till exempel produkttexternas
8 000 tecken ren text per artikel).

**Gemensam ingångskontroll.** `guardAiRequest()` i `lib/server/guard.ts`: kräver
inloggning (401), samtidighetslås och glidande fönster (429, standard 20 anrop
per 60 s per användare och funktion), och `finish()` som skriver
användningsloggen. Gränsen ligger i processminnet, alltså per instans på Vercel
och nollställd vid kallstart — det står uttryckligen i `rateLimit.ts`.

**Felhantering (PR #16, ej merge:ad ännu).** `lib/server/aiError.ts` delar in
modellfel i `saldo` (401, 402, 429), `tidsgrans` och `fel`, med olika besked och
status (503/504/500).

---

## 6. Analytics och data

Det finns **ingen produktanalys** av användarbeteende: ingen spårning, inga
händelser, inget analysverktyg i koden.

Det som mäts är AI-användning och kostnad. Källa: tabellen `ai_usage_events`,
en rad per anrop, skriven av `guard.finish()`. Fält (verifierade i prod):
`feature`, `model`, `status`, `started_at`, `ended_at`, `duration_ms`,
`error_category`, `prompt_tokens`, `completion_tokens`.

`GET /api/usage?days=N` (1–90 dagar) aggregerar via
`lib/server/usageReport.ts` till: antal anrop, antal fel, uppskattad kostnad i
USD och samma mått per funktion. Priser finns bara för `gpt-4o` och
`gpt-4o-mini` plus två bildpriser; saknas priset sätts noll och flaggan
`hasUnknownModel` — aldrig en gissad siffra.

Vyn är administratörsbegränsad på servern: `ADMIN_EMAILS`, kontrollerad i
routen med `isAdminEmail`. Saknas variabeln är ingen administratör.
`UsagePanel` visas på `/dashboard`.

**[OVERIFIERAT]**: hur mycket data som faktiskt ligger i `ai_usage_events` i
prod. RLS gör att anon-nyckeln inte ser några rader.

---

## 7. Databasstruktur

Åtta tabeller, alla verifierade i prod:

| Tabell | Vad | Relation |
|---|---|---|
| `companies` | Företagsprofil + `company_brain` (jsonb) | `user_id` → `auth.users` |
| `plans` | En rad per genererad veckoplan (INSERT, aldrig upsert) | `company_id` → `companies`, `user_id` |
| `content_feedback` | Tummar upp/ned per inlägg | `plan_id` → `plans` (sedan 0008), `user_id`, `company_name` (text) |
| `plan_text_edits` | Användarens redigerade plantext, en rad per `(plan, item_key)` | `plan_id` → `plans`, `user_id` |
| `text_edits` | Par av AI-text och behållen text, för röstinlärning | `user_id`, `company_id` |
| `campaign_strategies` | Sparad kampanjstrategi (`strategy_context`, `recommendation`) | `user_id`, `company_id` |
| `content_drafts` | Sparade Facebook-utkast (`brief`, `result`, `edited`, `edited_text`) | `user_id`, `company_id` |
| `ai_usage_events` | En rad per modellanrop | `user_id`, `company_id` |

`content_feedback.company_name` är text, inte en främmande nyckel — ett arv från
innan `plan_id` fanns.

### Migrationernas status

| Fil | Innehåll | Status |
|---|---|---|
| `0000_baseline.sql` | `companies`, `plans`, `content_feedback` | **Aldrig körd, ska inte köras.** Rekonstruerad ur koden, inte ur en prod-dump. `create table if not exists` gör den till en no-op mot en befintlig databas. Läs som dokumentation. |
| `0001_add_company_brain.sql` | `companies.company_brain` | Körd |
| `0002_add_content_engine.sql` | `campaign_strategies`, `content_drafts` | Körd |
| `0003_add_ai_usage_events.sql` | `ai_usage_events` | Körd |
| `0004_add_edit_memory.sql` | `text_edits` | Körd |
| `0005_add_plan_text_edits.sql` | `plan_text_edits` + RLS + trigger | Körd |
| `0006_add_plans_opportunities.sql` | `plans.opportunities` | Körd 2026-09-17 |
| `0007_add_plans_intro.sql` | `plans.intro` | Körd |
| `0008_add_content_feedback_plan_id.sql` | `content_feedback.plan_id`, ny unik nyckel, fyra RLS-policyer | Körd 2026-09-17 |

Körstatusen kommer ur projektminnet och PR #3/#4, inte ur databasen.
**[OVERIFIERAT]** i den meningen att anon-nyckeln inte kan läsa
`supabase_migrations`. Att kolumnerna finns är däremot verifierat.

**Delar av schemat skapades i Supabases gränssnitt och finns inte i repot.**
Det gäller de ursprungliga tabellerna som `0000` rekonstruerar i efterhand, och
RLS-policyer som aldrig skrevs som migration. Vad som exakt skapades i
gränssnittet går inte att läsa ur repot. **[OVERIFIERAT]** — kräver
service_role eller Supabase-konsolen.

**RLS**: migrationerna slår på RLS på alla åtta tabeller. Anon-nyckeln fick noll
rader ur samtliga, vilket är förenligt med både aktiv RLS och tomma tabeller.
**[OVERIFIERAT]** vilken av delarna, samt vilka policyer som faktiskt ligger i
prod. `service_role`-nyckeln används inte någonstans i koden.

---

## 8. Content- och marknadsföringsfunktioner

**Klart:**
- Veckoplan med fem roller, nyhetsbrev, kampanjförslag och möjligheter.
- Redigering av plantext, sparad i `plan_text_edits` per `(plan, item_key)`.
- Tummar upp/ned per inlägg, sparade i `content_feedback` per `(user, plan, post)`.
- Facebook-inlägg med två alternativ, granskning, revision och bildbrief.
- Produkttexter hela vägen från butikens export till importfil.
- Kampanjstrategi som kan öppnas i Facebook-flödet.
- Bildgenerering via `ImageMaker` på Facebook- och innehållssidan.

**Halvbyggt:**
- **`/campaigns` spårar inga kampanjer.** Sidan säger det själv: det finns ingen
  datamodell för status, datum eller kanal. Den visar planens kampanjförslag,
  märkta som förslag.
- **Sparade Facebook-utkast går inte att läsa.** `content_drafts` skrivs på
  Facebook-sidan (`insert`), men ingen kod någonstans läser tabellen. Utkastet
  försvinner ur gränssnittet när man lämnar sidan.
- **`/api/edit-image` har ingen anropare.** Routen finns och fungerar; ingen
  klient anropar den. `ImageMaker` använder bara `/api/generate-image`.
- **Produktsidorna måste kontrolleras manuellt.** 404-filtret i produkttexter
  vet bara om sidor som hämtats, därav knappen "Kontrollera produktsidor".
- **Tummarnas signal används bara som ämne och ton.** `content_feedback` läses
  in i planprompten, men ingen inlärning utöver det.

---

## 9. Hur företagsdatan används för personalisering

Kedjan är densamma överallt: klienten skickar id:n och strukturerad data,
servern hämtar företaget ur sessionen och bygger kontexten själv.

- **Planen**: `brainBlock()` lägger in sammanfattning, kunder, ton, styrkor,
  USP:ar, riktlinjer, förbjudna påståenden, säsonger, produkter med prioritet,
  depåer och webbplatser. Säsong (`season.ts`) och orter (`locations.ts`) styr
  vad som föreslås när.
- **Facebook**: `contextBlock()` lägger faktaspärren först, sedan företaget,
  vald produkt och kampanjstrategi. Prioritet och lönsamhet skickas med som
  internt beslutsunderlag och får aldrig bli text.
- **Produkttexter**: Company Brain ger ton och bekräftade produktfakta;
  butikens egen text och produktsida är huvudkälla.
- **Strategen**: egen företagskontext i `lib/strategist/companyContext.ts`.
- **Rösten**: `editMemory.ts` läser tidigare par av AI-text och behållen text ur
  `text_edits` och lägger dem i prompten, per texttyp (`product_text`,
  `facebook_post`, `newsletter`, `plan_post`).

Två deterministiska spärrar gäller allt: `factGuard.ts` (inga påhittade fakta,
inga påhittade omdömen) och `voice.ts` (förbjudna fraser).

---

## 10. Integrationer

- **OpenAI** — enda AI-providern.
- **Supabase** — auth, databas, RLS. Klient i webbläsaren (`supabase-browser`),
  server (`supabase-server`) och i `proxy.ts`.
- **Vercel** — drift, bygge från `main`, loggar.
- **Butikens webbplats över HTTP** — produkttexter hämtar produktsidor med
  robots.txt-kontroll, SSRF-skydd och en sida per sekund; onboardingen hämtar
  hemsidan via `safeFetchWebsite`.

Inga andra integrationer: ingen Facebook-publicering, ingen e-post, ingen
betalning, ingen CRM-koppling.

---

## 11. Historik, minne och inlärning

- **Planhistorik**: `plans` växer med en rad per generering. `useAccountData`
  hämtar de 20 senaste; `/history` listar dem.
- **Redigeringsminne**: `POST /api/text-edits` sparar par av AI-text och
  behållen text när ändringen är meningsfull (`isMeaningfulEdit`). De läses
  tillbaka in i prompten av `editMemoryBlock()`.
- **Tummar**: `content_feedback`, en rad per `(user, plan, post)` efter 0008.
- **Arbetspass för produkttexter**: IndexedDB i webbläsaren, inte i databasen.
  Katalogen lämnar aldrig datorn.
- **Ingen inlärning över konton.** Ingen modell tränas, ingenting delas mellan
  företag.

---

## 12. Teknisk skuld, duplicerad logik och känsliga delar

**Död kod** (noll importer, verifierat):
- `lib/mockPlans.ts` (174 rader)
- `lib/generatedPlan.ts` (8 rader)
- `lib/supabase.ts`
- `app/_shared/theme.ts` och `app/_shared/themeLight.ts`

**Duplicerad logik:**
- Migreringen av gamla profilkolumner till `company_brain` finns två gånger:
  `app/_shared/useCompanyBrain.ts` (klient) och `lib/companyBrainServer.ts`
  (server). De måste hållas i takt manuellt.
- Ordmatchning med böjningstolerans finns både i
  `lib/productText/hardFacts.ts` (`mentions`) och i `lib/facebook/quality.ts`
  (`nameMentioned`). De löser samma problem för olika ytor.
- `getCompanyBrainContext` och `getCompanyBrain` delar migreringslogik i samma
  fil.

**Känsliga delar:**
- **Rate limit i processminnet.** Per instans, nollställs vid kallstart. Räcker
  mot dubbelklick, inte mot avsiktligt missbruk.
- **Hämtning av externa sidor.** `safeUrl.ts`, `robots.ts` och `ssrf.ts` står
  mellan användarens CSV och vår server. Dokumenterat glapp: DNS kan svara
  annorlunda mellan kontrollen och hämtningen.
- **Faktaspärrarna.** `factGuard`, `planValidate`, `quality.ts` och
  `hardFacts.ts` är det som hindrar påhittade fakta. Ändras en lista utan test
  faller en spärr tyst.
- **Tidsbudgeten.** Facebook-routen har `maxDuration` 120 s men kan göra tre
  anrop à 45 s; produkttexter har 150 s och tre anrop. Marginalen är tunn, och
  jag har inte mätt utfallet. **[OVERIFIERAT]** — ingen timeout har observerats
  i loggarna, bara resonerad risk.
- **`0000_baseline.sql` är rekonstruerad.** En ny miljö byggd ur den är inte
  bevisat identisk med prod.

**Städat (verifierat i git):** `uiLight.tsx` borttagen i PR #9. Åtta sidfiler är
raderade i historiken: `app/campaign/`, `app/content/`, `app/create/`,
`app/generating/`, `app/newsletter/`, `app/plan/`, `app/post/[id]/` och
`app/profile/`. (Du minns sju; git visar åtta.) `localStorage` används inte
längre för affärsdata — enda förekomsten i appkoden är
`app/_shared/appStorage.ts`, som bara städar egna nycklar vid utloggning.

---

## 13. De tio viktigaste delarna av systemet

1. **Company Brain** (`app/_shared/companyBrain.ts` + `companies.company_brain`) — allt innehåll hänger på den.
2. **`lib/server/guard.ts`** — auth, rate limit och användningslogg för varje AI-route.
3. **`lib/server/planPrompt.ts` + `planValidate.ts` + `planRepair.ts`** — veckoplanen, produktens kärna.
4. **`lib/facebook/specialist.ts`** — trestegsmotorn för Facebook.
5. **`lib/facebook/quality.ts`** — de deterministiska kontrollerna efter modellen.
6. **`lib/productText/prompt.ts` + `hardFacts.ts` + `keywords.ts`** — produkttexternas faktakontroll.
7. **`lib/server/factGuard.ts` + `voice.ts`** — de delade spärrarna mot påhitt och tomma fraser.
8. **`proxy.ts`** — rutt-skyddet och sessionskakorna.
9. **`lib/server/aiError.ts`** — felbesked som skiljer saldo, tidsgräns och fel (PR #16).
10. **Migrationerna `0001`–`0008`** — det enda versionshanterade om schemat.

---

## CURRENT ARCHITECTURE SUMMARY

1. Next.js 16.2.7 med App Router, React 19.2.4, TypeScript, Tailwind. Drift på Vercel, bygge från `main`.
2. Rutt-skydd i `proxy.ts` — Next 16 har döpt om `middleware` till `proxy`; filen bevarar förnyade sessionskakor vid omdirigering.
3. Supabase är enda källan för affärsdata: auth, åtta tabeller, RLS. Ingen `service_role`-nyckel i koden.
4. OpenAI är enda AI-providern. Inga embeddings, ingen vektordatabas, ingen RAG.
5. Ingen tool calling. Allt är JSON-läge plus egen validering av svaret.
6. Servern äger varje prompt. Klienten skickar strukturerad data och id:n, aldrig prompttext.
7. `guardAiRequest()` framför varje AI-route: inloggning, samtidighetslås, rate limit (20/60 s per användare och funktion), användningslogg.
8. Rate limit ligger i processminnet: per instans, nollställd vid kallstart. Medvetet enkelt, dokumenterat.
9. Modeller via env med fallback i koden: `gpt-4o` för Facebook-utkast och strategen, `gpt-4o-mini` för resten, `gpt-image-1` för bild. Prod-värdena är overifierade (Vercel gav 403).
10. Sju arbetande ytor bakom inloggning, plus publik landningssida och inloggning.
11. Veckoplanen: ett modellanrop, en villkorad reparationsrunda, deterministisk validering, en rad per generering i `plans`.
12. Facebook: högst tre anrop (utkast, granskning, en revision) med deterministiska kontroller efter varje modellsvar.
13. Produkttexter: nyckelordsanrop, skrivanrop, vid behov omskrivning; arbetspasset i IndexedDB, aldrig i vår databas.
14. Deterministiska spärrar äger sanningen: längd, förbjudna påståenden, social proof, klichéer, produkt och erbjudande, påhittad brådska, tal och förkortningar ur före-texten.
15. Faktaspärren (`factGuard`) och skrivreglerna (`voice`) delas av plan, Facebook, produkttexter och strategen.
16. Company Brain är jsonb — nya fält kräver ingen migration, och så har depåer och webbplatser tillkommit.
17. Röstinlärning ur `text_edits`: par av AI-text och behållen text går tillbaka in i prompten per texttyp.
18. Tummar i `content_feedback`, en rad per `(user, plan, post)` sedan migration 0008.
19. Plantextredigeringar i `plan_text_edits` — flyttade från webbläsaren till databasen bakom RLS.
20. Kostnadsmätning i `ai_usage_events` med aggregat i `/api/usage`, administratörsbegränsad via `ADMIN_EMAILS` på servern.
21. Ingen produktanalys av användarbeteende, ingen spårning.
22. Externa hämtningar går genom SSRF-skydd, robots.txt och en sida per sekund per värd.
23. Migrationer körs manuellt i Supabase SQL Editor. Appen kör aldrig någon själv. `0000` är rekonstruerad och ska inte köras.
24. Delar av schemat skapades i Supabases gränssnitt och finns inte i repot; `0000` är efterhandsdokumentation, inte källan.
25. Felbesked från modellanrop delas i saldo, tidsgräns och fel, med 503/504/500 (PR #16, ännu ej merge:ad).
26. `uiLight.tsx` är borttagen; alla sidor ligger på `primitives`. `localStorage` används inte längre för affärsdata.
27. Åtta sidfiler har raderats ur appen; ingen kvarvarande yta saknar väg i navigationen.
28. Död kod finns kvar: `mockPlans.ts`, `generatedPlan.ts`, `lib/supabase.ts`, `theme.ts`, `themeLight.ts`.
29. `content_drafts` skrivs men läses aldrig, och `/api/edit-image` har ingen anropare — två halvbyggda ändar.
30. 25 testsviter körs i CI tillsammans med lint, typecheck och bygge; alla är rena logiktester utan nät och databas.

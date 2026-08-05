# Marketing Copilot – Sprint Review

> Detta dokument är genererat som granskningsunderlag. Det är en **lokal, ospårad fil** och är
> varken committad eller pushad. Inga kodändringar, refaktoreringar eller merges har gjorts.

---

## 1. Versionsinformation

| Fält | Värde |
|---|---|
| Datum | 2026-07-22 |
| Aktiv branch | `feature/marketing-strategist-v2` |
| Commit hash | `140351d6d0f15e9a5977fc2eed8e69c5bcf58e9e` (`140351d`) |
| Commit-meddelande | `feat(strategist): 4-phase Marketing Strategist UI on /campaign-builder` |
| Senaste tagg | `v0.1.0-marketing-strategist` (pekar på HEAD) |
| Remote | `origin` → `https://github.com/IsakByrge/marketing-copilot.git` |
| Upstream | `origin/feature/marketing-strategist-v2` (0 ahead / 0 behind) |
| Node-version | `v24.15.0` |
| Paketmanager | `npm` `11.12.1` (lockfil: `package-lock.json`, lockfileVersion 3) |
| Ramverk | Next.js `16.2.7` (App Router, Turbopack), React `19.2.4` |
| Övriga kärnberoenden | `openai ^6.42.0`, `@supabase/ssr ^0.12.0`, `@supabase/supabase-js ^2.108.1`, `tailwindcss ^4`, `typescript ^5` |
| Spårade filer i repot | 87 |

---

## 2. Aktuellt produktläge

Marketing Copilot är en svenskspråkig AI-marknadsföringsassistent för mindre företag. En inloggad
användare kan idag:

1. **Registrera sig / logga in** med e-post + lösenord via Supabase Auth (`/login`).
2. **Onboarda sitt företag** (`/onboarding`): ange företagsnamn och hemsida, varpå appen skrapar
   start-, om-oss- och kontaktsidor och låter en AI föreslå en komplett företagsprofil
   (bransch, sammanfattning, kunder, produkter, tonläge, styrkor, sådant att undvika,
   innehållsriktlinjer) som användaren kan redigera innan den sparas.
3. **Bygga och underhålla sin Company Brain** (`/company`): en strukturerad, redigerbar
   företagskunskap med produkter (lönsamhet, prioritet, invändningar, differentiatorer),
   konkurrenter, målgrupper, tonläge, innehållsregler, förbjudna påståenden, verifierat socialt
   bevis och säsonger. Sidan visar en deterministisk kunskapsnivå (basic/useful/strong) och de tre
   viktigaste kunskapsluckorna som konkreta frågor.
4. **Generera en veckovis marknadsplan** (`/dashboard` → `/generating` → `/plan`): fem sociala
   inlägg, ett nyhetsbrev, två kampanjförslag och tre säsongs-/händelsemöjligheter. Planen sparas
   som en ny rad i `plans` och syns i **Historik** (`/history`).
5. **Köra Marketing Strategist 2.0** (`/campaign-builder`): ett fyrafas-flöde — kort brief →
   AI-analys → 0–4 adaptiva följdfrågor → färdig, strukturerad strategirekommendation. Strategin
   sparas som `StrategyV2` i `campaign_strategies`.
6. **Skapa ett Facebook-inlägg med Facebook Specialist** (`/content/facebook`): kan förifyllas från
   en sparad strategi (v1 eller v2), kör draft → kvalitetsgranskning → högst en revision, streamar
   ärliga processfaser och kan spara utkastet i `content_drafts`.
7. **Skapa fristående innehåll** (`/create`): socialt inlägg, LinkedIn, nyhetsbrev, kampanj,
   erbjudande, kundcase eller fritext.
8. **Läsa och arbeta med genererat innehåll**: `/content` (översikt), `/post/[id]` (enskilt inlägg
   med tummen upp/ner-feedback samt AI-bildgenerering och bildredigering), `/newsletter`,
   `/campaign`, `/campaigns`.

**Vad användaren ännu INTE kan göra:** publicera till någon kanal, schemalägga, mäta utfall, se en
lista över sparade Facebook-utkast, eller följa "aktiva" kampanjer med status/datum.

---

## 3. Implementerade huvudområden

1. **Autentisering och routeskydd** — Supabase Auth (e-post/lösenord), cookie-baserad session,
   `proxy.ts` (Next.js 16 Proxy/middleware) som skyddar alla appvyer och skickar utloggade till
   `/login`. `/auth/callback` dirigerar vidare till `/onboarding` eller `/dashboard` beroende på om
   ett företag finns.
2. **Onboarding med hemsideanalys** — `/api/analyze-company` skrapar upp till tre sidor
   (start, om-oss, kontakt) och bygger både en marknadsföringsprofil och konkreta förslag på svar
   som ägaren själv hade gett.
3. **Company Brain 1.1** — strukturerad, källmärkt företagskunskap med confidence-nivåer,
   deterministisk completeness-beräkning och progressiv kunskapsinsamling.
4. **Marknadsplansgenerator** — `/api/generate-plan`, kontextberikad med tidigare planer (undvik
   upprepning), tummen-feedback och kommande svenska högtider/säsonger.
5. **Marketing Strategist 2.0** — tvåstegs AI-motor (`/api/strategist/analyze` +
   `/api/strategist/recommend`) med server-side Company Brain-kontext, deterministisk validering,
   en kontrollerad repair-omgång och strikt typad `StrategyV2`.
6. **Facebook Specialist (Content Engine 1.0)** — server-only motor med draft → review → max en
   revision (max 3 modellanrop), deterministisk gate för kritisk saknad info, klichédetektion,
   detektion av fabricerat socialt bevis och NDJSON-streamade processfaser.
7. **Strategi-adapter v1/v2** — `lib/strategist/adapter.ts` normaliserar både gamla platta
   strategier och nya `StrategyV2` till en gemensam form, så Facebook Specialist fungerar oavsett
   vilken version strategin sparades i.
8. **Delat designsystem "Mission Control"** — `app/_shared/` (Shell-navigation, theme, ui, icons)
   som används av de nyare sidorna.
9. **Deterministiska tester** — två fristående tsx-harnesser utan testrunner och utan nätverk.

---

## 4. Routes och användarflöden

### Sidor (App Router)

| Route | Skyddad | Syfte |
|---|---|---|
| `/` | Nej | Publik landningssida (marknadsföring av produkten) |
| `/login` | Nej | Inloggning/registrering (Supabase Auth) |
| `/auth/callback` | Nej | Efter inloggning: dirigerar till `/onboarding` eller `/dashboard` |
| `/onboarding` | Ja | Företagsanalys + profilskapande, sparar till `companies` |
| `/dashboard` | Ja | "Idag" — startvy, snabbåtgärder, triggar plangenerering |
| `/generating` | Ja | Progressvy under plangenerering, redirectar till `/plan` |
| `/plan` | Ja | Den genererade veckoplanen (legacy-design) |
| `/campaign-builder` | Ja | **Marketing Strategist 2.0** — fyrafas-flödet |
| `/campaigns` | Ja | Kampanjförslag ur senaste planen (ärligt tomläge för "aktiva kampanjer") |
| `/campaign` | Ja | Enskilt kampanjförslag ur planen (legacy-design) |
| `/content` | Ja | Översikt över allt innehåll i senaste planen |
| `/content/facebook` | Ja | **Facebook Specialist** — brief → utkast → granskning → spara |
| `/post/[id]` | Ja | Enskilt inlägg: kopiera, feedback (tumme), generera/redigera bild |
| `/newsletter` | Ja | Nyhetsbrevet ur planen (legacy-design) |
| `/create` | Ja | Fristående innehållsskapande i sju format (legacy-design) |
| `/company` | Ja | Company Brain-redigering |
| `/history` | Ja | Alla tidigare genererade planer |
| `/profile` | Ja | Företagsprofil + filuppladdning ("brain files", legacy-design) |

### API-routes

| Route | Modell | Används av |
|---|---|---|
| `POST /api/analyze-company` | `gpt-4o-mini` | `/onboarding` |
| `POST /api/generate-plan` | `gpt-4o-mini` | `/dashboard`, `/onboarding` |
| `POST /api/create-content` | `gpt-4o-mini` | `/create` |
| `POST /api/generate-image` | `gpt-image-1` | `/post/[id]` |
| `POST /api/edit-image` | `gpt-image-1` | `/post/[id]` |
| `POST /api/strategist/analyze` | `STRATEGIST_MODEL` (default `gpt-4o`) | `/campaign-builder` |
| `POST /api/strategist/recommend` | `STRATEGIST_MODEL` (default `gpt-4o`) | `/campaign-builder` |
| `POST /api/content/facebook` | `gpt-4o` (draft) + `gpt-4o-mini` (review) | `/content/facebook` |
| `POST /api/campaign-interview` | `gpt-4o-mini` | **Ingen — död route** (se §12) |
| `POST /api/campaign-analysis` | `gpt-4o-mini` | **Ingen — död route** (se §12) |

### Huvudflöden

1. **Onboarding:** `/login` → `/auth/callback` → `/onboarding` → (`/api/analyze-company`) →
   spara `companies` → (`/api/generate-plan`) → `/dashboard`.
2. **Veckoplan:** `/dashboard` → `/api/generate-plan` → INSERT i `plans` → `/plan` / `/content` /
   `/history`.
3. **Strategi → innehåll:** `/campaign-builder` (brief → `/api/strategist/analyze` → följdfrågor →
   `/api/strategist/recommend`) → `saveStrategyV2()` → `campaign_strategies` → direktlänk till
   `/content/facebook?strategy=<id>` → förifyllt formulär → `/api/content/facebook` → utkast →
   `content_drafts`.

---

## 5. Company Brain

### Nuvarande datamodell

Definierad i `app/_shared/companyBrain.ts` (`CompanyBrain`):

- `companySummary`, `primaryCustomers[]`, `strengths[]`, `uniqueSellingPoints[]`, `tone[]`
- `contentGuidelines[]`, `forbiddenClaims[]`, `preferredCallsToAction[]`
- `commonCustomerObjections[]`, `proofPoints[]` (verifierat socialt bevis)
- `competitors[]` — `{ id, name, website?, notes?, source, confidence }`
- `products[]` — `{ id, name, category?, description?, customerProblem?, primaryAudience?, differentiators[], commonObjections[], profitability, priority, seasonality?, availabilityNotes?, source, confidence, confirmedAt?, updatedAt }`
- `keySeasons[]`, `marketingGoals[]`, `lastReviewedAt?`

Varje produkt och konkurrent bär **proveniens**: `source` (`user_confirmed` | `website_extracted` |
`campaign_learned` | `ai_suggested`) och `confidence` (`low` | `medium` | `high`).

### Hur data sparas

Ett enda **JSONB-fält** `companies.company_brain` (migration `0001`). Detta var ett medvetet
MVP-val: modellen är redan strukturerad på applikationsnivå, JSONB kräver ingen ny RLS-policy
(ärver radens), inga nya foreign keys och inga skrivningar mot flera tabeller.

Skrivning sker uteslutande klient-side via `useCompanyBrain.save()` med den RLS-skyddade
browser-klienten (ingen API-route). De **gamla platta kolumnerna** (`summary`, `customers`,
`products`, `tone`, `strengths`, `avoid`, `content_guidelines`) rörs aldrig av Company Brain — de
lämnas som bakåtkompatibel fallback. `migrateProfileToBrain()` bygger ett kompatibelt brain i
minnet när `company_brain` saknas eller är ofullständigt; ett befintligt `company_brain` vinner
fält för fält.

### Källtyper

| Källa | När den sätts |
|---|---|
| `user_confirmed` | Användaren lägger till/bekräftar manuellt i `/company` |
| `website_extracted` | Reserverad för hemsideskrapning (definierad, ej aktivt satt i migreringsvägen) |
| `campaign_learned` | Reserverad för framtida inlärning från kampanjutfall (ej implementerad) |
| `ai_suggested` | Default; migrerade produkter från den gamla profilen får detta + `low` confidence |

Grundprincipen är uttalad i koden: systemet får aldrig gissa att en uppgift är sann. Migrerad eller
AI-härledd information blir aldrig automatiskt `user_confirmed`.

### Hur Company Brain används av AI-funktionerna

| Konsument | Väg | Innehåll som skickas |
|---|---|---|
| **Marketing Strategist** | `lib/strategist/companyContext.ts` → `buildStrategistCompanyContext()` (server, härleder företaget ur sessionen) → `prompts.ts::companyBrainBlock()` | Företagsnamn, översikt, upp till 8 rankade produkter (prioritet → lönsamhet), styrkor, USP:ar, säsonger, konkurrentnamn, tonalitet, `proofPoints`, `forbiddenClaims` |
| **Facebook Specialist** | `lib/facebook/context.ts` → `buildFacebookContext()` (server) | Motsvarande minimerad kontext + ev. vald kampanjstrategi via adaptern |
| **Marknadsplan / `/create` / onboarding** | — | Använder **inte** Company Brain, utan den **gamla platta `CompanyProfile`** som skickas från klienten |

`lib/companyBrainServer.ts` finns och fungerar men är **inte inkopplad i någon route** — den är
byggd men oanvänd (dokumenterat i filens egen header).

Kontexten innehåller aldrig interna ID:n, `source`/`confidence`-metadata eller exakta ekonomiska
siffror — bara lönsamhet som nivå (`low`/`normal`/`high`/`unknown`).

### Kända begränsningar

1. **Två parallella företagsmodeller.** Den gamla platta `CompanyProfile` (kolumner på `companies`)
   och Company Brain (JSONB) lever sida vid sida. Plangeneratorn, `/create` och onboarding använder
   fortfarande enbart den gamla — så förbättringar i Company Brain slår **inte** igenom i
   veckoplanen eller i fristående innehållsskapande.
2. **Ingen normalisering.** Produkter/konkurrenter kan inte frågas i SQL, sorteras eller joinas.
   Ingen historik eller versionering av vad som ändrats.
3. **Ingen server-side validering vid skrivning.** Klienten skriver hela JSONB-objektet direkt;
   `sanitizeBrain()` körs bara vid **läsning**. En manipulerad klient kan lagra godtycklig JSON i
   fältet (begränsat av RLS till den egna raden).
4. **`source`/`confidence` visas och underhålls bara delvis** — de flesta fält på företagsnivå
   (styrkor, tonläge, målgrupper) har ingen proveniens alls, bara produkter och konkurrenter har.
5. **Endast ett företag per användare.** Alla frågor gör `order created_at desc limit 1`. Skapar en
   användare flera `companies`-rader blir bara den senaste synlig.
6. **Ingen automatisk återfyllnad.** Kunskapsluckor visas men fylls bara manuellt; inget flöde
   skriver tillbaka lärdomar från kampanjer eller innehåll.

---

## 6. Marketing Strategist

### Vad som redan är implementerat (riktigt, inte mockat)

- **Fyrafas-UI** i `app/campaign-builder/page.tsx` (426 rader, skrevs om i `140351d` från 1260 rader
  v1-kod): Brief → Analys → Följdfrågor → Rekommendation, med fasindikator.
- **Fas 1 – Brief:** kompakt formulär (produkt, mål, erbjudande, period, geografi, fritext),
  förifyllt ur Company Brain. Mål hämtas från `lib/strategist/goals.ts` som återanvänder
  `CampaignGoal`-enumet.
- **Fas 2 – Analys:** `POST /api/strategist/analyze`. Riktigt modellanrop mot
  `STRATEGIST_MODEL` (default `gpt-4o`). Returnerar `campaignDiagnosis`, `recommendedFocus`,
  `rationale[]`, `identifiedGaps[]`, `alternativeDirections[]`, `confidence`.
- **Fas 3 – Adaptiva följdfrågor:** 0–4 frågor med `answerType` (`text` / `single_select` /
  `multi_select`), `reason`, `strategicImpact` och `relatedField`. Deterministisk validering i
  `validate.ts` dedupar, tvingar widget/options-konsistens, släpper frågor om redan känd stabil
  fakta (målgrupp om Company Brain har målgrupper, produkt om briefen anger den) och tillåter max
  en fråga per strategifält.
- **Fas 4 – Rekommendation:** `POST /api/strategist/recommend`. Ger `StrategyCore` med
  `primaryGoal`, `primaryAudience`, `mainMessage`, `valueProposition`, `primaryCta`, `urgency`,
  `channelPriority[]` (med motivering), `risks[]`, `improvementOpportunities[]`, `kpis[]`,
  `assumptions[]` plus `companyBrainReferences[]` för spårbarhet.
- **Deterministiska hårda krav** (`coerceRecommend`): rekommendation, prioriterad målgrupp,
  budskap + CTA, minst en **motiverad** kanal, minst en KPI. Dessutom kontroll mot företagets
  `forbiddenClaims` och mot overifierat socialt bevis (sex regex-mönster) — vid träff görs **en**
  kontrollerad repair mot modellen, aldrig tyst fallback till generisk text.
- **Persistens:** `saveStrategyV2()` skriver hela `StrategyV2` till
  `campaign_strategies.strategy_context` (samma kolumn som v1, ingen migration behövdes).
- **v1/v2-adapter:** `normalizeStrategyContext()` gör att Facebook Specialist förifylls korrekt
  från både gamla och nya strategier. Täckt av tester.
- **Tester:** `lib/strategist/strategist.test.mts` — 17 assertions över mapping, validering och
  beslutsträd. Alla passerar.

### Vad som endast är mockat eller hårdkodat

- **Ingenting i strategiflödet är mockat.** Det finns inga stubbar, ingen fejkad analys och ingen
  simulerad väntetid — alla fyra faserna gör riktiga anrop.
- Hårdkodat men avsiktligt: modellnamn som defaults (`gpt-4o`), timeout 45 s, `MAX_FOLLOWUPS = 4`,
  temperatur 0.5 (0.3 vid repair), samtliga textlängdsgränser i `validate.ts`, samt hela
  färgpaletten `T` som är duplicerad inline i `page.tsx` i stället för att komma från
  `app/_shared/theme.ts`.
- **Kvarvarande hårdkodning från v1:** `PROOF_PATTERNS` är svenskspråkiga regexar — de fångar inte
  engelska formuleringar.

### Vad som saknas för en riktig MVP

1. **Ingen väg tillbaka till en sparad strategi.** Strategin skrivs till `campaign_strategies` men
   det finns **ingen lista- eller detaljvy** för sparade strategier. `/campaigns` visar fortfarande
   bara kampanjförslag ur den gamla marknadsplanen. Enda vägen tillbaka är direktlänken som visas
   direkt efter genereringen.
2. **Ingen redigering.** Användaren kan inte justera ett fält i den färdiga strategin och spara om.
3. **Ingen versionering/iteration.** Varje körning skapar en ny rad; inget "revidera denna
   strategi".
4. **Ingen budget/ekonomi.** `StrategyCore` har ingen budget, ingen kanalfördelning i kronor och
   ingen uppskattad räckvidd — kanalprioritering är enbart ordnad text.
5. **Ingen uppföljning.** `kpis[]` genereras men mäts aldrig; inget utfall matas tillbaka.
6. **Bara Facebook som nedströmskanal.** Strategin kan bara omsättas i Facebook Specialist; övriga
   kanaler i `channelPriority` leder ingenstans.
7. **Ingen kostnadskontroll per användare.** Två `gpt-4o`-anrop per körning (fyra vid repair) utan
   rate limiting eller kvot.
8. **Ingen persistens av pågående session.** Laddar användaren om sidan mitt i flödet försvinner
   brief, analys och svar (allt ligger i React-state).

---

## 7. AI och prompts

### Var prompts finns

| Fil | Innehåll |
|---|---|
| `lib/strategist/prompts.ts` | `ANALYZE_SYSTEM`, `RECOMMEND_SYSTEM`, `companyBrainBlock()`, `briefBlock()`, `buildAnalyzeUser()`, `buildRecommendUser()` |
| `lib/facebook/specialist.ts` | Facebook Specialists draft-, review- och revisionsprompter (server-only motor, 599 rader) |
| `app/api/campaign-analysis/route.ts` | `SYSTEM_PROMPT` + `buildUserPrompt()` (v1, **död route**) |
| `app/api/campaign-interview/route.ts` | v1-intervjuprompter (**död route**) |
| `app/api/generate-plan/route.ts` | Systemprompt + stor userprompt inline i routen, inkl. förbjudna fraser |
| `app/api/analyze-company/route.ts` | Systemprompt + userprompt inline i routen |
| `app/create/page.tsx` | Prompterna byggs **på klienten** och skickas till `/api/create-content` |

Prompterna är alltså inte samlade på ett ställe: de nya modulerna (`lib/strategist/`,
`lib/facebook/`) håller dem i egna promptfiler, de äldre routerna har dem inline.

### Modeller och API-anrop

Allt går mot **OpenAI Chat Completions** respektive **Images**, via `openai ^6.42.0`.

| Funktion | Modell | Konfigurerbar via env | Övrigt |
|---|---|---|---|
| Strategist (analys + rekommendation) | `gpt-4o` | `STRATEGIST_MODEL`, `STRATEGIST_TIMEOUT_MS` | `maxRetries: 0`, `temperature` 0.5 / 0.3 vid repair, `max_tokens` 1200/1800, `response_format: json_object`, `maxDuration = 60` |
| Facebook Specialist – utkast | `gpt-4o` | `FACEBOOK_DRAFT_MODEL` | max 3 anrop totalt, `FACEBOOK_TIMEOUT_MS` (45 s), `maxDuration = 120` |
| Facebook Specialist – granskning | `gpt-4o-mini` | `FACEBOOK_REVIEW_MODEL` | |
| Marknadsplan | `gpt-4o-mini` | Nej (hårdkodad) | ingen timeout, ingen `maxDuration`, SDK-defaultomförsök aktiva |
| Företagsanalys | `gpt-4o-mini` | Nej | fetch-timeout 8 s per skrapad sida |
| `/api/create-content` | `gpt-4o-mini` | Nej | tar emot **prompt från klienten** |
| Bildgenerering / -redigering | `gpt-image-1` | Nej | 1024×1024, base64 |

### Hur strukturerade svar valideras

Två helt olika ambitionsnivåer i kodbasen:

**Nya vägen (Strategist + Facebook Specialist) — robust:**
1. `response_format: { type: "json_object" }` tvingar JSON.
2. Strukturell parsning av inkommande request i `lib/strategist/request.ts` (`parseBrief`,
   `parseAnswers`, `parseAnalysis`) — ogiltig brief ger 400 innan något modellanrop görs.
3. Deterministisk coercion i `lib/strategist/validate.ts`: varje fält trimmas, klipps till
   maxlängd, listor begränsas till maxantal, enums tvingas till giltiga värden.
4. Skillnaden mellan **säkra transformer** (görs tyst, loggas som `notes`) och **hårda problem**
   (`hardIssues`) som kräver åtgärd.
5. Vid hårda problem: **exakt en** repair — samma systemprompt + en explicit felbeskrivning, lägre
   temperatur. Håller det fortfarande inte → `502` med ett ärligt felmeddelande. **Ingen tyst
   fallback till generisk text.**
6. Facebook Specialist lägger dessutom till klichédetektion, detektion av fabricerat socialt bevis
   och dedupe av för lika alternativ (`lib/facebook/quality.ts`).

**Gamla vägen (`generate-plan`, `analyze-company`, `create-content`) — svag:**
`JSON.parse()` följt av att objektet skickas rakt till klienten. Ingen schemavalidering, inga
längdgränser, ingen typkontroll. Saknar modellen ett fält kraschar renderingen eller visar `undefined`.

### Felhantering och fallback-logik

| Lager | Beteende |
|---|---|
| Strategist-routes | Try/catch runt hela handlern; loggar `requestId` + feltypnamn, aldrig innehåll. 400 (ofullständig brief), 401 (ej inloggad), 502 (hårt valideringsfel efter repair), 500 (övrigt). Alla svar på svenska. |
| Facebook-route | Validerar briefen **innan** strömmen öppnas (400). Under streamen skickas `{type:"error"}`-rad och strömmen stängs — alla kodvägar avslutar svaret. Deterministisk gate ger `{type:"blocked"}` med exakt en följdfråga i stället för att gissa. |
| `buildStrategistCompanyContext` | Returnerar `null` utan session → 401. Saknas företag → tom kontext med `hasBrain: false`, och prompten instruerar modellen att arbeta med tydliga antaganden (graceful degradation). |
| `companyBrainServer` | Try/catch → `null`, loggar bara feltypnamn. |
| `campaignStrategyStore` | Kastar aldrig; returnerar `null` vid fel så UI:t bara utelämnar direktlänken. |
| `useAccountData` | Faller tillbaka till `localStorage` om Supabase-anropet fallerar. |
| Äldre routes | Generiskt `catch` → `500` med svensk text. `generate-plan` loggar hela felobjektet (`console.error("GENERATE_PLAN_ERROR:", error)`). |

### Kända risker

1. **`/api/create-content` tar emot både systemprompt och userprompt från klienten.** Det är en
   öppen proxy till OpenAI för varje inloggad användare — godtyckliga prompter, godtycklig kostnad,
   inget innehållsfilter. Detta är den allvarligaste AI-relaterade risken i kodbasen.
2. **Prompt injection via hemsideskrapning.** `/api/analyze-company` hämtar godtycklig HTML från en
   användarangiven URL, strippar taggar och matar in texten (upp till 7 000 tecken) i prompten utan
   avgränsning. En preparerad sida kan påverka den genererade profilen. Ingen SSRF-skydd heller —
   URL:en valideras inte mot interna adresser.
3. **Ingen rate limiting eller kostnadstak** på någon AI-route. `gpt-4o` × 2–4 anrop per
   strategikörning och `gpt-image-1` per bild kan bli dyrt snabbt.
4. **Ingen serververifiering av företagstillhörighet i de äldre routerna.** `/api/generate-plan` tar
   `userId` **från request-bodyn** och använder dessutom en anon-nyckelklient utan cookie-session
   (`createClient` från `@supabase/supabase-js`) — se §12.
5. **`console.error("GENERATE_PLAN_ERROR:", error)`** kan skriva ut hela OpenAI-felobjektet, som
   kan innehålla delar av prompten (dvs. företagsdata) i loggen. De nya routerna loggar korrekt
   bara feltypnamn.
6. **Bara en repair-omgång.** Om modellen är envis får användaren ett 502. Det är ett medvetet och
   ärligt val, men innebär att flödet kan misslyckas synligt.
7. **Svenskspråkiga regexar** för socialt bevis och klichéer — engelska formuleringar passerar.
8. **Ingen validering av `maxTokens` mot faktisk output-längd.** Ett avklippt JSON-svar ger
   `JSON.parse`-fel som fångas som generellt fel, inte som "för långt svar".

---

## 8. Databas

Supabase Postgres. Repot innehåller **inga** `CREATE TABLE`-migrationer för de ursprungliga
tabellerna — de skapades manuellt i Supabase-dashboarden innan migrationsmappen fanns. Endast två
additiva migrationer är versionshanterade.

### Tabeller

#### `companies` (skapad utanför repot)
Kolumner som koden faktiskt läser/skriver:

| Kolumn | Typ | Not |
|---|---|---|
| `id` | uuid | PK |
| `user_id` | uuid | ägare (RLS-nyckel) |
| `name`, `industry`, `summary` | text | gammal platt profil |
| `customers`, `products`, `tone`, `strengths`, `avoid`, `content_guidelines` | text[] / jsonb | gammal platt profil |
| `best_customer` m.fl. | text | onboarding-svar |
| `company_brain` | **jsonb NOT NULL DEFAULT `'{}'`** | migration `0001` — hela Company Brain 1.1 |
| `created_at` | timestamptz | används för `order desc limit 1` |

#### `plans` (skapad utanför repot)
`id`, `user_id`, `company_id`, `focus`, `tags`, `posts` (jsonb), `newsletter` (jsonb),
`campaigns` (jsonb), `opportunities` (jsonb), `created_at`. Skrivs med **INSERT** (aldrig upsert),
vilket är exakt varför `/history` fungerar.

#### `content_feedback` (skapad utanför repot)
`user_id`, `company_name` (text, inte FK), `post_title`, `rating_text` (`up`/`down`). Skrivs från
`/post/[id]` med upsert, läses av `/api/generate-plan`.

#### `campaign_strategies` (migration `0002`)

| Kolumn | Typ | Not |
|---|---|---|
| `id` | uuid PK | `gen_random_uuid()` |
| `user_id` | uuid NOT NULL | FK → `auth.users(id) ON DELETE CASCADE` |
| `company_id` | uuid | **ingen FK-constraint** |
| `title` | text NOT NULL | default `'Kampanjstrategi'` |
| `goal` | text NOT NULL | |
| `strategy_context` | jsonb NOT NULL | **v1 platt objekt ELLER v2 `StrategyV2`** — läses via adaptern |
| `recommendation` | jsonb NOT NULL | hela rekommendationen |
| `created_at` | timestamptz NOT NULL | |

Index: `campaign_strategies_user_created_idx (user_id, created_at desc)`.

#### `content_drafts` (migration `0002`)

| Kolumn | Typ | Not |
|---|---|---|
| `id` | uuid PK | |
| `user_id` | uuid NOT NULL | FK → `auth.users(id) ON DELETE CASCADE` |
| `company_id` | uuid | **ingen FK-constraint** |
| `channel` | text NOT NULL | default `'facebook'` |
| `brief`, `result` | jsonb NOT NULL | |
| `edited` | boolean NOT NULL | default `false` |
| `edited_text` | text | |
| `created_at`, `updated_at` | timestamptz NOT NULL | **`updated_at` uppdateras aldrig** — ingen trigger, ingen kod skriver den |

Index: `content_drafts_user_created_idx (user_id, created_at desc)`.

### Migrationer

| Fil | Innehåll | Idempotent |
|---|---|---|
| `supabase/migrations/0001_add_company_brain.sql` | `ALTER TABLE companies ADD COLUMN IF NOT EXISTS company_brain jsonb` + kolumnkommentar | Ja |
| `supabase/migrations/0002_add_content_engine.sql` | `campaign_strategies` + `content_drafts` med index och fyra RLS-policies vardera (`DROP POLICY IF EXISTS` följt av `CREATE POLICY`) | Ja |

**Körs manuellt** i Supabase SQL Editor — appen kör dem inte, det finns ingen Supabase CLI-koppling
och inget migrationstillstånd i repot. Filerna innehåller inga hemligheter, projekt-ID:n eller
anslutningssträngar.

### RLS-status

| Tabell | RLS i repot | Kommentar |
|---|---|---|
| `campaign_strategies` | ✅ `enable row level security` + select/insert/update/delete på `auth.uid() = user_id` | Explicit i `0002` |
| `content_drafts` | ✅ samma fyra policies | Explicit i `0002` |
| `companies` | ⚠️ **Inte verifierbart ur repot** | `0001` antar att RLS redan begränsar raden till `auth.uid() = user_id` och konstaterar att policyn gäller hela raden, alltså även nya kolumner. Policyn själv finns inte i versionshantering. |
| `plans` | ⚠️ Inte verifierbart ur repot | Samma sak |
| `content_feedback` | ⚠️ Inte verifierbart ur repot | Samma sak |

> **Att verifiera i Supabase-dashboarden:** (a) att migration `0002` faktiskt är körd i produktion,
> (b) att RLS är aktiverat med korrekta policies på `companies`, `plans` och `content_feedback`.
> Ingen av dessa kan bekräftas från kodbasen.

### Kända databasproblem och teknisk skuld

1. **De ursprungliga tabellerna saknar migrationer.** Schemat kan inte återskapas från repot.
   Ett `0000_baseline.sql` saknas.
2. **`content_feedback.company_name` är text, inte FK.** Byter användaren företagsnamn tappas all
   feedbackkoppling tyst.
3. **`company_id` saknar FK-constraint** i båda nya tabellerna — föräldralösa rader kan uppstå.
4. **`content_drafts.updated_at` uppdateras aldrig.** Ingen trigger, ingen kod skriver den.
5. **`content_drafts` skrivs men läses aldrig.** Ingen vy listar sparade utkast.
6. **`campaign_strategies.strategy_context` innehåller två oförenliga format** (v1 platt, v2
   `StrategyV2`). Adaptern hanterar det korrekt, men det gör kolumnen ofrågbar i SQL.
7. **Ingen `updated_at`-trigger på `companies`** — `company_brain.lastReviewedAt` sätts i stället
   inuti JSONB:n.
8. **`/api/generate-plan` använder en anon-nyckelklient utan session** och filtrerar enbart på ett
   `userId` som kommer från request-bodyn. Om RLS på `plans`/`companies` inte skulle vara korrekt
   konfigurerad är detta en direkt IDOR-väg. Se §12.
9. **Ingen `plans`-rensning.** Historiken växer obegränsat; `useAccountData` hämtar `limit(20)`.

---

## 9. Arkitektur

### Viktiga mappar

```
app/
  _shared/          Delat designsystem + klient-hooks (Shell, theme, ui, icons,
                    companyBrain, useCompanyBrain, useAccountData)
  api/              Route handlers (server)
    strategist/     analyze + recommend (Marketing Strategist 2.0)
    content/facebook/  Facebook Specialist (NDJSON-stream)
  campaign-builder/ Marketing Strategist-UI + kvarvarande v1-moduler
  content/facebook/ Facebook Specialist-UI + delade brief-/resultattyper
  company/ dashboard/ campaigns/ content/ history/ ...  Sidor
lib/
  strategist/       Strategist-motorn: types, prompts, model, validate,
                    request, adapter, companyContext, goals + tester
  facebook/         Specialist-motorn: specialist, quality, context, strategyPrefill
  supabase*.ts      Tre klienter (browser / server / anon)
  campaignStrategyStore.ts, companyBrainServer.ts
  mockPlans.ts, planStorage.ts, generatedPlan.ts   ← död kod
supabase/migrations/  0001, 0002
scripts/            strategyPrefill.integration.mts
public/             Fem oanvända SVG:er från create-next-app
proxy.ts            Next.js 16 Proxy (routeskydd)
```

**Noterbart:** det finns inga toppnivåmappar `components/`, `hooks/` eller `types/`. Delade
komponenter och hooks bor i `app/_shared/`, typer bor bredvid sin domän (`lib/strategist/types.ts`,
`app/content/facebook/types.ts`, `app/campaign-builder/types.ts`). Det är konsekvent, men avviker
från den mappstruktur som efterfrågades i granskningsunderlaget.

### Server/client-ansvar

**Server (route handlers + `lib/*Server`/`context`-moduler):**
- Alla OpenAI-nycklar och modellanrop.
- Företagsidentitet härleds ur den autentiserade Supabase-sessionen — **aldrig** ur klientdata
  (gäller strategist- och facebook-routerna).
- Prompt-byggande och all validering av modellsvar.
- `lib/supabase-server.ts` importerar `next/headers`, vilket i praktiken gör modulen omöjlig att
  bunta in i en klientkomponent — ett medvetet "server-only"-skydd.

**Klient (`"use client"` — i praktiken alla sidor):**
- All UI och allt state.
- **Direkt Supabase-läsning och -skrivning** via den RLS-skyddade browser-klienten:
  `companies` (profil + `company_brain`), `plans`, `campaign_strategies`, `content_drafts`,
  `content_feedback`. Ingen API-route mellan.
- Prompt-byggande för `/create` (arkitektoniskt fel, se §7).

Det finns i praktiken **inga React Server Components** — varje sida är `"use client"`.

### API-struktur

Två generationer sida vid sida:

| | Gammal (`generate-plan`, `analyze-company`, `create-content`, bildrouterna) | Ny (`strategist/*`, `content/facebook`) |
|---|---|---|
| Response | `NextResponse.json()` | `Response.json()` / NDJSON-ström |
| Auth | Ingen (förutom proxyns routeskydd) | `sb.auth.getUser()` server-side, 401 |
| Validering av request | Minimal | Dedikerade parse-funktioner, 400 |
| Validering av svar | `JSON.parse` | Deterministisk coercion + repair |
| Loggning | Hela felobjekt | `requestId` + feltypnamn |
| `maxDuration` | Saknas | 60 s / 120 s |
| Prompter | Inline i routen | Egen promptmodul |

### State management

Inget bibliotek — enbart React `useState`/`useEffect` plus två delade hooks
(`useAccountData`, `useCompanyBrain`). Persistens sker mot Supabase, med `localStorage` som
cache/fallback under nycklarna `marketing-copilot-plan` och `marketing-copilot-company-profile`.

**Risker med det:** `localStorage` rensas aldrig vid utloggning — nästa användare på samma dator
kan se föregående användares plan och företagsprofil innan Supabase-hämtningen hinner klart. Och
Strategist-flödet håller allt i minnet, så en omladdning tappar hela sessionen.

### Återanvändbara tjänster

| Modul | Ansvar | Återanvänds av |
|---|---|---|
| `app/_shared/companyBrain.ts` | Typer, sanitering, migrering, completeness, luckor, AI-kontext | `/company`, `useCompanyBrain`, `companyBrainServer`, `strategist/companyContext`, `facebook/context` |
| `lib/strategist/adapter.ts` | v1/v2-normalisering | `facebook/context`, `strategyPrefill`, tester |
| `lib/strategist/validate.ts` | Deterministisk validering | Båda strategist-routerna |
| `lib/facebook/quality.ts` | Klichéer, socialt bevis, dedupe, status | `facebook/specialist` |
| `app/_shared/Shell.tsx` + `theme.ts` + `ui.tsx` + `icons.tsx` | Designsystem | De sex nyare sidorna |
| `app/_shared/useAccountData.ts` | Profil + plan + historik | `/dashboard`, `/content`, `/campaigns`, `/history` |

### Dubbla eller äldre implementationer

1. **Två företagsdatamodeller** — platt `CompanyProfile` vs Company Brain (§5).
2. **Två designsystem** — legacy `#2a2f3a`/guld vs Mission Control `#0a0a10`/lila (§10).
3. **Tre Supabase-klienter** — `supabase-browser.ts` (SSR/cookies, korrekt),
   `supabase-server.ts` (SSR/cookies, korrekt), `supabase.ts` (**anon utan session**, används bara
   av `/api/generate-plan` och borde ersättas).
4. **Två strategimotorer** — v2 (`lib/strategist/`, aktiv) och v1 (`app/campaign-builder/config.tsx`,
   `reasoning.ts`, `goal-profiles.ts`, `analysis.ts` + de två döda API-routerna). v1-modulerna
   kompilerar och lintar fortfarande men når inte längre användaren.
5. **Två persistensfunktioner** — `saveCampaignStrategy()` (v1, **ingen anropare kvar**) och
   `saveStrategyV2()` (aktiv), i samma fil.
6. **Tre döda "plan"-hjälpmoduler** — `lib/mockPlans.ts`, `lib/planStorage.ts`,
   `lib/generatedPlan.ts` importeras inte någonstans.

---

## 10. UX och design

### Aktuellt designsystem

**"Mission Control"** — definierat i `app/_shared/theme.ts` och tillämpat via `Shell.tsx`
(tunn sidebar på desktop, drawer på mobil), `ui.tsx` (PageHeader, PrimaryButton, GhostButton,
EmptyState, Field, TextInput, TextArea) och `icons.tsx` (tio egna SVG-ikoner).

- Bakgrund `#0a0a10`, ytor `#131319`/`#191921`, accent lila `#8b6bf2`/`#a78bfa`.
- Typografi: Cormorant Garamond (serif, rubriker) + Outfit (sans, brödtext), laddade via
  `next/font/google` i `app/layout.tsx`.
- Tailwind v4 finns installerat (`@tailwindcss/postcss`) men **all styling görs med inline
  `style`-objekt** — Tailwind-klasser används i praktiken inte i komponenterna.

**Sidor på det nya systemet:** `/dashboard`, `/campaign-builder`, `/campaigns`, `/content`,
`/content/facebook`, `/company`, `/history`.

### Responsivitet

Hanteras med en JS-hook (`useIsCompact()`, brytpunkt 900 px i `Shell.tsx`; `/dashboard` har en egen
`isMobile`) som lyssnar på `resize` och byter layout. Fungerar, men:

- **Ingen CSS-mediaquery-baserad responsivitet** i komponenterna → första renderingen sker alltid i
  desktop-läge och hoppar till mobil efter hydrering (layout shift på mobil).
- Legacy-sidorna (`/plan`, `/campaign`, `/newsletter`, `/create`, `/profile`, `/onboarding`,
  `/generating`) har **fast padding och fasta bredder** och är i praktiken desktop-först.
- Landningssidan `/` har hårdkodad `padding: "0 48px"` i navigationen utan brytpunkt.

### Kända inkonsekvenser

1. **Två färgpaletter.** Legacy: `bg #2a2f3a`, guld `#c9a96e`. Nytt: `bg #0a0a10`, lila `#8b6bf2`.
   En användare som går `/dashboard` → `/plan` byter visuell värld mitt i flödet.
2. **`T`-objektet duplicerat.** Legacy-paletten är copy-pastad i sju filer;
   `/campaign-builder` har dessutom en **tredje** inline-kopia av den lila paletten i stället för
   att importera `app/_shared/theme.ts` (och kallar accenten `gold` fast den är lila).
3. **Ingen delad navigation på legacy-sidorna.** `Shell` används bara av de sju nya sidorna;
   `/plan`, `/campaign`, `/newsletter`, `/create`, `/profile` har egna "tillbaka"-lösningar eller
   ingen navigation alls.
4. **Blandad ikonstrategi.** `app/_shared/icons.tsx` har riktiga SVG-ikoner; `/dashboard`s
   snabbåtgärder och `/create` använder emoji/unicode-tecken (`📱`, `✦`, `▣`).
5. **`/campaigns` och `/content` visar den gamla planens data** medan `/campaign-builder` skriver
   till en helt annan tabell — sidorna hänger inte ihop begreppsmässigt.
6. **"Kommer snart"-tillstånd** på `/dashboard` (Annons, Landningssida) är permanenta placeholders.
7. **Inline `<style>`-taggar** för `::placeholder`-färger upprepas i flera legacy-sidor i stället
   för att ligga i `globals.css`.

### Gamla sidor / legacy-design som lever kvar

| Route | Status |
|---|---|
| `/plan`, `/campaign`, `/newsletter` | Legacy-design, läser plan från `localStorage` |
| `/create` | Legacy-design, bygger prompter på klienten |
| `/profile` | Legacy-design, överlappar `/company` funktionellt (två sidor för företagsdata) |
| `/onboarding`, `/generating` | Legacy-design, men aktiva och nödvändiga delar av flödet |
| `/post/[id]` | Legacy-design, enda stället med bildgenerering och feedback |
| `/` | Egen tredje stil (`#0a0908`, beige) — varken legacy eller Mission Control |
| `veckoplan-app.jsx` (1025 rader) | Fristående prototyp i projektroten, importeras inte, exkluderad från lint |
| `node update-colors.js` | Engångsskript med mellanslag i filnamnet, exkluderat från lint |
| `design-reference.png` (1,6 MB) | Designreferensbild i projektroten |

---

## 11. Kodkvalitet

Alla kommandon kördes 2026-07-22 i `C:\Users\isakb\marketing-copilot` på Node v24.15.0 / npm 11.12.1,
på commit `140351d` med ren arbetskatalog.

| # | Kommando | Resultat | Exitkod |
|---|---|---|---|
| 1 | `npm install` | ✅ Lyckades — "up to date, audited 374 packages in 3s". **5 sårbarheter (1 moderate, 4 high)** rapporterade. | 0 |
| 2 | `npm run lint` (→ `eslint`) | ✅ Lyckades — **0 errors, 1 warning** | 0 |
| 3 | `npx tsc --noEmit` | ✅ Lyckades — **ingen output, inga typfel** | 0 |
| 4 | `npm run build` (→ `next build`) | ✅ Lyckades — kompilerat på 5,6 s, TypeScript på 6,4 s, 30 statiska sidor genererade, 28 routes | 0 |
| 5 | `npm run test:strategist` (→ `tsx lib/strategist/strategist.test.mts`) | ✅ Lyckades — **17/17 assertions passerade** | 0 |
| 6 | `npm run test:prefill` (→ `tsx scripts/strategyPrefill.integration.mts`) | ✅ Lyckades — **24/24 assertions passerade** | 0 |

### Detaljer

**Lint-varningen (den enda):**
```
app/post/[id]/page.tsx
  226:17  warning  Using `<img>` could result in slower LCP and higher bandwidth.
                   Consider using `<Image />` from `next/image`  @next/next/no-img-element
```

**Build-output — 28 routes:**
- 17 statiska (`○`): `/`, `/_not-found`, `/auth/callback`, `/campaign`, `/campaign-builder`,
  `/campaigns`, `/company`, `/content`, `/content/facebook`, `/create`, `/dashboard`, `/generating`,
  `/history`, `/login`, `/newsletter`, `/onboarding`, `/plan`, `/profile`
- 11 dynamiska (`ƒ`): de tio API-routerna + `/post/[id]`
- `ƒ Proxy (Middleware)` aktiv

**`npm audit` — 5 sårbarheter:**

| Paket | Allvarlighet | Not |
|---|---|---|
| `next` | high | Transitivt; åtgärdas genom uppgradering av Next |
| `sharp` | high | Ärvda libvips-CVE:er (CVE-2026-33327/33328/35590/35591) via `next` |
| `brace-expansion` | high | Transitivt via toolchain |
| `js-yaml` | high | YAML merge-key kan tvinga kvadratisk CPU-förbrukning |
| `postcss` | moderate | XSS via oescapad `</style>` i CSS stringify-output |

Ingen av dessa kommer från direkta produktionsberoenden som appen anropar själv — samtliga är
transitiva via `next`/toolchainen. **Ingen `npm audit fix` kördes** (skulle ha ändrat lockfilen,
vilket ligger utanför uppdraget).

### Testtäckning — ärlig bedömning

Testerna är väl skrivna och deterministiska (inga snapshots, inget nätverk), men täcker **enbart**
`lib/strategist/validate.ts`, `lib/strategist/adapter.ts` och `lib/facebook/strategyPrefill.ts`.
Det finns **inga tester** för: någon route handler, Facebook Specialist-motorn, Company Brain
(`sanitizeBrain`, `migrateProfileToBrain`, `computeCompleteness`, `topKnowledgeGaps`), någon
React-komponent, eller något Supabase-anrop. Det finns ingen testrunner, ingen
coverage-mätning och ingen CI-konfiguration i repot.

---

## 12. Kända problem

### A. Säkerhetsrisker

| # | Problem | Fil | Allvarlighet |
|---|---|---|---|
| A1 | **`/api/create-content` är en öppen OpenAI-proxy.** Både `systemPrompt` och `userPrompt` tas rakt från request-bodyn och skickas till modellen. Ingen auth-kontroll, ingen längdgräns, inget innehållsfilter, ingen rate limiting. | `app/api/create-content/route.ts:10-19` | **Hög** |
| A2 | **`/api/generate-plan` litar på `userId` från bodyn** och använder en anon-nyckelklient **utan cookie-session** (`lib/supabase.ts`-mönstret, `createClient` från `@supabase/supabase-js`). Skyddet vilar helt på att RLS är korrekt konfigurerad på `companies`/`plans`/`content_feedback` — vilket inte kan verifieras ur repot. Om RLS saknas är detta en direkt IDOR. | `app/api/generate-plan/route.ts:9-12, 37-75, 99-103` | **Hög** |
| A3 | **SSRF + prompt injection i hemsideskrapningen.** `/api/analyze-company` hämtar en användarangiven URL utan validering mot interna adresser (`localhost`, `169.254.169.254`, RFC1918) och matar in upp till 7 000 tecken skrapad text i prompten utan avgränsare. | `app/api/analyze-company/route.ts:9-76` | **Hög** |
| A4 | **Ingen rate limiting eller kostnadstak** på någon AI-route. `gpt-4o` × 2–4 per strategikörning, `gpt-image-1` per bild. | Alla `app/api/*` | Medel |
| A5 | **`console.error("GENERATE_PLAN_ERROR:", error)`** loggar hela felobjektet, som kan innehålla promptfragment (företagsdata). De nya routerna gör rätt och loggar bara feltypnamn. | `app/api/generate-plan/route.ts:225` | Medel |
| A6 | **`localStorage` rensas inte vid utloggning.** Nästa användare på samma dator kan se föregående användares plan och företagsprofil innan Supabase-hämtningen är klar. | `app/_shared/useAccountData.ts:72, 87` | Medel |
| A7 | **Company Brain skrivs klient-side utan server-validering.** `sanitizeBrain()` körs bara vid läsning; en manipulerad klient kan lagra godtycklig JSON i `company_brain` (dock begränsat av RLS till egen rad). | `app/_shared/useCompanyBrain.ts:62-79` | Låg |
| A8 | **5 npm-sårbarheter** (4 high, 1 moderate) — samtliga transitiva via `next`/toolchainen. | `package-lock.json` | Låg–Medel |

> `.env.local` finns lokalt och innehåller riktiga nycklar. Den är korrekt ignorerad av
> `.gitignore` (`.env*`), är inte spårad i git och är **inte** med i gransknings-ZIP:en.

### B. Död kod och orphaned implementationer

| # | Vad | Var |
|---|---|---|
| B1 | `POST /api/campaign-interview` (317 rader) — ingen klient anropar den efter v2-omskrivningen | `app/api/campaign-interview/route.ts` |
| B2 | `POST /api/campaign-analysis` (98 rader) — samma sak | `app/api/campaign-analysis/route.ts` |
| B3 | `app/campaign-builder/config.tsx` (482), `reasoning.ts` (279), `goal-profiles.ts` (238), `analysis.ts` (73) — v1-moduler som nu bara hålls vid liv av B1/B2 och av typimporter | `app/campaign-builder/` |
| B4 | `saveCampaignStrategy()` + `buildStrategyContext()` — v1-persistens utan anropare | `lib/campaignStrategyStore.ts:24-73` |
| B5 | `lib/mockPlans.ts` (173 rader) — importeras inte någonstans | `lib/mockPlans.ts` |
| B6 | `lib/planStorage.ts` + `lib/generatedPlan.ts` — importeras inte någonstans. `generatedPlan` är dessutom en modulnivå-mutabel variabel, vilket skulle vara osäkert på servern om den användes | `lib/` |
| B7 | `lib/companyBrainServer.ts` — fungerar men är inte inkopplad i någon route (dokumenterat i filen själv) | `lib/companyBrainServer.ts` |
| B8 | `lib/supabase.ts` — anon-klient utan session, används bara indirekt av mönstret i `generate-plan` | `lib/supabase.ts` |
| B9 | `veckoplan-app.jsx` (1025 rader) och `node update-colors.js` — fristående prototyp/engångsskript i projektroten, exkluderade från lint, "kandidater för radering" enligt `eslint.config.mjs` | projektroten |
| B10 | `public/*.svg` — fem oanvända create-next-app-tillgångar | `public/` |

### C. Mockad, hårdkodad eller ofärdig funktionalitet

| # | Vad |
|---|---|
| C1 | **"Kommer snart"** på `/dashboard` — snabbåtgärderna *Annons* och *Landningssida* är permanent inaktiverade placeholders (`app/dashboard/page.tsx:96-97, 116`) |
| C2 | **`/campaigns` visar aldrig aktiva kampanjer.** Sidans egen header medger att ingen datamodell spårar status/datum/kanal — det ärliga tomläget visas alltid, trots att `campaign_strategies` numera faktiskt innehåller sparade strategier |
| C3 | **`content_drafts` skrivs men läses aldrig.** Ingen lista över sparade Facebook-utkast finns |
| C4 | **`campaign_strategies` har ingen lista- eller detaljvy.** Enda vägen till en sparad strategi är direktlänken som visas direkt efter genereringen |
| C5 | **`updated_at` i `content_drafts` sätts aldrig efter INSERT** |
| C6 | **Hårdkodad högtidskalender** — 26 svenska datum inline i `app/api/generate-plan/route.ts:231-257`, inklusive kuriositeterna `"Nationaldagen (nästan)"` (31 maj) och `"Black Friday (nästan)"` (25 nov) |
| C7 | **Hårdkodad veckoberäkning** som inte följer ISO-8601 (`route.ts:92-94`) — kan ge fel veckonummer runt årsskiftet |
| C8 | **Hårdkodade modellnamn** utan env-override i alla äldre routes (`gpt-4o-mini`, `gpt-image-1`) |
| C9 | **Hårdkodade färgpaletter** duplicerade i minst åtta filer (§10) |
| C10 | **Endast ett företag per användare** stöds implicit av `order created_at desc limit 1` (sex förekomster) |
| C11 | **Ingen persistens av pågående Strategist-session** — omladdning tappar brief, analys och svar |
| C12 | **Ingen publicering, schemaläggning eller mätning** finns någonstans i produkten |

### D. TODO-kommentarer

Inga `TODO`, `FIXME`, `HACK` eller `XXX` finns i kodbasen. Inga `@ts-ignore`/`@ts-expect-error`
och inga `eslint-disable`-direktiv heller. Det som motsvarar TODO:s är i stället skrivet som
ärliga headerkommentarer (t.ex. `companyBrainServer.ts`: *"Byggd men INTE inkopplad … Redo för
nästa sprint"*, `eslint.config.mjs`: *"Kandidater för radering"*).

### E. Övrig teknisk skuld

| # | Vad |
|---|---|
| E1 | **Inga baseline-migrationer** för `companies`, `plans`, `content_feedback` — schemat kan inte återskapas ur repot (§8) |
| E2 | **RLS-status för de tre ursprungliga tabellerna kan inte verifieras ur repot** |
| E3 | **Ingen CI.** Ingen GitHub Actions-workflow, ingen automatisk lint/typecheck/build på PR |
| E4 | **Ingen testrunner och ingen coverage.** Två fristående tsx-harnesser, ~24 % av `lib/` täckt |
| E5 | **README är oförändrad create-next-app-boilerplate** — beskriver inte projektet, kräver inga env-variabler, dokumenterar inte migrationerna |
| E6 | **Ingen `.env.example`** — nya utvecklare får ingen lista över nödvändiga variabler (`OPENAI_API_KEY`, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, samt de valfria `STRATEGIST_MODEL`, `STRATEGIST_TIMEOUT_MS`, `FACEBOOK_DRAFT_MODEL`, `FACEBOOK_REVIEW_MODEL`, `FACEBOOK_TIMEOUT_MS`) |
| E7 | **`next.config.ts` är tom** — ingen bilddomänkonfiguration, inga säkerhetsheaders |
| E8 | **Tailwind v4 installerat men oanvänt** — all styling är inline `style`-objekt |
| E9 | **Alla sidor är `"use client"`** — inga Server Components, ingen SSR-datahämtning |
| E10 | **`tsconfig.tsbuildinfo`** (150 kB) ligger i projektroten; korrekt gitignorerad men skräpar |
| E11 | **Filnamn med mellanslag:** `node update-colors.js` — kräver citering i alla verktygskedjor |
| E12 | **Kyrillisk teckenblandning i en kodkommentar:** `lib/campaignStrategyStore.ts:9` innehåller `"Klient-sидan"` (sannolikt tangentbordsslinter) |

---

## 13. Git-status

| Fråga | Svar |
|---|---|
| Aktiv branch | `feature/marketing-strategist-v2` |
| Commit hash | `140351d6d0f15e9a5977fc2eed8e69c5bcf58e9e` |
| Är arbetskatalogen ren? | **Ja** — `git status --porcelain` gav ingen output vid sessionens start |
| Lokala ändringar | Inga spårade ändringar. **Efter denna körning finns en ny ospårad fil: `SPRINT_REVIEW.md`** (denna fil). Den är avsiktligt inte committad eller pushad. Byggartefakter (`.next/`, `tsconfig.tsbuildinfo`) uppdaterades av `npm run build` men är gitignorerade. |
| Är allt relevant pushat? | **Ja** — `git rev-list --left-right --count origin/feature/marketing-strategist-v2...HEAD` gav `0  0` (varken ahead eller behind) |
| Motsvarande remote branch | `origin/feature/marketing-strategist-v2` på `https://github.com/IsakByrge/marketing-copilot.git` |
| Senaste tagg | `v0.1.0-marketing-strategist` (pekar exakt på HEAD) |
| Main | **Orörd.** Inga merges, rebaser eller commits har gjorts mot `main`. |

ZIP-filen representerar alltså **exakt innehållet i `origin/feature/marketing-strategist-v2` @ `140351d`**,
plus den ospårade `SPRINT_REVIEW.md`.

---

## 14. Senast genomförda arbete

De tre senaste commiterna (alla 2026-07-21) utgör Marketing Strategist v2-sprinten:

### `140351d` — feat(strategist): 4-phase Marketing Strategist UI on /campaign-builder
**1 fil, +426 / −1260.** Hela `app/campaign-builder/page.tsx` skrevs om: v1:s långa intervjuformulär
(1260 rader med per-svar-reaktioner och stegvis frågelogik) ersattes av det fyrafas-flöde som
beskrivs i §6. Nettoeffekten är **−834 rader** — sprinten tog bort mer kod än den lade till på
UI-sidan. Detta är den commit som gjorde `/api/campaign-interview`, `/api/campaign-analysis` och
v1-modulerna i `app/campaign-builder/` till död kod (B1–B4).

### `0c292ef` — feat(strategist): analysis engine, structured strategy, v1/v2 adapter + tests
**15 filer, +1133 / −12.** Hela backend-motorn:
- **Nytt:** `lib/strategist/` — `types.ts` (131), `validate.ts` (190), `prompts.ts` (150),
  `companyContext.ts` (121), `strategist.test.mts` (172), `adapter.ts` (72), `request.ts` (67),
  `model.ts` (47), `goals.ts` (21)
- **Nya routes:** `app/api/strategist/analyze/route.ts` (50), `.../recommend/route.ts` (53)
- **Utökat:** `lib/campaignStrategyStore.ts` (+36 — `saveStrategyV2`),
  `lib/facebook/context.ts` (v1/v2-normalisering via adaptern),
  `lib/facebook/strategyPrefill.ts` (stöd för v2)
- **`package.json`:** nytt script `test:strategist`

### `9a27784` — chore: restore full project quality checks
**9 filer, +39 / −19.** Städning som gjorde repot lint- och typecheck-rent: åtgärdade
typproblem i sju legacy-sidor (`/campaign`, `/create`, `/login`, `/newsletter`, `/plan`,
`/post/[id]`, `/profile`), gjorde `lib/generatedPlan.ts` typsäker och lade till
`globalIgnores` i `eslint.config.mjs` för `node update-colors.js` och `veckoplan-app.jsx`.

**Områden som berördes i sprinten:** Marketing Strategist (nytt), Facebook Specialist (anpassning
till v2-strategier), kampanjpersistens, och en generell kvalitetsuppstädning. Company Brain,
marknadsplansgeneratorn och alla legacy-sidor lämnades orörda.

---

## 15. Rekommenderad nästa sprint

Detta är en **teknisk** rekommendation. Inga produktbeslut är fattade och ingenting är implementerat.

### Prioritet 1 — Säkerhet (bör göras före fler funktioner)

1. **Stäng `/api/create-content` (A1).** Flytta prompt-byggandet från `app/create/page.tsx` till
   servern, exakt som `lib/strategist/prompts.ts` gör. Klienten ska skicka strukturerad data
   (`{ contentType, request }`), aldrig färdiga prompter. Lägg till `sb.auth.getUser()`-kontroll.
   *Uppskattning: liten — mönstret finns redan att kopiera från.*
2. **Auth-härled användaren i `/api/generate-plan` (A2).** Byt till `lib/supabase-server.ts`
   (cookie-session) och ta bort `userId` ur request-bodyn. *Liten.*
3. **Verifiera RLS i Supabase-dashboarden** på `companies`, `plans` och `content_feedback`, och
   checka in resultatet som `supabase/migrations/0000_baseline.sql` (E1, E2). Bekräfta samtidigt
   att `0002` faktiskt är körd i produktion. *Liten, men blockerar allt annat säkerhetsarbete.*
4. **URL-validering i `/api/analyze-company` (A3).** Blockera `localhost`, RFC1918 och
   link-local-adresser; avgränsa den skrapade texten tydligt i prompten. *Liten.*
5. **Rensa `localStorage` vid utloggning (A6).** *Trivial.*

### Prioritet 2 — Gör Strategist-arbetet användbart

6. **Bygg om `/campaigns` till en riktig strategilista.** Just nu skrivs varje strategi till
   `campaign_strategies` men blir omöjlig att hitta igen efter att man lämnat sidan (C4) — det
   underminerar hela sprintens värde. Läs `campaign_strategies` via adaptern (som redan hanterar
   v1+v2) och visa strategierna, med länk vidare till Facebook Specialist. *Medel.*
7. **Lista sparade utkast från `content_drafts` (C3)** — samma argument. *Liten–medel.*
8. **Persistera pågående Strategist-session (C11)** i `sessionStorage` så en omladdning inte tappar
   brief och svar. *Liten.*

### Prioritet 3 — Betala av teknisk skuld som blockerar framtida arbete

9. **Radera död kod (B1–B6, B9, B10).** Ungefär **1 400 rader** som kompileras, lintas och
   underhålls utan att nå någon användare. Ju längre v1-motorn ligger kvar parallellt med v2, desto
   större risk att någon läser fel fil. Föreslagen ordning: de två döda API-routerna → v1-modulerna
   i `app/campaign-builder/` → v1-persistensfunktionerna → `mockPlans`/`planStorage`/`generatedPlan`
   → prototypfilerna i roten.
10. **Koppla in Company Brain i plangeneratorn.** `lib/companyBrainServer.ts` är redan byggd och
    testad men oanvänd (B7). Detta är den enskilt största kvalitetsvinsten per rad kod: veckoplanen
    använder fortfarande bara den gamla platta profilen (§5, begränsning 1), så allt användaren
    lägger in i `/company` är osynligt för den funktion de använder oftast. *Medel.*
11. **Lägg till CI (E3):** en GitHub Actions-workflow som kör `npm ci`, `npm run lint`,
    `npx tsc --noEmit`, `npm run build` och båda testskripten. Allt är redan grönt idag, så
    workflowen börjar från ett rent tillstånd. *Liten.*
12. **Skriv `.env.example` och en riktig README (E5, E6).** *Liten.*

### Prioritet 4 — Konsolidering (större, planera medvetet)

13. **Ett designsystem.** Migrera legacy-sidorna (`/plan`, `/campaign`, `/newsletter`, `/create`,
    `/profile`) till `Shell` + `app/_shared/theme.ts`, och ta bort de duplicerade `T`-objekten —
    inklusive den tredje kopian i `/campaign-builder` (§10). *Stor.*
14. **Slå ihop `/profile` och `/company`** till en företagsvy. De överlappar idag funktionellt.
    *Medel — kräver ett produktbeslut om vad som ska hända med filuppladdningen.*
15. **Avveckla den platta `CompanyProfile`-modellen** till förmån för Company Brain, när punkt 10
    är på plats. *Stor.*
16. **Uppgradera `next` för att åtgärda de fyra high-sårbarheterna (A8).** Notera att `AGENTS.md`
    varnar för att denna Next-version har brytande ändringar mot träningsdata — läs
    `node_modules/next/dist/docs/` innan uppgradering. *Medel, med testbehov.*

### Vad jag skulle avråda från härnäst

- **Fler AI-funktioner innan P1 är åtgärdat.** Varje ny route ärver samma auth- och kostnadsluckor.
- **Att normalisera Company Brain till egna tabeller nu.** JSONB-valet är fortfarande rätt för
  nuvarande skala; motivera det med ett faktiskt SQL-frågebehov först.
- **Att bygga publicering/schemaläggning** innan man kan hitta tillbaka till sina sparade
  strategier och utkast (P2) — annars byggs nästa lager ovanpå samma glapp.

---

*Slut på sprintgranskning. Genererad 2026-07-22 mot `feature/marketing-strategist-v2` @ `140351d`.*

# Security Foundation — sprintrapport

**Branch:** `fix/security-foundation`
**Utgångspunkt:** `feature/marketing-strategist-v2` @ `140351d`
**Omfattning:** endast säkerhet/kostnad/session. Inga nya produktfunktioner, inga designändringar, ingen destruktiv migrering, ingen merge till main.

---

## Sammanfattning

Sprinten stängde de mest kritiska säkerhets-, kostnads- och sessionsriskerna i AI-lagret innan nästa design-/UX-sprint:

1. **Stängde en öppen AI-proxy** — `/api/create-content` tog tidigare emot `systemPrompt`/`userPrompt` rått från klienten. Servern äger nu hela prompten.
2. **Tog bort klientbetrott `userId`** — `/api/generate-plan` litade på ett `userId` i request-body. Identitet härleds nu alltid ur sessionen och all DB-läsning är RLS-scopad.
3. **SSRF- och prompt-injection-skydd** på hemsidesanalysen (`/api/analyze-company`).
4. **Kostnads- och missbruksskydd** (auth-gate, rate-limit, samtidighetslås, timeout, central modell-/tokenkonfig, användningslogg) på samtliga AI-routes via gemensamma hjälpare.

All verifiering (lint, typecheck, tester, produktionsbygge) är grön.

---

## Identifierade risker

| # | Risk | Route | Allvarlighet | Status |
|---|------|-------|--------------|--------|
| R1 | Öppen AI-proxy: klienten skickar godtycklig system-/userPrompt → obegränsad modellåtkomst på företagets nyckel | `create-content` | **Kritisk** | Åtgärdad |
| R2 | Klientbetrott `userId` styr vems historik/feedback/företag som används | `generate-plan` | **Kritisk** | Åtgärdad |
| R3 | SSRF: godtycklig URL hämtas server-side (localhost, moln-metadata, privata nät) | `analyze-company` | **Kritisk** | Åtgärdad |
| R4 | Prompt injection: hemsidetext behandlas som instruktioner till modellen | `analyze-company` | Hög | Åtgärdad |
| R5 | Oskyddade AI-endpoints utan auth → kostnadsmissbruk (bild + text) | `generate-image`, `edit-image`, `campaign-analysis`, `campaign-interview` | Hög | Åtgärdad |
| R6 | Råa leverantörsfelmeddelanden läcker till klienten | `generate-image`, `edit-image` | Medel | Åtgärdad |
| R7 | Ingen rate-limit/samtidighetsspärr → dubbelklick och spam mot dyra anrop | alla AI-routes | Medel | Åtgärdad (MVP, in-memory) |
| R8 | Ingen kostnads-/användningsuppföljning | alla AI-routes | Medel | Åtgärdad |

---

## Implementerade ändringar

### Gemensamma säkerhetshjälpare (`lib/server/`)
- **`auth.ts`** — `getAuthedUser()` härleder identitet ur Supabase-sessionen (aldrig ur klienten) och returnerar en session-scopad klient så att RLS (`auth.uid() = user_id`) gäller för all efterföljande DB-åtkomst. Resursägarskap upprätthålls dessutom med explicita `user_id`-filter där id:n slås upp (t.ex. Facebook-strategiläsningen).
- **`ai.ts`** — central modell- (`AI_CHAT_MODEL`/`AI_IMAGE_MODEL`), tokenbudget- (`AI_MAX_OUTPUT_TOKENS`) och timeout-konfig (`AI_TIMEOUT_MS`), env-styrd. Lazy OpenAI-klient med `maxRetries: 0`. `callChatJson()` med hårt tokentak.
- **`ssrf.ts`** — `safeFetchWebsite()`: endast http/https, blockerar localhost/interna hostnamn och privata/loopback/link-local/CGNAT-IP (IPv4, IPv6, IPv4-mappad), DNS-uppslag före hämtning, validerar **varje** redirect-hopp, timeout, storleksgräns, content-type-kontroll, tydlig user-agent.
- **`rateLimit.ts`** — `acquireSlot()`: samtidighetslås + glidande fönster per (användare, funktion), env-konfigurerbart.
- **`usage.ts`** — `logAiUsage()` skriver en metadata-rad per anrop; loggar aldrig prompter, Company Brain, nycklar eller cookies; best effort (kastar aldrig).
- **`guard.ts`** — `guardAiRequest()` binder ihop auth + limit och ger `finish()` som släpper låset och loggar; `safeError()` för säkra svenska felsvar.
- **`contentPrompt.ts`** — server-ägd promptkonstruktion + `hasForbiddenProxyField()` + svarsvalidering för `create-content`.

### Route-ändringar
- **`create-content`** — stängd, strukturerad endpoint. Se API-kontrakt nedan.
- **`generate-plan`** — identitet ur session, RLS-scopad DB-läsning, rate-limit, timeout, logg.
- **`analyze-company`** — SSRF-säker hämtning, prompt-injection-härdad systemprompt, auth, rate-limit, logg.
- **`generate-image` / `edit-image`** — auth, rate-limit, central bildmodell + timeout, storleksgräns, generiska felmeddelanden, logg.
- **`campaign-analysis` / `campaign-interview`** — auth + rate-limit + logg tillagt; modell via central config.
- **`strategist/analyze` / `strategist/recommend` / `content/facebook`** — redan auth-skyddade (RLS-scopad Company Brain); rate-limit + användningslogg tillagt, befintlig auth/timeout/validering bevarad.

### Frontend
- `app/create/page.tsx` — skickar `{ contentType, request }`, bygger inga prompter.
- `app/dashboard/page.tsx` — skickar inte längre `userId` till `generate-plan`.
- (`app/onboarding/page.tsx` skickade redan inte `userId`.)

---

## Ändrade filer

**Nya:**
- `lib/server/{ai,auth,ssrf,rateLimit,usage,guard,contentPrompt}.ts` — gemensamma hjälpare.
- `lib/server/security.test.mts` — säkerhetstester.
- `supabase/migrations/0003_add_ai_usage_events.sql` — additiv användningsloggtabell.

**Ändrade routes:** `app/api/{create-content,generate-plan,analyze-company,generate-image,edit-image,campaign-analysis,campaign-interview,strategist/analyze,strategist/recommend,content/facebook}/route.ts`

**Ändrad frontend:** `app/create/page.tsx`, `app/dashboard/page.tsx`

**Övrigt:** `package.json` (`test:security`-skript)

---

## API-kontraktsändringar

### `POST /api/create-content` (brytande — frontend uppdaterad i samma sprint)
**Frontend får INTE längre skicka:** `systemPrompt`, `userPrompt`, `model`, `max_tokens`/`maxTokens`, `temperature` (avvisas med 400).

**Nytt kontrakt:**
```ts
{ contentType: "social" | "linkedin" | "newsletter" | "campaign" | "offer" | "case" | "custom",
  request: string /* ≤ 2000 tecken */ }
```
Servern äger: systeminstruktioner, modellval, tokenbudget, timeout, och hämtar Company Brain server-side ur sessionen.

> **Designbeslut (minsta säkra ändring):** `strategyId`/`productId` ur exempelschemat lades **inte** till — produkter saknar stabilt id (de ligger inbäddade i `company_brain`-JSONB) och att införa det vore en ny funktion. Kontraktet hålls stängt och server-ägt. Enum återanvänder befintliga innehållstyps-id:n för att bevara flödet.

### `POST /api/generate-plan` (brytande — frontend uppdaterad)
**Frontend får INTE längre skicka:** `userId`. Identitet härleds ur sessionen. `companyProfile`/`brainFiles` är fortsatt klient-innehåll men används bara scopat mot den autentiserade användarens egna data.

### Alla AI-routes
- **401** om oinloggad.
- **429** vid samtidiga/för många anrop (`{ error }`, svenska).
- Timeout ger **504** med begripligt svenskt fel.

---

## Databas

**Ny migration:** `supabase/migrations/0003_add_ai_usage_events.sql` (körs manuellt i Supabase SQL Editor — körs inte automatiskt av appen).

- **Ny tabell `ai_usage_events`** — en metadata-rad per AI-anrop (user_id, company_id, feature, model, status, started_at, ended_at, duration_ms, error_category, prompt_tokens, completion_tokens).
- **Additiv & icke-destruktiv** — inga befintliga tabeller/kolumner/rader rörs. Idempotent (`IF NOT EXISTS` + `DROP/CREATE POLICY`).
- **RLS:** aktiverad. Policies `select`/`insert` med `auth.uid() = user_id`. Ingen update/delete-policy → append-only för klienten.
- **Varför:** AI-routes saknade helt kostnads-/missbruksuppföljning. Tabellen lagrar aldrig prompter, Company Brain, nycklar eller cookies.

> **Åtgärd krävs innan Preview-test:** kör migration 0003 (och ev. väntande 0002) i Supabase-projektet. Om `ai_usage_events` saknas fortsätter routsen fungera — loggningen är best effort och sväljer felet — men ingen användning registreras.

---

## Tester

**Nytt:** `npm run test:security` (`lib/server/security.test.mts`, samma tsx-mönster som befintliga tester — inget nytt ramverk infört).

Täcker deterministiskt:
- **SSRF:** privata/reserverade IPv4/IPv6/IPv4-mappade blockeras, publika tillåts; `localhost`, privat IP, moln-metadata-endpoint och otillåtna protokoll (`ftp:`/`file:`/`gopher:`) avvisas.
- **create-content:** giltig/ogiltig `contentType`; `systemPrompt`/`userPrompt`/modell/tokenbudget avvisas; för lång request; svarsvalidering.
- **rate-limit:** samtidighetslås, fönstergräns, användarisolering.

**Resultat:** alla gröna (se Teknisk verifiering). Regressionstest `test:strategist` fortsatt grönt.

**Begränsning (redovisad):** auth-avvisning (401), ägarskap (annan användares strategi → 403/404), live-redirect-till-privat-IP och verklig timeout kräver en riktig session/nätverk och testas i den manuella testplanen, inte i enhetstesterna. `hasForbiddenProxyField`, `isPrivateIp`, `checkUrlAllowed` exporterades enbart för testbarhet — de kör samma kod som routsen/redirect-loopen.

---

## Teknisk verifiering

Kört på `fix/security-foundation`:

| Steg | Kommando | Resultat |
|------|----------|----------|
| Lint | `npx eslint .` | ✅ 0 errors (1 pre-existerande varning: `no-img-element` i `post/[id]`, medvetet kvar sedan tidigare) |
| Typecheck | `npx tsc --noEmit` | ✅ 0 fel |
| Säkerhetstester | `npm run test:security` | ✅ alla gröna |
| Strategist-tester | `npm run test:strategist` | ✅ alla gröna |
| Produktionsbygge | `npm run build` | ✅ lyckades (30 sidor, 11 API-routes) |

---

## Kvarstående risker (medvetet ej löst denna sprint)

1. **Rate-limit är in-memory (per instans).** På Vercel gäller gränsen per aktiv serverless-instans och nollställs vid kallstart. Räcker mot dubbelklick/spam, men inte mot en distribuerad angripare. → Delad räknare (Supabase/Redis) i senare sprint.
2. **DNS-rebinding.** SSRF-skyddet slår upp DNS och validerar, men adressen kan i teorin ändras mellan uppslag och anslutning. → Pinna IP per anslutning i senare sprint.
3. **`campaign-analysis`/`campaign-interview` skickar fortfarande företagsfakta i request-body** (används bara i den egna prompten, ingen cross-user-läsning). Inte en identitets-/åtkomstrisk, men kan flyttas till server-hämtad Company Brain i en senare sprint.
4. **`analyze-company` klientfelhantering** läser svaret även vid icke-2xx (befintligt beteende). Inte en säkerhetsrisk (händer bara inloggad), men kan hårdgöras.
5. **Ingen hård månads-/kostnadstak** — loggning finns nu, men ingen automatisk avstängning vid budgettak. → Nästa sprint.

---

## Manuell testplan (Vercel Preview — telefon + dator)

Kör efter att migration 0003 lagts in i Supabase. Logga in först.

1. **Login** — inloggning fungerar, skyddade sidor nås.
2. **Company Brain** (`/company`, `/onboarding`) — hemsidesanalys: en riktig publik hemsida analyseras; verifiera att `http://localhost`/intern URL nekas med begripligt fel.
3. **Marketing Strategist** (`/campaign-builder`) — analys + följdfrågor fungerar.
4. **Skapa strategi** — rekommendation genereras och sparas.
5. **Facebook Specialist** (`/content/facebook`) — inlägg genereras; öppna via sparad strategi.
6. **Fristående innehåll** (`/create`) — varje innehållstyp genererar; verifiera i nätverksfliken att bara `{ contentType, request }` skickas (inga prompter).
7. **Veckoplan** (`/dashboard`) — plan genereras; verifiera att inget `userId` skickas.
8. **Bild** (`/post/[id]`) — generera + redigera bild fungerar.
9. **Missbruksskydd** — dubbelklicka en genereringsknapp: andra anropet ska ge ett vänligt "en förfrågan pågår redan"/vänta-svar, inte dubbel debitering.
10. **Oinloggad** — anropa en AI-route utan session (t.ex. via inkognito) → 401.

Verifiera genomgående att inga befintliga flöden brutits av säkerhetsändringarna.

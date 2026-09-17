# Release Review — Security Foundation

Granskningspaket för branch `fix/security-foundation`. Detta är ett gransknings-/leveranspaket inför ett eventuellt merge-beslut — **ingen merge till `main` har gjorts** och inga kodändringar gjordes när detta paket skapades.

Datum: 2026-07-23

---

# Projektstatus

* **Branch:** `fix/security-foundation`
* **Startcommit:** `140351d6d0f15e9a5977fc2eed8e69c5bcf58e9e` (grenpunkt från `feature/marketing-strategist-v2`)
* **Slutcommit:** `fe24c0af90fa7f9b4ec9c1402d1a0d60f7412db7`
* **Antal commits (sprint):** 8
* **Git-status:** Rent arbetsträd för all spårad kod (inga modifierade eller stagade filer). `git status` visar två **untracked** filer: `SPRINT_REVIEW.md` (fanns före sprinten, medvetet orörd, ingår inte i någon commit och inte i denna ZIP) och `RELEASE_REVIEW.md` (denna rapport — medvetet inte committad enligt instruktionen "skapa inga nya kodändringar", men inkluderad i ZIP:en).
* **Bekräftelse att arbetskatalogen är ren:** Ja — inga icke-committade ändringar av spårad kod. Slutcommit `fe24c0a` motsvarar exakt det granskade kodläget.

Commit-logg (sprint):
```
fe24c0a docs(security): add SECURITY_SPRINT_REPORT.md
08b8273 test(security): deterministic tests for SSRF, request validation, rate-limit
e6926da fix(security): apply auth + rate-limit + usage logging to remaining AI routes
c1a85a2 fix(security): protect image routes with auth, rate-limit and safe errors
29982e7 fix(security): SSRF + prompt-injection hardening on /api/analyze-company
6ae66e6 fix(security): derive identity server-side in /api/generate-plan
120b2a5 fix(security): close open AI proxy on /api/create-content
3a0262b feat(security): shared server-side auth, SSRF, rate-limit, AI config + usage log
```

---

# Säkerhet

## Åtgärdade risker

| # | Risk | Route(r) | Allvarlighet | Åtgärd |
|---|------|----------|--------------|--------|
| R1 | **Öppen AI-proxy** — klienten skickade godtycklig `systemPrompt`/`userPrompt` rått till servern → obegränsad modellåtkomst på företagets nyckel | `create-content` | Kritisk | Stängt kontrakt `{ contentType, request }`; servern äger prompten; Company Brain hämtas server-side; prompt/modell/tokenbudget-fält avvisas med 400 |
| R2 | **Klientbetrott `userId`** styrde vems historik/feedback/företag som användes | `generate-plan` | Kritisk | Identitet härleds ur sessionen; `userId` borttaget ur kontrakt och frontend; DB-läsning RLS-scopad via session-klienten |
| R3 | **SSRF** — godtycklig URL hämtades server-side (localhost, moln-metadata, privata nät) | `analyze-company` | Kritisk | `safeFetchWebsite`: endast http/https, blockerar localhost/interna hostnamn och privata/loopback/link-local/CGNAT-IP (IPv4/IPv6/IPv4-mappad), DNS-validering före hämtning, varje redirect-hopp omvalideras, timeout, storleksgräns, content-type-kontroll |
| R4 | **Prompt injection** — hemsidetext tolkades som instruktioner till modellen | `analyze-company` | Hög | Hemsidetext ramas in som opålitlig källdata; systemprompt förbjuder att följa instruktioner i texten |
| R5 | **Oskyddade AI-endpoints** utan auth → kostnadsmissbruk | `generate-image`, `edit-image`, `campaign-analysis`, `campaign-interview` | Hög | Inloggning krävs (401) + rate-limit/samtidighetslås (429) + användningslogg |
| R6 | **Läckande leverantörsfel** — råa OpenAI-felmeddelanden till klienten | `generate-image`, `edit-image` | Medel | Generiska svenska fel; detaljer loggas endast server-side |
| R7 | **Ingen rate-limit/samtidighetsspärr** mot dyra anrop | alla AI-routes | Medel | Samtidighetslås + glidande fönster per (användare, funktion), env-konfigurerbart |
| R8 | **Ingen kostnads-/användningsuppföljning** | alla AI-routes | Medel | `ai_usage_events`-logg (metadata, aldrig prompter/Company Brain/nycklar) |

## Kvarvarande risker (medvetet, se Kända begränsningar)

* Rate-limit är in-memory (per serverless-instans).
* DNS-rebinding är inte fullt eliminerat.
* `campaign-analysis`/`campaign-interview` tar fortfarande företagsfakta i request-body (ingen cross-user-läsning).
* Inget hårt kostnadstak/automatisk avstängning.
* `analyze-company`-klienten läser svaret även vid icke-2xx (befintligt beteende, ej säkerhetsrisk).

---

# Arkitektur

**Company Brain** (`app/_shared/companyBrain.ts`, `lib/companyBrainServer.ts`) — strukturerad, återanvändbar företagskunskap (produkter med prioritet/lönsamhet/säsong/invändningar, kunder, USP:er, tonläge, förbjudna påståenden, verifierat social proof). Lagras som JSONB `company_brain` på `companies`. `getCompanyBrainContext()` bygger en minimerad, säker AI-kontext **server-side ur den inloggade sessionen** — aldrig ur klienten.

**Marketing Strategist** (`lib/strategist/*`, `app/api/strategist/{analyze,recommend}`) — tvåstegsflöde: `analyze` (strukturerad analys + 0–4 adaptiva följdfrågor) och `recommend` (färdig StrategyV2). Härleder företaget server-side (`buildStrategistCompanyContext`), deterministisk validering ovanpå modellen med en kontrollerad repair, central modell/timeout (`lib/strategist/model.ts`).

**Campaign Builder** (`app/campaign-builder/*`, `app/api/campaign-{interview,analysis}`) — konversationsdriven intervju (Reasoning Engine) fram till ett typat `CampaignBrief`, följt av en kampanjrekommendation. Kostnadsspärr på antal AI-drag och strikt JSON-validering. Persisterar strategin additivt i `campaign_strategies`.

**AI-routes** (`app/api/*`) — samtliga modellanrop går via serverside route handlers med `maxRetries: 0`, hård timeout och strikt svarsvalidering. Facebook Specialist (`content/facebook`) streamar ärliga processfaser.

**Säkerhetslagret (nytt, `lib/server/*`)** — gemensamma hjälpare som routsen delar:
* `auth.ts` — `getAuthedUser()` (identitet ur session), `getUserCompany()`, `ownsCampaignStrategy()` (RLS-scopat ägarskap).
* `ai.ts` — central modell-/tokenbudget-/timeout-konfig (env-styrd), lazy OpenAI-klient, `callChatJson()` med hårt tokentak.
* `ssrf.ts` — `safeFetchWebsite()` med full SSRF-blocklista + redirect-validering.
* `rateLimit.ts` — samtidighetslås + rate-limit per (användare, funktion).
* `usage.ts` — `logAiUsage()` (best effort, ingen känslig data).
* `guard.ts` — `guardAiRequest()` binder ihop auth + limit och ger `finish()` (släpper lås + loggar); `safeError()` för säkra svenska felsvar.

**Flöde per AI-route:** `guardAiRequest(feature)` → 401 om oinloggad / 429 vid spam → validera request → hämta företag/Company Brain server-side → bygg prompt server-side → modellanrop med timeout → validera svar → `finish()` (logg). RLS (`auth.uid() = user_id`) gör resursägarskap till en databas-garanti, inte bara en applikationskontroll.

---

# API

## Ändrade routes

| Route | Ändring |
|-------|---------|
| `POST /api/create-content` | **Breaking.** Stängd proxy — nytt kontrakt (se nedan). |
| `POST /api/generate-plan` | **Breaking.** `userId` tas inte längre emot; identitet ur session; RLS-scopad DB. |
| `POST /api/analyze-company` | SSRF-säker hämtning + prompt-injection-härdning + auth + rate-limit + logg. |
| `POST /api/generate-image` | Auth + rate-limit + central bildmodell/timeout + generiska fel + logg. |
| `POST /api/edit-image` | Auth + rate-limit + storleksgräns + generiska fel + logg. |
| `POST /api/campaign-analysis` | Auth + rate-limit + logg; modell via central config. |
| `POST /api/campaign-interview` | Auth + rate-limit + logg; modell via central config. |
| `POST /api/strategist/analyze` | Rate-limit + logg tillagt (auth fanns redan). |
| `POST /api/strategist/recommend` | Rate-limit + logg tillagt (auth fanns redan). |
| `POST /api/content/facebook` | Rate-limit + logg tillagt (auth fanns redan); auth/limit före strömöppning. |

## Breaking changes

1. **`create-content`** — frontend får INTE längre skicka `systemPrompt`, `userPrompt`, `model`, `max_tokens`/`maxTokens`, `temperature` (→ 400). Nytt kontrakt:
   ```ts
   { contentType: "social" | "linkedin" | "newsletter" | "campaign" | "offer" | "case" | "custom",
     request: string /* ≤ 2000 tecken */ }
   ```
   Frontend (`app/create/page.tsx`) är uppdaterad i samma sprint.

2. **`generate-plan`** — `userId` i request-body ignoreras/tas inte emot; identitet härleds ur sessionen. Frontend (`app/dashboard/page.tsx`) uppdaterad; `app/onboarding/page.tsx` skickade redan inte `userId`.

3. **Alla AI-routes** — svarar nu **401** (oinloggad), **429** (samtidiga/för många anrop) och **504** (timeout) med begripliga svenska felmeddelanden.

---

# Databas

**Migration:** `supabase/migrations/0003_add_ai_usage_events.sql` — additiv och icke-destruktiv, idempotent (`IF NOT EXISTS` + `DROP/CREATE POLICY`). Körs **manuellt** i Supabase SQL Editor (appen kör den inte).

* **Ny tabell:** `public.ai_usage_events` — en metadata-rad per AI-anrop: `id, user_id, company_id, feature, model, status, started_at, ended_at, duration_ms, error_category, prompt_tokens, completion_tokens, created_at`. Två index (`user_id, created_at` och `feature, created_at`).
* **Nya RLS-policies:** `own ai_usage_events - select` (`auth.uid() = user_id`), `own ai_usage_events - insert` (`with check (auth.uid() = user_id)`). Ingen update/delete-policy → append-only för klienten.
* **Schemaändringar på befintliga tabeller:** Inga. `companies`, `plans`, `content_feedback`, `campaign_strategies`, `content_drafts` lämnas helt orörda.

> Status: migration 0003 (och ev. tidigare väntande 0002) behöver köras i Supabase-projektet. Utan tabellen fungerar routsen ändå — loggningen är best effort och sväljer felet — men ingen användning registreras.

---

# Tester

Körda på `fix/security-foundation` @ `fe24c0a` (2026-07-23):

| Steg | Kommando | Exakt resultat |
|------|----------|----------------|
| **Lint** | `npx eslint .` | `✖ 1 problem (0 errors, 1 warning)` — enda varningen är `@next/next/no-img-element` i `app/post/[id]/page.tsx:226`, medvetet kvar sedan tidigare sprint. Exit 0. |
| **Typecheck** | `npx tsc --noEmit` | 0 fel. Exit 0. |
| **Säkerhetstester** | `npm run test:security` | `✅ Alla säkerhetstester gröna.` (SSRF-klassificering, request-validering, rate-limit). Exit 0. |
| **Strategist-tester** | `npm run test:strategist` | `OK — alla assertions passerade.` (regression). Exit 0. |
| **Production build** | `npm run build` | Lyckades — 30 sidor genererade, 11 API-routes (`analyze-company`, `campaign-analysis`, `campaign-interview`, `content/facebook`, `create-content`, `edit-image`, `generate-image`, `generate-plan`, `strategist/analyze`, `strategist/recommend`, `post/[id]`). Exit 0. |

Testtäckning (deterministisk, unit): privata/reserverade IPv4/IPv6/IPv4-mappade IP blockeras och publika tillåts; `localhost`/privat IP/metadata-endpoint/otillåtna protokoll (`ftp:`/`file:`/`gopher:`) avvisas; giltig/ogiltig `contentType`; `systemPrompt`/`userPrompt`/modell/tokenbudget avvisas; för lång request; svarsvalidering; rate-limit-samtidighet + fönster + användarisolering.

Ej enhetstestat (kräver session/nätverk → manuell/integration): 401 för oinloggad, 403/404 för annan användares resurs, live-redirect-till-privat-IP och verklig timeout. Se manuell testplan i `SECURITY_SPRINT_REPORT.md`.

---

# Kända begränsningar

Medvetet lämnat till senare sprintar:

1. **Rate-limit är in-memory** (per serverless-instans, nollställs vid kallstart). Räcker mot dubbelklick/spam, inte mot en distribuerad angripare. → Delad räknare (Supabase/Redis).
2. **DNS-rebinding.** SSRF-skyddet slår upp och validerar DNS, men adressen kan i teorin ändras mellan uppslag och anslutning. → Pinna IP per anslutning.
3. **`campaign-analysis`/`campaign-interview`** tar fortfarande företagsfakta i request-body (används bara i egen prompt, ingen cross-user-läsning). → Flytta till server-hämtad Company Brain.
4. **Inget hårt kostnadstak.** Loggning finns; automatisk avstängning vid budgettak saknas.
5. **`analyze-company`-klientens felhantering** läser svaret även vid icke-2xx (befintligt beteende). Kan hårdgöras.
6. **Migration 0003 (och ev. 0002) är ännu inte körd** i databasen.

---

# Nästa rekommenderade sprint

**"Cost & Abuse Hardening + DB-backed limits"** — flytta rate-limit och användningsräkning till en delad Supabase-backad räknare (globala gränser i stället för per-instans), inför ett konfigurerbart månads-/kostnadstak med automatisk mjuk avstängning, pinna IP per anslutning i SSRF-lagret för att stänga DNS-rebinding, och kör/verifiera migration 0002 + 0003 i alla miljöer. Därefter är läget moget för merge till `main` och kan följas av design-/UX-sprinten.

---

*Genererad som del av granskningspaketet. Se `SECURITY_SPRINT_REPORT.md` för full sprintrapport och manuell testplan.*

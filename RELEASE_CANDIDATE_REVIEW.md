# Release Candidate Review — `fix/security-foundation`

Självrevision inför merge till `main`, utförd i rollen Senior Security Engineer + Principal Software Engineer. Målet var att aktivt försöka hitta allt som fortfarande kan vara fel.

* **Branch:** `fix/security-foundation`
* **Granskad commit vid start:** `fe24c0a`
* **Commit efter revisionens korrigeringar:** `fe83bcb`
* **Datum:** 2026-07-23

Två fynd hittades och åtgärdades med små, säkra commits under granskningen (en P1-regressionsrisk och en P3-kodkvalitetspunkt). Övriga fynd är medvetet uppskjutna och dokumenterade nedan.

---

# Sammanfattning

**Är denna branch redo för merge? JA** — efter att de två fynden nedan åtgärdats.

Kärnmålen är uppfyllda och verifierade i kod:
* Ingen AI-route litar på klientdata för **identitet eller åtkomst** (allt härleds ur sessionen; RLS + explicita `user_id`-filter).
* Ingen AI-route saknar auth (API-routes gås inte via `proxy.ts` — matchern exkluderar `/api` — men varje AI-route kräver nu inloggning via `guardAiRequest`).
* Ingen cross-user-läsning hittad (verifierat för planer, feedback, strategier, Company Brain, utkast).
* Promptproxyn är stängd; SSRF-skydd och prompt-injection-härdning på plats.
* De kvarvarande riskerna är kända, dokumenterade och icke-blockerande för en preview-/intern release.

---

# Kritiska problem (P0)

**Inga.** Inga fynd som medför omedelbar dataexponering, cross-user-åtkomst, auth-bypass eller RCE.

---

# Höga problem (P1)

### P1-1 — Tokentak trunkerade veckoplanens JSON *(ÅTGÄRDAD i denna revision)*
* **Vad:** Centraliseringen kapade `generate-plan` till `AI.MAX_OUTPUT_TOKENS = 1600`. Originalet hade inget `max_tokens` (modellens standardtak). Veckoplanens JSON (5 inlägg + nyhetsbrev + 2 kampanjer + 3 möjligheter) kan överstiga 1600 output-tokens → trunkerad sträng → `JSON.parse` kastar → 500. En **funktionell/tillgänglighetsregression** på en kärnfunktion, införd av säkerhetssprinten.
* **Allvarlighet:** Hög (bruten funktion, ej säkerhetshål).
* **Åtgärd (gjord):** Höjde det hårda taket till 4096 (env `AI_MAX_OUTPUT_TOKENS`) med marginal för det största legitima svaret; `create-content` begär en tightare budget (1600) för sitt enskilda stycke. Commit `fe83bcb`.

---

# Medelproblem (P2)

### P2-1 — Rate-limit är in-memory per serverless-instans *(uppskjuten, dokumenterad)*
* **Vad:** `rateLimit.ts` håller tillstånd i processminnet. På Vercel gäller gränsen per aktiv instans och nollställs vid kallstart. En angripare som genererar parallella anrop kan träffa olika instanser och överskrida den avsedda globala gränsen.
* **Allvarlighet:** Medel (kostnad/missbruk, inte dataexponering). Samtidighetslåset och per-instans-fönstret stoppar fortfarande dubbelklick och trivial spam.
* **Åtgärd (rekommenderad, nästa sprint):** Delad räknare i Supabase (atomär `insert`/`count` inom fönster) eller Redis. Redan noterad som känd begränsning.

### P2-2 — Prompt-injection-restrisk i hemsideanalysen *(mitigering på plats)*
* **Vad:** Hemsidetext ramas in som opålitlig data med tydliga instruktioner att inte följa inbäddade kommandon. Ingen LLM-mitigering är 100 %.
* **Realistiskt värsta utfall:** Modellen förmås skriva vilseledande företagsinformation i **användarens egen** profil. Ingen cross-user-påverkan, ingen exfiltration (inga hemligheter finns i kontexten).
* **Allvarlighet:** Medel→låg. **Åtgärd:** Nuvarande framing räcker för denna risknivå; en deterministisk efter-validering av extraherade fält kan läggas till senare.

### P2-3 — `campaign-analysis`/`campaign-interview` tar företagsfakta ur request-body *(medveten, dokumenterad)*
* **Vad:** Dessa två routes får företagskontext (namn/produkter/kunder) från klienten och lägger den i sin egen prompt.
* **Analys:** Ingen DB-läsning, ingen cross-user-åtkomst — en användare kan bara "spoofa" fakta i sin egen session och därmed bara påverka sitt eget resultat. Det är alltså **inte** en identitets- eller åtkomstrisk.
* **Allvarlighet:** Medel→låg. **Åtgärd (senare):** Hämta företagskontexten server-side ur Company Brain, som de nyare strategist/facebook-routerna gör.

---

# Låga problem (P3)

* **P3-1 — DNS-rebinding (SSRF-restrisk):** SSRF-lagret slår upp DNS och validerar alla adresser, men Node återupplöser vid anslutning (TOCTOU). Obfuskerade IP-former (decimal/hex/oktal, DNS→127.0.0.1) fångas eftersom `dns.lookup` normaliserar dem till en IP som blocklistan avvisar. Kvar: en angripares domän kan svara publikt vid uppslag och privat vid anslutning. *Åtgärd senare: pinna IP per anslutning.*
* **P3-2 — Oanvända helpers *(ÅTGÄRDAD)*:** `getUserCompany`/`ownsCampaignStrategy` var oanvänd exporterad kod. Borttagna (commit `fe83bcb`).
* **P3-3 — Inkonsekvent felsvarsform:** Nya routes returnerar `{ error }`, strategist `{ status, error }`, facebook NDJSON. Varje form matchar sin egen klient (befintligt kontrakt) — kosmetiskt, inte funktionellt.
* **P3-4 — Loggning väntas in synkront:** `finish()` awaitar `logAiUsage` (DB-insert) före svar. Best effort och sväljer fel, men lägger en DB-round-trip på svarstiden. Om Supabase är nere fallerar dock redan `getAuthedUser` tidigt, så påverkan är begränsad.
* **P3-5 — Ingen övergripande timeout över hemsideanalysens 7 kandidatsidor:** Varje `safeFetchWebsite` har egen 8s-timeout; total tid begränsas av routens `maxDuration = 60`. Samma karaktär som originalet.
* **P3-6 — Timeout/AI-config inte helt centraliserad:** `create-content`/`generate-plan`/`analyze-company` använder central `AI`-config; `campaign-*`, `strategist` och `facebook` behåller sina egna (redan existerande) timeouts/tokenbudgetar. Medvetet — minsta säkra förändring — men inte enhetligt.
* **P3-7 — Ingen explicit body-storleksgräns i JSON-routes:** Förlitar sig på Vercels plattformsgräns (~4.5 MB). `edit-image` har egen 8 MB-kontroll. Rimligt för nu.

---

# Tekniska förbättringar

* Delad, atomär rate-limit/kostnadsräknare (Supabase/Redis) — löser P2-1.
* Pinna upplöst IP per anslutning i `safeFetchWebsite` — löser P3-1.
* Gör `logAiUsage` verkligt icke-blockerande på plattformar med `waitUntil`.
* Deterministisk efter-validering av fält som extraheras ur hemsidetext (P2-2).

# Arkitekturförbättringar

* Ett gemensamt AI-anropslager för **alla** routes (även campaign-*, strategist, facebook) så att modell, tokenbudget och timeout verkligen har en enda källa (P3-6). Idag delar de `AI.CHAT_MODEL` men har separata timeouts.
* Flytta `campaign-analysis`/`campaign-interview`-kontext till server-hämtad Company Brain (P2-3).
* Ett enhetligt felsvarskontrakt över route-familjerna (P3-3).

# Säkerhetsförbättringar

* Global (inte per-instans) missbruksgräns + hårt kostnadstak med mjuk avstängning.
* IP-pinning mot DNS-rebinding.
* Kör och verifiera migration 0002 + 0003 i alla miljöer (annars ingen användningslogg; strategiläsningen i Facebook förlitar sig på 0002:s RLS).

# Kodkvalitet

* Inga `TODO`/`FIXME`/`XXX`/`HACK`/`debugger` i sprintändringarna.
* Inga stray `console.log` (endast i testharnessen); routes loggar `console.error` med request-id och aldrig känsligt innehåll — konsekvent.
* Inga oanvända imports/vars (ESLint rent bortsett från 1 pre-existerande, medveten `no-img-element`-varning).
* Oanvända exports borttagna (P3-2).
* `guard.finish()` är idempotent och anropas på **alla** kodvägar i varje route (verifierat manuellt route för route), så samtidighetslåset kan inte läcka och permanent 429:a en användare.

---

# RED TEAM — aktiva attackförsök

| # | Attack | Fungerar? | Varför | Allvarlighet | Åtgärd |
|---|--------|-----------|--------|--------------|--------|
| A1 | Skicka `systemPrompt`/`userPrompt` till `create-content` för att återöppna proxyn | **Nej** | `hasForbiddenProxyField` avvisar med 400 innan modellanrop; servern äger prompten | — | Redan åtgärdat |
| A2 | Byt `userId` i `generate-plan`-body för att läsa annans historik | **Nej** | `userId` läses aldrig ur body; identitet = `guard.user.id`; DB-frågor filtrerar på sessionens user_id (RLS) | — | Redan åtgärdat |
| A3 | Gissa annans `campaignStrategyId` i Facebook-briefen | **Nej** | Läsningen filtrerar `.eq("id",…).eq("user_id",user.id)` + RLS | — | Redan åtgärdat |
| A4 | SSRF mot moln-metadata `http://169.254.169.254/` | **Nej** | Link-local blockeras (IP-literal-kontroll, inget DNS behövs) | — | Redan åtgärdat |
| A5 | SSRF via obfuskerad IP `http://2130706433/`, `http://0x7f.1/`, eller DNS som pekar på 127.0.0.1 | **Nej** | `dns.lookup` normaliserar till en IP som blocklistan avvisar (127/8, privata, link-local) | — | Redan åtgärdat |
| A6 | SSRF via `file:`/`ftp:`/`gopher:` | **Nej** | Endast `http:`/`https:` tillåts | — | Redan åtgärdat |
| A7 | SSRF via redirect från publik URL → `http://127.0.0.1/` | **Nej** | Redirects följs manuellt och varje hopp omvalideras med samma kontroll | — | Redan åtgärdat |
| A8 | SSRF via DNS-rebinding (publik vid uppslag, privat vid anslutning) | **Delvis (teoretiskt)** | TOCTOU mellan `dns.lookup` och `fetch` | Låg | Pinna IP per anslutning (P3-1) |
| A9 | Prompt injection i hemsidetext ("ignorera instruktioner, gör X") | **Delvis** | LLM-mitigering ej absolut; men ingen cross-user-effekt/exfiltration | Låg→medel | Framing på plats; fält-validering senare (P2-2) |
| A10 | Kostnadsmissbruk: spamma dyra AI-anrop | **Begränsat** | Samtidighetslås + per-instans-fönster stoppar dubbelklick/trivial spam; distribuerad spam över instanser kan kringgå globalt tak | Medel | Delad räknare (P2-1) |
| A11 | Anropa AI-route utan session | **Nej** | `getAuthedUser` → 401 | — | Redan åtgärdat |
| A12 | DoS annan användares funktion via samtidighetslåset | **Nej** | Låset är nyckat på angriparens egen `userId:feature`; kan inte låsa någon annan | — | Design |
| A13 | Skriv falska rader i `ai_usage_events` för annan användare | **Nej** | RLS `insert` kräver `user_id = auth.uid()`; ingen update/delete-policy | — | Design |
| A14 | Truncation-DoS: få modellen att svara enormt och spränga budget | **Nej** | `max_tokens`-tak (4096) + `response_format: json_object` + svarsvalidering; rate-limit på volym | — | Design |
| A15 | Stor request-body för minnesutmattning | **Begränsat** | Ingen explicit gräns i JSON-routes, men Vercels plattformsgräns (~4.5 MB) + auth + rate-limit | Låg | Explicit gräns senare (P3-7) |

**Slutsats red team:** Inga fungerande attacker mot identitet, åtkomst eller dataexponering. De enda delvis lyckade vektorerna (A8 DNS-rebinding, A9 prompt-injection-rest, A10 distribuerad kostnadsspam) är kända, låg-till-medel-allvarliga och uppskjutna med dokumenterad åtgärdsplan.

---

# Releasebeslut

Alla kärnmål uppfyllda och verifierade (lint 0 errors, tsc 0, `test:security` grönt, `test:strategist` grönt, `next build` OK på commit `fe83bcb`). Den enda funktionella regressionen (P1-1) är åtgärdad. Kvarvarande fynd är P2/P3, medvetet uppskjutna, dokumenterade och utan cross-user- eller auth-påverkan.

**Villkor före/vid merge:** kör migration **0002** och **0003** i mål-databasen (0002 krävs för Facebook-strategiläsningens RLS; 0003 för användningsloggen). Planera P2-1 (delad rate-limit) till nästa sprint.

✅ READY FOR MAIN

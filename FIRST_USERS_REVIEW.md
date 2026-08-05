# Redo för fem testanvändare? — genomgång av huvudflödet

Datum: 2026-08-04. Granskningen är läsning av koden på `main`, inte körning av appen.
Frågan som ställts är **inte** "är produkten färdig" utan: *vad går sönder när fem
svenska småföretagare använder den utan att du sitter bredvid?*

---

## Sammanfattning

Motorerna är i bra skick. Säkerhetslagret är genomarbetat, strategist- och
Facebook-motorerna har tester, typecheck och lint är gröna.

Problemet ligger inte i arkitekturen. Det ligger i att **hela förstagångsflödet —
inloggning, onboarding, dashboard — saknar felhantering mot användaren.** Varje fel
sväljs och loggas till konsolen. En användare som stöter på ett fel ser inget alls:
en spinner slutar snurra, eller ett tomt fält dyker upp där AI:n skulle ha fyllt i.

Konkret mätning av felmeddelanden mot användaren per sida:

| Sida | Felstate mot användare | Try/catch |
|---|---|---|
| `/onboarding` | **0** | 3 |
| `/dashboard` | **0** | 2 |
| `/company` | **0** | 0 |
| `/plan` | **0** | 1 |
| `/create` | 4 | 3 |
| `/content/facebook` | 5 | 5 |
| `/campaign-builder` | 6 | 3 |

Mönstret är tydligt: de sidor du byggde senast har felhantering. De tre sidorna en ny
användare möter först har ingen. Det är precis tvärtemot vad ett test kräver.

Det förklarar också varför appen känns fungerande för dig: du har varm `localStorage`
och ett konto som redan finns. En ny användare i en tom webbläsare kör en annan kodväg.

---

## Blockerande — måste fixas före fem testanvändare

### 1. Registrering kan sluta i en återvändsgränd
`app/login/page.tsx:43`

`signUp()` anropas och därefter läses `getUser()`. Om e-postbekräftelse är aktiverad i
Supabase (standardinställningen) returnerar `signUp` **ingen session**. `getUser()` ger
`null`, koden skickar användaren till `/onboarding`, och `proxy.ts` kastar tillbaka
henne till `/login` — utan förklaring.

Kontrollera inställningen i Supabase. Är bekräftelse på: visa "Kolla din mejl". Är den
av: dokumentera det, för det är ett medvetet val.

### 2. Ingen glömt lösenord-funktion
`app/login/page.tsx`

Det finns bara inloggning och registrering. Av fem testanvändare kommer minst en att
glömma sitt lösenord, och då är hennes enda väg vidare att mejla dig.

### 3. Onboarding döljer när AI-analysen misslyckas
`app/onboarding/page.tsx:341–362`

```
.then(r => r.json()).catch(() => null)
```

Om `/api/analyze-company` fallerar — hemsidan går inte att läsa, timeout, OpenAI nere —
faller koden tillbaka på en tom profil. Användaren har då sett en laddningsskärm med
texten "Läser din hemsida…" i 3,5 sekunder och möts sedan av tomma fält, utan ett ord
om att något gick fel. Hon kommer tro att produkten är trasig, inte att hennes
hemsida inte gick att läsa.

Minsta åtgärd: skilj på lyckad analys och misslyckad, och säg "Vi kunde inte läsa
hemsidan — fyll i själv så länge".

### 4. Veckoplanen kan tyst utebli
`app/onboarding/page.tsx:428–440`

Samma mönster. Om `/api/generate-plan` fallerar sparas ingenting, och användaren
skickas ändå till `/dashboard` — som då visar tomläget "Låt din marknadschef lära
känna företaget", trots att hon precis fyllt i allt. Det är den värsta upplevelsen i
hela flödet, för den ser ut som att arbetet försvann.

### 5. "Generera veckoplan" på dashboarden misslyckas tyst
`app/dashboard/page.tsx:272–274`

`catch (e) { console.error(e); }`. Knappen slutar snurra och inget händer. Användaren
klickar igen. Och igen.

### 6. Databasschemat är inte reproducerbart — och en tabell saknas helt
`supabase/migrations/`

Koden läser och skriver sju tabeller: `companies`, `plans`, `content_feedback`,
`marketing_rhythm`, `campaign_strategies`, `content_drafts`, `ai_usage_events`.
Migrationerna skapar **tre** av dem.

`marketing_rhythm` (`app/dashboard/page.tsx:262`) finns inte i någon migration alls och
nämns inte heller bland de kända blockerarna i development-pack. Skrivningen ligger
inuti ett `try` som bara gör `console.warn`, så om tabellen saknas i produktion
misslyckas den varje gång utan att någon märker det. Kontrollera om den existerar.

Viktigast av allt: **verifiera RLS** (`auth.uid() = user_id`) på `companies`, `plans`,
`content_feedback` och `marketing_rhythm` innan någon annan än du loggar in. Utan
verifierad RLS kan testanvändare potentiellt läsa varandras företagsdata. Det här är
den enda punkten på listan som är en förtroendefråga, inte en buggfråga.

---

## Bör fixas, men stoppar inte ett test

- **`localStorage` rensas inte vid utloggning.** Delar två testanvändare en dator ser
  den andra den förstas plan. Redan noterad som M8 i din roadmap.
- **Planer sparas i `localStorage` först, databas sen.** Byter användaren enhet eller
  webbläsare ser hon en tom app trots att data finns.
- **"God morgon" oavsett klockslag** (`app/dashboard/page.tsx:309`). Trivialt, men det
  är den första meningen en testanvändare läser klockan 15.
- **Två snabbåtgärder är märkta "Kommer snart"** (Annons, Landningssida). Bättre att
  dölja dem helt under ett test än att visa vad som saknas.
- **Nyhetsbrev, Facebook-inlägg och Instagram-inlägg leder alla till samma `/create`.**
  Ser ut som ett fel även om det inte är det.
- **`/campaigns` listar inte sparade strategier.** Användaren hittar inte tillbaka till
  något hon skapat. Relevant först om någon skapar mer än en sak — vilket är precis vad
  du vill ta reda på.

---

## Inte ett problem för fem användare

Det här är verkligt men irrelevant i den här storleksordningen. Lägg ingen tid här nu.

- **Rate limiting i processminnet.** 20 anrop per minut per användare och funktion.
  Håller gott och väl för fem kända personer.
- **Inget kostnadstak.** Chattmodellen är `gpt-4o-mini` och kostar nästan ingenting.
  Bildgenereringen (`gpt-image-1`) är dyrare men rimlig vid den här volymen. Sätt en
  budgetvarning hos OpenAI så räcker det.
- **Emerald-designsystemet renderas ingenstans.** Påverkar inte en enda testanvändare.
- **Död kod, dubblerade paletter, tekniska skulder D1–D7.** Ingen användare ser detta.
- **Avsaknad av CI.** Du är ensam utvecklare i det här skedet.

---

## Vad det här betyder

Sex punkter blockerar. Fem av dem är samma sak i olika förklädnad: *fel visas inte för
användaren*. Det är ett par kvällars arbete, inte en sprint — och absolut inte en
omdesign.

Punkt 6 är den enda som kräver att du går in i Supabase och tittar.

Ingenting på blockeringslistan handlar om utseende. Det är värt att notera innan nästa
designvarv, eftersom designen redan är inne på sitt tredje: emerald-systemet byggdes i
Sprint 2 och används fortfarande inte, och senaste commiten på `main` är en revert av
en dashboard-omdesign.

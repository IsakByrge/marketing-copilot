# Parkerade funktioner

Sju sidor och två moduler togs bort ur `app/` för att de var oåtkomliga: ingen
meny och ingen länk ledde till dem. De var inte trasiga — de tillhörde det gamla
mörka skalet som pensionerades när AppShell blev enda menyn.

Det här dokumentet finns för att de ska gå att bygga om i nya skalet utan att
någon behöver gräva i git-historiken för att minnas vad de gjorde.

**Återställ från commit `ae55153`** — den sista där alla filerna finns.

```bash
# Titta på en fil utan att ändra något
git show ae55153:app/newsletter/page.tsx

# Hämta tillbaka en sida till arbetsträdet
git checkout ae55153 -- app/newsletter/page.tsx
```

Allt nedan använde **den mörka guld/grafit-paletten** och skulle behöva skrivas
om mot `app/_shared/primitives.tsx` och AppShell. Datakällan är redan rätt: alla
utom `/generating` läste från Supabase via `useAccountData()` när de togs bort.

---

## Sidorna

### `/content` — Innehåll (översikt)

Listade veckoplanens inlägg, nyhetsbrev och kampanjer på en sida, med länkar
vidare till `/post/[id]`, `/newsletter` och `/campaign`. Enda sidan som
renderade mörka `Shell.tsx`.

- **API:** ingen
- **Data:** `useAccountData()`
- **Status:** **ersatt.** `/innehall` gör samma sak, men bättre — allt öppnas och
  redigeras på plats i stället för att navigera fram och tillbaka. Bygg inte om
  den här.

### `/plan` — Veckoplanen

Planens fokus, taggar och ett rutnät av inläggskort. Ingång till
`/post/[id]`, `/newsletter` och `/campaign`.

- **API:** ingen
- **Data:** `useAccountData()`
- **Status:** i praktiken ersatt av `/innehall` och `/dashboard`. Det som saknas
  i nya skalet är översiktsvyn över veckan som helhet.

### `/post/[id]` — Ett enskilt inlägg

Den mest funktionsrika av de borttagna. Visade ett inlägg ur planen med:

- kopieringsknapp för hela inlägget
- tumme upp/ner, sparad i tabellen `content_feedback`
- bildgenerering via **`/api/generate-image`**
- bildredigering via **`/api/edit-image`**
- uppladdning av egen bild som underlag för redigering
- nästa/föregående-navigering mellan planens inlägg

- **Data:** `useAccountData()` + `content_feedback`
- **Status:** delvis ersatt. `/innehall` har tummarna och `ImageMaker` (som
  använder `/api/generate-image`). **Bildredigeringen finns inte kvar någonstans
  i gränssnittet** — se API-avsnittet nedan.

### `/newsletter` — Nyhetsbrevet

Ämnesrad, förhandsvisning, brödtext och CTA ur `plan.newsletter`, med
kopiera-allt i e-postvänligt format (`ÄMNESRAD:` / `FÖRHANDSVISNING:` följt av
brödtext och CTA).

- **API:** ingen — texten kommer färdig ur `/api/generate-plan`
- **Data:** `useAccountData()`
- **Status:** delvis ersatt. `/innehall` har nyhetsbrevet som en redigerbar
  sektion (`item_key = "nl"`), sparad i `plan_text_edits`. Det som saknas är en
  **egen yta för nyhetsbrev**: förhandsgranskning som e-post, utskickshistorik,
  koppling till ett utskicksverktyg. Det är här du sa att du vill bygga vidare —
  börja från `/innehall`s nyhetsbrevssektion, inte från den här filen.

### `/campaign` — Kampanjbrief

En kampanj ur `plan.campaigns` med mål, budskap, kanaler och CTA, plus en
växlare mellan flera förslag och kopiera-allt.

- **API:** ingen
- **Data:** `useAccountData()`
- **Status:** delvis ersatt. `/campaigns` visar samma förslag som kort med titel
  och mål, men utan detaljvy — korten länkade hit och är nu vanliga rutor. Vill
  du ha detaljvyn tillbaka är det den här filen att utgå från.

### `/create` — Skapa fritt

Sju innehållstyper (socialt inlägg, LinkedIn, nyhetsbrev, kampanj, erbjudande,
kundcase, eget önskemål), var och en med egen platshållartext. Fritextfält för
önskemål, resultat med kopiera och "skapa nytt".

- **API:** **`/api/create-content`** (`contentType` + `request`; servern äger
  prompten och hämtar Company Brain ur sessionen)
- **Data:** `useAccountData()` — profilen användes bara som grind
- **Status:** ersatt av snabbskapandet i `/innehall`, som anropar samma route
  men bara har tre typer (social, newsletter, offer). **De fyra övriga typerna
  finns inte kvar i gränssnittet** — LinkedIn, kampanj, kundcase och eget
  önskemål. Routen stödjer dem fortfarande.

### `/generating` — Laddningsanimation

Sju påhittade steg ("Läser företagsprofil…", "Analyserar bransch och säsong…")
på 380 ms styck, sedan redirect till `/dashboard`.

- **API:** ingen. **Ingen data alls** — stegen var hårdkodade och speglade inget
  verkligt arbete
- **Status:** **bygg inte om den.** Onboardingen gör `router.push("/dashboard")`
  direkt, och en förloppsindikator som visar påhittade steg är precis den sortens
  siffra utan underlag som `VISION.md` förbjuder.

---

## Modulerna

### `app/_shared/Shell.tsx`

Mörk sidomeny och mobil-drawer. Hade åtta menyposter plus en fot med
Inställningar, kontonamn och Logga ut. Renderades bara av `/content`.

`firstNameFromEmail()` bodde här och används fortfarande av dashboarden — den
flyttades **oförändrad** till `app/_shared/user.ts`.

`signOut()` bodde också här — och var appens **enda** utloggning. Den flyttades
till AppShell i samma commit, inte bort: i sidomenyns fot på desktop och som en
knapp i mobilhuvudet, eftersom bottenraden är full av navigering. `clearAppStorage()`
anropas fortfarande före `auth.signOut()`, precis som förut.

### `app/_shared/ui.tsx`

Mörka primitiver: `PageHeader`, `PrimaryButton`, `GhostButton`, `CopyButton`,
`ResultBlock`, `ResultCard`, `EmptyState`. Motsvarigheterna finns i
`app/_shared/primitives.tsx` (ljusa) och `app/_shared/uiLight.tsx`.

`app/_shared/theme.ts` är **kvar** — `/campaigns`, `/history` och
`/content/facebook` använder den fortfarande.

---

## API-routes och prompter

Inget togs bort. Tre routes berördes:

| Route | Prompt/modul | Status |
|---|---|---|
| `/api/create-content` | `lib/server/contentPrompt.ts` | **Behållen och använd** — `/innehall` (snabbskapande) och `/api/product-texts` anropar den |
| `/api/generate-image` | `lib/server/imagePrompt.ts` | **Behållen och använd** — `app/_shared/ImageMaker.tsx`, som `/innehall` renderar |
| `/api/edit-image` | ingen egen promptmodul | **Behållen men oanropad** — `/post/[id]` var enda anroparen |

`/api/edit-image` ligger kvar med sin auth-gate och rate-limit intakt. Den syns
fortfarande i kostnadsvyn (`UsagePanel.tsx` har etiketten "Bildredigering"), så
tidigare användning redovisas korrekt. Vill du inte ha en oanropad AI-route i
kodbasen är den enkel att ta bort — men då försvinner också möjligheten att
koppla in bildredigering i `ImageMaker` utan att skriva om routen.

---

## Följdändringar i samma commit

- `app/_shared/user.ts` — ny fil, `firstNameFromEmail()` flyttad hit oförändrad
- `app/dashboard/page.tsx` — importerar från `user.ts` i stället för `Shell.tsx`
- `app/campaigns/page.tsx` — kampanjkorten länkade till `/campaign`; är nu vanliga
  rutor, eftersom titel och mål redan står i kortet
- `proxy.ts` — de borttagna rutterna ur `protectedRoutes`. `"/content"` står kvar
  som prefix eftersom det skyddar `/content/facebook`
- `scripts/route-smoke.mts` — listan speglar nu de rutter som faktiskt finns.
  Den innehöll fortfarande `/profile`, borttagen tidigare, vilket gjorde smoke-
  testet rött

## Kvar att ta ställning till

- **`/api/edit-image` är oanropad.** Ta bort routen, eller koppla in
  bildredigering i `ImageMaker` så den får en användare igen.
- **Fyra innehållstyper saknas i gränssnittet** — LinkedIn, kampanj, kundcase
  och eget önskemål. `/api/create-content` stödjer dem; det är bara
  snabbskapandet i `/innehall` som bara erbjuder tre.
- **Kampanjdetaljvyn finns inte.** `/campaigns` visar titel och mål, inget mer.

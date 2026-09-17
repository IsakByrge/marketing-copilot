# Marketing Copilot — vision och beslut

Version 1.0 · 5 augusti 2026 · **Den här filen gäller före alla andra dokument i repot.**

Konsoliderad från nio ChatGPT-arbetsytor, kodbasen och genomgången 4–5 augusti.
Affärsstrategin är i allt väsentligt behållen — den var genomarbetad. Det som tagits
bort är styrapparaten: sign-offs, readiness gates och rollfördelning mellan
"arbetsytor" som alla är samma person.

---

## The Golden Question

> Gör detta produkten bättre för kunden, eller gör det bara produkten större?

---

## 1. Vad produkten är

Marketing Copilot gör senior marknadsföringskompetens tillgänglig för företag som
inte kan motivera en egen marknadsavdelning eller ett byråupplägg.

**Löftet:** "Här är vad ditt företag bör göra härnäst inom marknadsföring — och varför."

**Positionering:** Din AI-marknadschef. Vägledning, prioritering och affärsförståelse.
Innehållsproduktionen är genomförandelagret, inte huvudlöftet.

**Wow-ögonblicket:** användaren får en konkret, oväntad och välmotiverad rekommendation
om sitt eget företag och inser att AI:n inte bara känner till verksamheten, utan
förstår vad som bör prioriteras.

### Positionering att undvika

- "AI som skriver inlägg till sociala medier"
- Allt-i-ett-plattform utan ett konkret kärnlöfte
- Autonom marknadsföring som svart låda
- Konkurrens genom flest funktioner eller lägst pris

### Non-goals

Inte ett CRM, CMS eller BI-system. Inte en ChatGPT-kopia med marknadsföringstema.
Inte en innehållsfabrik som premierar volym. Inte automatisk publicering som standard.
Inte bred attribution eller kanalexpansion före validerad efterfrågan.

---

## 2. Kund

**Användare nummer ett är Isak**, som tillträder som marknadsansvarig med
e-handelsansvar 1 september 2026. Webbshop på Wikinggruppen, gasolbranschen, ingen
befintlig marknadsföringsstack. Produkten byggs först för det jobbet och valideras av
skarp daglig användning.

**Nästa marknad är andra Wikinggruppen-butiker.** Samma plattform, samma CSV-format,
samma problem med tunna produkttexter. Identifierbar och nåbar grupp.

Därefter små och medelstora svenska företag som behöver mer strukturerad
marknadsföring men saknar en senior marknadschef. Köparen är ägare, vd eller
verksamhetschef — sällan en marknadsspecialist.

> "Vi vet att vi borde göra mer marknadsföring, men vi vet inte vad som är viktigast
> eller vad vi ska göra härnäst."

**Det verkliga alternativet** är inte en konkurrent. Det är ChatGPT plus Canva plus
Mailchimp plus Meta Business Suite plus ett kalkylblad. Produkten måste vinna på
sammanhang, företagsförståelse och bättre beslut — inte på textkvalitet.

**Pris:** hypotes 1 000–3 000 kr/mån. Ingen gratisnivå. Värdebaserat, inte per ord.

**Jämförelsen som gör priset rimligt:** en marknadsförare i Sverige kostar runt 52 000
kr i månadslön, cirka 70 000 kr med arbetsgivaravgifter — omkring 800 000 kr om året.
Produkten ska inte säljas som "ersätt er marknadsförare", vilket ingen köper. Den ska
säljas som *"ni behöver inte anställa er första marknadsförare än"* — riktat till
företag vid tröskeln, där frågan om att anställa redan kommit upp.

---

## 3. Var projektet faktiskt står (5 augusti 2026)

Ärlig nulägesbild, verifierad mot koden — inte mot dokumenten.

**Byggt och fungerande:** Company Brain, veckoplan, 4-fas Strategist, Facebook
Specialist, innehåll i sju format, bildgenerering. Säkerhetslager med serverside-auth,
SSRF-skydd, rate limiting och användningsloggning. Next.js 16, Supabase, OpenAI.
104 commits sedan 7 juni.

**Inte byggt:** integrationer. Noll. Ingen Google Ads, ingen Meta, ingen Analytics,
ingen Shopify. Produkten ser aldrig ett annonskonto och kan inte veta vad något kostade
eller gav.

**Antal användare: 0.** Ingen utanför utvecklaren har använt produkten.

**Sex blockerare** hindrar att någon annan kan använda den. Fem är samma fel: fel visas
aldrig för användaren. Se `FIRST_USERS_REVIEW.md`.

---

## 4. Beslut om design

Mockuperna från juli (nio skärmar) är visuellt starka men **motsäger produktens egen
positionering** och kräver data som inte finns.

**Vad som gäller:**

- Ingen siffra i produkten som inte kan beläggas med data vi faktiskt har. Ingen
  förtroendeprocent, ingen påhittad intäktspåverkan, ingen prognos utan underlag.
- Rekommendationer före KPI:er. Alltid. (Detta var redan beslutat i UX-arbetsytan.)
- Motivering istället för poäng: varje förslag citerar användarens egna svar ur
  Company Brain. Det är den enda funktion en generisk AI-chatt inte kan härma.
- Mobil är huvudfallet, inte ett specialfall. Kunden står på ett bygge, inte vid ett
  skrivbord.
- Fyra ytor, inte nio: Idag, Innehåll, Vad jag vet om er, Inställningar.
- Emerald-systemet (Deep Emerald #0F6B5B, Geist, varm vit) gäller. Det är byggt i
  `primitives.tsx` och används ännu inte på någon sida.

Skisser: `design-forslag/index.html`. Mockuperna från juli sparas som referens för
Content Studio och Strategy Workspace — de blir aktuella när det finns data att visa.

---

## 5. Sekvens

Ordningen är påtvingad, inte vald. Insights kräver Google Ads och Meta. Båda kräver
verifierat bolag, granskad app och en fungerande produkt med användare. Alltså kan
Insights inte byggas först.

Full plan i `ROADMAP_TILL_OS.md`.

| Fas | Innehåll | Grind till nästa |
|---|---|---|
| A | Produkttexter via CSV | En riktig katalog har gått igenom flödet |
| B | Säsongskalender | — |
| C | Köp verktygen — nyhetsbrev, GA4 | — |
| D | Landningssidor, innehåll utan byggare | — |
| E | WGR API istället för CSV | Företaget köper modulen |
| F | Mätning, GA4 före annonsplattformar | Det finns annonsdata värd att visa |

**Fas A är den enda som ska byggas före 1 september.** Den löser den mest repetitiva
delen av det nya jobbet och kräver noll integrationer och noll godkännanden.

Go-to-market ändras av att användare nummer ett är känd: produkten bevisas internt
först, säljs sedan till andra Wikinggruppen-butiker med ett skarpt case i handen.

---

## 6. Så drivs projektet

En person, 5–20 timmar i veckan. Det är den viktigaste förutsättningen i hela
dokumentet och den som tidigare planering inte tog hänsyn till.

**Borttaget:** Readiness Closure, Engineering sign-off, QA sign-off, Design Freeze som
grind, Cross-functional handover, Sprint Lead-beslut, rollfördelning mellan arbetsytor.
Det fanns ingen att signera med. Grindar som ingen kan stänga öppnas aldrig — och det
är den enskilda orsaken till att nio arbetsytor och trettio dokument gav noll användare.

**Gäller istället:**

- Ett aktivt spår i taget, alltid det som ligger närmast en riktig användare
- Inga nya styrdokument. Den här filen uppdateras, den kompletteras inte
- Design och kod i samma steg — ingen frysning före implementation
- Klart betyder att någon annan kan använda det, inte att det är pixelperfekt

**Föråldrat i repot:** `docs/MarketingCopilot-Documentation-Hub-v1.0` och
sprintrapporterna i roten beskriver den gamla styrmodellen. Behåll som historik, styr
inte efter dem. `development-pack` är fortfarande korrekt som teknisk revision.

---

## 7. Öppna frågor

1. **Sparar produkttextflödet faktiskt tid i skarpt läge?** Besvaras i september.
2. **Vill andra Wikinggruppen-butiker ha det?** Fråga först när det finns ett internt
   case att visa.
3. **Betalar någon 1 000–3 000 kr/mån?** Hypotesen är otestad.
4. **Äger arbetsgivaren det som byggs?** Produkten byggdes privat före anställningen,
   men används i tjänsten från 1 september. Reda ut det tidigt — helst skriftligt,
   innan det blir värt pengar.

---

## Nästa steg

1. Verifiera RLS på `companies` och `plans` — riktig företagsdata hamnar i databasen nu
2. Exportera en CSV med artikeldata från Wikinggruppen som underlag
3. Bygg produkttextflödet

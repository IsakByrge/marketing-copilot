# Uppdrag: produkttexter mot verifierat underlag

Kontext: Marketing Copilot, Next.js + Supabase + OpenAI. Produkttextflödet tar
en CSV-export från Wikinggruppen, låter en modell skriva produktbeskrivningar,
och exporterar en CSV för import tillbaka. Butiken säljer gasol — påhittade
specifikationer är en säkerhetsfråga, inte en kvalitetsfråga.

Kör `git log --oneline -5` först. Är delarna nedan redan gjorda, hoppa över dem.

---

## Del 1 — Kolumnmappning (kan redan vara gjord)

**Fil:** `lib/productText/csv.ts`

`guessColumns` matchade mönstret `"id"` mot rubriken `Hidden (1/0)` i
Wikinggruppens export via delsträngsmatchning. Varje synlig artikel har
`Hidden = "0"`, så alla 600 produkter fick artikelnummer `"0"`. Följden: alla
texter kollapsade till en, och `download()` hade skrivit samma beskrivning på
hela sortimentet.

1. I `PATTERNS.id`: ta bort `"id"`. Lägg till `"article number"`,
   `"article no"`, `"articleno"`, `"product number"`. Behåll `"sku"` och de
   svenska varianterna.
2. Lägg till en konstant `NEVER_PARTIAL` med
   `["hidden","meta","image","url","stock","price","vat","campaign","supplier","producer"]`.
   Rubriker som innehåller något av dessa får inte delsträngsmatchas. Exakt
   matchning ska fortfarande fungera (en kolumn som heter `Category` ska väljas).
3. Ny exporterad funktion `checkIdColumn(rows: Row[], column: string)` som
   returnerar `{ ok, filled, unique, examples }`. `ok` är sant när varje rad
   har ett värde och alla värden är unika. `examples` är upp till tre
   dubblettvärden för felmeddelandet.

**Fil:** `lib/productText/csv.test.mts` — lägg till regressionstester:
Wikinggruppens 25 rubriker mappas rätt, `Hidden (1/0)` väljs aldrig som id,
`Meta description` väljs inte före `Description`, samt tester för
`checkIdColumn` med unika värden, dubbletter och tomma värden.

**Fil:** `app/produkttexter/page.tsx`
- Importera `checkIdColumn`.
- `const idCheck = useMemo(() => cols.id ? checkIdColumn(rows, cols.id) : null, [rows, cols.id])`
- `ready` ska kräva `idCheck?.ok`.
- Visa en `Alert tone="danger"` i mappningssteget när `cols.id` är vald men
  `idCheck.ok` är falskt. Förklara att flera artiklar annars får samma text
  och att en import skulle skriva över hela sortimentet.
- I `download()`: kör `checkIdColumn` igen och avbryt med `setError` om den
  failar. Dubbelt skydd, eftersom konsekvensen är att skriva fel data till butiken.

---

## Del 2 — Artikelnummer på produkter i Company Brain

**Fil:** `app/_shared/companyBrain.ts`

1. Lägg `articleNumber?: string` på `CompanyProduct`, direkt efter `id`.
   Kommentera varför: det kopplar posten till en rad i CSV-exporten. Frivilligt,
   eftersom produkter kan finnas i hjärnan utan att finnas i sortimentet.
2. I `sanitizeProduct`: `articleNumber: clipText(o.articleNumber, 60) || undefined`.

Ändra inte `CompanyBrainContext` eller `buildCompanyBrainContext` — de är till
för kampanjer och ska fortsätta skicka topplistan.

---

## Del 3 — Uppslagning av fakta per artikel

**Ny fil:** `lib/productText/productFacts.ts`

Exportera:
- `interface ProductFacts` med `name`, `description?`, `customerProblem?`,
  `primaryAudience?`, `differentiators: string[]`, `commonObjections: string[]`,
  `seasonality?`, `availabilityNotes?`, `confidence`, `source`.
  Notera vad som INTE är med: interna id:n och `profitability` får aldrig nå modellen.
- `type FactsLookup = (articleNumber: string) => ProductFacts | null`
- `buildFactsLookup(brain: CompanyBrain): FactsLookup` — bygger en Map på
  normaliserat artikelnummer (trim + gemener). Produkter utan `articleNumber`
  hoppas över; matcha aldrig på namnlikhet.
- `hasUsableFacts(f)` — sant om `description`, `customerProblem`,
  `primaryAudience` eller minst en `differentiator` finns.
- `formatFacts(f): string | null` — radbaserad text för prompten. Returnerar
  `null` när underlaget inte räcker. Vid `confidence === "low"` eller
  `source === "ai_suggested"`, lägg till en rad om att underlaget inte är
  bekräftat och att texten ska hållas allmän.

**Fil:** `lib/companyBrainServer.ts`

Ny exporterad `getCompanyBrain(): Promise<CompanyBrain | null>`. Samma
hämtningslogik som `getCompanyBrainContext`, men returnerar hela hjärnan från
`migrateProfileToBrain` utan att gå via `buildCompanyBrainContext`.

Skälet: `CompanyBrainContext.priorityProducts` innehåller bara de åtta högst
prioriterade produkterna och saknar artikelnummer. Produkttexter behöver slå
upp exakt den artikel som skrivs om.

Dokumentera i doc-kommentaren att returvärdet aldrig får gå direkt i en prompt
— det innehåller interna id:n och lönsamhetsuppgifter. Gå via `formatFacts`.

---

## Del 4 — Prompten

**Fil:** `lib/productText/prompt.ts`

1. `buildUserPrompt(products: ProductInput[], lookup?: FactsLookup)`. För varje
   produkt, lägg till ett block:
   - Finns fakta: `UNDERLAG:\n<formatFacts-resultatet>`
   - Annars: `UNDERLAG: saknas. Använd endast produktnamnet och produktgruppen.
     Nämn inte material, mått, tryck, kopplingstyp eller vad produkten passar till.`

2. I `buildSystemPrompt`, lägg till en sektion efter de befintliga
   produkttextreglerna. Kärnan:

   > Varje produkt levereras med ett block märkt UNDERLAG. Det är de enda
   > sakuppgifter du har. Du får omformulera och prioritera dem, men aldrig
   > lägga till egenskaper som inte står där.
   >
   > Detta får ALDRIG skrivas om det inte står i UNDERLAG: material, mått,
   > vikt, volym, kapacitet, tryck, flöde, effekt, ventil- eller kopplingstyp,
   > vilken utrustning produkten passar till, certifieringar och standarder.
   >
   > Står uppgiften i produktnamnet får den upprepas — namnet är verifierat.
   > Saknas en uppgift: utelämna den. Skriv hellre fyra korta meningar som
   > stämmer än sju som låter bra.
   >
   > Undvik tomma påståenden som "passar perfekt för olika användningsområden".

   Ta bort den befintliga raden "Är produktnamnet otydligt: skriv kortare
   hellre än att gissa detaljer" — den ersätts av ovanstående.

3. I `validateGenerated`: kassera objekt vars `id` redan setts, och kassera
   texter vars normaliserade innehåll (gemener, kollapsade blanksteg) är
   identiskt med en tidigare text i samma batch. Identisk text på olika
   artiklar betyder att modellen tappat bort vilken produkt den skriver om.

**Fil:** `app/api/product-texts/route.ts`

```ts
const [ctx, brain] = await Promise.all([getCompanyBrainContext(), getCompanyBrain()]);
const lookup = brain ? buildFactsLookup(brain) : undefined;
const system = buildSystemPrompt(ctx);
const user = buildUserPrompt(products, lookup);
```

Rör inte `guardAiRequest`, rate limiting eller usage logging.

---

## Avslutning

Kör `npm run typecheck` och testerna för produkttexter. Rapportera vad som
ändrades och om något i befintlig kod behövde justeras för att kompilera.

Bakgrund som förklarar varför reglerna ser ut som de gör: modellen fick
tidigare bara artikelnamn och kategori. För "10 mm Plugg" skrev den
"Tätningspluggen i mässing" — materialet stod ingenstans. För en
POL-regulator skrev den "bra val för grillar och kaminer" trots att POL inte
är svensk standardgänga. Båda är den sortens fel som ska bli omöjliga.

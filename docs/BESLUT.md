# Beslut

Vad vi arbetat efter, varför spärrarna finns, och hur arbetet går till.
Sammanställt 2026-09-20 ur `VISION.md`, git-historiken, PR-beskrivningarna
(#1–#16) och projektminnet. Inga förslag — bara det som är bestämt.

---

## 1. Innehållsprinciper

**Ingen siffra utan underlag.** Ingen förtroendeprocent, ingen påhittad
intäktspåverkan, ingen prognos. Ärliga tomlägen är ett designbeslut.
(`VISION.md` §4.)

**Rekommendationer före KPI:er.** Alltid.

**Varje förslag ska kunna motiveras med användarens egna svar** ur Company
Brain. Det är det en generisk AI-chatt inte kan härma.

**Prompten kan be, den kan inte garantera.** Där prompttryck inte räcker mäts
resultatet i stället, och det som är mekaniskt och entydigt städas i kod.
Formulerat i PR #5 och tillämpat i varje innehålls-PR sedan dess.

**Fakta vinner över form.** Blir en text kortare eller längre än mallen säger
men behåller alla fakta, vinner fakta. (PR #12, PR #14.)

**Företagets egna tjänster får ta plats i högst en mening** i ett inlägg om en
produkt. (PR #13.)

**Kortare får inte betyda fattigare.** En omskriven produkttext ska behålla
varje siffra, mått, materialangivelse och säkerhetsfunktion ur den befintliga
texten. (PR #11, PR #12.)

**Interna fält är underlag, inte innehåll.** Kategori, underkategori,
tillverkare och modell skrivs aldrig ut som kundtext. Varumärket får stå i
löptext. (PR #11, beslutat i granskning 2026-09-19.)

---

## 2. Designprinciper

- **Mobil är huvudfallet.** Mätt på 390×844 i PR #9: noll klickbara element
  under 44 px, noll textställen under 12 px, med bottenradens 11 px-etiketter
  som medvetet undantag.
- **Ingen yta utan väg.** Tre sidor gick bara att nå via `<aside>` och var
  oåtkomliga på telefon. Bottenradens femte plats är nu "Mer". (PR #9.)
- **Ett designsystem.** `primitives.tsx` på emerald-systemet. `uiLight.tsx` var
  ett parallellt system och är borttaget. (PR #9.)
- **Inga gradienter, ingen glöd, inga emoji, inga påhittade kundcitat** på
  landningssidan. (PR #10, `app/page.tsx`.)
- **Nio mockuper blev fyra ytor.** Mockuperna från juli kräver data som inte
  finns och sparas som referens. (`VISION.md` §4.)

---

## 3. Spärrar, och varför de finns

| Spärr | Var | Varför |
|---|---|---|
| Faktaspärren | `lib/server/factGuard.ts` | Delad av plan, Facebook, produkttexter och strategen. Butiken säljer gasol: en påhittad tryckklass är en säkerhetsfråga. |
| Säkerhetsråd om gasolutrustning | `planValidate.ts` | Tre råd publicerades skarpt ("kontrollera gasolslangar för sprickor"). Rollen "tips" omdefinierades, detektorn är kvar som skyddsnät. Falskt larm kostar en blick, missat råd kostar mer. (PR #5, #6.) |
| Socialt bevis | `quality.ts` | Omdömen, betyg och siffror om kunder får bara användas när `proofPoints` har täckning. Annars släpps alternativet. |
| Produkt och erbjudande | `quality.ts` | Huvudtexten tappade "20 % på Mustang" medan alternativen behöll det. Nu krävs båda ordagrant. (PR #13.) |
| Påhittad brådska | `quality.ts` | "Innan erbjudandet tar slut" antydde ett slutdatum som inte fanns. Tid kräver slutdatum i underlaget, knapphet kräver att underlaget talar om lager. (PR #14.) |
| Hårda fakta i produkttexter | `hardFacts.ts` | Varje tal med enhet och varje versalförkortning ur före-texten måste finnas kvar. (PR #11.) |
| Nyckelord utan siffror | `keywords.ts` | Gjutjärn och batteridriven tändning föll bort i flera körningar. Ett eget anrop före skrivandet plockar dem ur före-texten; modellen får föreslå, före-texten avgör. (PR #12.) |
| Servern äger prompten | `contentPrompt.ts` | Endpointen var en öppen AI-proxy. Klienten skickar strukturerad data, aldrig prompttext. |
| Rate limit och samtidighetslås | `guard.ts`, `rateLimit.ts` | Kostnadsskydd. Medvetet enkelt: processminne, per instans. |
| SSRF, robots.txt, låg takt | `safeUrl.ts`, `robots.ts`, `ssrf.ts` | URL:erna kommer ur en uppladdad fil. En robot som hamrar blir blockerad. |
| Kostnadsvyn bakom `ADMIN_EMAILS` | `admin.ts` | Driftsdata, inte kundinnehåll. Grinden sitter på servern. |
| Felbesked i tre slag | `aiError.ts` | Slut saldo visades som "det gick inte just nu", och loggen sa bara "Error". (PR #16.) |

**Supabase är enda källan för affärsdata.** `localStorage` användes för profil,
plan och redigerad text; marknadsföringstext är affärsdata och ska ligga bakom
RLS. (PR #3.)

---

## 4. Arbetsflöde

- **Du bygger, jag granskar i preview.** Varje ändring går i en egen gren med
  PR. Vercel bygger en förhandsversion per PR.
- **Grinden är CI:** lint, typecheck, build, samtliga testsviter och ett
  rutt-smoketest. Alla tester är ren logik, utan nät och databas.
- **Merge:** buggfixar och intern städning merge:as själv när grinden är grön.
  Ändringar som syns för användaren väntar på ett uttryckligt ja.
- **Migrationer kör du själv**, alltid manuellt i Supabase SQL Editor. Appen kör
  aldrig någon själv. Kod som nämner en ny kolumn får aldrig gå live före sin
  migration: PostgREST avvisar hela insert-satsen med `42703` när en kolumn
  saknas, vilket gjorde att ingen plan sparades alls före 0006.
- **`0000_baseline.sql` ska inte köras.** Den är rekonstruerad ur koden och är en
  no-op mot en befintlig databas. Läs den som dokumentation.
- **Rättningar görs mot riktig data.** Verona (101259) och "20 % på Mustang" är
  återkommande testfall, körda mot den riktiga produktsidan och den riktiga
  exportfilen.
- **Mätning före påstående.** Antal ord, antal träffar, antal körningar av
  varje utfall — inte "det känns bättre".

---

## 5. Beslutat men inte byggt

- **Kampanjer v1.** Datagrunden finns som migration (`campaigns`, se §6) men är
  inte körd, och inget gränssnitt är byggt. `/campaigns` visar fortfarande
  planens förslag. Designen för Campaigns v1 är beslutad och låst.
- **Läsning av sparade Facebook-utkast.** `content_drafts` skrivs men läses inte.
- **Delad rate limit-räknare** (Supabase eller Redis) i stället för processminne.
  Noterad i säkerhetsrapporten, uppskjuten.
- **Fas B–F i `ROADMAP_TILL_OS.md`:** säsongskalender, nyhetsbrevsverktyg och
  GA4, landningssidor, WGR API i stället för CSV, och mätning. Ordningen är
  påtvingad: Insights kräver annonsplattformar, som kräver verifierat bolag och
  en produkt med användare.
- **Fas 0 i `ROADMAP_TILL_OS.md`:** de sex blockerarna i `FIRST_USERS_REVIEW.md`
  före fem testanvändare. Flera ser ut att vara åtgärdade sedan dess:
  `/auth/reset` finns, schemat ligger i migrationer, och onboardingen slutar
  dölja fel i PR #16 — som ännu inte är merge:ad. Listan är inte uppdaterad
  efter åtgärderna, och jag har inte gått igenom den punkt för punkt.
- **Non-goals som står fast:** inte ett CRM, CMS eller BI-system, inte en
  innehållsfabrik, inte automatisk publicering som standard, ingen bred
  attribution före validerad efterfrågan.

---

## 6. Strategi och kampanj

Beslutat 2026-09-22.

- **Två begrepp.** `campaign_strategies` är en AI-genererad strategi.
  `campaigns` är en faktisk körning av en strategi, med status planerad, pågår
  eller avslutad. En kampanj kan inte finnas utan sin strategi
  (`ON DELETE RESTRICT`).
- **Minimal manuell resultatinformation.** Spenderat, omsättning, resultattyp
  (köp, leads, bokningar, butiksbesök, annat), antal, notering och lärdom. Allt
  är frivilligt och skrivs in av användaren. Ingen `metrics`-JSON, ingen
  attribution, inga kanal- eller budgettabeller.
- **Beräknade KPI:er lagras inte.** ROAS och kostnad per resultat räknas fram i
  kod när underlaget finns, och visas som beräknade.
- **Kör igen skapar en ny kampanj** med samma strategi, nya datum och tomma
  resultat. Den gamla kampanjen öppnas inte igen och ingen lineage-kolumn
  behövs. Förra resultatet och lärdomen visas som referens.
- **Migrationen skapades med `supabase migration new`**, därför tidsstämpel i
  filnamnet i stället för löpnummer.

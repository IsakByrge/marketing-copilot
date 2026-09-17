# Roadmap

Uppdaterad 5 augusti 2026. Ersätter den tidigare versionen, som utgick från att fem
okända testanvändare skulle validera produkten och att annonsplattformarna var första
integrationen. Båda antagandena är inaktuella.

**Vad som ändrats:** Isak tillträder som marknadsansvarig med e-handelsansvar 1
september. Användare nummer ett är alltså känd, motiverad och gör jobbet dagligen.
Webbshopen ligger på Wikinggruppen.

---

## Varför det här är en bättre utgångspunkt

Den gamla planen hade en svaghet vi inte kunde bygga bort: produkten byggdes åt en
tänkt kund som ingen pratat med, och validering krävde att någon främmande orkade
testa något halvfärdigt.

Nu är kravställaren och användaren samma person. Fungerar produkten inte märks det
inom en vecka, i skarpt läge, utan att någon behöver vara artig.

Det tar också bort den sociala risken. Ingen behöver se något halvfärdigt.

---

## Vad rollen faktiskt kräver

Ur arbetsbeskrivningen, e-handelsdelen:

- Driva och utveckla webbshopens affär
- Säkerställa korrekt innehåll — produkter, priser, lager
- Optimera kundresa och köpupplevelse
- Driva kampanjer och digital marknadsföring
- Arbeta datadrivet med analys och förbättring

Produkten som är byggd täcker punkt fyra, delvis, och för fel målgrupp — den gör
Facebook-inlägg och nyhetsbrev för konsumentnära småföretag. Punkt två är det största
och mest repetitiva arbetet, och det ingen produkt gör åt honom idag.

---

## Fas A — Produkttexter (nu till 1 september)

**Den enda funktionen som ska byggas före tillträdet.**

Wikinggruppen har inbyggd import och export av artikeldata som CSV, utan API-modul och
utan godkännande. Flödet:

1. Exportera artikeldata till CSV från kontrollpanelen
2. Produkten läser filen och identifierar produkter med tunn eller saknad text
3. Genererar nya texter via Company Brain — företagets ton, kundernas vanliga frågor
4. Exporterar CSV i samma format för import tillbaka

Verifierbart första dagen: texten duger eller inte. Ingen attribution, inga
förtroendeprocent, inga integrationer.

**Klart när:** en riktig produktkatalog har gått igenom flödet och texterna är
publicerade i shoppen.

## Fas B — Säsong (september)

Gasol är kraftigt säsongsdrivet: grillsäsong, camping och husvagn, terrassvärmare på
hösten, reservflaskor inför vintern. En kalender som vet vilken vecka det är och vad
som borde förberedas fyra till åtta veckor i förväg.

Ren logik. Ingen extern data. Bygger direkt på Company Brain.

## Fas C — Köp verktygen, bygg dem inte (september–oktober)

Företaget har ingen marknadsföringsstack idag. Det ska lösas med inköp, inte med kod:
nyhetsbrevsverktyg, GA4, eventuellt Klaviyo.

Marketing Copilot ligger ovanpå och bestämmer *vad* som ska sägas. Den ska inte bli
ännu ett utskicksverktyg, ännu ett analysverktyg eller en webbplatsbyggare.

## Fas D — Landningssidor, den lätta versionen (oktober)

Generera innehåll och struktur för en kampanjsida — rubrik, sektioner, brödtext,
uppmaning, formulärfält — och exportera. Ingen editor, ingen hosting, inga domäner.
Nittio procent av värdet för fem procent av arbetet.

## Fas E — Webbshopsintegration (november)

WGR API är en betald modul och ger produkter, varianter, lagersaldo, kunder, ordrar
och webhooks. Skillnaden mot CSV är att flödet blir löpande istället för manuellt.

Kräver att företaget köper modulen. Motivera det med tid sparad i fas A.

## Fas F — Mätning (december och framåt)

GA4 först, sedan annonsplattformarna om företaget faktiskt annonserar. Google Ads
kräver Basic Access, Meta kräver Business Verification och app review — veckor till
månader. Ansök när det finns skarp användning att beskriva.

Insights byggs sist och visar bara det som faktiskt mäts. Ärliga tomlägen gäller.

---

## Andra företag

Målet är fortfarande en produkt andra vill använda. Vägen dit går genom den egna
användningen, inte förbi den.

**Wikinggruppen-butiker är den naturliga första marknaden.** De delar plattform, delar
CSV-format och har samma problem med tunna produkttexter. De är dessutom en
identifierbar och nåbar grupp, till skillnad från "svenska småföretag".

**Arkitekturen klarar redan flera företag.** Supabase med `user_id`, RLS och en Company
Brain per företag. Ingenting behöver byggas om.

**Enda regeln under fas A–D:** inget gasolspecifikt i koden. Säsonger, produkttyper och
ton ska komma ur Company Brain, aldrig ur hårdkodade listor. Då är produkten
säljbar den dag den bevisat sig internt.

Första säljsamtalet blir då inte "vill du testa något jag byggt", utan "det här sparar
mig tio timmar i månaden på vår egen shop, vill du se".

---

## Vad som gäller från den gamla planen

`FIRST_USERS_REVIEW.md` skrevs för fem okända testanvändare. Fem av sex blockerare
handlar om att fel inte visas för användaren — mindre relevant när användaren är
utvecklaren.

**Kvarstår:** verifiera RLS på `companies` och `plans`. Det blir företagets riktiga
produktdata i databasen nu. Tio minuter.

**Skjuts upp:** felhantering i onboarding och dashboard, glömt lösenord,
e-postbekräftelse. Blir aktuellt igen inför första externa användaren.

Designarbetet skjuts också upp. Ingen ser produkten utom Isak fram till dess.

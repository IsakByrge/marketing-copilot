// ─────────────────────────────────────────────────────────────
// Faktaspärren — en enda formulering, delad av alla prompter som
// skriver text en kund får se.
//
// VARFÖR EN MODUL: spärren fanns tidigare på ett ställe (opportunities
// i veckoplanen) och fungerade där, medan inlägg och nyhetsbrev
// samtidigt bjöd på "Boka en service idag" — en tjänst företaget inte
// säljer. Skillnaden var inte modellen utan prompten: den allmänna
// regeln i voiceBlock drunknade i en JSON-mall som konkret bad om "en
// specifik uppmaning". Konkreta instruktioner vinner över allmänna.
//
// Skrivs spärren om på fem ställen glider de isär inom ett par
// sprintar. Därför bor den här, och ett test slår fast att varje
// promptbyggande fil faktiskt använder den.
//
// Butiken säljer gasol. En påhittad specifikation är en säkerhetsfråga,
// inte en kvalitetsfråga.
// ─────────────────────────────────────────────────────────────

/** Vad texten får luta sig mot. Tomma listor är tillåtna — då blir
 *  spärren strängare, inte svagare. */
export interface FactGuardContext {
  /** Produkter och tjänster som faktiskt finns i företagsdatan. */
  products?: string[];
  /** Godkända uppmaningar ur Company Brain (preferredCallsToAction). */
  approvedCtas?: string[];
  /** En ensam webbadress. Kvar för anropare som bara har en. */
  website?: string;
  /** Webbadresser med syfte. Modellen väljer länk efter inläggets syfte. */
  websites?: Array<{ url: string; purpose: string }>;
  /** Fysiska platser: depåer, butiker, verkstäder. */
  locations?: string[];
  /** forbiddenClaims ur Company Brain — påståenden användaren förbjudit. */
  forbiddenClaims?: string[];
}

/** Ord som avslöjar en uppmaning till något företaget kanske inte säljer.
 *  Används både i prompten och av eval-skriptet, så listan inte glider. */
export const RISKY_CTA_WORDS = [
  "boka",
  "bokning",
  "service",
  "inspektion",
  "besiktning",
  "kontroll av",
  "rabatt",
  "kampanjpris",
  "erbjudande",
  "fri frakt",
  "gratis",
  "garanti",
] as const;

/**
 * Ord ur den interna styrdatan. De hör hemma i prompten, aldrig i en
 * text en kund läser — "vår prioriterade produkt" eller "vårt mål med
 * det här inlägget" avslöjar maskineriet och låter som en internremiss.
 * Delas med eval-skriptet.
 */
// Fraserna nedan ar entydiga: de kan bara komma ur styrdatan. Bara ord
// som "lonsam" ar det INTE - "ett lonsamt val for dig" ar kundsprak om
// kundens ekonomi, inte ett lackage. Kontrollen i eval:plan far inte
// falla pa den skillnaden, sa listan innehaller fraser, inte ord.
export const INTERNAL_TERMS = [
  "prioriterad produkt",
  "prioriterade produkt",
  "hög prioritet",
  "högst prioriterad",
  "vår lönsammaste",
  "lönsamhet",
  "vårt mål",
  "våra mål",
  "vår målsättning",
  "målet med det här",
  "inläggets roll",
  "enligt företagsdatan",
  "enligt profilen",
  "enligt företagskunskapen",
] as const;

/** Formuleringar som kräver material produkten inte har. */
export const UNSUPPORTED_FORMATS = [
  "bakom kulisserna",
  "se bilderna",
  "titta på filmen",
  "swipa",
  "länken i bion",
  "tagga en vän",
  "dela och vinn",
] as const;

const lista = (rubrik: string, v: string[] | undefined, tomText: string) =>
  v && v.length > 0 ? `${rubrik}\n${v.map((x) => `  - ${x}`).join("\n")}` : `${rubrik}\n  ${tomText}`;

/**
 * Webbadresserna med sina syften, plus regeln om hur man väljer.
 * Utan syftet blir listan oanvändbar: modellen tar då den första.
 */
function webbBlock(ctx: FactGuardContext): string {
  const sidor = (ctx.websites ?? []).filter((w) => w.url);
  if (sidor.length === 0) {
    return ctx.website ? `WEBBADRESS: ${ctx.website}\n` : "";
  }
  const rader = sidor
    .map((w) => `  - ${w.url}${w.purpose ? ` — ${w.purpose}` : ""}`)
    .join("\n");
  return `WEBBPLATSER — VÄLJ LÄNK EFTER INLÄGGETS SYFTE:
${rader}
Ett säljande inlägg om en produkt länkar dit man KÖPER. Ett lokalt inlägg,
eller ett om något man gör på plats, länkar dit man LÄSER om verksamheten
och hittar platserna. Passar ingen av dem: länka inte alls.
Skriv adressen exakt som den står ovan. Hitta ALDRIG på en adress, en
undersida eller en sökväg som inte står här.
`;
}

/**
 * Spärrblocket. Läggs i ALLA prompter som producerar kundtext.
 * Kontexten styr vad som är tillåtet att hänvisa till — utan kontext
 * blir blocket maximalt restriktivt, vilket är rätt default.
 */
export function factGuardBlock(ctx: FactGuardContext = {}): string {
  const ctas = ctx.approvedCtas?.length
    ? ctx.approvedCtas.map((c) => `  - ${c}`).join("\n")
    : "  (inga angivna — använd då en uppmaning som bara hänvisar till en produkt\n   eller tjänst i listan ovan, eller till att höra av sig)";

  return `FAKTASPÄRR (gäller ALL text du skriver — inlägg, rubriker, nyhetsbrev,
kampanjer, uppmaningar och möjligheter)

Du får BARA bygga på det som står i företagsdatan nedan, plus allmänt kända
datum, säsonger och väderförhållanden. Du får ALDRIG hitta på:
- produkter eller tjänster som inte står i listan över produkter och tjänster
- erbjudanden, kampanjer, rabatter, paket, priser, fri frakt eller garantier
- egenskaper, mått, material, certifieringar, kompatibilitet eller kapacitet
- öppettider, leveranstider, lagerstatus, platser eller samarbeten
- omdömen, kundcitat, betyg, antal kunder eller år i branschen
- lokala evenemang du inte vet äger rum

${lista("PRODUKTER OCH TJÄNSTER SOM FINNS:", ctx.products, "(inga angivna — nämn då ingen specifik tjänst alls)")}

${ctx.locations?.length ? lista("PLATSER SOM FINNS:", ctx.locations, "") + "\n" : ""}${webbBlock(ctx)}
UPPMANINGAR (CTA) — hårdare regel:
En uppmaning får bara hänvisa till något av detta: en produkt eller tjänst i
listan ovan, företagets webbadress, en plats i listan, eller att höra av sig.
Godkända uppmaningar:
${ctas}

Skriv ALDRIG en uppmaning som "Boka en service", "Boka din inspektion",
"Ring för besiktning" eller liknande om inte just den tjänsten står i listan.
Orden ${RISKY_CTA_WORDS.map((w) => `"${w}"`).join(", ")} får bara användas om
företagsdatan uttryckligen stöder dem.

FORMAT SOM KRÄVER MATERIAL VI INTE HAR:
Skriv inte inlägg som förutsätter bilder, film eller pågående händelser du
inte har underlag för — alltså inget ${UNSUPPORTED_FORMATS.map((f) => `"${f}"`).join(", ")}
om inte företagsdatan innehåller sådant material.

LOVAR RUBRIKEN NÅGOT SKA TEXTEN HÅLLA DET:
Säger rubriken "5 steg", "tre saker" eller "checklista" ska punkterna finnas i
brödtexten. En rubrik som lovar en lista utan lista är ett trasigt inlägg.
${ctx.forbiddenClaims?.length ? `\nANVÄNDAREN HAR UTTRYCKLIGEN FÖRBJUDIT:\n${ctx.forbiddenClaims.map((c) => `  - ${c}`).join("\n")}` : ""}

INGA PLATSHÅLLARE:
Skriv aldrig [ort], [namn], [pris], {{något}} eller liknande. Saknar du
ett faktum: formulera om meningen så den inte behöver faktumet, eller
utelämna meningen. En text med en lucka i är inte färdig, och kunden
ska inte behöva fylla i den åt dig.

INTERN STYRDATA SYNS ALDRIG I TEXTEN:
Prioritet, lönsamhet, marknadsföringsmål och inläggets roll är underlag
FÖR DIG. De får aldrig nämnas i en text en kund läser. Skriv aldrig
${INTERNAL_TERMS.map((t) => `"${t}"`).join(", ")} eller liknande.
Skriv inte heller att en produkt är "prioriterad" eller "lönsam" för
företaget. Att en produkt är lönsam är ett skäl att skriva om den, inte
något att skriva. Att den är prisvärd FÖR KUNDEN får du däremot skriva,
om företagsdatan stöder det.

SÄKERHETSRÅD — HÅRD GRÄNS:
Skriv INGA instruktioner om läcksökning, förvaring, installation,
anslutning, felsökning eller reparation utöver det som ordagrant står i
företagsdatan. Inga steg-för-steg-råd, inga kontrollmetoder, inga
tumregler om avstånd, ventilation, temperatur eller tryck.
Hänvisa i stället till personalen, till tillverkarens anvisningar och
till gällande regler. Ett felaktigt råd om gasol är en säkerhetsfråga,
inte en kvalitetsfråga.
Det är tillåtet att skriva ATT något bör kontrolleras. Det är inte
tillåtet att skriva HUR, om inte företagsdatan säger det.

KONKURRERANDE LÖSNINGAR:
Nämn aldrig en konkurrerande lösning positivt — inte vedkamin,
elvärme, värmefläkt, pelletsbrännare eller motsvarande i andra
branscher. Skriv om det företaget säljer. Jämför inte, rekommendera
inte, och föreslå inte ett alternativ till den egna produkten.

ÄR DU OSÄKER: skriv allmänt i stället för specifikt, eller skriv kortare.
Hellre allmänt än påhittat.`;
}

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
  /** Företagets webbadress, om den är känd. */
  website?: string;
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

${ctx.locations?.length ? lista("PLATSER SOM FINNS:", ctx.locations, "") + "\n" : ""}${ctx.website ? `WEBBADRESS: ${ctx.website}\n` : ""}
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

ÄR DU OSÄKER: skriv allmänt i stället för specifikt, eller skriv kortare.
Hellre allmänt än påhittat.`;
}

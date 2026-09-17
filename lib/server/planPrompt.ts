// ─────────────────────────────────────────────────────────────
// Veckoplanens prompt.
//
// Bor här och inte i routen av ett skäl: eval-skriptet (npm run
// eval:plan) ska mäta den prompt som faktiskt körs i produktion. Låg
// bygget kvar inne i POST-handlern hade evalen behövt en egen kopia,
// och en kopia glider isär — precis som faktaspärren gjorde innan den
// bröts ut.
//
// Ingen import av next/headers här, så modulen går att köra från ett
// vanligt tsx-skript utan Next-runtime.
// ─────────────────────────────────────────────────────────────
import { voiceBlock, isoWeek } from "./voice";
import { factGuardBlock } from "./factGuard";
import type { CompanyBrainContext } from "@/app/_shared/companyBrain";

export type PlanCompanyProfile = {
  companyName?: string; industry?: string; summary?: string;
  customers?: string[]; products?: string[]; tone?: string[];
  strengths?: string[]; avoid?: string[]; contentGuidelines?: string[];
};

/** De fem rollerna en veckas inlägg ska fördela sig på. */
export const POST_ROLES = ["saljande", "tips", "prioriterad_produkt", "lokalt", "socialt"] as const;
export type PostRole = (typeof POST_ROLES)[number];

/** Veckodagar i JSON:en. Inläggen sprids ut, inte alla på måndag. */
export const POST_DAYS = ["måndag", "tisdag", "onsdag", "torsdag", "fredag", "lördag", "söndag"] as const;

/** Ordgränser, delade av prompten, reparationsrundan och eval-skriptet
 *  så kraven inte kan glida isär.
 *
 *  Nyhetsbrevets golv sänktes från 150 till 130: efter reparation landade
 *  det på 147 i en av tre körningar, och att köra ytterligare en runda för
 *  tre ords skull är inte värt anropet. 130 ord är fortfarande ett riktigt
 *  nyhetsbrev. */
export const LENGTH_LIMITS = {
  POST_MIN_WORDS: 60,
  POST_MAX_WORDS: 150,
  NEWSLETTER_MIN_WORDS: 130,
  NEWSLETTER_MAX_WORDS: 300,
} as const;

export const PLAN_SYSTEM_PROMPT = `Du är en erfaren copywriter och marknadsstrateg specialiserad på lokala svenska tjänsteföretag.
Skapa marknadsinnehåll som känns skrivet av någon som KÄNNER företaget inifrån — inte av en AI.
Svara ALLTID med exakt giltig JSON — ingen förtext, inga backticks. Svara på svenska.`;

/**
 * Prioritet, lönsamhet och säsong per produkt, plus marknadsföringsmålen.
 * Saknades helt tidigare: prompten fick produkterna som en kommaseparerad
 * sträng utan struktur, och målen nådde den aldrig.
 */
export function brainBlock(brain: CompanyBrainContext | null): string {
  if (!brain) return "";

  const produkter = brain.priorityProducts.length > 0
    ? brain.priorityProducts.map((p) => {
        const delar = [
          `prioritet: ${p.priority}`,
          `lönsamhet: ${p.profitability}`,
          p.seasonality ? `säsong: ${p.seasonality}` : null,
        ].filter(Boolean).join(" · ");
        const extra = [
          p.description ? `      Beskrivning: ${p.description}` : null,
          p.differentiators.length ? `      Skiljer sig genom: ${p.differentiators.join("; ")}` : null,
          p.objections.length ? `      Vanliga invändningar: ${p.objections.join("; ")}` : null,
        ].filter(Boolean).join("\n");
        return `  - ${p.name} (${delar})${extra ? "\n" + extra : ""}`;
      }).join("\n")
    : "  (inga produkter registrerade)";

  const mal = brain.marketingGoals.length > 0
    ? brain.marketingGoals.map((g) => `  - ${g}`).join("\n")
    : "  (inga mål angivna)";

  return `
PRODUKTER MED PRIORITET, LÖNSAMHET OCH SÄSONG:
${produkter}

MARKNADSFÖRINGSMÅL — varje inlägg ska tjäna minst ett av dessa:
${mal}
${brain.seasons.length ? `\nVIKTIGA SÄSONGER: ${brain.seasons.join(", ")}` : ""}
${brain.usps.length ? `\nDET SOM SKILJER FÖRETAGET: ${brain.usps.join("; ")}` : ""}
${brain.proofPoints.length ? `\nVERIFIERADE BEVIS SOM FÅR ÅBEROPAS: ${brain.proofPoints.join("; ")}` : ""}

STYRREGLER FÖR URVALET:
- Produkter med prioritet "high" ELLER lönsamhet "high" som är i säsong just
  nu MÅSTE förekomma i minst ett inlägg den här veckan.
- Den högst prioriterade produkten i säsong får inlägget med rollen
  "prioriterad_produkt".
- Koppla inlägget till ett av målen ovan när det passar, och skriv vilket
  i fältet "mal". Passar inget mål: lämna "mal" tom. Ett påklistrat mål
  är sämre än inget — det styr texten mot fel sak.
- Mål som handlar om återförsäljare, grossister, partners eller andra
  företag får BARA sättas på inlägg som är skrivna till företag. Sätt dem
  aldrig på ett inlägg riktat till privatpersoner; en husbilsägare bryr
  sig inte om er återförsäljarrekrytering.`;
}

export interface PlanPromptInput {
  profile: PlanCompanyProfile;
  brain: CompanyBrainContext | null;
  now: Date;
  upcomingDates: string;
  historyContext: string;
  feedbackContext: string;
  fileContext: string;
  editMemory: string;
}

export function buildPlanUserPrompt(input: PlanPromptInput): string {
  const { profile, brain, now, upcomingDates, historyContext, feedbackContext, fileContext, editMemory } = input;
  const year = now.getFullYear();
  const month = now.toLocaleString("sv-SE", { month: "long" });
  const day = now.getDate();
  const week = isoWeek(now);

  return `NULÄGE: ${day} ${month} ${year}, vecka ${week}.

KOMMANDE HÄNDELSER OCH DATUM (nästa 2 veckor):
${upcomingDates}
${historyContext}
${feedbackContext}

FÖRETAGSPROFIL:
Företagsnamn: ${profile.companyName ?? ""}
Bransch: ${profile.industry ?? ""}
Sammanfattning: ${profile.summary ?? ""}
Kunder: ${(profile.customers ?? []).join(", ")}
Produkter och tjänster: ${(profile.products ?? []).join(", ")}
Tonalitet: ${(profile.tone ?? []).join(", ")}
Styrkor: ${(profile.strengths ?? []).join(", ")}
Ska undvikas: ${(profile.avoid ?? []).join(", ")}
Innehållsriktlinjer: ${(profile.contentGuidelines ?? []).join(", ")}
${fileContext}

${brainBlock(brain)}

${factGuardBlock({
  products: brain?.priorityProducts.map((p) => p.name) ?? profile.products ?? [],
  approvedCtas: brain?.preferredCallsToAction ?? [],
  forbiddenClaims: brain?.forbiddenClaims ?? [],
})}

${voiceBlock({ variation: true, example: false })}

${editMemory}

DESSUTOM:
1. Använd ALLTID företagets faktiska namn och specifika tjänster
2. Anpassa till ${day} ${month} ${year} — rätt år är ${year}, inte något tidigare år
3. Matcha branschens verkliga språk
4. Upprepa INTE teman, fokus eller inläggstitlar från tidigare planer
5. Om användaren gett feedback ovan: luta tydligt mot de gillade inläggens stil och ton, och undvik mönstren i de ogillade

FEM INLÄGG MED FEM OLIKA ROLLER — inte fem varianter av samma budskap.
Exakt ett inlägg per roll, i den här ordningen:
1. "saljande" — lyfter en produkt eller tjänst ur listan och varför den löser
   något just nu. Får sälja, men bara på det som finns.
2. "tips" — praktisk kunskap läsaren kan använda direkt, utan att köpa något.
3. "prioriterad_produkt" — handlar om den högst prioriterade produkten i
   säsong. Skriv produktens namn i fältet "produkt".
4. "lokalt" — knyter an till orten, depån eller platsen där kunderna finns.
   Hitta inte på platser; använd bara dem som står i företagsdatan.
5. "socialt" — ställer en fråga eller bjuder in till ett samtal. Inga
   tävlingar, inga utlottningar, inget som kräver bilder vi inte har.

LÄNGD OCH SUBSTANS — LÄS DET HÄR NOGA:
Skrivreglerna ovan säger "hellre kort än utfyllt". Det betyder INGA
utfyllnadsmeningar — det betyder INTE färre ord. Ett inlägg på 40 ord är
inte kort och kärnfullt, det är ofärdigt. Lös det genom att ha mer att
säga, inte genom att skriva mindre.

- "text" i varje inlägg: MINST ${LENGTH_LIMITS.POST_MIN_WORDS} ord, HÖGST ${LENGTH_LIMITS.POST_MAX_WORDS}. Räkna orden.
  Ett inlägg under ${LENGTH_LIMITS.POST_MIN_WORDS} ord är underkänt och måste skrivas om.
  Så här når du dit utan att fylla ut: (1) ett konkret scenario där
  läsaren känner igen sig, (2) vad man gör åt det, (3) varför just nu.
  Tre saker, inte tre adjektiv.
- "body" i nyhetsbrevet: MINST ${LENGTH_LIMITS.NEWSLETTER_MIN_WORDS} ord, HÖGST ${LENGTH_LIMITS.NEWSLETTER_MAX_WORDS}. Exakt 2–4 stycken,
  åtskilda med en tom rad. Inte ett enda block, inte fem stycken.
  Under ${LENGTH_LIMITS.NEWSLETTER_MIN_WORDS} ord är underkänt.
- Nyhetsbrevet har EN uppmaning, i fältet "cta". Upprepa den inte inne i
  brödtexten.
- Varje inlägg har exakt en tydlig uppmaning i "cta".
- Sprid inläggen över veckan i fältet "dag" — inte alla på samma dag.
  Skriv dagen med liten bokstav och svensk stavning: ${POST_DAYS.join(", ")}.

Ett planinlägg är INTE ett kort socialt inlägg på två meningar. Det är
en färdig text som ska kunna publiceras utan omskrivning — närmare en
kort artikel än en bildtext.

SÅ HÄR LÅNG SKA EN "text" VARA (85 ord, från en annan bransch — härma
längden och uppbyggnaden, aldrig innehållet):
"Vintercykling börjar med däcken. När temperaturen kryper under noll blir
sommardäcken hårda och greppar sämre på våt asfalt, särskilt i kurvor och
vid inbromsning. Dubbdäck låter mycket på torr väg, men skillnaden märks
första morgonen det är halt. Byt i god tid — väntar du tills det redan
ligger is står du i kö med alla andra. Har du en cykel du använder varje
dag är det värt att ha två uppsättningar hjul, så att bytet tar tio
minuter i stället för en kvart i garaget."
Lägg märke till: konkret situation, vad som händer, vad man gör, varför
nu. Inga superlativ. Ingen utfyllnad. Och ändå 85 ord.

INNAN DU SVARAR: räkna orden i varje "text" och i "body". Ligger någon
under ${LENGTH_LIMITS.POST_MIN_WORDS}, skriv om den med mer innehåll — inte med fler ord om samma
sak. Det är det vanligaste felet: texterna blir för korta.

Returnera exakt denna JSON:
{
  "company": "${profile.companyName ?? ""}",
  "focus": "En mening om veckans tema — specifik och säsongsanpassad för ${month} ${year}",
  "intro": "En eller två naturliga meningar till företagaren om varför du valt veckans tema. Löpande text, inte en uppräkning. Räkna INTE upp teman och skriv inte ordet teman.",
  "tags": ["3-5 konkreta teman för veckan, ej enkla ord utan fraser som 'Midsommarförberedelser' eller 'Campingsäsongen startar'"],
  "posts": [
    { "roll": "saljande", "dag": "en av ${POST_DAYS.join("/")}", "produkt": "produktens namn ur listan, eller tom sträng", "mal": "vilket marknadsföringsmål inlägget tjänar", "title": "Rubrik som fångar ett konkret problem", "text": "MINST 60 ord, högst 150. Konkret scenario + vad man gör + varför nu.", "cta": "Uppmaning som bara hänvisar till något som finns", "image": "Realistisk bildidé" },
    { "roll": "tips", "dag": "annan dag", "produkt": "", "mal": "vilket mål", "text": "MINST 60 ord praktisk kunskap. Lovar rubriken en lista ska listan stå här.", "title": "Rubrik", "cta": "Uppmaning", "image": "Bildidé" },
    { "roll": "prioriterad_produkt", "dag": "annan dag", "produkt": "den högst prioriterade produkten i säsong", "mal": "vilket mål", "title": "Rubrik", "text": "MINST 60 ord om just den produkten", "cta": "Uppmaning", "image": "Bildidé" },
    { "roll": "lokalt", "dag": "annan dag", "produkt": "", "mal": "vilket mål", "title": "Rubrik", "text": "MINST 60 ord med lokal förankring", "cta": "Uppmaning", "image": "Bildidé" },
    { "roll": "socialt", "dag": "annan dag", "produkt": "", "mal": "vilket mål", "title": "Rubrik", "text": "MINST 60 ord som bjuder in till samtal", "cta": "Uppmaning", "image": "Bildidé" }
  ],
  "newsletter": {
    "subject": "Ämnesrad max 50 tecken",
    "preview": "Förhandsvisning max 85 tecken",
    "body": "MINST ${LENGTH_LIMITS.NEWSLETTER_MIN_WORDS} ord, högst ${LENGTH_LIMITS.NEWSLETTER_MAX_WORDS}, i 2-4 korta stycken åtskilda med tom rad: scenario → vad man gör → varför just nu i ${month} ${year}",
    "cta": "Uppmaning som bara hänvisar till något som finns"
  },
  "campaigns": [
    { "title": "Kampanj för ${month} ${year}", "goal": "Vad kampanjen uppnår", "message": "Budskap 2-3 meningar", "channels": "Kanaler", "cta": "CTA" },
    { "title": "Kampanj för ${profile.products?.[0] ?? "huvudtjänst"}", "goal": "Vad kampanjen uppnår", "message": "Budskap 2-3 meningar", "channels": "Kanaler", "cta": "CTA" }
  ],
  "opportunities": [
    {
      "title": "Allmänt känt datum, temadag eller säsongsskifte inom 2 veckor",
      "date": "ISO-datum YYYY-MM-DD när tillfället har ett bestämt datum, annars veckans måndag som YYYY-MM-DD",
      "relevance": "Vad tillfället gör med ${profile.companyName ?? "företagets"} kunder, och vilket ämne det ger att skriva om. Bara tjänster som står i profilen. Inga erbjudanden."
    },
    {
      "title": "Säsongsbeteende hos målgruppen just nu",
      "date": "YYYY-MM-DD, måndagen i den vecka det gäller",
      "relevance": "Vad målgruppen gör den här tiden på året och vilket ämne det ger. Inga påhittade tjänster eller erbjudanden."
    },
    {
      "title": "Branschmönster som återkommer den här tiden på året",
      "date": "YYYY-MM-DD, måndagen i den vecka det gäller",
      "relevance": "Vad mönstret innebär för kunderna och vad det ger att skriva om. Bara det som stöds av profilen."
    }
  ]
}

Fältet "date" ska ALLTID vara ett giltigt datum i formen YYYY-MM-DD och
ligga inom de närmaste 14 dagarna från ${day} ${month} ${year}. Skriv
aldrig "Denna vecka", "Vecka 39" eller liknande där — gränssnittet
räknar själv ut hur långt bort det är.`;
}

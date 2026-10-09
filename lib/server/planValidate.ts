// ─────────────────────────────────────────────────────────────
// Validering av en färdig plan.
//
// Prompten kan be om saker; den kan inte garantera dem. Det här är
// mätningen efteråt — samma princip som planRepair, men för fel som
// inte går att laga med ett extra anrop.
//
// Platshållare är det tydligaste exemplet: när modellen saknar ett
// faktum skriver den "[depåort]" i stället för att utelämna meningen.
// Det går inte att gissa fram rätt svar, men det går att sluta låtsas
// att texten är färdig. Inlägget märks "Behöver komplettering" och
// säger vad som saknas i företagskunskapen.
//
// Ren funktion, inga beroenden — routen, gränssnittet och eval-skriptet
// använder samma kod.
// ─────────────────────────────────────────────────────────────

/**
 * Hakparenteser, klammer och vinkelparenteser med innehåll.
 * Gränsen på 80 tecken hindrar att en hel mening med citat fastnar.
 */
const PLATSHALLARE = /\[[^\]\n]{1,80}\]|\{\{[^}\n]{1,80}\}\}|<[a-zåäöA-ZÅÄÖ][^>\n]{0,79}>/g;

/** Alla platshållare i en text, i den ordning de står. */
export function hittaPlatshallare(text: string | undefined): string[] {
  if (!text) return [];
  return [...text.matchAll(PLATSHALLARE)].map((m) => m[0]);
}

/**
 * Vad användaren behöver fylla i, härlett ur platshållarens ord.
 * Hellre en konkret uppmaning än "något saknas".
 */
export function beskrivSaknat(platshallare: string): string {
  const inre = platshallare.replace(/^[[{<]+|[\]}>]+$/g, "").trim().toLowerCase();

  const regler: Array<[RegExp, string]> = [
    [/depå|ort|stad|plats|adress|område/, "Lägg till era depåorter i Vad jag vet"],
    [/öppettid|tider|klockan/, "Lägg till öppettider i Vad jag vet"],
    [/telefon|nummer|kontakt/, "Lägg till kontaktuppgifter i Vad jag vet"],
    [/pris|kr|kostnad|avgift/, "Priser hör inte hemma i texten — ta bort meningen eller lägg in prisuppgiften i Vad jag vet"],
    [/produkt|artikel|vara/, "Lägg till produkten i Vad jag vet"],
    [/namn|företag/, "Lägg till företagsnamnet i Vad jag vet"],
    [/webb|sajt|hemsida|länk|url/, "Lägg till er webbadress i Vad jag vet"],
  ];

  for (const [re, text] of regler) {
    if (re.test(inre)) return text;
  }
  return `Fyll i "${inre}" i Vad jag vet`;
}

/** Unika kompletteringsbehov för en text. */
export function saknatIText(text: string | undefined): string[] {
  return [...new Set(hittaPlatshallare(text).map(beskrivSaknat))];
}

// ── Säkerhetsråd ────────────────────────────────────────────

/**
 * Utrustning som ett säkerhetsråd kan handla om. Delad med
 * eval-skriptet.
 *
 * Orden ensamma betyder ingenting — "vi säljer slang" är
 * produktinformation. Det är först när ett av dem står i samma mening
 * som en handling nedan som texten ska granskas.
 */
export const SAKERHETSORD = [
  // Sjalva flaskan hor hit. Ett forvaringsrad handlar om den, inte om
  // en slang - det missades i en riktig plan: "placera din gasolflaska
  // i ett ventilerat forrad" gick igenom eftersom bara "ventil"
  // trafffade, och da som substantiv utan handling.
  "gasolflask",
  "gasoltub",
  "gastub",
  "slang",
  "regulator",
  "läcka",
  "läck",
  "läcksök",
  "ventil",
  "packning",
  "koppling",
  "kamin",
] as const;

/** Handlingsord som gör ett säkerhetsord till en uppmaning. */
export const SAKERHETSHANDLINGAR = [
  // Forvaring och hantering, inte bara felsokning. Listan sag tidigare
  // bara efter "kontrollera"-artade verb och slapp igenom ett helt
  // forvaringsrad.
  "placera",
  "placering",
  "förvara",
  "förvaring",
  "skydda",
  "täck",
  "överdrag",
  "ställ",
  "anslut",
  "ansluta",
  "kontrollera",
  "kolla",
  "se över",
  "inspektera",
  "rengör",
  "byt",
  "byta",
  "dra åt",
  "koppla",
  "testa",
  "läcksök",
  "montera",
  "installera",
  "reparera",
] as const;

/** Meningar, grovt uppdelade. Radbrytning räknas som gräns. */
function meningar(text: string): string[] {
  return text
    .split(/(?<=[.!?])\s+|\n+/)
    .map((m) => m.trim())
    .filter(Boolean);
}

/**
 * Utrustningsord matchas som DELSTRÄNG — utan ordgräns.
 *
 * Svenskan sätter ihop ord, och utrustningen hamnar då sist i
 * sammansättningen: "gasolslangar", "gasolkaminen", "husbilsgasoltub".
 * Kräver man att ordet ska börja ett ord missas precis de former som
 * faktiskt förekommer i inläggen.
 */
function harUtrustningsord(text: string, ord: string): boolean {
  return text.toLowerCase().includes(ord);
}

/**
 * Handlingsord matchas vid ordBÖRJAN, med valfri svensk ändelse.
 *
 * Här går delsträng fel åt andra hållet: "byt" finns i "utbytbar" och
 * "täck" i "upptäckt", vilket flaggade ren produkttext. Handlingen
 * måste börja ett ord, men får böjas — "byt" fångar "byta" och "byter".
 *
 * Asymmetrin är alltså inte en slarvighet. Substantiven står inuti
 * sammansättningar, verben står först i sina egna ord.
 */
function harHandling(mening: string, ord: string): boolean {
  const flykt = ord.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`(?<!\\p{L})${flykt}\\p{L}*`, "iu").test(mening);
}

/**
 * Utrustningsord som NÄMNS någonstans i texten, oavsett sammanhang.
 *
 * Används bara till den upplysande raden i eval:plan. Att sälja slang
 * ska synas i rapporten, men det är inget att flagga för granskning.
 */
export function sakerhetsordIText(text: string | undefined): string[] {
  if (!text) return [];
  return SAKERHETSORD.filter((o) => harUtrustningsord(text, o));
}

/**
 * Utrustningsord som står i SAMMA MENING som en handling.
 *
 * Det här är vad som flaggar ett inlägg för granskning.
 *
 * Tidigare räckte ett omnämnande. Det gav larm på varje inlägg som
 * råkade nämna en gasolflaska — alltså i praktiken på allt, och en
 * flagga som alltid lyser är ingen flagga. "Vi säljer slang i flera
 * längder" är produktinformation. "Placera slangen svalt" är ett råd.
 * Skillnaden ligger i meningen, inte i texten som helhet.
 */
export function granskningsordIText(text: string | undefined): string[] {
  if (!text) return [];
  const traffar = new Set<string>();
  for (const mening of meningar(text)) {
    if (!SAKERHETSHANDLINGAR.some((h) => harHandling(mening, h))) continue;
    for (const ord of SAKERHETSORD) {
      if (harUtrustningsord(mening, ord)) traffar.add(ord);
    }
  }
  return [...traffar];
}

/**
 * Sant när NÅGON mening både nämner utrustning och uppmanar till något.
 * Samma regel som flaggan, så rapport och gränssnitt aldrig säger emot
 * varandra.
 */
export function arSakerhetsrad(text: string | undefined): boolean {
  return granskningsordIText(text).length > 0;
}

// ── Utropstecken ────────────────────────────────────────────

/**
 * Byter utropstecken mot punkt.
 *
 * voiceBlock forbjuder utropstecken, och modellen foljer det for det
 * mesta - men slapper igenom ett "snabbt!" har och dar. Det ar samma
 * sorts fel som veckodagarnas versaler: mekaniskt, entydigt och inte
 * vart ett extra AI-anrop. Kod far stada interpunktion. Fakta far den
 * inte rora.
 *
 * En serie utropstecken blir en enda punkt. Star det redan ett punkt-
 * eller fragetecken fore forsvinner utropstecknen helt, sa "Va?!" blir
 * "Va?" och inte "Va?.".
 */
export function utanUtropstecken(text: string | undefined): string | undefined {
  if (!text) return text;
  return text.replace(/([.?!]*)!+/g, (_hela, fore: string) => {
    const rensat = fore.replace(/!+/g, "");
    return rensat ? rensat : ".";
  });
}

// ── Veckodagar ──────────────────────────────────────────────

/** Kanoniska veckodagar, alltid med liten bokstav. */
export const VECKODAGAR = [
  "måndag", "tisdag", "onsdag", "torsdag", "fredag", "lördag", "söndag",
] as const;

const DAG_ALIAS: Record<string, string> = {
  mandag: "måndag", manday: "måndag", monday: "måndag",
  tisdag: "tisdag", tuesday: "tisdag",
  onsdag: "onsdag", wednesday: "onsdag",
  torsdag: "torsdag", thursday: "torsdag",
  fredag: "fredag", friday: "fredag",
  lordag: "lördag", saturday: "lördag",
  sondag: "söndag", sunday: "söndag",
};

/**
 * Normaliserar en veckodag till liten bokstav med svenska tecken.
 * Modellen svarar omväxlande "mandag", "Måndag" och "måndag" — utan
 * det här blandas skrivsätten i gränssnittet.
 */
export function normaliseraDag(raw: string | undefined): string | null {
  if (!raw) return null;
  const rensad = raw.trim().toLowerCase();
  if (!rensad) return null;
  if ((VECKODAGAR as readonly string[]).includes(rensad)) return rensad;
  const utanDiakriter = rensad.normalize("NFD").replace(/[̀-ͯ]/g, "");
  return DAG_ALIAS[utanDiakriter] ?? null;
}

// ── Nyhetsbrev ──────────────────────────────────────────────

/** Antal stycken, räknat på tomrad. */
export function antalStycken(body: string | undefined): number {
  if (!body?.trim()) return 0;
  return body.trim().split(/\n\s*\n/).filter((s) => s.trim()).length;
}

/**
 * Delar ett nyhetsbrev som kom tillbaka som ETT block i 2-3 stycken.
 *
 * Reparationsrundan ber om styckeindelning men levererar den bara
 * ibland - tva av tre korningar racker inte for nagot sa mekaniskt.
 * Det har ar ingen innehallsandring: inte ett ord byts, meningarna
 * behaller sin ordning, och en tom rad satts in vid en meningsgrans
 * nara jamna delar. Formatering far kod gora. Fakta far den inte.
 *
 * Texter med for fa meningar lamnas som de ar - hellre ett stycke an
 * ett stycke pa en och en halv mening.
 */
export function delaIStycken(body: string | undefined, onskade = 3): string | undefined {
  if (!body?.trim()) return body;
  if (antalStycken(body) >= 2) return body;

  const meningar = body.trim().match(/[^.!?]+[.!?]+\s*/g);
  if (!meningar || meningar.length < 4) return body;

  const delar = Math.min(onskade, Math.floor(meningar.length / 2));
  if (delar < 2) return body;

  const perDel = Math.ceil(meningar.length / delar);
  const stycken: string[] = [];
  for (let i = 0; i < meningar.length; i += perDel) {
    stycken.push(meningar.slice(i, i + perDel).join("").trim());
  }
  return stycken.filter(Boolean).join("\n\n");
}

// ── Länkar ──────────────────────────────────────────────────

/** Roller vars inlägg ska sluta med en länk. */
const LANKROLLER = ["saljande", "prioriterad_produkt"];

type Webbplats = { url: string; purpose: string };

/**
 * Vad läsaren ombeds göra härnäst: komma till en plats, köpa på nätet
 * eller läsa mer på webbplatsen.
 */
export type KundensHandling = "besok" | "kop" | "las";

/**
 * Ord som pekar ut en fysisk plats. Ett inlägg med en sådan uppmaning
 * ska leda till sidan som berättar VAR vi finns, inte till kassan — det
 * prioriterade inlägget bad om depåbesök och länkade till webbshoppen,
 * vilket skickar läsaren fel.
 *
 * "besök" står inte här. Det är ett verb som också används om
 * webbplatser ("besök webbshoppen") och vägs för sig nedan.
 */
const PLATSORD = [
  "kom förbi", "kom in", "kom till", "depå", "butiken", "på plats",
  "träffa", "svänga förbi", "sväng förbi", "hitta oss", "öppettider",
];

/** Uppmaningar som handlar om att köpa på nätet. */
const KOPORD = [
  "köp", "beställ", "handla", "webbshop", "webbutik", "nätbutik",
  "shoppen", "varukorg", "online", "på nätet",
];

/** Uppmaningar som handlar om att läsa vidare. */
const LASORD = ["läs mer", "läs om", "mer information", "hemsida", "webbplats", "webbsida"];

/** Syften som gör en adress till ett ställe där man köper. */
const KOPSYFTE = /k[öo]p|shop|webbutik|n[äa]tbutik|e-handel|best[äa]ll|handla/i;
/** Syften som gör en adress till ett ställe där man läser om oss och ser var vi finns. */
const INFOSYFTE = /hemsida|information|om oss|dep[åa]|kontakt|hitta|[öo]ppettid|(?<![a-zåäö])butik/i;

/**
 * Orden matchas vid ordBÖRJAN. Som delsträng finns "köp" i "Nyköping",
 * och då blev "Besök oss i Nyköping" ett köp — och "Kom förbi vår depå
 * i Nyköping" både besök och köp, alltså ingenting. Ändelser får följa:
 * "depå" fångar "depån" och "depåerna".
 */
const harOrd = (text: string, ord: readonly string[]) =>
  ord.some((o) => new RegExp(`(?<!\\p{L})${o.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`, "iu").test(text));

/** Sant när uppmaningen ber läsaren komma till en fysisk plats. */
export function arBesoksuppmaning(cta: string | undefined): boolean {
  return kundensHandling(cta) === "besok";
}

/**
 * Kundens nästa handling, läst ur UPPMANINGEN och ingenting annat.
 *
 * Tidigare avgjorde uppmaningen och hela brödtexten tillsammans, och
 * ordet "depå" någonstans i ett säljande inlägg räckte för att det
 * skulle räknas som ett besök. Uppmaningen är det läsaren ombeds göra.
 * Brödtexten beskriver; den ber inte om något.
 *
 * Null när uppmaningen inte säger vart läsaren ska, eller pekar åt två
 * håll på en gång ("kom förbi eller beställ på nätet"). Då vet vi inte
 * vart länken ska leda, och då rörs ingen länk.
 */
export function kundensHandling(cta: string | undefined): KundensHandling | null {
  const l = (cta ?? "").toLowerCase();
  const plats = harOrd(l, PLATSORD);
  const kop = harOrd(l, KOPORD);
  const las = harOrd(l, LASORD);

  if (plats && kop) return null;
  if (plats) return "besok";
  if (kop) return "kop";
  // "Besök vår hemsida" är att läsa vidare, "Besök oss" är att komma dit.
  if (harOrd(l, ["besök"])) return las ? "las" : "besok";
  if (las) return "las";
  return null;
}

/**
 * Adressen där man köper. Null när ingen registrerad adress har det
 * syftet — den första i listan togs tidigare som reserv, och då kunde
 * en informationssida stå som köplänk.
 */
export function kopLank(websites: Webbplats[] | undefined): string | null {
  return (websites ?? []).find((w) => w.url && KOPSYFTE.test(w.purpose))?.url ?? null;
}

/**
 * Adressen som berättar om verksamheten och var den finns. Null när
 * ingen registrerad adress har det syftet. Reserven var tidigare "den
 * som inte är shoppen, annars den första" — med bara webbshoppen
 * registrerad fick ett depåbesök alltså shoppens adress.
 */
export function infoLank(websites: Webbplats[] | undefined): string | null {
  return (websites ?? []).find((w) => w.url && INFOSYFTE.test(w.purpose))?.url ?? null;
}

/** Länken som hör till handlingen, eller null när rätt destination saknas. */
export function lankFor(websites: Webbplats[] | undefined, handling: KundensHandling | null): string | null {
  if (handling === "kop") return kopLank(websites);
  if (handling === "besok" || handling === "las") return infoLank(websites);
  return null;
}

/** Länken som hör till inläggets uppmaning. */
export function valjLank(websites: Webbplats[] | undefined, cta: string | undefined): string | null {
  return lankFor(websites, kundensHandling(cta));
}

/** Värdnamn utan www, eller null. Egen kopia så modulen förblir fristående. */
function vard(raw: string): string | null {
  try {
    return new URL(/^https?:\/\//i.test(raw) ? raw : `https://${raw}`).hostname.replace(/^www\./, "").toLowerCase();
  } catch {
    return null;
  }
}

const LANK_I_TEXT = /\bhttps?:\/\/[^\s<>()"']+|\b[a-z0-9-]+(?:\.[a-z0-9-]+)*\.[a-z]{2,}(?:\/[^\s<>()"']*)?/gi;

/** Länkarna i en text, utan avslutande skiljetecken. */
function lankarI(text: string): string[] {
  return [...new Set((text.match(LANK_I_TEXT) ?? []).map((l) => l.replace(/[.,;:]+$/, "")))];
}

/** Den registrerade webbplats en länk i texten pekar på, om någon. */
function registreradSida(lank: string, websites: Webbplats[]): Webbplats | null {
  const v = vard(lank);
  if (!v) return null;
  return websites.find((w) => vard(w.url) === v) ?? null;
}

/** Sant när webbplatsens syfte passar handlingen. */
function passar(sida: Webbplats, handling: KundensHandling): boolean {
  return (handling === "kop" ? KOPSYFTE : INFOSYFTE).test(sida.purpose);
}

/** Vad som saknas när ett inlägg ber om något vi inte har en adress för. */
function saknadDestination(handling: KundensHandling): string {
  const vad = {
    besok: ["ber om ett besök", "med depå- eller kontaktinformation"],
    las: ["hänvisar till webbplatsen", "med information om verksamheten"],
    kop: ["ber om ett köp", "med köpsyfte"],
  }[handling];
  return `Inlägget ${vad[0]}, men ingen webbplats ${vad[1]} finns i Vad jag vet. Länken är borttagen — lägg till adressen under Webbplatser om inlägget ska länka.`;
}

/**
 * Sant när en registrerad länk i texten pekar åt fel håll för
 * uppmaningen. Delad med eval-skriptet, så mätningen och rättningen
 * använder samma regel.
 */
export function lankMotHandlingen(
  websites: Webbplats[] | undefined,
  cta: string | undefined,
  text: string | undefined,
): boolean {
  const sidor = (websites ?? []).filter((w) => w.url);
  const handling = kundensHandling(cta);
  if (!handling || !text) return false;
  return lankarI(text).some((l) => {
    const sida = registreradSida(l, sidor);
    return sida !== null && !passar(sida, handling);
  });
}

/**
 * Låter kundens nästa handling styra länken i varje inlägg.
 *
 * Tre saker, i den här ordningen:
 *  1. En registrerad adress som pekar åt fel håll byts mot den rätta.
 *     Ber uppmaningen om ett depåbesök ska webbshoppen inte stå där.
 *  2. Finns ingen adress med rätt syfte tas den felaktiga bort, och
 *     inlägget får en rad i `saknas` om vad som behöver läggas till.
 *     Hellre ingen länk än en som skickar läsaren fel.
 *  3. Säljande och prioriterade inlägg utan länk får den rätta sist.
 *     Prompten ber om det men landar det bara ibland.
 *
 * Adresserna kommer ur företagsdatan och inget annat ändras i texten,
 * så det här är att rätta ett fält, inte att skriva copy. Adresser som
 * inte är registrerade rörs inte här. Säger uppmaningen inte vad
 * läsaren ska göra rörs ingenting.
 */
export function sattLank<T extends ValideradPlan>(
  plan: T,
  websites: Webbplats[] | undefined,
): T {
  const sidor = (websites ?? []).filter((w) => w.url);
  if (sidor.length === 0) return plan;

  const posts = (plan.posts ?? []).map((p) => {
    const roll = typeof p.roll === "string" ? p.roll : "";
    const original = typeof p.text === "string" ? p.text : "";
    if (!original.trim()) return p;

    const handling = kundensHandling(p.cta as string | undefined);
    if (!handling) return p;

    const ratt = lankFor(sidor, handling);
    let text = original;
    let saknas: string | null = null;

    // 1–2. Rätta registrerade adresser som pekar åt fel håll.
    for (const lank of lankarI(text)) {
      const sida = registreradSida(lank, sidor);
      if (!sida || passar(sida, handling)) continue;
      if (ratt && !lankarI(text).includes(ratt)) {
        text = text.split(lank).join(ratt);
      } else {
        text = text.split(lank).join("").replace(/[ \t]+\n/g, "\n").replace(/[ \t]{2,}/g, " ").trimEnd();
        if (!ratt) saknas = saknadDestination(handling);
      }
    }

    // 3. Lägg till länken där den ska finnas men saknas.
    const harRegistrerad = lankarI(text).some((l) => registreradSida(l, sidor) !== null);
    if (ratt && !harRegistrerad && LANKROLLER.includes(roll)) {
      text = `${text.trimEnd()}\n\n${ratt}`;
    }

    if (text === original && !saknas) return p;
    return {
      ...p,
      text,
      ...(saknas ? { saknas: [...new Set([...(p.saknas ?? []), saknas])] } : {}),
    };
  });

  return { ...plan, posts };
}

// ── Obelagda påståenden ─────────────────────────────────────

/**
 * Det ett påstående får luta sig mot: den text företaget själv lagt in
 * om sig och sina produkter, och de verifierade bevisen.
 *
 * Tre källor hålls isär med flit. Det som står om EN produkt belägger
 * inget om en annan, och ett bevis belägger bara det beviset säger.
 */
export interface Underlag {
  /** Det som gäller hela företaget: sammanfattning, styrkor, USP:ar. */
  text: string;
  /** Verifierade bevis, ett per post. Tom lista = inga omdömen får åberopas. */
  bevis: string[];
  /** Det som står om varje produkt. Utan listan räknas allt i `text`. */
  produkter?: Array<{ namn: string; text: string }>;
}

/** Hela underlaget som löptext, till prompten. */
export function underlagSomText(underlag: Underlag): string {
  return [
    underlag.text,
    ...(underlag.produkter ?? []).flatMap((p) => [p.namn, p.text]),
    ...underlag.bevis,
  ].map((s) => s.trim()).filter(Boolean).join("\n");
}

interface Pastaende {
  re: RegExp;
  /**
   * När påståendet ändå är belagt:
   *  - "bevis": bara när ETT verifierat bevis säger samma sak.
   *  - "ordet": när det träffade ordet står i underlaget.
   *  - RegExp:  när underlaget matchar det.
   */
  stod: "bevis" | "ordet" | RegExp;
}

/**
 * Tre sorters påståenden som låter som fakta men kräver underlag:
 * vad kunder tycker, vad kunden sparar, och att något är bättre.
 *
 * Alla tre stod i en riktig plan: "många upplever", "sparar tid och
 * pengar" och "fräsch gasol". Inget av det fanns i företagsdatan.
 * Det som FINNS där får stå kvar — står det att kunden betalar för den
 * mängd som fylls är det ett faktum, och står det att något sparar tid
 * är det företagets eget påstående och inte modellens.
 */
const OBELAGDA: Pastaende[] = [
  // Vad kunder tycker, gör eller upplever.
  { re: /(?<!\p{L})(?:många|de flesta|flertalet|allt fler|fler och fler)\s+(?:\p{L}+\s+){0,3}?(?:upplever|tycker|menar|väljer|uppskattar|föredrar|märker|känner|säger|berättar|vittnar|rekommenderar|upptäcker|gillar|älskar|har\s+(?:upptäckt|valt|märkt))(?!\p{L})/giu, stod: "bevis" },
  { re: /(?<!\p{L})(?:många|de flesta|flertalet|allt fler|nöjda|trogna)\s+(?:av\s+(?:våra|era)\s+)?kunder(?!\p{L})/giu, stod: "bevis" },
  { re: /(?<!\p{L})kunder(?:na)?\s+(?:som\s+)?(?:säger|älskar|uppskattar|upplever|berättar|tycker|rekommenderar|återkommer|hyllar)(?!\p{L})/giu, stod: "bevis" },
  { re: /(?<!\p{L})(?:populär|omtyckt|uppskatta[dt]|eftertrakta[dt]|efterfråga[dt]|kundfavorit|storsäljare)\p{L}*/giu, stod: "bevis" },
  { re: /(?<!\p{L})(?:recension|omdöme|kundomdöme)\p{L}*/giu, stod: "bevis" },

  // Vad kunden sparar.
  { re: /(?<!\p{L})spar(?:a|ar|at|ade)?\s+(?:\p{L}+\s+){0,3}?tid(?!\p{L})/giu, stod: /spar\p{L}*\s+(?:\p{L}+\s+){0,3}?tid|tidsbespar/iu },
  { re: /(?<!\p{L})tidsbespar\p{L}*/giu, stod: /spar\p{L}*\s+(?:\p{L}+\s+){0,3}?tid|tidsbespar/iu },
  { re: /(?<!\p{L})spar(?:a|ar|at|ade)?\s+(?:\p{L}+\s+){0,3}?(?:pengar|kronor|hundralappar)(?!\p{L})/giu, stod: /spar\p{L}*\s+(?:\p{L}+\s+){0,3}?(?:pengar|kronor)|billig|prisvärd|lägre\s+(?:pris|kostnad)/iu },
  { re: /(?<!\p{L})(?:billigare|billigast\p{L}*|prisvär[dt]\p{L}*|kostnadseffektiv\p{L}*|kostnadsbespar\p{L}*)(?!\p{L})/giu, stod: "ordet" },
  { re: /(?<!\p{L})lägre\s+(?:pris|kostnad)\p{L}*/giu, stod: /lägre\s+(?:pris|kostnad)|billig/iu },
  { re: /(?<!\p{L})(?:lönar sig|ekonomisk[at]?)(?!\p{L})/giu, stod: /lönar sig|ekonomisk/iu },

  // Att något är bättre — än något annat, eller rent allmänt.
  { re: /(?<!\p{L})fräsch\p{L}*/giu, stod: "ordet" },
  { re: /(?<!\p{L})(?:bättre|renare|säkrare|effektivare|snabbare|smidigare|enklare|pålitligare|tryggare)\s+än(?!\p{L})(?!\s+(?:du|man|ni)\s+(?:tror|anar))/giu, stod: "ordet" },
  { re: /(?<!\p{L})(?:högsta|bästa|bäst|överlägsen|oslagbar|förstklassig)\s+kvalit\p{L}*/giu, stod: "ordet" },
  // "Högkvalitativa produkter" och "våra kvalitetsprodukter" är samma
  // omdöme som "högsta kvalitet". Stammen "kvalit" i underlaget belägger det.
  { re: /(?<!\p{L})högkvalitativ\p{L}*/giu, stod: /kvalit/iu },
  { re: /(?<!\p{L})kvalitets\p{L}+/giu, stod: "ordet" },
  { re: /(?<!\p{L})(?:överlägs|oslagbar|förstklassig|branschledande|marknadsledande|marknadens\s+(?:bästa|billigaste|största|ledande))\p{L}*/giu, stod: "ordet" },
];

/** Produkterna ur underlaget som nämns vid namn i texten. */
const namnda = (text: string, produkter: NonNullable<Underlag["produkter"]>) => {
  const l = text.toLowerCase();
  return produkter.filter((p) => p.namn.trim() && l.includes(p.namn.trim().toLowerCase()));
};

/** De bärande orden i ett påstående, som stammar: "uppskattar" -> "uppsk". */
const stammar = (fras: string) =>
  fras.toLowerCase().split(/[^\p{L}]+/u).filter((o) => o.length >= 4).map((o) => o.slice(0, 5));

/**
 * Påståenden i texten som företagsdatan inte täcker, som de står skrivna.
 * Tom lista = inget att anmärka på.
 *
 * Stödet prövas konservativt, mening för mening. Går det inte att
 * fastställa räknas påståendet som obelagt — ett falskt larm kostar en
 * blick, ett påhittat omdöme kostar mer.
 *
 *  - Vilken produkt meningen gäller: den som nämns i meningen, annars
 *    `produkt` (inläggets eller kampanjens eget fält), annars de som
 *    nämns någonstans i texten. Bara de produkternas texter räknas.
 *    Går produkten inte att peka ut räknas ingen produkttext alls.
 *  - Ett bevis som nämner en ANNAN produkt räknas inte.
 *  - Ett omdöme om kunder är belagt först när ett och samma bevis
 *    innehåller påståendets bärande ord. Att det finns bevis räcker
 *    inte: "4,8 i betyg på Google" belägger inte "många väljer lösvikt".
 *
 * Det mekaniska har en gräns. Ett bevis som säger "kunder uppskattar
 * personalen" godkänner också "kunder uppskattar lösvikt" när ingen
 * produkt skiljer dem åt.
 */
export function obelagdaPastaenden(
  text: string | undefined,
  underlag: Underlag = { text: "", bevis: [] },
  produkt?: string,
): string[] {
  if (!text) return [];
  const produkter = underlag.produkter ?? [];
  const traffar = new Set<string>();

  for (const mening of text.split(/(?<=[.!?])\s+|\n+/)) {
    let gallande = namnda(mening, produkter);
    if (gallande.length === 0 && produkt) gallande = namnda(produkt, produkter);
    if (gallande.length === 0) gallande = namnda(text, produkter);

    const bevis = underlag.bevis.filter((b) => {
      const om = namnda(b, produkter);
      return om.length === 0 || om.some((p) => gallande.includes(p));
    });
    const u = [underlag.text, ...gallande.flatMap((p) => [p.namn, p.text]), ...bevis].join("\n").toLowerCase();

    for (const { re, stod } of OBELAGDA) {
      for (const m of mening.matchAll(re)) {
        const fras = m[0].trim();
        const belagt =
          stod === "bevis" ? bevis.some((b) => stammar(fras).every((s) => b.toLowerCase().includes(s)))
            // Ordstammen räcker: "prisvärd" i underlaget täcker "prisvärda".
            : stod === "ordet" ? u.includes(fras.toLowerCase().split(/\s+/)[0].slice(0, 6))
              : stod.test(u);
        if (!belagt) traffar.add(fras);
      }
    }
  }
  return [...traffar];
}

/** Raden användaren får se när ett påstående saknar underlag. */
export function beskrivObelagt(fras: string): string {
  return `Texten påstår "${fras}", men det står inte i Vad jag vet. Ta bort det, eller lägg in det som styrker det.`;
}

// ── Sammanställning ─────────────────────────────────────────

export interface ValideradPost {
  dag?: string;
  /** Vad användaren behöver fylla i. Tom lista = inget saknas. */
  saknas?: string[];
  /** Ord som bör läsas igenom innan inlägget publiceras. */
  granskas?: string[];
  [k: string]: unknown;
}

export interface ValideradPlan {
  posts?: ValideradPost[];
  newsletter?: { body?: string; subject?: string; preview?: string; cta?: string; saknas?: string[]; [k: string]: unknown };
  campaigns?: unknown;
  [k: string]: unknown;
}

/**
 * Raden för ett inlägg som saknar text. Modellen lämnar ibland bara
 * adressen i ett säljande inlägg, och när rättningsrundans utbyggnad
 * inte tas emot är det vad användaren får.
 */
export function saknadText(text: string | undefined): string | null {
  const t = text ?? "";
  const lankar = lankarI(t);
  const utanLankar = lankar.reduce((s, l) => s.split(l).join(" "), t);
  if (/\p{L}/u.test(utanLankar)) return null;
  return `Inlägget har ingen text${lankar.length ? ", bara en adress" : ""}. Skriv texten innan du publicerar.`;
}

/**
 * Märker inlägg med platshållare och normaliserar veckodagarna.
 * Ändrar aldrig själva texten — att gissa fram ett faktum vore precis
 * det problem platshållaren avslöjar.
 *
 * Med `underlag` märks också påståenden som företagsdatan inte täcker,
 * i inlägg, nyhetsbrev och kampanjförslag. Utan det mäts de inte: en
 * tom jämförelse hade underkänt allt.
 */
export function valideraPlan<T extends ValideradPlan>(
  plan: T,
  websites?: Array<{ url: string; purpose: string }>,
  underlag?: Underlag,
): T {
  plan = sattLank(plan, websites);

  const posts = (plan.posts ?? []).map((p) => {
    // Interpunktionen städas FÖRST, så allt som mäts nedan mäts på den
    // text användaren faktiskt får se.
    const title = utanUtropstecken(p.title as string | undefined);
    const text = utanUtropstecken(p.text as string | undefined);
    const cta = utanUtropstecken(p.cta as string | undefined);

    const produkt = typeof p.produkt === "string" ? p.produkt : undefined;
    const obelagda = underlag
      ? [title, text, cta].flatMap((t) => obelagdaPastaenden(t, underlag, produkt)).map(beskrivObelagt)
      : [];
    const utanText = saknadText(text);
    const saknas = [
      // Det länkrättningen redan noterat ska inte skrivas över.
      ...(p.saknas ?? []),
      ...(utanText ? [utanText] : []),
      ...saknatIText(title), ...saknatIText(text), ...saknatIText(cta),
      ...obelagda,
    ];
    const dag = normaliseraDag(p.dag);
    const granskas = [...new Set([
      ...granskningsordIText(title),
      ...granskningsordIText(text),
      ...granskningsordIText(cta),
    ])];
    return {
      ...p,
      ...(title !== undefined ? { title } : {}),
      ...(text !== undefined ? { text } : {}),
      ...(cta !== undefined ? { cta } : {}),
      ...(dag ? { dag } : {}),
      ...(saknas.length ? { saknas: [...new Set(saknas)] } : {}),
      ...(granskas.length ? { granskas } : {}),
    };
  });

  // Samma rad som inläggen får, för de texter rättningsrundan inte
  // lyckades rätta. Utan den syns felet inte alls i nyhetsbrev och
  // kampanjförslag.
  const markta = (texter: unknown[], produkt?: unknown): { saknas?: string[] } => {
    if (!underlag) return {};
    const rader = texter
      .flatMap((t) => obelagdaPastaenden(typeof t === "string" ? t : undefined, underlag, typeof produkt === "string" ? produkt : undefined))
      .map(beskrivObelagt);
    return rader.length ? { saknas: [...new Set(rader)] } : {};
  };

  // Nyhetsbrevet får sin styckeindelning här om modellen slarvade.
  const newsletter = plan.newsletter
    ? (() => {
        const nl = {
          ...plan.newsletter,
          subject: utanUtropstecken(plan.newsletter.subject as string | undefined),
          preview: utanUtropstecken(plan.newsletter.preview as string | undefined),
          body: delaIStycken(utanUtropstecken(plan.newsletter.body)),
          cta: utanUtropstecken(plan.newsletter.cta as string | undefined),
        };
        return { ...nl, ...markta([nl.subject, nl.body, nl.cta]) };
      })()
    : plan.newsletter;

  // Kampanjförslagen är också kundtext så fort de kopieras vidare.
  const campaigns = Array.isArray(plan.campaigns)
    ? (plan.campaigns as Array<Record<string, unknown>>).map((c) => {
        const k = {
          ...c,
          ...(typeof c.title === "string" ? { title: utanUtropstecken(c.title) } : {}),
          ...(typeof c.message === "string" ? { message: utanUtropstecken(c.message) } : {}),
          ...(typeof c.cta === "string" ? { cta: utanUtropstecken(c.cta) } : {}),
        } as Record<string, unknown>;
        return { ...k, ...markta([k.title, k.goal, k.message, k.cta], k.produkt) };
      })
    : plan.campaigns;

  return { ...plan, posts, newsletter, campaigns };
}

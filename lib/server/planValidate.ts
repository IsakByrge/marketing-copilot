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

/**
 * Uppmaningar som handlar om att komma till en fysisk plats.
 * Ett sådant inlägg ska leda till sidan som berättar VAR vi finns, inte
 * till kassan — det prioriterade inlägget bad om depåbesök och länkade
 * till webbshoppen, vilket skickar läsaren fel.
 */
const BESOKSORD = [
  "besök", "kom förbi", "kom in", "kom till", "depå", "butiken",
  "på plats", "träffa", "svänga förbi", "hitta oss", "öppettider",
];

/** Sant när uppmaningen ber läsaren komma någonstans. */
export function arBesoksuppmaning(cta: string | undefined, text?: string): boolean {
  const l = `${cta ?? ""} ${text ?? ""}`.toLowerCase();
  return BESOKSORD.some((o) => l.includes(o));
}

/** Adressen där man köper. */
export function kopLank(websites: Array<{ url: string; purpose: string }> | undefined): string | null {
  const sidor = (websites ?? []).filter((w) => w.url);
  if (sidor.length === 0) return null;
  const kop = sidor.find((w) => /k[öo]p|shop|butik|best[äa]ll|handla/i.test(w.purpose));
  return (kop ?? sidor[0]).url;
}

/** Adressen som berättar om verksamheten och var den finns. */
export function infoLank(websites: Array<{ url: string; purpose: string }> | undefined): string | null {
  const sidor = (websites ?? []).filter((w) => w.url);
  if (sidor.length === 0) return null;
  const info = sidor.find((w) => /hemsida|information|om oss|dep[åa]|kontakt|hitta/i.test(w.purpose));
  // Ingen informationssida angiven: hellre den som INTE är shoppen.
  const ickeShop = sidor.find((w) => !/k[öo]p|shop|best[äa]ll|handla/i.test(w.purpose));
  return (info ?? ickeShop ?? sidor[0]).url;
}

/**
 * Länken som hör till inläggets uppmaning.
 * Ber uppmaningen om ett besök leder den till informationssidan,
 * annars till köpsidan.
 */
export function valjLank(
  websites: Array<{ url: string; purpose: string }> | undefined,
  cta: string | undefined,
  text?: string,
): string | null {
  return arBesoksuppmaning(cta, text) ? infoLank(websites) : kopLank(websites);
}

/**
 * Sätter länken sist i säljande och prioriterade inlägg som saknar en.
 *
 * Prompten ber om det, men landar det bara ibland — tre mätningar gav
 * 0, 2 och 0 av fem. Adressen kommer ur företagsdatan och inget annat
 * ändras i texten, så det här är att fylla i ett fält, inte att skriva
 * copy. Finns ingen adress händer ingenting.
 */
export function sattLank<T extends ValideradPlan>(
  plan: T,
  websites: Array<{ url: string; purpose: string }> | undefined,
): T {
  if (!(websites ?? []).some((w) => w.url)) return plan;

  const posts = (plan.posts ?? []).map((p) => {
    const roll = typeof p.roll === "string" ? p.roll : "";
    if (!LANKROLLER.includes(roll)) return p;
    const text = typeof p.text === "string" ? p.text : "";
    if (!text.trim()) return p;

    // Länken väljs efter uppmaningen, inte efter rollen. Ett inlägg som
    // ber om ett depåbesök ska leda dit man ser var depåerna ligger.
    const lank = valjLank(websites, p.cta as string | undefined, text);
    if (!lank || text.includes(lank)) return p;

    // Redan någon länk i texten? La modellen in en annan av företagets
    // adresser är det ett medvetet val — rör inte.
    if (/https?:\/\/\S+/.test(text)) return p;
    return { ...p, text: `${text.trimEnd()}\n\n${lank}` };
  });

  return { ...plan, posts };
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
  newsletter?: { body?: string; subject?: string; preview?: string; cta?: string; [k: string]: unknown };
  campaigns?: unknown;
  [k: string]: unknown;
}

/**
 * Märker inlägg med platshållare och normaliserar veckodagarna.
 * Ändrar aldrig själva texten — att gissa fram ett faktum vore precis
 * det problem platshållaren avslöjar.
 */
export function valideraPlan<T extends ValideradPlan>(
  plan: T,
  websites?: Array<{ url: string; purpose: string }>,
): T {
  plan = sattLank(plan, websites);

  const posts = (plan.posts ?? []).map((p) => {
    // Interpunktionen städas FÖRST, så allt som mäts nedan mäts på den
    // text användaren faktiskt får se.
    const title = utanUtropstecken(p.title as string | undefined);
    const text = utanUtropstecken(p.text as string | undefined);
    const cta = utanUtropstecken(p.cta as string | undefined);

    const saknas = [...saknatIText(title), ...saknatIText(text), ...saknatIText(cta)];
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

  // Nyhetsbrevet får sin styckeindelning här om modellen slarvade.
  const newsletter = plan.newsletter
    ? {
        ...plan.newsletter,
        subject: utanUtropstecken(plan.newsletter.subject as string | undefined),
        preview: utanUtropstecken(plan.newsletter.preview as string | undefined),
        body: delaIStycken(utanUtropstecken(plan.newsletter.body)),
        cta: utanUtropstecken(plan.newsletter.cta as string | undefined),
      }
    : plan.newsletter;

  // Kampanjförslagen är också kundtext så fort de kopieras vidare.
  const campaigns = Array.isArray(plan.campaigns)
    ? (plan.campaigns as Array<Record<string, unknown>>).map((c) => ({
        ...c,
        ...(typeof c.title === "string" ? { title: utanUtropstecken(c.title) } : {}),
        ...(typeof c.message === "string" ? { message: utanUtropstecken(c.message) } : {}),
        ...(typeof c.cta === "string" ? { cta: utanUtropstecken(c.cta) } : {}),
      }))
    : plan.campaigns;

  return { ...plan, posts, newsletter, campaigns };
}

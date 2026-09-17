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
 * Ord som gör en mening till ett potentiellt säkerhetsråd.
 *
 * Delade med eval-skriptet. Listan är MEDVETET grov: den flaggar för
 * granskning, den blockerar inte. Ett falskt larm kostar en blick, ett
 * missat råd om en gasolslang kostar mer.
 *
 * Att nämna en gasolslang som produkt är alltså också en träff. Det är
 * rätt avvägning — den som säljer slangar vill ändå läsa igenom att
 * texten inte börjat instruera om dem.
 */
export const SAKERHETSORD = [
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

/**
 * Ord i texten som bör granskas innan den publiceras.
 *
 * Ett säkerhetsord ensamt räcker, eftersom sammanhanget är svårt att
 * avgöra mekaniskt och konsekvensen av att missa är en kund som följer
 * ett råd vi aldrig haft täckning för.
 */
export function sakerhetsordIText(text: string | undefined): string[] {
  if (!text) return [];
  const l = text.toLowerCase();
  const traffar = new Set<string>();
  for (const ord of SAKERHETSORD) {
    if (l.includes(ord)) traffar.add(ord);
  }
  return [...traffar];
}

/** Sant när texten både nämner utrustning OCH uppmanar till något. */
export function arSakerhetsrad(text: string | undefined): boolean {
  if (!text) return false;
  const l = text.toLowerCase();
  const harOrd = SAKERHETSORD.some((o) => l.includes(o));
  const harHandling = SAKERHETSHANDLINGAR.some((h) => l.includes(h));
  return harOrd && harHandling;
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
 * Väljer adressen som passar ett säljande inlägg: den vars syfte talar
 * om köp. Finns ingen sådan tas den första.
 */
export function kopLank(websites: Array<{ url: string; purpose: string }> | undefined): string | null {
  const sidor = (websites ?? []).filter((w) => w.url);
  if (sidor.length === 0) return null;
  const kop = sidor.find((w) => /k[öo]p|shop|butik|best[äa]ll|handla/i.test(w.purpose));
  return (kop ?? sidor[0]).url;
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
  const lank = kopLank(websites);
  if (!lank) return plan;

  const posts = (plan.posts ?? []).map((p) => {
    const roll = typeof p.roll === "string" ? p.roll : "";
    if (!LANKROLLER.includes(roll)) return p;
    const text = typeof p.text === "string" ? p.text : "";
    if (!text.trim() || text.includes(lank)) return p;
    // Redan nagon lank i texten? La modellen in en annan av foretagets
    // adresser ar det ett medvetet val - rora inte.
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
  newsletter?: { body?: string; [k: string]: unknown };
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
    const saknas = [
      ...saknatIText(p.title as string | undefined),
      ...saknatIText(p.text as string | undefined),
      ...saknatIText(p.cta as string | undefined),
    ];
    const dag = normaliseraDag(p.dag);
    const granskas = [...new Set([
      ...sakerhetsordIText(p.title as string | undefined),
      ...sakerhetsordIText(p.text as string | undefined),
      ...sakerhetsordIText(p.cta as string | undefined),
    ])];
    return {
      ...p,
      ...(dag ? { dag } : {}),
      ...(saknas.length ? { saknas: [...new Set(saknas)] } : {}),
      ...(granskas.length ? { granskas } : {}),
    };
  });
  // Nyhetsbrevet far sin styckeindelning har om modellen slarvade.
  const newsletter = plan.newsletter
    ? { ...plan.newsletter, body: delaIStycken(plan.newsletter.body) }
    : plan.newsletter;

  return { ...plan, posts, newsletter };
}

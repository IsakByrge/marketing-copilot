// ─────────────────────────────────────────────────────────────
// Campaign Builder — konversationsskript.
// Ingen AI anropas. Reaktionerna är deterministiska men skrivna för
// att kännas som en erfaren marknadschef som tänker med användaren.
// Varje reaktion beror på både frågan och det faktiska svaret.
// ─────────────────────────────────────────────────────────────
import type { ReactNode } from "react";
import type { CampaignGoal } from "./types";

/* ── Kontext som reaktioner och frågor får läsa ──────────────── */
export interface CompanyLite {
  companyName?: string;
  products?: string[];
  customers?: string[];
  bestCustomer?: string;
}

export interface Ctx {
  record: Record<string, string>;
  goal: CampaignGoal | null;
  company?: CompanyLite | null;
}

/* ── En nod i konversationen ─────────────────────────────────── */
export type NodeKind = "goal" | "text" | "textarea" | "date" | "yesno";

export interface ConvNode {
  id: string;
  kind: NodeKind;
  /** Frågan marknadschefen ställer. Får bero på tidigare svar. */
  prompt: (ctx: Ctx) => string;
  placeholder?: string;
  optional?: boolean;
  /** Klickbara förslag (t.ex. från företagets tidigare analys). */
  suggestions?: (ctx: Ctx) => string[];
  /** Marknadschefens korta, personliga reaktion på svaret. */
  react: (value: string, ctx: Ctx) => string;
}

/* ── Små hjälpare ────────────────────────────────────────────── */
export function firstWords(v: string, max = 46): string {
  const clean = v.trim().replace(/\s+/g, " ");
  if (clean.length <= max) return clean;
  return clean.slice(0, max).replace(/[\s,.;:]+\S*$/, "") + "…";
}

const has = (v: string, re: RegExp) => re.test(v);

function fmtDate(iso: string): string {
  if (!iso) return "";
  const d = new Date(iso + "T00:00:00");
  if (isNaN(d.getTime())) return iso;
  return new Intl.DateTimeFormat("sv-SE", { day: "numeric", month: "long" }).format(d);
}

function daysBetween(a: string, b: string): number | null {
  if (!a || !b) return null;
  const da = new Date(a + "T00:00:00").getTime();
  const db = new Date(b + "T00:00:00").getTime();
  if (isNaN(da) || isNaN(db)) return null;
  return Math.round((db - da) / 86400000);
}

/* ── Måldefinitioner (kort + intro + följdfrågor) ────────────── */
export interface GoalConfig {
  id: CampaignGoal;
  title: string;
  description: string;
  icon: ReactNode;
  /** Marknadschefens reaktion direkt efter att målet valts. */
  intro: string;
  questions: ConvNode[];
}

const iconProps = {
  width: 22, height: 22, viewBox: "0 0 24 24", fill: "none",
  stroke: "currentColor", strokeWidth: 1.4,
  strokeLinecap: "round" as const, strokeLinejoin: "round" as const,
};

const Icons = {
  sell: (<svg {...iconProps}><path d="M3 6h18l-1.5 9.5a2 2 0 0 1-2 1.7H6.5a2 2 0 0 1-2-1.7L3 6Z" /><path d="M8 10V5a4 4 0 0 1 8 0v5" /></svg>),
  quote: (<svg {...iconProps}><path d="M4 5h16v11H8l-4 3V5Z" /><path d="M8 9h8M8 12h5" /></svg>),
  store: (<svg {...iconProps}><path d="M4 9V6l2-2h12l2 2v3" /><path d="M4 9a2.5 2.5 0 0 0 5 0 2.5 2.5 0 0 0 5 0 2.5 2.5 0 0 0 5 0" /><path d="M5 11v8h14v-8" /><path d="M10 19v-4h4v4" /></svg>),
  calendar: (<svg {...iconProps}><rect x="4" y="5" width="16" height="15" rx="1.5" /><path d="M4 9h16M8 3v4M16 3v4" /><path d="M9 14l1.5 1.5L14 12" /></svg>),
  launch: (<svg {...iconProps}><path d="M12 3c3 1.5 5 4.5 5 8l-2.5 4h-5L7 11c0-3.5 2-6.5 5-8Z" /><circle cx="12" cy="10" r="1.6" /><path d="M9.5 17l-1.5 3M14.5 17l1.5 3" /></svg>),
  season: (<svg {...iconProps}><circle cx="12" cy="12" r="4" /><path d="M12 2v3M12 19v3M2 12h3M19 12h3M5 5l2 2M17 17l2 2M19 5l-2 2M7 17l-2 2" /></svg>),
  other: (<svg {...iconProps}><circle cx="12" cy="12" r="8.5" /><path d="M9.2 9.5a2.8 2.8 0 0 1 5.4 1c0 1.8-2.6 2.2-2.6 3.6" /><path d="M12 17.5h.01" /></svg>),
};

/* Kort hjälpare: bygg en följdfråga-nod. */
function q(
  id: string,
  kind: NodeKind,
  prompt: string,
  react: (v: string, ctx: Ctx) => string,
): ConvNode {
  return { id, kind, prompt: () => prompt, react };
}

export const GOALS: GoalConfig[] = [
  {
    id: "sell-product",
    title: "Sälj mer av en produkt",
    description: "Öka försäljningen av en specifik produkt.",
    icon: Icons.sell,
    intro: "Du vill sälja mer av en produkt. Klokt val — då kan vi bli riktigt konkreta. Nu ska jag hjälpa dig hitta rätt vinkel.",
    questions: [
      q("problem", "textarea", "Vilket problem löser produkten för kunden?",
        (v) => `Att lösa ”${firstWords(v)}” — där har vi kampanjens smärtpunkt att trycka på.`),
      q("whyChoose", "textarea", "Varför brukar kunder välja just den?",
        () => "Bra — precis den känslan är det vi ska förstärka i budskapet."),
      q("differentiator", "textarea", "Vad skiljer den från alternativen?",
        () => "Det där särskiljer er. Jag ser redan hur vi kan spetsa det mot konkurrenterna."),
      q("objection", "textarea", "Vilken invändning brukar kunder ha?",
        () => "Klokt att ta upp. Möter vi tveksamheten tidigt bygger vi förtroende direkt."),
      q("availableNow", "text", "Är produkten tillgänglig direkt?",
        (v) => has(v, /ja|direkt|omgående|lager|nu\b/i)
          ? "Direkt tillgänglig — då kan vi trycka på ”köp nu” utan att tveka."
          : "Om den inte finns direkt bygger vi hellre förväntan än otålighet."),
      q("urgency", "text", "Finns något som gör kampanjen tidskritisk?",
        (v) => has(v, /ja|begränsa|slut|erbjud|tid|snart|säsong/i)
          ? "Tidspress är en av de starkaste hävstängerna vi har — den använder vi."
          : "Inget tidskritiskt? Då skapar vi hellre brådskan genom själva erbjudandet."),
    ],
  },
  {
    id: "more-quotes",
    title: "Få fler offertförfrågningar",
    description: "Fler kunder som ber om offert på en tjänst.",
    icon: Icons.quote,
    intro: "Fler offertförfrågningar. Bra mål — det här handlar om förtroende, och jag vet precis vad jag ska fråga om.",
    questions: [
      q("service", "text", "Vilken tjänst vill du få fler förfrågningar om?",
        (v) => `”${firstWords(v)}” alltså — då vet jag vad vi ska driva förfrågningar till.`),
      q("bestCustomer", "textarea", "Vilken typ av kund är mest värdefull för dig?",
        () => "Att veta vilken kund som är mest värd låter oss rikta budskapet mot fler som dem."),
      q("deliveryArea", "text", "Vilket område kan du leverera inom?",
        () => "Bra — då lovar vi aldrig mer än du kan hålla. Det bygger trovärdighet."),
      q("barrier", "textarea", "Vad hindrar kunder från att skicka en förfrågan?",
        () => "Just den tröskeln ska kampanjen ta bort. Nu vet jag vad vi måste besvara."),
      q("trust", "textarea", "Finns referenser, garanti eller bevis som bygger förtroende?",
        (v) => v.trim() ? "Bra — förtroendebevis är avgörande för offerter. Det lyfter vi tidigt."
          : "Har vi inga bevis ännu bygger vi förtroende genom tonen istället. Det löser vi."),
      q("responseTime", "text", "Hur snabbt kan du återkomma med en offert?",
        (v) => has(v, /snabb|direkt|dygn|timm|dag|24/i)
          ? "Snabb återkoppling är ett säljargument i sig — det skyltar vi med."
          : "Vi sätter en tydlig förväntan på svarstiden så kunden vågar höra av sig."),
    ],
  },
  {
    id: "store-visits",
    title: "Få fler besök till butik",
    description: "Locka fler människor till den fysiska butiken.",
    icon: Icons.store,
    intro: "Fler besök till butiken. Härligt — fysiska besök är guld. Låt oss ge kunderna en anledning att komma just nu.",
    questions: [
      q("reason", "textarea", "Vilken anledning ska kunden ha att besöka butiken nu?",
        () => "Det där ger kunden en anledning att gå hemifrån — precis vad en butikskampanj behöver."),
      q("featured", "text", "Finns en utvald produkt eller aktivitet att lyfta?",
        () => "Bra — ett tydligt dragplåster gör det mycket lättare att fånga uppmärksamhet."),
      q("hours", "text", "Vilka öppettider gäller?",
        () => "Öppettiderna tar jag med i varje utrop — inget ska stå i vägen för besöket."),
      q("travelDistance", "text", "Hur långt reser dina kunder normalt?",
        () => "Då vet jag hur brett vi ska rikta annonseringen geografiskt."),
      q("inStoreOnly", "textarea", "Finns något som bara erbjuds på plats?",
        (v) => v.trim() ? "Något som bara finns på plats — det är en stark anledning att faktiskt komma dit."
          : "Finns inget exklusivt på plats? Då gör vi själva besöket till upplevelsen."),
      q("measure", "text", "Hur märker du att kampanjen fungerar?",
        () => "Bra att du tänker på mätningen redan nu — då vet vi om det lönar sig."),
    ],
  },
  {
    id: "fill-slots",
    title: "Fyll lediga tider",
    description: "Fyll luckor i kalendern med bokningar.",
    icon: Icons.calendar,
    intro: "Fylla lediga tider. Smart — tomma tider är förlorade intäkter. Här jobbar vi med tempo och timing.",
    questions: [
      q("service", "text", "Vilken tjänst gäller det?",
        () => "Okej — då vet jag exakt vilka tider vi faktiskt ska fylla."),
      q("slotCount", "text", "Hur många tider behöver fyllas?",
        (v) => has(v, /\d/) ? "Konkret antal — då kan vi dosera trycket så det inte känns desperat."
          : "Vi utgår från att fylla så många vi kan, utan att verka för ivriga."),
      q("dates", "textarea", "Vilka datum och tider finns?",
        () => "Med tiderna framför mig kan vi bygga känslan av ”nu eller aldrig”."),
      q("lastMinute", "text", "Hur sent kan en kund boka?",
        () => "Bra — hur sent man kan boka avgör hur akut vi vågar formulera budskapet."),
      q("audience", "textarea", "Vilken målgrupp kan agera snabbt?",
        () => "Just gruppen som kan agera snabbt är den vi ska tala direkt till."),
      q("timeLimitedOffer", "text", "Är ett tidsbegränsat erbjudande möjligt?",
        (v) => has(v, /ja|möjlig|kan|absolut|visst/i)
          ? "Ett tidsbegränsat erbjudande är perfekt för att fylla luckor — det kör vi."
          : "Även utan rabatt kan vi skapa brådska med hur få tider som finns kvar."),
    ],
  },
  {
    id: "launch",
    title: "Lansera något nytt",
    description: "Introducera en ny produkt eller tjänst.",
    icon: Icons.launch,
    intro: "En lansering — spännande. Då bygger vi förväntan och ser till att rätt personer märker den.",
    questions: [
      q("what", "textarea", "Vad är det som lanseras?",
        (v) => `”${firstWords(v)}” — då vet jag vad allt ska kretsa kring.`),
      q("whatsNew", "textarea", "Vad är nytt jämfört med tidigare?",
        () => "Det nya är själva nyheten — och den vinkeln bygger vi hela förväntan på."),
      q("beneficiary", "textarea", "Vem har störst nytta av lanseringen?",
        () => "Då vet jag vem som ska bli mest nyfiken när vi teasar den."),
      q("problem", "textarea", "Vilket problem löser den?",
        () => "Bra — en lansering som löser ett verkligt problem säljer nästan sig själv."),
      q("launchDate", "text", "Finns ett lanseringsdatum?",
        (v) => v.trim() ? "Ett datum ger oss något att räkna ner mot — det skapar naturlig spänning."
          : "Inget datum spikat än? Då bygger vi nyfikenhet först och avslöjar datumet som en grej."),
      q("proof", "text", "Finns bilder, demo eller kundbevis?",
        (v) => has(v, /ja|bild|demo|film|video|kund|referens/i)
          ? "Bra — konkret material gör lanseringen trovärdig. Det använder vi."
          : "Har vi inget material än så bygger vi hellre nyfikenhet än bevis."),
    ],
  },
  {
    id: "seasonal",
    title: "Skapa en säsongskampanj",
    description: "Anpassa erbjudandet efter säsong eller händelse.",
    icon: Icons.season,
    intro: "En säsongskampanj. Perfekt — rätt timing kan avgöra allt. Låt oss fånga behovet precis när det uppstår.",
    questions: [
      q("season", "text", "Vilken säsong eller händelse gäller?",
        (v) => `”${firstWords(v)}” — då vet jag exakt vilket tillfälle vi spelar mot.`),
      q("product", "text", "Vilken produkt eller tjänst är mest relevant då?",
        () => "Bra matchning — rätt produkt vid rätt säsong är halva jobbet."),
      q("needStart", "text", "När börjar kundernas behov infinna sig?",
        () => "Att veta när behovet vaknar avgör när vi ska synas. Timing är allt här."),
      q("behavior", "textarea", "Vilket kundbeteende vill du påverka?",
        () => "Just det beteendet ska kampanjen knuffa i rätt riktning."),
      q("deadline", "text", "Finns ett sista datum?",
        (v) => v.trim() ? "En deadline ger säsongen skärpa — ”innan det är för sent” är starkt."
          : "Ingen deadline? Då låter vi säsongen själv sätta tempot."),
      q("localVariations", "textarea", "Finns lokala variationer att ta hänsyn till?",
        (v) => v.trim() ? "Bra — då anpassar vi tonen så den känns relevant på varje plats."
          : "Inga lokala skillnader gör det enklare — ett budskap som håller överallt."),
    ],
  },
  {
    id: "other",
    title: "Annat mål",
    description: "Något annat — beskriv det med egna ord.",
    icon: Icons.other,
    intro: "Ett eget mål — bra. Då lyssnar jag extra noga så jag förstår exakt vad du vill uppnå.",
    questions: [
      q("goal", "textarea", "Beskriv målet med dina egna ord.",
        (v) => `Okej, jag förstår — ”${firstWords(v)}”. Då jobbar vi mot det.`),
      q("action", "textarea", "Vad vill du att kunden ska göra?",
        () => "Tydligt vad kunden ska göra — det blir vår call to action."),
      q("actor", "text", "Vem är det som ska agera?",
        () => "Då vet jag vem budskapet ska tala till."),
      q("marketed", "textarea", "Vad är det som marknadsförs?",
        () => "Bra — då har jag kärnan i vad vi lyfter fram."),
      q("when", "text", "När ska resultatet vara uppnått?",
        () => "Ett mål i tiden hjälper oss hålla kampanjen fokuserad."),
      q("measure", "text", "Hur ska resultatet mätas?",
        () => "Att veta hur vi mäter framgång gör att vi kan styra kampanjen med data, inte känsla."),
    ],
  },
];

export function getGoal(id: CampaignGoal | null): GoalConfig | undefined {
  if (!id) return undefined;
  return GOALS.find((g) => g.id === id);
}

/* ── Grundfrågorna (steg 2) som konversationsnoder ───────────── */
const BASICS: ConvNode[] = [
  {
    id: "product",
    kind: "text",
    prompt: (ctx) =>
      ctx.company?.products?.length
        ? "Vad ska vi marknadsföra den här gången? Jag känner ju till er sedan tidigare — välj gärna ett av förslagen."
        : "Låt oss börja med kärnan. Vad är det vi ska marknadsföra — en produkt, tjänst eller ett erbjudande?",
    placeholder: "t.ex. Gasolpaket för husbil",
    suggestions: (ctx) => ctx.company?.products?.slice(0, 4) ?? [],
    react: (v) => `${firstWords(v)} — bra, då har vi något konkret att kretsa kring.`,
  },
  {
    id: "description",
    kind: "textarea",
    prompt: () => "Beskriv den kort för mig — som om jag vore en nyfiken kund.",
    placeholder: "Vad är det, och för vem?",
    react: (v) => v.trim().length < 40
      ? "Kort och kärnfullt — det gillar jag."
      : "Bra, det ger mig en känsla för hur du själv pratar om den.",
  },
  {
    id: "targetAudience",
    kind: "text",
    prompt: (ctx) =>
      ctx.company?.customers?.length || ctx.company?.bestCustomer
        ? "Vem försöker vi nå? Baserat på vad jag vet om er har jag ett par gissningar — men säg som det är."
        : "Vem försöker vi nå? Måla upp din typiska kund för mig.",
    placeholder: "t.ex. Husbilsägare 50–70 år",
    suggestions: (ctx) => {
      const list = ctx.company?.customers?.slice(0, 3) ?? [];
      if (!list.length && ctx.company?.bestCustomer) return [ctx.company.bestCustomer];
      return list;
    },
    react: (v) => `${firstWords(v)} — då vet jag precis vem jag ska skriva till.`,
  },
  {
    id: "geographicArea",
    kind: "text",
    prompt: () => "Var finns kunderna? En stad, ett område — eller hela landet?",
    placeholder: "t.ex. Norrköping med omnejd",
    react: (v) => has(v, /hela|sverige|nationellt|riks|online|webb/i)
      ? "Brett upptag — då lägger vi krutet på budskapet snarare än geografin."
      : `Lokalt fokus på ${firstWords(v, 24)} gör annonseringen både billigare och vassare.`,
  },
  {
    id: "availability",
    kind: "text",
    prompt: () => "Hur ser tillgängligheten ut? Finns den i lager och kan levereras?",
    placeholder: "t.ex. I lager, leverans inom 2 dagar",
    react: (v) => has(v, /slut|få\b|begränsa|restnot|kö|väntetid/i)
      ? "Begränsad tillgång är faktiskt ett säljargument — vi kan bygga en del av kampanjen på det."
      : "Bra — då kan vi lova leverans utan att tveka.",
  },
  {
    id: "price",
    kind: "text",
    prompt: () => "Har den ett pris du vill kommunicera? Hoppa gärna över om du är osäker.",
    placeholder: "t.ex. 499 kr",
    optional: true,
    react: (v) => v.trim()
      ? `${firstWords(v, 20)} — ett tydligt pris gör erbjudandet lättare att ta till sig.`
      : "Vi håller priset öppet så länge — det kan vi landa senare.",
  },
  {
    id: "margin",
    kind: "text",
    prompt: () => "Om du vill: hur ser marginalen ut? Det styr hur mycket vi kan rabattera. Helt frivilligt.",
    placeholder: "t.ex. 40 %",
    optional: true,
    react: (v) => v.trim()
      ? "Bra, då vet jag hur mycket utrymme vi har att leka med i erbjudandet."
      : "Vi lämnar marginalen därhän — jag håller mig försiktig med rabatterna tills vidare.",
  },
  {
    id: "startDate",
    kind: "date",
    prompt: () => "När vill du att kampanjen drar igång?",
    react: (v) => {
      const soon = daysBetween(new Date().toISOString().slice(0, 10), v);
      if (soon !== null && soon <= 7) return `${fmtDate(v)} — det är snart. Då håller vi tempot uppe.`;
      return `${fmtDate(v)} som start — noterat.`;
    },
  },
  {
    id: "endDate",
    kind: "date",
    prompt: () => "Och när ska den vara över?",
    react: (v, ctx) => {
      const d = daysBetween(ctx.record.startDate, v);
      if (d === null) return `${fmtDate(v)} som slut — då har vi ramen klar.`;
      if (d <= 7) return "Kort och intensivt — det tvingar fram ett riktigt tydligt budskap.";
      if (d <= 31) return "En klassisk kampanjlängd — lagom för att hinna bygga igenkänning.";
      return "Gott om tid — då kan vi köra kampanjen i faser istället för ett enda utrop.";
    },
  },
  {
    id: "hasExistingOffer",
    kind: "yesno",
    prompt: () => "Har du redan ett erbjudande i åtanke? En rabatt, ett paket, något extra?",
    react: (v) => v === "ja"
      ? "Perfekt — då bygger vi vidare på det du redan har."
      : "Ingen fara. Att forma erbjudandet är ofta det som avgör hela kampanjen — det tar vi tillsammans.",
  },
  {
    id: "offerContent",
    kind: "textarea",
    prompt: () => "Berätta om erbjudandet.",
    placeholder: "t.ex. 2 för 1 på gasolflaskor t.o.m. söndag",
    react: (v) => `”${firstWords(v)}” — starkt. Det blir kampanjens kärna.`,
  },
];

/**
 * Bygger hela nodsekvensen utifrån valt mål och hittills givna svar.
 * Dynamiska följdfrågor får prefixet `q_` i record för att inte
 * krocka med grundfrågornas nycklar (t.ex. seasonal-frågan "product").
 */
export function buildNodes(goal: CampaignGoal | null, record: Record<string, string>): ConvNode[] {
  const goalNode: ConvNode = {
    id: "goal",
    kind: "goal",
    prompt: () => "Först och främst — vad vill du uppnå med den här kampanjen?",
    react: (v) => getGoal(v as CampaignGoal)?.intro ?? "Okej — då sätter vi igång.",
  };

  if (!goal) return [goalNode];

  const basics = BASICS.filter((n) => {
    // Fråga bara om erbjudandets innehåll om ett erbjudande finns.
    if (n.id === "offerContent") return record.hasExistingOffer === "ja";
    return true;
  });

  const cfg = getGoal(goal);
  const dynamic: ConvNode[] = (cfg?.questions ?? []).map((qn) => ({
    ...qn,
    id: `q_${qn.id}`,
  }));

  return [goalNode, ...basics, ...dynamic];
}

export { fmtDate, daysBetween };

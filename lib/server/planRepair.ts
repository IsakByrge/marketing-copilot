// ─────────────────────────────────────────────────────────────
// Reparationsrunda för veckoplanen.
//
// VARFÖR: modellen skriver konsekvent för korta inlägg på svenska,
// oavsett hur prompten formuleras. Eval-skriptet visade 36–61 ord mot
// kravet 60–150 över sex körningar, med olika formuleringar av kravet,
// ett borttaget kortformsexempel och ett inlagt exempel på rätt längd.
// Skillnaden var mätbar men aldrig tillräcklig.
//
// Samma sak gäller påståenden utan underlag. Med en uttrycklig regel i
// faktaspärren, tre förbjudna exempelmeningar och uppmaningen att
// skriva faktumet i stället för slutsatsen stod "sparar tid och
// pengar" eller "kostnadseffektiv" kvar i fem planer av fem. Står det i
// företagsdatan att kunden bara betalar för det som fylls drar modellen
// slutsatsen åt läsaren.
//
// Prompttryck har en gräns. Det här är i stället en mätning: räkna
// orden och leta upp påståendena, och be om rättning BARA av de texter
// som faktiskt har felet. Ett extra anrop, och bara när det behövs.
//
// Rundan körs HÖGST EN GÅNG per plan. Hjälper den inte behåller vi det
// modellen skrev — en text som är några ord för kort är bättre än ännu
// ett anrop, och bättre än en tom sida. Ett påstående som står kvar i
// ett inlägg märks av valideringen efteråt (planValidate.ts).
//
// Modulen är ren funktion + promptbygge, utan Supabase eller
// next/headers, så både routen och eval-skriptet kan använda den.
// ─────────────────────────────────────────────────────────────
import { LENGTH_LIMITS } from "./planPrompt";
import { obelagdaPastaenden, underlagSomText, type Underlag } from "./planValidate";
import { forbjudnaSasongsord, sasongsfelIText } from "./season";
import { lankarIText, vardnamn } from "@/app/_shared/websites";

export const ord = (s: string): number =>
  (s ?? "").trim().split(/\s+/).filter(Boolean).length;

export interface PlanPost {
  roll?: string; dag?: string; produkt?: string; mal?: string;
  title?: string; text?: string; cta?: string; image?: string;
  /** Oppen for falt valideringen lagger till, t.ex. saknas. */
  [k: string]: unknown;
}

export interface PlanCampaign {
  title?: string; produkt?: string; goal?: string; message?: string; cta?: string;
  [k: string]: unknown;
}

export interface PlanShape {
  posts?: PlanPost[];
  newsletter?: { subject?: string; preview?: string; body?: string; cta?: string };
  campaigns?: PlanCampaign[];
  [k: string]: unknown;
}

/* ── Fälten rundan kan rätta ────────────────────────────── */

/** Ett textfält i planen, med nyckeln modellen svarar under. */
interface Falt {
  nyckel: string;
  etikett: string;
  text: string;
  /** Minsta antal ord. Bara brödtexterna har ett golv. */
  minst?: number;
  /** Produkten inlägget eller kampanjen gäller, när den står angiven. */
  produkt?: string;
}

const KAMPANJFALT = { titel: "title", mal: "goal", budskap: "message", cta: "cta" } as const;
type Kampanjdel = keyof typeof KAMPANJFALT;

/**
 * Alla fält en kund kan få läsa. Inläggens brödtext har bara sitt index
 * som nyckel och nyhetsbrevet heter "newsletter" — så har rundan alltid
 * svarat, och de nycklarna ändras inte.
 */
function allaFalt(plan: PlanShape): Falt[] {
  const falt: Falt[] = [];
  (plan.posts ?? []).forEach((p, i) => {
    const namn = p.title ?? `Inlägg ${i + 1}`;
    const produkt = p.produkt;
    falt.push({ nyckel: String(i), etikett: namn, text: p.text ?? "", minst: LENGTH_LIMITS.POST_MIN_WORDS, produkt });
    falt.push({ nyckel: `rubrik-${i}`, etikett: `Rubriken till "${namn}"`, text: p.title ?? "", produkt });
    falt.push({ nyckel: `cta-${i}`, etikett: `Uppmaningen till "${namn}"`, text: p.cta ?? "", produkt });
  });
  const nl = plan.newsletter;
  if (nl) {
    falt.push({ nyckel: "newsletter", etikett: "Nyhetsbrevet", text: nl.body ?? "", minst: LENGTH_LIMITS.NEWSLETTER_MIN_WORDS });
    falt.push({ nyckel: "amnesrad", etikett: "Nyhetsbrevets ämnesrad", text: nl.subject ?? "" });
    falt.push({ nyckel: "nyhetsbrev-cta", etikett: "Nyhetsbrevets uppmaning", text: nl.cta ?? "" });
  }
  (Array.isArray(plan.campaigns) ? plan.campaigns : []).forEach((c, i) => {
    for (const del of Object.keys(KAMPANJFALT) as Kampanjdel[]) {
      const v = c?.[KAMPANJFALT[del]];
      falt.push({ nyckel: `kampanj-${i}-${del}`, etikett: `Kampanjförslag ${i + 1}, ${del}`, text: typeof v === "string" ? v : "", produkt: c?.produkt });
    }
  });
  return falt;
}

/** Skriver ett fält tillbaka i planen. Okänd nyckel = oförändrad plan. */
function sattFalt(plan: PlanShape, nyckel: string, varde: string): PlanShape {
  if (nyckel === "newsletter") return { ...plan, newsletter: { ...plan.newsletter, body: varde } };
  if (nyckel === "amnesrad") return { ...plan, newsletter: { ...plan.newsletter, subject: varde } };
  if (nyckel === "nyhetsbrev-cta") return { ...plan, newsletter: { ...plan.newsletter, cta: varde } };

  const inlagg = /^(?:(rubrik|cta)-)?(\d+)$/.exec(nyckel);
  if (inlagg) {
    const i = Number(inlagg[2]);
    const posts = [...(plan.posts ?? [])];
    if (i >= posts.length) return plan;
    const del = inlagg[1] === "rubrik" ? "title" : inlagg[1] === "cta" ? "cta" : "text";
    posts[i] = { ...posts[i], [del]: varde };
    return { ...plan, posts };
  }

  const kampanj = /^kampanj-(\d+)-(titel|mal|budskap|cta)$/.exec(nyckel);
  if (kampanj && Array.isArray(plan.campaigns)) {
    const i = Number(kampanj[1]);
    const campaigns = [...plan.campaigns];
    if (i >= campaigns.length) return plan;
    campaigns[i] = { ...campaigns[i], [KAMPANJFALT[kampanj[2] as Kampanjdel]]: varde };
    return { ...plan, campaigns };
  }
  return plan;
}

/* ── Bristerna ──────────────────────────────────────────── */

/** Ett fält som behöver rättas, och varför. */
export interface Brist {
  nyckel: string;
  etikett: string;
  text: string;
  /** Satt när texten ligger under sitt golv. */
  forKort?: { ordNu: number; minst: number };
  /** Påståenden som företagsdatan inte täcker, som de står skrivna. */
  obelagda: string[];
  /** Fältets golv i ord, om det har ett. */
  minst?: number;
}

/** Så stor del av orden en rättad text måste ha kvar för att tas emot. */
const URHOLKAD = 2 / 3;

/** Sant när den rättade texten har något som originalet saknade. */
const nytt = (efter: string[], fore: string[]) => efter.some((x) => !fore.includes(x));

/** Webbadresserna i en text. En mening med punkt utan mellanslag är ingen adress. */
const adresser = (text: string) => lankarIText(text).filter((l) => vardnamn(l) !== null).map((l) => l.toLowerCase());

/**
 * Vilka fält som är för korta eller påstår något utan underlag.
 * Utan `underlag` mäts bara längden — då beter sig rundan som förut.
 */
export function hittaBrister(plan: PlanShape, underlag?: Underlag): Brist[] {
  return allaFalt(plan).flatMap((f) => {
    const n = ord(f.text);
    const forKort = f.minst !== undefined && n < f.minst ? { ordNu: n, minst: f.minst } : undefined;
    const obelagda = underlag ? obelagdaPastaenden(f.text, underlag, f.produkt) : [];
    return forKort || obelagda.length > 0
      ? [{ nyckel: f.nyckel, etikett: f.etikett, text: f.text, forKort, obelagda, minst: f.minst }]
      : [];
  });
}

/**
 * Prompt som ber om rättade texter — och bara de. Modellen får tillbaka
 * sin egen text med felet utpekat, så tonen och faktaunderlaget
 * överlever.
 */
export function buildRepairPrompt(brister: Brist[], underlag?: Underlag, now = new Date()): string {
  const delar = brister.map((b) => {
    const fel = [
      b.forKort ? `FÖR KORT: ${b.forKort.ordNu} ord, sikta på ${b.forKort.minst + 25}, absolut minst ${b.forKort.minst}` : null,
      b.obelagda.length ? `PÅSTÅR UTAN UNDERLAG: ${b.obelagda.map((o) => `"${o}"`).join(", ")}` : null,
      // En omskriven brödtext krymper gärna under sitt golv. Säg golvet
      // även när längden inte var felet.
      !b.forKort && b.minst ? `ska fortfarande vara minst ${b.minst} ord` : null,
    ].filter(Boolean).join(" · ");
    return `── ${b.nyckel} — ${b.etikett}\n   ${fel}\n${b.text}`;
  }).join("\n\n");

  const harForKorta = brister.some((b) => b.forKort);
  const harObelagda = brister.some((b) => b.obelagda.length > 0);

  const byggUt = harForKorta ? `
ÄR TEXTEN FÖR KORT — BYGG UT, SKRIV INTE OM:
- Behåll ämnet, tonen, ordningen och alla fakta. Lägg till innehåll.
- Lägg till konkretion: ett scenario läsaren känner igen, vad man gör,
  varför just nu. Inte fler adjektiv och inga upprepningar.
- Bygg ut med det som redan står i texten.
` : "";

  const taBort = harObelagda ? `
PÅSTÅR TEXTEN NÅGOT UTAN UNDERLAG — TA BORT PÅSTÅENDET:
- Orden inom citattecken står inte i företagsdatan. Skriv om meningen så
  att påståendet försvinner helt.
- Byt inte mot en synonym. "Kostnadseffektiv" i stället för "sparar
  pengar" är samma påstående, och "omtyckt" i stället för "populär"
  likaså.
- Skriv faktumet i stället för slutsatsen, när faktumet står nedan.
  "Du betalar för det som fylls i flaskan" är ett faktum. Att det därför
  blir billigare, snabbare eller bättre är en slutsats, och den drar
  läsaren själv.
- Påstå inget om vad kunder tycker, väljer eller brukar göra.
- Är det citerade ett villkor — vad kunden betalar för, eller vad något
  är anpassat efter — skriv det med företagsdatans egna ord nedan. Byt
  inte ut ordet som bär villkoret, och står villkoret inte nedan: ta
  bort det.
- Ändra ingenting annat. Samma ämne, samma ton, ungefär samma längd.
  Fakta ur företagsdatan som redan står i texten ska stå kvar.
${underlag && underlagSomText(underlag) ? `
DET HÄR STÅR I FÖRETAGSDATAN, OCH BARA DET FÅR PÅSTÅS OM FÖRETAGET:
${underlagSomText(underlag)}
` : ""}` : "";

  return `Texterna nedan kommer från en veckoplan du just skrev och behöver
rättas. Vid varje text står vad som är fel.
${byggUt}${taBort}
GÄLLER ALLA TEXTER:
- Hitta INTE på nya produkter, tjänster, erbjudanden, priser, siffror
  eller egenskaper.
- Lägg aldrig till ett påstående om vad kunder tycker eller brukar göra,
  om vad kunden sparar i tid eller pengar, eller om att något är bättre,
  billigare, mer ekonomiskt eller mer prisvärt. En utbyggd text som fått
  ett sådant påstående tas inte emot.
- Skriv aldrig något som hör till motsatt årstid, inte heller som
  jämförelse eller tillbakablick. Förbjudna ord just nu:
  ${forbjudnaSasongsord(now).map((o) => `"${o}"`).join(", ")}.
- Brödtexternas uppmaning ingår inte i texten nedan och ska inte läggas
  till. Står en webbadress sist i en text ska den stå kvar, oförändrad.
- Inga utropstecken, ingen emoji.
- Skriv aldrig ut företagets interna styrdata: prioritet, lönsamhet,
  marknadsföringsmål eller inläggets roll. De är underlag för dig.
- Nyckeln "newsletter": svaret ska ha 2–4 stycken åtskilda med en TOM
  RAD (\\n\\n i JSON-strängen). Lämna aldrig tillbaka ett enda block —
  det är den vanligaste regressionen när texten skrivs om.
- Numeriska nycklar är inlägg och ska vara ETT stycke.
- Rubriker, uppmaningar och ämnesrader ska förbli korta.

${delar}

Svara med EXAKT giltig JSON, ingen förtext:
{
  "texts": {
${brister.map((b) => `    "${b.nyckel}": "den rättade texten${b.forKort ? `, minst ${b.forKort.minst} ord` : ""}"`).join(",\n")}
  }
}`;
}

/**
 * Väver in de rättade texterna. Ett svar tas bara emot när det är
 * BÄTTRE än originalet på det som var fel, och inte sämre på det andra:
 *
 *  - Var texten för kort ska den ha blivit längre.
 *  - Påstod den något utan underlag ska påståendena ha blivit färre.
 *  - Den får aldrig påstå något NYTT utan underlag, inte heller när
 *    texten blivit längre eller påståendena färre. En utbyggd text som
 *    fått ett nytt besparingslöfte är inte en rättning.
 *  - Den får aldrig ha fått ett ord från fel årstid eller en webbadress
 *    som inte stod där. Prompten förbjuder båda, och ändå kom
 *    "semester" in i utbyggda inlägg i två planer av fem i oktober.
 *
 * Spärrarna stoppar det de känner igen: ord ur listorna och adresser.
 * De garanterar inte att en mottagen text är korrekt — ett påstående
 * eller en årstid som uttrycks med andra ord går igenom.
 *
 * Allt annat ignoreras, och originalet står kvar.
 */
export function applyRepair(plan: PlanShape, texts: Record<string, string>, underlag?: Underlag, now = new Date()): PlanShape {
  const falt = new Map(allaFalt(plan).map((f) => [f.nyckel, f]));
  let ut = plan;

  for (const [nyckel, ny] of Object.entries(texts ?? {})) {
    if (typeof ny !== "string" || !ny.trim()) continue;
    const f = falt.get(nyckel);
    if (!f) continue;

    const varForKort = f.minst !== undefined && ord(f.text) < f.minst;
    const pastar = (t: string) => (underlag ? obelagdaPastaenden(t, underlag, f.produkt).map((o) => o.toLowerCase()) : []);
    const fore = pastar(f.text);
    const efter = pastar(ny);

    // Antalet räcker inte. "Sparar tid" som byts mot "kunder uppskattar"
    // är lika många påståenden, och ett av dem är nytt.
    if (nytt(efter, fore)) continue;
    if (nytt(sasongsfelIText(ny, now), sasongsfelIText(f.text, now))) continue;
    if (nytt(adresser(ny), adresser(f.text))) continue;
    if (varForKort && ord(ny) <= ord(f.text)) continue;
    if (!varForKort && efter.length >= fore.length) continue;
    // Ett påstående tas bort genom att skriva om en mening, inte genom
    // att stryka texten. Ett svar som tappat mer än en tredjedel av
    // orden är inte samma text längre.
    if (!varForKort && ord(ny) < ord(f.text) * URHOLKAD) continue;

    ut = sattFalt(ut, nyckel, ny);
  }

  return ut;
}

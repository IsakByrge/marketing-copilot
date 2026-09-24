// ─────────────────────────────────────────────────────────────
// Explicit, typad mappning: veckoplanens inlägg → Facebook-formulär.
//
// Samma hållning som strategyPrefill.ts: vi hittar ALDRIG på värden.
// Saknas ett fält i planen sätts motsvarande formulärfält inte alls,
// och Facebook-sidans egna standardvärden står kvar.
//
// Vad som INTE mappas, och varför — läs detta innan något läggs till:
//
// `mal` → goal. NEJ. Planens mal kommer ur brain.marketingGoals
// (lib/server/planPrompt.ts), alltså fri text som användaren själv
// skrivit på /company. Det finns ingen taxonomi att matcha mot, så
// varje översättning till FacebookContentGoal vore en gissning på
// användarens prosa. Ett påklistrat syfte styr texten mot fel sak.
//
// `text` → additionalNotes. NEJ. Noteringarna går in i
// urgencyBasisFor().briefText, och quality.ts testar den strängen mot
// /lager|begräns|antal|exemplar|slut/i för att avgöra om specialisten
// FÅR hävda knapphet. Ett veckoutkast om gasolflaskor innehåller lätt
// "begränsat" eller "slut" utan att något faktiskt är begränsat — då
// hade utkastets formulering låst upp ett påstående ingen källa
// täcker. Utkastet hör hemma i ämnesfältet, som användaren ser och
// kan ändra.
//
// `roll` → requestedAngle. Bara "lokalt". Se ROLL_TILL_VINKEL.
//
// Ren modul: ingen React, ingen Supabase, ingen serverkod. Testas med
// tsx — därför relativa importer.
// ─────────────────────────────────────────────────────────────
import { FACEBOOK_ANGLES, FB_LIMITS, type FacebookAngle } from "../../app/content/facebook/types";

/** Delmängden av MarketingPost som formuläret kan läsa. Allt valfritt:
 *  planer skapade före innehållssprinten saknar de nyare fälten. */
export interface PlanPostForPrefill {
  /** Inläggets rubrik. */
  rubrik?: string;
  /** Rubrik + text, hopslaget. Fallback när produkt saknas, och det som
   *  gamla ?amne=-länkar bär. */
  amne?: string;
  /** Produktens namn ur Company Brain-listan. Tom för roller som inte
   *  handlar om en produkt (tips, lokalt, socialt). */
  produkt?: string;
  /** Inläggets uppmaning — vad läsaren ska göra. */
  handling?: string;
  /** Inläggets roll i veckan: saljande, tips, prioriterad_produkt,
   *  lokalt, socialt. */
  roll?: string;
}

export interface PlanPrefill {
  productOrTopic?: string;
  desiredAction?: string;
  requestedAngle?: FacebookAngle;
  /** Svenska fältnamn för den diskreta raden i formuläret. */
  filledFields: string[];
}

/**
 * Den ENDA rollen som säkert är en vinkel.
 *
 * "lokalt" beskrivs i planprompten som ett inlägg med lokal förankring,
 * och local_service är vinkeln "Lokal service". Samma sak.
 *
 * De övriga fyra mappas med flit inte:
 *   saljande            — ett mål, inte en vinkel. Att göra den till
 *                         urgency eller customer_value vore att välja
 *                         åt användaren.
 *   prioriterad_produkt — ett urvalskriterium, inte en vinkel.
 *   tips                — praktisk kunskap. Närmast vore
 *                         problem_solution, men ett tips förutsätter
 *                         inget problem. Osäkert.
 *   socialt             — tvetydigt. social_proof betyder verifierade
 *                         omdömen, inte "bjuder in till samtal". Att
 *                         blanda ihop dem vore illa.
 */
const ROLL_TILL_VINKEL: Record<string, FacebookAngle> = {
  lokalt: "local_service",
};

const rensa = (v: string | undefined, max: number): string =>
  (typeof v === "string" ? v : "").replace(/\s+/g, " ").trim().slice(0, max);

/**
 * Planinlägg → säkra formulärvärden.
 *
 * Produkten är det säkraste vi har: planprompten skriver dit produktens
 * namn ur listan. Finns den blir ämnet "Produkt — Rubrik", så att både
 * vad det gäller och inläggets idé följer med. Saknas produkten faller
 * vi tillbaka på rubrik + text, precis som länken alltid gjort.
 */
export function planPrefill(post: PlanPostForPrefill): PlanPrefill {
  const p: PlanPrefill = { filledFields: [] };

  const produkt = rensa(post.produkt, FB_LIMITS.PRODUCT_OR_TOPIC);
  const rubrik = rensa(post.rubrik, FB_LIMITS.PRODUCT_OR_TOPIC);
  const amne = rensa(post.amne, FB_LIMITS.PRODUCT_OR_TOPIC);

  if (produkt) {
    const kombinerat = rubrik ? `${produkt} — ${rubrik}` : produkt;
    p.productOrTopic = kombinerat.slice(0, FB_LIMITS.PRODUCT_OR_TOPIC);
    p.filledFields.push("Vad marknadsförs");
  } else if (amne) {
    p.productOrTopic = amne;
    p.filledFields.push("Vad marknadsförs");
  }

  // Planpromptens regel: "Varje inlägg har exakt en tydlig uppmaning i
  // cta." Det är samma sak som formulärets "vad läsaren ska göra".
  const handling = rensa(post.handling, FB_LIMITS.DESIRED_ACTION);
  if (handling) {
    p.desiredAction = handling;
    p.filledFields.push("Handling");
  }

  const vinkel = ROLL_TILL_VINKEL[rensa(post.roll, 60).toLowerCase()];
  if (vinkel) {
    p.requestedAngle = vinkel;
    p.filledFields.push("Vinkel");
  }

  return p;
}

/* ── URL-kontraktet ─────────────────────────────────────── */

/** Märker länken som kommen från veckoplanen. */
export const PLAN_SOURCE = "plan";

/**
 * Länk från ett veckoplansinlägg till Facebook-specialisten.
 *
 * `amne` behålls som den alltid sett ut, så att gamla sparade länkar
 * fortsätter fungera och så att det finns en fallback när produkten
 * saknas. Övriga parametrar är additiva.
 *
 * `mal` skickas inte. Se filhuvudet.
 */
export function planContentHref(post: PlanPostForPrefill): string {
  const q = new URLSearchParams();
  q.set("source", PLAN_SOURCE);

  const satt = (nyckel: string, varde: string | undefined, max: number) => {
    const v = rensa(varde, max);
    if (v) q.set(nyckel, v);
  };

  satt("amne", post.amne, FB_LIMITS.PRODUCT_OR_TOPIC);
  satt("rubrik", post.rubrik, FB_LIMITS.PRODUCT_OR_TOPIC);
  satt("produkt", post.produkt, FB_LIMITS.PRODUCT_OR_TOPIC);
  satt("handling", post.handling, FB_LIMITS.DESIRED_ACTION);
  satt("roll", post.roll, 60);

  return `/content/facebook?${q.toString()}`;
}

/**
 * Läser tillbaka planparametrarna. Null när länken inte är märkt som
 * kommen från planen — då gäller den gamla ?amne=-vägen, som Facebook-
 * sidan hanterar som förut.
 */
export function readPlanParams(params: URLSearchParams): PlanPostForPrefill | null {
  if (params.get("source") !== PLAN_SOURCE) return null;
  return {
    amne: params.get("amne") ?? undefined,
    rubrik: params.get("rubrik") ?? undefined,
    produkt: params.get("produkt") ?? undefined,
    handling: params.get("handling") ?? undefined,
    roll: params.get("roll") ?? undefined,
  };
}

/** Bara för test och läsbarhet: vilka vinklar mappningen kan ge. */
export const MAPPADE_VINKLAR: readonly FacebookAngle[] = Object.values(ROLL_TILL_VINKEL).filter(
  (v): v is FacebookAngle => FACEBOOK_ANGLES.includes(v),
);

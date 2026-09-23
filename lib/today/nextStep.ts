// ─────────────────────────────────────────────────────────────
// Idag — ett nästa steg.
//
// Ren funktion: ingen Supabase, ingen React, ingen AI. Sidan hämtar
// data, den här modulen väljer vad som är mest angeläget och
// formulerar varför.
//
// Två regler styr allt här:
//
//   1. EN rekommendation. Visas flera blir ytan en meny igen, och då
//      har produkten inte svarat på frågan den lovar att svara på.
//   2. "Varför" får bara innehålla sådant som står i indata — datum,
//      antal, status. Ingen bedömning, ingen prognos, ingen poäng,
//      ingen procentsats. Se VISION.md.
//
// Av samma skäl finns ingen regel som föreslår innehåll till en
// pågående kampanj. Produkten vet inte om användaren redan har skrivit
// inlägget: kampanjer och producerat innehåll är inte kopplade, och
// content_drafts läses med flit inte. En sådan regel hade upprepat
// "skapa ett inlägg" hela kampanjperioden igenom, även när det var
// gjort. Ett kampanjsteg föreslås bara när datan visar att något
// faktiskt saknas — tomma resultatfält, tom lärdom, passerat startdatum.
//
// Reglerna är avsiktligt få och läses uppifrån och ned: den första
// som träffar vinner. Att ändra ordningen ska vara en radändring.
//
// Importerna är relativa med flit — testsviterna körs med tsx, som
// inte löser tsconfig-alias. Samma mönster som resten av lib/.
// ─────────────────────────────────────────────────────────────
import { daysBetween, groupCampaigns, hasAnyResult, type Campaign } from "../campaigns/logic";
import { isPlanStale, isoWeek } from "../server/voice";

/** Vilken regel som träffade. Finns för testernas och felsökningens skull. */
export type NextStepId =
  | "campaign-results"
  | "campaign-learning"
  | "campaign-start"
  | "plan-missing"
  | "plan-stale"
  | "content";

export interface NextStep {
  id: NextStepId;
  title: string;
  /** Kort motivering, bara ur indata. */
  why: string;
  cta: string;
  /** Navigering … */
  href?: string;
  /** … eller en handling sidan utför själv. Samma mönster som overviewLogic. */
  action?: "generate-plan";
}

/** Det planen bidrar med. Sidan mappar från useAccountData. */
export interface NextStepPlan {
  /** När planraden skapades. Saknas när sparningen till Supabase inte gick igenom. */
  createdAt?: string;
  postCount: number;
}

export interface NextStepInput {
  /**
   * Alla kampanjer — eller null medan de fortfarande hämtas. Null är inte
   * samma sak som tom lista: då hoppas kampanjreglerna över helt, så att
   * Idag kan visa ett planbaserat steg direkt och uppgradera när svaret
   * kommer. Sidan ska aldrig stå tom och vänta.
   */
  campaigns: Campaign[] | null;
  plan: NextStepPlan | null;
  /** Dagens datum, ISO. Samma format som kampanjernas datumkolumner. */
  today: string;
}

/**
 * Hur nära slutet en pågående kampanj utan resultat går före allt annat.
 *
 * Tre dagar är en första produktregel, inte ett mätt eller härlett värde.
 * Den står här som en konstant just för att vara lätt att ändra: vad som
 * är rätt avstånd vet vi först när någon har kört kampanjer i produkten
 * och sagt om påminnelsen kom för tidigt eller för sent.
 */
export const RESULTS_DUE_DAYS = 3;

/* ── Datum till text ────────────────────────────────────── */

/** "3 dagar", "1 dag" — aldrig "1 dagar". */
function days(n: number): string {
  return n === 1 ? "1 dag" : `${n} dagar`;
}

/**
 * Sorterar en kopia. De inbyggda grupperna sorteras på startdatum; här
 * är det slutdatumet som avgör vad som brådskar.
 */
function byEndDateAsc(list: Campaign[]): Campaign[] {
  return [...list].sort(
    (a, b) => a.ends_on.localeCompare(b.ends_on) || a.created_at.localeCompare(b.created_at),
  );
}

/* ── Reglerna ───────────────────────────────────────────── */

/**
 * 1. Pågående kampanj som snart är slut och saknar resultat.
 *
 * Utan siffror går kampanjen inte att utvärdera, och underlaget finns
 * bara hos användaren — vi har ingen annonsintegration som kan hämta det.
 */
function resultsDue(active: Campaign[], today: string): NextStep | null {
  for (const c of byEndDateAsc(active)) {
    if (hasAnyResult(c)) continue;
    const kvar = daysBetween(today, c.ends_on);
    if (kvar === null || kvar > RESULTS_DUE_DAYS) continue;

    const nar =
      kvar > 1 ? `slutar om ${days(kvar)}`
        : kvar === 1 ? "slutar i morgon"
          : kvar === 0 ? "slutar i dag"
            : `passerade sitt slutdatum för ${days(-kvar)} sedan`;

    return {
      id: "campaign-results",
      title: `Lägg in resultat för ${c.title}`,
      why: `Kampanjen ${nar} och du har inte lagt in några resultat.`,
      cta: "Öppna kampanjen",
      href: `/campaigns/${c.id}`,
    };
  }
  return null;
}

/**
 * 2. Avslutad kampanj utan lärdom.
 *
 * Inget datum i texten: status sätts för hand och behöver inte infalla
 * samma dag som ends_on, så "avslutades den X" vore en gissning.
 */
function missingLearning(ended: Campaign[]): NextStep | null {
  // groupCampaigns ger avslutade med senaste slutdatum först — den
  // färskaste kampanjen är den man minns.
  const c = ended.find((x) => !x.learning?.trim());
  if (!c) return null;

  return {
    id: "campaign-learning",
    title: `Skriv vad du lärde dig av ${c.title}`,
    why: "Kampanjen är avslutad och har ingen lärdom sparad.",
    cta: "Öppna kampanjen",
    href: `/campaigns/${c.id}`,
  };
}

/** 3. Planerad kampanj vars startdatum har passerat. */
function overdueStart(planned: Campaign[], today: string): NextStep | null {
  for (const c of planned) {
    const sedan = daysBetween(c.starts_on, today);
    if (sedan === null || sedan < 0) continue;

    return {
      id: "campaign-start",
      title: `Starta ${c.title}`,
      why: sedan === 0
        ? "Kampanjen skulle starta i dag och står fortfarande som planerad."
        : `Startdatumet passerade för ${days(sedan)} sedan och kampanjen står fortfarande som planerad.`,
      cta: "Öppna kampanjen",
      href: `/campaigns/${c.id}`,
    };
  }
  return null;
}

/** 4. Veckoplanen saknas eller är från en annan vecka. */
function weeklyPlan(plan: NextStepPlan | null, today: string): NextStep | null {
  if (!plan) {
    return {
      id: "plan-missing",
      title: "Skapa veckans förslag",
      why: "Du har inget veckoförslag än.",
      cta: "Skapa förslaget",
      action: "generate-plan",
    };
  }

  // Veckan räknas mitt på dagen: datumet är det enda vi har, och
  // middagstid hamnar aldrig fel vecka oavsett var koden kör.
  const nu = new Date(`${today}T12:00:00`);
  if (!Number.isNaN(nu.getTime()) && isPlanStale(plan.createdAt, nu)) {
    const vecka = isoWeek(new Date(plan.createdAt!));
    return {
      id: "plan-stale",
      title: "Skapa veckans förslag",
      why: `Ditt senaste förslag är från vecka ${vecka}.`,
      cta: "Skapa förslaget",
      action: "generate-plan",
    };
  }

  return null;
}

/** 5. Annars: veckans innehåll, när det finns något att göra där. */
function weeklyContent(plan: NextStepPlan | null): NextStep | null {
  if (!plan || plan.postCount <= 0) return null;

  return {
    id: "content",
    title: "Gå igenom veckans innehåll",
    why: `Veckans förslag innehåller ${plan.postCount} inlägg.`,
    cta: "Öppna innehållet",
    href: "/innehall",
  };
}

/* ── Valet ──────────────────────────────────────────────── */

/**
 * Ett nästa steg, eller null när det ärligt talat inte finns något att
 * föreslå. Null är ett giltigt svar: hellre tyst än en påhittad uppgift.
 */
export function nextStep({ campaigns, plan, today }: NextStepInput): NextStep | null {
  const groups = campaigns ? groupCampaigns(campaigns) : null;

  if (groups) {
    const step =
      resultsDue(groups.active, today)
      ?? missingLearning(groups.ended)
      ?? overdueStart(groups.planned, today);
    if (step) return step;
  }

  return weeklyPlan(plan, today) ?? weeklyContent(plan);
}

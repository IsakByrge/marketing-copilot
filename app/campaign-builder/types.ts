// ─────────────────────────────────────────────────────────────
// Marketing Copilot 2.0 — Campaign Builder
// Strikt typade datamodeller för kampanjflödet.
// Ingen AI, ingen persistens — bara typer som beskriver användarens svar.
// ─────────────────────────────────────────────────────────────

/** Ett affärsmål användaren kan välja i steg 1. */
export type CampaignGoal =
  | "sell-product"
  | "more-quotes"
  | "store-visits"
  | "fill-slots"
  | "launch"
  | "seasonal"
  | "other";

/** Ja/Nej-svar där tomt betyder "ej besvarat". */
export type YesNo = "" | "ja" | "nej";

/** Steg 2 — kampanjens grund. Fält utan kommentar är obligatoriska. */
export interface CampaignBasics {
  /** Produkt, tjänst eller erbjudande. */
  product: string;
  /** Kort beskrivning. */
  description: string;
  /** Pris — frivilligt. */
  price: string;
  /** Marginal — frivilligt, aldrig ett krav. */
  margin: string;
  /** Lagerstatus eller tillgänglighet. */
  availability: string;
  /** Primär målgrupp. */
  targetAudience: string;
  /** Geografiskt område. */
  geographicArea: string;
  /** Önskat startdatum (ISO yyyy-mm-dd). */
  startDate: string;
  /** Önskat slutdatum (ISO yyyy-mm-dd). */
  endDate: string;
  /** Har företaget redan ett erbjudande? */
  hasExistingOffer: YesNo;
  /** Erbjudandets innehåll — endast relevant om hasExistingOffer === "ja". */
  offerContent: string;
}

/**
 * Steg 3 — dynamiska följdfrågor.
 * Nyckeln är frågans id (se GOALS-konfigurationen), värdet är användarens svar.
 * Uppsättningen nycklar avgörs av valt CampaignGoal.
 */
export type GoalSpecificAnswers = Record<string, string>;

/** Steg 4 — det kompletta, strikt typade kampanjunderlaget. */
export interface CampaignBrief {
  /** Valt affärsmål. */
  goal: CampaignGoal;
  /** Läsbar titel för det valda målet (t.ex. "Sälj mer av en produkt"). */
  goalTitle: string;
  /** Kampanjens grund från steg 2. */
  basics: CampaignBasics;
  /** Svaren på de måltyps-specifika följdfrågorna från steg 3. */
  answers: GoalSpecificAnswers;
  /** När underlaget sammanställdes (ISO-tidsstämpel). */
  createdAt: string;
}

/** Tom grund att initiera formuläret med. */
export const EMPTY_BASICS: CampaignBasics = {
  product: "",
  description: "",
  price: "",
  margin: "",
  availability: "",
  targetAudience: "",
  geographicArea: "",
  startDate: "",
  endDate: "",
  hasExistingOffer: "",
  offerContent: "",
};

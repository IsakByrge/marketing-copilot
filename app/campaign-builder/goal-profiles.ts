// ─────────────────────────────────────────────────────────────
// Strategiska frågeprofiler per affärsmål.
// Varje profil styr fyra saker samtidigt så att de aldrig glider isär:
//   1. AI:ns prioriteringar och kritiska informationsområden (prompten)
//   2. Ordningen på fältlistan som skickas till AI:n
//   3. Fallback-lägets skriptade frågeordning
//   4. Vilka strategiska områden (TargetArea) som är kritiska respektive
//      valfria — styr om "Hoppa över" visas för en fråga i Reasoning Engine
// Fält som inte finns i fieldOrder ställs aldrig för det målet.
// ─────────────────────────────────────────────────────────────
import type { CampaignGoal } from "./types";
import type { TargetArea } from "./reasoning";

export interface GoalProfile {
  /** Informationsområden i fallande prioritetsordning — matas in i AI-prompten. */
  priorities: string[];
  /** Måste vara täckt innan AI:n får välja "finish". */
  criticalInfo: string[];
  /** Fältnycklar i prioritetsordning. Styr både AI:ns fältlista och fallback. */
  fieldOrder: string[];
  /** Strategiska områden som är kritiska för målet — inte skippningsbara. */
  criticalAreas: TargetArea[];
  /** Vilket strategiskt område varje fält i fieldOrder tillhör. */
  fieldAreas: Record<string, TargetArea>;
}

export const GOAL_PROFILES: Record<CampaignGoal, GoalProfile> = {
  "sell-product": {
    priorities: [
      "produktens konkreta kundnytta — vilket problem den löser",
      "marginal och lönsamhetsutrymme",
      "lager och tillgänglighet",
      "den vanligaste invändningen från kunder",
      "differentiering mot alternativen",
      "volym kontra lönsamhet",
      "erbjudandestrategi (befintligt eller nytt erbjudande)",
    ],
    criticalInfo: [
      "vad som säljs och dess kundnytta",
      "tillgänglighet",
      "minst en invändning eller differentiering",
      "erbjudandets riktning",
    ],
    fieldOrder: [
      "product", "q_problem", "margin", "availability", "q_objection",
      "q_differentiator", "q_volumeVsProfit", "hasExistingOffer", "offerContent",
      "q_whyChoose", "targetAudience", "price", "q_urgency",
      "startDate", "endDate", "geographicArea",
    ],
    criticalAreas: ["offer", "problem", "availability", "trust", "differentiation"],
    fieldAreas: {
      product: "offer", q_problem: "problem", margin: "profitability",
      availability: "availability", q_objection: "trust", q_differentiator: "differentiation",
      q_volumeVsProfit: "profitability", hasExistingOffer: "offer", offerContent: "offer",
      q_whyChoose: "differentiation", targetAudience: "audience", price: "profitability",
      q_urgency: "urgency", startDate: "urgency", endDate: "urgency", geographicArea: "audience",
    },
  },
  "more-quotes": {
    priorities: [
      "tjänsten som säljs",
      "den mest värdefulla kundtypen",
      "geografiskt område som kan levereras",
      "förtroendebevis — referenser, garantier, certifieringar",
      "trösklar som hindrar kunden från att begära offert",
      "svarstid på förfrågningar",
      "kvalitet på förfrågningarna, inte bara antal",
    ],
    criticalInfo: [
      "vilken tjänst det gäller",
      "ideal kundtyp",
      "geografiskt område",
      "minst en förtroende- eller tröskelfaktor",
    ],
    fieldOrder: [
      "product", "q_bestCustomer", "geographicArea", "q_trust", "q_barrier",
      "q_responseTime", "q_leadQuality", "hasExistingOffer", "offerContent",
      "price", "startDate", "endDate",
    ],
    criticalAreas: ["offer", "audience", "trust", "conversion"],
    fieldAreas: {
      product: "offer", q_bestCustomer: "audience", geographicArea: "audience",
      q_trust: "trust", q_barrier: "conversion", q_responseTime: "trust",
      q_leadQuality: "measurement", hasExistingOffer: "offer", offerContent: "offer",
      price: "profitability", startDate: "urgency", endDate: "urgency",
    },
  },
  "store-visits": {
    priorities: [
      "en konkret anledning att besöka butiken just nu",
      "lokal räckvidd — hur långt kunder reser",
      "öppettider",
      "butiksunik aktivitet eller produkt (något som bara finns på plats)",
      "tidsbegränsning för kampanjen",
      "hur besöken ska mätas",
    ],
    criticalInfo: [
      "anledningen att besöka butiken nu",
      "vad besöket kretsar kring",
      "lokal räckvidd eller öppettider",
    ],
    fieldOrder: [
      "q_reason", "product", "q_hours", "q_travelDistance", "q_inStoreOnly",
      "startDate", "endDate", "q_measure", "hasExistingOffer", "offerContent",
      "targetAudience",
    ],
    criticalAreas: ["offer", "audience", "availability"],
    fieldAreas: {
      q_reason: "offer", product: "offer", q_hours: "availability",
      q_travelDistance: "audience", q_inStoreOnly: "differentiation",
      startDate: "urgency", endDate: "urgency", q_measure: "measurement",
      hasExistingOffer: "offer", offerContent: "offer", targetAudience: "audience",
    },
  },
  "fill-slots": {
    priorities: [
      "antal lediga tider",
      "datum och tidsfönster",
      "bokningsfrist — hur sent en kund kan boka",
      "målgrupp som kan agera snabbt",
      "rabatt kontra mervärde",
      "bokningskanal",
    ],
    criticalInfo: [
      "vilken tjänst det gäller",
      "hur många tider och när",
      "bokningsfrist",
      "hur kunden bokar",
    ],
    fieldOrder: [
      "product", "q_slotCount", "q_dates", "q_lastMinute", "q_audience",
      "q_timeLimitedOffer", "q_bookingChannel", "startDate", "endDate",
      "geographicArea",
    ],
    criticalAreas: ["offer", "availability", "urgency", "channel"],
    fieldAreas: {
      product: "offer", q_slotCount: "availability", q_dates: "availability",
      q_lastMinute: "urgency", q_audience: "audience", q_timeLimitedOffer: "offer",
      q_bookingChannel: "channel", startDate: "urgency", endDate: "urgency",
      geographicArea: "audience",
    },
  },
  "launch": {
    priorities: [
      "vad som är nytt jämfört med tidigare",
      "vilket problem det löser",
      "vem som bör bry sig först",
      "lanseringsdatum",
      "bevis eller demonstration (bilder, demo, kundbevis)",
      "introduktionserbjudande",
      "risken att kunden inte förstår nyheten",
    ],
    criticalInfo: [
      "vad som lanseras och vad som är nytt",
      "vem som berörs först",
      "tidpunkt eller lanseringsplan",
    ],
    fieldOrder: [
      "product", "q_whatsNew", "q_problem", "q_beneficiary", "q_launchDate",
      "q_proof", "hasExistingOffer", "offerContent", "price",
      "startDate", "endDate", "geographicArea",
    ],
    criticalAreas: ["offer", "differentiation", "audience", "urgency"],
    fieldAreas: {
      product: "offer", q_whatsNew: "differentiation", q_problem: "problem",
      q_beneficiary: "audience", q_launchDate: "urgency", q_proof: "trust",
      hasExistingOffer: "offer", offerContent: "offer", price: "profitability",
      startDate: "urgency", endDate: "urgency", geographicArea: "audience",
    },
  },
  "seasonal": {
    priorities: [
      "vilken säsong eller händelse det gäller",
      "när kundernas behov uppstår",
      "sista relevanta datum",
      "mest relevant produkt eller tjänst under perioden",
      "köpbeteende under perioden",
      "lokala variationer",
      "timing och kampanjintensitet",
    ],
    criticalInfo: [
      "säsongen eller händelsen",
      "relevant produkt eller tjänst",
      "när behovet uppstår eller sista relevanta datum",
    ],
    fieldOrder: [
      "q_season", "product", "q_needStart", "q_deadline", "q_behavior",
      "q_localVariations", "hasExistingOffer", "offerContent", "availability",
      "targetAudience", "startDate", "endDate", "geographicArea",
    ],
    criticalAreas: ["urgency", "offer"],
    fieldAreas: {
      q_season: "urgency", product: "offer", q_needStart: "urgency",
      q_deadline: "urgency", q_behavior: "conversion", q_localVariations: "audience",
      hasExistingOffer: "offer", offerContent: "offer", availability: "availability",
      targetAudience: "audience", startDate: "urgency", endDate: "urgency",
      geographicArea: "audience",
    },
  },
  "other": {
    priorities: [
      "önskat affärsresultat",
      "vilken handling kunden ska ta",
      "målgrupp",
      "tidsram",
      "hur resultatet mäts",
      "vad som säljs eller förändras",
    ],
    criticalInfo: [
      "affärsresultatet",
      "kundens handling",
      "målgruppen",
    ],
    fieldOrder: [
      "q_goal", "q_action", "targetAudience", "product", "q_when", "q_measure",
      "description", "hasExistingOffer", "offerContent",
      "startDate", "endDate", "geographicArea", "price",
    ],
    criticalAreas: ["goal", "conversion", "audience"],
    fieldAreas: {
      q_goal: "goal", q_action: "conversion", targetAudience: "audience",
      product: "offer", q_when: "urgency", q_measure: "measurement",
      description: "offer", hasExistingOffer: "offer", offerContent: "offer",
      startDate: "urgency", endDate: "urgency", geographicArea: "audience",
      price: "profitability",
    },
  },
};

/** Strategiskt område för ett känt fält, om det finns definierat. */
export function areaForField(goal: CampaignGoal, key: string): TargetArea | undefined {
  return GOAL_PROFILES[goal]?.fieldAreas[key];
}

/** Om ett strategiskt område är kritiskt för målet (=> inte skippningsbart). */
export function isCriticalArea(goal: CampaignGoal, area: TargetArea | undefined): boolean {
  if (!area) return false;
  return GOAL_PROFILES[goal].criticalAreas.includes(area);
}

export function isKnownGoal(g: string): g is CampaignGoal {
  return Object.prototype.hasOwnProperty.call(GOAL_PROFILES, g);
}

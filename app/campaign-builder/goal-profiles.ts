// ─────────────────────────────────────────────────────────────
// Strategiska frågeprofiler per affärsmål.
// Varje profil styr tre saker samtidigt så att de aldrig glider isär:
//   1. AI:ns prioriteringar och kritiska informationsområden (prompten)
//   2. Ordningen på fältlistan som skickas till AI:n
//   3. Fallback-lägets skriptade frågeordning
// Fält som inte finns i fieldOrder ställs aldrig för det målet.
// ─────────────────────────────────────────────────────────────
import type { CampaignGoal } from "./types";

export interface GoalProfile {
  /** Informationsområden i fallande prioritetsordning — matas in i AI-prompten. */
  priorities: string[];
  /** Måste vara täckt innan AI:n får välja "finish". */
  criticalInfo: string[];
  /** Fältnycklar i prioritetsordning. Styr både AI:ns fältlista och fallback. */
  fieldOrder: string[];
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
  },
};

export function isKnownGoal(g: string): g is CampaignGoal {
  return Object.prototype.hasOwnProperty.call(GOAL_PROFILES, g);
}

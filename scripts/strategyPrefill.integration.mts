// Integrationstest: campaign strategy object → mapStrategyToPrefill → apply to form state.
// Körs fristående:  npx tsx scripts/strategyPrefill.integration.mts
// Ingen testrunner krävs — kastar (exit 1) vid fel, skriver "OK" vid pass.
import { mapStrategyToPrefill, type StrategyContextForForm } from "../lib/facebook/strategyPrefill";

let failures = 0;
function check(name: string, cond: boolean, detail = "") {
  if (cond) { console.log("  ✓ " + name); }
  else { failures++; console.log("  ✗ " + name + (detail ? " — " + detail : "")); }
}

// Speglar app/content/facebook/page.tsx: applyStrategyPrefill (arbetskopian).
interface FormState {
  goal: string; productOrTopic: string; audience: string; offer: string;
  price: string; deadline: string; geo: string; desiredAction: string;
}
function applyToForm(ctx: StrategyContextForForm | null): { form: FormState; filledFields: string[] } {
  const p = mapStrategyToPrefill(ctx);
  const form: FormState = { goal: "sell", productOrTopic: "", audience: "", offer: "", price: "", deadline: "", geo: "", desiredAction: "" };
  if (p.goal !== undefined) form.goal = p.goal;
  form.productOrTopic = p.productOrTopic ?? "";
  form.audience = p.audience ?? "";
  form.offer = p.offer ?? "";
  form.price = p.price ?? "";
  form.deadline = p.deadline ?? "";
  form.geo = p.geographicArea ?? "";
  form.desiredAction = p.desiredAction ?? "";
  return { form, filledFields: p.filledFields };
}

// A. Berikad strategy_context (exakt formen buildStrategyContext skriver för en ny kampanj).
console.log("A. Berikad strategi → alla 7 fält:");
{
  const ctx: StrategyContextForForm = {
    goal: "Sälj mer av en produkt", goalKey: "sell-product",
    product: "Greenville 3 gasolgrill", audience: "Villaägare som vill förlänga uteplatssäsongen",
    mainMessage: "Kvalitet och lång livslängd gör priset värt det", offer: "15% på tillbehör",
    price: "från 4 995 kr", geographicArea: "Västerås med omnejd", deadline: "2026-08-15",
    channels: ["Facebook"], risks: ["Priskänsliga kunder"],
  };
  const { form, filledFields } = applyToForm(ctx);
  check("Syfte (goal=sell)", form.goal === "sell", form.goal);
  check("Vad marknadsförs", form.productOrTopic === "Greenville 3 gasolgrill");
  check("Målgrupp", form.audience === "Villaägare som vill förlänga uteplatssäsongen");
  check("Erbjudande", form.offer === "15% på tillbehör");
  check("Pris", form.price === "från 4 995 kr");
  check("Sista datum", form.deadline === "2026-08-15");
  check("Geografiskt område", form.geo === "Västerås med omnejd");
  const seven = ["Syfte", "Vad marknadsförs", "Målgrupp", "Erbjudande", "Pris", "Sista datum", "Geografiskt område"];
  check("filledFields innehåller alla 7", seven.every((f) => filledFields.includes(f)), filledFields.join(","));
}

// B. Legacy strategy_context (den form användarens befintliga rad hade).
console.log("B. Legacy strategi → endast kända fält, inga påhitt:");
{
  const ctx: StrategyContextForForm = {
    cta: "Besök butiken", goal: "Sälj fler Greenville 3", risks: ["Priskänsliga kunder"],
    audience: "Villaägare som vill förlänga uteplatssäsongen",
    channels: ["Facebook", "Instagram"], mainMessage: "Kvalitet och lång livslängd gör priset värt det",
  };
  const { form, filledFields } = applyToForm(ctx);
  check("Målgrupp fylls", form.audience === "Villaägare som vill förlänga uteplatssäsongen");
  check("Önskad CTA fylls från legacy cta", form.desiredAction === "Besök butiken");
  check("Vad marknadsförs tomt (ingen källa)", form.productOrTopic === "");
  check("Pris tomt (ingen källa)", form.price === "");
  check("Geografiskt område tomt (ingen källa)", form.geo === "");
  check("Sista datum tomt (ingen källa)", form.deadline === "");
  check("Syfte oförändrat (ingen goalKey)", form.goal === "sell");
  check("filledFields = Målgrupp + Önskad CTA", filledFields.length === 2 && filledFields.includes("Målgrupp") && filledFields.includes("Önskad CTA"), filledFields.join(","));
}

// C. Null / tom strategi kraschar inte.
console.log("C. Null-strategi:");
{
  const { form, filledFields } = applyToForm(null);
  check("Inget fylls, ingen krasch", filledFields.length === 0 && form.audience === "");
}

// D. Målmappning (alla CampaignGoals).
console.log("D. Målmappning CampaignGoal → FacebookContentGoal:");
{
  const cases: Array<[string, string]> = [
    ["sell-product", "sell"], ["more-quotes", "leads"], ["store-visits", "store_visits"],
    ["fill-slots", "sell"], ["launch", "launch"], ["seasonal", "sell"], ["other", "other"],
  ];
  for (const [key, expected] of cases) {
    check(`${key} → ${expected}`, mapStrategyToPrefill({ goalKey: key }).goal === expected);
  }
  check("okänd goalKey → ingen goal", mapStrategyToPrefill({ goalKey: "weird" }).goal === undefined);
}

console.log(failures === 0 ? "\nOK — alla assertions passerade." : `\nMISSLYCKADES — ${failures} assertions föll.`);
process.exit(failures === 0 ? 0 : 1);

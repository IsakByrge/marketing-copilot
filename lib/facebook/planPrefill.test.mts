// Deterministiskt test för mappningen veckoplan → Facebook-formulär.
// Ingen databas, inget nät. Kör: tsx lib/facebook/planPrefill.test.mts
import {
  planPrefill, planContentHref, readPlanParams, PLAN_SOURCE, MAPPADE_VINKLAR,
} from "./planPrefill";
import { FACEBOOK_ANGLES, FB_LIMITS } from "../../app/content/facebook/types";

let failures = 0;
function assert(cond: boolean, msg: string) {
  if (!cond) { failures++; console.error(`  ✗ ${msg}`); }
}

/* ── Produkt och ämne ─────────────────────────────────── */
{
  const medProdukt = planPrefill({ produkt: "Gasolkök P2", rubrik: "Laga mat ute i höst", amne: "Laga mat ute i höst. Lång brödtext…" });
  assert(medProdukt.productOrTopic === "Gasolkök P2 — Laga mat ute i höst", "produkt finns → produkt + rubrik, inte hela veckotexten");

  const utanRubrik = planPrefill({ produkt: "Gasolkök P2" });
  assert(utanRubrik.productOrTopic === "Gasolkök P2", "produkt utan rubrik → bara produkten");

  const utanProdukt = planPrefill({ rubrik: "Fem tips", amne: "Fem tips. Brödtexten här." });
  assert(utanProdukt.productOrTopic === "Fem tips. Brödtexten här.", "produkt saknas → ämnesfallback");

  const tomProdukt = planPrefill({ produkt: "   ", amne: "Ämnet" });
  assert(tomProdukt.productOrTopic === "Ämnet", "blanksteg räknas inte som produkt");

  assert(planPrefill({}).productOrTopic === undefined, "utan underlag sätts inget ämne alls");
  assert(planPrefill({}).filledFields.length === 0, "tomt inlägg förifyller ingenting");
}

/* ── Handling (cta → desiredAction) ───────────────────── */
{
  const p = planPrefill({ handling: "Beställ på webben" });
  assert(p.desiredAction === "Beställ på webben", "planens uppmaning blir formulärets handling");
  assert(p.filledFields.includes("Handling"), "handlingen räknas som förifylld");

  assert(planPrefill({ handling: "" }).desiredAction === undefined, "tom uppmaning ger ingen handling");
  assert(planPrefill({ handling: "   " }).desiredAction === undefined, "blanksteg ger ingen handling");
  assert(planPrefill({}).desiredAction === undefined, "saknad uppmaning ger ingen handling");
}

/* ── Roll → vinkel ────────────────────────────────────── */
{
  assert(planPrefill({ roll: "lokalt" }).requestedAngle === "local_service", "lokalt → local_service");
  assert(planPrefill({ roll: "  LOKALT  " }).requestedAngle === "local_service", "casing och blanksteg tål mappningen");

  // De fyra som MED FLIT inte mappas. Ändras detta ska det vara ett beslut,
  // inte en olycka — därför står de här var för sig.
  for (const roll of ["saljande", "tips", "prioriterad_produkt", "socialt"]) {
    assert(planPrefill({ roll }).requestedAngle === undefined, `${roll} ger ingen vinkel — ingen säker motsvarighet`);
  }
  assert(planPrefill({ roll: "nagot_okant" }).requestedAngle === undefined, "okänd roll ger ingen vinkel");
  assert(planPrefill({}).requestedAngle === undefined, "saknad roll ger ingen vinkel");

  assert(MAPPADE_VINKLAR.length === 1, "exakt en roll mappas i v1");
  assert(MAPPADE_VINKLAR.every((v) => FACEBOOK_ANGLES.includes(v)), "mappade vinklar finns i FacebookAngle");
}

/* ── Målet mappas inte ────────────────────────────────── */
{
  // mal kommer ur brain.marketingGoals — fri text användaren skrivit.
  // Det finns ingen taxonomi att matcha mot, så inget syfte får sättas.
  const p = planPrefill({ produkt: "P", handling: "H", roll: "lokalt" }) as unknown as Record<string, unknown>;
  assert(!("goal" in p), "mappningen sätter aldrig något syfte");
  assert(!planContentHref({ produkt: "P" }).includes("mal"), "målet skickas inte ens med i länken");
}

/* ── Längdgränser ─────────────────────────────────────── */
{
  const langProdukt = "A".repeat(FB_LIMITS.PRODUCT_OR_TOPIC + 200);
  const p = planPrefill({ produkt: langProdukt, rubrik: "Rubrik" });
  assert((p.productOrTopic ?? "").length === FB_LIMITS.PRODUCT_OR_TOPIC, "ämnet kapas till Facebooks egen gräns");

  const langHandling = "B".repeat(FB_LIMITS.DESIRED_ACTION + 200);
  assert((planPrefill({ handling: langHandling }).desiredAction ?? "").length === FB_LIMITS.DESIRED_ACTION, "handlingen kapas till sin gräns");

  const radbrytning = planPrefill({ amne: "Rad ett\n\n  Rad två\ttre" });
  assert(radbrytning.productOrTopic === "Rad ett Rad två tre", "radbrytningar och dubbla mellanslag normaliseras");
}

/* ── Äldre planinlägg utan de nya fälten ──────────────── */
{
  const gammal = planPrefill({ amne: "Rubrik. Text." });
  assert(gammal.productOrTopic === "Rubrik. Text.", "gammalt inlägg får ämnet");
  assert(gammal.desiredAction === undefined && gammal.requestedAngle === undefined, "gammalt inlägg förifyller inget mer");
  assert(gammal.filledFields.join() === "Vad marknadsförs", "bara ämnet räknas som förifyllt");
}

/* ── URL: bygg och läs tillbaka ───────────────────────── */
{
  const post = { amne: "Rubrik. Text.", rubrik: "Rubrik", produkt: "Gasolkök P2", handling: "Beställ på webben", roll: "lokalt" };
  const href = planContentHref(post);
  assert(href.startsWith("/content/facebook?"), "länken går till Facebook-sidan");
  assert(href.includes(`source=${PLAN_SOURCE}`), "länken är märkt som kommen från planen");

  const params = new URLSearchParams(href.split("?")[1]);
  const tillbaka = readPlanParams(params);
  assert(tillbaka !== null, "en planmärkt länk läses tillbaka");
  assert(tillbaka?.produkt === post.produkt && tillbaka?.handling === post.handling && tillbaka?.roll === post.roll, "roundtrip bevarar fälten");
  assert(JSON.stringify(planPrefill(tillbaka!)) === JSON.stringify(planPrefill(post)), "samma förifyllning före och efter URL:en");

  // Tecken som måste kodas.
  const knepig = { amne: "50 % & mer", rubrik: "A=B?C#D", produkt: "Kök & Grill", handling: "Ring 010-123 45 67" };
  const t2 = readPlanParams(new URLSearchParams(planContentHref(knepig).split("?")[1]));
  assert(t2?.produkt === "Kök & Grill" && t2?.rubrik === "A=B?C#D" && t2?.amne === "50 % & mer", "&, =, ? och # överlever kodningen");

  // Tomma fält skickas inte alls.
  const glest = planContentHref({ amne: "Bara ämne" });
  assert(!glest.includes("produkt=") && !glest.includes("handling=") && !glest.includes("roll="), "tomma fält utelämnas ur länken");
}

/* ── Prioritet mellan källor ──────────────────────────── */
{
  // readPlanParams svarar bara på planmärkta länkar. Sidan läser den
  // FÖRST efter att ha kontrollerat ?strategy=, så en strategi kan aldrig
  // skrivas över — men mappningen ska ändå inte kapa åt sig en gammal
  // amne-länk.
  assert(readPlanParams(new URLSearchParams("amne=Ett+ämne")) === null, "gammal amne-länk utan source är inte en planlänk");
  assert(readPlanParams(new URLSearchParams("strategy=abc")) === null, "en ren strategilänk är inte en planlänk");
  assert(readPlanParams(new URLSearchParams("source=strategy&produkt=P")) === null, "annan källa räknas inte som plan");

  // Blandad URL: parametrarna går att läsa, men sidan returnerar tidigt
  // när strategy finns. Testet låser fast att markeringen inte i sig
  // ger planen företräde.
  const blandad = new URLSearchParams(`strategy=abc&source=${PLAN_SOURCE}&produkt=P`);
  assert(blandad.get("strategy") === "abc", "strategin finns kvar i en blandad URL och vinner på sidan");
  assert(readPlanParams(blandad)?.produkt === "P", "planparametrarna är läsbara men används inte när strategin finns");
}

if (failures > 0) {
  console.error(`\n✗ planPrefill: ${failures} assertion(s) failed.`);
  process.exit(1);
}
console.log("\n✓ planPrefill: all assertions passed.");

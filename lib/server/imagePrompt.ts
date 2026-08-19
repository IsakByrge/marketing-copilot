// ─────────────────────────────────────────────────────────────
// Bildprompt — översätter en bildbrief till något en bildmodell förstår.
//
// PROBLEMET: motorns bildbrief är skriven för en människa. "Fokusera på
// kunden och fyllningsprocessen i en naturlig miljö" är regi till en
// fotograf. En bildmodell behöver konkreta substantiv: vad syns, var,
// i vilket ljus, ur vilken vinkel.
//
// Den gamla mallen gjorde det dessutom värre genom att inleda med
// "Professionell marknadsföringsbild för <företag>". Modellen känner
// inte till företaget, så det enda ordet bidrar med är "marknadsföring"
// — vilket är precis det som ger stockfoto-look.
//
// Ren logik, inga beroenden. Testas i imagePrompt.test.mts.
// ─────────────────────────────────────────────────────────────

export type ImageQuality = "draft" | "final";

/** Fel som bildmodeller gör om och om igen, och som förstör en annonsbild. */
const ALWAYS_AVOID = [
  "text",
  "bokstäver",
  "logotyper",
  "vattenstämplar",
  "varumärken",
  "deformerade händer",
  "extra fingrar",
] as const;

/**
 * Stilraden. Medvetet konkret fotografispråk i stället för "professionell"
 * och "inbjudande", som båda drar mot stockfoto.
 */
const STYLE =
  "Fotografi, naturligt dagsljus, mjuka skuggor, grunt skärpedjup, " +
  "35 mm-känsla, dokumentärt och osminkat, inte uppställt";

const clean = (s: string): string => s.replace(/\s+/g, " ").trim();

/**
 * Bygger den slutliga prompten.
 *
 * `subject` är det viktigaste och läggs först — bildmodeller viktar
 * början av prompten tyngst. Företagsnamnet utelämnas helt: modellen
 * vet inte vad Gasolfyllarna är, och ordet "marknadsföringsbild" gör
 * bara resultatet mer generiskt.
 */
export function buildImagePrompt(input: {
  subject: string;
  setting?: string;
  avoid?: string[];
}): string {
  const subject = clean(input.subject);
  if (!subject) return "";

  const parts = [subject];
  const setting = clean(input.setting ?? "");
  if (setting) parts.push(setting);
  parts.push(STYLE);

  const avoid = [...ALWAYS_AVOID, ...(input.avoid ?? []).map(clean).filter(Boolean)];
  // Dedupe utan att tappa ordningen.
  const unique = [...new Set(avoid.map((a) => a.toLowerCase()))];
  parts.push(`Undvik: ${unique.join(", ")}`);

  return parts.join(". ");
}

/**
 * Slår ihop en motorbrief (concept, subject, composition) till ett
 * motiv. `subject` är den konkreta delen och går först; `composition`
 * beskriver hur det ska ramas in. `concept` är den mest abstrakta och
 * utelämnas med flit — den tillför sällan något visuellt.
 */
export function briefToSubject(brief: {
  concept?: string;
  subject?: string;
  composition?: string;
}): string {
  const subject = clean(brief.subject ?? "");
  const composition = clean(brief.composition ?? "");
  if (subject && composition) return `${subject}. ${composition}`;
  return subject || composition || clean(brief.concept ?? "");
}

/**
 * Kostnad styrs av kvalitet, inte av modellval. "draft" finns för att
 * kunna prova sig fram billigt — det är samma modell, lägre upplösning
 * internt. Ta "final" först när motivet sitter.
 */
export function qualityParam(q: ImageQuality): "low" | "high" {
  return q === "draft" ? "low" : "high";
}

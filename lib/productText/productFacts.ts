// ─────────────────────────────────────────────────────────────
// Uppslagning av verifierade produktfakta per artikelnummer.
//
// Enda bryggan mellan Company Brain och produkttextprompten. Här
// väljs medvetet EXAKT vilka fält som får nå modellen: interna id:n
// och lönsamhet (profitability) plockas bort och når den aldrig.
//
// Butiken säljer gasol. En påhittad specifikation — material, tryck,
// kopplingstyp — är en säkerhetsfråga. Därför: matcha bara på exakt
// artikelnummer, aldrig på namnlikhet, och lämna hellre ut för lite
// än för mycket.
//
// Ren logik, inga beroenden mot Supabase eller nätverk.
// ─────────────────────────────────────────────────────────────
import type {
  CompanyBrain,
  KnowledgeConfidence,
  KnowledgeSource,
} from "@/app/_shared/companyBrain";

/**
 * De fakta om en produkt som FÅR gå vidare till modellen. Notera vad som
 * INTE finns med: interna id:n och `profitability` — de får aldrig nå en
 * prompt.
 */
export interface ProductFacts {
  name: string;
  description?: string;
  customerProblem?: string;
  primaryAudience?: string;
  differentiators: string[];
  commonObjections: string[];
  seasonality?: string;
  availabilityNotes?: string;
  confidence: KnowledgeConfidence;
  source: KnowledgeSource;
}

export type FactsLookup = (articleNumber: string) => ProductFacts | null;

/** Normaliserar ett artikelnummer för nyckelmatchning: trimmat och gement. */
const normalizeArticleNumber = (value: string): string => value.trim().toLowerCase();

/**
 * Bygger en uppslagsfunktion från artikelnummer till produktfakta. Endast
 * produkter med ett `articleNumber` tas med — matchning sker aldrig på
 * namnlikhet, eftersom fel produkt skulle ge fel (och för gasol farliga)
 * specifikationer. Vid dubbla artikelnummer vinner den första.
 */
export function buildFactsLookup(brain: CompanyBrain): FactsLookup {
  const map = new Map<string, ProductFacts>();
  for (const p of brain.products) {
    if (!p.articleNumber) continue;
    const key = normalizeArticleNumber(p.articleNumber);
    if (!key || map.has(key)) continue;
    map.set(key, {
      name: p.name,
      description: p.description,
      customerProblem: p.customerProblem,
      primaryAudience: p.primaryAudience,
      differentiators: p.differentiators,
      commonObjections: p.commonObjections,
      seasonality: p.seasonality,
      availabilityNotes: p.availabilityNotes,
      confidence: p.confidence,
      source: p.source,
    });
  }
  return (articleNumber: string) => map.get(normalizeArticleNumber(articleNumber)) ?? null;
}

/**
 * Sant om det finns något faktiskt sakinnehåll att skriva utifrån — inte bara
 * ett produktnamn. Namnet ensamt räcker inte, eftersom modellen då lika gärna
 * kan skriva utan underlag.
 */
export function hasUsableFacts(f: ProductFacts): boolean {
  return Boolean(
    f.description ||
    f.customerProblem ||
    f.primaryAudience ||
    f.differentiators.length > 0,
  );
}

/**
 * Formaterar faktan till radbaserad text för prompten. Returnerar `null` när
 * underlaget inte räcker (då ska anroparen behandla produkten som "underlag
 * saknas"). Vid låg confidence eller AI-föreslaget underlag läggs en rad till
 * om att uppgifterna inte är bekräftade och att texten ska hållas allmän.
 */
export function formatFacts(f: ProductFacts): string | null {
  if (!hasUsableFacts(f)) return null;

  const lines: string[] = [];
  if (f.description) lines.push(`Beskrivning: ${f.description}`);
  if (f.customerProblem) lines.push(`Problem produkten löser: ${f.customerProblem}`);
  if (f.primaryAudience) lines.push(`Målgrupp: ${f.primaryAudience}`);
  if (f.differentiators.length > 0) lines.push(`Det som skiljer den: ${f.differentiators.join(", ")}`);
  if (f.commonObjections.length > 0) lines.push(`Vanliga invändningar: ${f.commonObjections.join(", ")}`);
  if (f.seasonality) lines.push(`Säsong: ${f.seasonality}`);
  if (f.availabilityNotes) lines.push(`Tillgänglighet: ${f.availabilityNotes}`);

  if (f.confidence === "low" || f.source === "ai_suggested") {
    lines.push(
      "OBS: underlaget är inte bekräftat. Håll texten allmän och lägg inte till detaljer utöver detta.",
    );
  }

  return lines.join("\n");
}

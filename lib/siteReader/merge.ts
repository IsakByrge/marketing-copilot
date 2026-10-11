// ─────────────────────────────────────────────────────────────
// Förslag från hemsidan → ändringar i Company Brain.
//
// Inget skrivs över utan att användaren valt det. Ett förslag är
// antingen nytt (produkten eller platsen finns inte) eller en
// komplettering (den finns, men saknar pris, modeller, adress eller
// öppettider). Det användaren redan skrivit ändras aldrig: en
// komplettering fyller bara tomma fält.
//
// Relativa importer: testsviten körs med tsx utan tsconfig-alias.
// ─────────────────────────────────────────────────────────────
import type { CompanyBrain, CompanyLocation, CompanyProduct } from "../../app/_shared/companyBrain";
import type { BrainDraft, DraftLocation, DraftProduct } from "./brainDraft";

const norm = (s: string) => s.toLowerCase().normalize("NFD").replace(/\p{M}/gu, "").replace(/[^a-z0-9]/g, "");

/** "Gasolkamin" och "Gasolkaminer" är samma produkt; "Gasol" och "Gasolkaminer" inte. */
function sameName(a: string, b: string): boolean {
  const x = norm(a), y = norm(b);
  if (!x || !y) return false;
  if (x === y) return true;
  const [kort, lang] = x.length < y.length ? [x, y] : [y, x];
  return kort.length >= 5 && lang.startsWith(kort) && lang.length - kort.length <= 3;
}

export type Suggestion =
  | { id: string; kind: "summary"; label: string; detail: string; value: string }
  | { id: string; kind: "list"; field: "uniqueSellingPoints" | "primaryCustomers" | "tone"; label: string; detail: string; values: string[] }
  | { id: string; kind: "product-new"; label: string; detail: string; product: DraftProduct }
  | { id: string; kind: "product-fill"; label: string; detail: string; productId: string; product: DraftProduct }
  | { id: string; kind: "location-new"; label: string; detail: string; location: DraftLocation }
  | { id: string; kind: "location-fill"; label: string; detail: string; locationId: string; location: DraftLocation };

const FIELD_LABELS = {
  uniqueSellingPoints: "Det som skiljer er",
  primaryCustomers: "Kunder",
  tone: "Ton",
} as const;

function productDetail(p: DraftProduct): string {
  return [p.priceInfo, p.examples.length ? p.examples.join(", ") : null, p.description]
    .filter(Boolean).join(" · ");
}

function locationDetail(l: DraftLocation): string {
  return [l.address, l.openingHours].filter(Boolean).join(" · ") || "Bara orten står på sidan";
}

/** Vad hemsidan tillför jämfört med det som redan finns. */
export function suggestionsFrom(draft: BrainDraft, brain: CompanyBrain): Suggestion[] {
  const out: Suggestion[] = [];

  if (draft.summary && !brain.companySummary.trim()) {
    out.push({ id: "summary", kind: "summary", label: "Sammanfattning", detail: draft.summary, value: draft.summary });
  }

  for (const field of ["uniqueSellingPoints", "primaryCustomers", "tone"] as const) {
    const draftValues = field === "uniqueSellingPoints" ? draft.usps : field === "primaryCustomers" ? draft.customers : draft.tone;
    const finns = new Set(brain[field].map(norm));
    const nya = draftValues.filter((v) => !finns.has(norm(v)));
    if (nya.length) {
      out.push({ id: `list-${field}`, kind: "list", field, label: FIELD_LABELS[field], detail: nya.join(" · "), values: nya });
    }
  }

  draft.products.forEach((p, i) => {
    const befintlig = brain.products.find((b) => sameName(b.name, p.name));
    if (!befintlig) {
      out.push({ id: `p-new-${i}`, kind: "product-new", label: p.name, detail: productDetail(p), product: p });
      return;
    }
    const tillfor = (p.priceInfo && !befintlig.priceInfo) || (p.examples.length && !befintlig.models?.length)
      || (p.description && !befintlig.description);
    if (tillfor) {
      out.push({
        id: `p-fill-${i}`, kind: "product-fill", label: befintlig.name,
        detail: productDetail({
          ...p,
          priceInfo: befintlig.priceInfo ? undefined : p.priceInfo,
          examples: befintlig.models?.length ? [] : p.examples,
          description: befintlig.description ? undefined : p.description,
        }),
        productId: befintlig.id, product: p,
      });
    }
  });

  draft.locations.forEach((l, i) => {
    const befintlig = brain.locations.find((b) => norm(b.city) === norm(l.city));
    if (!befintlig) {
      out.push({ id: `l-new-${i}`, kind: "location-new", label: l.city, detail: locationDetail(l), location: l });
      return;
    }
    const tillfor = (l.address && !befintlig.address) || (l.openingHours && !befintlig.openingHours);
    if (tillfor) {
      out.push({
        id: `l-fill-${i}`, kind: "location-fill", label: befintlig.city,
        detail: locationDetail({
          ...l,
          address: befintlig.address ? undefined : l.address,
          openingHours: befintlig.openingHours ? undefined : l.openingHours,
        }),
        locationId: befintlig.id, location: l,
      });
    }
  });

  return out;
}

/**
 * De valda förslagen inlagda i hjärnan. Användaren har redan valt dem,
 * så de räknas som bekräftade — att be om en bekräftelse till vore att
 * fråga två gånger. Var de kom ifrån står i sourceUrl. Kompletteringar
 * fyller bara tomma fält.
 */
export function applySuggestions(
  brain: CompanyBrain, chosen: Suggestion[], newId: () => string, now = new Date().toISOString(),
): CompanyBrain {
  const next: CompanyBrain = structuredClone(brain);
  for (const s of chosen) {
    if (s.kind === "summary") {
      if (!next.companySummary.trim()) next.companySummary = s.value;
    } else if (s.kind === "list") {
      next[s.field] = [...next[s.field], ...s.values.filter((v) => !next[s.field].some((x) => norm(x) === norm(v)))];
    } else if (s.kind === "product-new") {
      const p: CompanyProduct = {
        id: newId(),
        name: s.product.name,
        category: s.product.category,
        description: s.product.description,
        priceInfo: s.product.priceInfo,
        models: s.product.examples,
        sourceUrl: s.product.source,
        differentiators: [],
        commonObjections: [],
        profitability: "unknown",
        priority: "normal",
        source: "user_confirmed",
        confidence: "high",
        confirmedAt: now,
        updatedAt: now,
      };
      next.products = [...next.products, p];
    } else if (s.kind === "product-fill") {
      next.products = next.products.map((p) => p.id !== s.productId ? p : {
        ...p,
        priceInfo: p.priceInfo || s.product.priceInfo,
        models: p.models?.length ? p.models : s.product.examples,
        description: p.description || s.product.description,
        sourceUrl: p.sourceUrl || s.product.source,
        updatedAt: now,
      });
    } else if (s.kind === "location-new") {
      const l: CompanyLocation = { id: newId(), city: s.location.city, address: s.location.address, openingHours: s.location.openingHours };
      next.locations = [...next.locations, l];
    } else if (s.kind === "location-fill") {
      next.locations = next.locations.map((l) => l.id !== s.locationId ? l : {
        ...l,
        address: l.address || s.location.address,
        openingHours: l.openingHours || s.location.openingHours,
      });
    }
  }
  return next;
}

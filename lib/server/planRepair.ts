// ─────────────────────────────────────────────────────────────
// Reparationsrunda för veckoplanen.
//
// VARFÖR: modellen skriver konsekvent för korta inlägg på svenska,
// oavsett hur prompten formuleras. Eval-skriptet visade 36–61 ord mot
// kravet 60–150 över sex körningar, med olika formuleringar av kravet,
// ett borttaget kortformsexempel och ett inlagt exempel på rätt längd.
// Skillnaden var mätbar men aldrig tillräcklig.
//
// Prompttryck har en gräns. Det här är i stället en mätning: räkna
// orden, och be om utökning BARA av de texter som faktiskt är för
// korta. Ett extra anrop, och bara när det behövs.
//
// Rundan körs HÖGST EN GÅNG per plan. Hjälper den inte behåller vi det
// modellen skrev — en text som är några ord för kort är bättre än ännu
// ett anrop, och bättre än en tom sida.
//
// Modulen är ren funktion + promptbygge, utan Supabase eller
// next/headers, så både routen och eval-skriptet kan använda den.
// ─────────────────────────────────────────────────────────────
import { LENGTH_LIMITS } from "./planPrompt";

export const ord = (s: string): number =>
  (s ?? "").trim().split(/\s+/).filter(Boolean).length;

export interface PlanPost {
  roll?: string; dag?: string; produkt?: string; mal?: string;
  title?: string; text?: string; cta?: string; image?: string;
}

export interface PlanShape {
  posts?: PlanPost[];
  newsletter?: { subject?: string; preview?: string; body?: string; cta?: string };
  [k: string]: unknown;
}

export interface ForKort {
  /** Index i posts, eller -1 för nyhetsbrevet. */
  index: number;
  titel: string;
  ordNu: number;
  minst: number;
}

/** Vilka texter som ligger under golvet. Tom lista = inget att göra. */
export function hittaForKorta(plan: PlanShape): ForKort[] {
  const ut: ForKort[] = [];
  (plan.posts ?? []).forEach((p, i) => {
    const n = ord(p.text ?? "");
    if (n < LENGTH_LIMITS.POST_MIN_WORDS) {
      ut.push({ index: i, titel: p.title ?? `Inlägg ${i + 1}`, ordNu: n, minst: LENGTH_LIMITS.POST_MIN_WORDS });
    }
  });
  const nl = ord(plan.newsletter?.body ?? "");
  if (nl < LENGTH_LIMITS.NEWSLETTER_MIN_WORDS) {
    ut.push({ index: -1, titel: "Nyhetsbrevet", ordNu: nl, minst: LENGTH_LIMITS.NEWSLETTER_MIN_WORDS });
  }
  return ut;
}

/**
 * Prompt som ber om utökade texter — och bara de. Modellen får tillbaka
 * sin egen text och ombeds bygga ut den, inte skriva om den, så tonen
 * och faktaunderlaget överlever.
 */
export function buildRepairPrompt(plan: PlanShape, forKorta: ForKort[]): string {
  const delar = forKorta.map((f) => {
    const text = f.index === -1
      ? plan.newsletter?.body ?? ""
      : plan.posts?.[f.index]?.text ?? "";
    const nyckel = f.index === -1 ? "newsletter" : String(f.index);
    return `── ${nyckel} — "${f.titel}" (${f.ordNu} ord, behöver minst ${f.minst})
${text}`;
  }).join("\n\n");

  return `Texterna nedan är för korta och måste byggas ut. De kommer från en
veckoplan du just skrev.

BYGG UT, SKRIV INTE OM:
- Behåll ämnet, tonen, ordningen och alla fakta. Lägg till innehåll.
- Lägg till konkretion: ett scenario läsaren känner igen, vad man gör,
  varför just nu. Inte fler adjektiv och inga upprepningar.
- Hitta INTE på nya produkter, tjänster, erbjudanden, priser, siffror
  eller egenskaper. Bygg ut med det som redan står i texten.
- Behåll uppmaningen som den är. Den ingår inte i texten nedan.
- Inga utropstecken, ingen emoji.

${delar}

Svara med EXAKT giltig JSON, ingen förtext:
{
  "texts": {
${forKorta.map((f) => `    "${f.index === -1 ? "newsletter" : f.index}": "den utbyggda texten, minst ${f.minst} ord"`).join(",\n")}
  }
}`;
}

/** Väver in de utökade texterna. Kortare svar än originalet ignoreras. */
export function applyRepair(plan: PlanShape, texts: Record<string, string>): PlanShape {
  const posts = [...(plan.posts ?? [])];
  let newsletter = plan.newsletter;

  for (const [nyckel, ny] of Object.entries(texts ?? {})) {
    if (typeof ny !== "string" || !ny.trim()) continue;
    if (nyckel === "newsletter") {
      const gammal = newsletter?.body ?? "";
      if (ord(ny) > ord(gammal)) newsletter = { ...newsletter, body: ny };
      continue;
    }
    const i = Number(nyckel);
    if (!Number.isInteger(i) || i < 0 || i >= posts.length) continue;
    if (ord(ny) > ord(posts[i].text ?? "")) posts[i] = { ...posts[i], text: ny };
  }

  return { ...plan, posts, newsletter };
}

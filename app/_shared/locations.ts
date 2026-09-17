// ─────────────────────────────────────────────────────────────
// Depåer och platser — reservläsning och veckorotation.
//
// Platserna bor strukturerat i company_brain (CompanyLocation). Är
// listan tom finns ofta orterna ändå, nedskrivna i sammanfattningen:
// "Vi har depåer i Norrköping, Linköping och Nyköping." Den här modulen
// läser ut dem som reserv, så det lokala inlägget har något att stå på
// innan användaren hunnit fylla i fältet.
//
// Konservativt med flit. Hellre inga orter än fel orter — en påhittad
// ort i ett lokalt inlägg är precis den sortens fel faktaspärren finns
// för.
// ─────────────────────────────────────────────────────────────
import type { CompanyLocation } from "./companyBrain";

const ORT = /^[A-ZÅÄÖ][\p{L}-]{1,30}$/u;

/**
 * Orter lästa ur en fritext. Två mönster, i tur och ordning:
 * "depåer i X, Y och Z" först, och bara om det inte ger något,
 * enstaka "i X".
 */
export function ortesFranText(text: string | undefined): string[] {
  if (!text) return [];
  const funna = new Set<string>();

  const efterPlats = text.match(
    /(?:dep[åa]e?r?|butik(?:er)?|verkst[aä]d(?:er)?|anl[aä]ggning(?:ar)?)\s+i\s+([^.!?\n]{2,120})/i,
  );
  if (efterPlats) {
    for (const bit of efterPlats[1].split(/,|\soch\s/i)) {
      const ort = bit.trim().replace(/[.:;]$/, "");
      if (ORT.test(ort)) funna.add(ort);
    }
  }

  if (funna.size === 0) {
    for (const m of text.matchAll(/\bi\s+([A-ZÅÄÖ][\p{L}-]{2,30})\b/gu)) {
      funna.add(m[1]);
    }
  }

  return [...funna].slice(0, 20);
}

/**
 * Orterna som ska användas: de ifyllda platserna först, annars det som
 * går att läsa ur sammanfattningen.
 */
export function tillgangligaOrter(
  locations: CompanyLocation[] | undefined,
  summary: string | undefined,
): string[] {
  const ifyllda = (locations ?? []).map((l) => l.city.trim()).filter(Boolean);
  if (ifyllda.length > 0) return [...new Set(ifyllda)];
  return ortesFranText(summary);
}

/**
 * Veckans ort. Roterar deterministiskt på ISO-veckonumret: samma vecka
 * ger alltid samma ort, nästa vecka ger nästa. Ingenting behöver sparas
 * mellan körningar, och två anrop samma vecka ger samma svar.
 */
export function veckansOrt(orter: string[], veckonummer: number): string | null {
  if (orter.length === 0) return null;
  const i = ((veckonummer % orter.length) + orter.length) % orter.length;
  return orter[i];
}

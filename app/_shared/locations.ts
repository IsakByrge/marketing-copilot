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

/** Text utan diakritiska tecken: "Norrkoping" i ett snabbt skrivet svar
 *  ska räknas som Norrköping. */
const utanAccent = (s: string) => s.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();

/** Var orten står som ett eget ord i texten, eller -1. "Köping" ska inte
 *  träffa inuti "Norrköping". Skiftläge och å/ä/ö spelar ingen roll. */
export function ortPosition(text: string, ort: string): number {
  const esc = utanAccent(ort.trim()).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  if (!esc) return -1;
  const m = new RegExp(`(^|[^\\p{L}])${esc}(?=$|[^\\p{L}])`, "u").exec(utanAccent(text));
  return m ? m.index + m[1].length : -1;
}

/** Sant när orten står som ett eget ord i texten. */
export function namnerOrt(text: string, ort: string): boolean {
  return ortPosition(text, ort) >= 0;
}

export interface VeckansOrtUnderlag {
  /** Orterna som finns, i Company Brain-ordning. */
  orter: string[];
  /** Platserna med detaljer. Används för att föredra depåer som har
   *  adress eller öppettider ifyllda — det finns något sant att skriva. */
  platser?: CompanyLocation[];
  /** Det företagaren skrev om veckan. */
  veckansUnderlag?: string | null;
  /** Geografiskt område för veckans kampanjer, i fritext. */
  kampanjomraden?: string[];
  veckonummer: number;
}

/**
 * Veckans ort, vald i den här ordningen:
 *  1. En ort som står i veckans underlag. Företagaren har sagt det.
 *  2. Orterna en pågående kampanj riktar sig till, roterade per vecka.
 *  3. Orterna som har adress eller öppettider ifyllda, roterade per vecka.
 *  4. Alla orter, roterade per vecka — som förut.
 *
 * Tidigare gällde bara 4. Med sju depåer landade vecka 41 på Enköping,
 * och varje plan den veckan handlade om en depå företagaren inte
 * ansvarar för, trots att kampanjen och öppettiderna gällde två andra.
 */
export function valjVeckansOrt(u: VeckansOrtUnderlag): string | null {
  const { orter, veckonummer } = u;
  if (orter.length === 0) return null;

  const text = u.veckansUnderlag ?? "";
  const iUnderlaget = orter
    .map((o) => ({ o, i: ortPosition(text, o) }))
    .filter(({ i }) => i >= 0)
    .sort((a, b) => a.i - b.i);
  if (iUnderlaget.length > 0) return iUnderlaget[0].o;

  const omraden = (u.kampanjomraden ?? []).join(" ");
  const iKampanj = orter.filter((o) => namnerOrt(omraden, o));
  if (iKampanj.length > 0) return veckansOrt(iKampanj, veckonummer);

  const medFakta = orter.filter((o) =>
    (u.platser ?? []).some((p) => utanAccent(p.city.trim()) === utanAccent(o) && (p.address?.trim() || p.openingHours?.trim())),
  );
  if (medFakta.length > 0) return veckansOrt(medFakta, veckonummer);

  return veckansOrt(orter, veckonummer);
}

// ─────────────────────────────────────────────────────────────
// Säsongsspärr.
//
// "Fyll på gasol inför hettan" skrevs i september. Modellen vet vilken
// månad det är — den står först i prompten — men säsongsorden sitter
// löst i språket och glider in ändå, särskilt i kampanjtitlar där
// texten är kort och klichén ligger nära.
//
// Det här är mätningen efteråt, och en lista att ge prompten. Räknas i
// Europe/Stockholm, eftersom månaden ska vara den användaren lever i.
// ─────────────────────────────────────────────────────────────
import { stockholmDate } from "./voice";

/** Ord som bara hör hemma i den varma halvan av året. */
export const SOMMARORD = [
  // "hett" tacker hett, hetta och hettan. Bada formerna i listan gav
  // samma fel tva ganger i rapporten.
  "hett",
  "sommar",
  "midsommar",
  "semester",
  "badet",
  "solsken",
  "värmebölja",
  "utesäsong",
] as const;

/** Ord som bara hör hemma i den kalla halvan. */
export const VINTERORD = [
  "vinter",
  "jul",
  "nyår",
  "kyla",
  "snö",
  "frost",
  "halka",
  "minusgrader",
  "adventsmys",
] as const;

/**
 * Månad 1–12 i Europe/Stockholm.
 * Exporterad för testernas skull, så de kan mata in ett datum.
 */
export function manad(now = new Date()): number {
  return stockholmDate(now).getUTCMonth() + 1;
}

/**
 * Sommarord är förbjudna september–februari, vinterord mars–augusti.
 *
 * Gränserna är grova med flit. Augusti kan vara varmt och mars kan vara
 * kallt, men ett kampanjnamn ska tala om säsongen som KOMMER, inte den
 * som nyss var. Att skriva om hetta i september är alltid fel.
 */
export function forbjudnaSasongsord(now = new Date()): readonly string[] {
  const m = manad(now);
  const kallHalva = m >= 9 || m <= 2;
  return kallHalva ? SOMMARORD : VINTERORD;
}

/** Säsongsord i texten som inte hör till årstiden. Tom lista = rent. */
export function sasongsfelIText(text: string | undefined, now = new Date()): string[] {
  if (!text) return [];
  const l = text.toLowerCase();
  return forbjudnaSasongsord(now).filter((o) => l.includes(o));
}

/** Regeltexten till prompten, med månadens faktiska förbud utskrivna. */
export function sasongsBlock(now = new Date()): string {
  const forbjudna = forbjudnaSasongsord(now);
  const m = manad(now);
  const kallHalva = m >= 9 || m <= 2;
  const arstid = kallHalva ? "den kalla halvan av året" : "den varma halvan";

  return `SÄSONG — GÄLLER OCKSÅ KAMPANJTITLAR:
Vi är i ${arstid}. Skriv aldrig något som hör till motsatt årstid, vare
sig i inlägg, nyhetsbrev eller kampanjnamn. Förbjudna ord just nu:
${forbjudna.map((o) => `"${o}"`).join(", ")}.
En kampanjtitel som "Fyll på inför hettan" i september är fel oavsett
hur bra den låter. Kampanjnamnet ska peka mot säsongen som kommer.

Orden är förbjudna ÄVEN i jämförelser och framåtblickar. Skriv inte
"både under sommarens grillfester och höstens middagar" och inte
"planera inför nästa sommar". Skriv "nästa säsong", "längre fram" eller
namnge månaden i stället. Ett ord från fel årstid drar tankarna dit
öven när meningen är korrekt.`;
}

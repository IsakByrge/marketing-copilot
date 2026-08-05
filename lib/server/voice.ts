// ─────────────────────────────────────────────────────────────
// Produktens skrivregler — EN röst för allt innehåll.
//
// Tidigare hade varje promptväg sin egen uppsättning regler:
// generate-plan hade en förbjuden-lista, Facebook-motorn en annan,
// create-content ingen alls, produkttexterna en tredje. Resultatet var
// fyra olika tonlägen i samma produkt.
//
// Reglerna här är destillerade ur det som faktiskt gick fel i skarpt
// bruk: modellen faller tillbaka på tomma värdefraser så fort den
// saknar substans, och den återanvänder samma säljargument på allt
// den skriver i samma anrop.
//
// Ändra här — inte i enskilda routes.
// ─────────────────────────────────────────────────────────────

/**
 * Formuleringar som kan gälla vilket företag som helst. Modellen når
 * efter dem när Company Brain är tunn — och då är texten värdelös.
 */
export const BANNED_PHRASES = [
  "en pålitlig lösning",
  "kraftfull lösning",
  "perfekt för",
  "passar alla behov",
  "marknadens bästa",
  "hög kvalitet till bra pris",
  "oavsett vad du behöver",
  "för dina [X]-behov",
  "ett självklart val",
  "idealisk för olika användningsområden",
  "möter dina behov",
  "vi strävar efter att leverera kvalitet",
  "nöjda kunder är vår prioritet",
  "med lång erfarenhet inom branschen",
  "tveka inte att höra av dig",
  "i dagens digitala värld",
  "vi har det du behöver",
  // Hämtade från Facebook-motorns klichélista, som är den mest
  // genomarbetade i kodbasen. Den prompten lämnas orörd — det här är
  // dess lärdomar gjorda tillgängliga för övriga vägar.
  "inte bara X – utan Y",
  "mer än bara",
  "ta nästa steg",
  "till nästa nivå",
  "upptäck skillnaden",
  "en investering i kvalitet",
  "skräddarsydda lösningar",
  "vi brinner för",
  "perfekt för dig som",
  "låt oss hjälpa dig",
  "sömlös",
  "när det kommer till",
] as const;

/** Grundregler som gäller allt innehåll produkten skriver. */
export const VOICE_RULES = `SKRIVREGLER (gäller allt innehåll)

- Skriv på svenska, i företagets tonfall. Hellre kort än utfyllt.
- Första meningen ska innehålla något konkret och sant — en egenskap, ett
  scenario eller något företaget faktiskt gör. Börja aldrig med en allmän
  värdefras.
- Hitta aldrig på fakta som inte framgår av underlaget: mått, material,
  certifieringar, kompatibilitet, priser, lagerstatus, leveranstider,
  omdömen eller siffror.
- Saknas underlag: skriv kortare i stället för att fylla ut.
- Uppmaningar ska vara konkreta handlingar, aldrig "Kontakta oss".
- Inga tomma superlativ, inga utropstecken, ingen emoji.

FÖRBJUDNA FORMULERINGAR — de säger ingenting och kan gälla vilket företag
som helst:
${BANNED_PHRASES.map((p) => `"${p}"`).join(", ")}.
Alla liknande fraser är också förbjudna.`;

/** Läggs till när ett anrop producerar flera texter samtidigt. */
export const VARIATION_RULE = `VARIATION
Du skriver flera texter i samma anrop. Varje text ska vara sin egen.
Återanvänd inte samma inledning, samma säljargument eller samma avslutande
mening. Ett argument ur företagsprofilen används bara där det faktiskt är
relevant — inte överallt.`;

/**
 * Exempel på form, medvetet från en bransch produkten sannolikt aldrig
 * möter. Exempel som ligger nära det verkliga fallet får modellen att
 * kopiera innehållet i stället för att lära sig strukturen — det hände
 * i skarpt bruk och är därför ett medvetet val, inte slarv.
 */
export const FORM_EXAMPLE = `Exemplet nedan är från en annan bransch och visar bara formen.
Kopiera aldrig dess innehåll eller meningsbyggnad.

BRA: "Vi slipar om dina skridskor på tio minuter medan du handlar. Skäret blir
lika vasst som på ett nytt par, och du slipper lämna in dem över natten."
DÅLIGT: "Skridskoslipning är en pålitlig lösning för dina slipbehov. Perfekt
för både motionärer och elitåkare, oavsett vad du behöver."`;

/** Hela blocket. `variation` bara när anropet ger flera texter. */
export function voiceBlock(opts: { variation?: boolean; example?: boolean } = {}): string {
  const parts = [VOICE_RULES];
  if (opts.variation) parts.push(VARIATION_RULE);
  if (opts.example !== false) parts.push(FORM_EXAMPLE);
  return parts.join("\n\n");
}

// ── Datum ───────────────────────────────────────────────────

/**
 * ISO 8601-veckonummer. Den tidigare beräkningen var en approximation
 * (dagar sedan 1 januari delat med sju) som ger fel veckonummer stora
 * delar av året — ISO räknar veckor från måndag och låter veckan tillhöra
 * det år dess torsdag ligger i.
 */
export function isoWeek(date: Date): number {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  // Flytta till veckans torsdag: söndag (0) räknas som 7.
  d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil(((d.getTime() - yearStart.getTime()) / 86_400_000 + 1) / 7);
}

/** "5 augusti 2026, vecka 32" — samma formulering överallt. */
export function todayLabel(date = new Date()): string {
  const month = date.toLocaleString("sv-SE", { month: "long" });
  return `${date.getDate()} ${month} ${date.getFullYear()}, vecka ${isoWeek(date)}`;
}

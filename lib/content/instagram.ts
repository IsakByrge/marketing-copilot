// ─────────────────────────────────────────────────────────────
// Instagram-varianten av ett planinlägg.
//
// Planens inlägg är skrivna för Facebook: 60–150 ord, länken sist. På
// Instagram fungerar ingen länk i texten, de första raderna är allt som
// syns innan "mer", och hashtags hör till. Det är tre skillnader, och
// bara den första kräver en modell.
//
// Hashtaggarna byggs här, inte av modellen: de görs av företagets namn,
// inläggets produkt och orter som står i texten. En hashtag är ett
// påstående om vad inlägget handlar om, och de ska komma ur underlaget.
//
// Ren modul, testas i instagram.test.mts.
// ─────────────────────────────────────────────────────────────
import { namnerOrt } from "@/app/_shared/locations";

export const INSTAGRAM_MAX_WORDS = 110;
export const INSTAGRAM_MAX_HASHTAGS = 5;

/** Webbadresser bort, och raderna de stod på om inget annat stod där. */
export function utanLankar(text: string): string {
  return text
    .split("\n")
    .map((rad) => rad.replace(/\b(?:https?:\/\/|www\.)\S+/gi, "").replace(/\s{2,}/g, " ").trimEnd())
    .filter((rad, i, alla) => rad.trim() !== "" || (i > 0 && alla[i - 1].trim() !== ""))
    .join("\n")
    .trim();
}

/** "Gasol i lösvikt" → "#gasolilösvikt". Svenska bokstäver behålls,
 *  Instagram hanterar dem. */
export function hashtag(ord: string): string | null {
  const t = ord.toLowerCase().replace(/[^\p{L}\p{N}]/gu, "");
  return t.length >= 3 ? `#${t}` : null;
}

export interface HashtagUnderlag {
  companyName?: string;
  produkt?: string;
  /** Orter som finns i Company Brain. Bara de som nämns i texten används. */
  orter?: string[];
  text: string;
}

/** Högst fem hashtags, i ordningen företag, produkt, orter. */
export function byggHashtags(u: HashtagUnderlag): string[] {
  const kandidater = [
    u.companyName,
    u.produkt,
    ...(u.orter ?? []).filter((o) => namnerOrt(u.text, o)),
  ];
  const ut: string[] = [];
  for (const k of kandidater) {
    const h = k ? hashtag(k) : null;
    if (h && !ut.includes(h)) ut.push(h);
    if (ut.length >= INSTAGRAM_MAX_HASHTAGS) break;
  }
  return ut;
}

/** Modellens bildtext plus hashtags, städad. Modellen får inte skicka
 *  egna hashtags eller länkar — de tas bort här. */
export function slutfordBildtext(caption: string, hashtags: string[]): string {
  const ren = utanLankar(caption)
    .replace(/(^|\s)#[\p{L}\p{N}_]+/gu, "$1")
    .replace(/!/g, ".")
    .replace(/[ \t]{2,}/g, " ")
    .trim();
  return hashtags.length ? `${ren}\n\n${hashtags.join(" ")}` : ren;
}

export function instagramPrompt(kalla: string): string {
  return `Skriv om inlägget nedan till en bildtext för Instagram. Samma ämne,
samma fakta, samma ton.

REGLER FÖR INSTAGRAM:
- Första meningen bär hela poängen. Den är allt som syns innan "mer", så
  den ska säga något konkret — inte "Tänk dig" eller en fråga utan svar.
- Högst ${INSTAGRAM_MAX_WORDS} ord. Korta stycken, en tom rad mellan dem.
- Ingen webbadress och ingen länk: länkar fungerar inte i Instagram-text.
  Skriv inte heller "länk i bio" eller "länken i profilen" — vi vet inte
  om profilen har en länk. En uppmaning att komma förbi en depå fungerar.
- Inga hashtags. De läggs till efteråt.
- Inga nya fakta. Allt du skriver ska stå i inlägget nedan. Behåll priser,
  datum, adresser och öppettider exakt som de står.
- Inga utropstecken, ingen emoji.

INLÄGGET:
"""
${kalla.replace(/"""/g, "”””")}
"""

Svara med EXAKT giltig JSON, ingen förtext:
{ "caption": "bildtexten, utan hashtags och utan länkar" }`;
}

/** Planinläggets text som den visas och kopieras på Innehåll: rubrik,
 *  brödtext, uppmaning. Delas av sidan och routen så att Instagram-
 *  varianten utgår från exakt samma text som användaren ser. */
export function planPostText(p: { title?: string; text?: string; cta?: string }): string {
  return [p.title, p.text, p.cta].filter(Boolean).join("\n\n");
}

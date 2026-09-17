// ─────────────────────────────────────────────────────────────
// Webbplatser och länkar.
//
// Ett företag har ofta mer än en adress: en webbshop där man köper,
// och en hemsida som berättar var depåerna ligger. Vilken som hör till
// ett inlägg beror på inläggets syfte — ett säljande inlägg om en
// produkt ska leda till shoppen, ett lokalt inlägg till hemsidan.
//
// Utan den här listan hade modellen antingen hittat på en adress eller
// låtit bli att länka alls. Båda är sämre än att välja rätt av två
// kända.
//
// Valideringen är avsiktligt tillåtande om FORM och sträng om SCHEMA:
// "gasolfyllarna.se" accepteras och blir https://, medan javascript:
// och data: aldrig släpps igenom.
// ─────────────────────────────────────────────────────────────

/** Scheman vi accepterar. Inga andra — en länk i kundtext ska vara webb. */
const TILLATNA_SCHEMAN = ["http:", "https:"];

export interface UrlResultat {
  ok: boolean;
  /** Normaliserad adress när ok, annars tom sträng. */
  url: string;
  /** Vad som är fel, för formuläret. Tom när ok. */
  fel: string;
}

/**
 * Validerar och normaliserar en adress.
 * Saknas schema antas https, eftersom det är vad folk skriver.
 */
export function normaliseraUrl(raw: string | undefined): UrlResultat {
  const text = (raw ?? "").trim();
  if (!text) return { ok: false, url: "", fel: "Skriv en adress." };

  // "javascript:alert(1)" ska falla här, inte få https:// påklistrat.
  const harSchema = /^[a-z][a-z0-9+.-]*:/i.test(text);
  const kandidat = harSchema ? text : `https://${text}`;

  let parsad: URL;
  try {
    parsad = new URL(kandidat);
  } catch {
    return { ok: false, url: "", fel: "Det där ser inte ut som en webbadress." };
  }

  if (!TILLATNA_SCHEMAN.includes(parsad.protocol)) {
    return { ok: false, url: "", fel: "Bara http och https fungerar." };
  }
  // Ett värdnamn utan punkt är nästan alltid ett stavfel ("gasolfyllarna").
  if (!parsad.hostname.includes(".") || parsad.hostname.endsWith(".")) {
    return { ok: false, url: "", fel: "Adressen saknar domän, t.ex. .se" };
  }

  // Avslutande snedstreck bort, så samma adress inte lagras i två former.
  const normaliserad = parsad.toString().replace(/\/$/, "");
  return { ok: true, url: normaliserad, fel: "" };
}

/** Sant när adressen går att använda. */
export const arGiltigUrl = (raw: string | undefined): boolean => normaliseraUrl(raw).ok;

/**
 * Värdnamnet utan www, för jämförelser. Används av eval-skriptet för
 * att avgöra om en länk i en text hör till företaget.
 */
export function vardnamn(raw: string | undefined): string | null {
  const { ok, url } = normaliseraUrl(raw);
  if (!ok) return null;
  try {
    return new URL(url).hostname.replace(/^www\./, "").toLowerCase();
  } catch {
    return null;
  }
}

/** Alla länkar som förekommer i en text, som de står skrivna. */
export function lankarIText(text: string | undefined): string[] {
  if (!text) return [];
  const traffar = text.match(/\bhttps?:\/\/[^\s<>()"']+|\b[a-z0-9-]+(?:\.[a-z0-9-]+)*\.[a-z]{2,}(?:\/[^\s<>()"']*)?/gi);
  return traffar ? [...new Set(traffar.map((t) => t.replace(/[.,;:]$/, "")))] : [];
}

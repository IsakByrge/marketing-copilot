// ─────────────────────────────────────────────────────────────
// HTML-entiteter in och ut för produkttexter.
//
// Wikinggruppens beskrivningar ligger som HTML med kodade entiteter:
// 567 av 601 artiklar innehåller m&auml;ssing, &nbsp; och liknande.
// Skriver vi tillbaka rå UTF-8 i de fälten blir det trasiga tecken i
// shoppen, så utdata måste följa samma format som indata.
//
// Tre jobb:
//   • avkoda, för att räkna längd och visa "före" i godkännandevyn,
//   • sanera modellens svar till stycken och punktlistor,
//   • koda tillbaka allt utanför ren ASCII innan export.
//
// Ren logik, inga beroenden. Testas i html.test.mts.
// ─────────────────────────────────────────────────────────────

/**
 * Tecken → entitetsnamn. Latin-1-delen av HTML4 plus de typografiska
 * tecken svenska produkttexter faktiskt innehåller (tankstreck, citat-
 * tecken, grader, mått). Allt annat utanför ASCII kodas numeriskt.
 */
const NAMED: Record<string, string> = {
  " ": "nbsp", "¡": "iexcl", "¢": "cent", "£": "pound", "¤": "curren",
  "¥": "yen", "¦": "brvbar", "§": "sect", "¨": "uml", "©": "copy",
  "ª": "ordf", "«": "laquo", "¬": "not", "­": "shy", "®": "reg",
  "¯": "macr", "°": "deg", "±": "plusmn", "²": "sup2", "³": "sup3",
  "´": "acute", "µ": "micro", "¶": "para", "·": "middot", "¸": "cedil",
  "¹": "sup1", "º": "ordm", "»": "raquo", "¼": "frac14", "½": "frac12",
  "¾": "frac34", "¿": "iquest",
  "À": "Agrave", "Á": "Aacute", "Â": "Acirc", "Ã": "Atilde", "Ä": "Auml",
  "Å": "Aring", "Æ": "AElig", "Ç": "Ccedil", "È": "Egrave", "É": "Eacute",
  "Ê": "Ecirc", "Ë": "Euml", "Ì": "Igrave", "Í": "Iacute", "Î": "Icirc",
  "Ï": "Iuml", "Ð": "ETH", "Ñ": "Ntilde", "Ò": "Ograve", "Ó": "Oacute",
  "Ô": "Ocirc", "Õ": "Otilde", "Ö": "Ouml", "×": "times", "Ø": "Oslash",
  "Ù": "Ugrave", "Ú": "Uacute", "Û": "Ucirc", "Ü": "Uuml", "Ý": "Yacute",
  "Þ": "THORN", "ß": "szlig",
  "à": "agrave", "á": "aacute", "â": "acirc", "ã": "atilde", "ä": "auml",
  "å": "aring", "æ": "aelig", "ç": "ccedil", "è": "egrave", "é": "eacute",
  "ê": "ecirc", "ë": "euml", "ì": "igrave", "í": "iacute", "î": "icirc",
  "ï": "iuml", "ð": "eth", "ñ": "ntilde", "ò": "ograve", "ó": "oacute",
  "ô": "ocirc", "õ": "otilde", "ö": "ouml", "÷": "divide", "ø": "oslash",
  "ù": "ugrave", "ú": "uacute", "û": "ucirc", "ü": "uuml", "ý": "yacute",
  "þ": "thorn", "ÿ": "yuml",
  "–": "ndash", "—": "mdash", "‘": "lsquo", "’": "rsquo", "“": "ldquo",
  "”": "rdquo", "„": "bdquo", "†": "dagger", "•": "bull", "…": "hellip",
  "‰": "permil", "€": "euro", "™": "trade", "≈": "asymp", "≠": "ne",
  "≤": "le", "≥": "ge", "⁄": "frasl",
};

/** Omvänd uppslagning, byggd en gång. */
const BY_NAME: Record<string, string> = (() => {
  const m: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'" };
  for (const [ch, name] of Object.entries(NAMED)) m[name] = ch;
  return m;
})();

/**
 * Avkodar namngivna och numeriska entiteter till riktiga tecken.
 * Okända entiteter lämnas orörda — hellre `&foo;` kvar i en förhands-
 * visning än att vi tyst äter ett tecken som betydde något.
 */
export function decodeEntities(input: string): string {
  return (input ?? "").replace(/&(#x?[0-9a-f]+|[a-z][a-z0-9]*);/gi, (whole, body: string) => {
    if (body[0] === "#") {
      const code = body[1] === "x" || body[1] === "X"
        ? parseInt(body.slice(2), 16)
        : parseInt(body.slice(1), 10);
      if (!Number.isFinite(code) || code <= 0 || code > 0x10ffff) return whole;
      try { return String.fromCodePoint(code); } catch { return whole; }
    }
    return BY_NAME[body] ?? BY_NAME[body.toLowerCase()] ?? whole;
  });
}

/**
 * Kodar text till samma format som butiken redan använder: `&` `<` `>`
 * alltid, allt utanför ASCII som namngiven entitet när det finns ett
 * namn, annars numeriskt. Tar text UTAN taggar — taggarna läggs på av
 * `encodeHtml` som kodar innehållet men lämnar strukturen i fred.
 */
export function encodeText(input: string): string {
  let out = "";
  for (const ch of input ?? "") {
    if (ch === "&") out += "&amp;";
    else if (ch === "<") out += "&lt;";
    else if (ch === ">") out += "&gt;";
    else if (ch.charCodeAt(0) < 128) out += ch;
    else if (NAMED[ch]) out += `&${NAMED[ch]};`;
    else out += `&#${ch.codePointAt(0)};`;
  }
  return out;
}

/** Taggar vi släpper igenom. Spec: stycken och punktlistor, inget mer. */
const ALLOWED = new Set(["p", "ul", "li", "strong", "br"]);

/** Taggar som inte får ligga inuti sig själva. Ett <p> i ett <p> är ogiltig
 *  HTML och renderas olika i olika butikstema — stäng det förra i stället. */
const NO_NESTING = new Set(["p", "li"]);

/** Taggar vars INNEHÅLL också ska bort. För alla andra taggar behåller vi
 *  texten och kastar bara taggen — men "alert(1)" är inte produkttext. */
const DROP_CONTENT = new Set(["script", "style", "noscript", "iframe", "template"]);

/**
 * Sanerar modellens HTML: behåller `<p> <ul> <li> <strong> <br>`, kastar
 * allt annat (inklusive attribut, så inga style, class, onclick eller
 * länkar kan följa med in i butiken) och kodar textinnehållet.
 *
 * Returnerar HTML i butikens format — entitetskodad, klar för export.
 */
export function sanitizeHtml(input: string): string {
  const raw = input ?? "";
  let out = "";
  let i = 0;
  const open: string[] = [];

  while (i < raw.length) {
    const lt = raw.indexOf("<", i);
    if (lt === -1) {
      out += encodeText(decodeEntities(raw.slice(i)));
      break;
    }
    out += encodeText(decodeEntities(raw.slice(i, lt)));

    const gt = raw.indexOf(">", lt);
    if (gt === -1) {
      // Ofullständig tagg sist i strängen: behandla som text.
      out += encodeText(decodeEntities(raw.slice(lt)));
      break;
    }

    const inner = raw.slice(lt + 1, gt).trim();
    const closing = inner.startsWith("/");
    const tag = (closing ? inner.slice(1) : inner).split(/[\s/]/, 1)[0]?.toLowerCase() ?? "";

    if (DROP_CONTENT.has(tag) && !closing) {
      // Hoppa fram till sluttaggen. Saknas den kastas resten av strängen —
      // en oavslutad <script> har ändå inget i en produkttext att göra.
      const close = raw.toLowerCase().indexOf(`</${tag}`, gt);
      if (close === -1) break;
      const closeEnd = raw.indexOf(">", close);
      i = closeEnd === -1 ? raw.length : closeEnd + 1;
      continue;
    }

    if (ALLOWED.has(tag)) {
      if (tag === "br") {
        out += "<br>";
      } else if (closing) {
        // Stäng bara det som faktiskt är öppet, annars blir utdata ogiltig.
        const at = open.lastIndexOf(tag);
        if (at !== -1) {
          for (let k = open.length - 1; k >= at; k--) out += `</${open[k]}>`;
          open.length = at;
        }
      } else {
        if (NO_NESTING.has(tag)) {
          const same = open.lastIndexOf(tag);
          if (same !== -1) {
            for (let k = open.length - 1; k >= same; k--) out += `</${open[k]}>`;
            open.length = same;
          }
        }
        out += `<${tag}>`;
        open.push(tag);
      }
    }
    i = gt + 1;
  }

  for (let k = open.length - 1; k >= 0; k--) out += `</${open[k]}>`;
  return out;
}

/**
 * Tar bort block vars innehåll aldrig syns, se DROP_CONTENT. Utan det här
 * räknas en inklistrad <style> som text: Verona (101259) hade 10 800 tecken
 * CSS före första meningen om kaminen, och det var CSS:en som nådde modellen.
 */
function dropHiddenBlocks(html: string): string {
  return html.replace(/<(script|style|noscript|iframe|template)\b[^>]*>[\s\S]*?<\/\1\s*>/gi, " ");
}

/**
 * Synlig text utan taggar och entiteter. Grunden för både teckenräkning
 * och "före"-kolumnen i godkännandevyn.
 */
export function toPlainText(html: string): string {
  return decodeEntities(dropHiddenBlocks(html ?? "").replace(/<(br|\/p|\/li|\/ul)\s*\/?>/gi, " ").replace(/<[^>]*>/g, ""))
    .replace(/\s+/g, " ")
    .trim();
}

/** Antal synliga tecken. Det är detta som avgör om en text är tunn. */
export function visibleLength(html: string): number {
  return toPlainText(html).length;
}

/** Antal ord i den synliga texten — mallarnas längdkrav mäts i ord. */
export function wordCount(html: string): number {
  const t = toPlainText(html);
  return t ? t.split(/\s+/).length : 0;
}

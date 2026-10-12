// ─────────────────────────────────────────────────────────────
// Produktbeskrivningen i den nya designen (.gf-pd) — innehåll in,
// HTML ut.
//
// Modellen skriver aldrig HTML i det här formatet. Den fyller i fält
// (ingress, passar för, om produkten, specifikationer, frågor) och
// koden bygger HTML:en exakt som verona-beskrivning.html. Det betyder:
//   • HTML:en är alltid giltig och alltid samma struktur,
//   • designen kan bytas utan att en enda text skrivs om — fälten
//     sparas och HTML:en byggs om,
//   • specifikationstabellen har typens fasta rader, och en rad som
//     saknas i underlaget saknas i tabellen i stället för att gissas.
//
// sanitizePd är spärren åt andra hållet: det användaren själv skriver i
// granskningen får bara innehålla mallens taggar, bara gf-klasser och
// bara länkar inom butiken.
//
// Relativa importer: testsviten körs med tsx utan tsconfig-alias.
// ─────────────────────────────────────────────────────────────
import { encodeText, decodeEntities } from "./html";
import { PD_PROFILES, type PdProfile, type PdTypeId } from "./pdProfiles";

export interface PdContent {
  lead: string;
  fit: { yes: string[]; add: string[]; no: string[] };
  about: Array<{ title: string; text: string }>;
  note: { title: string; text: string } | null;
  specs: Array<{ label: string; value: string }>;
  faq: Array<{ q: string; a: string }>;
}

export const PD_LIMITS = {
  LEAD: 320, FIT_ITEMS: 5, FIT_ITEM: 160, ABOUT: 5, ABOUT_TITLE: 60, ABOUT_TEXT: 700,
  NOTE_TITLE: 80, NOTE_TEXT: 400, SPECS_FREE: 12, SPEC: 120, FAQ: 5, FAQ_Q: 160, FAQ_A: 600,
} as const;

/* ── Modellens svar → innehåll ───────────────────────────── */

/** Ren text, utan taggar, utropstecken eller dubbla mellanslag. */
function txt(v: unknown, max: number): string {
  if (typeof v !== "string" && typeof v !== "number") return "";
  return decodeEntities(String(v))
    .replace(/<[^>]*>/g, " ")
    .replace(/!/g, ".")
    .replace(/\.{2,}/g, ".")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, max)
    .trim();
}

function list(v: unknown, n: number, max: number): string[] {
  if (!Array.isArray(v)) return [];
  return [...new Set(v.map((x) => txt(x, max)).filter(Boolean))].slice(0, n);
}

const key = (s: string) => s.toLowerCase().normalize("NFD").replace(/\p{M}/gu, "").replace(/[^a-z0-9]/g, "");

/** Värden som betyder "vet inte". De blir en saknad rad, aldrig en cell. */
const UNKNOWN = /^(-|–|—|n\/?a|saknas|okant|okänt|ej angivet|inte angivet|uppgift saknas|\?|\[.*\])$/i;

/**
 * Modellens `pd`-objekt, sanerat. Specifikationer med fasta rader behåller
 * bara typens rader, i typens ordning; en rad utan värde räknas som
 * saknad. Null när det inte finns en ingress — då finns ingen text.
 */
export function validatePd(raw: unknown, profile: PdProfile): { content: PdContent; missingSpecs: string[] } | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const lead = txt(o.lead ?? o.ingress, PD_LIMITS.LEAD);
  if (!lead) return null;

  const fitRaw = (o.fit && typeof o.fit === "object" ? o.fit : {}) as Record<string, unknown>;
  const fit = {
    yes: list(fitRaw.yes, PD_LIMITS.FIT_ITEMS, PD_LIMITS.FIT_ITEM),
    add: list(fitRaw.add, PD_LIMITS.FIT_ITEMS, PD_LIMITS.FIT_ITEM),
    no: list(fitRaw.no, PD_LIMITS.FIT_ITEMS, PD_LIMITS.FIT_ITEM),
  };

  const about = (Array.isArray(o.about) ? o.about : [])
    .map((a) => {
      const r = (a && typeof a === "object" ? a : {}) as Record<string, unknown>;
      return { title: txt(r.title ?? r.rubrik, PD_LIMITS.ABOUT_TITLE).replace(/\.$/, ""), text: txt(r.text, PD_LIMITS.ABOUT_TEXT) };
    })
    .filter((a) => a.text)
    .slice(0, PD_LIMITS.ABOUT);

  const n = (o.note && typeof o.note === "object" ? o.note : null) as Record<string, unknown> | null;
  const note = n && txt(n.text, PD_LIMITS.NOTE_TEXT)
    ? { title: txt(n.title ?? n.rubrik, PD_LIMITS.NOTE_TITLE) || "Observera", text: txt(n.text, PD_LIMITS.NOTE_TEXT) }
    : null;

  const given = (Array.isArray(o.specs) ? o.specs : [])
    .map((s) => {
      const r = (s && typeof s === "object" ? s : {}) as Record<string, unknown>;
      return { label: txt(r.label, PD_LIMITS.SPEC), value: txt(r.value, PD_LIMITS.SPEC) };
    })
    .filter((s) => s.label && s.value && !UNKNOWN.test(s.value));

  let specs: PdContent["specs"];
  const missingSpecs: string[] = [];
  if (profile.specRows.length) {
    specs = [];
    for (const row of profile.specRows) {
      const hit = given.find((g) => key(g.label) === key(row));
      if (hit) specs.push({ label: row, value: hit.value });
      else missingSpecs.push(row);
    }
  } else {
    const seen = new Set<string>();
    specs = given.filter((g) => !seen.has(key(g.label)) && seen.add(key(g.label))).slice(0, PD_LIMITS.SPECS_FREE);
  }

  const faq = (Array.isArray(o.faq) ? o.faq : [])
    .map((f) => {
      const r = (f && typeof f === "object" ? f : {}) as Record<string, unknown>;
      return { q: txt(r.q ?? r.fraga, PD_LIMITS.FAQ_Q), a: txt(r.a ?? r.svar, PD_LIMITS.FAQ_A) };
    })
    .filter((f) => f.q && f.a)
    .slice(0, PD_LIMITS.FAQ);

  return { content: { lead, fit, about, note, specs, faq }, missingSpecs };
}

/* ── Innehåll → HTML ─────────────────────────────────────── */

const e = (s: string) => encodeText(s).replace(/"/g, "&quot;");

/**
 * HTML:en för beskrivningsfältet, exakt i mallens struktur. Avsnitt utan
 * innehåll tas inte med. Allt textinnehåll entitetskodas, som butikens
 * egna texter.
 */
export function renderPd(c: PdContent, typeId: PdTypeId): string {
  const p = PD_PROFILES[typeId] ?? PD_PROFILES.allman;
  const out: string[] = ['<div class="gf-pd">', "", `<p class="gf-pd__lead">${e(c.lead)}</p>`];

  const kolumn = (mod: "yes" | "add" | "no", icon: string, items: string[]) =>
    items.length === 0 ? "" : [
      `  <div class="gf-fit__col gf-fit__col--${mod}">`,
      `    <h3><span class="gf-fit__icon">${e(icon)}</span>${e(p.fitLabels[mod])}</h3>`,
      "    <ul>",
      ...items.map((i) => `      <li>${e(i)}</li>`),
      "    </ul>",
      "  </div>",
    ].join("\n");

  const fitCols = [kolumn("yes", "✓", c.fit.yes), kolumn("add", "+", c.fit.add), kolumn("no", "✕", c.fit.no)].filter(Boolean);
  const main = fitCols.length
    ? ['<div class="gf-pd__main">', `<h2 class="gf-pd__h">${e(p.fitHeading)}</h2>`, '<div class="gf-fit">', ...fitCols, "</div>", "</div>"].join("\n")
    : "";
  const side = c.about.length
    ? ['<div class="gf-pd__side">', '<h2 class="gf-pd__h">Om produkten</h2>',
        ...c.about.map((a) => `<p>${a.title ? `<strong>${e(a.title)}.</strong> ` : ""}${e(a.text)}</p>`),
        "</div>"].join("\n")
    : "";
  if (main || side) out.push("", '<div class="gf-pd__cols">', ...[main, side].filter(Boolean), "</div>");

  if (c.note) {
    out.push("", '<div class="gf-note">', '<span class="gf-note__icon">!</span>',
      `<div><strong>${e(c.note.title)}</strong><p>${e(c.note.text)}</p></div>`, "</div>");
  }

  if (c.specs.length) {
    out.push("", '<h2 class="gf-pd__h">Specifikationer</h2>', '<table class="gf-pd__specs">', "<tbody>",
      ...c.specs.map((s) => `<tr><td>${e(s.label)}</td><td>${e(s.value)}</td></tr>`),
      "</tbody>", "</table>");
  }

  if (c.faq.length) {
    out.push("", `<h2 class="gf-pd__h">${e("Vanliga frågor")}</h2>`, '<div class="gf-acc">',
      ...c.faq.map((f) => [
        '<details class="gf-acc__item">',
        `<summary>${e(f.q)}</summary>`,
        `<div class="gf-acc__panel"><p>${e(f.a)}</p></div>`,
        "</details>",
      ].join("\n")),
      "</div>");
  }

  out.push("", "</div>");
  return out.join("\n");
}

/* ── Sanering av det användaren skriver ──────────────────── */

const PD_TAGS = new Set([
  "div", "section", "p", "ul", "ol", "li", "strong", "em", "br", "h2", "h3", "span", "a",
  "table", "thead", "tbody", "tr", "th", "td", "details", "summary",
]);
const VOID = new Set(["br"]);
const DROP_CONTENT = new Set(["script", "style", "noscript", "iframe", "template", "object", "embed", "svg", "math"]);

/** Bara gf-klasser: utseendet ska komma ur designens CSS, inget annat. */
function cleanClass(v: string): string {
  return v.split(/\s+/).filter((c) => /^gf-[a-z0-9_-]+$/.test(c)).join(" ");
}

/** Bara länkar inom butiken: "/kategori/produkt/" eller "#ankare". */
export function safeHref(v: string): string | null {
  const h = decodeEntities(v).trim();
  if (/^#[a-z0-9_-]{1,60}$/i.test(h)) return h;
  if (!h.startsWith("/") || h.startsWith("//") || /[\s"'<>\\]/.test(h)) return null;
  return h.slice(0, 300);
}

/**
 * Sanerar HTML i mallens format. Behåller mallens taggar, `class` med bara
 * gf-klasser och `href` med bara interna adresser. Allt annat — style,
 * on-attribut, skript, externa länkar — tas bort. Texten entitetskodas.
 */
export function sanitizePd(input: string): string {
  const raw = input ?? "";
  let out = "";
  let i = 0;
  const open: string[] = [];

  while (i < raw.length) {
    const lt = raw.indexOf("<", i);
    if (lt === -1) { out += encodeText(decodeEntities(raw.slice(i))); break; }
    out += encodeText(decodeEntities(raw.slice(i, lt)));
    const gt = raw.indexOf(">", lt);
    if (gt === -1) { out += encodeText(decodeEntities(raw.slice(lt))); break; }

    const inner = raw.slice(lt + 1, gt).trim();
    if (inner.startsWith("!")) { i = gt + 1; continue; } // kommentarer och doctype
    const closing = inner.startsWith("/");
    const tag = (closing ? inner.slice(1) : inner).split(/[\s/>]/, 1)[0]?.toLowerCase() ?? "";

    if (DROP_CONTENT.has(tag) && !closing) {
      const close = raw.toLowerCase().indexOf(`</${tag}`, gt);
      if (close === -1) break;
      const end = raw.indexOf(">", close);
      i = end === -1 ? raw.length : end + 1;
      continue;
    }

    if (PD_TAGS.has(tag)) {
      if (VOID.has(tag)) {
        out += `<${tag}>`;
      } else if (closing) {
        const at = open.lastIndexOf(tag);
        if (at !== -1) {
          for (let k = open.length - 1; k >= at; k--) out += `</${open[k]}>`;
          open.length = at;
        }
      } else {
        const attrs: string[] = [];
        for (const m of inner.slice(tag.length).matchAll(/([a-zA-Z-]+)\s*=\s*("([^"]*)"|'([^']*)'|([^\s"'>]+))/g)) {
          const name = m[1].toLowerCase();
          const value = m[3] ?? m[4] ?? m[5] ?? "";
          if (name === "class") {
            const c = cleanClass(value);
            if (c) attrs.push(`class="${c}"`);
          } else if (name === "href" && tag === "a") {
            const h = safeHref(value);
            if (h) attrs.push(`href="${encodeText(h).replace(/"/g, "&quot;")}"`);
          }
        }
        out += `<${tag}${attrs.length ? " " + attrs.join(" ") : ""}>`;
        open.push(tag);
      }
    }
    i = gt + 1;
  }
  for (let k = open.length - 1; k >= 0; k--) out += `</${open[k]}>`;
  return out;
}

/** Sant när HTML:en är skriven i den nya mallen. */
export const isPdHtml = (html: string) => /class\s*=\s*["'][^"']*\bgf-pd\b/.test(html ?? "");

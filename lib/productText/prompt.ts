// ─────────────────────────────────────────────────────────────
// Server-ägd promptkonstruktion för produkttexter.
//
// Samma princip som contentPrompt.ts: klienten skickar bara strukturerad
// produktdata, servern äger alla instruktioner. Företagskontexten kommer
// ur Company Brain server-side.
//
// Ingen branschlogik hårdkodas här. Ton, kunder och vanliga frågor kommer
// ur Company Brain, så samma kod fungerar för nästa butik.
// ─────────────────────────────────────────────────────────────
import type { CompanyBrainContext } from "@/app/_shared/companyBrain";
import { voiceBlock } from "@/lib/server/voice";

export const MAX_BATCH = 10;
export const MAX_FIELD_LEN = 4_000;

export interface ProductInput {
  id: string;
  name: string;
  group?: string;
  current?: string;
}

export interface GeneratedText {
  id: string;
  description: string;
}

const joinList = (v: string[] | undefined, n = 12): string =>
  (v ?? []).filter(Boolean).slice(0, n).join(", ");

export function buildSystemPrompt(ctx: CompanyBrainContext | null): string {
  const company = ctx
    ? `FÖRETAGET (ur Company Brain — bekräftade uppgifter, hitta inte på mer):
Sammanfattning: ${ctx.summary || "(okänt)"}
Kunder: ${joinList(ctx.audiences) || "(okänt)"}
Tonfall: ${joinList(ctx.tone) || "(okänt)"}
Styrkor: ${joinList(ctx.strengths) || "(okänt)"}
Det som skiljer oss: ${joinList(ctx.usps) || "(okänt)"}
Riktlinjer för innehåll: ${joinList(ctx.contentGuidelines) || "(inga angivna)"}
Påståenden som ALDRIG får användas: ${joinList(ctx.forbiddenClaims) || "(inga angivna)"}
Säsonger: ${joinList(ctx.seasons) || "(inga angivna)"}`
    : `FÖRETAGET: ingen företagsprofil finns ännu. Skriv neutralt och sakligt.`;

  return `Du skriver produktbeskrivningar för en svensk webbshop.

${company}

${voiceBlock({ variation: true })}

SPECIFIKT FÖR PRODUKTTEXTER
- 35–70 ord per produkt.
- Minst en mening ska svara på något kunden faktiskt undrar över enligt
  företagsprofilen.
- Är produktnamnet otydligt: skriv kortare hellre än att gissa detaljer.
- Ren text utan html-taggar och utan rubrik.

Svara med JSON: { "texts": [ { "id": "artikelnummer", "description": "texten" } ] }
Ett objekt per produkt du fått, med exakt samma id.`;
}

export function buildUserPrompt(products: ProductInput[]): string {
  const lines = products.map((p) => {
    const parts = [`id: ${p.id}`, `namn: ${p.name}`];
    if (p.group) parts.push(`produktgrupp: ${p.group}`);
    if (p.current && p.current.trim()) parts.push(`nuvarande text: ${p.current.trim()}`);
    return parts.join("\n");
  });
  return `Skriv en produktbeskrivning för var och en av följande ${products.length} produkter.\n\n${lines.join("\n\n---\n\n")}`;
}

/** Sanerar och begränsar klientens produktdata innan den når modellen. */
export function validateProducts(input: unknown): ProductInput[] | null {
  if (!Array.isArray(input) || input.length === 0 || input.length > MAX_BATCH) return null;
  const out: ProductInput[] = [];
  for (const raw of input) {
    if (!raw || typeof raw !== "object") return null;
    const o = raw as Record<string, unknown>;
    const id = typeof o.id === "string" ? o.id.trim() : "";
    const name = typeof o.name === "string" ? o.name.trim() : "";
    if (!id || !name) return null;
    if (id.length > 200 || name.length > MAX_FIELD_LEN) return null;
    const group = typeof o.group === "string" ? o.group.slice(0, 200) : undefined;
    const current = typeof o.current === "string" ? o.current.slice(0, MAX_FIELD_LEN) : undefined;
    out.push({ id, name, group, current });
  }
  return out;
}

/** Validerar modellens svar och behåller bara texter för produkter vi bett om. */
export function validateGenerated(parsed: unknown, asked: ProductInput[]): GeneratedText[] | null {
  if (!parsed || typeof parsed !== "object") return null;
  const list = (parsed as Record<string, unknown>).texts;
  if (!Array.isArray(list)) return null;

  const wanted = new Set(asked.map((p) => p.id));
  const out: GeneratedText[] = [];
  for (const raw of list) {
    if (!raw || typeof raw !== "object") continue;
    const o = raw as Record<string, unknown>;
    const id = typeof o.id === "string" ? o.id.trim() : "";
    const description = typeof o.description === "string" ? o.description.trim() : "";
    if (!wanted.has(id) || !description) continue;
    out.push({ id, description: description.replace(/<[^>]*>/g, "").slice(0, MAX_FIELD_LEN) });
  }
  return out.length > 0 ? out : null;
}

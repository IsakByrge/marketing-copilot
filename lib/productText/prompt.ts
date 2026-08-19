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
import { formatFacts, type FactsLookup } from "./productFacts";

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

export function buildSystemPrompt(ctx: CompanyBrainContext | null, editMemory = ""): string {
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

${editMemory}

SPECIFIKT FÖR PRODUKTTEXTER
- 35–70 ord per produkt.
- Minst en mening ska svara på något kunden faktiskt undrar över enligt
  företagsprofilen.
- Ren text utan html-taggar och utan rubrik.

UNDERLAG OCH SAKUPPGIFTER
Varje produkt levereras med ett block märkt UNDERLAG. Det är de enda
sakuppgifter du har. Du får omformulera och prioritera dem, men aldrig lägga
till egenskaper som inte står där.

Detta får ALDRIG skrivas om det inte står i UNDERLAG: material, mått, vikt,
volym, kapacitet, tryck, flöde, effekt, ventil- eller kopplingstyp, vilken
utrustning produkten passar till, certifieringar och standarder.

Står uppgiften i produktnamnet får den upprepas — namnet är verifierat. Saknas
en uppgift: utelämna den. Skriv hellre fyra korta meningar som stämmer än sju
som låter bra.

Undvik tomma påståenden som "passar perfekt för olika användningsområden".

Svara med JSON: { "texts": [ { "id": "artikelnummer", "description": "texten" } ] }
Ett objekt per produkt du fått, med exakt samma id.`;
}

export function buildUserPrompt(products: ProductInput[], lookup?: FactsLookup): string {
  const lines = products.map((p) => {
    const parts = [`id: ${p.id}`, `namn: ${p.name}`];
    if (p.group) parts.push(`produktgrupp: ${p.group}`);
    if (p.current && p.current.trim()) parts.push(`nuvarande text: ${p.current.trim()}`);

    const facts = lookup ? lookup(p.id) : null;
    const formatted = facts ? formatFacts(facts) : null;
    if (formatted) {
      parts.push(`UNDERLAG:\n${formatted}`);
    } else {
      parts.push(
        "UNDERLAG: saknas. Använd endast produktnamnet och produktgruppen. " +
        "Nämn inte material, mått, tryck, kopplingstyp eller vad produkten passar till.",
      );
    }
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
  const seenIds = new Set<string>();
  // Identisk text på olika artiklar betyder att modellen tappat bort vilken
  // produkt den skriver om — kassera dem hellre än att skriva fel text.
  const seenContent = new Set<string>();
  const normalize = (s: string) => s.toLowerCase().replace(/\s+/g, " ").trim();

  const out: GeneratedText[] = [];
  for (const raw of list) {
    if (!raw || typeof raw !== "object") continue;
    const o = raw as Record<string, unknown>;
    const id = typeof o.id === "string" ? o.id.trim() : "";
    const description = typeof o.description === "string" ? o.description.trim() : "";
    if (!wanted.has(id) || !description) continue;
    if (seenIds.has(id)) continue;

    const clean = description.replace(/<[^>]*>/g, "").slice(0, MAX_FIELD_LEN);
    const key = normalize(clean);
    if (seenContent.has(key)) continue;

    seenIds.add(id);
    seenContent.add(key);
    out.push({ id, description: clean });
  }
  return out.length > 0 ? out : null;
}

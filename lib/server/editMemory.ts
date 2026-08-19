// ─────────────────────────────────────────────────────────────
// Redigeringsminne — produktens enda riktiga röstinlärning.
//
// Skillnaden mellan vad modellen skrev och vad användaren faktiskt
// publicerade är den mest värdefulla datan i systemet. Här sparas den
// och formateras tillbaka in i prompten.
//
// Två medvetna begränsningar:
//   • Bara par där texten faktiskt ändrats sparas. En oförändrad text
//     är ingen signal, och skulle bara späda ut de riktiga exemplen.
//   • Bara de senaste paren används, och de trunkeras hårt. Prompten
//     ska styras av mönstret i ändringarna, inte dränkas i historik.
//
// Läsning och skrivning sker server-side via den cookie-bundna
// klienten, så RLS gäller och användaren härleds ur sessionen.
//
// Supabase-klienten importeras dynamiskt inuti funktionerna. Då kan de
// rena delarna (filtret och formateringen) testas fristående utan
// Next-kontext — de är också de enda delar som har logik värd att testa.
// ─────────────────────────────────────────────────────────────

export type EditKind = "product_text" | "facebook_post" | "newsletter" | "plan_post";

export interface EditPair {
  original: string;
  edited: string;
}

/** Antal par som skickas till modellen. Fler ger inte bättre röst, bara längre prompt. */
export const MAX_PAIRS = 8;

/** Hårt tak per text i prompten. Mönstret syns i början, inte i slutet. */
const MAX_CHARS = 600;

/** Under så här stor skillnad räknas ändringen som en petitess (stavfel, komma). */
const MIN_DISTANCE = 12;

const norm = (s: string) => s.replace(/\s+/g, " ").trim();

/**
 * Sant om skillnaden är stor nog att vara en signal om röst och inte bara
 * en rättstavning. Grov men tillräcklig: teckenlängdens skillnad plus
 * kravet att texterna inte är identiska efter normalisering.
 */
export function isMeaningfulEdit(original: string, edited: string): boolean {
  const a = norm(original);
  const b = norm(edited);
  if (!a || !b || a === b) return false;
  if (Math.abs(a.length - b.length) >= MIN_DISTANCE) return true;
  // Samma längd men annat innehåll — räkna hur många ord som bytts ut.
  const wa = new Set(a.toLowerCase().split(" "));
  const wb = b.toLowerCase().split(" ");
  const changed = wb.filter((w) => !wa.has(w)).length;
  return changed >= 3;
}

/** Sparar ett par. Tyst no-op när ändringen inte är meningsfull. */
export async function recordEdit(input: {
  kind: EditKind;
  original: string;
  edited: string;
  label?: string;
  companyId?: string;
}): Promise<void> {
  if (!isMeaningfulEdit(input.original, input.edited)) return;

  try {
    const { createClient } = await import("../supabase-server");
    const sb = await createClient();
    const { data: { user } } = await sb.auth.getUser();
    if (!user) return;

    await sb.from("text_edits").insert({
      user_id: user.id,
      company_id: input.companyId ?? null,
      kind: input.kind,
      original: input.original.slice(0, 4_000),
      edited: input.edited.slice(0, 4_000),
      label: input.label?.slice(0, 200) ?? null,
    });
  } catch (error) {
    // Minnet är en förbättring, aldrig en förutsättning. Ett misslyckande
    // får inte hindra användaren från att jobba.
    console.warn("EDIT_MEMORY_WRITE_FAILED:", error instanceof Error ? error.name : "UnknownError");
  }
}

/** Hämtar de senaste paren för en texttyp. Tom lista vid fel. */
export async function getEditPairs(kind: EditKind, limit = MAX_PAIRS): Promise<EditPair[]> {
  try {
    const { createClient } = await import("../supabase-server");
    const sb = await createClient();
    const { data: { user } } = await sb.auth.getUser();
    if (!user) return [];

    const { data } = await sb
      .from("text_edits")
      .select("original, edited")
      .eq("user_id", user.id)
      .eq("kind", kind)
      .order("created_at", { ascending: false })
      .limit(limit);

    return (data ?? [])
      .filter((r) => typeof r.original === "string" && typeof r.edited === "string")
      .map((r) => ({ original: r.original as string, edited: r.edited as string }));
  } catch (error) {
    console.warn("EDIT_MEMORY_READ_FAILED:", error instanceof Error ? error.name : "UnknownError");
    return [];
  }
}

/**
 * Formaterar paren till ett promptblock. Returnerar tom sträng när det
 * inte finns något att lära av — då ska prompten se ut precis som förut.
 *
 * Ordningen är äldst först, så det senaste ligger närmast instruktionen.
 */
export function formatEditPairs(pairs: EditPair[]): string {
  if (pairs.length === 0) return "";

  const clip = (s: string) => {
    const t = norm(s);
    return t.length > MAX_CHARS ? t.slice(0, MAX_CHARS) + "…" : t;
  };

  const examples = [...pairs].reverse().map((p, i) =>
    `${i + 1}. DU SKREV: ${clip(p.original)}\n   ANVÄNDAREN PUBLICERADE: ${clip(p.edited)}`,
  ).join("\n\n");

  return `SÅ HÄR BRUKAR ANVÄNDAREN ÄNDRA DINA TEXTER

Nedan är dina tidigare förslag och vad användaren faktiskt publicerade.
Läs dem som en beskrivning av hens röst: vad hen stryker, vad hen lägger
till, hur hen formulerar sig. Skriv den här gången så att texten redan
ligger nära hens version.

Kopiera aldrig innehållet ur exemplen — det gällde andra produkter och
andra tillfällen. Ta bara tonen, längden och sättet att formulera sig.

${examples}`;
}

/** Bekvämlighet: hämtar och formaterar i ett anrop. */
export async function editMemoryBlock(kind: EditKind): Promise<string> {
  return formatEditPairs(await getEditPairs(kind));
}

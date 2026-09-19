// ─────────────────────────────────────────────────────────────
// Tre mallar för produkttexter, och regeln som väljer mall.
//
// En kamin och en gängadapter behöver inte samma text. Mallen styr
// längd, struktur och ton — och framför allt att en reservdel INTE får
// säljretorik, bara exakt vad den passar till.
//
// Mappningen kategori → mall är medvetet en tabell i kod, inte en
// gissning: den ska gå att läsa, rätta och testa. Användaren kan alltid
// byta mall på en enskild artikel i listan.
//
// Ren logik, inga beroenden. Testas i pipeline.test.mts.
// ─────────────────────────────────────────────────────────────

export type TemplateId = "huvudprodukt" | "tillbehor" | "reservdel";

export interface Template {
  id: TemplateId;
  label: string;
  /** Kort beskrivning i gränssnittet. */
  summary: string;
  minWords: number;
  maxWords: number;
  /** Instruktionerna som läggs in i prompten för den här mallen. */
  instructions: string;
}

export const TEMPLATES: Record<TemplateId, Template> = {
  huvudprodukt: {
    id: "huvudprodukt",
    label: "Huvudprodukt",
    summary: "Kaminer, grillar, pizzaugnar, kylskåp. 250–400 ord.",
    // Huvudprodukterna är de dyra artiklarna. Verona (6 990 kr) blev 110 ord
    // på 150–300, och kunden som lägger sju tusen vill kunna läsa sig trygg.
    minWords: 250,
    maxWords: 400,
    instructions: `MALL: HUVUDPRODUKT (250–400 ord, längre om fakta kräver det)
Fyra delar, i den här ordningen. Ordantalen per del är mål, inte tak.
1. Vad produkten löser för kunden (80–120 ord, två stycken). Situationen
   den används i och vad den gör där, med underlagets egna uppgifter.
2. En punktlista med specifikationer: VARJE effekt, förbrukning, yta,
   mått, vikt, material och säkerhetsfunktion som står i UNDERLAG. Bara
   det som står där. Har du färre än två, skriv ingen lista alls.
3. Vad som är särskilt med den (130–180 ord, tre stycken). Material,
   konstruktion, funktioner, säkerhet, hur den tänds, styrs och drivs:
   det som skiljer den från en enklare modell. En sak per mening, och vad
   den betyder för kunden.
4. Vad som behövs till den och vad som inte ingår (50–90 ord). Flaskor,
   tillbehör, installation, ventilation, det som levereras utan.
Står det inte i UNDERLAG vad som behövs till eller inte ingår: skriv bara
det du vet och lägg resten i needsInfo. Fyll aldrig ut med allmänna
påståenden som inte står i underlaget. Skriv aldrig "kontakta oss för
mer information".`,
  },
  tillbehor: {
    id: "tillbehor",
    label: "Tillbehör",
    summary: "Adaptrar, hållare, slangar, kapell. 60–120 ord.",
    minWords: 60,
    maxWords: 120,
    instructions: `MALL: TILLBEHÖR (60–120 ord)
Ett eller två stycken som svarar på: vad det är, vad man använder det
till, vilka mått det har och vad det passar. Mått och passform bara om de
står i UNDERLAG — annars utelämna dem och lägg dem i needsInfo.
Punktlista bara om det finns tre eller fler mått att lista.`,
  },
  reservdel: {
    id: "reservdel",
    label: "Reservdel och koppling",
    summary: "Kopplingar, ventiler, packningar, delar. 30–80 ord.",
    minWords: 30,
    maxWords: 80,
    instructions: `MALL: RESERVDEL OCH KOPPLING (30–80 ord)
Ett kort stycke: vad delen gör, och exakt vad den passar till — gänga,
tryck, dimension. Ingen säljretorik. Inga ord som "smidig", "perfekt",
"kvalitet", "pålitlig", "hög standard". Ingen uppmaning att köpa.
Saknas gänga, tryck eller dimension i UNDERLAG: skriv INTE en allmän text
om att delen "passar de flesta system". Beskriv bara det du vet och lägg
resten i needsInfo.`,
  },
};

export const TEMPLATE_IDS = Object.keys(TEMPLATES) as TemplateId[];

export const isTemplateId = (v: unknown): v is TemplateId =>
  typeof v === "string" && v in TEMPLATES;

// ── Kategori → mall ─────────────────────────────────────────

/**
 * Nyckelord per mall, prövade i ordningen reservdel → huvudprodukt →
 * tillbehör. Reservdel går först med flit: gissar vi fel där får en
 * koppling säljretorik, vilket är värre än att en kamin får en kort text.
 */
const KEYWORDS: Array<{ template: TemplateId; words: string[] }> = [
  {
    template: "reservdel",
    words: [
      "reservdel", "koppling", "ventil", "packning", "nippel", "gänga", "ganga",
      "munstycke", "regulator", "slangbrottsventil", "säkerhetsventil", "o-ring",
      "tätning", "insats", "brännare", "termostat", "sond", "tändare", "spare part",
    ],
  },
  {
    template: "huvudprodukt",
    words: [
      "kamin", "grill", "pizzaugn", "ugn", "kylskåp", "kylskap", "kyl", "frys",
      "värmare", "varmare", "element", "spis", "aggregat", "panna", "gasolkök",
    ],
  },
  {
    template: "tillbehor",
    words: [
      "tillbehör", "tillbehor", "adapter", "hållare", "hallare", "slang", "kapell",
      "väska", "vaska", "skydd", "vagn", "rengöring", "rengoring", "sten", "galler",
    ],
  },
];

export interface TemplateSignals {
  category?: string;
  subCategory?: string;
  name?: string;
}

/**
 * Väljer mall utifrån kategori, underkategori och produktnamn — i den
 * ordningen, eftersom kategorin är satt av butiken och namnet av en
 * leverantör. Utan träff blir det tillbehör: den mellersta mallen gör
 * minst skada när vi gissar fel.
 */
export function pickTemplate(signals: TemplateSignals): TemplateId {
  const fields = [signals.category, signals.subCategory, signals.name]
    .map((v) => (v ?? "").toLowerCase());

  for (const field of fields) {
    if (!field) continue;
    for (const { template, words } of KEYWORDS) {
      if (words.some((w) => field.includes(w))) return template;
    }
  }
  return "tillbehor";
}

// ── Meta-fältens gränser ────────────────────────────────────

export const META_TITLE_MAX = 60;
export const META_DESCRIPTION_MAX = 155;

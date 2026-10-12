// ─────────────────────────────────────────────────────────────
// Produkttyper för den nya produktsidan (.gf-pd).
//
// Hämtat ur byggnoteringarna för produktsidemallen (Claude-mappen,
// Webbshop/Gasolkaminer produktsida design/Byggnoteringar):
//
//   "Kamin: 'Passar den dig?' (Passar för / Behöver med länk till
//    paketet / Tänk på från bruksanvisningen) … Koppling: 'Passar
//    detta?' i tre nivåer (Passar direkt / Kräver adapter / Passar
//    inte), vänstergänga-varning … Specifikationstabellen har samma
//    rader för alla produkter av samma typ."
//
// Typen avgör rubrikerna i rutan "Passar …?" och vilka rader
// specifikationstabellen har. Den avgörs av kategori och namn; en
// artikel som inte känns igen får den allmänna typen, som inte har
// några fasta rader.
//
// Ren modul. Testas i pd.test.mts.
// ─────────────────────────────────────────────────────────────

export type PdTypeId = "kamin" | "koppling" | "flaska" | "grill" | "allman";

export interface PdProfile {
  id: PdTypeId;
  label: string;
  /** Rubriken ovanför rutan med tre kolumner. */
  fitHeading: string;
  /** Rubrikerna i de tre kolumnerna: passar / behöver / passar inte eller tänk på. */
  fitLabels: { yes: string; add: string; no: string };
  /** Vad den tredje kolumnen ska innehålla, i modellens instruktion. */
  noMeans: string;
  /** Specifikationstabellens rader, i ordning. Tom = sidans egna rader. */
  specRows: string[];
  /** Dokument som hör till typen. Visas som saknade i granskningen. */
  documents: string[];
  /** Ska en varningsruta övervägas (t.ex. vänstergänga)? */
  noteHint?: string;
}

export const PD_PROFILES: Record<PdTypeId, PdProfile> = {
  kamin: {
    id: "kamin",
    label: "Kamin och värmare",
    fitHeading: "Passar den dig?",
    fitLabels: { yes: "Passar för", add: "Behöver", no: "Tänk på" },
    noMeans: "säkerhet och användning ur bruksanvisningen: ventilation, avstånd, var den inte får stå",
    specRows: ["Effekt", "Yta", "Förbrukning", "Tändning", "Fläkt", "Mått", "Vikt"],
    documents: ["Bruksanvisning", "CE-intyg"],
  },
  koppling: {
    id: "koppling",
    label: "Koppling och reservdel",
    fitHeading: "Passar detta?",
    fitLabels: { yes: "Passar direkt", add: "Kräver adapter", no: "Passar inte" },
    noMeans: "anslutningar och utrustning som produkten INTE passar till",
    specRows: ["Anslutning mot regulator", "Anslutning mot slang", "Material", "Max tryck", "Nyckelvidd", "Tätning", "Standard"],
    documents: ["Produktdatablad", "Monteringsanvisning", "CE-intyg"],
    noteHint: "Har kopplingen vänstergänga ska det stå i en varningsruta. Annars ingen ruta.",
  },
  flaska: {
    id: "flaska",
    label: "Gasolflaska",
    fitHeading: "Passar den dig?",
    fitLabels: { yes: "Passar för", add: "Behöver", no: "Tänk på" },
    noMeans: "förvaring, transport och hur flaskan fylls, ur underlaget",
    specRows: ["Gasmängd", "Material", "Mått", "Vikt tom", "Ventil", "Standard"],
    documents: ["Produktdatablad"],
  },
  grill: {
    id: "grill",
    label: "Grill, kök och pizzaugn",
    fitHeading: "Passar den dig?",
    fitLabels: { yes: "Passar för", add: "Behöver", no: "Tänk på" },
    noMeans: "säkerhet och användning ur bruksanvisningen",
    specRows: ["Effekt", "Antal brännare", "Yta", "Tändning", "Mått", "Vikt", "Anslutning"],
    documents: ["Bruksanvisning", "CE-intyg"],
  },
  allman: {
    id: "allman",
    label: "Övrigt",
    fitHeading: "Passar den dig?",
    fitLabels: { yes: "Passar för", add: "Behöver", no: "Tänk på" },
    noMeans: "det kunden bör känna till innan köp, ur underlaget",
    specRows: [],
    documents: [],
  },
};

const norm = (s: string) => (s ?? "").toLowerCase().normalize("NFD").replace(/\p{M}/gu, "");

/** Mönster i kategori och namn, i ordning. Första träffen vinner. */
const RULES: Array<[RegExp, PdTypeId]> = [
  [/(koppling|reservdel|regulator|slangsockel|slangkoppling|adapter|nippel|packning|kona|ventil|gangadapter|t-koppling|snabbkoppling|tankadapter|slangklamma)/, "koppling"],
  [/(kamin|varmare|varmekanon|infravarm|terrassvarm|ugnsvarm)/, "kamin"],
  [/(gasolflask|alugas|tankflask|flaska|engangsflask|komposit)/, "flaska"],
  [/(grill|pizzaugn|stekhall|gasolkok|wok|spis|brannare|kokplatt|kokpall)/, "grill"],
];

/**
 * Produkttypen för en artikel. Kategorin vägs först: en "Regulator" i
 * kategorin Kaminpaket är fortfarande ett paket, men i Kopplingar en
 * koppling. Namnet avgör när kategorin inte säger något.
 */
export function detectPdType(p: { name?: string; category?: string; subCategory?: string }): PdTypeId {
  const kategori = norm(`${p.category ?? ""} ${p.subCategory ?? ""}`);
  for (const [re, id] of RULES) if (re.test(kategori)) return id;
  const namn = norm(p.name ?? "");
  for (const [re, id] of RULES) if (re.test(namn)) return id;
  return "allman";
}

export const isPdType = (v: unknown): v is PdTypeId =>
  typeof v === "string" && Object.prototype.hasOwnProperty.call(PD_PROFILES, v);

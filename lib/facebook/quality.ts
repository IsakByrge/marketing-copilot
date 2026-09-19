// ─────────────────────────────────────────────────────────────
// Facebook Specialist — deterministiskt kvalitetslager (INGEN AI).
//
// Rena, testbara funktioner som körs efter modellen och äger de
// fakta en språkmodell inte får ha fel om:
//   1. detectCliches            — tydliga AI/reklamklichéer (hög precision)
//   2. detectFabricatedSocialProof — påhittade kund-/omdömesformuleringar
//   3. alternativeSimilarity / dedupeAlternatives — nästan identiska alternativ
//   4. deriveUserStatus         — 3-nivåers användarstatus + kort motivering
//   5. missingCampaignTerms     — produkt och erbjudande ur underlaget i texten
//   6. detectInventedUrgency    — brådska och knapphet som underlaget inte täcker
//
// Medvetet konservativt: listorna är kuraterade fraser med ordgräns,
// inte en bred blacklist. Målet är få falska träffar. Allt är
// `import type` för @/-modulerna så filen kan köras av en fristående
// testharness utan Next/Supabase.
// ─────────────────────────────────────────────────────────────
import type {
  FacebookPostVariant,
  FacebookQualityReview,
  FacebookLength,
} from "@/app/content/facebook/types";

/* ── 1. AI-klichédetektor ────────────────────────────────────
   Varje post är en tydlig, väldokumenterad AI/reklamkliché på
   svensk marknadsföringssvenska. Regexen har ordgräns och är
   flerordsfraser där det behövs för att undvika falska träffar.
   `hint` visas aldrig för slutanvändaren — den används i issues
   och för revisionsinstruktionen. */
export interface ClicheHit {
  phrase: string;
  hint: string;
}

const CLICHE_PATTERNS: { re: RegExp; label: string; hint: string }[] = [
  { re: /\binte bara\b[^.!?\n]{1,60}?\butan\b/i, label: "inte bara … utan …", hint: "Skriv om utan 'inte bara X – utan Y'-konstruktionen." },
  { re: /\bmer än bara\b/i, label: "mer än bara", hint: "Ta bort 'mer än bara'." },
  { re: /\bta (?:nästa|ditt|din|ert|er) steg\b/i, label: "ta nästa steg", hint: "Byt ut den generiska 'ta nästa steg'-frasen mot en konkret uppmaning." },
  { re: /\btill nästa nivå\b/i, label: "till nästa nivå", hint: "Undvik 'till nästa nivå'." },
  { re: /\bupptäck skillnaden\b/i, label: "upptäck skillnaden", hint: "Undvik 'upptäck skillnaden'." },
  { re: /\buppl(?:ev|eva) skillnaden\b/i, label: "upplev skillnaden", hint: "Undvik 'upplev skillnaden'." },
  { re: /\ben investering i (?:kvalitet|dig|din framtid|ditt|er framtid)\b/i, label: "en investering i kvalitet", hint: "Undvik 'en investering i …'-formuleringen." },
  { re: /\boavsett om\b/i, label: "oavsett om", hint: "Undvik den svepande 'oavsett om …'-inledningen." },
  { re: /\bi dagens\b[^.!?\n]{0,24}\b(?:värld|samhälle|marknad|digitala landskap)\b/i, label: "i dagens … värld", hint: "Ta bort 'i dagens snabba/digitala värld'." },
  { re: /\bskräddarsydda? lösning(?:ar|en)?\b/i, label: "skräddarsydda lösningar", hint: "Byt 'skräddarsydda lösningar' mot något konkret." },
  { re: /\bvi brinner för\b/i, label: "vi brinner för", hint: "Undvik 'vi brinner för'." },
  { re: /\bmöt(?:er|a) (?:dina|era|alla dina|alla era) behov\b/i, label: "möter dina behov", hint: "Undvik 'möter dina behov'." },
  { re: /\bperfekt för dig som\b/i, label: "perfekt för dig som", hint: "Undvik 'perfekt för dig som'." },
  { re: /\blåt oss hjälpa (?:dig|er)\b/i, label: "låt oss hjälpa dig", hint: "Undvik 'låt oss hjälpa dig'." },
  { re: /\bvi strävar (?:alltid )?efter\b/i, label: "vi strävar efter", hint: "Undvik 'vi strävar efter'." },
  { re: /\bi (?:en )?klass för sig\b/i, label: "i en klass för sig", hint: "Undvik 'i en klass för sig'." },
  { re: /\bdet bästa av (?:två|båda) världar\b/i, label: "det bästa av två världar", hint: "Undvik 'det bästa av två världar'." },
  { re: /\bnär det kommer till\b/i, label: "när det kommer till", hint: "Byt 'när det kommer till' mot rakare svenska." },
  { re: /\bsömlös[a-z]*\b/i, label: "sömlös", hint: "Undvik 'sömlös/sömlöst'." },
  { re: /\brevolutioner[a-z]*\b/i, label: "revolutionerar", hint: "Undvik 'revolutionera'." },
  { re: /\bgame[\s-]?changer\b/i, label: "game changer", hint: "Undvik 'game changer'." },
  // Tomt beröm: säger att erbjudandet är bra utan att säga vad det är.
  { re: /(?<![\p{L}])(?:fantastiskt|otroligt|grymt|superbra|fenomenalt|oslagbart) (?:erbjudande|pris|tillfälle)(?![\p{L}])/iu, label: "fantastiskt erbjudande", hint: "Ta bort tomt beröm som 'fantastiskt erbjudande' — skriv vad erbjudandet är." },
];

/** Hittar tydliga AI/reklamklichéer i en text. Returnerar unika träffar. */
export function detectCliches(text: string): ClicheHit[] {
  const hits: ClicheHit[] = [];
  const seen = new Set<string>();
  for (const p of CLICHE_PATTERNS) {
    if (p.re.test(text) && !seen.has(p.label)) {
      seen.add(p.label);
      hits.push({ phrase: p.label, hint: p.hint });
    }
  }
  return hits;
}

/* ── 2. Fabricerat social proof ──────────────────────────────
   Körs ENDAST när verifierat social proof saknas (verifiedCount = 0).
   Då är varje kund-/omdömes-/betygs-/popularitetsformulering per
   definition påhittad. Matchar konkreta fraser, inte enstaka ord som
   kan vara legitima. */
const SOCIAL_PROOF_PATTERNS: { re: RegExp; label: string }[] = [
  { re: /\b(?:en av )?(?:våra|vår[at]?) (?:trogna |nöjda )?kund(?:er)?\b/i, label: "påstående om egna kunder" },
  { re: /\bmånga (?:av (?:våra|era) )?kunder\b/i, label: "'många kunder'" },
  { re: /\bnöjda kunder\b/i, label: "'nöjda kunder'" },
  { re: /\ben kund (?:som )?(?:berättade|sa|säger|hörde|tyckte|delade)\b/i, label: "påhittat kundcitat" },
  { re: /\bkunder(?:na)? (?:säger|älskar|uppskattar|återkommer|återvänder|hyllar|rekommenderar)\b/i, label: "påstående om vad kunder säger" },
  { re: /\b(?:recension(?:er)?|omdöme[nt]?|kundomdöme[nt]?)\b/i, label: "recensioner/omdömen" },
  { re: /\b(?:\d[\d.,]*|fem|fyra)\s*(?:av\s*(?:5|fem))?\s*stjärn/i, label: "stjärnbetyg" },
  { re: /[★⭐]/, label: "stjärnsymbol" },
  { re: /\b(?:femstjärnig|topprankad|högst betyg|bästa betyg)\b/i, label: "betygspåstående" },
  { re: /\b(?:bäst i test|mest sålda|marknadsledande|prisbelönt|prisbelönad|utsedd till|utsedda till|kundernas favorit|vår[at]? mest populära)\b/i, label: "utmärkelse/popularitetspåstående" },
  { re: /\b(?:över|mer än|fler än)\s*\d[\d\s.,]*\s*(?:nöjda\s*)?(?:kunder|besökare|bokningar|följare|recensioner|omdömen|sålda exemplar)\b/i, label: "påhittad siffra om kunder/försäljning" },
  { re: /\b\d[\d\s.,]*\+?\s*(?:nöjda\s*)?(?:kunder|recensioner|omdömen)\b/i, label: "påhittat antal kunder/omdömen" },
];

export interface SocialProofHit {
  phrase: string;
}

/**
 * Fångar tydliga fabricerade kund-/social-proof-formuleringar.
 * Körs endast när `verifiedProofCount === 0`. När verifierat underlag
 * finns litar vi på granskaren i stället (undviker falska träffar på
 * legitima, underbyggda påståenden).
 */
export function detectFabricatedSocialProof(text: string, verifiedProofCount: number): SocialProofHit[] {
  if (verifiedProofCount > 0) return [];
  const hits: SocialProofHit[] = [];
  const seen = new Set<string>();
  for (const p of SOCIAL_PROOF_PATTERNS) {
    if (p.re.test(text) && !seen.has(p.label)) {
      seen.add(p.label);
      hits.push({ phrase: p.label });
    }
  }
  return hits;
}

/* ── 3. Alternativens variation ──────────────────────────────
   Enkel, förklarbar likhet: Jaccard över innehållsord (≥3 tecken).
   Genuint olika vinklar ligger typiskt 0.2–0.45; nästan identiska
   omskrivningar 0.6+. Vi flaggar ≥ THRESHOLD eller identisk första
   mening. Ingen semantisk infrastruktur, ingen embedding. */
const SIMILARITY_THRESHOLD = 0.55;

const STOPWORDS = new Set([
  "och", "att", "det", "som", "för", "med", "den", "har", "till", "ett", "kan",
  "vi", "du", "din", "ditt", "dina", "er", "ert", "era", "på", "av", "en", "är",
  "om", "så", "men", "eller", "här", "när", "vår", "våra", "hos", "från", "inte",
]);

function contentTokens(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-zA-ZåäöÅÄÖ0-9\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length >= 3 && !STOPWORDS.has(w));
}

function firstSentence(text: string): string {
  const m = text.trim().match(/^[^.!?\n]+/);
  return (m ? m[0] : text).toLowerCase().replace(/\s+/g, " ").trim();
}

/** Jaccard-likhet (0–1) över innehållsord. */
export function alternativeSimilarity(a: string, b: string): number {
  const sa = new Set(contentTokens(a));
  const sb = new Set(contentTokens(b));
  if (sa.size === 0 || sb.size === 0) return 0;
  let inter = 0;
  for (const t of sa) if (sb.has(t)) inter++;
  const union = sa.size + sb.size - inter;
  return union === 0 ? 0 : inter / union;
}

function tooSimilar(a: string, b: string): boolean {
  if (alternativeSimilarity(a, b) >= SIMILARITY_THRESHOLD) return true;
  const fa = firstSentence(a);
  const fb = firstSentence(b);
  return fa.length > 12 && fa === fb;
}

export interface DedupeResult {
  kept: FacebookPostVariant[];
  dropped: number;
}

/**
 * Släpper alternativ som är för lika primären eller ett redan behållet
 * alternativ. Bevarar ordningen. Returnerar antal borttagna för telemetri.
 */
export function dedupeAlternatives(primary: FacebookPostVariant, alternatives: FacebookPostVariant[]): DedupeResult {
  const kept: FacebookPostVariant[] = [];
  let dropped = 0;
  for (const alt of alternatives) {
    const clash =
      tooSimilar(alt.postText, primary.postText) ||
      kept.some((k) => tooSimilar(alt.postText, k.postText));
    if (clash) { dropped++; continue; }
    kept.push(alt);
  }
  return { kept, dropped };
}

/* ── 4. Användarstatus (3 nivåer) ────────────────────────────
   Härleds ur granskningen + de deterministiska flaggorna. Det interna
   poänget behålls för felsökning men är aldrig den primära signalen. */
export type UserStatus = "ready" | "review" | "incomplete";

export interface UserStatusResult {
  userStatus: UserStatus;
  statusReason: string;
}

export interface StatusFlags {
  fabricatedSocialProof: boolean;
  forbiddenClaim: boolean;
  clicheCount: number;
  /** Produkt eller erbjudande ur underlaget som inte står i texten. */
  missingCampaignTerms: string[];
  /** Brådska eller knapphet i texten som underlaget inte täcker. */
  inventedUrgency: string[];
}

const READY_LABEL = "Publiceringsklar";
const REVIEW_LABEL = "Behöver granskas";
const INCOMPLETE_LABEL = "Behöver kompletteras";

export const USER_STATUS_LABEL: Record<UserStatus, string> = {
  ready: READY_LABEL,
  review: REVIEW_LABEL,
  incomplete: INCOMPLETE_LABEL,
};

/**
 * Avgör den användarvänliga huvudstatusen.
 * - incomplete: granskaren blockerade (avgörande underlag/fakta går inte att bekräfta).
 * - ready:      granskaren klar OCH inga fabricerade fakta/social proof OCH trovärdig.
 * - review:     texten är användbar men något bör kontrolleras.
 */
export function deriveUserStatus(review: FacebookQualityReview, flags: StatusFlags): UserStatusResult {
  const c = review.checks;

  if (review.status === "blocked") {
    return {
      userStatus: "incomplete",
      statusReason: "Det saknas avgörande underlag som inte går att bekräfta — komplettera och skapa på nytt.",
    };
  }

  const trustworthy =
    c.credibleClaims &&
    c.noForbiddenClaims &&
    c.noInventedUrgency &&
    !flags.fabricatedSocialProof &&
    !flags.forbiddenClaim &&
    flags.inventedUrgency.length === 0;

  const readyCore =
    review.status === "ready" &&
    trustworthy &&
    c.clearCTA &&
    c.clearCustomerValue &&
    c.appropriateLength &&
    c.mentionsProductAndOffer &&
    flags.missingCampaignTerms.length === 0 &&
    flags.clicheCount === 0;

  if (readyCore) {
    return {
      userStatus: "ready",
      statusReason: "Budskap, fakta och CTA stämmer mot underlaget.",
    };
  }

  // Allt övrigt: texten finns och går att använda, men något bör ses över.
  return { userStatus: "review", statusReason: buildReviewReason(review, flags) };
}

function buildReviewReason(review: FacebookQualityReview, flags: StatusFlags): string {
  if (flags.fabricatedSocialProof) return "Ta bort eller verifiera påståenden om kunder/omdömen före publicering.";
  if (flags.forbiddenClaim) return "Texten rör ett påstående företaget inte vill göra — justera före publicering.";
  if (flags.inventedUrgency.length) {
    return `Ta bort ${flags.inventedUrgency.map((t) => `"${t}"`).join(" och ")} — underlaget säger inget om att erbjudandet tar slut.`;
  }
  if (flags.missingCampaignTerms.length) {
    return `Texten nämner inte ${flags.missingCampaignTerms.map((t) => `"${t}"`).join(" eller ")} — lägg till det före publicering.`;
  }
  if (!review.checks.appropriateLength) return "Kontrollera längden mot vald nivå före publicering.";
  if (flags.clicheCount > 0) return "Putsa ett par formuleringar som låter lite generiska.";
  if (review.issues.length) return `Kontrollera före publicering: ${review.issues[0].replace(/\.$/, "")}.`;
  return "Texten är användbar — läs igenom en gång före publicering.";
}

/* ── Längdintervall (delas med specialisten) ─────────────────── */
export const LENGTH_RANGE: Record<FacebookLength, { min: number; max: number }> = {
  short: { min: 45, max: 110 },
  normal: { min: 95, max: 230 },
  detailed: { min: 170, max: 360 },
};

export function wordCount(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

/* ── 5. Produkt och erbjudande i texten ──────────────────────
   Buggen "20 % på Mustang": huvudtexten nämnde varken produkt eller
   rabatt, medan båda alternativen gjorde det. Huvudtexten skrevs om
   efter granskningen, och omskrivningsprompten saknade uppdraget.
   Den här kontrollen ser till att det aldrig händer tyst igen: när
   underlaget har en produkt eller ett erbjudande ska det stå i texten. */

export interface CampaignTerms {
  /** Produktens namn: vald produkt i första hand, annars "vad som marknadsförs". */
  product?: string;
  /** Erbjudandet ur uppdraget, annars ur kampanjstrategin. */
  offer?: string;
}

const lower = (s: string) => s.toLowerCase().replace(/\p{Pd}/gu, "-").replace(/\s+/g, " ").trim();
const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\/]/g, "\\$&");

/**
 * Står namnet ordagrant i texten? Skiftläge spelar ingen roll, bindestreck
 * och mellanslag är utbytbara, och sista ordet får böjas: "Mustang
 * gasolgrillen" räknas för "Mustang gasolgrill". Namn på fler än fyra ord
 * är en beskrivning, inte ett namn, och kan inte krävas ordagrant: `null`.
 */
export function nameMentioned(text: string, name: string): boolean | null {
  const words = lower(name).split(/[\s-]+/).filter(Boolean);
  if (words.length === 0 || words.length > 4) return null;
  const pattern = words.map(esc).join("[\\s-]+");
  return new RegExp(`(?<![\\p{L}\\p{N}])${pattern}`, "u").test(lower(text));
}

/** Enheter som följer ett tal i ett erbjudande, och hur de får skrivas i texten. */
const OFFER_UNITS: Array<{ re: RegExp; written: string }> = [
  { re: /^(?:%|procent)$/i, written: "(?:%|procent)" },
  { re: /^(?:kr|kronor|:-)$/i, written: "(?:kr|kronor|:-)" },
];

/**
 * Står erbjudandet i texten? Har erbjudandet tal ska varje tal stå där med
 * samma enhet: "20 %" räknas som "20%" och "20 procent", "500 kr" som
 * "500 kronor". Har det inga tal krävs frasen ordagrant som ett namn.
 */
export function offerMentioned(text: string, offer: string): boolean | null {
  const numbers = [...offer.matchAll(/(\d+(?:[.,]\d+)?)\s*(%|procent|kronor|kr|:-)?/gi)];
  if (numbers.length === 0) return nameMentioned(text, offer);
  const hay = lower(text);
  return numbers.every(([, n, unit]) => {
    const num = esc(n).replace(/[.,]/g, "[.,]");
    const written = unit ? OFFER_UNITS.find((u) => u.re.test(unit))?.written ?? esc(unit) : "";
    return new RegExp(`(?<![\\d.,])${num}(?![\\d])${written ? `\\s*${written}` : ""}`, "iu").test(hay);
  });
}

/** Produkt och erbjudande som saknas i texten, som de står i underlaget. */
export function missingCampaignTerms(text: string, terms: CampaignTerms): string[] {
  const missing: string[] = [];
  if (terms.product?.trim() && nameMentioned(text, terms.product) === false) missing.push(terms.product.trim());
  if (terms.offer?.trim() && offerMentioned(text, terms.offer) === false) missing.push(terms.offer.trim());
  return missing;
}

/* ── 6. Påhittad brådska ─────────────────────────────────────
   "Innan erbjudandet tar slut" i ett inlägg om "20 % på Mustang" antydde
   en deadline som inte fanns. Brådska är ett påstående om fakta: att
   något tar slut, att tiden är begränsad, att lagret är litet. Står det
   inte i underlaget är det påhittat, precis som ett påhittat omdöme.

   Två slag:
   - tid: tillåten när underlaget har ett sista datum
   - knapphet (lager, antal): tillåten bara när underlaget självt talar
     om lager eller begränsat antal
   Ordgränser med \p{L}, eftersom \b inte känner igen å, ä och ö. */

export interface UrgencyHit {
  phrase: string;
  kind: "tid" | "knapphet";
}

const B = "(?<![\\p{L}\\p{N}])";
const E = "(?![\\p{L}\\p{N}])";
const urgency = (src: string) => new RegExp(`${B}${src}${E}`, "iu");

const URGENCY_PATTERNS: Array<{ re: RegExp; label: string; kind: UrgencyHit["kind"] }> = [
  { re: urgency("innan (?:erbjudandet|kampanjen|rabatten|priset|det) (?:tar slut|går ut|försvinner|är över)"), label: "innan erbjudandet tar slut", kind: "tid" },
  { re: urgency("innan det är för sent"), label: "innan det är för sent", kind: "tid" },
  { re: urgency("sista chansen"), label: "sista chansen", kind: "tid" },
  { re: urgency("missa inte"), label: "missa inte", kind: "tid" },
  { re: urgency("passa på"), label: "passa på", kind: "tid" },
  { re: urgency("skynda(?: dig| er| på)?"), label: "skynda dig", kind: "tid" },
  { re: urgency("nu eller aldrig"), label: "nu eller aldrig", kind: "tid" },
  { re: urgency("(?:bara|endast|enbart) (?:idag|i dag|ikväll|i kväll|i helgen|den här veckan|denna vecka|under en kort tid|en kort tid|för en kort tid)"), label: "bara idag", kind: "tid" },
  { re: urgency("(?:tidsbegränsat|begränsad tid|under begränsad tid)"), label: "begränsad tid", kind: "tid" },
  { re: urgency("(?:gäller|pågår) (?:bara|endast) (?:en kort tid|några dagar|ett tag)"), label: "gäller bara en kort tid", kind: "tid" },
  { re: urgency("(?:så länge|medan) (?:lagret|förrådet|varorna|det finns kvar) räcker"), label: "så länge lagret räcker", kind: "knapphet" },
  { re: urgency("(?:begränsat|begränsad) (?:antal|lager|upplaga)"), label: "begränsat antal", kind: "knapphet" },
  { re: urgency("(?:snart|nästan) (?:slut|slutsåld|slutsålda|borta)"), label: "snart slut", kind: "knapphet" },
  { re: urgency("få (?:exemplar|kvar)"), label: "få kvar", kind: "knapphet" },
];

/** Vad underlaget faktiskt säger om tid och knapphet. */
export interface UrgencyBasis {
  /** Sista datum ur uppdraget. Finns det får tidsbrådska nämnas. */
  deadline?: string;
  /** Uppdragets egna ord: erbjudande, pris och noteringar. Nämner de lager
   *  eller ett begränsat antal får knapphet nämnas. */
  briefText?: string;
}

// "lagret" innehåller inte "lager", därför båda formerna.
const SCARCITY_IN_BRIEF = /lager|lagret|begräns|antal|exemplar|slut/i;

/**
 * Brådska i texten som underlaget inte täcker. Tom lista = inget påhittat.
 * Tid kräver ett sista datum i underlaget, knapphet kräver att underlaget
 * självt talar om lager eller antal.
 */
export function detectInventedUrgency(text: string, basis: UrgencyBasis): UrgencyHit[] {
  const timeAllowed = Boolean(basis.deadline?.trim());
  const scarcityAllowed = SCARCITY_IN_BRIEF.test(basis.briefText ?? "");
  const hits: UrgencyHit[] = [];
  const seen = new Set<string>();
  for (const p of URGENCY_PATTERNS) {
    if (p.kind === "tid" && timeAllowed) continue;
    if (p.kind === "knapphet" && scarcityAllowed) continue;
    if (p.re.test(text) && !seen.has(p.label)) {
      seen.add(p.label);
      hits.push({ phrase: p.label, kind: p.kind });
    }
  }
  return hits;
}

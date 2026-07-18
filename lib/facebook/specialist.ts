// ─────────────────────────────────────────────────────────────
// Content Engine 1.0 — Facebook Specialist (server-only motor)
//
// Tvåstegs produktionsflöde:
//   Steg A  — Specialisten skriver ett strukturerat utkast.
//   Steg B  — En kvalitetsgranskare bedömer utkastet.
//   (valfritt) EN automatisk revision om granskaren kräver det.
//
// Max 3 modellanrop per generering (draft + review + ev. 1 revision).
// Ingen loop, ingen re-review. Intern chain-of-thought efterfrågas
// aldrig, lagras aldrig, visas aldrig — granskaren returnerar bara
// kriterier, problem och en revisionsinstruktion.
//
// SJÄLVFÖRSÖRJANDE MED FLIT: enda runtime-importen är `openai`.
// Alla typ-importer är `import type` (raderas vid körning) så att
// motorn kan köras direkt av en fristående testharness utan Next-
// eller Supabase-kontext. Prompt-byggande sker här; validering av
// briefen och de delade typerna ligger i app/content/facebook/types.ts.
// ─────────────────────────────────────────────────────────────
import OpenAI from "openai";
import type {
  FacebookBrief,
  FacebookSpecialistContext,
  FacebookSpecialistResult,
  FacebookPostVariant,
  FacebookQualityReview,
  FacebookQualityChecks,
  FacebookBlockedResponse,
  FacebookLength,
} from "@/app/content/facebook/types";
import {
  detectCliches,
  detectFabricatedSocialProof,
  dedupeAlternatives,
  deriveUserStatus,
  wordCount as wc,
  LENGTH_RANGE,
  type StatusFlags,
} from "./quality";

/* ── Modell- & kostnadskonfiguration (server-side, via env) ──
   Utkast: kvalitetsmodell. Granskning: billig modell. Båda kan
   bytas utan kodändring. Defaults valda för kvalitet utan onödig
   kostnad — se sprintens kostnadsredovisning. */
export const FB_MODELS = {
  draft: process.env.FACEBOOK_DRAFT_MODEL || "gpt-4o",
  review: process.env.FACEBOOK_REVIEW_MODEL || "gpt-4o-mini",
} as const;

export const FB_TIMEOUT_MS = Number(process.env.FACEBOOK_TIMEOUT_MS) || 45_000;

export type FacebookPhase = "reading" | "drafting" | "reviewing" | "revising" | "done";

export interface RunMeta {
  calls: number;
  revised: boolean;
  models: { draft: string; review: string };
  usage: { promptTokens: number; completionTokens: number };
  ms: number;
  /** Antal alternativ som togs bort (för lika eller fabricerat social proof). */
  alternativesDropped: number;
  /** Antal tydliga AI-klichéer i den slutliga primärtexten. */
  clichesFound: number;
  /** Antal verifierade social proof-punkter som fanns tillgängliga. */
  verifiedSocialProofCount: number;
}

export interface RunOutput {
  result: FacebookSpecialistResult;
  meta: RunMeta;
}

interface RunOptions {
  emit?: (phase: FacebookPhase) => void;
  signal?: AbortSignal;
  requestId?: string;
}

/* ── Deterministisk gate: avgörande information saknas ───────
   Ställer EXAKT en konkret följdfråga (inte en fellista) och
   genererar ingenting. Ordningen speglar vad som mest sänker
   kvaliteten om det saknas. */
export function criticalFollowUp(brief: FacebookBrief): FacebookBlockedResponse | null {
  const missing: string[] = [];
  let question = "";

  if (!brief.productOrTopic.trim()) {
    missing.push("Vad som marknadsförs");
    question = "Vad är det du vill lyfta fram i inlägget — vilken produkt, tjänst eller nyhet?";
  } else if (!brief.desiredAction.trim()) {
    missing.push("Vad läsaren ska göra");
    question = "Jag behöver veta vad läsaren ska göra efter att ha sett inlägget. Ska de besöka butiken, köpa online eller kontakta er?";
  } else if (!brief.audience.trim()) {
    missing.push("Vem inlägget riktar sig till");
    question = "Vem vill du nå med det här inlägget? Beskriv kort din typiska kund.";
  }

  if (!question) return null;
  return { status: "blocked", question, missingInformation: missing };
}

/* ── Prompt-facing guidning (skild från UI-etiketterna) ───── */
const GOAL_GUIDANCE: Record<string, string> = {
  sell: "Driva försäljning av en specifik produkt/tjänst. Gör värdet och nästa steg glasklart.",
  traffic: "Få läsaren att klicka vidare (webb, sida, länk). Skapa nyfikenhet som betalar av på klicket.",
  leads: "Få läsaren att höra av sig för offert/kontakt. Sänk tröskeln och bygg förtroende.",
  store_visits: "Få läsaren att besöka den fysiska platsen. Gör det lokalt och konkret.",
  inform: "Informera tydligt utan säljhets. Relevans och läsbarhet framför allt.",
  launch: "Introducera något nytt. Förklara vad som är nytt och varför det spelar roll för kunden.",
  engagement: "Bjud in till reaktion/samtal på ett äkta sätt — aldrig tomt 'tagga en vän'-trick.",
  other: "Följ användarens egen beskrivning i noteringen.",
};

const ANGLE_GUIDANCE: Record<string, string> = {
  customer_value: "Kundnytta — vad kunden faktiskt får ut, inte produktegenskaper i sig.",
  problem_solution: "Problem och lösning — börja i kundens situation, landa i lösningen.",
  quality: "Produktkvalitet — hantverk, material, hållbarhet, omsorg. Konkret, inte tomma superlativ.",
  local_service: "Lokal service — närhet, personligt bemötande, att ni finns på orten.",
  urgency: "Brådska — äkta tidsskäl (säsong, deadline, begränsat). Aldrig påhittad panik.",
  social_proof: "Socialt bevis — förtroende genom att andra redan valt er. Hitta ALDRIG på omdömen/siffror.",
  behind_the_scenes: "Bakom kulisserna — visa människorna och arbetet. Bygger relation.",
  specialist_recommendation: "Du väljer själv den vinkel som passar mål, produkt och målgrupp bäst.",
};

const LENGTH_GUIDANCE: Record<FacebookLength, string> = {
  short: "KORT: ungefär 50–100 ord. Komprimerat men fortfarande ett helt inlägg — aldrig tre lösryckta meningar.",
  normal: "NORMAL: ungefär 100–220 ord. Utvecklat nog att kommunicera ett verkligt värde. Aldrig tre korta meningar.",
  detailed: "UTFÖRLIG: ungefär 180–350 ord. Ge plats åt kontext, kundnytta och invändningshantering — men inget fyll.",
};

/* ── Systemprompt: utkast ────────────────────────────────── */
const DRAFT_SYSTEM = `Du är en erfaren svensk marknadsförare som skriver organiska Facebook-inlägg åt riktiga svenska företag — inlägg företaget kan publicera direkt eller efter en liten justering. Du skriver som en skicklig människa som känner företaget, inte som en generell AI och inte som en amerikansk reklambyrå översatt till svenska.

COPYPRINCIPER (följ dem, lista dem aldrig):
1. Börja konkret — i en situation, en observation eller en rak fördel, inte i en lång ingress.
2. Skriv för ett socialt flöde, inte som en produktbroschyr.
3. Korta stycken. Blankrad mellan. Lätt att läsa på mobil.
4. Variera meningslängden naturligt — inte bara korta, inte bara långa.
5. En tydlig huvudidé per inlägg. Försök inte säga allt.
6. Idiomatisk svenska. Läs meningen högt i huvudet — låter den uppstyltad, skriv om den.
7. Förklara inte sånt målgruppen redan förstår.
8. Håll igen på säljretoriken. Ett lugnt, konkret påstående övertygar mer än tre superlativ.
9. CTA:n ska vara naturlig och kopplad till kampanjens verkliga mål — inte en påklistrad slutkläm.
10. Hitta ALDRIG på brådska, knapphet, rabatt, garanti, resultat, priser eller popularitet.

HOOK: En stark hook är inte alltid en fråga. Välj den hooktyp som passar: konkret situation, observation, ett relevant problem, en tydlig nyhet, en rak produktfördel, en säsongsanknytning, en kontrast — eller en fråga när frågan faktiskt passar. Undvik clickbait och konstlad dramatik. De två alternativen bör helst inte alla ha samma hooktyp.

UNDVIK dessa och liknande AI/reklamklichéer helt: "inte bara X – utan Y", "mer än bara", "ta nästa steg", "till nästa nivå", "upptäck/upplev skillnaden", "en investering i kvalitet", "oavsett om", "i dagens snabba/digitala värld", "skräddarsydda lösningar", "vi brinner för", "möter dina behov", "perfekt för dig som", "låt oss hjälpa dig", "vi strävar efter", "sömlös", "när det kommer till". Undvik också överdrivet många adjektiv, generiska superlativ, onödig upprepning av produkt- eller företagsnamnet och långa ingressliknande öppningar.

SOCIALT BEVIS — STRIKT REGEL: Du får ENDAST åberopa kunder, kundcitat, recensioner, omdömen, betyg, försäljningssiffror, antal kunder, popularitet, tester eller utmärkelser om det finns uttryckligt underlag i fältet VERIFIERAT SOCIALT BEVIS. Saknas det fältet eller är det tomt: skriv INGENTING om att kunder tycker/säger/återkommer, inga "många kunder", inga "nöjda kunder", inga siffror om kunder, inga omdömen. Hitta då aldrig på en kundberättelse och döp aldrig ett alternativ till "Kundberättelse". Välj i stället en annan vinkel: användningssituation, problem/lösning, produktfokus, expertråd, bakom produkten, säsong eller praktisk nytta.

DU GÖR ALDRIG:
- Hittar på kundresultat, omdömen, garantier, priser, siffror eller produktfakta som inte står i underlaget.
- Lovar försäljnings- eller behandlingsresultat.
- Skriver något som strider mot företagets förbjudna påståenden (forbiddenClaims).
- Skriver generiska öppningar ("Sommaren är här!") om de inte görs konkret företagsspecifika.
- Levererar korta rubrikfragment som om de vore ett färdigt inlägg.

FORMAT: 0–4 relevanta emojis beroende på tonalitet (inga dekorativa emoji-rader). Normalt 0–3 hashtags, endast om de tillför värde — tom lista är helt okej.

VINKLAR: Du får en önskad vinkel. Är den "Specialistens rekommendation" väljer du själv bäst vinkel utifrån mål, produkt och målgrupp och motiverar kort. Primärversionen använder den rekommenderade vinkeln. De TVÅ alternativen ska vara GENUINT olika primären och varandra — de ska skilja sig i minst TVÅ av: strategisk vinkel, hooktyp, disposition, argumentationsordning, CTA-formulering, grad av produktfokus eller tonläge inom den valda tonaliteten. De får inte vara samma text med ny första mening, synonymbyten eller omkastade stycken. Alternativets "label" ska beskriva den verkliga vinkeln (t.ex. "Praktisk nytta", "Expertråd", "Produktfokus", "Säsongsvinkel", "Problem och lösning", "Bakom produkten").

Om något viktigt saknas: gissa inte. Lägg en kort, ärlig notering i "assumptions" (antaganden du var tvungen att göra) eller "missingInformation" (uppgifter som skulle höjt kvaliteten). Presentera aldrig osäkra uppgifter som fakta.

BILDBRIEF: För varje variant, beskriv en enkel, realistisk bildidé (concept, subject, composition), ev. textOverlay, och en kort "avoid"-lista (t.ex. stockfoto-känsla, orealistiska löften).

Svara med ENDAST giltig JSON enligt schemat — ingen förtext, inga backticks, ingen förklaring utanför JSON. Skriv aldrig ut ditt resonemang.

JSON-schema:
{
  "recommendedAngle": "<vinkelns svenska namn>",
  "angleReason": "1 mening om varför vinkeln passar",
  "primary":      <VARIANT>,
  "alternatives": [ <VARIANT>, <VARIANT> ],
  "assumptions": ["..."],
  "missingInformation": ["..."]
}
VARIANT = {
  "id": "kort-slug",
  "label": "kort etikett för varianten",
  "angle": "vinkelns svenska namn",
  "postText": "hela inläggstexten med radbrytningar (\\n)",
  "callToAction": "uppmaningen som en mening",
  "imageBrief": { "concept": "...", "subject": "...", "composition": "...", "textOverlay": "valfritt", "avoid": ["..."] },
  "hashtags": ["utaninledande#", "..."]
}
"assumptions" och "missingInformation" ska vara tomma listor när inget behövs.`;

/* ── Systemprompt: kvalitetsgranskare ────────────────────── */
const REVIEW_SYSTEM = `Du är en kritisk svensk kvalitetsgranskare för organiska Facebook-inlägg. Du får ett företags underlag och ett föreslaget inlägg. Din enda uppgift är att bedöma om inlägget är publicerbart som det är.

Bedöm primärversionen mot:
- companySpecific: känns skrivet för DET HÄR företaget, inte en mall.
- audienceSpecific: talar tydligt till den angivna målgruppen.
- clearHook: fångar uppmärksamhet utan clickbait.
- clearCustomerValue: kundnyttan är tydlig.
- credibleClaims: inga påhittade resultat/priser/omdömen/garantier.
- correctTone: matchar företagets tonalitet.
- clearCTA: en tydlig och rimlig nästa handling.
- appropriateLength: rimlig längd för vald nivå (aldrig tre korta meningar när normal/utförlig valts).
- readableFormatting: radbrytningar, rimlig emoji-/hashtagnivå.
- noForbiddenClaims: bryter inte mot företagets forbiddenClaims.
- naturalSwedish: låter som en skicklig svensk marknadsförare, INTE som generell AI. Sätt false om texten innehåller AI/reklamklichéer ("inte bara X utan Y", "ta nästa steg", "i dagens snabba värld", "skräddarsydda lösningar", "vi brinner för" osv.), uppstyltade meningar, för många superlativ eller en lång ingressliknande öppning.
- honestSocialProof: sätt false om texten påstår något om kunder, kundcitat, recensioner, omdömen, betyg, siffror, popularitet eller utmärkelser UTAN att det finns täckning i VERIFIERAT SOCIALT BEVIS. Fabricerat eller obestyrkt social proof är ett ALLVARLIGT fel.

status:
- "ready" om inlägget kan publiceras direkt eller efter en trivial puts.
- "needs_revision" om det går att rädda med EN riktad förbättring — ge då en konkret "revisionSummary" (vad som ska ändras, inte hur du tänker). Fabricerat social proof och tydliga AI-klichéer ska alltid ge minst "needs_revision".
- "blocked" ENDAST om texten bygger på uppgifter som inte får bekräftas (påhittade fakta/social proof) och inte kan räddas utan mer information.

Svara med ENDAST giltig JSON. Skriv aldrig ut ditt resonemang.
{
  "status": "ready" | "needs_revision" | "blocked",
  "overallScore": 0-100,
  "checks": { "companySpecific": bool, "audienceSpecific": bool, "clearHook": bool, "clearCustomerValue": bool, "credibleClaims": bool, "correctTone": bool, "clearCTA": bool, "appropriateLength": bool, "readableFormatting": bool, "noForbiddenClaims": bool, "naturalSwedish": bool, "honestSocialProof": bool },
  "issues": ["kort konkret problem", "..."],
  "revisionSummary": "konkret instruktion om status = needs_revision, annars utelämnad"
}`;

/* ── Prompt-byggare ──────────────────────────────────────── */
function contextBlock(ctx: FacebookSpecialistContext): string {
  const c = ctx.company;
  const lines: string[] = [];
  lines.push(`FÖRETAG:\nÖversikt: ${c.summary || "(saknas)"}`);
  if (c.audiences.length) lines.push(`Målgrupper: ${c.audiences.join("; ")}`);
  if (c.strengths.length) lines.push(`Styrkor: ${c.strengths.join("; ")}`);
  if (c.usps.length) lines.push(`USP:ar: ${c.usps.join("; ")}`);
  lines.push(`Tonalitet: ${c.tone || "(ej angiven)"}`);
  if (c.contentGuidelines.length) lines.push(`Innehållsregler: ${c.contentGuidelines.join("; ")}`);
  if (c.preferredCallsToAction.length) lines.push(`Föredragna CTA: ${c.preferredCallsToAction.join("; ")}`);
  lines.push(`FÖRBJUDNA PÅSTÅENDEN (använd ALDRIG): ${c.forbiddenClaims.length ? c.forbiddenClaims.join("; ") : "(inga angivna)"}`);
  if (c.verifiedSocialProof.length) {
    lines.push(`VERIFIERAT SOCIALT BEVIS (ENDA tillåtna källan för omdömen/siffror/popularitet — citera/parafrasera bara detta, hitta aldrig på mer): ${c.verifiedSocialProof.join(" | ")}`);
  } else {
    lines.push("VERIFIERAT SOCIALT BEVIS: (saknas) — påstå INGENTING om kunder, kundcitat, recensioner, omdömen, betyg, antal kunder, försäljning eller popularitet. Välj en annan vinkel än kundberättelse.");
  }

  if (ctx.selectedProduct) {
    const p = ctx.selectedProduct;
    const pl: string[] = [`\nVALD PRODUKT/TJÄNST: ${p.name}${p.category ? ` (${p.category})` : ""}`];
    if (p.description) pl.push(`Beskrivning: ${p.description}`);
    if (p.customerProblem) pl.push(`Kundproblem: ${p.customerProblem}`);
    if (p.primaryAudience) pl.push(`Primär målgrupp: ${p.primaryAudience}`);
    if (p.differentiators.length) pl.push(`Differentiering: ${p.differentiators.join("; ")}`);
    if (p.objections.length) pl.push(`Vanliga invändningar: ${p.objections.join("; ")}`);
    if (p.seasonality) pl.push(`Säsong: ${p.seasonality}`);
    if (p.availabilityNotes) pl.push(`Tillgänglighet: ${p.availabilityNotes}`);
    // Prioritet/lönsamhet påverkar rådgivningen men får ALDRIG bli text i inlägget.
    pl.push(`(Internt: prioritet ${p.priority}, lönsamhet ${p.profitability} — påverkar tonvikt, nämns aldrig i texten.)`);
    lines.push(pl.join("\n"));
  }

  if (ctx.campaignStrategy) {
    const strat = ctx.campaignStrategy;
    const sl: string[] = [`\nKAMPANJSTRATEGI ATT FÖLJA:\nMål: ${strat.goal}`];
    if (strat.mainMessage) sl.push(`Huvudbudskap: ${strat.mainMessage}`);
    if (strat.audience) sl.push(`Målgrupp: ${strat.audience}`);
    if (strat.offer) sl.push(`Erbjudande: ${strat.offer}`);
    if (strat.cta) sl.push(`CTA: ${strat.cta}`);
    if (strat.risks?.length) sl.push(`Att bevaka: ${strat.risks.join("; ")}`);
    if (strat.avoid?.length) sl.push(`Undvik: ${strat.avoid.join("; ")}`);
    lines.push(sl.join("\n"));
  }

  return lines.join("\n");
}

function briefBlock(brief: FacebookBrief): string {
  const lines: string[] = [];
  lines.push(`MÅL: ${GOAL_GUIDANCE[brief.goal] ?? brief.goal}`);
  lines.push(`VAD SOM MARKNADSFÖRS: ${brief.productOrTopic}`);
  lines.push(`MÅLGRUPP FÖR INLÄGGET: ${brief.audience}`);
  lines.push(`ÖNSKAD HANDLING (CTA): ${brief.desiredAction}`);
  if (brief.offer) lines.push(`ERBJUDANDE: ${brief.offer}`);
  if (brief.price) lines.push(`PRIS: ${brief.price}`);
  if (brief.deadline) lines.push(`SISTA DATUM: ${brief.deadline}`);
  if (brief.geographicArea) lines.push(`GEOGRAFISKT OMRÅDE: ${brief.geographicArea}`);
  lines.push(`ÖNSKAD VINKEL: ${ANGLE_GUIDANCE[brief.requestedAngle] ?? brief.requestedAngle}`);
  if (brief.toneOverride) lines.push(`TILLFÄLLIG TONJUSTERING: ${brief.toneOverride}`);
  lines.push(LENGTH_GUIDANCE[brief.length]);
  if (brief.additionalNotes) lines.push(`ÖVRIGA NOTERINGAR / JUSTERING AV UNDERLAG: ${brief.additionalNotes}`);
  return lines.join("\n");
}

function draftUserPrompt(brief: FacebookBrief, ctx: FacebookSpecialistContext): string {
  return `${contextBlock(ctx)}\n\n─────────\nUPPDRAG FÖR DET HÄR INLÄGGET:\n${briefBlock(brief)}\n\nSkriv utkastet enligt reglerna och svara med endast JSON.`;
}

function reviewUserPrompt(brief: FacebookBrief, ctx: FacebookSpecialistContext, primary: FacebookPostVariant): string {
  return `${contextBlock(ctx)}\n\n─────────\nUNDERLAG: mål ${brief.goal}, längdnivå ${brief.length}, önskad handling: ${brief.desiredAction}\n\nFÖRESLAGET INLÄGG (primärversion):\nVinkel: ${primary.angle}\nText:\n${primary.postText}\n\nCTA: ${primary.callToAction}\nHashtags: ${primary.hashtags.join(" ") || "(inga)"}\n\nGranska och svara med endast JSON.`;
}

function reviseUserPrompt(
  brief: FacebookBrief,
  ctx: FacebookSpecialistContext,
  primary: FacebookPostVariant,
  review: FacebookQualityReview,
): string {
  return `${contextBlock(ctx)}\n\n─────────\nDu ska förbättra EN Facebook-primärversion enligt granskarens instruktion. Behåll fakta, CTA-avsikt och tonalitet. Lägg inte till nya påståenden eller erbjudanden. Rör inte de förbjudna påståendena.\n\nLÄNGDNIVÅ: ${LENGTH_GUIDANCE[brief.length]}\n\nNUVARANDE TEXT:\n${primary.postText}\n\nGRANSKARENS PROBLEM: ${review.issues.join(" | ") || "(se instruktion)"}\nREVISIONSINSTRUKTION: ${review.revisionSummary || "Höj kvaliteten enligt problemen."}\n\nSvara med ENDAST JSON för den förbättrade varianten:\n{ "id": "...", "label": "...", "angle": "...", "postText": "...", "callToAction": "...", "imageBrief": { "concept": "...", "subject": "...", "composition": "...", "textOverlay": "valfritt", "avoid": ["..."] }, "hashtags": ["..."] }`;
}

/* ── Koercion av modell-JSON → strikta typer ─────────────── */
const CAP = {
  POST_TEXT: 2600, CTA: 220, HASHTAG: 40, MAX_HASHTAGS: 3, IMG: 400, ISSUE: 320, MAX_ISSUES: 8, TEXT: 320,
};
const s = (v: unknown, max: number): string => (typeof v === "string" ? v : "").trim().slice(0, max);
const sList = (v: unknown, max: number, n: number): string[] =>
  Array.isArray(v) ? v.filter((x): x is string => typeof x === "string" && x.trim().length > 0).map((x) => s(x, max)).slice(0, n) : [];

let idSeed = 0;
const genId = (p: string) => `${p}_${Date.now().toString(36)}_${(idSeed++).toString(36)}`;

function coerceVariant(raw: unknown, fallbackLabel: string): FacebookPostVariant | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const postText = s(o.postText, CAP.POST_TEXT);
  if (postText.length < 20) return null; // ett fragment är inte ett inlägg
  const ib = (o.imageBrief && typeof o.imageBrief === "object" ? o.imageBrief : {}) as Record<string, unknown>;
  const hashtags = sList(o.hashtags, CAP.HASHTAG, CAP.MAX_HASHTAGS)
    .map((h) => h.replace(/^#+/, "").replace(/\s+/g, ""))
    .filter(Boolean)
    .slice(0, CAP.MAX_HASHTAGS);
  return {
    id: s(o.id, 60) || genId("v"),
    label: s(o.label, 80) || fallbackLabel,
    angle: s(o.angle, 80) || fallbackLabel,
    postText,
    callToAction: s(o.callToAction, CAP.CTA),
    imageBrief: {
      concept: s(ib.concept, CAP.IMG),
      subject: s(ib.subject, CAP.IMG),
      composition: s(ib.composition, CAP.IMG),
      textOverlay: s(ib.textOverlay, CAP.IMG) || undefined,
      avoid: sList(ib.avoid, CAP.IMG, 6),
    },
    hashtags,
  };
}

interface DraftShape {
  recommendedAngle: string;
  angleReason: string;
  primary: FacebookPostVariant;
  alternatives: FacebookPostVariant[];
  assumptions: string[];
  missingInformation: string[];
}

function coerceDraft(raw: unknown): DraftShape | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const primary = coerceVariant(o.primary, "Primär");
  if (!primary) return null;
  const alternatives = Array.isArray(o.alternatives)
    ? (o.alternatives.map((a, i) => coerceVariant(a, `Alternativ ${i + 1}`)).filter(Boolean) as FacebookPostVariant[]).slice(0, 2)
    : [];
  return {
    recommendedAngle: s(o.recommendedAngle, 80) || primary.angle,
    angleReason: s(o.angleReason, 300),
    primary,
    alternatives,
    assumptions: sList(o.assumptions, CAP.TEXT, 6),
    missingInformation: sList(o.missingInformation, CAP.TEXT, 6),
  };
}

const bool = (v: unknown): boolean => v === true;

function allChecksTrue(): FacebookQualityChecks {
  return {
    companySpecific: true, audienceSpecific: true, clearHook: true, clearCustomerValue: true,
    credibleClaims: true, correctTone: true, clearCTA: true, appropriateLength: true,
    readableFormatting: true, noForbiddenClaims: true, naturalSwedish: true, honestSocialProof: true,
  };
}

function allChecksFalse(): FacebookQualityChecks {
  return {
    companySpecific: false, audienceSpecific: false, clearHook: false, clearCustomerValue: false,
    credibleClaims: false, correctTone: false, clearCTA: false, appropriateLength: false,
    readableFormatting: false, noForbiddenClaims: false, naturalSwedish: false, honestSocialProof: false,
  };
}

function coerceReview(raw: unknown): FacebookQualityReview | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const status = o.status === "ready" || o.status === "needs_revision" || o.status === "blocked" ? o.status : "needs_revision";
  const cRaw = (o.checks && typeof o.checks === "object" ? o.checks : {}) as Record<string, unknown>;
  const checks: FacebookQualityChecks = {
    companySpecific: bool(cRaw.companySpecific),
    audienceSpecific: bool(cRaw.audienceSpecific),
    clearHook: bool(cRaw.clearHook),
    clearCustomerValue: bool(cRaw.clearCustomerValue),
    credibleClaims: bool(cRaw.credibleClaims),
    correctTone: bool(cRaw.correctTone),
    clearCTA: bool(cRaw.clearCTA),
    appropriateLength: bool(cRaw.appropriateLength),
    readableFormatting: bool(cRaw.readableFormatting),
    noForbiddenClaims: bool(cRaw.noForbiddenClaims),
    // Nya kriterier: äldre/otydliga svar defaultar till true (positivt) så
    // att de deterministiska lagren, inte en utebliven flagga, avgör.
    naturalSwedish: cRaw.naturalSwedish === false ? false : true,
    honestSocialProof: cRaw.honestSocialProof === false ? false : true,
  };
  let score = typeof o.overallScore === "number" ? Math.round(o.overallScore) : 0;
  score = Math.max(0, Math.min(100, score));
  return {
    status,
    overallScore: score,
    // userStatus/statusReason sätts deterministiskt i finalizeReview.
    userStatus: "review",
    statusReason: "",
    checks,
    issues: sList(o.issues, CAP.ISSUE, CAP.MAX_ISSUES),
    revisionSummary: s(o.revisionSummary, 500) || undefined,
  };
}

/* ── Deterministiska efterkontroller (ingen AI) ──────────── */

/** Grov men äkta forbiddenClaims-scan: matchar hela förbjudna fraser
 *  (ordgräns, ≥4 tecken) som substräng, skiftlägesokänsligt. */
function forbiddenHit(text: string, forbidden: string[]): string | null {
  const hay = text.toLowerCase();
  for (const raw of forbidden) {
    const phrase = raw.toLowerCase().trim();
    if (phrase.length < 4) continue;
    if (hay.includes(phrase)) return raw;
  }
  return null;
}

/**
 * Justerar granskningen med deterministiska fakta som en språkmodell inte
 * får ha fel om: faktisk längd, forbiddenClaims-träffar, tydliga AI-klichéer
 * och fabricerat social proof (när verifierat underlag saknas). Returnerar
 * den justerade granskningen + de flaggor som styr användarstatusen.
 */
function applyDeterministicChecks(
  review: FacebookQualityReview,
  primary: FacebookPostVariant,
  brief: FacebookBrief,
  forbidden: string[],
  verifiedProofCount: number,
): { review: FacebookQualityReview; flags: StatusFlags } {
  const issues = [...review.issues];
  const checks = { ...review.checks };
  let status = review.status;

  // Längd är helt deterministisk — den äger vi, inte modellen (sätts både true och false).
  const n = wc(primary.postText);
  const range = LENGTH_RANGE[brief.length];
  // Symmetrisk tolerans: 15 % marginal åt båda håll så att ett i övrigt bra
  // inlägg några få ord under målet inte i onödan flaggas som "behöver granskas".
  const tooShort = n < range.min * 0.85;
  const tooLong = n > range.max * 1.35;
  checks.appropriateLength = !tooShort && !tooLong;
  if (tooShort) {
    issues.push(`För kort för vald längd (${n} ord, förväntat minst ~${range.min}).`);
    if (status === "ready") status = "needs_revision";
  } else if (tooLong) {
    issues.push(`Klart längre än vald längd (${n} ord).`);
    if (status === "ready") status = "needs_revision";
  }

  // Förbjudna påståenden.
  const hit = forbiddenHit(primary.postText, forbidden);
  if (hit) {
    checks.noForbiddenClaims = false;
    checks.credibleClaims = false;
    issues.push(`Innehåller ett förbjudet påstående: "${hit}".`);
    if (status !== "blocked") status = "needs_revision";
  }

  // Fabricerat social proof — allvarligt. Körs bara när verifierat underlag saknas.
  const proofHits = detectFabricatedSocialProof(primary.postText, verifiedProofCount);
  if (proofHits.length) {
    checks.honestSocialProof = false;
    checks.credibleClaims = false;
    issues.push(`Fabricerat/obestyrkt social proof (${proofHits.map((h) => h.phrase).join(", ")}) — verifierat underlag saknas.`);
    if (status !== "blocked") status = "needs_revision";
  }

  // Tydliga AI-klichéer.
  const cliches = detectCliches(primary.postText);
  if (cliches.length) {
    checks.naturalSwedish = false;
    // Ta med upp till tre konkreta putsinstruktioner.
    for (const c of cliches.slice(0, 3)) issues.push(c.hint);
    if (status === "ready") status = "needs_revision";
  }

  const flags: StatusFlags = {
    fabricatedSocialProof: proofHits.length > 0,
    forbiddenClaim: hit != null,
    clicheCount: cliches.length,
  };

  return { review: { ...review, status, checks, issues: issues.slice(0, CAP.MAX_ISSUES) }, flags };
}

/** Sätter den slutliga användarstatusen ovanpå den deterministiska granskningen. */
function finalizeReview(review: FacebookQualityReview, flags: StatusFlags): FacebookQualityReview {
  const { userStatus, statusReason } = deriveUserStatus(review, flags);
  return { ...review, userStatus, statusReason };
}

/* ── OpenAI-anrop ────────────────────────────────────────── */
function makeClient(): OpenAI {
  // maxRetries: 0 — samma mönster som befintliga routes; SDK:ns tysta
  // omförsök skulle annars kunna spränga klientens timeout.
  return new OpenAI({ apiKey: process.env.OPENAI_API_KEY, maxRetries: 0 });
}

interface CallResult { parsed: unknown; promptTokens: number; completionTokens: number; }

async function callJson(
  client: OpenAI,
  model: string,
  system: string,
  user: string,
  opts: { temperature: number; maxTokens: number; signal?: AbortSignal },
): Promise<CallResult> {
  const completion = await client.chat.completions.create(
    {
      model,
      temperature: opts.temperature,
      max_tokens: opts.maxTokens,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
    },
    { timeout: FB_TIMEOUT_MS, signal: opts.signal },
  );
  const content = completion.choices[0]?.message?.content ?? "";
  return {
    parsed: JSON.parse(content),
    promptTokens: completion.usage?.prompt_tokens ?? 0,
    completionTokens: completion.usage?.completion_tokens ?? 0,
  };
}

/* ── Huvudmotor ──────────────────────────────────────────── */
export async function runFacebookSpecialist(
  brief: FacebookBrief,
  ctx: FacebookSpecialistContext,
  options: RunOptions = {},
): Promise<RunOutput> {
  const started = Date.now();
  const client = makeClient();
  const emit = options.emit ?? (() => {});
  const forbidden = ctx.company.forbiddenClaims ?? [];
  const verifiedProofCount = ctx.company.verifiedSocialProof?.length ?? 0;
  let calls = 0;
  let promptTokens = 0;
  let completionTokens = 0;

  // Steg A — utkast
  emit("drafting");
  const draftRes = await callJson(client, FB_MODELS.draft, DRAFT_SYSTEM, draftUserPrompt(brief, ctx), {
    temperature: 0.75, maxTokens: 2600, signal: options.signal,
  });
  calls++; promptTokens += draftRes.promptTokens; completionTokens += draftRes.completionTokens;
  const draft = coerceDraft(draftRes.parsed);
  if (!draft) throw new Error("DraftCoercionFailed");

  // Steg B — kvalitetsgranskning
  emit("reviewing");
  const reviewRes = await callJson(client, FB_MODELS.review, REVIEW_SYSTEM, reviewUserPrompt(brief, ctx, draft.primary), {
    temperature: 0.2, maxTokens: 600, signal: options.signal,
  });
  calls++; promptTokens += reviewRes.promptTokens; completionTokens += reviewRes.completionTokens;
  let review = coerceReview(reviewRes.parsed) ?? {
    status: "needs_revision" as const, overallScore: 0,
    userStatus: "review" as const, statusReason: "",
    checks: allChecksFalse(),
    issues: ["Granskningen kunde inte tolkas."], revisionSummary: "Säkerställ företagsspecifik, trovärdig och publicerbar text.",
  };

  // Deterministiska fakta väger tyngre än modellens gissning.
  let det = applyDeterministicChecks(review, draft.primary, brief, forbidden, verifiedProofCount);
  review = det.review;

  let primary = draft.primary;
  let revised = false;

  // Max EN automatisk revision. Ingen loop, ingen re-review-loop.
  if (review.status === "needs_revision") {
    emit("revising");
    try {
      const reviseRes = await callJson(client, FB_MODELS.draft, DRAFT_SYSTEM, reviseUserPrompt(brief, ctx, primary, review), {
        temperature: 0.6, maxTokens: 1400, signal: options.signal,
      });
      calls++; promptTokens += reviseRes.promptTokens; completionTokens += reviseRes.completionTokens;
      const improved = coerceVariant(reviseRes.parsed, primary.label);
      if (improved) {
        const priorIssues = review.issues;
        primary = improved;
        revised = true;
        // Vi gör vår enda tillåtna förbättring och re-reviewar INTE (ingen loop,
        // inget fjärde AI-steg). Vi litar därför på revisionen för de icke-
        // deterministiska kriterierna, men behåller full auktoritet över de
        // deterministiska (längd, forbiddenClaims, social proof, klichéer) på den
        // nya texten. Kvarstår ett allvarligt fel markeras det ALDRIG som klart.
        det = applyDeterministicChecks(
          { status: "ready", overallScore: review.overallScore, userStatus: "review", statusReason: "", checks: allChecksTrue(), issues: [] },
          primary, brief, forbidden, verifiedProofCount,
        );
        review = {
          ...det.review,
          overallScore: review.overallScore,
          revisionSummary: `Texten förbättrades automatiskt efter granskning: ${priorIssues.join(" | ") || review.revisionSummary || "kvalitetsjustering"}.`,
        };
      }
    } catch {
      // Revisionen misslyckades — behåll utkastet och den ärliga granskningen.
    }
  }

  // Slutlig användarstatus ovanpå den deterministiska granskningen.
  review = finalizeReview(review, det.flags);

  // Alternativ: släpp fabricerat social proof (utan verifierat underlag) och
  // uppenbart nästan identiska alternativ. Namnge aldrig "Kundberättelse" utan täckning.
  let droppedAlts = 0;
  let alternatives = draft.alternatives;
  if (verifiedProofCount === 0) {
    const before = alternatives.length;
    alternatives = alternatives.filter((a) => {
      const proofLabel = /kundberättelse|kundcitat|omdöme|recension|socialt bevis|kundröst/i.test(`${a.label} ${a.angle}`);
      const proofText = detectFabricatedSocialProof(a.postText, 0).length > 0;
      return !proofLabel && !proofText;
    });
    droppedAlts += before - alternatives.length;
  }
  const deduped = dedupeAlternatives(primary, alternatives);
  droppedAlts += deduped.dropped;
  alternatives = deduped.kept;

  emit("done");

  const result: FacebookSpecialistResult = {
    recommendedAngle: draft.recommendedAngle,
    angleReason: draft.angleReason,
    primary,
    alternatives,
    qualityReview: review,
    assumptions: draft.assumptions,
    missingInformation: draft.missingInformation,
  };

  return {
    result,
    meta: {
      calls,
      revised,
      models: { draft: FB_MODELS.draft, review: FB_MODELS.review },
      usage: { promptTokens, completionTokens },
      ms: Date.now() - started,
      alternativesDropped: droppedAlts,
      clichesFound: det.flags.clicheCount,
      verifiedSocialProofCount: verifiedProofCount,
    },
  };
}

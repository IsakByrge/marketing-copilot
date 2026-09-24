// ─────────────────────────────────────────────────────────────
// Campaigns v1 — dataaccess mot public.campaigns.
//
// Browser-klienten, samma mönster som campaignStrategyStore och
// useCompanyBrain. RLS är säkerhetsgränsen: policyerna kräver att
// kampanjen, strategin och företaget ägs av den inloggade användaren
// och att strategin hör till kampanjens företag. Ingen service_role.
//
// Varje funktion returnerar ett uttryckligt resultat. Ett misslyckat
// anrop rapporteras som fel — aldrig som en tyst lyckad ändring.
// ─────────────────────────────────────────────────────────────
import { createClient } from "@/lib/supabase-browser";
import {
  buildCampaignFromStrategy, buildRerunPayload, nextStatus,
  normalizeCampaignRow, normalizeStrategyRow,
  type Campaign, type CampaignForm, type CampaignResults, type StrategyRow,
} from "./logic";

export type StoreResult<T> = { ok: true; data: T } | { ok: false; error: string };

const CAMPAIGN_COLUMNS =
  "id,user_id,company_id,strategy_id,title,status,starts_on,ends_on," +
  "spend_amount,revenue_amount,result_type,result_count,result_note,learning," +
  "created_at,updated_at," +
  "strategy:campaign_strategies(id,title,goal,company_id,created_at,strategy_context,recommendation)";

const STRATEGY_COLUMNS = "id,title,goal,company_id,created_at,strategy_context,recommendation";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const LOAD_ERROR = "Kunde inte hämta kampanjerna just nu. Kontrollera anslutningen och försök igen.";
const SAVE_ERROR = "Det gick inte att spara. Ingenting ändrades — försök igen.";
const NOT_SIGNED_IN = "Du är inte inloggad längre. Logga in igen och försök på nytt.";

async function currentUserId(): Promise<string | null> {
  const { data: { user } } = await createClient().auth.getUser();
  return user?.id ?? null;
}

function logError(where: string, e: unknown) {
  const code = e && typeof e === "object" && "code" in e ? String((e as { code: unknown }).code) : "";
  console.warn(`campaigns:${where}`, code || (e instanceof Error ? e.name : "UnknownError"));
}

/* ── Läsning ────────────────────────────────────────────── */

export async function listCampaigns(): Promise<StoreResult<Campaign[]>> {
  try {
    const userId = await currentUserId();
    if (!userId) return { ok: false, error: NOT_SIGNED_IN };
    const { data, error } = await createClient()
      .from("campaigns").select(CAMPAIGN_COLUMNS)
      .eq("user_id", userId)
      .order("created_at", { ascending: false });
    if (error) { logError("list", error); return { ok: false, error: LOAD_ERROR }; }
    const list = (data ?? []).map(normalizeCampaignRow).filter((c): c is Campaign => c !== null);
    return { ok: true, data: list };
  } catch (e) {
    logError("list", e);
    return { ok: false, error: LOAD_ERROR };
  }
}

/**
 * Alla körningar av en strategi — samma strategy_id, samma användare.
 *
 * En fråga, samma kolumner och samma normalisering som listCampaigns.
 * campaigns_strategy_idx täcker filtret. Filtreringen på status och
 * kronologin ligger i logic.ts, inte här: den här funktionen hämtar
 * raderna, den bestämmer inte vad de betyder.
 *
 * Ogiltigt id ger en tom lista, inte ett fel — det är inte ett
 * anslutningsproblem, det finns bara inget att hämta.
 */
export async function listRunsForStrategy(strategyId: string): Promise<StoreResult<Campaign[]>> {
  if (!UUID.test(strategyId)) return { ok: true, data: [] };
  try {
    const userId = await currentUserId();
    if (!userId) return { ok: false, error: NOT_SIGNED_IN };
    const { data, error } = await createClient()
      .from("campaigns").select(CAMPAIGN_COLUMNS)
      .eq("user_id", userId)
      .eq("strategy_id", strategyId)
      .order("starts_on", { ascending: false });
    if (error) { logError("runs", error); return { ok: false, error: LOAD_ERROR }; }
    const list = (data ?? []).map(normalizeCampaignRow).filter((c): c is Campaign => c !== null);
    return { ok: true, data: list };
  } catch (e) {
    logError("runs", e);
    return { ok: false, error: LOAD_ERROR };
  }
}

/** data: null betyder "finns inte" (fel id, borttagen eller någon annans). */
export async function getCampaign(id: string): Promise<StoreResult<Campaign | null>> {
  if (!UUID.test(id)) return { ok: true, data: null };
  try {
    const userId = await currentUserId();
    if (!userId) return { ok: false, error: NOT_SIGNED_IN };
    const { data, error } = await createClient()
      .from("campaigns").select(CAMPAIGN_COLUMNS)
      .eq("id", id).eq("user_id", userId)
      .maybeSingle();
    if (error) { logError("get", error); return { ok: false, error: LOAD_ERROR }; }
    return { ok: true, data: normalizeCampaignRow(data) };
  } catch (e) {
    logError("get", e);
    return { ok: false, error: LOAD_ERROR };
  }
}

/** Användarens sparade strategier, nyast först, och vilka som redan har en kampanj. */
export async function listStrategiesForNewCampaign(): Promise<StoreResult<{ strategies: StrategyRow[]; usedStrategyIds: string[] }>> {
  try {
    const userId = await currentUserId();
    if (!userId) return { ok: false, error: NOT_SIGNED_IN };
    const sb = createClient();
    const [strats, used] = await Promise.all([
      sb.from("campaign_strategies").select(STRATEGY_COLUMNS)
        .eq("user_id", userId).order("created_at", { ascending: false }),
      sb.from("campaigns").select("strategy_id").eq("user_id", userId),
    ]);
    if (strats.error || used.error) {
      logError("strategies", strats.error ?? used.error);
      return { ok: false, error: "Kunde inte hämta dina strategier just nu. Försök igen." };
    }
    return {
      ok: true,
      data: {
        strategies: (strats.data ?? []).map(normalizeStrategyRow).filter((s): s is StrategyRow => s !== null),
        usedStrategyIds: (used.data ?? []).map((r) => String((r as { strategy_id: unknown }).strategy_id)),
      },
    };
  } catch (e) {
    logError("strategies", e);
    return { ok: false, error: "Kunde inte hämta dina strategier just nu. Försök igen." };
  }
}

export async function getStrategy(id: string): Promise<StoreResult<StrategyRow | null>> {
  if (!UUID.test(id)) return { ok: true, data: null };
  try {
    const userId = await currentUserId();
    if (!userId) return { ok: false, error: NOT_SIGNED_IN };
    const { data, error } = await createClient()
      .from("campaign_strategies").select(STRATEGY_COLUMNS)
      .eq("id", id).eq("user_id", userId).maybeSingle();
    if (error) { logError("strategy", error); return { ok: false, error: "Kunde inte hämta strategin just nu." }; }
    return { ok: true, data: normalizeStrategyRow(data) };
  } catch (e) {
    logError("strategy", e);
    return { ok: false, error: "Kunde inte hämta strategin just nu." };
  }
}

/* ── Skrivning ──────────────────────────────────────────── */

async function insertCampaign(payload: ReturnType<typeof buildCampaignFromStrategy>): Promise<StoreResult<string>> {
  if (!payload) return { ok: false, error: "Strategin saknar företag och kan inte bli en kampanj." };
  try {
    const { data, error } = await createClient()
      .from("campaigns").insert(payload).select("id").single();
    if (error || !data?.id) { logError("insert", error); return { ok: false, error: SAVE_ERROR }; }
    return { ok: true, data: String(data.id) };
  } catch (e) {
    logError("insert", e);
    return { ok: false, error: SAVE_ERROR };
  }
}

/** Planerad kampanj ur en sparad strategi. company_id kommer från strategiraden. */
export async function createCampaignFromStrategy(strategy: StrategyRow, form: CampaignForm): Promise<StoreResult<string>> {
  const userId = await currentUserId().catch(() => null);
  if (!userId) return { ok: false, error: NOT_SIGNED_IN };
  return insertCampaign(buildCampaignFromStrategy(strategy, form, userId));
}

/** "Kör igen": en ny planerad rad. Den gamla kampanjen ändras inte. */
export async function rerunCampaign(previous: Campaign, form: CampaignForm): Promise<StoreResult<string>> {
  const userId = await currentUserId().catch(() => null);
  if (!userId) return { ok: false, error: NOT_SIGNED_IN };
  return insertCampaign(buildRerunPayload(previous, form, userId));
}

/** Uppdaterar en rad och kräver att exakt den raden faktiskt ändrades. */
async function updateCampaign(
  id: string,
  patch: Record<string, unknown>,
  onlyIfStatus?: Campaign["status"],
): Promise<StoreResult<Campaign>> {
  try {
    let q = createClient().from("campaigns")
      .update({ ...patch, updated_at: new Date().toISOString() })
      .eq("id", id);
    if (onlyIfStatus) q = q.eq("status", onlyIfStatus);
    const { data, error } = await q.select(CAMPAIGN_COLUMNS).maybeSingle();
    if (error) { logError("update", error); return { ok: false, error: SAVE_ERROR }; }
    const row = normalizeCampaignRow(data);
    if (!row) {
      return { ok: false, error: "Kampanjen har ändrats någon annanstans. Ladda om sidan och försök igen." };
    }
    return { ok: true, data: row };
  } catch (e) {
    logError("update", e);
    return { ok: false, error: SAVE_ERROR };
  }
}

/** Uppdaterar bara de fem resultatkolumnerna (+ updated_at). */
export function updateCampaignResults(id: string, results: CampaignResults): Promise<StoreResult<Campaign>> {
  return updateCampaign(id, {
    spend_amount: results.spend_amount,
    revenue_amount: results.revenue_amount,
    result_type: results.result_type,
    result_count: results.result_count,
    result_note: results.result_note,
  });
}

/** planerad → pågår. Ingen automatik på datum; bara när användaren väljer det. */
export function startCampaign(c: Campaign): Promise<StoreResult<Campaign>> {
  const to = nextStatus(c.status, "start");
  if (!to) return Promise.resolve({ ok: false, error: "Bara en planerad kampanj kan startas." });
  return updateCampaign(c.id, { status: to }, c.status);
}

/** pågår → avslutad, med en frivillig lärdom. */
export function endCampaign(c: Campaign, learning: string): Promise<StoreResult<Campaign>> {
  const to = nextStatus(c.status, "end");
  if (!to) return Promise.resolve({ ok: false, error: "Bara en pågående kampanj kan avslutas." });
  return updateCampaign(c.id, { status: to, learning: learning.trim() || null }, c.status);
}

/** Ändra lärdomen på en avslutad kampanj. */
export function updateLearning(c: Campaign, learning: string): Promise<StoreResult<Campaign>> {
  return updateCampaign(c.id, { learning: learning.trim() || null });
}

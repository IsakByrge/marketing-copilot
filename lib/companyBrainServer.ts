// ─────────────────────────────────────────────────────────────
// Server-only Company Brain-åtkomst. Använder den autentiserade
// cookie-baserade Supabase-klienten (lib/supabase-server.ts) —
// användaren härleds ALLTID från sessionen, aldrig från ett
// klient-skickat userId. Detta ärver "server-only"-skyddet från
// supabase-server.ts, som importerar next/headers (kan inte
// buntas in i en klientkomponent).
//
// Byggd men INTE inkopplad i någon AI-route denna sprint (se
// sprintanteckningarna) — ingen befintlig route hämtar företags-
// data självständigt från Supabase idag, så det finns ingen
// riskfri "redan hämtar profilen här"-plats att koppla in den på
// utan att röra kampanjprompten. Redo för nästa sprint.
// ─────────────────────────────────────────────────────────────
import { createClient } from "./supabase-server";
import { migrateProfileToBrain, buildCompanyBrainContext, type CompanyBrain, type CompanyBrainContext } from "@/app/_shared/companyBrain";

/**
 * Hämtar den inloggade användarens Company Brain-kontext, minimerad för
 * AI-bruk. Returnerar null om ingen session eller inget företag finns —
 * anroparen ska då falla tillbaka till nuvarande beteende (ingen kontext),
 * aldrig krascha.
 */
export async function getCompanyBrainContext(): Promise<CompanyBrainContext | null> {
  try {
    const sb = await createClient();
    const { data: { user } } = await sb.auth.getUser();
    if (!user) return null;

    const { data: companies } = await sb
      .from("companies").select("*").eq("user_id", user.id)
      .order("created_at", { ascending: false }).limit(1);
    const company = companies?.[0] ?? null;
    if (!company) return null;

    const brain = migrateProfileToBrain({
      summary: company.summary, customers: company.customers ?? [], products: company.products ?? [],
      tone: company.tone ?? [], strengths: company.strengths ?? [], avoid: company.avoid ?? [],
      contentGuidelines: company.content_guidelines ?? [],
    }, company.company_brain);

    return buildCompanyBrainContext(brain);
  } catch (error) {
    // Logga aldrig företagsdata — bara att hämtningen misslyckades.
    console.error("COMPANY_BRAIN_CONTEXT_ERROR:", error instanceof Error ? error.name : "UnknownError");
    return null;
  }
}

/**
 * Hämtar hela den inloggade användarens Company Brain — samma hämtnings- och
 * migreringslogik som getCompanyBrainContext, men returnerar den fullständiga
 * hjärnan i stället för den minimerade AI-kontexten.
 *
 * VARFÖR: CompanyBrainContext.priorityProducts innehåller bara de åtta högst
 * prioriterade produkterna och saknar artikelnummer. Produkttexter måste kunna
 * slå upp exakt den artikel som skrivs om.
 *
 * VIKTIGT: returvärdet får ALDRIG gå direkt in i en prompt — det innehåller
 * interna id:n och lönsamhetsuppgifter (profitability). Gå alltid via
 * buildFactsLookup + formatFacts, som filtrerar bort det.
 *
 * Returnerar null om ingen session eller inget företag finns — anroparen ska
 * då falla tillbaka till nuvarande beteende (inget underlag), aldrig krascha.
 */
export async function getCompanyBrain(): Promise<CompanyBrain | null> {
  try {
    const sb = await createClient();
    const { data: { user } } = await sb.auth.getUser();
    if (!user) return null;

    const { data: companies } = await sb
      .from("companies").select("*").eq("user_id", user.id)
      .order("created_at", { ascending: false }).limit(1);
    const company = companies?.[0] ?? null;
    if (!company) return null;

    return migrateProfileToBrain({
      summary: company.summary, customers: company.customers ?? [], products: company.products ?? [],
      tone: company.tone ?? [], strengths: company.strengths ?? [], avoid: company.avoid ?? [],
      contentGuidelines: company.content_guidelines ?? [],
    }, company.company_brain);
  } catch (error) {
    // Logga aldrig företagsdata — bara att hämtningen misslyckades.
    console.error("COMPANY_BRAIN_ERROR:", error instanceof Error ? error.name : "UnknownError");
    return null;
  }
}

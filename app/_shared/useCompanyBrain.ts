"use client";

// ─────────────────────────────────────────────────────────────
// Klient-hook för Company Brain 1.1. Läser/skriver samma
// "companies"-rad som useAccountData redan läser (senaste raden
// för inloggad användare) — bara det nya company_brain-fältet,
// via samma RLS-skyddade browser-klient som resten av appen
// redan använder för att spara företagsdata. Ingen ny API-route.
// ─────────────────────────────────────────────────────────────
import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase-browser";
import { emptyBrain, migrateProfileToBrain, type CompanyBrain } from "./companyBrain";

export type SaveStatus = "idle" | "saving" | "saved" | "error";

export function useCompanyBrain() {
  const [companyId, setCompanyId] = useState<string | null>(null);
  const [companyName, setCompanyName] = useState<string>("");
  const [brain, setBrain] = useState<CompanyBrain>(emptyBrain());
  const [loaded, setLoaded] = useState(false);
  const [hasCompany, setHasCompany] = useState(false);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("idle");

  useEffect(() => {
    let cancelled = false;

    async function load() {
      const sb = createClient();
      const { data: { user } } = await sb.auth.getUser();
      if (!user || cancelled) { if (!cancelled) setLoaded(true); return; }

      const { data: companies } = await sb
        .from("companies").select("*").eq("user_id", user.id)
        .order("created_at", { ascending: false }).limit(1);
      if (cancelled) return;

      const company = companies?.[0] ?? null;
      if (!company) { setLoaded(true); return; }

      setCompanyId(company.id);
      setCompanyName(company.name ?? "");
      setHasCompany(true);
      setBrain(migrateProfileToBrain({
        summary: company.summary, customers: company.customers ?? [], products: company.products ?? [],
        tone: company.tone ?? [], strengths: company.strengths ?? [], avoid: company.avoid ?? [],
        contentGuidelines: company.content_guidelines ?? [],
      }, company.company_brain));
      setLoaded(true);
    }

    load();
    return () => { cancelled = true; };
  }, []);

  /**
   * Sparar hela brain-objektet till company_brain. Rör ALDRIG de gamla
   * platta kolumnerna — de lämnas orörda som bakåtkompatibel fallback.
   * Om kolumnen company_brain ännu inte finns i databasen (migrationen
   * inte körd) misslyckas skrivningen tydligt i UI:t i stället för att
   * krascha sidan eller tyst tappa ändringen.
   */
  const save = useCallback(async (next: CompanyBrain) => {
    setBrain(next);
    if (!companyId) return;
    setSaveStatus("saving");
    try {
      const sb = createClient();
      const { error } = await sb
        .from("companies")
        .update({ company_brain: { ...next, lastReviewedAt: new Date().toISOString() } })
        .eq("id", companyId);
      if (error) throw error;
      setSaveStatus("saved");
      setTimeout(() => setSaveStatus((s) => (s === "saved" ? "idle" : s)), 2500);
    } catch (e) {
      console.warn("Kunde inte spara Company Brain:", e);
      setSaveStatus("error");
    }
  }, [companyId]);

  return { brain, setBrain, save, saveStatus, loaded, hasCompany, companyId, companyName };
}

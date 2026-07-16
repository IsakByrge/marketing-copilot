"use client";

// ─────────────────────────────────────────────────────────────
// Delad datahämtning för företagsprofil + senaste marknadsplan.
// Exakt samma Supabase-frågor och localStorage-fallback som den
// ursprungliga dashboarden använde — bara flyttat hit så att
// Idag, Innehåll, Företagskunskap, Kampanjer och Historik kan
// återanvända samma, oförändrade, riktiga datakälla.
// ─────────────────────────────────────────────────────────────
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase-browser";

export type CompanyProfile = {
  companyName: string; industry: string; summary: string;
  customers: string[]; products: string[]; tone: string[];
  strengths: string[]; avoid: string[]; contentGuidelines: string[];
};

export type MarketingPost = { title: string; text: string; cta: string; image: string };
export type Newsletter = { subject: string; preview: string; body: string; cta: string };
export type PlanCampaign = { title: string; goal: string; message: string; channels: string; cta: string };
export type Opportunity = { title: string; date: string; relevance: string };

export type MarketingPlan = {
  id?: string; company: string; focus: string; tags: string[];
  posts: MarketingPost[]; newsletter: Newsletter;
  campaigns: PlanCampaign[]; opportunities?: Opportunity[];
};

export interface PlanHistoryEntry {
  id: string;
  createdAt: string;
  focus: string;
  tags: string[];
  campaignCount: number;
  postCount: number;
}

export function useAccountData() {
  const [profile, setProfile] = useState<CompanyProfile | null>(null);
  const [plan, setPlan] = useState<MarketingPlan | null>(null);
  const [history, setHistory] = useState<PlanHistoryEntry[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [email, setEmail] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      let planLoadedFromServer = false;
      const sb = createClient();
      const { data: { user } } = await sb.auth.getUser();
      if (cancelled) return;

      if (user) {
        setEmail(user.email ?? null);
        try {
          const { data: companies } = await sb
            .from("companies").select("*").eq("user_id", user.id)
            .order("created_at", { ascending: false }).limit(1);
          const company = companies?.[0] ?? null;

          if (company) {
            const p: CompanyProfile = {
              companyName: company.name, industry: company.industry, summary: company.summary,
              customers: company.customers ?? [], products: company.products ?? [],
              tone: company.tone ?? [], strengths: company.strengths ?? [],
              avoid: company.avoid ?? [], contentGuidelines: company.content_guidelines ?? [],
            };
            if (!cancelled) {
              setProfile(p);
              localStorage.setItem("marketing-copilot-company-profile", JSON.stringify(p));
            }

            const { data: plans } = await sb
              .from("plans").select("*").eq("company_id", company.id)
              .order("created_at", { ascending: false }).limit(20);

            if (!cancelled && plans && plans.length > 0) {
              const latest = plans[0];
              const planFromDb: MarketingPlan = {
                id: latest.id, company: company.name, focus: latest.focus, tags: latest.tags ?? [],
                posts: latest.posts ?? [], newsletter: latest.newsletter,
                campaigns: latest.campaigns ?? [], opportunities: latest.opportunities ?? [],
              };
              setPlan(planFromDb);
              localStorage.setItem("marketing-copilot-plan", JSON.stringify(planFromDb));
              planLoadedFromServer = true;

              setHistory(plans.map((row) => ({
                id: row.id,
                createdAt: row.created_at,
                focus: row.focus,
                tags: row.tags ?? [],
                campaignCount: Array.isArray(row.campaigns) ? row.campaigns.length : 0,
                postCount: Array.isArray(row.posts) ? row.posts.length : 0,
              })));
            }
          }
        } catch {
          const savedProfile = localStorage.getItem("marketing-copilot-company-profile");
          if (savedProfile && !cancelled) try { setProfile(JSON.parse(savedProfile)); } catch { /* ignorera trasig data */ }
        }
      } else {
        const savedProfile = localStorage.getItem("marketing-copilot-company-profile");
        if (savedProfile) try { setProfile(JSON.parse(savedProfile)); } catch { /* ignorera trasig data */ }
      }

      if (!planLoadedFromServer && !cancelled) {
        const savedPlan = localStorage.getItem("marketing-copilot-plan");
        if (savedPlan) try { setPlan(JSON.parse(savedPlan)); } catch { /* ignorera trasig data */ }
      }
      if (!cancelled) setLoaded(true);
    }

    load();
    return () => { cancelled = true; };
  }, []);

  return { profile, plan, setPlan, history, loaded, email };
}

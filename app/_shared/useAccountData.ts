"use client";

// ─────────────────────────────────────────────────────────────
// Delad datahämtning för företagsprofil + senaste marknadsplan.
// Idag, Innehåll, Företagskunskap, Kampanjer och Historik läser
// alla härifrån.
//
// Supabase är enda källan. Ingen spegling i localStorage: en kopia
// på enheten kan visa en annan användares företag efter utloggning,
// och den överlever kontobyten. Går hämtningen inte igenom visas
// inget hellre än något gammalt — ärliga tomlägen, se VISION.md.
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
  /** Modellens egen inledning till veckans tema. Saknas i aldre planer. */
  intro?: string;
  /** Nar raden skapades i plans. Behovs for att kunna saga att ett
   *  forslag ar fran en tidigare vecka, och for dubblettskyddet. */
  createdAt?: string;
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
      const sb = createClient();
      const { data: { user } } = await sb.auth.getUser();
      if (cancelled) return;

      if (!user) {
        setLoaded(true);
        return;
      }

      setEmail(user.email ?? null);
      try {
        const { data: companies } = await sb
          .from("companies").select("*").eq("user_id", user.id)
          .order("created_at", { ascending: false }).limit(1);
        const company = companies?.[0] ?? null;
        if (cancelled) return;

        if (company) {
          setProfile({
            companyName: company.name, industry: company.industry, summary: company.summary,
            customers: company.customers ?? [], products: company.products ?? [],
            tone: company.tone ?? [], strengths: company.strengths ?? [],
            avoid: company.avoid ?? [], contentGuidelines: company.content_guidelines ?? [],
          });

          const { data: plans } = await sb
            .from("plans").select("*").eq("company_id", company.id)
            .order("created_at", { ascending: false }).limit(20);

          if (!cancelled && plans && plans.length > 0) {
            const latest = plans[0];
            setPlan({
              id: latest.id, createdAt: latest.created_at,
              company: company.name, focus: latest.focus,
              // Null for planer skapade fore migration 0007 - da visar
              // Idag sin reservtext i stallet.
              intro: latest.intro ?? undefined,
              tags: latest.tags ?? [],
              posts: latest.posts ?? [], newsletter: latest.newsletter,
              campaigns: latest.campaigns ?? [], opportunities: latest.opportunities ?? [],
            });

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
      } catch (e) {
        // Ingen lokal reservkopia att falla tillbaka på — sidorna visar
        // sitt tomläge i stället för gammal eller främmande data.
        console.warn("Kunde inte hämta kontodata:", e);
      }

      if (!cancelled) setLoaded(true);
    }

    load();
    return () => { cancelled = true; };
  }, []);

  return { profile, plan, setPlan, history, loaded, email };
}

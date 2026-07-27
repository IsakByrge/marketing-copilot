"use client";

// ─────────────────────────────────────────────────────────────────────
// Översikt (Overview) — the operational management view.
//
// Follows the locked IA (Översikt = "Vad är viktigast just nu?") and the
// Product Experience Foundation / Design System 2.0: recommendations lead,
// supporting status follows, and anything without real backing is shown as
// an honest empty/locked state. No fabricated KPIs, revenue or channel data.
//
// Real business logic (profile + latest plan + generate-plan) is preserved
// unchanged from the previous dashboard; the presentation is rebuilt on the
// light emerald AppShell + primitives.
// ─────────────────────────────────────────────────────────────────────
import { useState } from "react";
import AppShell from "@/app/_shared/AppShell";
import { ButtonLink, EmptyState, Skeleton } from "@/app/_shared/primitives";
import { IconCompany } from "@/app/_shared/icons";
import { useAccountData } from "@/app/_shared/useAccountData";
import { useCompanyBrain } from "@/app/_shared/useCompanyBrain";
import { computeCompleteness, topKnowledgeGaps } from "@/app/_shared/companyBrain";
import { createClient } from "@/lib/supabase-browser";
import { recommendations, briefSummary, type OverviewState } from "./_components/overviewLogic";
import { RecommendationStack } from "./_components/RecommendationStack";
import { CompanyBrainCard } from "./_components/CompanyBrainCard";
import { PlanSummaryCard } from "./_components/PlanSummaryCard";
import { PerformanceLockedPanel } from "./_components/PerformanceLockedPanel";

function firstNameFromEmail(email: string | null): string | null {
  if (!email) return null;
  const first = email.split("@")[0]?.split(/[._\-+0-9]+/).filter(Boolean)[0];
  return first ? first.charAt(0).toUpperCase() + first.slice(1).toLowerCase() : null;
}

function timeGreeting(): string {
  const h = new Date().getHours();
  if (h < 10) return "God morgon";
  if (h < 18) return "God eftermiddag";
  return "God kväll";
}

export default function OverviewPage() {
  const { profile, plan, setPlan, loaded: accountLoaded, email } = useAccountData();
  const { brain, loaded: brainLoaded } = useCompanyBrain();
  const [generating, setGenerating] = useState(false);

  const loaded = accountLoaded && brainLoaded;

  // Real business logic — unchanged from the previous dashboard.
  async function generatePlan() {
    if (!profile) return;
    setGenerating(true);
    try {
      const savedFiles = localStorage.getItem("marketing-copilot-brain-files");
      const brainFiles = savedFiles ? JSON.parse(savedFiles) : [];
      const sb = createClient();
      const { data: { user } } = await sb.auth.getUser();

      const response = await fetch("/api/generate-plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ companyProfile: profile, brainFiles }),
      });
      if (!response.ok) throw new Error("Kunde inte generera plan.");
      const newPlan = await response.json();
      localStorage.setItem("marketing-copilot-plan", JSON.stringify(newPlan));
      setPlan(newPlan);

      try {
        if (!user) throw new Error("Ingen inloggad användare");
        const { data: company } = await sb
          .from("companies")
          .upsert({
            name: profile.companyName, industry: profile.industry, summary: profile.summary,
            customers: profile.customers, products: profile.products, tone: profile.tone,
            strengths: profile.strengths, avoid: profile.avoid,
            content_guidelines: profile.contentGuidelines, user_id: user.id,
          }, { onConflict: "user_id,name" })
          .select().single();

        if (company) {
          await sb.from("plans").insert({
            company_id: company.id, user_id: user.id,
            focus: newPlan.focus, tags: newPlan.tags, posts: newPlan.posts,
            newsletter: newPlan.newsletter, campaigns: newPlan.campaigns,
            opportunities: newPlan.opportunities,
          });

          const savedRhythm = localStorage.getItem("marketing-copilot-rhythm");
          if (savedRhythm) {
            await sb.from("marketing_rhythm").upsert({
              company_id: company.id, user_id: user.id, rhythm: savedRhythm,
            }, { onConflict: "company_id" });
          }
        }
      } catch (sbError) {
        console.warn("Supabase sync misslyckades:", sbError);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setGenerating(false);
    }
  }

  const workspaceName = profile?.companyName ?? null;

  return (
    <AppShell workspaceName={workspaceName}>
      {!loaded ? (
        <LoadingState />
      ) : !profile ? (
        <EmptyState
          icon={<IconCompany size={22} />}
          title="Låt din marknadschef lära känna företaget"
          body="Innan du får rekommendationer behöver din marknadschef en företagsprofil att utgå från."
          action={<ButtonLink href="/onboarding">Starta onboarding</ButtonLink>}
        />
      ) : (
        <Overview
          state={buildState(profile.companyName, brain, plan)}
          greetingName={firstNameFromEmail(email) ?? profile.companyName.split(" ")[0]}
          brainLevel={computeCompleteness(brain).level}
          gaps={topKnowledgeGaps(brain, 3).map((g) => g.question)}
          plan={plan}
          generating={generating}
          onGeneratePlan={generatePlan}
        />
      )}
    </AppShell>
  );
}

function buildState(
  companyName: string,
  brain: ReturnType<typeof useCompanyBrain>["brain"],
  plan: ReturnType<typeof useAccountData>["plan"],
): OverviewState {
  return {
    hasCompany: true,
    companyName,
    brainLevel: computeCompleteness(brain).level,
    gapCount: topKnowledgeGaps(brain, 3).length,
    hasPlan: Boolean(plan?.focus),
    opportunities: (plan?.opportunities ?? []).map((o) => ({ title: o.title, relevance: o.relevance })),
  };
}

function Overview({
  state,
  greetingName,
  brainLevel,
  gaps,
  plan,
  generating,
  onGeneratePlan,
}: {
  state: OverviewState;
  greetingName: string;
  brainLevel: "basic" | "useful" | "strong";
  gaps: string[];
  plan: ReturnType<typeof useAccountData>["plan"];
  generating: boolean;
  onGeneratePlan: () => void;
}) {
  const items = recommendations(state);
  return (
    <div className="flex flex-col gap-8">
      <header>
        <h1 className="text-[28px] font-semibold leading-tight text-text-primary sm:text-[32px]">
          {timeGreeting()}, {greetingName} <span aria-hidden>👋</span>
        </h1>
        <p className="mt-1 text-sm text-text-secondary">{briefSummary(state)}</p>
      </header>

      <RecommendationStack items={items} onGeneratePlan={onGeneratePlan} generating={generating} />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <CompanyBrainCard level={brainLevel} gaps={gaps} />
        <PlanSummaryCard
          focus={plan?.focus ?? null}
          tags={plan?.tags ?? []}
          postCount={plan ? plan.posts.length : 0}
          campaignCount={plan ? plan.campaigns.length : 0}
          onGeneratePlan={onGeneratePlan}
          generating={generating}
        />
      </div>

      <PerformanceLockedPanel />
    </div>
  );
}

function LoadingState() {
  return (
    <div className="flex flex-col gap-8" aria-busy>
      <div className="flex flex-col gap-2">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-4 w-80" />
      </div>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        {[0, 1, 2].map((i) => (
          <Skeleton key={i} shape="block" className="h-56" />
        ))}
      </div>
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Skeleton shape="block" className="h-48" />
        <Skeleton shape="block" className="h-48" />
      </div>
    </div>
  );
}

"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

type Campaign = {
  title: string;
  goal: string;
  message: string;
  channels: string;
  cta: string;
};

type MarketingPlan = {
  company: string;
  focus: string;
  campaigns?: Campaign[];
};

export default function CampaignPage() {
  const [plan, setPlan] = useState<MarketingPlan | null>(null);

  useEffect(() => {
    const savedPlan = localStorage.getItem("marketing-copilot-plan");

    if (!savedPlan) return;

    try {
      setPlan(JSON.parse(savedPlan));
    } catch (error) {
      console.error(error);
    }
  }, []);

  if (!plan) {
    return (
      <main className="min-h-screen bg-[#F8F6F2] px-6 py-8 text-[#111111]">
        <div className="mx-auto max-w-4xl">
          <p>Laddar kampanj...</p>
        </div>
      </main>
    );
  }

  const campaign = plan.campaigns?.[0];

  if (!campaign) {
    return (
      <main className="min-h-screen bg-[#F8F6F2] px-6 py-8 text-[#111111]">
        <div className="mx-auto max-w-4xl">
          <Link href="/plan" className="text-sm font-medium text-neutral-600">
            ← Till planen
          </Link>

          <p className="mt-16 text-xl">Det finns ingen kampanj i planen.</p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#F8F6F2] px-6 py-8 text-[#111111]">
      <div className="mx-auto max-w-4xl">
        <nav className="mb-20 flex items-center justify-between">
          <Link href="/plan" className="text-sm font-medium text-neutral-600">
            ← Till planen
          </Link>

          <button className="rounded-full bg-[#111111] px-5 py-3 text-sm font-medium text-white">
            Kopiera kampanj
          </button>
        </nav>

        <section className="mb-20">
          <p className="mb-6 text-sm font-medium text-neutral-500">
            {plan.company} · Kampanjidé
          </p>

          <h1 className="max-w-4xl text-6xl font-semibold leading-[0.95] tracking-[-0.06em] md:text-8xl">
            {campaign.title}
          </h1>

          <p className="mt-10 max-w-3xl text-2xl leading-10 tracking-tight text-neutral-700 md:text-3xl md:leading-[1.35]">
            En kampanjbrief genererad av AI med mål, budskap, kanalval och CTA.
          </p>
        </section>

        <section className="border-y border-black/10 py-12">
          <ContentBlock label="Mål">{campaign.goal}</ContentBlock>

          <ContentBlock label="Budskap">{campaign.message}</ContentBlock>

          <ContentBlock label="Kanaler">{campaign.channels}</ContentBlock>

          <ContentBlock label="CTA">{campaign.cta}</ContentBlock>
        </section>

        <section className="mt-12 flex flex-wrap gap-3">
          <button className="rounded-full bg-[#111111] px-6 py-3 text-sm font-medium text-white">
            Kopiera
          </button>

          <button className="rounded-full border border-black/10 bg-white px-6 py-3 text-sm font-medium">
            👍 Bra
          </button>

          <button className="rounded-full border border-black/10 bg-white px-6 py-3 text-sm font-medium">
            👎 Mindre bra
          </button>
        </section>
      </div>
    </main>
  );
}

function ContentBlock({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="border-b border-black/10 py-10 last:border-b-0">
      <p className="mb-4 text-xs font-semibold uppercase tracking-[0.18em] text-neutral-400">
        {label}
      </p>

      <p className="max-w-3xl whitespace-pre-line text-2xl leading-10 tracking-tight text-neutral-700">
        {children}
      </p>
    </div>
  );
}
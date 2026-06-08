"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { plans } from "@/lib/mockPlans";

type MarketingPost = {
  title: string;
  text: string;
  cta: string;
  image: string;
};

type MarketingPlan = {
  id?: string;
  company: string;
  focus: string;
  tags: string[];
  posts: MarketingPost[];
  newsletter?: {
    subject: string;
    preview: string;
    body: string;
    cta: string;
  };
  campaigns?: {
    title: string;
    goal: string;
    message: string;
    channels: string;
    cta: string;
  }[];
};

export default function PlanPage() {
  const [plan, setPlan] = useState<MarketingPlan | null>(null);

  useEffect(() => {
    const savedPlan = localStorage.getItem("marketing-copilot-plan");

    if (savedPlan) {
      try {
        setPlan(JSON.parse(savedPlan));
        return;
      } catch {
        setPlan(plans[0]);
      }
    }

    setPlan(plans[0]);
  }, []);

  if (!plan) {
    return (
      <main className="min-h-screen bg-[#F8F6F2] px-6 py-8 text-[#111111]">
        <div className="mx-auto max-w-5xl">
          <p>Laddar plan...</p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#F8F6F2] px-6 py-8 text-[#111111]">
      <div className="mx-auto max-w-5xl">
        <nav className="mb-20 flex items-center justify-between">
          <Link href="/dashboard" className="text-sm font-medium text-neutral-600">
            ← Till dashboard
          </Link>

          <Link
            href="/create"
            className="rounded-full bg-[#111111] px-4 py-2 text-sm font-medium text-white"
          >
            Skapa direkt
          </Link>
        </nav>

        <section className="mb-20">
          <p className="mb-6 text-sm font-medium text-neutral-500">
            Vecka 24 · {plan.company}
          </p>

          <h1 className="max-w-4xl text-6xl font-semibold leading-[0.95] tracking-[-0.06em] md:text-8xl">
            {plan.focus}
          </h1>

          <p className="mt-10 max-w-3xl text-2xl leading-10 tracking-tight text-neutral-700 md:text-3xl md:leading-[1.35]">
            En färdig översikt över veckans innehåll. Öppna varje del för att
            granska, kopiera och publicera.
          </p>

          <div className="mt-10 flex flex-wrap gap-2">
            {plan.tags.map((tag) => (
              <span
                key={tag}
                className="rounded-full border border-black/10 bg-white px-4 py-2 text-sm font-medium"
              >
                {tag}
              </span>
            ))}
          </div>
        </section>

        <section className="mb-20 border-y border-black/10 py-10">
          <div className="grid gap-10 md:grid-cols-3">
            <PreparedItem value={String(plan.posts.length)} label="sociala inlägg" />
            <PreparedItem value="1" label="nyhetsbrev" />
            <PreparedItem
              value={String(plan.campaigns?.length ?? 2)}
              label="kampanjidéer"
            />
          </div>
        </section>

        <section className="mb-20">
          <div className="mb-10">
            <p className="text-sm font-medium text-neutral-500">
              Sociala medier
            </p>

            <h2 className="mt-3 text-4xl font-semibold tracking-tight">
              Inlägg redo att publiceras
            </h2>
          </div>

          <div className="space-y-4">
            {plan.posts.map((post, index) => (
              <Link
                key={`${post.title}-${index}`}
                href={`/post/${index + 1}`}
                className="flex items-center justify-between rounded-3xl border border-black/10 bg-white p-6 transition hover:border-black/30"
              >
                <div>
                  <p className="text-sm text-neutral-500">Inlägg {index + 1}</p>

                  <h3 className="mt-2 text-2xl font-semibold">{post.title}</h3>
                </div>

                <span className="font-medium">Öppna →</span>
              </Link>
            ))}
          </div>
        </section>

        <section className="mb-20 border-t border-black/10 pt-12">
          <div className="grid gap-8 md:grid-cols-[0.4fr_1fr] md:items-center">
            <div>
              <p className="text-sm font-medium text-neutral-500">
                Nyhetsbrev
              </p>
              <h2 className="mt-3 text-4xl font-semibold tracking-tight">
                Färdigt kundutskick
              </h2>
            </div>

            <Link
              href="/newsletter"
              className="rounded-3xl border border-black/10 bg-white p-6 transition hover:border-black/30"
            >
              <p className="text-sm text-neutral-500">Ämnesrad</p>
              <h3 className="mt-2 text-2xl font-semibold">
                {plan.newsletter?.subject ??
                  `Är du redo för ${plan.focus.toLowerCase()}?`}
              </h3>
              <p className="mt-4 font-medium">Öppna →</p>
            </Link>
          </div>
        </section>

        <section className="mb-20 border-t border-black/10 pt-12">
          <div className="grid gap-8 md:grid-cols-[0.4fr_1fr]">
            <div>
              <p className="text-sm font-medium text-neutral-500">
                Kampanjidéer
              </p>
              <h2 className="mt-3 text-4xl font-semibold tracking-tight">
                Två enkla sätt att agera
              </h2>
            </div>

            <div className="space-y-4">
              {(plan.campaigns ?? []).slice(0, 2).map((campaign, index) => (
                <CampaignPreview
                  key={`${campaign.title}-${index}`}
                  title={campaign.title}
                  text={campaign.message}
                />
              ))}

              {!plan.campaigns && (
                <>
                  <CampaignPreview
                    title={`${plan.focus}: kampanjvecka`}
                    text="Kort kampanj med tydlig period och tydlig CTA."
                  />

                  <CampaignPreview
                    title="Påminnelsekampanj"
                    text="Samma tema i sociala medier och nyhetsbrev för igenkänning."
                  />
                </>
              )}
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}

function PreparedItem({ value, label }: { value: string; label: string }) {
  return (
    <div>
      <p className="text-5xl font-semibold tracking-tight">{value}</p>
      <p className="mt-2 text-neutral-600">{label}</p>
    </div>
  );
}

function CampaignPreview({ title, text }: { title: string; text: string }) {
  return (
    <Link
      href="/campaign"
      className="block rounded-3xl border border-black/10 bg-white p-6 transition hover:border-black/30"
    >
      <h3 className="text-2xl font-semibold">{title}</h3>
      <p className="mt-3 text-neutral-600">{text}</p>
      <p className="mt-4 font-medium">Öppna →</p>
    </Link>
  );
}
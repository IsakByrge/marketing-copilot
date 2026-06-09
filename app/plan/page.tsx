"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

type MarketingPlan = {
  company: string;
  focus: string;
  tags: string[];
  posts: {
    title: string;
    text: string;
    cta: string;
    image: string;
  }[];
  newsletter: {
    subject: string;
    preview: string;
    body: string;
    cta: string;
  };
  campaigns: {
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
          <Link href="/dashboard" className="text-sm font-medium text-neutral-600">
            ← Till dashboard
          </Link>

          <p className="mt-16 text-xl">
            Ingen plan hittades. Gå till dashboard och generera en plan.
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#F8F6F2] px-6 py-8 text-[#111111]">
      <div className="mx-auto max-w-5xl">
        <nav className="mb-16 flex items-center justify-between">
          <Link href="/dashboard" className="text-sm font-medium text-neutral-600">
            ← Till dashboard
          </Link>
        </nav>

        <section className="mb-16">
          <p className="mb-6 text-sm font-medium text-neutral-500">
            Marknadsplan
          </p>

          <h1 className="max-w-4xl text-6xl font-semibold leading-[0.95] tracking-[-0.06em] md:text-8xl">
            Din plan för {plan.company}.
          </h1>

          <p className="mt-10 max-w-3xl text-2xl leading-10 tracking-tight text-neutral-700 md:text-3xl md:leading-[1.35]">
            {plan.focus}
          </p>

          <div className="mt-8 flex flex-wrap gap-2">
            {plan.tags.map((tag, index) => (
              <span
                key={`${tag}-${index}`}
                className="rounded-full border border-black/10 px-4 py-2 text-sm text-neutral-600"
              >
                {tag}
              </span>
            ))}
          </div>
        </section>

        <section className="grid gap-4">
          {plan.posts.map((post, index) => (
            <Link
              key={`${post.title}-${index}`}
              href={`/post/${index}`}
              className="rounded-3xl border border-black/10 bg-white/60 p-8 transition hover:bg-white"
            >
              <p className="mb-3 text-sm font-medium text-neutral-400">
                Inlägg {index + 1}
              </p>

              <h2 className="text-3xl font-semibold tracking-tight">
                {post.title}
              </h2>

              <p className="mt-4 max-w-3xl text-lg leading-8 text-neutral-700">
                {post.text}
              </p>

              <p className="mt-6 text-sm font-medium text-neutral-900">
                {post.cta}
              </p>
            </Link>
          ))}
        </section>

        <section className="mt-16 grid gap-4 md:grid-cols-2">
          <Link
            href="/newsletter"
            className="rounded-3xl border border-black/10 bg-white/60 p-8 transition hover:bg-white"
          >
            <p className="mb-3 text-sm font-medium text-neutral-400">
              Nyhetsbrev
            </p>
            <h2 className="text-3xl font-semibold tracking-tight">
              {plan.newsletter?.subject ?? "Nyhetsbrev"}
            </h2>
          </Link>

          <Link
            href="/campaign"
            className="rounded-3xl border border-black/10 bg-white/60 p-8 transition hover:bg-white"
          >
            <p className="mb-3 text-sm font-medium text-neutral-400">
              Kampanj
            </p>
            <h2 className="text-3xl font-semibold tracking-tight">
              {plan.campaigns?.[0]?.title ?? "Kampanj"}
            </h2>
          </Link>
        </section>
      </div>
    </main>
  );
}
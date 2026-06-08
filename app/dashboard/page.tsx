"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { companies, plans } from "@/lib/mockPlans";

export default function DashboardPage() {
  const [selectedCompany, setSelectedCompany] = useState(companies[0].name);
  const [planIndex, setPlanIndex] = useState(0);

  const companyPlans = useMemo(
    () => plans.filter((plan) => plan.company === selectedCompany),
    [selectedCompany]
  );

  const plan = companyPlans[planIndex] ?? companyPlans[0];

  function changeCompany(company: string) {
    setSelectedCompany(company);
    setPlanIndex(0);
  }

  function nextPlan() {
    setPlanIndex((prev) => (prev + 1 >= companyPlans.length ? 0 : prev + 1));
  }

  const planHref = `/plan?company=${encodeURIComponent(
    selectedCompany
  )}&plan=${planIndex}`;

  return (
    <main className="min-h-screen bg-[#F8F6F2] text-neutral-950">
      <div className="mx-auto max-w-7xl px-6 py-8">
        <nav className="mb-8 flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-sm text-neutral-500">Aktivt företag</p>
            <select
              value={selectedCompany}
              onChange={(e) => changeCompany(e.target.value)}
              className="mt-1 rounded-2xl border border-neutral-200 bg-white px-4 py-3 font-semibold shadow-sm"
            >
              {companies.map((company) => (
                <option key={company.name} value={company.name}>
                  {company.name}
                </option>
              ))}
            </select>
          </div>

          <div className="flex gap-3">
            <Link
              href="/create"
              className="rounded-full bg-white px-5 py-3 text-sm font-medium shadow-sm"
            >
              + Skapa direkt
            </Link>

            <button
              onClick={nextPlan}
              className="rounded-full bg-neutral-950 px-5 py-3 text-sm font-medium text-white"
            >
              Generera ny plan
            </button>
          </div>
        </nav>

        <section className="mb-8 rounded-[2rem] bg-white p-8 shadow-sm">
          <p className="text-sm font-medium text-green-700">
            Vecka 24 • Autopilot aktiv
          </p>

          <div className="mt-5 grid gap-8 lg:grid-cols-[1.4fr_1fr] lg:items-end">
            <div>
              <h1 className="max-w-3xl text-5xl font-bold tracking-tight">
                {selectedCompany}
                <br />
                Marknadsplanen är klar.
              </h1>

              <p className="mt-5 max-w-2xl text-lg leading-8 text-neutral-600">
                AI:n har tagit fram veckans innehåll baserat på bransch,
                säsong och företagets fokusområden.
              </p>

              <div className="mt-8 flex flex-wrap gap-3">
                <Link
                  href={planHref}
                  className="rounded-2xl bg-neutral-950 px-6 py-4 font-medium text-white"
                >
                  Granska veckans plan
                </Link>

                <button
                  onClick={nextPlan}
                  className="rounded-2xl border border-neutral-300 px-6 py-4 font-medium"
                >
                  Testa annan plan
                </button>
              </div>
            </div>

            <div className="rounded-3xl bg-[#EDF7EF] p-6">
              <p className="text-sm font-medium text-green-800">
                Rekommenderat fokus
              </p>
              <h2 className="mt-2 text-3xl font-bold">{plan.focus}</h2>

              <div className="mt-5 flex flex-wrap gap-2">
                {plan.tags.map((tag) => (
                  <span
                    key={tag}
                    className="rounded-full bg-white px-4 py-2 text-sm font-medium text-neutral-800"
                  >
                    {tag}
                  </span>
                ))}
              </div>

              <p className="mt-5 text-sm text-green-900/70">
                Plan {planIndex + 1} av {companyPlans.length}
              </p>
            </div>
          </div>
        </section>

        <section className="mb-8 grid gap-5 md:grid-cols-3">
          <Stat title="Sociala inlägg" value="5" />
          <Stat title="Nyhetsbrev" value="1" />
          <Stat title="Kampanjidéer" value="2" />
        </section>

        <section className="rounded-[2rem] bg-white p-7 shadow-sm">
          <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="text-sm font-medium text-neutral-500">
                Förhandsvisning
              </p>
              <h2 className="text-2xl font-bold">
                Veckans färdiga innehåll
              </h2>
            </div>

            <Link href={planHref} className="text-sm font-medium">
              Visa hela planen →
            </Link>
          </div>

          <div className="grid gap-4 lg:grid-cols-3">
            {plan.posts.map((post, index) => (
              <Link
                key={`${plan.id}-${post.title}`}
                href={`${planHref}#post-${index + 1}`}
                className="group rounded-3xl border border-neutral-200 bg-[#FAFAFA] p-5 transition hover:border-neutral-950 hover:bg-white"
              >
                <div className="mb-4 flex items-center justify-between">
                  <p className="rounded-full bg-[#EDF7EF] px-3 py-1 text-sm font-medium text-green-800">
                    Inlägg {index + 1}
                  </p>
                  <span className="text-sm text-neutral-400 group-hover:text-neutral-950">
                    Öppna →
                  </span>
                </div>

                <h3 className="text-xl font-bold">{post.title}</h3>

                <p className="mt-3 line-clamp-3 text-sm leading-6 text-neutral-600">
                  {post.text}
                </p>

                <div className="mt-5 rounded-2xl bg-white p-4">
                  <p className="text-xs font-bold uppercase tracking-wide text-neutral-400">
                    CTA
                  </p>
                  <p className="mt-1 text-sm font-medium">{post.cta}</p>
                </div>
              </Link>
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}

function Stat({ title, value }: { title: string; value: string }) {
  return (
    <div className="rounded-[2rem] bg-white p-6 shadow-sm">
      <p className="text-sm text-neutral-500">{title}</p>
      <p className="mt-2 text-4xl font-bold">{value}</p>
      <p className="mt-1 text-sm text-green-700">Redo att granska</p>
    </div>
  );
}
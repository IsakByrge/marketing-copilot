"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { companies, plans } from "@/lib/mockPlans";

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
};

export default function DashboardPage() {
  const [selectedCompany, setSelectedCompany] = useState(companies[0].name);
  const [planIndex, setPlanIndex] = useState(0);
  const [aiPlan, setAiPlan] = useState<MarketingPlan | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  useEffect(() => {
  const savedPlan = localStorage.getItem("marketing-copilot-plan");

  if (savedPlan) {
    setAiPlan(JSON.parse(savedPlan));
  }
}, []);

  const companyPlans = useMemo(
    () => plans.filter((plan) => plan.company === selectedCompany),
    [selectedCompany]
  );

  const fallbackPlan = companyPlans[planIndex] ?? companyPlans[0] ?? plans[0];
  const activePlan = aiPlan ?? fallbackPlan;

  const planHref = `/plan?company=${encodeURIComponent(
    activePlan.company
  )}&plan=${planIndex}`;

  function changeCompany(company: string) {
    setSelectedCompany(company);
    setPlanIndex(0);
    setAiPlan(null);
  }

  async function generateAiPlan() {
    try {
      setIsGenerating(true);

      const response = await fetch("/api/generate-plan", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          company: selectedCompany,
          industry: selectedCompany === "Gasolfyllarna" ? "Gasol" : "Webshop",
          focus: activePlan.focus,
        }),
      });

      if (!response.ok) {
        throw new Error("Kunde inte generera plan");
      }

      const data = await response.json();

      const newPlan = {
  id: "ai-generated-plan",
  company: data.company,
  focus: data.focus,
  tags: data.tags ?? [],
  posts: data.posts ?? [],
  newsletter: data.newsletter,
  campaigns: data.campaigns,
};

setAiPlan(newPlan);
localStorage.setItem("marketing-copilot-plan", JSON.stringify(newPlan));
    } catch (error) {
      console.error(error);
      alert("Kunde inte generera plan.");
    } finally {
      setIsGenerating(false);
    }
  }

  return (
    <main className="min-h-screen bg-[#F8F6F2] text-[#111111]">
      <div className="mx-auto max-w-6xl px-6 py-8 md:py-10">
        <nav className="mb-20 flex items-center justify-between">
          <Link href="/" className="text-sm font-medium tracking-tight">
            Marketing Copilot
          </Link>

          <div className="flex items-center gap-3">
            <select
              value={selectedCompany}
              onChange={(e) => changeCompany(e.target.value)}
              className="rounded-full border border-black/10 bg-white px-4 py-2 text-sm font-medium outline-none"
            >
              {companies.map((company) => (
                <option key={company.name} value={company.name}>
                  {company.name}
                </option>
              ))}
            </select>

            <Link
              href="/create"
              className="rounded-full bg-[#111111] px-4 py-2 text-sm font-medium text-white"
            >
              Skapa direkt
            </Link>
          </div>
        </nav>

        <section className="mb-28">
          <p className="mb-6 text-sm font-medium text-neutral-500">
            Måndagsbriefing · Vecka 24
          </p>

          <h1 className="max-w-4xl text-6xl font-semibold leading-[0.95] tracking-[-0.06em] md:text-8xl">
            Din marknadsplan är klar.
          </h1>

          <div className="mt-10 max-w-3xl">
            <p className="text-2xl leading-10 tracking-tight text-neutral-700 md:text-3xl md:leading-[1.35]">
              För{" "}
              <span className="font-semibold text-black">
                {activePlan.company}
              </span>{" "}
              rekommenderar AI:n fokus på{" "}
              <span className="font-semibold text-black">
                {activePlan.focus}
              </span>
              .
            </p>

            <p className="mt-6 text-lg leading-8 text-neutral-600">
              Campingresor, sommarplanering och köpbeslut sker nu. Det här är
              rätt vecka att synas med tydliga, enkla budskap.
            </p>
          </div>

          <div className="mt-10 flex flex-wrap gap-3">
            <Link
              href={planHref}
              className="rounded-full bg-[#111111] px-7 py-4 text-sm font-semibold text-white transition hover:bg-black/80"
            >
              Granska planen
            </Link>

            <button
              onClick={generateAiPlan}
              disabled={isGenerating}
              className="rounded-full border border-black/10 bg-white px-7 py-4 text-sm font-semibold transition hover:border-black/30 disabled:opacity-50"
            >
              {isGenerating ? "Genererar..." : "Generera ny plan"}
            </button>
          </div>
        </section>

        <section className="mb-24 border-t border-black/10 pt-10">
          <div className="grid gap-12 md:grid-cols-[0.75fr_1.25fr]">
            <div>
              <p className="text-sm font-medium text-neutral-500">
                Veckans fokus
              </p>
              <h2 className="mt-3 text-4xl font-semibold tracking-tight">
                {activePlan.focus}
              </h2>
            </div>

            <div className="space-y-8">
              <BriefingItem
                title="Varför nu?"
                text="Kunderna planerar semester, grillning och inköp. Det gör veckan extra relevant för tydlig och praktisk kommunikation."
              />

              <BriefingItem
                title="AI rekommenderar"
                text={`Fokusera på ${activePlan.tags
                  .join(", ")
                  .toLowerCase()} och gör det enkelt för kunden att agera.`}
              />

              <BriefingItem
                title="Målet"
                text="Skapa synlighet utan att det känns stressigt, säljigt eller generiskt."
              />
            </div>
          </div>
        </section>

        <section className="mb-24">
          <div className="mb-8 flex items-end justify-between gap-6">
            <div>
              <p className="text-sm font-medium text-neutral-500">
                Klart att publicera
              </p>
              <h2 className="mt-3 text-4xl font-semibold tracking-tight">
                Veckans innehåll
              </h2>
            </div>

            <Link
              href={planHref}
              className="hidden text-sm font-semibold text-neutral-700 hover:text-black md:block"
            >
              Visa allt →
            </Link>
          </div>

          <div className="grid gap-4">
            {activePlan.posts.map((post: MarketingPost, index: number) => (
              <Link
                key={`${activePlan.id ?? "plan"}-${post.title}`}
                href={`${planHref}#post-${index + 1}`}
                className="group grid gap-6 rounded-[2rem] border border-black/10 bg-white p-6 transition hover:border-black/30 md:grid-cols-[0.2fr_1fr_0.3fr] md:items-center md:p-8"
              >
                <p className="text-sm font-medium text-neutral-500">
                  0{index + 1}
                </p>

                <div>
                  <p className="mb-3 text-sm font-medium text-neutral-500">
                    Socialt inlägg
                  </p>

                  <h3 className="text-3xl font-semibold tracking-tight">
                    {post.title}
                  </h3>

                  <p className="mt-4 max-w-2xl leading-7 text-neutral-600">
                    {post.text}
                  </p>
                </div>

                <div className="text-left md:text-right">
                  <span className="text-sm font-semibold text-neutral-500 group-hover:text-black">
                    Öppna →
                  </span>
                </div>
              </Link>
            ))}
          </div>
        </section>

        <section className="mb-24 rounded-[2rem] bg-[#111111] p-8 text-white md:p-10">
          <div className="grid gap-10 md:grid-cols-[0.8fr_1.2fr] md:items-end">
            <div>
              <p className="text-sm font-medium text-white/50">
                Leverans denna vecka
              </p>

              <h2 className="mt-3 text-4xl font-semibold tracking-tight">
                Allt är förberett.
              </h2>
            </div>

            <div className="grid gap-4 md:grid-cols-3">
              <Delivery title="Sociala inlägg" value="5" />
              <Delivery title="Nyhetsbrev" value="1" />
              <Delivery title="Kampanjidéer" value="2" />
            </div>
          </div>
        </section>

        <section className="border-t border-black/10 pt-10">
          <div className="grid gap-8 md:grid-cols-[0.8fr_1.2fr] md:items-start">
            <div>
              <p className="text-sm font-medium text-neutral-500">
                Behöver du något utöver veckoplanen?
              </p>

              <h2 className="mt-3 text-4xl font-semibold tracking-tight">
                Skapa något direkt.
              </h2>
            </div>

            <div className="grid gap-3 md:grid-cols-3">
              <QuickCreate title="Kampanj" />
              <QuickCreate title="Socialt inlägg" />
              <QuickCreate title="Nyhetsbrev" />
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}

function BriefingItem({ title, text }: { title: string; text: string }) {
  return (
    <div className="border-b border-black/10 pb-8">
      <h3 className="text-xl font-semibold tracking-tight">{title}</h3>
      <p className="mt-3 max-w-2xl leading-7 text-neutral-600">{text}</p>
    </div>
  );
}

function Delivery({ title, value }: { title: string; value: string }) {
  return (
    <div className="rounded-3xl bg-white/10 p-5">
      <p className="text-4xl font-semibold">{value}</p>
      <p className="mt-2 text-sm text-white/60">{title}</p>
    </div>
  );
}

function QuickCreate({ title }: { title: string }) {
  return (
    <Link
      href="/create"
      className="rounded-3xl border border-black/10 bg-white p-5 transition hover:border-black/30"
    >
      <p className="font-semibold">{title}</p>
      <p className="mt-2 text-sm leading-6 text-neutral-600">
        Skapa ett färdigt utkast direkt.
      </p>
    </Link>
  );
}
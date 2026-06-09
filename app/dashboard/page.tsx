"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

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

type CompanyProfile = {
  companyName: string;
  industry: string;
  summary: string;
  customers: string[];
  products: string[];
  tone: string[];
  strengths: string[];
  avoid: string[];
  contentGuidelines: string[];
};

export default function DashboardPage() {
  const [profile, setProfile] = useState<CompanyProfile | null>(null);
  const [plan, setPlan] = useState<MarketingPlan | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);

  useEffect(() => {
    const savedProfile = localStorage.getItem(
      "marketing-copilot-company-profile"
    );
    const savedPlan = localStorage.getItem("marketing-copilot-plan");

    if (savedProfile) {
      setProfile(JSON.parse(savedProfile));
    }

    if (savedPlan) {
      setPlan(JSON.parse(savedPlan));
    }
  }, []);

  async function generateAiPlan() {
    if (!profile) {
      alert("Ingen företagsprofil hittades. Börja med onboarding.");
      window.location.href = "/onboarding";
      return;
    }

    try {
      setIsGenerating(true);

      const response = await fetch("/api/generate-plan", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          companyProfile: profile,
        }),
      });

      if (!response.ok) {
        throw new Error("Kunde inte generera plan");
      }

      const data = await response.json();

      const newPlan: MarketingPlan = {
        id: "ai-generated-plan",
        company: data.company || profile.companyName,
        focus: data.focus,
        tags: data.tags ?? [],
        posts: data.posts ?? [],
        newsletter: data.newsletter,
        campaigns: data.campaigns,
      };

      setPlan(newPlan);
      localStorage.setItem("marketing-copilot-plan", JSON.stringify(newPlan));
    } catch (error) {
      console.error(error);
      alert("Kunde inte generera plan.");
    } finally {
      setIsGenerating(false);
    }
  }

  if (!profile) {
    return (
      <main className="min-h-screen bg-[#F8F6F2] px-6 py-8 text-[#111111]">
        <div className="mx-auto max-w-4xl">
          <section className="mt-20">
            <p className="mb-6 text-sm font-medium text-neutral-500">
              Marketing Copilot
            </p>

            <h1 className="max-w-4xl text-6xl font-semibold leading-[0.95] tracking-[-0.06em] md:text-8xl">
              Börja med att lära AI:n ditt företag.
            </h1>

            <p className="mt-10 max-w-3xl text-2xl leading-10 tracking-tight text-neutral-700">
              Innan Marketing Copilot kan skapa en bra plan behöver den förstå
              vilka ni är, vad ni säljer och hur ni vill låta.
            </p>

            <Link
              href="/onboarding"
              className="mt-10 inline-flex rounded-full bg-[#111111] px-7 py-4 text-sm font-semibold text-white"
            >
              Starta onboarding
            </Link>
          </section>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#F8F6F2] text-[#111111]">
      <div className="mx-auto max-w-6xl px-6 py-8 md:py-10">
        <nav className="mb-16 flex items-center justify-between">
          <Link href="/" className="text-sm font-medium tracking-tight">
            Marketing Copilot
          </Link>

          <div className="flex items-center gap-3">
            <Link
              href="/profile"
              className="rounded-full border border-black/10 bg-white px-4 py-2 text-sm font-medium"
            >
              Vad AI vet
            </Link>

            <Link
              href="/create"
              className="rounded-full bg-[#111111] px-4 py-2 text-sm font-medium text-white"
            >
              Skapa direkt
            </Link>
          </div>
        </nav>

        <section className="mb-20">
          <p className="mb-6 text-sm font-medium text-neutral-500">
            Måndagsbriefing
          </p>

          <h1 className="max-w-4xl text-6xl font-semibold leading-[0.95] tracking-[-0.06em] md:text-8xl">
            {plan ? "Din marknadsplan är klar." : "Redo att skapa din plan."}
          </h1>

          <div className="mt-10 max-w-3xl">
            {plan ? (
              <p className="text-2xl leading-10 tracking-tight text-neutral-700 md:text-3xl md:leading-[1.35]">
                För{" "}
                <span className="font-semibold text-black">
                  {plan.company}
                </span>{" "}
                rekommenderar AI:n fokus på{" "}
                <span className="font-semibold text-black">{plan.focus}</span>.
              </p>
            ) : (
              <p className="text-2xl leading-10 tracking-tight text-neutral-700 md:text-3xl md:leading-[1.35]">
                AI:n har lärt känna{" "}
                <span className="font-semibold text-black">
                  {profile.companyName}
                </span>
                . Nu kan du skapa första marknadsplanen.
              </p>
            )}

            <p className="mt-6 text-lg leading-8 text-neutral-600">
              {profile.summary}
            </p>
          </div>

          <div className="mt-10 flex flex-wrap gap-3">
            {plan && (
              <Link
                href="/plan"
                className="rounded-full bg-[#111111] px-7 py-4 text-sm font-semibold text-white transition hover:bg-black/80"
              >
                Granska planen
              </Link>
            )}

            <button
              onClick={generateAiPlan}
              disabled={isGenerating}
              className="rounded-full border border-black/10 bg-white px-7 py-4 text-sm font-semibold transition hover:border-black/30 disabled:opacity-50"
            >
              {isGenerating
                ? "Genererar..."
                : plan
                  ? "Generera ny plan"
                  : "Generera första planen"}
            </button>
          </div>
        </section>

        {plan && (
          <section className="mb-20 border-t border-black/10 pt-10">
            <div className="grid gap-12 md:grid-cols-[0.75fr_1.25fr]">
              <div>
                <p className="text-sm font-medium text-neutral-500">
                  Veckans fokus
                </p>
                <h2 className="mt-3 text-4xl font-semibold tracking-tight">
                  {plan.focus}
                </h2>
              </div>

              <div className="space-y-8">
                <BriefingItem
                  title="AI rekommenderar"
                  text={`Fokusera på ${plan.tags
                    .join(", ")
                    .toLowerCase()} och gör det enkelt för kunden att agera.`}
                />

                <BriefingItem
                  title="Bygger på företagsprofilen"
                  text={`Tonen ska vara ${profile.tone
                    .join(", ")
                    .toLowerCase()} och undvika ${profile.avoid
                    .join(", ")
                    .toLowerCase()}.`}
                />

                <BriefingItem
                  title="Målet"
                  text="Skapa synlighet utan att det känns stressigt, säljigt eller generiskt."
                />
              </div>
            </div>
          </section>
        )}

        {plan && (
          <section className="mb-20">
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
                href="/plan"
                className="hidden text-sm font-semibold text-neutral-700 hover:text-black md:block"
              >
                Visa allt →
              </Link>
            </div>

            <div className="grid gap-4">
              {plan.posts.map((post, index) => (
                <Link
                  key={`${post.title}-${index}`}
                  href={`/post/${index + 1}`}
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
        )}

        <section className="border-t border-black/10 pt-10">
          <div className="grid gap-8 md:grid-cols-[0.8fr_1.2fr] md:items-start">
            <div>
              <p className="text-sm font-medium text-neutral-500">
                Vad AI vet om företaget
              </p>

              <h2 className="mt-3 text-4xl font-semibold tracking-tight">
                {profile.companyName}
              </h2>
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              <ProfileCard title="Bransch" items={[profile.industry]} />
              <ProfileCard title="Kunder" items={profile.customers} />
              <ProfileCard title="Ton" items={profile.tone} />
              <ProfileCard title="Undvik" items={profile.avoid} />
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

function ProfileCard({ title, items }: { title: string; items: string[] }) {
  return (
    <div className="rounded-3xl border border-black/10 bg-white p-5">
      <p className="mb-3 text-xs font-semibold uppercase tracking-[0.18em] text-neutral-400">
        {title}
      </p>

      <div className="space-y-2">
        {items.map((item, index) => (
          <p key={`${item}-${index}`} className="text-neutral-700">
            {item}
          </p>
        ))}
      </div>
    </div>
  );
}
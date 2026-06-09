"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

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

export default function ProfilePage() {
  const [profile, setProfile] = useState<CompanyProfile | null>(null);

  useEffect(() => {
    const savedProfile = localStorage.getItem(
      "marketing-copilot-company-profile"
    );

    if (!savedProfile) return;

    try {
      setProfile(JSON.parse(savedProfile));
    } catch (error) {
      console.error(error);
    }
  }, []);

  if (!profile) {
    return (
      <main className="min-h-screen bg-[#F8F6F2] px-6 py-8 text-[#111111]">
        <div className="mx-auto max-w-4xl">
          <Link href="/onboarding" className="text-sm font-medium text-neutral-600">
            ← Till onboarding
          </Link>

          <p className="mt-16 text-xl">
            Ingen AI-profil hittades. Gå tillbaka och analysera företaget.
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#F8F6F2] px-6 py-8 text-[#111111]">
      <div className="mx-auto max-w-5xl">
        <nav className="mb-20 flex items-center justify-between">
          <Link href="/onboarding" className="text-sm font-medium text-neutral-600">
            ← Redigera
          </Link>

          <Link
            href="/dashboard"
            className="rounded-full bg-[#111111] px-5 py-3 text-sm font-medium text-white"
          >
            Det stämmer
          </Link>
        </nav>

        <section className="mb-20">
          <p className="mb-6 text-sm font-medium text-neutral-500">
            AI-företagsprofil
          </p>

          <h1 className="max-w-4xl text-6xl font-semibold leading-[0.95] tracking-[-0.06em] md:text-8xl">
            Vad AI vet om {profile.companyName}.
          </h1>

          <p className="mt-10 max-w-3xl text-2xl leading-10 tracking-tight text-neutral-700 md:text-3xl md:leading-[1.35]">
            {profile.summary}
          </p>
        </section>

        <section className="border-y border-black/10 py-12">
          <ProfileSection title="Bransch" items={[profile.industry]} />
          <ProfileSection title="Kunder" items={profile.customers} />
          <ProfileSection title="Produkter och tjänster" items={profile.products} />
          <ProfileSection title="Tonalitet" items={profile.tone} />
          <ProfileSection title="Styrkor" items={profile.strengths} />
          <ProfileSection title="Undvik" items={profile.avoid} />
          <ProfileSection
            title="Riktlinjer för innehåll"
            items={profile.contentGuidelines}
          />
        </section>
      </div>
    </main>
  );
}

function ProfileSection({
  title,
  items,
}: {
  title: string;
  items: string[];
}) {
  return (
    <div className="grid gap-6 border-b border-black/10 py-10 last:border-b-0 md:grid-cols-[0.35fr_1fr]">
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-neutral-400">
        {title}
      </p>

      <div className="space-y-3">
        {items.map((item, index) => (
          <p
            key={`${item}-${index}`}
            className="text-2xl leading-10 tracking-tight text-neutral-700"
          >
            {item}
          </p>
        ))}
      </div>
    </div>
  );
}
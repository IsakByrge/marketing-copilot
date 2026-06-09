"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

type CompanyInput = {
  companyName: string;
  website: string;
  industry: string;
  products: string;
  customers: string;
  tone: string;
  avoid: string;
  previousPosts: string;
};

export default function ProfilePage() {
  const [company, setCompany] = useState<CompanyInput | null>(null);

  useEffect(() => {
    const saved = localStorage.getItem("marketing-copilot-company-input");

    if (!saved) return;

    try {
      setCompany(JSON.parse(saved));
    } catch (error) {
      console.error(error);
    }
  }, []);

  if (!company) {
    return (
      <main className="min-h-screen bg-[#F8F6F2] px-6 py-8 text-[#111111]">
        <div className="mx-auto max-w-4xl">
          <Link href="/onboarding" className="text-sm font-medium text-neutral-600">
            ← Till onboarding
          </Link>

          <p className="mt-16 text-xl">
            Ingen företagsprofil hittades. Gå tillbaka och fyll i onboarding.
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
            Företagsprofil
          </p>

          <h1 className="max-w-4xl text-6xl font-semibold leading-[0.95] tracking-[-0.06em] md:text-8xl">
            Vad AI vet om {company.companyName || "företaget"}.
          </h1>

          <p className="mt-10 max-w-3xl text-2xl leading-10 tracking-tight text-neutral-700 md:text-3xl md:leading-[1.35]">
            Detta blir grunden för hur Marketing Copilot skriver, prioriterar
            och rekommenderar innehåll.
          </p>
        </section>

        <section className="border-y border-black/10 py-12">
          <ProfileBlock label="Företag">
            {company.companyName || "Ej angivet"}
          </ProfileBlock>

          <ProfileBlock label="Hemsida">
            {company.website || "Ej angivet"}
          </ProfileBlock>

          <ProfileBlock label="Bransch">
            {company.industry || "Ej angivet"}
          </ProfileBlock>

          <ProfileBlock label="Vad ni säljer">
            {company.products || "Ej angivet"}
          </ProfileBlock>

          <ProfileBlock label="Kunder">
            {company.customers || "Ej angivet"}
          </ProfileBlock>

          <ProfileBlock label="Tonalitet">
            {company.tone || "Ej angivet"}
          </ProfileBlock>

          <ProfileBlock label="Undvik">
            {company.avoid || "Ej angivet"}
          </ProfileBlock>

          <ProfileBlock label="Tidigare inlägg">
            {company.previousPosts || "Inga tidigare inlägg tillagda ännu."}
          </ProfileBlock>
        </section>
      </div>
    </main>
  );
}

function ProfileBlock({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="border-b border-black/10 py-8 last:border-b-0">
      <p className="mb-3 text-xs font-semibold uppercase tracking-[0.18em] text-neutral-400">
        {label}
      </p>

      <p className="max-w-3xl whitespace-pre-line text-2xl leading-10 tracking-tight text-neutral-700">
        {children}
      </p>
    </div>
  );
}
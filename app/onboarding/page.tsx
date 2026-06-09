"use client";

import { useState } from "react";

export default function OnboardingPage() {
  const [form, setForm] = useState({
    companyName: "",
    website: "",
    industry: "",
    products: "",
    customers: "",
    tone: "",
    avoid: "",
    previousPosts: "",
  });

  const [isAnalyzing, setIsAnalyzing] = useState(false);

  function updateField(field: string, value: string) {
    setForm((prev) => ({
      ...prev,
      [field]: value,
    }));
  }

  async function analyzeCompany() {
    try {
      setIsAnalyzing(true);

      localStorage.setItem(
        "marketing-copilot-company-input",
        JSON.stringify(form)
      );
localStorage.removeItem("marketing-copilot-plan");
      const response = await fetch("/api/analyze-company", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(form),
      });

      if (!response.ok) {
        throw new Error("Kunde inte analysera företaget");
      }

      const profile = await response.json();

      localStorage.setItem(
        "marketing-copilot-company-profile",
        JSON.stringify(profile)
      );

      window.location.href = "/profile";
    } catch (error) {
      console.error(error);
      alert("Kunde inte analysera företaget.");
    } finally {
      setIsAnalyzing(false);
    }
  }

  return (
    <main className="min-h-screen bg-[#F8F6F2] px-6 py-8 text-[#111111]">
      <div className="mx-auto max-w-4xl">
        <section className="mb-16">
          <p className="mb-6 text-sm font-medium text-neutral-500">
            Onboarding
          </p>

          <h1 className="max-w-4xl text-6xl font-semibold leading-[0.95] tracking-[-0.06em] md:text-8xl">
            Lär upp din AI-marknadschef.
          </h1>

          <p className="mt-10 max-w-3xl text-2xl leading-10 tracking-tight text-neutral-700 md:text-3xl md:leading-[1.35]">
            Berätta hur företaget fungerar, vilka kunder ni hjälper och hur ni
            vill låta. Det här blir grunden för allt innehåll.
          </p>
        </section>

        <section className="space-y-10 border-y border-black/10 py-12">
          <Field
            label="Företagsnamn"
            placeholder="Ex. Gasolfyllarna"
            value={form.companyName}
            onChange={(value) => updateField("companyName", value)}
          />

          <Field
            label="Hemsida"
            placeholder="Ex. https://gasolfyllarna.se"
            value={form.website}
            onChange={(value) => updateField("website", value)}
          />

          <Field
            label="Bransch"
            placeholder="Ex. Gasol, VVS, bilverkstad, webshop"
            value={form.industry}
            onChange={(value) => updateField("industry", value)}
          />

          <TextArea
            label="Vad säljer ni?"
            placeholder="Ex. Gasolpåfyllning, gasolflaskor och rådgivning kring säker gasolhantering."
            value={form.products}
            onChange={(value) => updateField("products", value)}
          />

          <TextArea
            label="Vilka är era kunder?"
            placeholder="Ex. Campingägare, husbilsägare, grillkunder och privatpersoner som behöver fylla på gasol."
            value={form.customers}
            onChange={(value) => updateField("customers", value)}
          />

          <TextArea
            label="Hur vill ni uppfattas?"
            placeholder="Ex. Lokala, hjälpsamma, trygga, kunniga och enkla att ha att göra med."
            value={form.tone}
            onChange={(value) => updateField("tone", value)}
          />

          <TextArea
            label="Vad vill ni undvika?"
            placeholder="Ex. Aggressivt säljspråk, clickbait, överdrivna erbjudanden och för mycket emojis."
            value={form.avoid}
            onChange={(value) => updateField("avoid", value)}
          />

          <TextArea
            label="Klistra in tidigare inlägg"
            placeholder="Klistra gärna in 3–5 tidigare inlägg, kampanjtexter eller nyhetsbrev så AI:n lär sig tonaliteten."
            value={form.previousPosts}
            onChange={(value) => updateField("previousPosts", value)}
          />
        </section>

        <section className="mt-12 flex justify-end">
          <button
            type="button"
            onClick={analyzeCompany}
            disabled={isAnalyzing}
            className="rounded-full bg-[#111111] px-7 py-4 text-sm font-semibold text-white transition hover:bg-black/80 disabled:opacity-50"
          >
            {isAnalyzing ? "Analyserar..." : "Analysera företaget"}
          </button>
        </section>
      </div>
    </main>
  );
}

function Field({
  label,
  placeholder,
  value,
  onChange,
}: {
  label: string;
  placeholder: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div>
      <label className="mb-3 block text-sm font-medium text-neutral-500">
        {label}
      </label>

      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full border-b border-black/10 bg-transparent py-4 text-2xl outline-none placeholder:text-neutral-400 focus:border-black"
      />
    </div>
  );
}

function TextArea({
  label,
  placeholder,
  value,
  onChange,
}: {
  label: string;
  placeholder: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div>
      <label className="mb-3 block text-sm font-medium text-neutral-500">
        {label}
      </label>

      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="min-h-32 w-full resize-none border-b border-black/10 bg-transparent py-4 text-2xl leading-10 outline-none placeholder:text-neutral-400 focus:border-black"
      />
    </div>
  );
}
"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function GeneratingPage() {
  const router = useRouter();

  useEffect(() => {
    const timer = setTimeout(() => {
      router.push("/dashboard");
    }, 3000);

    return () => clearTimeout(timer);
  }, [router]);

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#F8F6F2] px-6 text-neutral-950">
      <div className="w-full max-w-xl rounded-[2rem] bg-white p-8 shadow-2xl shadow-black/10">
        <p className="text-sm font-medium text-green-700">
          Marketing Copilot arbetar
        </p>

        <h1 className="mt-3 text-4xl font-bold">
          Skapar din marknadsplan...
        </h1>

        <div className="mt-8 space-y-5">
          <Step text="Företag identifierat" />
          <Step text="Bransch analyserad: Gasol" />
          <Step text="Säsong identifierad: Sommar" />
          <Step text="Innehåll genereras" loading />
        </div>
      </div>
    </main>
  );
}

function Step({ text, loading }: { text: string; loading?: boolean }) {
  return (
    <div className="flex items-center gap-3 rounded-2xl bg-[#F8F6F2] p-4">
      <div className="flex h-7 w-7 items-center justify-center rounded-full bg-green-600 text-sm text-white">
        {loading ? "…" : "✓"}
      </div>
      <p className="font-medium">{text}</p>
    </div>
  );
}
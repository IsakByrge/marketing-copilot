"use client";

// ─────────────────────────────────────────────────────────────
// Användning — gör en osynlig risk synlig.
//
// Saldot hos OpenAI är ett hårt tak: tar det slut stannar allt, mitt i
// arbetet. Den här panelen visar hur snabbt det förbrukas.
//
// Fakta och uppskattning hålls isär i gränssnittet, precis som i
// usage.ts. Antal anrop och tokens är hämtade. Kronor är räknade på en
// hårdkodad prislista, och det står det.
// ─────────────────────────────────────────────────────────────
import { useEffect, useState } from "react";
import { Card, Skeleton } from "./primitives";

interface FeatureUsage {
  feature: string;
  calls: number;
  errors: number;
  promptTokens: number;
  completionTokens: number;
  estimatedUsd: number;
}

interface UsageData {
  days: number;
  calls: number;
  errors: number;
  estimatedUsd: number;
  hasUnknownModel: boolean;
  byFeature: FeatureUsage[];
}

const FEATURE_LABELS: Record<string, string> = {
  "product-texts": "Produkttexter",
  "create-content": "Snabbskapande",
  "generate-plan": "Veckoplan",
  "facebook-specialist": "Facebook Specialist",
  "generate-image": "Bilder",
  "edit-image": "Bildredigering",
  "strategist-analyze": "Strategist",
  "strategist-recommend": "Strategist",
  "analyze-company": "Hemsideanalys",
};

const label = (f: string) => FEATURE_LABELS[f] ?? f;

/** Visar dollar med två decimaler, eller "<0,01" när det avrundas till noll. */
function usd(n: number): string {
  if (n > 0 && n < 0.01) return "<0,01 $";
  return `${n.toFixed(2).replace(".", ",")} $`;
}

export default function UsagePanel() {
  const [data, setData] = useState<UsageData | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/usage?days=30")
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error("failed"))))
      .then((d) => { if (!cancelled) setData(d); })
      .catch(() => { if (!cancelled) setFailed(true); });
    return () => { cancelled = true; };
  }, []);

  // Panelen är en upplysning, inte en funktion — misslyckas den, visa inget.
  if (failed) return null;

  if (!data) {
    return <Skeleton shape="block" className="h-24" />;
  }

  if (data.calls === 0) {
    return (
      <Card padding="sm">
        <p className="text-sm text-text-secondary">
          Ingen AI-användning registrerad de senaste {data.days} dagarna.
        </p>
      </Card>
    );
  }

  return (
    <Card padding="sm">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <div>
          <p className="text-2xl font-medium tracking-tight">{usd(data.estimatedUsd)}</p>
          <p className="text-sm text-text-secondary">
            uppskattat de senaste {data.days} dagarna · {data.calls} anrop
            {data.errors > 0 && `, varav ${data.errors} fel`}
          </p>
        </div>
      </div>

      <ul className="mt-4 space-y-2">
        {data.byFeature.slice(0, 6).map((f) => (
          <li key={f.feature} className="flex items-baseline justify-between gap-3 text-sm">
            <span>{label(f.feature)}</span>
            <span className="text-text-tertiary">
              {f.calls} {f.calls === 1 ? "anrop" : "anrop"} · {usd(f.estimatedUsd)}
            </span>
          </li>
        ))}
      </ul>

      <p className="mt-4 text-xs leading-relaxed text-text-tertiary">
        Antal anrop och tokens är hämtade ur loggen. Beloppet är en uppskattning
        räknad på listpris och kan skilja sig från fakturan — bilder antas alltid
        vara av högsta kvalitet.
        {data.hasUnknownModel && " Någon modell saknar känt pris och räknas som noll."}
        {" "}Ditt verkliga saldo finns hos OpenAI.
      </p>
    </Card>
  );
}

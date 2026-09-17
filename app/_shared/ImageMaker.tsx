"use client";

// ─────────────────────────────────────────────────────────────
// Bildgenerering — alltid ett medvetet val, aldrig automatiskt.
//
// En bild kostar ungefär hundra gånger mer än en text. Att generera
// automatiskt till varje utkast skulle bränna pengar på förslag som
// ändå slängs. Därför: knappen finns, men ingenting händer förrän du
// trycker på den, och priset står bredvid.
//
// Motorn har redan skrivit en bildbrief — koncept, motiv, komposition,
// vad som ska undvikas. Den blir promptens grund, men är redigerbar:
// du ser exakt vad som skickas innan du betalar för det.
//
// Delad mellan Facebook Specialist och Innehåll.
// ─────────────────────────────────────────────────────────────
import { useState } from "react";
import { Button, Textarea, Alert, cx } from "./primitives";

/** Grov uppskattning, visas som storleksordning och aldrig som exakt pris. */
const ROUGH_COST = "några ören";

export interface ImageMakerProps {
  /** Motivet, normalt från motorns bildbrief. */
  initialPrompt: string;
  /** Saker som aldrig ska synas i bilden, från briefens avoid-lista. */
  avoid?: string[];
  className?: string;
}

export default function ImageMaker({
  initialPrompt,
  avoid = [],
  className,
}: ImageMakerProps) {
  const [open, setOpen] = useState(false);
  const [prompt, setPrompt] = useState(initialPrompt);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [image, setImage] = useState<string | null>(null);
  // Utkast först, färdig när motivet sitter. Samma modell, olika kostnad.
  const [quality, setQuality] = useState<"draft" | "final">("draft");

  async function generate() {
    const clean = prompt.trim();
    if (!clean) return;

    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/generate-image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: clean, avoid, quality }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error ?? "Kunde inte skapa bilden just nu.");
      }
      const data = await res.json();
      if (typeof data.image !== "string") throw new Error("Ingen bild kom tillbaka.");
      setImage(data.image);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Något gick fel. Försök igen.");
    } finally {
      setBusy(false);
    }
  }

  function download() {
    if (!image) return;
    const a = document.createElement("a");
    a.href = image;
    a.download = "bild.png";
    a.click();
  }

  if (!open) {
    return (
      <Button
        size="sm"
        variant="secondary"
        className={className}
        onClick={() => setOpen(true)}
      >
        Skapa bild
      </Button>
    );
  }

  return (
    <div className={cx("rounded-lg border border-border bg-surface-sunken p-4", className)}>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="text-xs font-semibold uppercase tracking-[0.12em] text-text-tertiary">
          Bild
        </p>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="text-xs text-text-tertiary hover:text-text-primary"
        >
          Stäng
        </button>
      </div>

      <p className="mt-2 text-sm leading-relaxed text-text-secondary">
        Motorn har föreslagit motivet nedan. Beskriv vad som ska synas, inte vad
        bilden ska förmedla — modellen förstår föremål och platser, inte
        marknadsföringsspråk. Inget genereras förrän du trycker.
      </p>

      <Textarea
        className="mt-3"
        rows={3}
        value={prompt}
        onChange={(e) => setPrompt(e.target.value)}
        placeholder="t.ex. En kund som fyller en gasolflaska vid anläggningen i Linköping"
      />

      {avoid.length > 0 && (
        <p className="mt-2 text-xs text-text-tertiary">
          Undviks automatiskt: {avoid.join(", ")}
        </p>
      )}

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <span className="text-xs text-text-tertiary">Kvalitet</span>
        {([
          ["draft", `Utkast (${ROUGH_COST})`],
          ["final", "Färdig (dyrare)"],
        ] as const).map(([value, label]) => (
          <Button
            key={value}
            size="sm"
            variant={quality === value ? "primary" : "secondary"}
            onClick={() => setQuality(value)}
          >
            {label}
          </Button>
        ))}
      </div>

      {error && (
        <Alert tone="danger" title="Det gick inte" className="mt-3">{error}</Alert>
      )}

      <div className="mt-3 flex flex-wrap gap-2">
        <Button size="sm" onClick={generate} loading={busy} disabled={!prompt.trim()}>
          {image ? "Skapa en till" : "Skapa bilden"}
        </Button>
        {image && (
          <Button size="sm" variant="secondary" onClick={download}>
            Ladda ner
          </Button>
        )}
      </div>

      {image && (
        <div className="mt-4">
          {/* Bilden är en base64-data-URL från vår egen route, aldrig en extern
              värd — därför vanlig img i stället för next/image. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={image}
            alt="Genererad marknadsföringsbild"
            className="w-full max-w-md rounded-lg border border-border"
          />
          <p className="mt-2 text-xs text-text-tertiary">
            Granska bilden innan du publicerar. AI-bilder får ofta detaljer fel —
            särskilt text, händer och utrustning.
          </p>
        </div>
      )}
    </div>
  );
}

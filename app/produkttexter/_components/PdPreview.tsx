"use client";

// ─────────────────────────────────────────────────────────────
// Produktbeskrivningen som kunden kommer se den: den nya mallen (.gf-pd)
// med designprofilens egen CSS, i en iframe.
//
// Iframen är där för att profilens CSS inte ska läcka in i appen och
// appens inte in i förhandsvisningen. Den kör inga skript (sandbox utan
// allow-scripts), och HTML:en saneras med sanitizePd innan den visas.
// allow-same-origin behövs bara för att kunna läsa höjden.
//
// Bredden går att växla: mallen byter från en till två spalter vid
// 900 px (container query), så "Dator" och "Mobil" ser olika ut.
// ─────────────────────────────────────────────────────────────
import { useEffect, useRef, useState } from "react";
import { sanitizePd } from "@/lib/productText/pdRender";
import { cx } from "@/app/_shared/primitives";

const WIDTHS = { dator: 1040, mobil: 390 } as const;

export function PdPreview({ html, className }: { html: string; className?: string }) {
  const [vy, setVy] = useState<keyof typeof WIDTHS>("dator");
  const [height, setHeight] = useState(480);
  const ref = useRef<HTMLIFrameElement>(null);

  const css = typeof window !== "undefined" ? `${window.location.origin}/gf/gf-pd-preview.css` : "/gf/gf-pd-preview.css";
  const doc = `<!doctype html><html lang="sv"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="${css}"></head><body>${sanitizePd(html)}</body></html>`;

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const measure = () => {
      const h = el.contentDocument?.documentElement.scrollHeight;
      if (h) setHeight(h + 8);
    };
    el.addEventListener("load", measure);
    // Typsnittet laddas efter load och ändrar höjden.
    const t = setTimeout(measure, 900);
    return () => { el.removeEventListener("load", measure); clearTimeout(t); };
  }, [doc, vy]);

  return (
    <div className={className}>
      <div className="mb-2 flex items-center gap-2">
        <p className="text-xs font-medium uppercase tracking-wide text-text-tertiary">Så ser den ut i butiken</p>
        <div className="ml-auto flex rounded-lg border border-border p-0.5" role="group" aria-label="Bredd">
          {(Object.keys(WIDTHS) as Array<keyof typeof WIDTHS>).map((w) => (
            <button
              key={w}
              type="button"
              aria-pressed={vy === w}
              onClick={() => setVy(w)}
              className={cx(
                "min-h-9 rounded-md px-2.5 text-sm capitalize transition-colors",
                vy === w ? "bg-primary/10 font-medium text-text-primary" : "text-text-secondary hover:text-text-primary",
              )}
            >
              {w === "dator" ? "Dator" : "Mobil"}
            </button>
          ))}
        </div>
      </div>
      <div className="overflow-x-auto rounded-lg border border-border bg-white">
        <iframe
          ref={ref}
          title="Förhandsvisning av produktbeskrivningen"
          sandbox="allow-same-origin"
          srcDoc={doc}
          style={{ width: WIDTHS[vy], height, maxWidth: vy === "mobil" ? WIDTHS.mobil : undefined }}
          className="block border-0"
        />
      </div>
    </div>
  );
}

"use client";

// ─────────────────────────────────────────────────────────────
// Förfina — ett klick i inlägget, inget formulär.
//
// Tre vanliga ändringar som knappar, och "Egen" för allt annat. Den nya
// texten ersätter den i rutan; "Ångra" tar tillbaka den förra. Det som
// kontrollen flaggar visas, så att inget påstående smyger sig in.
// ─────────────────────────────────────────────────────────────
import { useState } from "react";
import { Alert, Button, Input } from "@/app/_shared/primitives";
import {
  REFINE_LABELS, MAX_CUSTOM_INSTRUCTION, WARNING_TEXT,
  type RefineAction, type RefineWarning,
} from "@/lib/content/refine";

export default function RefineBar({
  busy, disabled, onRefine, canUndo, onUndo, warnings,
}: {
  /** Vilken handling som körs just nu, eller null. */
  busy: RefineAction | null;
  disabled?: boolean;
  onRefine: (action: RefineAction, instruction?: string) => void;
  canUndo: boolean;
  onUndo: () => void;
  warnings: RefineWarning[];
}) {
  const [egenOppen, setEgenOppen] = useState(false);
  const [egen, setEgen] = useState("");

  const knapp = (a: Exclude<RefineAction, "egen">) => (
    <Button
      key={a}
      size="sm"
      variant="secondary"
      loading={busy === a}
      disabled={disabled || (busy !== null && busy !== a)}
      onClick={() => onRefine(a)}
    >
      {REFINE_LABELS[a]}
    </Button>
  );

  return (
    <div className="mt-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className="mr-1 text-xs font-semibold uppercase tracking-[0.12em] text-text-tertiary">Förfina</span>
        {knapp("kortare")}
        {knapp("konkretare")}
        {knapp("saljande")}
        <Button
          size="sm"
          variant="ghost"
          disabled={disabled || busy !== null}
          onClick={() => setEgenOppen((v) => !v)}
          aria-expanded={egenOppen}
        >
          Egen…
        </Button>
        {canUndo && (
          <button
            type="button"
            onClick={onUndo}
            disabled={busy !== null}
            className="inline-flex min-h-11 items-center rounded px-1 text-sm font-medium text-text-secondary underline underline-offset-4 hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 disabled:opacity-50 sm:min-h-0"
          >
            Ångra
          </button>
        )}
      </div>

      {egenOppen && (
        <form
          className="mt-2 flex flex-col gap-2 sm:flex-row"
          onSubmit={(e) => {
            e.preventDefault();
            if (egen.trim().length >= 3) onRefine("egen", egen);
          }}
        >
          <Input
            value={egen}
            maxLength={MAX_CUSTOM_INSTRUCTION}
            onChange={(e) => setEgen(e.target.value)}
            placeholder="t.ex. Nämn att vi har öppet på lördagar"
            aria-label="Vad vill du ändra?"
            className="flex-1"
          />
          <Button type="submit" size="sm" loading={busy === "egen"} disabled={disabled || egen.trim().length < 3 || (busy !== null && busy !== "egen")}>
            Skriv om
          </Button>
        </form>
      )}

      {warnings.length > 0 && (
        <Alert tone="warning" title="Läs igenom innan du publicerar" className="mt-3">
          <ul className="list-disc space-y-1 pl-4">
            {warnings.map((w, i) => (
              <li key={i}>{WARNING_TEXT[w.kind]}: <span className="font-medium">{w.phrase}</span></li>
            ))}
          </ul>
        </Alert>
      )}
    </div>
  );
}

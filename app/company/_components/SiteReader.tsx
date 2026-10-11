"use client";

// ─────────────────────────────────────────────────────────────
// "Läs hemsidan" — Company Brain ur företagets egna sidor.
//
// Att fylla i allt för hand tar en halvtimme, och står det redan på
// hemsidan ska ingen behöva skriva det igen. Läsaren föreslår; du
// väljer. Inget skrivs över: nya produkter och platser läggs till, och
// det som redan finns kompletteras bara där fält är tomma.
// ─────────────────────────────────────────────────────────────
import { useState } from "react";
import { Button, Card, Alert } from "@/app/_shared/primitives";
import { IconCheck } from "@/app/_shared/icons";
import { newBrainId, type CompanyBrain } from "@/app/_shared/companyBrain";
import type { BrainDraft } from "@/lib/siteReader/brainDraft";
import { suggestionsFrom, applySuggestions, type Suggestion } from "@/lib/siteReader/merge";

const GRUPP: Record<Suggestion["kind"], string> = {
  summary: "Om företaget",
  list: "Om företaget",
  "product-new": "Produkter och tjänster",
  "product-fill": "Produkter och tjänster",
  "location-new": "Depåer och butiker",
  "location-fill": "Depåer och butiker",
};

const ETIKETT: Partial<Record<Suggestion["kind"], string>> = {
  "product-new": "Ny",
  "product-fill": "Kompletterar",
  "location-new": "Ny",
  "location-fill": "Kompletterar",
};

function domain(url: string): string {
  try { return new URL(url).hostname.replace(/^www\./, ""); } catch { return url; }
}

export default function SiteReader({
  brain, onApply,
}: {
  brain: CompanyBrain;
  onApply: (next: CompanyBrain) => void;
}) {
  const [state, setState] = useState<"idle" | "reading" | "review" | "done">("idle");
  const [error, setError] = useState<string | null>(null);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [chosen, setChosen] = useState<Set<string>>(new Set());
  const [meta, setMeta] = useState<{ pagesRead: number; sites: string[]; notes: string[] } | null>(null);
  const [added, setAdded] = useState(0);

  const harAdress = brain.websites.some((w) => w.url);

  async function read() {
    setState("reading");
    setError(null);
    try {
      const res = await fetch("/api/company/read-site", { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.draft) throw new Error(data?.error ?? "Hemsidan gick inte att läsa just nu.");
      const sug = suggestionsFrom(data.draft as BrainDraft, brain);
      setSuggestions(sug);
      setChosen(new Set(sug.map((s) => s.id)));
      setMeta({ pagesRead: data.pagesRead ?? 0, sites: data.sites ?? [], notes: data.notes ?? [] });
      setState("review");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Något gick fel. Försök igen.");
      setState("idle");
    }
  }

  function apply() {
    const valda = suggestions.filter((s) => chosen.has(s.id));
    onApply(applySuggestions(brain, valda, newBrainId));
    setAdded(valda.length);
    setState("done");
  }

  function toggle(id: string) {
    setChosen((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  const grupper = [...new Set(suggestions.map((s) => GRUPP[s.kind]))];

  return (
    <Card className="p-5 sm:p-6">
      {state !== "review" && (
        <>
          <h2 className="text-[17px] font-semibold tracking-tight">Läs in från hemsidan</h2>
          <p className="mt-1.5 text-[15px] leading-relaxed text-text-secondary">
            {harAdress
              ? `Jag läser ${brain.websites.filter((w) => w.url).slice(0, 2).map((w) => domain(w.url)).join(" och ")} och föreslår produkter, priser, depåer och öppettider. Du väljer vad som ska med — inget skrivs över.`
              : "Lägg till företagets webbadress under Webbplatser längre ned, så läser jag in produkter, priser, depåer och öppettider därifrån."}
          </p>
          {state === "done" && (
            <p className="mt-3 flex items-center gap-2 text-sm text-text-secondary">
              <IconCheck size={16} className="text-primary" />
              {added === 0 ? "Inget lades till." : `${added} ${added === 1 ? "uppgift lades" : "uppgifter lades"} till.`}
            </p>
          )}
          {error && <Alert tone="danger" title="Det gick inte" className="mt-3">{error}</Alert>}
          <div className="mt-4">
            <Button onClick={() => void read()} loading={state === "reading"} disabled={!harAdress}>
              {state === "done" ? "Läs igen" : "Läs hemsidan"}
            </Button>
            {state === "reading" && (
              <p className="mt-2 text-xs text-text-tertiary">
                Jag läser en sida i sekunden för att inte belasta sajten. Det tar upp till en minut.
              </p>
            )}
          </div>
        </>
      )}

      {state === "review" && (
        <>
          <h2 className="text-[17px] font-semibold tracking-tight">
            {suggestions.length === 0 ? "Inget nytt på hemsidan" : "Det här hittade jag"}
          </h2>
          <p className="mt-1.5 text-sm text-text-secondary">
            {meta?.pagesRead ?? 0} sidor lästa på {(meta?.sites ?? []).map(domain).join(" och ")}.
            {suggestions.length === 0
              ? " Allt som står där finns redan här."
              : " Bocka ur det som inte stämmer."}
          </p>

          {grupper.map((g) => (
            <div key={g} className="mt-5">
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-[0.12em] text-text-tertiary">{g}</h3>
              <ul className="space-y-1">
                {suggestions.filter((s) => GRUPP[s.kind] === g).map((s) => (
                  <li key={s.id}>
                    <label className="flex min-h-11 cursor-pointer items-start gap-3 rounded-md px-2 py-2 hover:bg-surface-sunken">
                      <input
                        type="checkbox"
                        className="mt-1 h-4 w-4 shrink-0 accent-[var(--color-primary)]"
                        checked={chosen.has(s.id)}
                        onChange={() => toggle(s.id)}
                      />
                      <span className="min-w-0">
                        <span className="text-[15px] font-medium">
                          {s.label}
                          {ETIKETT[s.kind] && (
                            <span className="ml-2 text-xs font-normal text-text-tertiary">{ETIKETT[s.kind]}</span>
                          )}
                        </span>
                        {s.detail && <span className="block text-sm text-text-secondary">{s.detail}</span>}
                      </span>
                    </label>
                  </li>
                ))}
              </ul>
            </div>
          ))}

          {(meta?.notes.length ?? 0) > 0 && (
            <p className="mt-4 text-xs text-text-tertiary">{meta!.notes.join(" ")}</p>
          )}

          <div className="mt-5 flex flex-col gap-2 sm:flex-row">
            {suggestions.length > 0 && (
              <Button onClick={apply} disabled={chosen.size === 0} className="w-full sm:w-auto">
                Lägg till valda ({chosen.size})
              </Button>
            )}
            <Button variant="secondary" onClick={() => setState("idle")} className="w-full sm:w-auto">
              {suggestions.length > 0 ? "Avbryt" : "Stäng"}
            </Button>
          </div>
        </>
      )}
    </Card>
  );
}

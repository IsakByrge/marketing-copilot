"use client";

// ─────────────────────────────────────────────────────────────
// "Hur gick det?" — resultat för publicerade inlägg, på Idag.
//
// Ligger här och inte på Innehåll: Innehåll visar bara den senaste
// planen, och förra veckans inlägg är de som är mogna att bedöma.
//
// Ett klick räcker (gick bra / gick sämre). Siffrorna är frivilliga och
// företagarens egna, avlästa i Facebook eller Instagram. Ett tomt fält
// sparas som okänt, aldrig som noll.
// ─────────────────────────────────────────────────────────────
import { useState } from "react";
import { Button, Card, Alert, Field, Input, ToggleChip } from "@/app/_shared/primitives";
import { IconCheck } from "@/app/_shared/icons";
import { createClient } from "@/lib/supabase-browser";
import { CHANNEL_LABELS, shortDate } from "@/lib/content/published";
import {
  METRICS, METRIC_LABELS, RATING_LABELS, emptyMetricsForm, firstLine, parseMetrics,
  type MetricsForm, type Rating, type ResultRow,
} from "@/lib/content/results";

function ResultItem({ row, onRated }: { row: ResultRow; onRated: (id: string, r: Rating) => void }) {
  const [rating, setRating] = useState<Rating | null>(row.result_rating);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [openMetrics, setOpenMetrics] = useState(false);
  const [form, setForm] = useState<MetricsForm>(emptyMetricsForm());
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<keyof MetricsForm, string>>>({});
  const [metricsSaved, setMetricsSaved] = useState(false);

  async function save(update: Record<string, unknown>): Promise<boolean> {
    setSaving(true);
    setError(null);
    try {
      const sb = createClient();
      const { error: e } = await sb
        .from("published_posts")
        .update({ ...update, result_at: new Date().toISOString() })
        .eq("id", row.id);
      if (e) throw e;
      return true;
    } catch (e) {
      console.warn("Kunde inte spara resultatet:", e);
      setError("Kunde inte spara. Försök igen.");
      return false;
    } finally {
      setSaving(false);
    }
  }

  async function rate(r: Rating) {
    if (saving) return;
    if (await save({ result_rating: r })) {
      setRating(r);
      onRated(row.id, r);
    }
  }

  async function saveMetrics() {
    const parsed = parseMetrics(form);
    if (!parsed.ok) { setFieldErrors(parsed.errors); return; }
    setFieldErrors({});
    if (await save(parsed.value)) {
      setMetricsSaved(true);
      setOpenMetrics(false);
    }
  }

  return (
    <li className="border-b border-border py-4 last:border-0">
      <p className="text-xs text-text-tertiary">
        {CHANNEL_LABELS[row.channel]} · {shortDate(row.published_on)}
      </p>
      <p className="mt-0.5 text-[15px] leading-snug">{firstLine(row.text)}</p>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        {(["good", "bad"] as const).map((r) => (
          <ToggleChip key={r} active={rating === r} disabled={saving} onClick={() => void rate(r)}>
            {RATING_LABELS[r]}
          </ToggleChip>
        ))}
        {rating && !openMetrics && !metricsSaved && (
          <button
            type="button"
            onClick={() => setOpenMetrics(true)}
            className="inline-flex min-h-11 items-center rounded px-1 text-sm font-medium text-text-secondary underline underline-offset-4 hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 sm:min-h-0"
          >
            Lägg till siffror
          </button>
        )}
        {metricsSaved && (
          <span className="inline-flex items-center gap-1.5 text-sm text-text-secondary">
            <IconCheck size={16} className="text-primary" /> Siffrorna är sparade
          </span>
        )}
      </div>

      {openMetrics && (
        <div className="mt-3">
          <p className="mb-3 text-xs text-text-tertiary">
            Läs av dem i {CHANNEL_LABELS[row.channel]}. Fyll bara i det du har — tomt betyder okänt.
          </p>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {METRICS.map((m) => (
              <Field key={m} label={METRIC_LABELS[m]} error={fieldErrors[m]}>
                {(props) => (
                  <Input
                    {...props}
                    inputMode="numeric"
                    value={form[m]}
                    onChange={(e) => setForm((f) => ({ ...f, [m]: e.target.value }))}
                  />
                )}
              </Field>
            ))}
          </div>
          <div className="mt-3 flex gap-2">
            <Button size="sm" loading={saving} onClick={() => void saveMetrics()}>Spara siffrorna</Button>
            <Button size="sm" variant="ghost" disabled={saving} onClick={() => setOpenMetrics(false)}>Avbryt</Button>
          </div>
        </div>
      )}

      {error && <Alert tone="danger" title="Det gick inte" className="mt-3">{error}</Alert>}
    </li>
  );
}

export default function ResultsSection({
  rows, onRated,
}: {
  rows: ResultRow[];
  onRated: (id: string, r: Rating) => void;
}) {
  if (rows.length === 0) return null;
  return (
    <section id="resultat" className="scroll-mt-6">
      <h2 className="mb-3 text-xs font-semibold uppercase tracking-[0.12em] text-text-tertiary">
        Hur gick det?
      </h2>
      <Card padding="sm">
        <ul>
          {rows.map((r) => <ResultItem key={r.id} row={r} onRated={onRated} />)}
        </ul>
      </Card>
    </section>
  );
}

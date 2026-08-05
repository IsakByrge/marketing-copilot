"use client";

// ─────────────────────────────────────────────────────────────
// Produkttexter — CSV in, genererade beskrivningar, CSV ut.
//
// Första sidan byggd helt på emerald-designsystemet. Mobil är
// huvudfallet: ett kort per produkt, inga tabeller, 44px träffytor.
//
// Filen lämnar aldrig webbläsaren. Bara produktnamn, produktgrupp och
// nuvarande text skickas till servern för de produkter du valt.
// ─────────────────────────────────────────────────────────────
import { useMemo, useRef, useState } from "react";
import AppShell from "@/app/_shared/AppShell";
import {
  Button, Card, Textarea, Field, Chip, Alert, EmptyState, cx,
} from "@/app/_shared/primitives";
import {
  parseCsv, toCsv, guessColumns, isThin, textLength, THIN_LIMIT,
  type Row, type ColumnGuess,
} from "@/lib/productText/csv";
import { MAX_BATCH } from "@/lib/productText/prompt";

type Stage = "upload" | "map" | "work";
type FieldKey = keyof ColumnGuess;

const FIELD_LABELS: Record<FieldKey, string> = {
  id: "Artikelnummer",
  name: "Produktnamn",
  description: "Beskrivning",
  group: "Produktgrupp",
};

const selectClass =
  "w-full rounded border border-border bg-surface px-3.5 py-2.5 font-sans text-sm " +
  "text-text-primary transition-colors focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20";

export default function ProductTextsPage() {
  const fileRef = useRef<HTMLInputElement>(null);

  const [stage, setStage] = useState<Stage>("upload");
  const [fileName, setFileName] = useState("");
  const [headers, setHeaders] = useState<string[]>([]);
  const [rows, setRows] = useState<Row[]>([]);
  const [delimiter, setDelimiter] = useState(";");
  const [cols, setCols] = useState<ColumnGuess>({ id: null, name: null, description: null, group: null });

  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [onlyThin, setOnlyThin] = useState(true);

  async function handleFile(file: File) {
    setError(null);
    try {
      const parsed = parseCsv(await file.text());
      if (parsed.headers.length < 2 || parsed.rows.length === 0) {
        setError("Filen ser inte ut som en artikelexport. Kontrollera att den exporterats med rubrikrad.");
        return;
      }
      setFileName(file.name);
      setHeaders(parsed.headers);
      setRows(parsed.rows);
      setDelimiter(parsed.delimiter);
      setCols(guessColumns(parsed.headers));
      setDrafts({});
      setSelected(new Set());
      setStage("map");
    } catch {
      setError("Filen kunde inte läsas. Spara om den som CSV och försök igen.");
    }
  }

  const products = useMemo(() => {
    if (!cols.id || !cols.name) return [];
    return rows
      .map((r) => ({
        id: (r[cols.id!] ?? "").trim(),
        name: (r[cols.name!] ?? "").trim(),
        group: cols.group ? (r[cols.group] ?? "").trim() : "",
        current: cols.description ? (r[cols.description] ?? "") : "",
      }))
      .filter((p) => p.id && p.name);
  }, [rows, cols]);

  const thinCount = useMemo(() => products.filter((p) => isThin(p.current)).length, [products]);
  const visible = useMemo(
    () => (onlyThin ? products.filter((p) => isThin(p.current)) : products),
    [products, onlyThin],
  );

  const ready = Boolean(cols.id && cols.name && cols.description);
  const draftCount = Object.keys(drafts).length;

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  async function generate() {
    const queue = products.filter((p) => selected.has(p.id));
    if (queue.length === 0) return;

    setBusy(true);
    setError(null);
    setProgress({ done: 0, total: queue.length });

    try {
      for (let i = 0; i < queue.length; i += MAX_BATCH) {
        const batch = queue.slice(i, i + MAX_BATCH);
        const res = await fetch("/api/product-texts", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            products: batch.map((p) => ({
              id: p.id,
              name: p.name,
              group: p.group || undefined,
              current: p.current || undefined,
            })),
          }),
        });

        if (!res.ok) {
          const data = await res.json().catch(() => null);
          throw new Error(data?.error ?? "Kunde inte skapa texterna just nu.");
        }

        const data = await res.json();
        const usable = (data.texts ?? []).filter(
          (t: { id?: unknown; description?: unknown }) =>
            typeof t?.id === "string" && typeof t?.description === "string" && t.description.trim() !== "",
        ) as Array<{ id: string; description: string }>;

        if (usable.length === 0) {
          console.warn("PRODUCT_TEXTS: inget användbart svar", data);
          throw new Error("Modellen svarade utan text. Försök igen — hjälper det inte, säg till.");
        }

        setDrafts((prev) => {
          const next = { ...prev };
          for (const t of usable) next[t.id] = t.description;
          return next;
        });
        setProgress({ done: Math.min(i + MAX_BATCH, queue.length), total: queue.length });
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Något gick fel. Försök igen.");
    } finally {
      setBusy(false);
    }
  }

  function download() {
    if (!cols.id || !cols.description) return;
    const changed = rows.filter((r) => drafts[(r[cols.id!] ?? "").trim()]);
    const out = changed.map((r) => ({ ...r, [cols.description!]: drafts[(r[cols.id!] ?? "").trim()] }));
    const blob = new Blob(["﻿" + toCsv(headers, out, delimiter)], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = fileName.replace(/\.csv$/i, "") + "-nya-texter.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <AppShell>
      <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-10 lg:py-12">
        <header className="mb-8">
          <h1 className="text-2xl font-medium tracking-tight">Produkttexter</h1>
          <p className="mt-1.5 text-sm text-text-secondary">
            Exportera artikeldata från webbshoppen, skriv texterna här, importera tillbaka.
          </p>
        </header>

        {error && (
          <Alert tone="danger" title="Det gick inte" className="mb-6">
            {error}
          </Alert>
        )}

        {stage === "upload" && (
          <Card padding="none">
            <EmptyState
              title="Välj din artikelexport"
              body="I Wikinggruppen: Inställningar och verktyg → Import/Export → Artikeldata → Export av produktdata till fil. Ta med artikelnummer, produktnamn och beskrivning."
              action={<Button onClick={() => fileRef.current?.click()}>Välj CSV-fil</Button>}
            />
            <input
              ref={fileRef}
              type="file"
              accept=".csv,text/csv"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) handleFile(f);
              }}
            />
          </Card>
        )}

        {stage === "map" && (
          <div>
            <p className="mb-5 text-sm text-text-secondary">
              {fileName} · {rows.length} rader · avgränsare {delimiter === "\t" ? "tabb" : `"${delimiter}"`}
            </p>

            <div className="grid gap-5 sm:grid-cols-2">
              {(Object.keys(FIELD_LABELS) as FieldKey[]).map((key) => (
                <Field
                  key={key}
                  label={FIELD_LABELS[key]}
                  optional={key === "group"}
                  hint={key === "description" ? "Kolumnen som skrivs över vid import." : undefined}
                >
                  {(fieldProps) => (
                    <select
                      id={fieldProps.id}
                      aria-describedby={fieldProps["aria-describedby"]}
                      className={selectClass}
                      value={cols[key] ?? ""}
                      onChange={(e) => setCols({ ...cols, [key]: e.target.value || null })}
                    >
                      <option value="">— välj kolumn —</option>
                      {headers.map((h) => (
                        <option key={h} value={h}>{h}</option>
                      ))}
                    </select>
                  )}
                </Field>
              ))}
            </div>

            <div className="mt-8 flex flex-wrap items-center gap-3">
              <Button onClick={() => setStage("work")} disabled={!ready}>
                Fortsätt
              </Button>
              <Button variant="ghost" onClick={() => setStage("upload")}>
                Välj en annan fil
              </Button>
              {!ready && (
                <p className="text-sm text-text-tertiary">
                  Artikelnummer, produktnamn och beskrivning behövs.
                </p>
              )}
            </div>
          </div>
        )}

        {stage === "work" && (
          <div>
            <Card className="mb-6">
              <div className="flex flex-wrap items-center gap-x-6 gap-y-4">
                <div>
                  <p className="text-2xl font-medium">{thinCount}</p>
                  <p className="text-sm text-text-secondary">
                    av {products.length} har text under {THIN_LIMIT} tecken
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2 sm:ml-auto">
                  <Button variant="secondary" size="sm" onClick={() => setOnlyThin(!onlyThin)}>
                    {onlyThin ? "Visa alla" : "Visa bara tunna"}
                  </Button>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => setSelected(new Set(visible.map((p) => p.id)))}
                  >
                    Markera alla synliga
                  </Button>
                  <Button onClick={generate} loading={busy} disabled={selected.size === 0}>
                    {busy && progress
                      ? `Skriver ${progress.done}/${progress.total}`
                      : `Skriv ${selected.size || ""} texter`}
                  </Button>
                </div>
              </div>
            </Card>

            {draftCount > 0 && (
              <Alert tone="success" title={`${draftCount} nya texter klara`} className="mb-6">
                <div className="mt-2">
                  <Button size="sm" onClick={download}>Ladda ner CSV för import</Button>
                </div>
              </Alert>
            )}

            <div className="space-y-3">
              {visible.slice(0, 300).map((p) => {
                const draft = drafts[p.id];
                const checked = selected.has(p.id);
                return (
                  <Card
                    key={p.id}
                    padding="sm"
                    className={cx("transition-colors", checked && "border-primary/40")}
                  >
                    <div className="flex gap-3">
                      <label className="flex min-h-11 min-w-11 cursor-pointer items-start justify-center pt-1">
                        <span className="sr-only">Markera {p.name}</span>
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggle(p.id)}
                          className="h-5 w-5 cursor-pointer accent-primary"
                        />
                      </label>

                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="font-medium">{p.name}</p>
                          {draft !== undefined && <Chip tone="success">Ny text</Chip>}
                        </div>
                        <p className="mt-0.5 text-xs text-text-tertiary">
                          {p.id}
                          {p.group ? ` · ${p.group}` : ""} · nuvarande text {textLength(p.current)} tecken
                        </p>

                        {draft !== undefined && (
                          <Textarea
                            className="mt-3"
                            rows={4}
                            value={draft}
                            onChange={(e) => setDrafts({ ...drafts, [p.id]: e.target.value })}
                          />
                        )}
                      </div>
                    </div>
                  </Card>
                );
              })}
            </div>

            {visible.length > 300 && (
              <p className="mt-5 text-sm text-text-tertiary">
                Visar de 300 första av {visible.length}. Ta dem i omgångar.
              </p>
            )}
          </div>
        )}
      </div>
    </AppShell>
  );
}

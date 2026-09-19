"use client";

// ─────────────────────────────────────────────────────────────
// Produkttexter — CSV in, genererade beskrivningar, CSV ut.
//
// Fyra steg: välj fil, bekräfta kolumner, arbeta i listan, granska och
// exportera. Arbetspasset sparas i webbläsarens IndexedDB, så en
// omladdning mitt i 601 artiklar inte kastar bort dagen. Filen lämnar
// aldrig datorn — bara de valda artiklarnas namn, kategori, tillverkare,
// modell och nuvarande text skickas till servern.
//
// Mobil är huvudfallet: kort i stället för tabell, 44px träffytor, och
// sorteringen som en rad knappar i stället för klickbara tabellrubriker.
// ─────────────────────────────────────────────────────────────
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import AppShell from "@/app/_shared/AppShell";
import {
  Button, Card, Field, Chip, Alert, EmptyState, Input, cx,
} from "@/app/_shared/primitives";
import {
  parseCsv, guessColumns, checkIdColumn, THIN_LIMIT,
  type Row, type ColumnGuess,
} from "@/lib/productText/csv";
import { BATCH_SIZE, type GeneratedText } from "@/lib/productText/prompt";
import { TEMPLATES, TEMPLATE_IDS, type TemplateId } from "@/lib/productText/templates";
import {
  buildProducts, initialItems, catalogStats, categoriesOf, filterProducts,
  sortProducts, itemState, lostFacts, approvedFor, EMPTY_FILTERS,
  type Filters, type ItemState, type Product, type Session, type SortDir,
  type SortKey, type WorkItem,
} from "@/lib/productText/session";
import { buildImportCsv } from "@/lib/productText/importFile";
import type { PageResult } from "@/lib/productText/pageFacts";
import { loadSession, saveSession, clearSession, canPersist } from "./_lib/db";
import { ReviewPane } from "./_components/ReviewPane";

type Stage = "upload" | "map" | "work";

const EMPTY_COLS: ColumnGuess = {
  id: null, name: null, description: null, group: null,
  subGroup: null, stock: null, producer: null, model: null, url: null,
};

const FIELD_LABELS: Record<keyof ColumnGuess, string> = {
  id: "Artikelnummer",
  name: "Produktnamn",
  description: "Beskrivning",
  group: "Kategori",
  subGroup: "Underkategori",
  stock: "Lager",
  producer: "Tillverkare",
  model: "Modell",
  url: "Produktsidans adress",
};

/** Kolumner som inte är valfria: utan dem går det inte att skriva eller importera. */
const REQUIRED: Array<keyof ColumnGuess> = ["id", "name", "description"];

const STATUS_LABELS: Array<{ value: Filters["status"]; label: string }> = [
  { value: "alla", label: "Alla" },
  { value: "saknar", label: "Saknar text" },
  { value: "tunn", label: `Under ${THIN_LIMIT} tecken` },
  { value: "utkast", label: "Utkast" },
  { value: "behover", label: "Behöver uppgifter" },
  { value: "godkand", label: "Godkända" },
];

const SORT_LABELS: Array<{ value: SortKey; label: string }> = [
  { value: "length", label: "Textlängd" },
  { value: "category", label: "Kategori" },
  { value: "stock", label: "Lager" },
  { value: "name", label: "Namn" },
];

const STATE_CHIP: Record<ItemState, { tone: "neutral" | "primary" | "success" | "danger" | "warning"; label: string } | null> = {
  saknar: { tone: "danger", label: "Saknar text" },
  tunn: { tone: "warning", label: "Tunn" },
  ok: null,
  utkast: { tone: "primary", label: "Utkast" },
  behover: { tone: "warning", label: "Behöver uppgifter" },
  godkand: { tone: "success", label: "Godkänd" },
};

const selectClass =
  "w-full min-h-11 rounded-lg border border-border bg-surface px-3 py-2.5 font-sans text-sm " +
  "text-text-primary transition-colors focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20";

/** Hur många kort listan renderar innan den ber dig filtrera i stället. */
const RENDER_CAP = 200;

/** Hur många adresser som skickas per hämtningsanrop. Servern tar högst tio. */
const SOURCE_BATCH = 10;

/**
 * Var i arbetet vi är. Hämtningen syns separat från skrivandet eftersom den
 * tar längst tid och är den enda delen där det är rätt att vänta: servern
 * hämtar en sida i sekunden för att inte belasta butiken.
 */
interface Progress {
  phase: "hamtar" | "skriver";
  done: number;
  total: number;
  waiting: boolean;
}

export default function ProductTextsPage() {
  const fileRef = useRef<HTMLInputElement>(null);

  const [stage, setStage] = useState<Stage>("upload");
  const [restoring, setRestoring] = useState(true);
  const [fileName, setFileName] = useState("");
  const [headers, setHeaders] = useState<string[]>([]);
  const [rows, setRows] = useState<Row[]>([]);
  const [delimiter, setDelimiter] = useState(";");
  const [cols, setCols] = useState<ColumnGuess>(EMPTY_COLS);
  const [items, setItems] = useState<Record<string, WorkItem>>({});
  // Hämtade produktsidor. Cache för hela passet: en sida hämtas en gång.
  const [sources, setSources] = useState<Record<string, PageResult>>({});

  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS);
  const [sortKey, setSortKey] = useState<SortKey>("length");
  const [sortDir, setSortDir] = useState<SortDir>("asc");

  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<Progress | null>(null);
  const cancelRef = useRef(false);
  const [error, setError] = useState<string | null>(null);
  const [reviewId, setReviewId] = useState<string | null>(null);

  // ── Återställ passet ur webbläsaren ───────────────────────
  useEffect(() => {
    let alive = true;
    loadSession().then((s) => {
      if (!alive) return;
      if (s) {
        setFileName(s.fileName);
        setHeaders(s.headers);
        setRows(s.rows);
        setDelimiter(s.delimiter);
        setCols({ ...EMPTY_COLS, ...s.cols });
        setItems(s.items);
        setSources(s.sources ?? {});
        setStage("work");
      }
      setRestoring(false);
    });
    return () => { alive = false; };
  }, []);

  const products = useMemo(() => buildProducts(rows, cols), [rows, cols]);
  const stats = useMemo(() => catalogStats(products, THIN_LIMIT), [products]);
  const categories = useMemo(() => categoriesOf(products), [products]);

  const visible = useMemo(() => {
    const filtered = filterProducts(products, items, filters, THIN_LIMIT);
    return sortProducts(filtered, sortKey, sortDir);
  }, [products, items, filters, sortKey, sortDir]);

  const approved = useMemo(() => approvedFor(items), [items]);
  const approvedCount = Object.keys(approved).length;
  const draftCount = useMemo(
    () => Object.values(items).filter((i) => i.description).length,
    [items],
  );

  // ── Spara passet, men inte vid varje tangenttryck ─────────
  useEffect(() => {
    if (stage !== "work" || restoring || rows.length === 0) return;
    const session: Session = { fileName, headers, rows, delimiter, cols, items, sources, savedAt: Date.now() };
    const t = setTimeout(() => { void saveSession(session); }, 800);
    return () => clearTimeout(t);
  }, [stage, restoring, fileName, headers, rows, delimiter, cols, items, sources]);

  // ── Fil in ────────────────────────────────────────────────
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
      setCols({ ...EMPTY_COLS, ...guessColumns(parsed.headers) });
      setItems({});
      setSources({});
      setSelected(new Set());
      setFilters(EMPTY_FILTERS);
      setStage("map");
    } catch {
      setError("Filen kunde inte läsas. Spara om den som CSV och försök igen.");
    }
  }

  const idCheck = useMemo(() => (cols.id ? checkIdColumn(rows, cols.id) : null), [rows, cols.id]);
  const ready = REQUIRED.every((k) => cols[k]) && Boolean(idCheck?.ok);

  function startWork() {
    setItems((prev) => initialItems(buildProducts(rows, cols), prev));
    setStage("work");
  }

  async function startOver() {
    await clearSession();
    setStage("upload");
    setFileName(""); setHeaders([]); setRows([]); setCols(EMPTY_COLS);
    setItems({}); setSources({}); setSelected(new Set()); setFilters(EMPTY_FILTERS);
    setReviewId(null); setError(null);
  }

  // ── Markering ─────────────────────────────────────────────
  const toggle = useCallback((id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }, []);

  const patchItem = useCallback((id: string, patch: Partial<WorkItem>) => {
    setItems((prev) => ({ ...prev, [id]: { ...(prev[id] ?? { template: "tillbehor" }), ...patch } }));
  }, []);

  // ── Skriv texter ──────────────────────────────────────────
  async function generate() {
    const queue = products.filter((p) => selected.has(p.id));
    if (queue.length === 0) return;

    cancelRef.current = false;
    setBusy(true);
    setError(null);

    // Steg 1: hämta produktsidorna. Bara de vi inte redan har — cachen gäller
    // hela passet och överlever en omladdning.
    let fetched = sources;
    try {
      fetched = await fetchSources(queue);
      setSources(fetched);
    } catch (e) {
      setBusy(false);
      setProgress(null);
      setError(e instanceof Error ? e.message : "Kunde inte hämta produktsidorna.");
      return;
    }
    if (cancelRef.current) {
      setBusy(false);
      setProgress(null);
      return;
    }

    setProgress({ phase: "skriver", done: 0, total: queue.length, waiting: false });

    // Batchas per mall: en huvudprodukt på 300 ord och en reservdel på 30
    // rymmer olika många per anrop, och blandade mallar i samma svar gör
    // modellen slarvigare med längderna.
    const byTemplate = new Map<TemplateId, Product[]>();
    for (const p of queue) {
      const t = items[p.id]?.template ?? "tillbehor";
      byTemplate.set(t, [...(byTemplate.get(t) ?? []), p]);
    }

    const batches: Array<{ template: TemplateId; products: Product[] }> = [];
    for (const [template, list] of byTemplate) {
      for (let i = 0; i < list.length; i += BATCH_SIZE[template]) {
        batches.push({ template, products: list.slice(i, i + BATCH_SIZE[template]) });
      }
    }

    let done = 0;
    try {
      for (const batch of batches) {
        if (cancelRef.current) break;
        const texts = await requestBatch(batch, fetched, (waiting) =>
          setProgress({ phase: "skriver", done, total: queue.length, waiting }),
        );
        if (texts === null) break; // avbrutet

        setItems((prev) => {
          const next = { ...prev };
          for (const t of texts) {
            next[t.id] = {
              ...(next[t.id] ?? { template: batch.template }),
              description: t.description,
              original: t.description,
              metaTitle: t.metaTitle,
              metaDescription: t.metaDescription,
              needsInfo: t.needsInfo,
              facts: t.facts,
              keywords: t.keywords,
              approved: false,
            };
          }
          return next;
        });

        done += batch.products.length;
        setProgress({ phase: "skriver", done, total: queue.length, waiting: false });
      }
      setSelected(new Set());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Något gick fel. Försök igen.");
    } finally {
      setBusy(false);
      setProgress(null);
    }
  }

  /**
   * Hämtar produktsidorna för de artiklar som har en adress och inte redan
   * finns i cachen. Returnerar hela cachen, inklusive misslyckade försök —
   * ett fel sparas också, så vi inte hamrar samma trasiga adress igen.
   */
  async function fetchSources(queue: Product[]): Promise<Record<string, PageResult>> {
    const missing = queue.filter((p) => p.url && !sources[p.id]);
    if (missing.length === 0) return sources;

    const next = { ...sources };
    setProgress({ phase: "hamtar", done: 0, total: missing.length, waiting: false });

    for (let i = 0; i < missing.length; i += SOURCE_BATCH) {
      if (cancelRef.current) break;
      const batch = missing.slice(i, i + SOURCE_BATCH);

      const results = await withRateLimitRetry(
        () => fetch("/api/product-texts/source", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ urls: batch.map((p) => p.url) }),
        }),
        (waiting) => setProgress({ phase: "hamtar", done: i, total: missing.length, waiting }),
      );
      if (results === null) break;

      const list = Array.isArray(results?.results) ? (results.results as PageResult[]) : [];
      // Servern svarar i samma ordning som adresserna skickades.
      batch.forEach((product, n) => {
        const hit = list[n];
        if (hit) next[product.id] = hit;
      });
      setSources({ ...next });
      setProgress({ phase: "hamtar", done: Math.min(i + SOURCE_BATCH, missing.length), total: missing.length, waiting: false });
    }
    return next;
  }

  /**
   * Kör ett anrop och väntar ut kön vid 429. Rate limit är 20 anrop per minut
   * och ett i taget — 601 artiklar går inte igenom utan att träffa den. Att
   * vänta ut den är rätt beteende; att visa ett fel är det inte.
   */
  async function withRateLimitRetry(
    call: () => Promise<Response>,
    onWait: (waiting: boolean) => void,
  ): Promise<Record<string, unknown> | null> {
    for (let attempt = 0; attempt < 20; attempt++) {
      if (cancelRef.current) return null;
      const res = await call();

      if (res.status === 429) {
        onWait(true);
        await new Promise((r) => setTimeout(r, 6_000));
        onWait(false);
        continue;
      }
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error ?? "Anropet gick inte igenom.");
      }
      return await res.json();
    }
    throw new Error("Kön släppte inte igenom. Vänta någon minut och fortsätt där du slutade.");
  }

  /**
   * Ett anrop, med väntan vid kö. Rate limit är 20 anrop per minut och ett
   * i taget — 601 artiklar går inte igenom utan att träffa den. Att vänta
   * ut den är rätt beteende; att visa ett fel är det inte.
   */
  async function requestBatch(
    batch: { template: TemplateId; products: Product[] },
    pages: Record<string, PageResult>,
    onWait: (waiting: boolean) => void,
  ): Promise<GeneratedText[] | null> {
    const payload = {
      products: batch.products.map((p) => {
        const page = pages[p.id];
        return {
          id: p.id,
          name: p.name,
          template: items[p.id]?.template ?? batch.template,
          category: p.category || undefined,
          subCategory: p.subCategory || undefined,
          producer: p.producer || undefined,
          model: p.model || undefined,
          current: p.current || undefined,
          page: page?.ok ? page : undefined,
        };
      }),
    };

    const data = await withRateLimitRetry(
      () => fetch("/api/product-texts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      }),
      onWait,
    );
    if (data === null) return null;

    const texts = Array.isArray(data.texts) ? data.texts : [];
    if (texts.length === 0) {
      throw new Error("Modellen svarade utan text. Försök igen — hjälper det inte, säg till.");
    }
    return texts;
  }

  // ── Godkännande ───────────────────────────────────────────
  const reviewList = visible;
  const reviewIndex = reviewId ? reviewList.findIndex((p) => p.id === reviewId) : -1;
  const reviewProduct = reviewIndex >= 0 ? reviewList[reviewIndex] : null;

  /** Första artikeln i den synliga listan som har en text att granska. */
  const firstDrafted = useMemo(
    () => visible.find((p) => items[p.id]?.description)?.id ?? visible[0]?.id ?? null,
    [visible, items],
  );

  const step = useCallback((delta: number) => {
    setReviewId((current) => {
      const i = reviewList.findIndex((p) => p.id === current);
      if (i === -1) return current;
      const next = reviewList[i + delta];
      return next ? next.id : current;
    });
  }, [reviewList]);

  function approveAndNext() {
    if (!reviewProduct) return;
    patchItem(reviewProduct.id, { approved: true });
    step(1);
  }

  // ── Export ────────────────────────────────────────────────
  async function saveEdits() {
    const pairs = Object.entries(items)
      .filter(([, i]) => i.approved && i.original && i.description && i.original !== i.description)
      .slice(0, 20);
    for (const [id, item] of pairs) {
      try {
        await fetch("/api/text-edits", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            kind: "product_text",
            original: item.original,
            edited: item.description,
            label: products.find((p) => p.id === id)?.name,
          }),
        });
      } catch {
        // Tyst med flit — användaren ska aldrig störas av att minnet fallerar.
      }
    }
  }

  function download() {
    if (!cols.id || !cols.description) return;
    // Dubbelt skydd: konsekvensen av ett dåligt artikelnummer är att skriva fel
    // data till hela butiken vid import, så vi kontrollerar igen här.
    const check = checkIdColumn(rows, cols.id);
    if (!check.ok) {
      setError(
        `Artikelnummerkolumnen "${cols.id}" har tomma eller upprepade värden. ` +
        "Exporten avbröts eftersom en import annars kunde skriva över flera artiklar med samma text.",
      );
      return;
    }
    if (approvedCount === 0) {
      setError("Inga artiklar är godkända ännu. Granska texterna först — filen skulle bli tom.");
      return;
    }

    const { csv } = buildImportCsv(
      { headers, rows, idColumn: cols.id, descriptionColumn: cols.description, approved },
      delimiter,
    );
    // Lär av redigeringarna. Körs utan att blockera nedladdningen: minnet är
    // en förbättring, aldrig en förutsättning för att få ut sin fil.
    void saveEdits();

    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = fileName.replace(/\.csv$/i, "") + "-for-import.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  // ── Vy ────────────────────────────────────────────────────
  return (
    <AppShell>
      <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-10 lg:py-12">
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

        {restoring && stage === "upload" && (
          <Card><p className="text-sm text-text-secondary">Hämtar ditt arbete…</p></Card>
        )}

        {!restoring && stage === "upload" && (
          <Card padding="none">
            <EmptyState
              title="Välj din artikelexport"
              body="I Wikinggruppen: Inställningar och verktyg → Import/Export → Artikeldata → Export av produktdata till fil. Ta med artikelnummer, produktnamn, beskrivning och URL — adressen används för att hämta specifikationer från produktsidan."
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
              {(Object.keys(FIELD_LABELS) as Array<keyof ColumnGuess>).map((key) => (
                <Field
                  key={key}
                  label={FIELD_LABELS[key]}
                  optional={!REQUIRED.includes(key)}
                  hint={
                    key === "description" ? "Kolumnen som skrivs över vid import."
                      : key === "url"
                        ? "Produktsidan hämtas en gång per artikel för att ge specifikationer att skriva ifrån."
                        : key === "producer" || key === "model"
                          ? "Räknas som verifierat underlag i texterna."
                          : undefined
                  }
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

            {cols.id && idCheck && !idCheck.ok && (
              <Alert tone="danger" title="Artikelnummerkolumnen duger inte" className="mt-6">
                Kolumnen <strong>{cols.id}</strong> har {idCheck.filled} ifyllda värden
                men bara {idCheck.unique} unika
                {idCheck.examples.length > 0 && (
                  <> — t.ex. {idCheck.examples.map((e) => `"${e}"`).join(", ")}</>
                )}.
                Varje artikel måste ha ett eget, unikt artikelnummer. Annars får
                flera produkter samma text, och en import skulle skriva över hela
                sortimentet med en enda beskrivning. Välj rätt kolumn för
                artikelnummer.
              </Alert>
            )}

            <div className="mt-8 flex flex-wrap items-center gap-3">
              <Button onClick={startWork} disabled={!ready}>Fortsätt</Button>
              <Button variant="ghost" onClick={() => setStage("upload")}>Välj en annan fil</Button>
              {!ready && (
                <p className="text-sm text-text-tertiary">
                  Artikelnummer, produktnamn och beskrivning behövs.
                </p>
              )}
            </div>
          </div>
        )}

        {stage === "work" && reviewProduct && (
          <ReviewPane
            product={reviewProduct}
            item={items[reviewProduct.id] ?? { template: "tillbehor" }}
            source={sources[reviewProduct.id]}
            index={reviewIndex}
            total={reviewList.length}
            onChange={(patch) => patchItem(reviewProduct.id, patch)}
            onApprove={approveAndNext}
            onNext={() => step(1)}
            onPrev={() => step(-1)}
            onClose={() => setReviewId(null)}
          />
        )}

        {stage === "work" && !reviewProduct && (
          <div>
            {/* Nyckeltal: bara sådant som går att räkna ur filen. */}
            <Card className="mb-5">
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                <Stat value={stats.total} label="artiklar" />
                <Stat value={stats.missing} label="saknar text" tone={stats.missing > 0 ? "danger" : undefined} />
                <Stat value={stats.thin} label={`under ${THIN_LIMIT} tecken`} tone={stats.thin > 0 ? "warning" : undefined} />
                <Stat value={stats.median} label="tecken i median" />
              </div>
              <p className="mt-4 text-xs text-text-tertiary">
                {fileName} · sparad i den här webbläsaren
                {!canPersist() && " (den här webbläsaren sparar inte — ladda inte om sidan)"}
                {" · "}
                <button type="button" onClick={startOver} className="underline hover:text-text-secondary">
                  börja om med en annan fil
                </button>
              </p>
            </Card>

            {/* Filter och sortering */}
            <Card className="mb-5" padding="sm">
              <div className="space-y-3">
                <div className="grid gap-3 sm:grid-cols-3">
                  <Input
                    placeholder="Sök namn, artikelnummer, modell"
                    value={filters.query}
                    onChange={(e) => setFilters({ ...filters, query: e.target.value })}
                  />
                  <select
                    className={selectClass}
                    value={filters.category}
                    onChange={(e) => setFilters({ ...filters, category: e.target.value })}
                    aria-label="Kategori"
                  >
                    <option value="">Alla kategorier</option>
                    {categories.map((c) => <option key={c} value={c}>{c}</option>)}
                  </select>
                  <select
                    className={selectClass}
                    value={filters.template}
                    onChange={(e) => setFilters({ ...filters, template: e.target.value as Filters["template"] })}
                    aria-label="Mall"
                  >
                    <option value="alla">Alla mallar</option>
                    {TEMPLATE_IDS.map((t) => <option key={t} value={t}>{TEMPLATES[t].label}</option>)}
                  </select>
                </div>

                <div className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1">
                  {STATUS_LABELS.map((s) => (
                    <button
                      key={s.value}
                      type="button"
                      onClick={() => setFilters({ ...filters, status: s.value })}
                      aria-pressed={filters.status === s.value}
                      className={cx(
                        "min-h-9 shrink-0 rounded-full border px-3 text-sm transition-colors",
                        filters.status === s.value
                          ? "border-primary bg-primary/10 text-text-primary"
                          : "border-border bg-surface text-text-secondary hover:border-border-strong",
                      )}
                    >
                      {s.label}
                    </button>
                  ))}
                </div>

                <div className="flex flex-wrap items-center gap-2 text-sm">
                  <span className="text-text-tertiary">Sortera:</span>
                  {SORT_LABELS.map((s) => (
                    <button
                      key={s.value}
                      type="button"
                      onClick={() => {
                        if (sortKey === s.value) setSortDir(sortDir === "asc" ? "desc" : "asc");
                        else { setSortKey(s.value); setSortDir("asc"); }
                      }}
                      aria-pressed={sortKey === s.value}
                      className={cx(
                        "min-h-9 rounded-lg border px-2.5 transition-colors",
                        sortKey === s.value
                          ? "border-primary bg-primary/10 text-text-primary"
                          : "border-border bg-surface text-text-secondary hover:border-border-strong",
                      )}
                    >
                      {s.label}
                      {sortKey === s.value && <span className="ml-1 text-xs">{sortDir === "asc" ? "↑" : "↓"}</span>}
                    </button>
                  ))}
                </div>
              </div>
            </Card>

            {/* Åtgärdsrad */}
            <div className="sticky top-0 z-10 -mx-4 mb-4 border-b border-border bg-bg/95 px-4 py-3 backdrop-blur sm:mx-0 sm:rounded-lg sm:border sm:px-4">
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-sm text-text-secondary">
                  {visible.length} visas
                  {selected.size > 0 && ` · ${selected.size} markerade`}
                </p>
                <div className="ml-auto flex flex-wrap items-center gap-2">
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() =>
                      setSelected(selected.size > 0 ? new Set() : new Set(visible.slice(0, RENDER_CAP).map((p) => p.id)))
                    }
                  >
                    {selected.size > 0 ? "Avmarkera" : "Markera synliga"}
                  </Button>
                  {draftCount > 0 && (
                    <Button variant="secondary" size="sm" onClick={() => setReviewId(firstDrafted)} disabled={!firstDrafted}>
                      Granska
                    </Button>
                  )}
                  <Button onClick={generate} loading={busy} disabled={selected.size === 0}>
                    {busy && progress
                      ? progress.waiting
                        ? "Väntar på kö…"
                        : progress.phase === "hamtar"
                          ? `Hämtar produktsidor ${progress.done}/${progress.total}`
                          : `Skriver ${progress.done}/${progress.total}`
                      : selected.size === 0
                        ? "Skriv texter"
                        : `Skriv ${selected.size} ${selected.size === 1 ? "text" : "texter"}`}
                  </Button>
                  {busy && (
                    <Button variant="ghost" size="sm" onClick={() => { cancelRef.current = true; }}>
                      Avbryt
                    </Button>
                  )}
                </div>
              </div>
            </div>

            {approvedCount > 0 && (
              <Alert
                tone="success"
                title={approvedCount === 1 ? "1 godkänd text" : `${approvedCount} godkända texter`}
                className="mb-5"
              >
                <p>
                  Filen innehåller hela katalogen med Ignore=1 på allt utom de
                  godkända, så importen rör bara dem.
                </p>
                <div className="mt-3">
                  <Button size="sm" onClick={download}>Ladda ner CSV för import</Button>
                </div>
              </Alert>
            )}

            {visible.length === 0 ? (
              <Card padding="none">
                <EmptyState
                  title="Inga artiklar matchar"
                  body="Ändra filtret, eller sök på något annat."
                  action={<Button variant="secondary" onClick={() => setFilters(EMPTY_FILTERS)}>Nollställ filter</Button>}
                />
              </Card>
            ) : (
              <ul className="space-y-2.5">
                {visible.slice(0, RENDER_CAP).map((p) => {
                  const item = items[p.id];
                  const source = sources[p.id];
                  const state = itemState(p, item, THIN_LIMIT);
                  const lost = lostFacts(p, item);
                  const chip = STATE_CHIP[state];
                  const checked = selected.has(p.id);
                  return (
                    <li key={p.id}>
                      <Card padding="sm" className={cx("transition-colors", checked && "border-primary/40")}>
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
                              {chip && <Chip tone={chip.tone}>{chip.label}</Chip>}
                            </div>
                            <p className="mt-0.5 text-xs text-text-tertiary">
                              {p.id}
                              {p.category && ` · ${p.category}`}
                              {` · ${p.currentLength} tecken`}
                              {p.stock !== null && ` · ${p.stock} i lager`}
                            </p>

                            <div className="mt-2.5 flex flex-wrap items-center gap-2">
                              <select
                                className="min-h-9 rounded-lg border border-border bg-surface px-2 text-xs text-text-secondary focus:border-primary focus:outline-none"
                                value={item?.template ?? "tillbehor"}
                                onChange={(e) => patchItem(p.id, { template: e.target.value as TemplateId })}
                                aria-label={`Mall för ${p.name}`}
                              >
                                {TEMPLATE_IDS.map((t) => (
                                  <option key={t} value={t}>{TEMPLATES[t].label}</option>
                                ))}
                              </select>
                              {item?.description && (
                                <Button variant="ghost" size="sm" onClick={() => setReviewId(p.id)}>
                                  Granska
                                </Button>
                              )}
                            </div>

                            {item?.needsInfo && item.needsInfo.length > 0 && (
                              <p className="mt-2 text-xs text-warning">
                                Saknar: {item.needsInfo.join(", ")}
                              </p>
                            )}
                            {lost.length > 0 && (
                              <p className="mt-2 text-xs text-warning">
                                Tappade fakta: {lost.join(", ")}
                              </p>
                            )}

                            {source && !source.ok && (
                              <p className="mt-2 text-xs text-text-tertiary">
                                Produktsidan: {source.reason}
                              </p>
                            )}
                            {source?.ok && source.specs.length > 0 && (
                              <p className="mt-2 text-xs text-text-tertiary">
                                {source.specs.length} specifikationer hämtade från produktsidan
                              </p>
                            )}
                          </div>
                        </div>
                      </Card>
                    </li>
                  );
                })}
              </ul>
            )}

            {visible.length > RENDER_CAP && (
              <p className="mt-5 text-sm text-text-tertiary">
                Visar de {RENDER_CAP} första av {visible.length}. Filtrera eller ta dem i omgångar.
              </p>
            )}
          </div>
        )}
      </div>
    </AppShell>
  );
}

function Stat({ value, label, tone }: { value: number; label: string; tone?: "danger" | "warning" }) {
  return (
    <div>
      <p className={cx(
        "text-2xl font-medium tabular-nums",
        tone === "danger" && "text-danger",
        tone === "warning" && "text-warning",
      )}>
        {value}
      </p>
      <p className="text-sm text-text-secondary">{label}</p>
    </div>
  );
}

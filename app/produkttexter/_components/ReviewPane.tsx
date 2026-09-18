"use client";

// ─────────────────────────────────────────────────────────────
// Godkännandevyn: en artikel i taget, före och efter sida vid sida.
//
// Det här är momentet som upprepas 601 gånger. Därför ligger tangent-
// bordet i centrum: Enter godkänner och går vidare, pilarna bläddrar,
// E hoppar ner i texten, Esc tar dig tillbaka till listan. Musen ska
// aldrig behövas för det som upprepas.
//
// På mobil finns ingen sida vid sida att ha — då blir det före över
// efter, och knapparna hamnar i en rad som når tummen.
// ─────────────────────────────────────────────────────────────
import { useEffect, useRef } from "react";
import { Button, Card, Chip, Alert, cx } from "@/app/_shared/primitives";
import { Textarea } from "@/app/_shared/Textarea";
import { Input } from "@/app/_shared/primitives";
import { HtmlPreview } from "./HtmlPreview";
import { TEMPLATES, META_TITLE_MAX, META_DESCRIPTION_MAX, type TemplateId } from "@/lib/productText/templates";
import { visibleLength, wordCount } from "@/lib/productText/html";
import type { Product, WorkItem } from "@/lib/productText/session";
import type { PageResult } from "@/lib/productText/pageFacts";

export interface ReviewPaneProps {
  product: Product;
  item: WorkItem;
  /** Vad hämtningen av produktsidan gav. Visas så du ser vad texten vilar på. */
  source?: PageResult;
  /** Position i granskningslistan, för "3 av 48". */
  index: number;
  total: number;
  onChange: (patch: Partial<WorkItem>) => void;
  onApprove: () => void;
  onNext: () => void;
  onPrev: () => void;
  onClose: () => void;
}

/** Sant när fokus står i ett fält, så genvägar inte kapar skrivandet. */
function inTextField(target: EventTarget | null): boolean {
  const el = target as HTMLElement | null;
  if (!el) return false;
  return el.tagName === "TEXTAREA" || el.tagName === "INPUT" || el.isContentEditable;
}

export function ReviewPane({
  product, item, source, index, total, onChange, onApprove, onNext, onPrev, onClose,
}: ReviewPaneProps) {
  const editRef = useRef<HTMLTextAreaElement>(null);
  const template = TEMPLATES[item.template];
  const draft = item.description ?? "";
  const words = wordCount(draft);
  const outsideRange = draft !== "" && (words < template.minWords || words > template.maxWords);
  const needs = item.needsInfo ?? [];

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        // Esc gäller alltid: står du i textrutan lämnar den först fältet.
        if (inTextField(e.target)) (e.target as HTMLElement).blur();
        else onClose();
        return;
      }
      if (inTextField(e.target) || e.metaKey || e.ctrlKey || e.altKey) return;

      if (e.key === "Enter") { e.preventDefault(); onApprove(); }
      else if (e.key === "ArrowRight" || e.key === "j") { e.preventDefault(); onNext(); }
      else if (e.key === "ArrowLeft" || e.key === "k") { e.preventDefault(); onPrev(); }
      else if (e.key === "e") { e.preventDefault(); editRef.current?.focus(); }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onApprove, onNext, onPrev, onClose]);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <Button variant="ghost" size="sm" onClick={onClose}>← Tillbaka till listan</Button>
        <span className="text-sm text-text-tertiary">{index + 1} av {total}</span>
        <div className="ml-auto flex items-center gap-2">
          <Button variant="secondary" size="sm" onClick={onPrev} aria-label="Föregående artikel">←</Button>
          <Button variant="secondary" size="sm" onClick={onNext} aria-label="Nästa artikel">→</Button>
        </div>
      </div>

      <div>
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="text-lg font-medium tracking-tight">{product.name}</h2>
          {item.approved && <Chip tone="success">Godkänd</Chip>}
          {needs.length > 0 && <Chip tone="warning">Behöver uppgifter</Chip>}
        </div>
        <p className="mt-1 text-xs text-text-tertiary">
          {product.id}
          {product.category && ` · ${product.category}`}
          {product.producer && ` · ${product.producer}`}
          {product.model && ` · ${product.model}`}
        </p>
      </div>

      {needs.length > 0 && (
        <Alert tone="warning" title="Det här saknades i underlaget">
          <p>
            Texten är skriven utan {needs.join(", ")}. Lägg in uppgifterna i
            artikeldatan och skriv om, eller fyll i dem själv nedan.
          </p>
        </Alert>
      )}

      {source && <SourceSummary source={source} />}

      {/* Före och efter. På mobil under varandra, från lg sida vid sida. */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card padding="sm" className="min-w-0">
          <p className="mb-2 text-xs font-medium uppercase tracking-wide text-text-tertiary">
            Före · {product.currentLength} tecken
          </p>
          <HtmlPreview html={product.current} />
        </Card>

        <Card padding="sm" className={cx("min-w-0", draft && "border-primary/40")}>
          <p className="mb-2 text-xs font-medium uppercase tracking-wide text-text-tertiary">
            Efter · {visibleLength(draft)} tecken · {words} ord
          </p>
          <HtmlPreview html={draft} />
        </Card>
      </div>

      <div className="space-y-4">
        <div>
          <div className="mb-1.5 flex flex-wrap items-baseline gap-x-2">
            <label htmlFor="pt-draft" className="text-sm font-medium">Beskrivning (HTML)</label>
            <span className={cx("text-xs", outsideRange ? "text-warning" : "text-text-tertiary")}>
              {template.label}: {template.minWords}–{template.maxWords} ord
            </span>
            <span className="ml-auto text-xs text-text-tertiary">E för att hoppa hit</span>
          </div>
          <Textarea
            id="pt-draft"
            ref={editRef}
            rows={8}
            className="font-mono text-xs"
            value={draft}
            onChange={(e) => onChange({ description: e.target.value })}
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <MetaField
            label="Meta title"
            max={META_TITLE_MAX}
            value={item.metaTitle ?? ""}
            onChange={(metaTitle) => onChange({ metaTitle })}
          />
          <MetaField
            label="Meta description"
            max={META_DESCRIPTION_MAX}
            value={item.metaDescription ?? ""}
            onChange={(metaDescription) => onChange({ metaDescription })}
          />
        </div>

        <TemplateSwitch
          value={item.template}
          onChange={(t) => onChange({ template: t })}
        />
      </div>

      <div className="sticky bottom-20 flex flex-wrap items-center gap-3 rounded-lg border border-border bg-surface p-3 sm:bottom-4">
        <Button onClick={onApprove} disabled={!draft.trim()}>
          {item.approved ? "Godkänd — nästa" : "Godkänn och nästa"}
        </Button>
        <Button variant="secondary" onClick={onNext}>Hoppa över</Button>
        <p className="hidden text-xs text-text-tertiary sm:block">
          Enter godkänner · ← → bläddrar · Esc stänger
        </p>
      </div>
    </div>
  );
}

/**
 * Vad texten vilar på. Den här rutan finns för att godkännandet ska vara ett
 * riktigt beslut: ser du att sidan gav noll specifikationer vet du varför
 * texten är kort, i stället för att tro att modellen slarvade.
 */
function SourceSummary({ source }: { source: PageResult }) {
  if (!source.ok) {
    return (
      <Alert tone="info" title="Produktsidan kunde inte läsas">
        {source.reason} Texten är skriven enbart på artikeldatan.
      </Alert>
    );
  }

  const parts: string[] = [];
  if (source.specs.length > 0) parts.push(`${source.specs.length} specifikationer`);
  if (source.description) parts.push("sidans egen text");
  if (source.documents.length > 0) parts.push(`${source.documents.length} dokument`);

  return (
    <details className="rounded-lg border border-border bg-surface p-3">
      <summary className="cursor-pointer text-sm text-text-secondary">
        Underlag från produktsidan: {parts.length > 0 ? parts.join(", ") : "inget användbart"}
      </summary>
      <div className="mt-3 space-y-2 text-xs text-text-tertiary">
        {source.specs.length > 0 && (
          <dl className="grid gap-x-4 gap-y-1 sm:grid-cols-2">
            {source.specs.map((spec) => (
              <div key={spec.label} className="flex gap-2">
                <dt className="shrink-0 font-medium text-text-secondary">{spec.label}:</dt>
                <dd className="min-w-0 break-words">{spec.value}</dd>
              </div>
            ))}
          </dl>
        )}
        {source.documents.length > 0 && (
          <p>Dokument: {source.documents.map((d) => d.label).join(", ")}</p>
        )}
        <p className="break-all">{source.url}</p>
      </div>
    </details>
  );
}

function MetaField({
  label, value, max, onChange,
}: { label: string; value: string; max: number; onChange: (v: string) => void }) {
  const over = value.length > max;
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-baseline gap-2">
        <label className="text-sm font-medium" htmlFor={`pt-${label}`}>{label}</label>
        <span className={cx("ml-auto text-xs tabular-nums", over ? "font-medium text-danger" : "text-text-tertiary")}>
          {value.length}/{max}
        </span>
      </div>
      <Input
        id={`pt-${label}`}
        invalid={over}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}

function TemplateSwitch({ value, onChange }: { value: TemplateId; onChange: (t: TemplateId) => void }) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-sm font-medium">Mall</span>
      <div className="flex flex-wrap gap-2">
        {Object.values(TEMPLATES).map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => onChange(t.id)}
            aria-pressed={value === t.id}
            className={cx(
              "min-h-11 rounded-lg border px-3 py-2 text-left text-sm transition-colors",
              value === t.id
                ? "border-primary bg-primary/10 text-text-primary"
                : "border-border bg-surface text-text-secondary hover:border-border-strong",
            )}
          >
            <span className="block font-medium">{t.label}</span>
            <span className="block text-xs text-text-tertiary">{t.minWords}–{t.maxWords} ord</span>
          </button>
        ))}
      </div>
      <p className="text-xs text-text-tertiary">
        Byter du mall behöver texten skrivas om för att följa den.
      </p>
    </div>
  );
}

"use client";

// ─────────────────────────────────────────────────────────────
// Delar som listan och detaljsidan har gemensamt. Allt ritas med
// primitiverna; siffror visas bara där de faktiskt är inlagda, och
// beräknade mått märks "beräknat".
// ─────────────────────────────────────────────────────────────
import { useState, type ReactNode } from "react";
import { Alert, Button, Card, Chip, Field, Input, ToggleChip, cx } from "@/app/_shared/primitives";
import { Textarea } from "@/app/_shared/Textarea";
import { IconCheck } from "@/app/_shared/icons";
import {
  MAX_SYNLIGA_KORNINGAR, RESULT_TYPES, RESULT_TYPE_LABELS, STATUS_LABELS, NOTE_MAX, TITLE_MAX,
  costPerLabel, costPerResult, countLabel, endedRuns, formatCount, formatKr, formatKrRounded,
  formatPeriod, formatRatio, hasAnyResult, parseResultsForm, readStrategy, resultsFormFrom, roas,
  runComparison, validateCampaignForm,
  type Campaign, type CampaignForm, type CampaignFormErrors, type CampaignResults,
  type ComparisonMetric, type ResultType, type ResultsForm, type ResultsFormErrors,
  type StrategyView,
} from "@/lib/campaigns/logic";
import type { StoreResult } from "@/lib/campaigns/store";
import { Sheet } from "./Sheet";

/** Sektionsetikett — samma versaler som resten av appen. */
export function SectionLabel({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <p className={cx("text-xs font-semibold uppercase tracking-[0.12em] text-text-tertiary", className)}>
      {children}
    </p>
  );
}

export function StatusChip({ status }: { status: Campaign["status"] }) {
  if (status === "active") {
    return (
      <Chip tone="primary">
        <span aria-hidden className="mr-1.5 inline-block h-1.5 w-1.5 rounded-full bg-current" />
        {STATUS_LABELS.active}
      </Chip>
    );
  }
  return <Chip>{STATUS_LABELS[status]}</Chip>;
}

/** "Chip · 15 sep – 12 okt · dag 8 av 28" */
export function StatusLine({ campaign, today, note }: { campaign: Campaign; today: string; note?: string | null }) {
  return (
    <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
      <StatusChip status={campaign.status} />
      <span className="text-[13px] text-text-tertiary">
        {formatPeriod(campaign.starts_on, campaign.ends_on, today)}
        {note ? ` · ${note}` : ""}
      </span>
    </div>
  );
}

/* ── Strategin ──────────────────────────────────────────── */

function StrategyDetails({ view }: { view: StrategyView }) {
  if (view.details.length === 0) {
    return <p className="text-sm text-text-secondary">Strategin innehåller inga fler strukturerade detaljer.</p>;
  }
  return (
    <dl className="grid gap-3 sm:grid-cols-2">
      {view.details.map((d) => (
        <div key={d.label}>
          <dt className="text-xs text-text-tertiary">{d.label}</dt>
          <dd className="mt-0.5 text-sm leading-relaxed text-text-primary">{d.value}</dd>
        </div>
      ))}
    </dl>
  );
}

/**
 * Strategisk riktning. "tint" överst på planerad/pågående kampanj,
 * "quiet" längst ner på en avslutad.
 */
export function StrategyBlock({ campaign, tone = "tint" }: { campaign: Campaign; tone?: "tint" | "quiet" }) {
  const [open, setOpen] = useState(false);
  const view = readStrategy(campaign.strategy);
  const hasMore = view.details.length > 0;

  if (!campaign.strategy) {
    return (
      <Card padding="sm" className="bg-surface-sunken">
        <SectionLabel>Strategi</SectionLabel>
        <p className="mt-2 text-sm text-text-secondary">Strategin kunde inte läsas just nu.</p>
      </Card>
    );
  }

  return (
    <Card padding="sm" className={tone === "tint" ? "border-primary/20 bg-primary/5" : "bg-surface-sunken"}>
      {/* I den tysta varianten står rubriken redan ovanför kortet. */}
      {tone === "tint" && <SectionLabel>{view.direction ? "Strategisk riktning" : "Strategi"}</SectionLabel>}
      {view.direction ? (
        <p className={cx("leading-snug", tone === "tint" ? "mt-2 text-lg font-medium tracking-tight" : "text-sm")}>
          {view.direction}
        </p>
      ) : (
        // Ingen riktning går att läsa säkert: visa bara vad raden faktiskt heter.
        <p className={cx("text-sm", tone === "tint" && "mt-2")}>
          {view.title || "Namnlös strategi"}
          {view.goal && <span className="text-text-secondary"> · {view.goal}</span>}
        </p>
      )}
      {tone === "tint" && view.rationale.length > 0 && (
        <ul className="mt-2 list-disc space-y-1 pl-5 text-sm leading-relaxed text-text-secondary">
          {view.rationale.map((r, i) => <li key={i}>{r}</li>)}
        </ul>
      )}
      {hasMore && (
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          className="mt-2 inline-flex min-h-11 items-center text-sm font-medium text-primary underline underline-offset-4 sm:min-h-0 sm:py-1"
        >
          {open ? "Dölj strategin" : "Visa hela strategin"}
        </button>
      )}
      {open && <div className="mt-3 border-t border-border pt-3"><StrategyDetails view={view} /></div>}
    </Card>
  );
}

/* ── Resultat ───────────────────────────────────────────── */

/** "27 köp", "3 leads" … neutralt "4 resultat" för Annat och utan typ. */
function countPhrase(count: number, type: ResultType | null): string {
  const word = type && type !== "other" ? RESULT_TYPE_LABELS[type].toLowerCase() : "resultat";
  return `${formatCount(count)} ${word}`;
}

/** En rad med det som finns: "3 600 kr spenderat · 27 köp · 18 630 kr omsättning · ROAS 5,2 · beräknat". */
export function ResultsLine({ r, className }: { r: CampaignResults; className?: string }) {
  const parts: ReactNode[] = [];
  if (r.spend_amount !== null) parts.push(<>{formatKr(r.spend_amount)} <span className="text-text-tertiary">spenderat</span></>);
  if (r.result_count !== null) parts.push(<>{countPhrase(r.result_count, r.result_type)}</>);
  if (r.revenue_amount !== null) parts.push(<>{formatKr(r.revenue_amount)} <span className="text-text-tertiary">omsättning</span></>);
  const ro = roas(r);
  // Beräknat, aldrig lagrat — märks lika tydligt här som i rutnätet.
  if (ro !== null) parts.push(<><span className="text-text-tertiary">ROAS</span> {formatRatio(ro)} <span className="text-text-tertiary">· beräknat</span></>);
  if (parts.length === 0) return null;
  return (
    <p className={cx("text-sm tabular-nums text-text-primary", className)}>
      {parts.map((p, i) => <span key={i}>{i > 0 && " · "}{p}</span>)}
    </p>
  );
}

/* ── Tidigare körningar ─────────────────────────────────── */

/**
 * Jämförelsemåttet för EN körning, färdigformaterat. Null när körningen
 * saknar underlaget — då visas dess egna siffror i stället, aldrig ett
 * påhittat mått.
 *
 * ROAS får ett × här. Sifferrutnätet skriver "5,0" under etiketten
 * "ROAS", men i löpande text läser "gick från 4,0 till 5,0" fel.
 */
function matvarde(r: Campaign, metric: ComparisonMetric): string | null {
  if (metric === "roas") {
    const v = roas(r);
    return v === null ? null : `${formatRatio(v)}×`;
  }
  const v = costPerResult(r);
  return v === null ? null : formatKrRounded(v);
}

/**
 * Kampanjens historik: de senaste avslutade körningarna av samma
 * strategi, nyast först, med sina lärdomar.
 *
 * BARA avslutade. En planerad eller pågående kampanj med samma strategi
 * är inget utfall — den varken visas eller gör att sektionen dyker upp.
 * Finns bara den här körningen renderas ingenting alls.
 *
 * Kompakt med flit: högst tre körningar, ingen "visa alla", inga
 * kolumner. Det här är kampanjens lärande, inte en analysvy.
 *
 * Jämförelseraden konstaterar vad som hände. Inget "bättre", inget
 * "förbättrades", ingen tröskel — talen står för sig själva.
 */
export function TidigareKorningar({
  runs, currentId, today,
}: {
  runs: Campaign[]; currentId: string; today: string;
}) {
  const avslutade = endedRuns(runs);
  if (avslutade.length < 2) return null;

  const jamforelse = runComparison(runs);
  const synliga = avslutade.slice(0, MAX_SYNLIGA_KORNINGAR);

  return (
    <section className="mt-8">
      <SectionLabel className="mb-3">Tidigare körningar</SectionLabel>

      {jamforelse && (
        <p className="mb-4 text-[15px] leading-relaxed tabular-nums">
          {jamforelse.label} gick från{" "}
          {jamforelse.metric === "roas"
            ? `${formatRatio(jamforelse.from)}×`
            : formatKrRounded(jamforelse.from)}{" "}
          till{" "}
          {jamforelse.metric === "roas"
            ? `${formatRatio(jamforelse.to)}×`
            : formatKrRounded(jamforelse.to)}
          .
        </p>
      )}

      <div className="border-t border-border">
        {synliga.map((k, i) => {
          // Måttet i högerkant visas BARA på de två körningar
          // runComparison faktiskt ställde mot varandra — de två första i
          // endedRuns. Stod det även på den tredje såg jämförelseraden ut
          // att gälla alla tre. Äldre körningar är historik och visar sina
          // egna siffror.
          const matt = jamforelse && i < 2 ? matvarde(k, jamforelse.metric) : null;
          return (
            <div key={k.id} className="border-b border-border py-3.5">
              <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                <p className="text-[13px] text-text-tertiary">
                  {formatPeriod(k.starts_on, k.ends_on, today)}
                  {k.id === currentId && (
                    <span className="text-text-secondary"> · Denna körning</span>
                  )}
                </p>
                {matt && (
                  <p className="text-sm font-medium tabular-nums">
                    <span className="font-normal text-text-tertiary">{jamforelse!.label}</span> {matt}
                  </p>
                )}
              </div>

              {/* Saknas jämförelsemåttet visas körningens egna siffror —
                  fakta, inget härlett. Finns inga alls sägs det rakt ut. */}
              {!matt &&
                (hasAnyResult(k) ? (
                  <ResultsLine r={k} className="mt-1.5 text-[13px]" />
                ) : (
                  <p className="mt-1.5 text-[13px] text-text-tertiary">Inga resultat inlagda.</p>
                ))}

              <p
                className={cx(
                  "mt-2 text-sm leading-relaxed",
                  k.learning?.trim() ? "whitespace-pre-line text-text-secondary" : "text-text-tertiary",
                )}
              >
                {k.learning?.trim() || "Ingen lärdom sparad."}
              </p>
            </div>
          );
        })}
      </div>
    </section>
  );
}

/** Rutnät för avslutad kampanj. Bara inlagda värden; ROAS märkt som beräknad. */
export function ResultFigures({ r }: { r: CampaignResults }) {
  const cells: Array<{ k: string; v: string; calc?: boolean }> = [];
  if (r.spend_amount !== null) cells.push({ k: "Spenderat", v: formatKr(r.spend_amount) });
  if (r.result_count !== null) cells.push({ k: countLabel(r.result_type), v: formatCount(r.result_count) });
  if (r.revenue_amount !== null) cells.push({ k: "Omsättning", v: formatKr(r.revenue_amount) });
  const ro = roas(r);
  if (ro !== null) cells.push({ k: "ROAS", v: formatRatio(ro), calc: true });
  const cpr = costPerResult(r);
  if (cells.length === 0 && cpr === null) return null;
  return (
    <div>
      {cells.length > 0 && (
        <div className="grid grid-cols-2 overflow-hidden rounded border border-border bg-surface">
          {cells.map((c, i) => (
            <div
              key={c.k}
              className={cx(
                "px-4 py-3.5",
                i % 2 === 0 && "border-r border-border",
                i < cells.length - (cells.length % 2 === 0 ? 2 : 1) && "border-b border-border",
                c.calc && "bg-surface-sunken",
              )}
            >
              <p className="text-xs text-text-tertiary">{c.k}{c.calc && " · beräknat"}</p>
              <p className="mt-0.5 text-xl font-medium tabular-nums tracking-tight">{c.v}</p>
            </div>
          ))}
        </div>
      )}
      {cpr !== null && (
        <p className="mt-2.5 text-[13px] text-text-secondary">
          {costPerLabel(r.result_type)}: {formatKrRounded(cpr)} <span className="text-text-tertiary">· beräknat</span>
        </p>
      )}
    </div>
  );
}

/* ── Formulär: namn och period ──────────────────────────── */

export function CampaignFormFields({ form, setForm, errors, disabled }: {
  form: CampaignForm;
  setForm: (f: CampaignForm) => void;
  errors: CampaignFormErrors;
  disabled?: boolean;
}) {
  return (
    <div className="flex flex-col gap-4">
      <Field label="Namn" error={errors.title}>
        {(p) => (
          <Input
            {...p} data-autofocus value={form.title} maxLength={TITLE_MAX} disabled={disabled}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
          />
        )}
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Start" error={errors.startsOn}>
          {(p) => (
            <Input
              {...p} type="date" value={form.startsOn} disabled={disabled}
              onChange={(e) => setForm({ ...form, startsOn: e.target.value })}
            />
          )}
        </Field>
        <Field label="Slut" error={errors.endsOn}>
          {(p) => (
            <Input
              {...p} type="date" value={form.endsOn} min={form.startsOn || undefined} disabled={disabled}
              onChange={(e) => setForm({ ...form, endsOn: e.target.value })}
            />
          )}
        </Field>
      </div>
    </div>
  );
}

/** Validerar, anropar och visar ärligt fel. Returnerar id vid lyckat anrop. */
export function useCampaignFormSubmit(submit: (f: CampaignForm) => Promise<StoreResult<string>>) {
  const [errors, setErrors] = useState<CampaignFormErrors>({});
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  async function run(form: CampaignForm): Promise<string | null> {
    if (saving) return null;
    setError("");
    const v = validateCampaignForm(form);
    if (!v.ok) { setErrors(v.errors); return null; }
    setErrors({});
    setSaving(true);
    const res = await submit(v.value);
    setSaving(false);
    if (!res.ok) { setError(res.error); return null; }
    return res.data;
  }
  return { errors, error, saving, run };
}

/* ── Ark: resultat ──────────────────────────────────────── */

export function ResultsSheet({ campaign, onClose, onSave }: {
  campaign: Campaign;
  onClose: () => void;
  onSave: (r: CampaignResults) => Promise<StoreResult<Campaign>>;
}) {
  const [form, setForm] = useState<ResultsForm>(() => resultsFormFrom(campaign));
  const [errors, setErrors] = useState<ResultsFormErrors>({});
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  async function save() {
    if (saving) return;
    setError("");
    const parsed = parseResultsForm(form);
    if (!parsed.ok) { setErrors(parsed.errors); return; }
    setErrors({});
    setSaving(true);
    const res = await onSave(parsed.value);
    setSaving(false);
    if (!res.ok) { setError(res.error); return; }
    onClose();
  }

  const countName = form.type ? `Antal ${RESULT_TYPE_LABELS[form.type].toLowerCase()}` : "Antal";

  return (
    <Sheet title="Resultat" onClose={onClose} busy={saving}>
      <p className="mb-4 text-sm text-text-secondary">Fyll i det du vet, när du vet det. Allt är frivilligt.</p>
      <form noValidate className="flex flex-col gap-4" onSubmit={(e) => { e.preventDefault(); void save(); }}>
        <Field label="Spenderat (kr)" error={errors.spend}>
          {(p) => (
            <Input {...p} data-autofocus inputMode="decimal" autoComplete="off" value={form.spend} disabled={saving}
              onChange={(e) => setForm({ ...form, spend: e.target.value })} />
          )}
        </Field>
        <div className="flex flex-col gap-1.5">
          <p id="result-type-label" className="text-sm font-medium">Vad räknar du?</p>
          <div role="group" aria-labelledby="result-type-label" className="flex flex-wrap gap-2">
            {RESULT_TYPES.map((t) => (
              <ToggleChip
                key={t}
                active={form.type === t}
                disabled={saving}
                onClick={() => setForm({ ...form, type: form.type === t ? null : t })}
              >
                {RESULT_TYPE_LABELS[t]}
              </ToggleChip>
            ))}
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label={countName} error={errors.count}>
            {(p) => (
              <Input {...p} inputMode="numeric" autoComplete="off" value={form.count} disabled={saving}
                onChange={(e) => setForm({ ...form, count: e.target.value })} />
            )}
          </Field>
          <Field label="Omsättning (kr)" error={errors.revenue}>
            {(p) => (
              <Input {...p} inputMode="decimal" autoComplete="off" value={form.revenue} disabled={saving}
                onChange={(e) => setForm({ ...form, revenue: e.target.value })} />
            )}
          </Field>
        </div>
        <Alert>ROAS och kostnad per resultat räknas fram när underlaget finns. De sparas inte.</Alert>
        <Field label="Notering" optional error={errors.note}>
          {(p) => (
            <Textarea {...p} rows={3} maxLength={NOTE_MAX} value={form.note} disabled={saving}
              onChange={(e) => setForm({ ...form, note: e.target.value })} />
          )}
        </Field>
        {error && <Alert tone="danger" title="Det gick inte">{error}</Alert>}
        <Button type="submit" loading={saving} className="w-full">Spara</Button>
      </form>
    </Sheet>
  );
}

/* ── Ark: avsluta / lärdom ──────────────────────────────── */

export function LearningSheet({ mode, initial, onClose, onSave }: {
  mode: "end" | "edit";
  initial: string;
  onClose: () => void;
  onSave: (learning: string) => Promise<StoreResult<Campaign>>;
}) {
  const [text, setText] = useState(initial);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  async function save() {
    if (saving) return;
    setError("");
    setSaving(true);
    const res = await onSave(text);
    setSaving(false);
    if (!res.ok) { setError(res.error); return; }
    onClose();
  }

  return (
    <Sheet title={mode === "end" ? "Avsluta kampanjen" : "Lärdom"} onClose={onClose} busy={saving}>
      <form noValidate className="flex flex-col gap-4" onSubmit={(e) => { e.preventDefault(); void save(); }}>
        {mode === "end" && (
          <p className="text-sm text-text-secondary">
            Kampanjen markeras som avslutad. Resultat kan du fortfarande lägga in eller ändra efteråt.
          </p>
        )}
        <Field label="Vad tar du med dig till nästa gång?" optional>
          {(p) => (
            <Textarea {...p} data-autofocus rows={4} maxLength={NOTE_MAX} value={text} disabled={saving}
              placeholder="Till exempel vilka bilder eller vilket budskap som fungerade."
              onChange={(e) => setText(e.target.value)} />
          )}
        </Field>
        {error && <Alert tone="danger" title="Det gick inte">{error}</Alert>}
        <Button type="submit" loading={saving} className="w-full">
          {mode === "end" ? "Avsluta kampanjen" : "Spara lärdom"}
        </Button>
      </form>
    </Sheet>
  );
}

/* ── Ark: Kör igen ──────────────────────────────────────── */

export function RerunSheet({ campaign, today, onClose, onCreate }: {
  campaign: Campaign;
  today: string;
  onClose: () => void;
  onCreate: (f: CampaignForm) => Promise<StoreResult<string>>;
}) {
  const [form, setForm] = useState<CampaignForm>({ title: campaign.title, startsOn: "", endsOn: "" });
  const { errors, error, saving, run } = useCampaignFormSubmit(onCreate);
  const view = readStrategy(campaign.strategy);

  return (
    <Sheet title="Kör igen" onClose={onClose} busy={saving}>
      <form noValidate className="flex flex-col gap-5" onSubmit={async (e) => { e.preventDefault(); await run(form); }}>
        <div>
          <CampaignFormFields form={form} setForm={setForm} errors={errors} disabled={saving} />
          <p className="mt-1.5 text-xs text-text-tertiary">
            Förra gången: {formatPeriod(campaign.starts_on, campaign.ends_on, today)}.
          </p>
        </div>

        <div className="flex gap-2.5">
          <IconCheck size={16} className="mt-0.5 shrink-0 text-primary" />
          <div>
            <p className="text-sm font-medium">Strategin återanvänds</p>
            <p className="mt-0.5 text-[13px] text-text-secondary">
              {view.direction ?? (view.title || "Samma strategi som förra gången.")}
            </p>
          </div>
        </div>

        <Card padding="sm" className="bg-surface-sunken">
          <SectionLabel>Från förra gången</SectionLabel>
          <ResultsLine r={campaign} className="mt-2 text-[13px]" />
          {campaign.learning && (
            <p className="mt-1.5 text-[13px] leading-relaxed text-text-secondary">
              <span className="font-medium text-text-primary">Lärdom:</span> {campaign.learning}
            </p>
          )}
          {!campaign.learning && !(campaign.spend_amount !== null || campaign.result_count !== null || campaign.revenue_amount !== null) && (
            <p className="mt-2 text-[13px] text-text-secondary">Inga resultat eller lärdom inlagda.</p>
          )}
          <p className="mt-2.5 text-xs text-text-tertiary">
            Visas som referens. Den nya kampanjens resultat börjar tomma.
          </p>
        </Card>

        {error && <Alert tone="danger" title="Det gick inte">{error}</Alert>}
        <Button type="submit" loading={saving} className="w-full">Skapa planerad kampanj</Button>
      </form>
    </Sheet>
  );
}

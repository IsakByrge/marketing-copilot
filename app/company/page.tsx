"use client";

// ─────────────────────────────────────────────────────────────
// Vad jag vet om företaget — Company Brain, i variant B.
//
// Ett levande företagsminne, inte ett engångsformulär. Datamodell och
// regler ligger i app/_shared/companyBrain.ts, läsning och skrivning i
// useCompanyBrain (RLS-skyddad).
//
// Innehållet här styr varje rekommendation och varje text produkten
// skriver. Därför är det viktigaste i gränssnittet inte att det ser bra
// ut, utan att det är tydligt vad som saknas och varför det spelar roll.
// ─────────────────────────────────────────────────────────────
import { useState, type ReactNode } from "react";
import AppShell from "@/app/_shared/AppShell";
import {
  Button, ButtonLink, Card, Input, Textarea, Chip, Alert, EmptyState, Skeleton,
} from "@/app/_shared/primitives";
import { useCompanyBrain, type SaveStatus } from "@/app/_shared/useCompanyBrain";
import {
  computeCompleteness, topKnowledgeGaps, newManualProduct, newBrainId,
  type CompanyBrain, type CompanyProduct, type CompanyCompetitor, type KnowledgeGap,
  type ProfitabilityLevel, type BusinessPriority,
} from "@/app/_shared/companyBrain";

const PROFITABILITY_LABEL: Record<ProfitabilityLevel, string> = {
  unknown: "Vet inte", low: "Låg", normal: "Normal", high: "Hög",
};
const PRIORITY_LABEL: Record<BusinessPriority, string> = {
  low: "Låg", normal: "Normal", high: "Hög",
};

function Labeled({ label, hint, optional, children }: {
  label: string; hint?: string; optional?: boolean; children: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <p className="text-sm font-medium">
        {label}
        {optional && <span className="ml-1 font-normal text-text-tertiary">— valfritt</span>}
      </p>
      {hint && <p className="text-xs leading-relaxed text-text-tertiary">{hint}</p>}
      {children}
    </div>
  );
}

function SaveStatusText({ status }: { status: SaveStatus }) {
  if (status === "idle") return null;
  const map = {
    saving: { text: "Sparar…", cls: "text-text-tertiary" },
    saved: { text: "Sparat", cls: "text-success" },
    error: { text: "Kunde inte spara", cls: "text-danger" },
  }[status];
  return <span className={`text-xs ${map.cls}`}>{map.text}</span>;
}

function SourceBadge({ source, confidence }: {
  source: CompanyProduct["source"]; confidence: CompanyProduct["confidence"];
}) {
  if (source === "user_confirmed") return <Chip tone="success">Bekräftat</Chip>;
  const label = source === "website_extracted" ? "Från hemsidan"
    : source === "campaign_learned" ? "Från en kampanj" : "Föreslaget";
  const cert = confidence === "high" ? "högt" : confidence === "medium" ? "medel" : "lågt";
  return <Chip tone="warning">{label} · {cert} säkerhet</Chip>;
}

function TagList({ items, onChange, placeholder }: {
  items: string[]; onChange: (next: string[]) => void; placeholder: string;
}) {
  const [draft, setDraft] = useState("");
  function add() {
    const v = draft.trim();
    if (!v) return;
    onChange([...items, v]);
    setDraft("");
  }
  return (
    <div>
      {items.length > 0 && (
        <div className="mb-3 flex flex-wrap gap-2">
          {items.map((item, i) => (
            <span
              key={i}
              className="inline-flex items-center gap-2 rounded-full border border-border bg-surface-sunken py-1 pl-3 pr-1.5 text-sm text-text-secondary"
            >
              {item}
              <button
                type="button"
                aria-label={`Ta bort ${item}`}
                onClick={() => onChange(items.filter((_, idx) => idx !== i))}
                className="flex h-6 w-6 items-center justify-center rounded-full text-text-tertiary hover:bg-surface hover:text-text-primary"
              >
                ×
              </button>
            </span>
          ))}
        </div>
      )}
      <div className="flex gap-2">
        <Input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder={placeholder}
          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); add(); } }}
        />
        <Button variant="secondary" onClick={add}>Lägg till</Button>
      </div>
    </div>
  );
}

function Section({ title, status, children, defaultOpen }: {
  title: string; status: string; children: ReactNode; defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(!!defaultOpen);
  return (
    <Card padding="none">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="flex w-full items-center justify-between gap-3 px-5 py-4 text-left"
      >
        <span>
          <span className="block font-medium">{title}</span>
          <span className="mt-0.5 block text-sm text-text-secondary">{status}</span>
        </span>
        <span aria-hidden className="shrink-0 text-text-tertiary">{open ? "−" : "+"}</span>
      </button>
      {open && <div className="border-t border-border px-5 py-5">{children}</div>}
    </Card>
  );
}

function LevelPicker<T extends string>({ value, options, labels, onChange }: {
  value: T; options: readonly T[]; labels: Record<T, string>; onChange: (v: T) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((opt) => (
        <Button
          key={opt}
          size="sm"
          variant={value === opt ? "primary" : "secondary"}
          onClick={() => onChange(opt)}
        >
          {labels[opt]}
        </Button>
      ))}
    </div>
  );
}

function KnowledgeGaps({ gaps, onAnswer }: {
  gaps: KnowledgeGap[]; onAnswer: (gap: KnowledgeGap, value: string) => void;
}) {
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  if (gaps.length === 0) return null;

  return (
    <Card>
      <p className="text-xs font-semibold uppercase tracking-[0.12em] text-text-tertiary">
        Tre saker som gör din marknadschef bättre
      </p>
      <div className="mt-4 space-y-5">
        {gaps.map((gap) => (
          <div key={gap.id} className="border-b border-border pb-5 last:border-0 last:pb-0">
            <p className="mb-2.5 text-sm">{gap.question}</p>
            {gap.kind === "product_profitability" ? (
              <LevelPicker
                value={"unknown" as ProfitabilityLevel}
                options={["low", "normal", "high", "unknown"] as const}
                labels={PROFITABILITY_LABEL}
                onChange={(v) => onAnswer(gap, v)}
              />
            ) : (
              <div className="flex flex-wrap gap-2">
                <Input
                  className="max-w-sm"
                  value={drafts[gap.id] ?? ""}
                  onChange={(e) => setDrafts((d) => ({ ...d, [gap.id]: e.target.value }))}
                  placeholder="Skriv ett kort svar…"
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && drafts[gap.id]?.trim()) {
                      e.preventDefault();
                      onAnswer(gap, drafts[gap.id].trim());
                    }
                  }}
                />
                <Button
                  variant="secondary"
                  onClick={() => drafts[gap.id]?.trim() && onAnswer(gap, drafts[gap.id].trim())}
                >
                  Spara
                </Button>
              </div>
            )}
          </div>
        ))}
      </div>
    </Card>
  );
}

function ProductForm({ product, onSave, onCancel }: {
  product: CompanyProduct; onSave: (p: CompanyProduct) => void; onCancel: () => void;
}) {
  const [draft, setDraft] = useState<CompanyProduct>(product);
  const set = <K extends keyof CompanyProduct>(k: K, v: CompanyProduct[K]) =>
    setDraft((d) => ({ ...d, [k]: v }));

  return (
    <div className="space-y-4 rounded-lg border border-border bg-surface-sunken p-5">
      <p className="text-xs leading-relaxed text-text-secondary">
        Artikelnumret är det som kopplar produkten till webbshoppens export. Utan det kan
        produkttexterna inte hämta verifierade fakta om just den här produkten.
      </p>

      <Labeled label="Namn">
        <Input value={draft.name} onChange={(e) => set("name", e.target.value)} placeholder="t.ex. Gasol i lösvikt" />
      </Labeled>
      <Labeled label="Artikelnummer" hint="Samma som i webbshoppens artikelexport." optional>
        <Input value={draft.articleNumber ?? ""} onChange={(e) => set("articleNumber", e.target.value)} placeholder="t.ex. 1001" />
      </Labeled>
      <Labeled label="Kategori" optional>
        <Input value={draft.category ?? ""} onChange={(e) => set("category", e.target.value)} placeholder="t.ex. Gasolflaskor" />
      </Labeled>
      <Labeled label="Beskrivning" optional>
        <Textarea rows={2} value={draft.description ?? ""} onChange={(e) => set("description", e.target.value)} />
      </Labeled>
      <Labeled label="Vilket kundproblem löser den?" optional>
        <Textarea rows={2} value={draft.customerProblem ?? ""} onChange={(e) => set("customerProblem", e.target.value)} />
      </Labeled>
      <Labeled label="Primär målgrupp" optional>
        <Input value={draft.primaryAudience ?? ""} onChange={(e) => set("primaryAudience", e.target.value)} placeholder="t.ex. Husbilsägare" />
      </Labeled>

      <Labeled label="Lönsamhetsnivå">
        <LevelPicker
          value={draft.profitability}
          options={["unknown", "low", "normal", "high"] as const}
          labels={PROFITABILITY_LABEL}
          onChange={(v) => set("profitability", v)}
        />
      </Labeled>
      <Labeled label="Prioritet">
        <LevelPicker
          value={draft.priority}
          options={["low", "normal", "high"] as const}
          labels={PRIORITY_LABEL}
          onChange={(v) => set("priority", v)}
        />
      </Labeled>

      <Labeled label="Säsong" optional>
        <Input value={draft.seasonality ?? ""} onChange={(e) => set("seasonality", e.target.value)} placeholder="t.ex. Vår och sommar" />
      </Labeled>
      <Labeled label="Tillgänglighetsnotering" optional>
        <Input value={draft.availabilityNotes ?? ""} onChange={(e) => set("availabilityNotes", e.target.value)} placeholder="t.ex. Alltid i lager" />
      </Labeled>
      <Labeled label="Vad skiljer den från alternativ?" optional>
        <TagList items={draft.differentiators} onChange={(v) => set("differentiators", v)} placeholder="Lägg till…" />
      </Labeled>
      <Labeled
        label="Vanliga kundinvändningar"
        hint="Skälen till att någon tvekar — inte beröm. Varje invändning blir en mening texterna kan besvara."
        optional
      >
        <TagList items={draft.commonObjections} onChange={(v) => set("commonObjections", v)} placeholder="t.ex. Känns krångligare än att byta" />
      </Labeled>

      <div className="flex gap-2">
        <Button onClick={() => onSave({
          ...draft, source: "user_confirmed", confidence: "high",
          confirmedAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
        })}>
          Spara produkt
        </Button>
        <Button variant="ghost" onClick={onCancel}>Avbryt</Button>
      </div>
    </div>
  );
}

function ProductRow({ product, onEdit, onDelete, onConfirm, onReject }: {
  product: CompanyProduct;
  onEdit: () => void; onDelete: () => void; onConfirm: () => void; onReject: () => void;
}) {
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const isSuggestion = product.source !== "user_confirmed";

  return (
    <div className="rounded-lg border border-border bg-surface-sunken p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-medium">{product.name}</span>
            {product.articleNumber && (
              <span className="text-xs text-text-tertiary">{product.articleNumber}</span>
            )}
            {product.category && (
              <span className="text-xs text-text-tertiary">{product.category}</span>
            )}
          </div>
          <div className="mt-1.5 flex flex-wrap items-center gap-2 text-xs text-text-tertiary">
            <SourceBadge source={product.source} confidence={product.confidence} />
            <span>Prioritet: {PRIORITY_LABEL[product.priority]}</span>
            <span>Lönsamhet: {PROFITABILITY_LABEL[product.profitability]}</span>
            {product.seasonality && <span>Säsong: {product.seasonality}</span>}
          </div>
          {isSuggestion && product.description && (
            <p className="mt-2.5 max-w-lg text-sm leading-relaxed text-text-secondary">
              Jag hittade detta: <em>{product.name} — {product.description}</em>
            </p>
          )}
        </div>

        <div className="flex shrink-0 flex-wrap gap-2">
          {isSuggestion ? (
            <>
              <Button size="sm" variant="secondary" onClick={onConfirm}>Bekräfta</Button>
              <Button size="sm" variant="ghost" onClick={onEdit}>Redigera</Button>
              <Button size="sm" variant="ghost" onClick={onReject}>Avvisa</Button>
            </>
          ) : confirmingDelete ? (
            <>
              <span className="self-center text-sm text-text-secondary">Ta bort {product.name}?</span>
              <Button size="sm" variant="secondary" onClick={() => { onDelete(); setConfirmingDelete(false); }}>
                Ja, ta bort
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setConfirmingDelete(false)}>Avbryt</Button>
            </>
          ) : (
            <>
              <Button size="sm" variant="ghost" onClick={onEdit}>Redigera</Button>
              <Button size="sm" variant="ghost" onClick={() => setConfirmingDelete(true)}>Ta bort</Button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function CompetitorForm({ competitor, onSave, onCancel }: {
  competitor: CompanyCompetitor; onSave: (c: CompanyCompetitor) => void; onCancel: () => void;
}) {
  const [draft, setDraft] = useState(competitor);
  return (
    <div className="space-y-4 rounded-lg border border-border bg-surface-sunken p-5">
      <Labeled label="Namn">
        <Input value={draft.name} onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))} />
      </Labeled>
      <Labeled label="Hemsida" optional>
        <Input value={draft.website ?? ""} onChange={(e) => setDraft((d) => ({ ...d, website: e.target.value }))} />
      </Labeled>
      <Labeled label="Anteckningar" optional>
        <Textarea rows={2} value={draft.notes ?? ""} onChange={(e) => setDraft((d) => ({ ...d, notes: e.target.value }))} />
      </Labeled>
      <div className="flex gap-2">
        <Button onClick={() => onSave({ ...draft, source: "user_confirmed", confidence: "high" })}>Spara</Button>
        <Button variant="ghost" onClick={onCancel}>Avbryt</Button>
      </div>
    </div>
  );
}

export default function CompanyPage() {
  const { brain, setBrain, save, saveStatus, loaded, hasCompany, companyName } = useCompanyBrain();
  const [editingProductId, setEditingProductId] = useState<string | "new" | null>(null);
  const [editingCompetitorId, setEditingCompetitorId] = useState<string | "new" | null>(null);

  function persist(next: CompanyBrain) {
    setBrain(next);
    save(next);
  }

  function answerGap(gap: KnowledgeGap, value: string) {
    const next: CompanyBrain = structuredClone(brain);
    if (gap.kind === "summary") next.companySummary = value;
    else if (gap.kind === "audience") next.primaryCustomers = [...next.primaryCustomers, value];
    else if (gap.kind === "tone") next.tone = [...next.tone, value];
    else if (gap.kind === "strengths") next.strengths = [...next.strengths, value];
    else if (gap.kind === "competitors") next.competitors = [...next.competitors, { id: newBrainId(), name: value, source: "user_confirmed", confidence: "high" }];
    else if (gap.kind === "seasons") next.keySeasons = [...next.keySeasons, value];
    else if (gap.kind === "objections") next.commonCustomerObjections = [...next.commonCustomerObjections, value];
    else if (gap.kind === "product_profitability") {
      next.products = next.products.map((p) => p.id === gap.productId ? { ...p, profitability: value as ProfitabilityLevel, updatedAt: new Date().toISOString() } : p);
    } else if (gap.kind === "product_audience") {
      next.products = next.products.map((p) => p.id === gap.productId ? { ...p, primaryAudience: value, updatedAt: new Date().toISOString() } : p);
    } else if (gap.kind === "product_objections") {
      next.products = next.products.map((p) => p.id === gap.productId ? { ...p, commonObjections: [...p.commonObjections, value], updatedAt: new Date().toISOString() } : p);
    }
    persist(next);
  }

  function saveProduct(p: CompanyProduct) {
    const exists = brain.products.some((x) => x.id === p.id);
    persist({ ...brain, products: exists ? brain.products.map((x) => x.id === p.id ? p : x) : [...brain.products, p] });
    setEditingProductId(null);
  }

  function saveCompetitor(c: CompanyCompetitor) {
    const exists = brain.competitors.some((x) => x.id === c.id);
    persist({ ...brain, competitors: exists ? brain.competitors.map((x) => x.id === c.id ? c : x) : [...brain.competitors, c] });
    setEditingCompetitorId(null);
  }

  const completeness = computeCompleteness(brain);
  const gaps = topKnowledgeGaps(brain, 3);
  const highPriority = brain.products.filter((p) => p.priority === "high");
  const levelLabel = { basic: "Grundläggande", useful: "Användbar", strong: "Stark" }[completeness.level];

  return (
    <AppShell>
      <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6 lg:px-10 lg:py-12">
        {!loaded && (
          <div className="space-y-4">
            <Skeleton shape="line" className="w-64" />
            <Skeleton shape="block" className="h-64" />
          </div>
        )}

        {loaded && !hasCompany && (
          <EmptyState
            title="Ingen företagsprofil ännu"
            body="Skapa en profil så kan jag ge rekommendationer baserade på riktig kunskap om företaget i stället för antaganden."
            action={<ButtonLink href="/onboarding">Starta onboarding</ButtonLink>}
          />
        )}

        {loaded && hasCompany && (
          <div className="space-y-4">
            <header className="mb-5">
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-text-tertiary">
                Företagskunskap · {levelLabel}
              </p>
              <div className="mt-3 flex flex-wrap items-baseline justify-between gap-3">
                <h1 className="max-w-2xl text-[clamp(1.5rem,3.2vw,1.85rem)] font-semibold leading-[1.25] tracking-tight">
                  Vad jag vet om {companyName}
                </h1>
                <SaveStatusText status={saveStatus} />
              </div>
              <p className="mt-3 max-w-xl text-[15px] leading-relaxed text-text-secondary">
                Det här är grunden för varje rekommendation och varje text jag skriver. Ju
                konkretare svar, desto mindre generiskt innehåll. Fyll på när du har tid —
                inget behöver bli klart på en gång.
              </p>
            </header>

            {saveStatus === "error" && (
              <Alert tone="danger" title="Kunde inte spara">
                Kontrollera anslutningen och försök igen.
              </Alert>
            )}

            <KnowledgeGaps gaps={gaps} onAnswer={answerGap} />

            <Section
              title="Översikt"
              status={brain.companySummary ? "Sammanfattning finns" : "Ingen sammanfattning ännu"}
              defaultOpen
            >
              <div className="space-y-4">
                <Labeled
                  label="Företagssammanfattning"
                  hint="Skriv konkret. Vad säljer ni, till vem, och vad gör ni som andra inte gör? Allmänna formuleringar här ger allmänt innehåll överallt."
                  optional
                >
                  <Textarea rows={4} value={brain.companySummary} onChange={(e) => setBrain({ ...brain, companySummary: e.target.value })} />
                </Labeled>
                <Labeled label="Marknadsföringsmål" optional>
                  <TagList items={brain.marketingGoals} onChange={(v) => setBrain({ ...brain, marketingGoals: v })} placeholder="t.ex. Fler besökare till depåerna" />
                </Labeled>
                <Button onClick={() => save(brain)}>Spara översikt</Button>
              </div>
            </Section>

            <Section
              title="Produkter och tjänster"
              status={`${brain.products.length} st${brain.products.some((p) => p.source !== "user_confirmed") ? " · några föreslagna" : ""}`}
              defaultOpen
            >
              <div className="space-y-3">
                {brain.products.length === 0 && editingProductId !== "new" && (
                  <p className="text-sm text-text-secondary">Inga produkter tillagda ännu.</p>
                )}
                {brain.products.map((p) => (
                  editingProductId === p.id ? (
                    <ProductForm key={p.id} product={p} onSave={saveProduct} onCancel={() => setEditingProductId(null)} />
                  ) : (
                    <ProductRow
                      key={p.id}
                      product={p}
                      onEdit={() => setEditingProductId(p.id)}
                      onDelete={() => persist({ ...brain, products: brain.products.filter((x) => x.id !== p.id) })}
                      onConfirm={() => persist({ ...brain, products: brain.products.map((x) => x.id === p.id ? { ...x, source: "user_confirmed", confidence: "high", confirmedAt: new Date().toISOString() } : x) })}
                      onReject={() => persist({ ...brain, products: brain.products.filter((x) => x.id !== p.id) })}
                    />
                  )
                ))}
                {editingProductId === "new" ? (
                  <ProductForm product={newManualProduct("")} onSave={saveProduct} onCancel={() => setEditingProductId(null)} />
                ) : (
                  <Button variant="secondary" onClick={() => setEditingProductId("new")}>Lägg till produkt</Button>
                )}
              </div>
            </Section>

            <Section title="Målgrupper" status={brain.primaryCustomers.length ? `${brain.primaryCustomers.length} st` : "Ingen målgrupp ännu"}>
              <div className="space-y-4">
                <TagList items={brain.primaryCustomers} onChange={(v) => setBrain({ ...brain, primaryCustomers: v })} placeholder="t.ex. Husbilsägare 45–70 år" />
                <Button onClick={() => save(brain)}>Spara målgrupper</Button>
              </div>
            </Section>

            <Section title="Styrkor och USP" status={(brain.strengths.length + brain.uniqueSellingPoints.length) ? "Ifyllt" : "Inget ifyllt ännu"}>
              <div className="space-y-4">
                <Labeled label="Styrkor" hint="Undvik sådant varje företag säger. Konkurrenskraftiga priser säger ingenting.">
                  <TagList items={brain.strengths} onChange={(v) => setBrain({ ...brain, strengths: v })} placeholder="t.ex. Egen fyllningsanläggning" />
                </Labeled>
                <Labeled label="Unika säljargument" optional>
                  <TagList items={brain.uniqueSellingPoints} onChange={(v) => setBrain({ ...brain, uniqueSellingPoints: v })} placeholder="t.ex. Fyller din flaska medan du väntar" />
                </Labeled>
                <Button onClick={() => save(brain)}>Spara styrkor</Button>
              </div>
            </Section>

            <Section title="Kundinvändningar" status={brain.commonCustomerObjections.length ? `${brain.commonCustomerObjections.length} st` : "Inga angivna ännu"}>
              <div className="space-y-4">
                <p className="text-sm leading-relaxed text-text-secondary">
                  Skälen till att någon tvekar att köpa — inte beröm. Varje invändning blir en
                  mening som innehållet kan besvara, och det är det mest värdefulla underlaget
                  som finns för både produkttexter och inlägg.
                </p>
                <TagList items={brain.commonCustomerObjections} onChange={(v) => setBrain({ ...brain, commonCustomerObjections: v })} placeholder="t.ex. Gasol känns farligt att hantera" />
                <Button onClick={() => save(brain)}>Spara invändningar</Button>
              </div>
            </Section>

            <Section title="Konkurrenter" status={brain.competitors.length ? `${brain.competitors.length} st` : "Inga angivna ännu"}>
              <div className="space-y-3">
                {brain.competitors.map((c) => (
                  editingCompetitorId === c.id ? (
                    <CompetitorForm key={c.id} competitor={c} onSave={saveCompetitor} onCancel={() => setEditingCompetitorId(null)} />
                  ) : (
                    <div key={c.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-surface-sunken p-4">
                      <div>
                        <p className="font-medium">{c.name}</p>
                        {c.website && <p className="text-xs text-text-tertiary">{c.website}</p>}
                      </div>
                      <div className="flex gap-2">
                        <Button size="sm" variant="ghost" onClick={() => setEditingCompetitorId(c.id)}>Redigera</Button>
                        <Button size="sm" variant="ghost" onClick={() => persist({ ...brain, competitors: brain.competitors.filter((x) => x.id !== c.id) })}>Ta bort</Button>
                      </div>
                    </div>
                  )
                ))}
                {editingCompetitorId === "new" ? (
                  <CompetitorForm
                    competitor={{ id: newBrainId(), name: "", source: "user_confirmed", confidence: "high" }}
                    onSave={saveCompetitor}
                    onCancel={() => setEditingCompetitorId(null)}
                  />
                ) : (
                  <Button variant="secondary" onClick={() => setEditingCompetitorId("new")}>Lägg till konkurrent</Button>
                )}
              </div>
            </Section>

            <Section title="Ton och innehållsregler" status={brain.tone.length ? "Ifyllt" : "Inget ifyllt ännu"}>
              <div className="space-y-4">
                <Labeled label="Tonläge">
                  <TagList items={brain.tone} onChange={(v) => setBrain({ ...brain, tone: v })} placeholder="t.ex. Personlig, rak" />
                </Labeled>
                <Labeled label="Innehållsregler" optional>
                  <TagList items={brain.contentGuidelines} onChange={(v) => setBrain({ ...brain, contentGuidelines: v })} placeholder="t.ex. Använd alltid du-tilltal" />
                </Labeled>
                <Labeled label="Sådant ni aldrig vill uttrycka" optional>
                  <TagList items={brain.forbiddenClaims} onChange={(v) => setBrain({ ...brain, forbiddenClaims: v })} placeholder="t.ex. Lova aldrig snabbast i stan" />
                </Labeled>
                <Labeled label="Föredragna call-to-actions" optional>
                  <TagList items={brain.preferredCallsToAction} onChange={(v) => setBrain({ ...brain, preferredCallsToAction: v })} placeholder="t.ex. Kom förbi depån" />
                </Labeled>
                <Button onClick={() => save(brain)}>Spara ton och regler</Button>
              </div>
            </Section>

            <Section title="Säsonger och prioriteringar" status={brain.keySeasons.length ? `${brain.keySeasons.length} säsonger` : "Inga säsonger ännu"}>
              <div className="space-y-4">
                <Labeled label="Viktiga säsonger">
                  <TagList items={brain.keySeasons} onChange={(v) => setBrain({ ...brain, keySeasons: v })} placeholder="t.ex. Grillsäsong, Black Friday" />
                </Labeled>
                <Labeled label="Prioriterade produkter just nu">
                  {highPriority.length === 0 ? (
                    <p className="text-sm text-text-secondary">
                      Ingen produkt är markerad som hög prioritet ännu — sätt det under Produkter och tjänster.
                    </p>
                  ) : (
                    <div className="flex flex-wrap gap-2">
                      {highPriority.map((p) => <Chip key={p.id} tone="primary">{p.name}</Chip>)}
                    </div>
                  )}
                </Labeled>
                <Button onClick={() => save(brain)}>Spara säsonger</Button>
              </div>
            </Section>
          </div>
        )}
      </div>
    </AppShell>
  );
}

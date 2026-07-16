"use client";

// ─────────────────────────────────────────────────────────────
// Företagskunskap — Company Brain 1.1. Ett levande, redigerbart
// företagsminne i stället för ett engångsformulär. Bygger på
// app/_shared/companyBrain.ts (datamodell + migrering + regler)
// och useCompanyBrain (Supabase-läsning/skrivning, RLS-skyddad).
// ─────────────────────────────────────────────────────────────
import { useState } from "react";
import Shell from "@/app/_shared/Shell";
import { T, fontSerif, fontSans, transition } from "@/app/_shared/theme";
import { PageHeader, Eyebrow, PrimaryButton, GhostButton, Field, TextInput, TextArea, EmptyState, ErrorNote } from "@/app/_shared/ui";
import {
  IconCompany, IconPlus, IconTrash, IconPencil, IconCheck, IconX, IconCampaigns,
} from "@/app/_shared/icons";
import { useCompanyBrain, type SaveStatus } from "@/app/_shared/useCompanyBrain";
import {
  computeCompleteness, topKnowledgeGaps, newManualProduct, newBrainId,
  type CompanyBrain, type CompanyProduct, type CompanyCompetitor, type KnowledgeGap,
  type ProfitabilityLevel, type BusinessPriority,
} from "@/app/_shared/companyBrain";

/* ── Små, sidspecifika presentationsdelar ───────────────────── */

function SaveStatusText({ status }: { status: SaveStatus }) {
  if (status === "idle") return null;
  const map: Record<Exclude<SaveStatus, "idle">, { text: string; color: string }> = {
    saving: { text: "Sparar…", color: T.text3 },
    saved: { text: "✓ Sparat", color: T.green },
    error: { text: "Kunde inte spara", color: T.red },
  };
  const s = map[status as Exclude<SaveStatus, "idle">];
  return <span style={{ fontFamily: fontSans, fontSize: "0.76rem", fontWeight: 400, color: s.color }}>{s.text}</span>;
}

function CompletenessBadge({ level }: { level: "basic" | "useful" | "strong" }) {
  const copy = {
    basic: { label: "Grundläggande", color: T.text3, bg: T.surface2 },
    useful: { label: "Användbar", color: T.blue, bg: T.blueDim },
    strong: { label: "Stark", color: T.purpleBright, bg: T.purpleDim },
  }[level];
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 6, padding: "5px 12px", borderRadius: 999,
      background: copy.bg, fontFamily: fontSans, fontSize: "0.72rem", fontWeight: 500, color: copy.color,
    }}>
      <span style={{ width: 6, height: 6, borderRadius: "50%", background: copy.color, display: "block" }} />
      {copy.label} företagskunskap
    </span>
  );
}

function SourceBadge({ source, confidence }: { source: CompanyProduct["source"]; confidence: CompanyProduct["confidence"] }) {
  if (source === "user_confirmed") {
    return <span style={{ fontFamily: fontSans, fontSize: "0.66rem", fontWeight: 500, color: T.green, letterSpacing: "0.04em" }}>✓ Bekräftat</span>;
  }
  const label = source === "website_extracted" ? "Från hemsidan" : source === "campaign_learned" ? "Från en kampanj" : "Föreslaget";
  return (
    <span style={{ fontFamily: fontSans, fontSize: "0.66rem", fontWeight: 500, color: T.orange, letterSpacing: "0.04em" }}>
      ✦ {label} · {confidence === "high" ? "högt" : confidence === "medium" ? "medel" : "lågt"} säkerhet
    </span>
  );
}

/** Generisk taggnings-editor för string[]-fält (målgrupper, styrkor, tonläge …). */
function TagList({ items, onChange, placeholder }: { items: string[]; onChange: (next: string[]) => void; placeholder: string }) {
  const [draft, setDraft] = useState("");
  function add() {
    const v = draft.trim();
    if (!v) return;
    onChange([...items, v]);
    setDraft("");
  }
  return (
    <div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: items.length ? 12 : 0 }}>
        {items.map((item, i) => (
          <span key={i} style={{
            display: "inline-flex", alignItems: "center", gap: 8, padding: "6px 8px 6px 12px", borderRadius: 999,
            background: T.surface2, border: `1px solid ${T.line2}`, fontFamily: fontSans, fontSize: "0.8rem", color: T.text2,
          }}>
            {item}
            <button type="button" aria-label={`Ta bort ${item}`} onClick={() => onChange(items.filter((_, idx) => idx !== i))}
              className="mcx-focusable"
              style={{ background: "none", border: "none", cursor: "pointer", color: T.text3, display: "flex", padding: 2 }}
            >
              <IconX size={11} />
            </button>
          </span>
        ))}
      </div>
      <div style={{ display: "flex", gap: 8 }}>
        <TextInput
          value={draft} onChange={(e) => setDraft(e.target.value)} placeholder={placeholder}
          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); add(); } }}
        />
        <GhostButton onClick={add}>Lägg till</GhostButton>
      </div>
    </div>
  );
}

/** Kollapsbar sektion med rubrik, kort status och redigeringsläge. */
function SectionCard({ title, status, children, defaultOpen }: {
  title: string; status: string; children: React.ReactNode; defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(!!defaultOpen);
  return (
    <div style={{ background: T.surface, border: `1px solid ${T.line}`, borderRadius: 16, overflow: "hidden" }}>
      <button
        type="button" onClick={() => setOpen((o) => !o)} className="mcx-focusable"
        style={{
          width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "18px 22px", background: "none", border: "none", cursor: "pointer", textAlign: "left",
        }}
      >
        <div>
          <div style={{ fontFamily: fontSerif, fontWeight: 400, fontSize: "1.15rem", color: T.text, marginBottom: 4 }}>{title}</div>
          <div style={{ fontFamily: fontSans, fontSize: "0.78rem", fontWeight: 300, color: T.text3 }}>{status}</div>
        </div>
        <span style={{ color: T.text3, transform: open ? "rotate(180deg)" : "none", transition, flexShrink: 0 }}>▾</span>
      </button>
      {open && <div style={{ padding: "0 22px 22px" }}>{children}</div>}
    </div>
  );
}

const PROFITABILITY_LABEL: Record<ProfitabilityLevel, string> = { unknown: "Vet inte", low: "Låg", normal: "Normal", high: "Hög" };
const PRIORITY_LABEL: Record<BusinessPriority, string> = { low: "Låg", normal: "Normal", high: "Hög" };

function LevelPicker<T extends string>({ value, options, labels, onChange }: {
  value: T; options: readonly T[]; labels: Record<T, string>; onChange: (v: T) => void;
}) {
  return (
    <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
      {options.map((opt) => {
        const active = value === opt;
        return (
          <button key={opt} type="button" onClick={() => onChange(opt)} className="mcx-focusable" style={{
            padding: "7px 14px", borderRadius: 999, cursor: "pointer", fontFamily: fontSans, fontSize: "0.78rem", fontWeight: 400,
            background: active ? T.purpleDim : "transparent", border: `1px solid ${active ? T.purpleBorder : T.line2}`,
            color: active ? T.purpleBright : T.text2, transition,
          }}>
            {labels[opt]}
          </button>
        );
      })}
    </div>
  );
}

/* ── Kunskapsluckor ("Tre saker som gör din marknadschef bättre") ── */
function KnowledgeGapsPanel({ gaps, onAnswer }: { gaps: KnowledgeGap[]; onAnswer: (gap: KnowledgeGap, value: string) => void }) {
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  if (gaps.length === 0) return null;

  const isProfitabilityGap = (g: KnowledgeGap) => g.kind === "product_profitability";

  return (
    <div style={{ background: T.surface, border: `1px solid ${T.purpleBorder}`, borderRadius: 16, padding: "24px 26px" }}>
      <Eyebrow>Tre saker som gör din marknadschef bättre</Eyebrow>
      <div style={{ marginTop: 16, display: "flex", flexDirection: "column", gap: 16 }}>
        {gaps.map((gap) => (
          <div key={gap.id} style={{ paddingBottom: 16, borderBottom: `1px solid ${T.line}` }}>
            <p style={{ fontFamily: fontSans, fontSize: "0.9rem", fontWeight: 400, color: T.text, marginBottom: 10 }}>{gap.question}</p>
            {isProfitabilityGap(gap) ? (
              <LevelPicker
                value="unknown" options={["low", "normal", "high", "unknown"] as const}
                labels={{ low: "Låg", normal: "Normal", high: "Hög", unknown: "Vet inte" }}
                onChange={(v) => onAnswer(gap, v)}
              />
            ) : (
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <TextInput
                  value={drafts[gap.id] ?? ""} onChange={(e) => setDrafts((d) => ({ ...d, [gap.id]: e.target.value }))}
                  placeholder="Skriv ett kort svar…" style={{ maxWidth: 360 }}
                  onKeyDown={(e) => { if (e.key === "Enter" && drafts[gap.id]?.trim()) { e.preventDefault(); onAnswer(gap, drafts[gap.id].trim()); } }}
                />
                <GhostButton onClick={() => drafts[gap.id]?.trim() && onAnswer(gap, drafts[gap.id].trim())}>Spara</GhostButton>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

/* ── Produktformulär (lägg till / redigera) ─────────────────── */
function ProductForm({ product, onSave, onCancel }: {
  product: CompanyProduct; onSave: (p: CompanyProduct) => void; onCancel: () => void;
}) {
  const [draft, setDraft] = useState<CompanyProduct>(product);
  const setField = <K extends keyof CompanyProduct>(k: K, v: CompanyProduct[K]) => setDraft((d) => ({ ...d, [k]: v }));

  return (
    <div style={{ padding: "18px 20px", background: T.surface2, borderRadius: 12, border: `1px solid ${T.line2}`, display: "flex", flexDirection: "column", gap: 16 }}>
      <p style={{ fontFamily: fontSans, fontSize: "0.72rem", fontWeight: 500, letterSpacing: "0.08em", textTransform: "uppercase", color: T.purpleBright }}>
        Lönsamhetsnivån hjälper Copilot att prioritera rätt. Du behöver inte ange exakta ekonomiska siffror.
      </p>

      <Field label="Namn"><TextInput value={draft.name} onChange={(e) => setField("name", e.target.value)} placeholder="t.ex. Greenville 3" /></Field>
      <Field label="Kategori" optional><TextInput value={draft.category ?? ""} onChange={(e) => setField("category", e.target.value)} placeholder="t.ex. Gasolgrillar" /></Field>
      <Field label="Beskrivning" optional><TextArea value={draft.description ?? ""} onChange={(e) => setField("description", e.target.value)} rows={2} placeholder="Kort, konkret beskrivning" /></Field>
      <Field label="Vilket kundproblem löser den?" optional><TextArea value={draft.customerProblem ?? ""} onChange={(e) => setField("customerProblem", e.target.value)} rows={2} /></Field>
      <Field label="Primär målgrupp" optional><TextInput value={draft.primaryAudience ?? ""} onChange={(e) => setField("primaryAudience", e.target.value)} placeholder="t.ex. Villaägare med trädgård" /></Field>

      <div>
        <div style={{ fontFamily: fontSans, fontSize: "0.68rem", fontWeight: 500, letterSpacing: "0.1em", textTransform: "uppercase", color: T.text3, marginBottom: 9 }}>Lönsamhetsnivå</div>
        <LevelPicker value={draft.profitability} options={["unknown", "low", "normal", "high"] as const} labels={PROFITABILITY_LABEL} onChange={(v) => setField("profitability", v)} />
      </div>
      <div>
        <div style={{ fontFamily: fontSans, fontSize: "0.68rem", fontWeight: 500, letterSpacing: "0.1em", textTransform: "uppercase", color: T.text3, marginBottom: 9 }}>Prioritet</div>
        <LevelPicker value={draft.priority} options={["low", "normal", "high"] as const} labels={PRIORITY_LABEL} onChange={(v) => setField("priority", v)} />
      </div>

      <Field label="Säsong" optional><TextInput value={draft.seasonality ?? ""} onChange={(e) => setField("seasonality", e.target.value)} placeholder="t.ex. Vår och sommar" /></Field>
      <Field label="Tillgänglighetsnotering" optional><TextInput value={draft.availabilityNotes ?? ""} onChange={(e) => setField("availabilityNotes", e.target.value)} placeholder="t.ex. Alltid i lager" /></Field>

      <Field label="Vad skiljer den från alternativ?" optional hint="En per rad, tryck Enter för att lägga till en i taget nedan.">
        <TagList items={draft.differentiators} onChange={(v) => setField("differentiators", v)} placeholder="Lägg till en differentiator…" />
      </Field>
      <Field label="Vanliga kundinvändningar" optional>
        <TagList items={draft.commonObjections} onChange={(v) => setField("commonObjections", v)} placeholder="Lägg till en invändning…" />
      </Field>

      <div style={{ display: "flex", gap: 10 }}>
        <PrimaryButton onClick={() => onSave({ ...draft, source: "user_confirmed", confidence: "high", confirmedAt: new Date().toISOString(), updatedAt: new Date().toISOString() })}>
          Spara produkt
        </PrimaryButton>
        <GhostButton onClick={onCancel}>Avbryt</GhostButton>
      </div>
    </div>
  );
}

function ProductRow({ product, onEdit, onDelete, onConfirmSuggestion, onRejectSuggestion }: {
  product: CompanyProduct; onEdit: () => void; onDelete: () => void; onConfirmSuggestion: () => void; onRejectSuggestion: () => void;
}) {
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const isSuggestion = product.source !== "user_confirmed";

  return (
    <div style={{ padding: "16px 18px", background: T.surface2, borderRadius: 12, border: `1px solid ${T.line}` }}>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4, flexWrap: "wrap" }}>
            <span style={{ fontFamily: fontSans, fontSize: "0.95rem", fontWeight: 500, color: T.text }}>{product.name}</span>
            {product.category && <span style={{ fontFamily: fontSans, fontSize: "0.72rem", color: T.text3 }}>{product.category}</span>}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
            <SourceBadge source={product.source} confidence={product.confidence} />
            <span style={{ fontFamily: fontSans, fontSize: "0.72rem", color: T.text3 }}>Prioritet: {PRIORITY_LABEL[product.priority]}</span>
            <span style={{ fontFamily: fontSans, fontSize: "0.72rem", color: T.text3 }}>Lönsamhet: {PROFITABILITY_LABEL[product.profitability]}</span>
            {product.seasonality && <span style={{ fontFamily: fontSans, fontSize: "0.72rem", color: T.text3 }}>Säsong: {product.seasonality}</span>}
          </div>
          {isSuggestion && product.description && (
            <p style={{ marginTop: 10, fontFamily: fontSans, fontSize: "0.82rem", fontWeight: 300, color: T.text2, lineHeight: 1.6, maxWidth: 480 }}>
              Jag hittade detta: <em style={{ fontStyle: "italic" }}>&ldquo;{product.name} — {product.description}&rdquo;</em>
            </p>
          )}
        </div>

        <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
          {isSuggestion ? (
            <>
              <GhostButton onClick={onConfirmSuggestion}><IconCheck size={14} /> Bekräfta</GhostButton>
              <GhostButton onClick={onEdit}><IconPencil size={14} /> Redigera</GhostButton>
              <GhostButton onClick={onRejectSuggestion}><IconX size={14} /> Avvisa</GhostButton>
            </>
          ) : confirmingDelete ? (
            <>
              <span style={{ fontFamily: fontSans, fontSize: "0.78rem", color: T.text2, alignSelf: "center" }}>Ta bort {product.name}?</span>
              <GhostButton onClick={() => { onDelete(); setConfirmingDelete(false); }}>Ja, ta bort</GhostButton>
              <GhostButton onClick={() => setConfirmingDelete(false)}>Avbryt</GhostButton>
            </>
          ) : (
            <>
              <GhostButton onClick={onEdit}><IconPencil size={14} /> Redigera</GhostButton>
              <GhostButton onClick={() => setConfirmingDelete(true)}><IconTrash size={14} /> Ta bort</GhostButton>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

/* ── Konkurrentformulär ──────────────────────────────────────── */
function CompetitorForm({ competitor, onSave, onCancel }: {
  competitor: CompanyCompetitor; onSave: (c: CompanyCompetitor) => void; onCancel: () => void;
}) {
  const [draft, setDraft] = useState(competitor);
  return (
    <div style={{ padding: "18px 20px", background: T.surface2, borderRadius: 12, border: `1px solid ${T.line2}`, display: "flex", flexDirection: "column", gap: 14 }}>
      <Field label="Namn"><TextInput value={draft.name} onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))} /></Field>
      <Field label="Hemsida" optional><TextInput value={draft.website ?? ""} onChange={(e) => setDraft((d) => ({ ...d, website: e.target.value }))} /></Field>
      <Field label="Anteckningar" optional><TextArea rows={2} value={draft.notes ?? ""} onChange={(e) => setDraft((d) => ({ ...d, notes: e.target.value }))} /></Field>
      <div style={{ display: "flex", gap: 10 }}>
        <PrimaryButton onClick={() => onSave({ ...draft, source: "user_confirmed", confidence: "high" })}>Spara</PrimaryButton>
        <GhostButton onClick={onCancel}>Avbryt</GhostButton>
      </div>
    </div>
  );
}

/* ── Root ─────────────────────────────────────────────────────── */
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
    const next: CompanyBrain = { ...brain, products: exists ? brain.products.map((x) => x.id === p.id ? p : x) : [...brain.products, p] };
    persist(next);
    setEditingProductId(null);
  }
  function deleteProduct(id: string) {
    persist({ ...brain, products: brain.products.filter((p) => p.id !== id) });
  }
  function confirmProductSuggestion(id: string) {
    persist({ ...brain, products: brain.products.map((p) => p.id === id ? { ...p, source: "user_confirmed", confidence: "high", confirmedAt: new Date().toISOString() } : p) });
  }
  function rejectProductSuggestion(id: string) {
    persist({ ...brain, products: brain.products.filter((p) => p.id !== id) });
  }

  function saveCompetitor(c: CompanyCompetitor) {
    const exists = brain.competitors.some((x) => x.id === c.id);
    const next: CompanyBrain = { ...brain, competitors: exists ? brain.competitors.map((x) => x.id === c.id ? c : x) : [...brain.competitors, c] };
    persist(next);
    setEditingCompetitorId(null);
  }
  function deleteCompetitor(id: string) {
    persist({ ...brain, competitors: brain.competitors.filter((c) => c.id !== id) });
  }

  const completeness = computeCompleteness(brain);
  const gaps = topKnowledgeGaps(brain, 3);

  return (
    <Shell>
      <div style={{ maxWidth: 840, margin: "0 auto", padding: "56px 40px 100px" }}>
        {!loaded ? (
          <div className="skel" style={{ width: "100%", height: 280, borderRadius: 16 }} />
        ) : !hasCompany ? (
          <>
            <PageHeader eyebrow="Företagskunskap" title="Vad jag vet om företaget." />
            <EmptyState
              icon={<IconCompany size={19} />}
              title="Ingen företagsprofil ännu."
              body="Skapa en profil så kan jag börja ge rekommendationer baserade på riktig kunskap om företaget, inte antaganden."
              action={<PrimaryButton href="/onboarding">Starta onboarding</PrimaryButton>}
            />
          </>
        ) : (
          <div className="fade-up" style={{ display: "flex", flexDirection: "column", gap: 28 }}>
            <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
              <PageHeader
                eyebrow="Företagskunskap"
                title={`Vad jag vet om ${companyName}.`}
                subtitle="Det här är grunden för varje rekommendation, kampanj och textutkast jag skapar. Komplettera när du har tid — inget kräver att allt fylls i på en gång."
              />
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <CompletenessBadge level={completeness.level} />
                <SaveStatusText status={saveStatus} />
              </div>
            </div>

            {saveStatus === "error" && <ErrorNote>Kunde inte spara ändringen. Kontrollera anslutningen och försök igen.</ErrorNote>}

            <KnowledgeGapsPanel gaps={gaps} onAnswer={answerGap} />

            {/* 1. Översikt */}
            <SectionCard title="Översikt" status={brain.companySummary ? "Sammanfattning finns" : "Ingen sammanfattning ännu"} defaultOpen>
              <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                <Field label="Företagssammanfattning" optional>
                  <TextArea rows={3} value={brain.companySummary} onChange={(e) => setBrain({ ...brain, companySummary: e.target.value })} />
                </Field>
                <Field label="Marknadsföringsmål" optional>
                  <TagList items={brain.marketingGoals} onChange={(v) => setBrain({ ...brain, marketingGoals: v })} placeholder="t.ex. Fler offertförfrågningar" />
                </Field>
                <div><PrimaryButton onClick={() => save(brain)}>Spara översikt</PrimaryButton></div>
              </div>
            </SectionCard>

            {/* 2. Produkter och tjänster */}
            <SectionCard title="Produkter och tjänster" status={`${brain.products.length} st${brain.products.some((p) => p.source !== "user_confirmed") ? " · några föreslagna" : ""}`} defaultOpen>
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {brain.products.length === 0 && editingProductId !== "new" && (
                  <p style={{ fontFamily: fontSans, fontSize: "0.85rem", fontWeight: 300, color: T.text3 }}>Inga produkter tillagda ännu.</p>
                )}
                {brain.products.map((p) => (
                  editingProductId === p.id ? (
                    <ProductForm key={p.id} product={p} onSave={saveProduct} onCancel={() => setEditingProductId(null)} />
                  ) : (
                    <ProductRow
                      key={p.id} product={p}
                      onEdit={() => setEditingProductId(p.id)}
                      onDelete={() => deleteProduct(p.id)}
                      onConfirmSuggestion={() => confirmProductSuggestion(p.id)}
                      onRejectSuggestion={() => rejectProductSuggestion(p.id)}
                    />
                  )
                ))}

                {editingProductId === "new" && (
                  <ProductForm product={newManualProduct("")} onSave={saveProduct} onCancel={() => setEditingProductId(null)} />
                )}
                {editingProductId !== "new" && (
                  <div><GhostButton onClick={() => setEditingProductId("new")}><IconPlus size={14} /> Lägg till produkt</GhostButton></div>
                )}
              </div>
            </SectionCard>

            {/* 3. Målgrupper */}
            <SectionCard title="Målgrupper" status={brain.primaryCustomers.length ? `${brain.primaryCustomers.length} st` : "Ingen målgrupp ännu"}>
              <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                <TagList items={brain.primaryCustomers} onChange={(v) => setBrain({ ...brain, primaryCustomers: v })} placeholder="t.ex. Villaägare 45–70 år" />
                <div><PrimaryButton onClick={() => save(brain)}>Spara målgrupper</PrimaryButton></div>
              </div>
            </SectionCard>

            {/* 4. Styrkor och USP */}
            <SectionCard title="Styrkor och USP" status={(brain.strengths.length + brain.uniqueSellingPoints.length) ? "Ifyllt" : "Inget ifyllt ännu"}>
              <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                <Field label="Styrkor"><TagList items={brain.strengths} onChange={(v) => setBrain({ ...brain, strengths: v })} placeholder="t.ex. Snabb leverans" /></Field>
                <Field label="Unika säljargument (USP)" optional><TagList items={brain.uniqueSellingPoints} onChange={(v) => setBrain({ ...brain, uniqueSellingPoints: v })} placeholder="t.ex. Enda med leverans samma dag" /></Field>
                <div><PrimaryButton onClick={() => save(brain)}>Spara styrkor</PrimaryButton></div>
              </div>
            </SectionCard>

            {/* 5. Kundinvändningar */}
            <SectionCard title="Kundinvändningar" status={brain.commonCustomerObjections.length ? `${brain.commonCustomerObjections.length} st` : "Inga angivna ännu"}>
              <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                <p style={{ fontFamily: fontSans, fontSize: "0.82rem", fontWeight: 300, color: T.text3, lineHeight: 1.6 }}>
                  Generella invändningar för hela företaget. Produktspecifika invändningar anges under respektive produkt.
                </p>
                <TagList items={brain.commonCustomerObjections} onChange={(v) => setBrain({ ...brain, commonCustomerObjections: v })} placeholder="t.ex. Priset känns högt" />
                <div><PrimaryButton onClick={() => save(brain)}>Spara invändningar</PrimaryButton></div>
              </div>
            </SectionCard>

            {/* 6. Konkurrenter */}
            <SectionCard title="Konkurrenter" status={brain.competitors.length ? `${brain.competitors.length} st` : "Inga angivna ännu"}>
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {brain.competitors.map((c) => (
                  editingCompetitorId === c.id ? (
                    <CompetitorForm key={c.id} competitor={c} onSave={saveCompetitor} onCancel={() => setEditingCompetitorId(null)} />
                  ) : (
                    <div key={c.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 16px", background: T.surface2, borderRadius: 12, border: `1px solid ${T.line}`, gap: 12, flexWrap: "wrap" }}>
                      <div>
                        <div style={{ fontFamily: fontSans, fontSize: "0.88rem", fontWeight: 500, color: T.text }}>{c.name}</div>
                        {c.website && <div style={{ fontFamily: fontSans, fontSize: "0.74rem", color: T.text3 }}>{c.website}</div>}
                      </div>
                      <div style={{ display: "flex", gap: 8 }}>
                        <GhostButton onClick={() => setEditingCompetitorId(c.id)}><IconPencil size={13} /></GhostButton>
                        <GhostButton onClick={() => deleteCompetitor(c.id)}><IconTrash size={13} /></GhostButton>
                      </div>
                    </div>
                  )
                ))}
                {editingCompetitorId === "new" && (
                  <CompetitorForm competitor={{ id: newBrainId(), name: "", source: "user_confirmed", confidence: "high" }} onSave={saveCompetitor} onCancel={() => setEditingCompetitorId(null)} />
                )}
                {editingCompetitorId !== "new" && (
                  <div><GhostButton onClick={() => setEditingCompetitorId("new")}><IconPlus size={14} /> Lägg till konkurrent</GhostButton></div>
                )}
              </div>
            </SectionCard>

            {/* 7. Ton och innehållsregler */}
            <SectionCard title="Ton och innehållsregler" status={brain.tone.length ? "Ifyllt" : "Inget ifyllt ännu"}>
              <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                <Field label="Tonläge"><TagList items={brain.tone} onChange={(v) => setBrain({ ...brain, tone: v })} placeholder="t.ex. Personlig, rak" /></Field>
                <Field label="Innehållsregler" optional><TagList items={brain.contentGuidelines} onChange={(v) => setBrain({ ...brain, contentGuidelines: v })} placeholder="t.ex. Använd alltid du-tilltal" /></Field>
                <Field label="Sådant ni aldrig vill uttrycka" optional><TagList items={brain.forbiddenClaims} onChange={(v) => setBrain({ ...brain, forbiddenClaims: v })} placeholder="t.ex. Lova aldrig snabbast i stan" /></Field>
                <Field label="Föredragna call-to-actions" optional><TagList items={brain.preferredCallsToAction} onChange={(v) => setBrain({ ...brain, preferredCallsToAction: v })} placeholder="t.ex. Boka en kostnadsfri offert" /></Field>
                <div><PrimaryButton onClick={() => save(brain)}>Spara ton och regler</PrimaryButton></div>
              </div>
            </SectionCard>

            {/* 8. Säsonger och prioriteringar */}
            <SectionCard title="Säsonger och prioriteringar" status={brain.keySeasons.length ? `${brain.keySeasons.length} säsonger` : "Inga säsonger ännu"}>
              <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                <Field label="Viktiga säsonger"><TagList items={brain.keySeasons} onChange={(v) => setBrain({ ...brain, keySeasons: v })} placeholder="t.ex. Sommar, Black Friday" /></Field>
                <div>
                  <div style={{ fontFamily: fontSans, fontSize: "0.68rem", fontWeight: 500, letterSpacing: "0.1em", textTransform: "uppercase", color: T.text3, marginBottom: 9 }}>Prioriterade produkter just nu</div>
                  {brain.products.filter((p) => p.priority === "high").length === 0 ? (
                    <p style={{ fontFamily: fontSans, fontSize: "0.82rem", fontWeight: 300, color: T.text3 }}>Ingen produkt är markerad som hög prioritet ännu — sätt det under Produkter och tjänster.</p>
                  ) : (
                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                      {brain.products.filter((p) => p.priority === "high").map((p) => (
                        <span key={p.id} style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "5px 12px", borderRadius: 999, background: T.purpleDim, fontFamily: fontSans, fontSize: "0.78rem", color: T.purpleBright }}>
                          <IconCampaigns size={12} /> {p.name}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
                <div><PrimaryButton onClick={() => save(brain)}>Spara säsonger</PrimaryButton></div>
              </div>
            </SectionCard>

            <div>
              <GhostButton href="/profile">Redigera rådata och ladda upp filer</GhostButton>
            </div>
          </div>
        )}
      </div>
    </Shell>
  );
}

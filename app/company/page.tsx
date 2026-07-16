"use client";

// ─────────────────────────────────────────────────────────────
// Företagskunskap — vad AI:n vet om företaget just nu. Samma
// profildata som redan finns (Supabase companies-tabell), bara
// presenterad i det nya designspråket. Redigering sker fortsatt
// på /profile.
//
// Marketing Rhythm-valet fanns tidigare i dashboardens "Brain"-vy
// (localStorage "marketing-copilot-rhythm", synkas till Supabase-
// tabellen marketing_rhythm nästa gång en plan genereras) — samma
// oförändrade logik, flyttad hit eftersom den hör hemma bland
// företagskunskapen.
// ─────────────────────────────────────────────────────────────
import { useState } from "react";
import { T, fontSans } from "@/app/_shared/theme";
import Shell from "@/app/_shared/Shell";
import { Eyebrow, PageHeader, PrimaryButton, GhostButton, EmptyState } from "@/app/_shared/ui";
import { IconCompany } from "@/app/_shared/icons";
import { useAccountData } from "@/app/_shared/useAccountData";

type Rhythm = "weekly" | "biweekly" | "monthly";

const RHYTHM_OPTIONS: { id: Rhythm; label: string; sub: string }[] = [
  { id: "weekly", label: "Varje vecka", sub: "52 planer / år" },
  { id: "biweekly", label: "Varannan vecka", sub: "26 planer / år" },
  { id: "monthly", label: "En gång i månaden", sub: "12 planer / år" },
];

function Field({ label, value }: { label: string; value?: string }) {
  if (!value) return null;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6, padding: "18px 0", borderBottom: `1px solid ${T.line}` }}>
      <span style={{ fontFamily: fontSans, fontSize: "0.65rem", fontWeight: 500, letterSpacing: "0.1em", textTransform: "uppercase", color: T.text3 }}>{label}</span>
      <span style={{ fontFamily: fontSans, fontSize: "0.92rem", fontWeight: 300, color: T.text2, lineHeight: 1.65 }}>{value}</span>
    </div>
  );
}

function RhythmPicker() {
  // Läses lat vid mount (inte i en effekt) — enda källan är localStorage,
  // ingen extern prenumeration att synka mot.
  const [rhythm, setRhythm] = useState<Rhythm | null>(() => {
    if (typeof window === "undefined") return null;
    return (localStorage.getItem("marketing-copilot-rhythm") as Rhythm | null) ?? null;
  });

  function select(r: Rhythm) {
    setRhythm(r);
    localStorage.setItem("marketing-copilot-rhythm", r);
  }

  return (
    <section style={{ marginTop: 40 }}>
      <Eyebrow color={T.text3}>Marketing rhythm</Eyebrow>
      <p style={{ fontFamily: fontSans, fontSize: "0.82rem", fontWeight: 300, color: T.text3, marginTop: 8, marginBottom: 14, lineHeight: 1.6 }}>
        Hur ofta vill du att din marknadschef tar fram en ny plan?
      </p>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {RHYTHM_OPTIONS.map((opt) => {
          const active = rhythm === opt.id;
          return (
            <button key={opt.id} type="button" onClick={() => select(opt.id)} style={{
              display: "flex", alignItems: "center", justifyContent: "space-between",
              padding: "14px 18px", borderRadius: 12, cursor: "pointer", textAlign: "left",
              background: active ? T.purpleDim : T.surface,
              border: `1px solid ${active ? T.purpleBorder : T.line}`,
              transition: "all .15s",
            }}>
              <div>
                <div style={{ fontFamily: fontSans, fontSize: "0.88rem", fontWeight: 400, color: active ? T.purpleBright : T.text2, marginBottom: 2 }}>{opt.label}</div>
                <div style={{ fontFamily: fontSans, fontSize: "0.72rem", fontWeight: 300, color: T.text3 }}>{opt.sub}</div>
              </div>
              <div style={{
                width: 16, height: 16, borderRadius: "50%", flexShrink: 0,
                border: `1.5px solid ${active ? T.purpleBright : T.line2}`, background: active ? T.purpleBright : "transparent",
                display: "flex", alignItems: "center", justifyContent: "center",
              }}>
                {active && <div style={{ width: 6, height: 6, borderRadius: "50%", background: T.bg }} />}
              </div>
            </button>
          );
        })}
      </div>
    </section>
  );
}

export default function CompanyPage() {
  const { profile, loaded } = useAccountData();

  return (
    <Shell>
      <div style={{ maxWidth: 760, margin: "0 auto", padding: "56px 40px 80px" }}>
        <PageHeader
          eyebrow="Företagskunskap"
          title={profile ? `Vad jag vet om ${profile.companyName}.` : "Vad jag vet om företaget."}
          subtitle="Det här är grunden för varje rekommendation, kampanj och textutkast jag skapar."
        />

        {!loaded ? (
          <div className="skel" style={{ width: "100%", height: 240, borderRadius: 14 }} />
        ) : !profile ? (
          <EmptyState
            icon={<IconCompany size={19} />}
            title="Ingen företagsprofil ännu."
            body="Skapa en profil så kan jag börja ge rekommendationer baserade på riktig kunskap om företaget, inte antaganden."
            action={<PrimaryButton href="/onboarding">Starta onboarding</PrimaryButton>}
          />
        ) : (
          <div>
            <div style={{ padding: "8px 24px", borderRadius: 14, background: T.surface, border: `1px solid ${T.line}` }}>
              <Field label="Bransch" value={profile.industry} />
              <Field label="Sammanfattning" value={profile.summary} />
              <Field label="Kunder" value={profile.customers?.join(", ")} />
              <Field label="Produkter & tjänster" value={profile.products?.join(", ")} />
              <Field label="Tonläge" value={profile.tone?.join(", ")} />
              <Field label="Styrkor" value={profile.strengths?.join(", ")} />
              <Field label="Undvik" value={profile.avoid?.join(", ")} />
            </div>
            <div style={{ marginTop: 24 }}>
              <GhostButton href="/profile">Redigera företagskunskap</GhostButton>
            </div>

            <RhythmPicker />
          </div>
        )}
      </div>
    </Shell>
  );
}

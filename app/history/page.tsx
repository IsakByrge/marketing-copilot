"use client";

// ─────────────────────────────────────────────────────────────
// Historik — riktig data: varje gång en marknadsplan genereras
// sparas den som en ny rad i Supabase-tabellen "plans" (INSERT,
// inte upsert), så historiken har alltid funnits — bara aldrig
// visats i UI:t förrän nu. Ingen ny affärslogik, bara en lista
// i stället för limit(1).
// ─────────────────────────────────────────────────────────────
import Shell from "@/app/_shared/Shell";
import { T, fontSerif, fontSans } from "@/app/_shared/theme";
import { PageHeader, PrimaryButton, EmptyState } from "@/app/_shared/ui";
import { IconHistory } from "@/app/_shared/icons";
import { useAccountData } from "@/app/_shared/useAccountData";

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("sv-SE", { day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

export default function HistoryPage() {
  const { history, loaded } = useAccountData();

  return (
    <Shell>
      <div style={{ maxWidth: 760, margin: "0 auto", padding: "56px 40px 80px" }}>
        <PageHeader eyebrow="Historik" title="Tidigare marknadsplaner." subtitle="Varje plan din marknadschef har skapat, i tidsordning." />

        {!loaded ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <div className="skel" style={{ width: "100%", height: 64, borderRadius: 12 }} />
            <div className="skel" style={{ width: "100%", height: 64, borderRadius: 12 }} />
          </div>
        ) : history.length === 0 ? (
          <EmptyState
            icon={<IconHistory size={19} />}
            title="Ingen historik ännu."
            body="Så fort du genererar din första marknadsplan eller kampanj samlas den här, så du kan se hur strategin utvecklats över tid."
            action={<PrimaryButton href="/dashboard">Till Idag</PrimaryButton>}
          />
        ) : (
          <div style={{ borderTop: `1px solid ${T.line}` }}>
            {history.map((entry) => (
              <div key={entry.id} style={{ display: "flex", gap: 20, padding: "20px 4px", borderBottom: `1px solid ${T.line}`, alignItems: "flex-start" }}>
                <span style={{ fontFamily: fontSans, fontSize: "0.72rem", fontWeight: 400, color: T.text4, flexShrink: 0, width: 148, paddingTop: 3 }}>
                  {formatDate(entry.createdAt)}
                </span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <h3 style={{ fontFamily: fontSerif, fontWeight: 400, fontSize: "1.05rem", color: T.text, marginBottom: 6 }}>{entry.focus || "Marknadsplan"}</h3>
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    {entry.tags.slice(0, 4).map((tag, i) => (
                      <span key={i} style={{
                        fontFamily: fontSans, fontSize: "0.68rem", fontWeight: 400, color: T.text3,
                        background: T.surface2, border: `1px solid ${T.line}`, borderRadius: 999, padding: "3px 10px",
                      }}>
                        {tag}
                      </span>
                    ))}
                  </div>
                  <p style={{ fontFamily: fontSans, fontSize: "0.74rem", fontWeight: 300, color: T.text4, marginTop: 8 }}>
                    {entry.postCount} inlägg · {entry.campaignCount} kampanjförslag
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </Shell>
  );
}

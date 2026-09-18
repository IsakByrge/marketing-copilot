"use client";

// ─────────────────────────────────────────────────────────────
// Historik — riktig data: varje gång en marknadsplan genereras
// sparas den som en ny rad i Supabase-tabellen "plans" (INSERT,
// inte upsert), så historiken har alltid funnits — bara aldrig
// visats i UI:t förrän nu. Ingen ny affärslogik, bara en lista
// i stället för limit(1).
// ─────────────────────────────────────────────────────────────
import Link from "next/link";
import AppShell from "@/app/_shared/AppShell";
import { T, fontSans } from "@/app/_shared/themeLight";
import { PageHeader, PrimaryButton, EmptyState } from "@/app/_shared/uiLight";
import { IconHistory } from "@/app/_shared/icons";
import { useAccountData } from "@/app/_shared/useAccountData";

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("sv-SE", { day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

export default function HistoryPage() {
  const { history, loaded } = useAccountData();

  return (
    <AppShell>
      <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-10 lg:py-12">
        <PageHeader eyebrow="Historik" title="Tidigare förslag." subtitle="Varje veckoförslag som skapats, i tidsordning." />

        {/* /campaigns har ingen egen menypost langre. Det har ar vagen dit. */}
        <p style={{ fontFamily: fontSans, fontSize: "0.85rem", color: T.text3, marginTop: -24, marginBottom: 32 }}>
          <Link href="/campaigns" style={{ color: T.text2, textDecoration: "underline", textUnderlineOffset: 3, display: "inline-flex", alignItems: "center", minHeight: 44 }}>
            Se kampanjförslagen samlade
          </Link>
        </p>

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
                <span style={{ fontFamily: fontSans, fontSize: "0.75rem", fontWeight: 400, color: T.text4, flexShrink: 0, width: 148, paddingTop: 3 }}>
                  {formatDate(entry.createdAt)}
                </span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <h3 style={{ fontFamily: fontSans, fontWeight: 400, fontSize: "1.05rem", color: T.text, marginBottom: 6 }}>{entry.focus || "Marknadsplan"}</h3>
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    {entry.tags.slice(0, 4).map((tag, i) => (
                      <span key={i} style={{
                        fontFamily: fontSans, fontSize: "0.75rem", fontWeight: 400, color: T.text3,
                        background: T.surface2, border: `1px solid ${T.line}`, borderRadius: 999, padding: "3px 10px",
                      }}>
                        {tag}
                      </span>
                    ))}
                  </div>
                  <p style={{ fontFamily: fontSans, fontSize: "0.75rem", fontWeight: 300, color: T.text4, marginTop: 8 }}>
                    {entry.postCount} inlägg · {entry.campaignCount} kampanjförslag
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </AppShell>
  );
}

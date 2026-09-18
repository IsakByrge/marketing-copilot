"use client";

// ─────────────────────────────────────────────────────────────
// Historik — riktig data: varje gång en marknadsplan genereras
// sparas den som en ny rad i Supabase-tabellen "plans" (INSERT,
// inte upsert), så historiken har alltid funnits — bara aldrig
// visats i UI:t förrän nu. Ingen ny affärslogik, bara en lista
// i stället för limit(1).
//
// Listan låg tidigare i två kolumner med datumet i en fast bredd på
// 148px. På 390px betydde det att datumet åt 40% av bredden medan
// rubriken klämdes ihop och radbröts fem gånger — halva skärmen tom,
// texten trång. Nu är datumet en liten överrad och rubriken får hela
// bredden; från sm och upp ligger de sida vid sida igen.
//
// Sidan är samtidigt flyttad från inline-stilar och uiLight till
// primitiverna, så den använder samma tokens som resten av appen.
// ─────────────────────────────────────────────────────────────
import AppShell from "@/app/_shared/AppShell";
import { ButtonLink, Card, Chip, EmptyState, Skeleton } from "@/app/_shared/primitives";
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
        <header className="mb-8">
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-text-tertiary">
            Historik
          </p>
          <h1 className="mt-3 text-[clamp(1.5rem,3.2vw,1.85rem)] font-semibold leading-[1.25] tracking-tight">
            Tidigare förslag.
          </h1>
          <p className="mt-3 max-w-xl text-[15px] leading-relaxed text-text-secondary">
            Varje veckoförslag som skapats, i tidsordning.
          </p>
          {/* /campaigns har ingen egen menypost. Det har ar vagen dit. */}
          {/* Understruken: som ren ghost-knapp ser raden ut som brodtext
              och slutar lasa som en lank. */}
          <ButtonLink
            href="/campaigns"
            variant="ghost"
            size="sm"
            className="mt-4 -ml-3 font-normal underline underline-offset-4"
          >
            Se kampanjförslagen samlade
          </ButtonLink>
        </header>

        {!loaded ? (
          <div className="flex flex-col gap-2.5">
            <Skeleton className="h-16 w-full rounded-lg" />
            <Skeleton className="h-16 w-full rounded-lg" />
          </div>
        ) : history.length === 0 ? (
          <EmptyState
            icon={<IconHistory size={19} />}
            title="Ingen historik ännu."
            body="Så fort du genererar din första marknadsplan eller kampanj samlas den här, så du kan se hur strategin utvecklats över tid."
            action={<ButtonLink href="/dashboard">Till Idag</ButtonLink>}
          />
        ) : (
          <div className="flex flex-col gap-3">
            {history.map((entry) => (
              <Card key={entry.id} padding="sm">
                {/* En kolumn pa telefon, tva fran sm. Datumet ar en overrad
                    dar det inte far plats bredvid. */}
                <div className="sm:flex sm:items-start sm:gap-5">
                  <p className="text-xs text-text-tertiary sm:w-36 sm:shrink-0 sm:pt-1">
                    {formatDate(entry.createdAt)}
                  </p>
                  <div className="mt-1 min-w-0 sm:mt-0 sm:flex-1">
                    <h2 className="text-[17px] font-medium leading-snug">
                      {entry.focus || "Marknadsplan"}
                    </h2>
                    {entry.tags.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-2">
                        {entry.tags.slice(0, 4).map((tag, i) => (
                          <Chip key={i}>{tag}</Chip>
                        ))}
                      </div>
                    )}
                    <p className="mt-2 text-xs text-text-tertiary">
                      {entry.postCount} inlägg · {entry.campaignCount} kampanjförslag
                    </p>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>
    </AppShell>
  );
}

"use client";

// ─────────────────────────────────────────────────────────────
// Kampanjer — ingen datamodell spårar ännu "aktiva" kampanjer med
// status/datum/kanal (Kampanjstrategin sparar inget kampanjresultat
// än), så det ärliga tomläget visas alltid för den delen. Däremot
// visas riktiga kampanjförslag från senaste marknadsplanen, tydligt
// märkta som förslag — inte som pågående kampanjer.
//
// Sista sidan som låg på uiLight. Med den här flytten kan den filen
// tas bort helt.
// ─────────────────────────────────────────────────────────────
import AppShell from "@/app/_shared/AppShell";
import { ButtonLink, Card, EmptyState, Skeleton } from "@/app/_shared/primitives";
import { IconCampaigns } from "@/app/_shared/icons";
import { useAccountData } from "@/app/_shared/useAccountData";

/** Sektionsetikett. Versaler är kvar med flit — samma mönster som
 *  Idag, Innehåll, Historik, Kampanjstrategi och Facebook. */
function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-xs font-semibold uppercase tracking-[0.12em] text-text-tertiary">
      {children}
    </p>
  );
}

export default function CampaignsPage() {
  const { plan, loaded } = useAccountData();

  return (
    <AppShell>
      <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-10 lg:py-12">
        <header className="mb-8">
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-text-tertiary">
            Kampanjer
          </p>
          <h1 className="mt-3 text-[clamp(1.5rem,3.2vw,1.85rem)] font-semibold leading-[1.25] tracking-tight">
            Dina kampanjer.
          </h1>
          <p className="mt-3 max-w-xl text-[15px] leading-relaxed text-text-secondary">
            Aktiva kampanjer och kampanjförslag samlade på ett ställe.
          </p>
        </header>

        {!loaded ? (
          <Skeleton className="h-40 w-full rounded-lg" />
        ) : (
          <div className="flex flex-col gap-11">
            <section>
              <SectionLabel>Aktiva kampanjer</SectionLabel>
              <div className="mt-3.5">
                <EmptyState
                  icon={<IconCampaigns size={19} />}
                  title="Du har inga aktiva kampanjer ännu."
                  body="Börja med att arbeta fram en kampanjstrategi."
                  action={<ButtonLink href="/campaign-builder">Skapa första kampanjen</ButtonLink>}
                />
              </div>
            </section>

            {plan?.campaigns && plan.campaigns.length > 0 && (
              <section>
                <SectionLabel>Kampanjförslag från din senaste marknadsplan</SectionLabel>
                <p className="mb-4 mt-1.5 text-xs text-text-tertiary">
                  Utkast — inte startade eller aktiva.
                </p>
                <div className="flex flex-col gap-2.5">
                  {plan.campaigns.map((c, i) => (
                    // Kortet lankade till /campaign, som ar parkerad. Titel
                    // och mal star redan har, sa det finns inget att oppna.
                    <Card key={i} padding="sm">
                      <h2 className="text-[17px] font-medium leading-snug">{c.title}</h2>
                      <p className="mt-1.5 text-sm leading-relaxed text-text-secondary">{c.goal}</p>
                    </Card>
                  ))}
                </div>
              </section>
            )}
          </div>
        )}
      </div>
    </AppShell>
  );
}

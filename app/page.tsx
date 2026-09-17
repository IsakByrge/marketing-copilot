// ─────────────────────────────────────────────────────────────
// Landningssidan, i appens eget system: papperston, emerald, sans.
//
// En rubrik, en mening, en knapp. Rubriken beskriver resultatet —
// att veckans texter redan är skrivna — inte tekniken bakom. Ingen
// besökare köper "AI", de köper att slippa skriva.
//
// Bilden under är en STILISERING av Idag-vyn, byggd av samma
// primitiver som den riktiga sidan. Den är märkt "Exempel" och
// innehåller påhittat företagsinnehåll med flit: en skärmdump med
// riktig kunddata hör inte hemma på en publik sida.
//
// Inga siffror, inga påståenden om resultat. Se VISION.md.
// ─────────────────────────────────────────────────────────────
import Link from "next/link";
import { Button, ButtonLink, Card, Chip } from "@/app/_shared/primitives";

/** Stiliserad Idag-vy. Samma struktur och primitiver som /dashboard. */
function IdagExempel() {
  return (
    <div
      aria-label="Exempel på hur Idag-vyn ser ut"
      className="rounded-lg border border-border bg-background p-5 sm:p-8"
    >
      <header className="mb-7">
        <p className="text-xs font-semibold uppercase tracking-[0.12em] text-text-tertiary">
          Vecka 24 · God förmiddag
        </p>
        <h3 className="mt-3 max-w-lg text-[clamp(1.15rem,2.4vw,1.4rem)] font-semibold leading-[1.3] tracking-tight">
          Den här veckan lyfter vi vinterförvaring, innan kunderna hinner tänka på det själva.
        </h3>
        <p className="mt-3 max-w-md text-[15px] leading-relaxed text-text-secondary">
          Jag lutar åt säsong, service och trygghet den här veckan, utifrån det du fyllt i.
        </p>
        <div className="mt-5 flex flex-wrap gap-2">
          <Button size="sm" disabled>Se innehållet</Button>
          <Button size="sm" variant="secondary" disabled>Nytt förslag</Button>
        </div>
      </header>

      <h4 className="mb-3 text-xs font-semibold uppercase tracking-[0.12em] text-text-tertiary">
        Klart att använda
      </h4>
      <div className="space-y-2.5">
        {[
          { title: "Fem inlägg till sociala medier", body: "Skrivna i ditt tonläge, redo att klistra in." },
          { title: "Ett nyhetsbrev", body: "Ämnesrad, brödtext och avslutning." },
          { title: "Två kampanjförslag", body: "Utkast att ta ställning till, inte startade kampanjer." },
        ].map((r) => (
          <Card key={r.title} padding="sm">
            <p className="font-medium">{r.title}</p>
            <p className="mt-1 text-sm leading-relaxed text-text-secondary">{r.body}</p>
          </Card>
        ))}
      </div>
    </div>
  );
}

export default function Home() {
  return (
    <div className="app-light flex min-h-svh flex-col bg-background font-sans text-text-primary">
      <header className="sticky top-0 z-20 border-b border-border bg-background/90 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-5xl items-center justify-between px-4 sm:px-6 lg:px-10">
          <span className="flex items-center gap-2.5">
            <span
              aria-hidden
              className="flex h-7 w-7 items-center justify-center rounded bg-primary text-sm font-medium text-white"
            >
              M
            </span>
            <span className="text-sm font-medium">Marketing Copilot</span>
          </span>
          <Link
            href="/login"
            className="rounded px-3 py-1.5 text-sm text-text-secondary transition-colors hover:bg-surface hover:text-text-primary"
          >
            Logga in
          </Link>
        </div>
      </header>

      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-16 sm:px-6 lg:px-10 lg:py-24">
        <h1 className="max-w-3xl text-[clamp(2rem,5vw,3.25rem)] font-semibold leading-[1.1] tracking-tight">
          Veckans marknadsföring är redan skriven.
        </h1>
        <p className="mt-5 max-w-xl text-lg leading-relaxed text-text-secondary">
          Varje måndag ligger inläggen, nyhetsbrevet och kampanjförslagen färdiga —
          skrivna utifrån vad ditt företag gör och vilka kunderna är.
        </p>
        <div className="mt-8">
          <ButtonLink href="/login">Kom igång</ButtonLink>
        </div>

        <section className="mt-20 lg:mt-28">
          <div className="mb-4 flex items-center gap-3">
            <h2 className="text-xs font-semibold uppercase tracking-[0.12em] text-text-tertiary">
              Så ser det ut
            </h2>
            <Chip>Exempel</Chip>
          </div>
          <IdagExempel />
          <p className="mt-3 text-sm text-text-tertiary">
            Påhittat innehåll för ett verkstadsföretag. Ditt eget bygger på dina svar.
          </p>
        </section>
      </main>

      <footer className="border-t border-border">
        <div className="mx-auto max-w-5xl px-4 py-6 text-sm text-text-tertiary sm:px-6 lg:px-10">
          Marketing Copilot
        </div>
      </footer>
    </div>
  );
}

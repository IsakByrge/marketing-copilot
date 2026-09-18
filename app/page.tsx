// ─────────────────────────────────────────────────────────────
// Landningssidan.
//
// Den tidigare versionen var en rubrik, en mening, en knapp och en
// stiliserad Idag-vy. Den beskrev gränssnittet, inte vad man får.
//
// Nu tre sektioner: vad du får (med ett riktigt satt exempelinlägg som
// byter bransch), hur det går till i tre steg, och en avslutande rad.
// Exempelkortet är samma komponent som inloggningsflödet visar, så en
// besökare möter samma sak före och under inloggning.
//
// Inga gradienter, ingen glöd, inga ikoner, inga emoji. Inga siffror om
// resultat och inga kundcitat — det finns inget underlag för vare sig
// det ena eller det andra. Se VISION.md.
// ─────────────────────────────────────────────────────────────
import Link from "next/link";
import { ButtonLink, Chip } from "@/app/_shared/primitives";
import { ExempelRotator } from "@/app/_shared/ExempelInlagg";

/** De tre stegen. Siffror och text, inga ikoner. */
const STEG = [
  {
    rubrik: "Berätta om företaget en gång",
    text: "Vad ni säljer, vilka som köper och hur ni låter. Det gör du en gång, sedan ligger det kvar.",
  },
  {
    rubrik: "Få veckans texter varje måndag",
    text: "Fem inlägg, ett nyhetsbrev och ett par kampanjförslag, satta efter säsong och vad du vill sälja just nu.",
  },
  {
    rubrik: "Ändra det du vill och publicera",
    text: "Texterna går att använda som de är. Skriver du om något lär sig verktyget hur du uttrycker dig.",
  },
];

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
            className="inline-flex min-h-11 items-center rounded px-3 py-1.5 text-sm text-text-secondary transition-colors hover:bg-surface hover:text-text-primary sm:min-h-0"
          >
            Logga in
          </Link>
        </div>
      </header>

      <main className="flex-1">
        {/* ── Hjälte ──────────────────────────────────────────── */}
        <section className="mx-auto w-full max-w-5xl px-4 py-14 sm:px-6 lg:px-10 lg:py-20">
          <div className="grid items-center gap-10 lg:grid-cols-2 lg:gap-14">
            <div>
              <h1 className="max-w-xl text-[clamp(2rem,4.6vw,3rem)] font-semibold leading-[1.1] tracking-tight">
                Fem inlägg och ett nyhetsbrev, varje måndag.
              </h1>
              <p className="mt-5 max-w-lg text-lg leading-relaxed text-text-secondary">
                Skrivna utifrån vad ditt företag gör och vilka kunderna är. Du ändrar det du vill
                och publicerar.
              </p>
              <div className="mt-8">
                <ButtonLink href="/login?mode=signup">Kom igång</ButtonLink>
              </div>
            </div>

            <div>
              <div className="mb-3 flex items-center gap-3">
                <h2 className="text-xs font-semibold uppercase tracking-[0.12em] text-text-tertiary">
                  Ett inlägg ur veckan
                </h2>
                <Chip>Exempel</Chip>
              </div>
              <ExempelRotator />
            </div>
          </div>
        </section>

        {/* ── Så fungerar det ─────────────────────────────────── */}
        <section className="border-t border-border bg-surface-sunken">
          <div className="mx-auto w-full max-w-5xl px-4 py-14 sm:px-6 lg:px-10 lg:py-20">
            <h2 className="text-xs font-semibold uppercase tracking-[0.12em] text-text-tertiary">
              Så fungerar det
            </h2>
            <ol className="mt-8 grid gap-8 sm:grid-cols-3 sm:gap-10">
              {STEG.map((s, i) => (
                <li key={s.rubrik}>
                  <span className="text-sm font-semibold text-primary">{i + 1}</span>
                  <h3 className="mt-2 text-[17px] font-medium leading-snug">{s.rubrik}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-text-secondary">{s.text}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* ── Avslut ──────────────────────────────────────────── */}
        <section className="mx-auto w-full max-w-5xl px-4 py-14 sm:px-6 lg:px-10 lg:py-20">
          <div className="flex flex-wrap items-center justify-between gap-6">
            <p className="max-w-xl text-lg leading-relaxed">
              Nästa måndag kan veckans texter ligga färdiga.
            </p>
            <ButtonLink href="/login?mode=signup">Kom igång</ButtonLink>
          </div>
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

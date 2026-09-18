// ─────────────────────────────────────────────────────────────
// Landningssidan.
//
// Hjälten är veckans plan, inte rubriken. Ett ensamt exempelkort visade
// att verktyget kan skriva en text; bräden visar en hel vecka med olika
// roller på olika dagar, vilket är det man faktiskt betalar för.
// Rubriken är därför nedtonad — den ska inte konkurrera med det den
// beskriver.
//
// Rytmen är avsiktligt tresteg: rubrik stor och halvfet, brödtext
// mindre och i sekundärton, etiketter små versaler. Tidigare låg de tre
// för nära varandra i både storlek och vikt.
//
// Inga gradienter, ingen glöd, inga ikoner, inga emoji. Inga siffror om
// resultat och inga kundcitat — det finns inget underlag för vare sig
// det ena eller det andra. Se VISION.md.
// ─────────────────────────────────────────────────────────────
import Link from "next/link";
import { ButtonLink, Chip } from "@/app/_shared/primitives";
import VeckansBrada from "@/app/_shared/VeckansBrada";

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
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4 sm:px-6 lg:px-10">
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
        <section className="mx-auto w-full max-w-6xl px-4 py-12 sm:px-6 lg:px-10 lg:py-16">
          {/* grid-cols-1 och min-w-0 ar inte dekoration. En auto-spalt
              vaxer till sitt max-content, och den vagrata braden bidrar
              med alla fem korten - 1448px bred spalt pa en 390px skarm,
              vilket klippte rubriken pa mitten. min-w-0 later spalten
              krympa och lamnar rullningen till braden dar den hor hemma. */}
          <div className="grid grid-cols-1 gap-10 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)] lg:items-center lg:gap-14">
            <div className="min-w-0">
              <h1 className="max-w-md text-[clamp(1.75rem,3.2vw,2.25rem)] font-semibold leading-[1.15] tracking-tight">
                Fem inlägg och ett nyhetsbrev, varje måndag.
              </h1>
              <p className="mt-4 max-w-sm text-[15px] leading-relaxed text-text-secondary">
                Skrivna utifrån vad ditt företag gör och vilka kunderna är. Du ändrar det du vill
                och publicerar.
              </p>
              <ButtonLink href="/login?mode=signup" className="mt-6">
                Kom igång
              </ButtonLink>
            </div>

            <div className="min-w-0">
              <div className="mb-4 flex items-center gap-2.5">
                <h2 className="text-xs font-semibold uppercase tracking-[0.12em] text-text-tertiary">
                  Veckans plan
                </h2>
                <Chip>Exempel</Chip>
              </div>
              <VeckansBrada />
            </div>
          </div>
        </section>

        {/* ── Så fungerar det ─────────────────────────────────── */}
        <section className="border-t border-border bg-surface-sunken">
          <div className="mx-auto w-full max-w-6xl px-4 py-14 sm:px-6 lg:px-10 lg:py-16">
            <h2 className="text-xs font-semibold uppercase tracking-[0.12em] text-text-tertiary">
              Så fungerar det
            </h2>
            <ol className="mt-7 grid gap-8 sm:grid-cols-3 sm:gap-10">
              {STEG.map((s, i) => (
                <li key={s.rubrik}>
                  <span className="text-2xl font-semibold leading-none text-primary">{i + 1}</span>
                  <h3 className="mt-3 text-[15px] font-medium leading-snug">{s.rubrik}</h3>
                  <p className="mt-1.5 text-[13px] leading-relaxed text-text-secondary">{s.text}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* ── Avslut ──────────────────────────────────────────── */}
        <section className="border-t border-border">
          <div className="mx-auto w-full max-w-6xl px-4 py-16 sm:px-6 lg:px-10 lg:py-20">
            <div className="flex flex-wrap items-center justify-between gap-6">
              <p className="max-w-lg text-[clamp(1.25rem,2.4vw,1.6rem)] font-semibold leading-snug tracking-tight">
                Nästa måndag kan veckans texter ligga färdiga.
              </p>
              <ButtonLink href="/login?mode=signup">Kom igång</ButtonLink>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-border">
        <div className="mx-auto max-w-6xl px-4 py-6 text-sm text-text-tertiary sm:px-6 lg:px-10">
          Marketing Copilot
        </div>
      </footer>
    </div>
  );
}

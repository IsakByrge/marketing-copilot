// ─────────────────────────────────────────────────────────────
// Landningssidan.
//
// Byggd mot den låsta målbilden. Kompositionen, proportionerna och
// rytmen följer den; texterna gör det inte. Målbilden visar påhittade
// löften — "Kom igång gratis", resultatpåståenden, räckvidd och
// procenttal i kampanjfönstret, en kanalkoppling vi inte har och en
// meny med Produkt/Pris/Om oss som inte finns. Inget av det är med.
// Vi presenterar den produkt som faktiskt är byggd. Se VISION.md.
//
// Fyra block: hjälte, tre steg, avslutande band, sidfot. Ingen
// funktionskatalog, inga kundlogotyper, inga omdömen, inga siffror om
// resultat eller antal användare — vi har noll användare, och allt
// sådant vore påhittat.
//
// Hjälten är EN komposition: copy på 41 %, produkten på 59 %, båda i
// första vyhöjden på desktop. Under lg faller den isär i sin naturliga
// ordning — rubrik, ingress, knappar, produkt — utan perspektiv.
//
// Bakom produkten ligger tre mycket mjuka former. De ramar in bilden
// och ger djup; de ska anas, inte synas. Ingen glöd, ingen neon, ingen
// stockbild.
// ─────────────────────────────────────────────────────────────
import Link from "next/link";
import { ButtonLink } from "@/app/_shared/primitives";
import { IdagFonster, KampanjFonster } from "@/app/_marketing/ProduktPreview";

/** Tre steg som följer arbetsgången, inte funktionslistan. */
const STEG = [
  {
    rubrik: "Lär känna ditt företag",
    text: "Marketing Copilot bygger förståelse för verksamheten, erbjudandet och vad som är viktigt just nu.",
  },
  {
    rubrik: "Prioriterar nästa steg",
    text: "Du får en tydlig rekommendation om vad som är viktigast att göra härnäst — och varför.",
  },
  {
    rubrik: "Hjälper dig genomföra det",
    text: "Gå från beslut till kampanj, innehåll och uppföljning utan att börja från noll varje gång.",
  },
];

export default function Home() {
  return (
    <div className="app-light flex min-h-svh flex-col bg-background font-sans text-text-primary">
      {/* ── Header ───────────────────────────────────────────
          Kompakt, som målbilden. Men utan Produkt/Pris/Om oss: de
          sidorna finns inte, och en meny ska inte lova rutter vi
          saknar. */}
      <header className="sticky top-0 z-30 border-b border-border bg-background/85 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-5 sm:px-8 lg:px-10">
          <span className="flex items-center gap-2.5">
            <span
              aria-hidden
              className="flex h-7 w-7 items-center justify-center rounded bg-primary text-sm font-medium text-white"
            >
              M
            </span>
            <span className="whitespace-nowrap text-sm font-medium tracking-tight">
              Marketing Copilot
            </span>
          </span>

          <div className="flex items-center gap-1 sm:gap-2">
            <Link
              href="/login"
              className="inline-flex min-h-11 items-center whitespace-nowrap rounded px-2 text-sm text-text-secondary transition-colors hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 sm:min-h-0 sm:px-3 sm:py-2"
            >
              Logga in
            </Link>
            <ButtonLink href="/login?mode=signup" size="sm">
              Kom igång
            </ButtonLink>
          </div>
        </div>
      </header>

      <main className="flex-1">
        {/* ── Hjälten ───────────────────────────────────────── */}
        <section className="relative overflow-hidden">
          {/* Tre mjuka former. Två radialer som ger ytan riktning och en
              stor organisk platta i papperston under produkten. Alla
              under innehållet, alla nästan osynliga var för sig. */}
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0"
            style={{
              background:
                "radial-gradient(64% 52% at 70% 26%, rgba(18,94,75,0.10) 0%, rgba(18,94,75,0) 70%)",
            }}
          />
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0"
            style={{
              background:
                "radial-gradient(46% 46% at 92% 74%, rgba(216,207,190,0.55) 0%, rgba(216,207,190,0) 72%)",
            }}
          />
          <div
            aria-hidden
            className="pointer-events-none absolute -right-[12%] top-[8%] hidden h-[34rem] w-[46rem] rounded-[46%_54%_52%_48%/42%_46%_54%_58%] bg-surface-sunken/55 lg:block"
          />

          <div className="relative mx-auto w-full max-w-6xl px-5 pb-16 pt-12 sm:px-8 sm:pb-20 sm:pt-16 lg:grid lg:grid-cols-[minmax(0,41fr)_minmax(0,59fr)] lg:items-center lg:gap-10 lg:px-10 lg:pb-20 lg:pt-16">
            {/* Copy */}
            <div>
              {/* Rubriken bryter naturligt i den smala spalten, som i
                  målbilden. Ingen tvingad radbrytning: den låste
                  brytpunkten till en bredd spalten inte längre har. */}
              <h1 className="max-w-[13ch] text-[clamp(2.3rem,4.2vw,3.35rem)] font-semibold leading-[1.04] tracking-[-0.025em]">
                En tydligare väg framåt för din marknadsföring.
              </h1>

              <p className="mt-6 max-w-md text-[clamp(1rem,1.2vw,1.075rem)] leading-relaxed text-text-secondary">
                Marketing Copilot lär känna ditt företag, prioriterar vad som är viktigast och
                hjälper dig genomföra det — steg för steg.
              </p>

              <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
                <ButtonLink href="/login?mode=signup" className="justify-center sm:justify-start">
                  Kom igång
                </ButtonLink>
                {/* Målbilden har en play-ikon här. Den utelämnas: det
                    finns ingen film, och knappen scrollar till stegen. */}
                <ButtonLink
                  href="#sa-fungerar-det"
                  variant="secondary"
                  className="justify-center sm:justify-start"
                >
                  Se hur det fungerar
                </ButtonLink>
              </div>
            </div>

            {/* Produkten ─────────────────────────────────────
                Perspektivet sitter här, på wrappern, och fönstren får
                SAMMA rotation — bara läge och skala skiljer dem åt. Det
                är skillnaden mot två kort som roterats var för sig.

                Utrymmet ovanför Idag ligger som PADDING på den inre
                wrappern, inte som marginal på barnet: en marginal på
                första barnet kollapsar ut genom föräldern, och då följer
                wrapperns överkant med nedåt så att kampanjfönstrets
                top-0 hamnar rakt bakom Idag.

                Ingen translateZ. Den drar elementet mot perspektivets
                origo — wrapperns mitt — och flyttar fönstret ur läge när
                wrappern växer. */}
            <div className="relative mt-14 lg:mt-0 lg:-mr-[6%] lg:[perspective:1700px] xl:-mr-[9%]">
              {/* Bandet ovanför Idag är måttsatt efter kampanjfönstrets
                  egen höjd — list, namn, status, stapelrad och bildtext.
                  Räcker det inte syns bara en titelrad, och då är det
                  inget fönster utan en kant. */}
              <div className="relative pb-12 lg:pb-16 lg:pt-[9.5rem]">
                {/* Främre: Idag. Störst, först i DOM:en. */}
                <div className="relative z-10 lg:[transform:rotateX(4deg)_rotateY(-9deg)_rotateZ(0.6deg)]">
                  <IdagFonster />
                </div>

                {/* Bakre: kampanjen. Vanligt block under Idag på mobil;
                    från lg lyft ur flödet, bakom och uppe till höger.
                    Samma rotation som Idag, nedskalad — den hör till
                    samma komposition, den ligger bara längre bort. */}
                <div className="mt-4 lg:absolute lg:top-0 lg:right-[-4%] lg:z-0 lg:mt-0 lg:w-[62%] lg:[transform:rotateX(4deg)_rotateY(-9deg)_rotateZ(0.6deg)_scale(0.94)]">
                  <KampanjFonster />
                </div>

                {/* Handskriven notering — sidans enda. Står under
                    kompositionen till vänster och pekar upp mot det
                    rekommenderade nästa steget, som i målbilden. Fri
                    yta runt om, så den aldrig lägger sig över text.
                    Cormorant är redan registrerad; inget nytt typsnitt. */}
                <div
                  aria-hidden
                  className="pointer-events-none absolute bottom-0 left-[3%] z-20 hidden items-end gap-1.5 lg:flex"
                >
                  <span className="whitespace-nowrap text-[17px] italic leading-none text-text-secondary [font-family:var(--font-cormorant)]">
                    Det viktigaste först.
                  </span>
                  <svg
                    width="44"
                    height="40"
                    viewBox="0 0 44 40"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth={1.3}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="mb-1 text-text-tertiary"
                  >
                    <path d="M2 38c6-14 16-24 39-31" />
                    <path d="M31 3l10 4-3 9" />
                  </svg>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ── Så fungerar det ───────────────────────────────── */}
        <section
          id="sa-fungerar-det"
          className="scroll-mt-16 border-t border-border bg-surface-sunken"
        >
          <div className="mx-auto w-full max-w-6xl px-5 py-16 sm:px-8 sm:py-20 lg:px-10">
            <div className="max-w-2xl sm:mx-auto sm:text-center">
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-primary">
                Så fungerar det
              </p>
              <h2 className="mt-4 text-[clamp(1.5rem,2.8vw,2.1rem)] font-semibold leading-[1.15] tracking-[-0.018em]">
                Tre steg, i den ordning arbetet faktiskt sker.
              </h2>
            </div>

            <ol className="mt-12 grid gap-10 sm:grid-cols-3 sm:gap-8 lg:mt-14 lg:gap-12">
              {STEG.map((s, i) => (
                <li key={s.rubrik}>
                  <span
                    aria-hidden
                    className="flex h-8 w-8 items-center justify-center rounded-full border border-primary/25 bg-surface text-[13px] font-semibold tabular-nums text-primary"
                  >
                    {i + 1}
                  </span>
                  <h3 className="mt-4 text-[17px] font-medium leading-snug tracking-tight">
                    {s.rubrik}
                  </h3>
                  <p className="mt-2 text-[14px] leading-relaxed text-text-secondary">{s.text}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* ── Avslutande band ───────────────────────────────── */}
        <section className="border-t border-border">
          <div className="mx-auto w-full max-w-6xl px-5 py-14 sm:px-8 sm:py-16 lg:px-10">
            <div className="relative overflow-hidden rounded-xl border border-primary/15 bg-primary/[0.05] px-6 py-10 sm:px-10 sm:py-12">
              {/* Samma mjuka formspråk som bakom produkten, en form. */}
              <div
                aria-hidden
                className="pointer-events-none absolute -right-20 -top-24 h-[24rem] w-[24rem] rounded-[52%_48%_45%_55%/48%_44%_56%_52%] bg-surface-sunken/60"
              />
              <div className="relative flex flex-col gap-7 sm:flex-row sm:items-center sm:justify-between sm:gap-10">
                <p className="max-w-lg text-[clamp(1.35rem,2.5vw,1.8rem)] font-semibold leading-[1.2] tracking-[-0.015em]">
                  Nästa steg behöver inte vara en gissning.
                </p>
                <ButtonLink
                  href="/login?mode=signup"
                  className="shrink-0 justify-center sm:justify-start"
                >
                  Kom igång
                </ButtonLink>
              </div>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-border">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-5 py-8 text-sm text-text-tertiary sm:px-8 lg:px-10">
          <span>Marketing Copilot</span>
          <Link
            href="/login"
            className="inline-flex min-h-11 items-center rounded transition-colors hover:text-text-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 sm:min-h-0"
          >
            Logga in
          </Link>
        </div>
      </footer>
    </div>
  );
}

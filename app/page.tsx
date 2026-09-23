// ─────────────────────────────────────────────────────────────
// Landningssidan.
//
// Löftet är beslutet, inte texterna. Den gamla sidan sålde fem inlägg
// och ett nyhetsbrev varje måndag — en volymutfästelse som vem som
// helst med ChatGPT kan matcha. Det produkten är värd står i VISION.md:
// "Här är vad ditt företag bör göra härnäst inom marknadsföring — och
// varför."
//
// Hjälten är EN komposition, inte två block under varandra. Copy till
// vänster på 43 %, produkten till höger på 57 %, båda i första
// vyhöjden på normal desktop. Bilden låg tidigare som en egen sektion
// långt under texten; då blev rubriken ensam på en tom yta och
// produkten något man scrollade till i stället för något man möttes av.
//
// Under lg faller kompositionen isär i sin naturliga ordning: copy,
// sedan fönstren staplade, inget perspektiv. Läsbarhet före effekt.
//
// Tre block efter hjälten, inte tolv: så fungerar det, avslut, sidfot.
// Ingen funktionskatalog — vi säljer inte en påse verktyg. Inga
// kundlogotyper, inga omdömen, inga siffror om resultat eller antal
// användare. Vi har noll användare; allt sådant vore påhittat.
//
// Dekoren bakom produkten är två mycket svaga toner — en emerald och
// en varm papperston. Ingen gradientfest, ingen glöd, ingen
// AI-estetik, ingen stockbild. De finns för att bilden ska ha något
// att vila mot, inte för att synas.
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
        {/* ── Hjälten ─────────────────────────────────────────
            overflow-hidden på sektionen: bakre fönstret sticker ut åt
            höger med flit, och utan spärren blir det vågrät rullning. */}
        <section className="relative overflow-hidden border-b border-border">
          {/* Dekor. Två radialer, båda nästan osynliga var för sig —
              de ska ge ytan riktning, inte färg. */}
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0"
            style={{
              background:
                "radial-gradient(72% 58% at 72% 30%, rgba(18,94,75,0.13) 0%, rgba(18,94,75,0) 70%)",
            }}
          />
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0"
            style={{
              background:
                "radial-gradient(50% 50% at 86% 76%, rgba(216,207,190,0.68) 0%, rgba(216,207,190,0) 72%)",
            }}
          />

          {/* Behållaren får växa på xl. Produkten är hjälten, och på en
              bred skärm såg kompositionen ut som en liten dashboardbild
              bredvid texten i stället för tvärtom. */}
          <div className="relative mx-auto w-full max-w-6xl px-5 pb-16 pt-14 sm:px-8 sm:pb-20 sm:pt-20 lg:grid lg:grid-cols-[minmax(0,45fr)_minmax(0,55fr)] lg:items-center lg:gap-8 lg:px-10 lg:pb-20 lg:pt-16 xl:gap-10 2xl:max-w-7xl">
            {/* Copy */}
            <div className="lg:py-6">
              {/* Storleken är tagen så att "En tydligare väg framåt" ryms
                  på en rad i spalten. Taket är låst till 2,5rem eftersom
                  vw fortsätter växa med skärmen medan spalten står still
                  mot max-w-6xl — vid 1440 bröt rubriken i fyra ojämna
                  rader av just det skälet. Först på 2xl, när behållaren
                  faktiskt blir bredare, får den gå upp. */}
              <h1 className="text-[clamp(1.95rem,3.1vw,2.5rem)] font-semibold leading-[1.08] tracking-[-0.022em] 2xl:text-[2.8rem]">
                En tydligare väg framåt
                <br className="hidden sm:block" />{" "}
                för din marknadsföring.
              </h1>

              <p className="mt-6 max-w-md text-[clamp(1rem,1.35vw,1.1rem)] leading-relaxed text-text-secondary">
                Marketing Copilot lär känna ditt företag, prioriterar vad som är viktigast och
                hjälper dig genomföra det — steg för steg.
              </p>

              <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
                <ButtonLink href="/login?mode=signup" className="justify-center sm:justify-start">
                  Kom igång
                </ButtonLink>
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
                Perspektivet sitter här, på wrappern. Fönstren själva
                vet ingenting om lutning.

                På lg ligger kampanjfönstret absolut placerat bakom och
                uppe till höger. Under lg är det ett vanligt block under
                Idag-fönstret, utan transform: en lutad bild på 375px är
                bara svårläst. */}
            {/* Negativ högermarginal: produkten breddar sig förbi sin spalt
                i stället för att krympas in i den. Sektionen klipper, så
                det bakre fönstrets sista bit får gå ut ur bild — det är
                meningen att den fortsätter utanför.

                Bleeden trappas med skärmbredden, inte tvärtom. Vid exakt
                1280 ligger behållaren närmast kanten och marginalen utanför
                är som minst; tas för mycket där klipps FRÄMRE fönstrets
                hörn, och det ska alltid synas helt. */}
            <div className="relative mt-14 lg:mt-0 lg:-mr-[10%] lg:[perspective:2200px] xl:-mr-[16%] 2xl:-mr-[24%]">
              {/* Utrymmet ovanför Idag ligger som PADDING på wrappern, inte
                  som marginal på barnet. En marginal på första barnet
                  kollapsar ut genom föräldern, och då följer wrapperns
                  överkant med nedåt — kampanjfönstrets top-0 hamnade rakt
                  bakom Idag i stället för ovanför det. Padding kollapsar
                  inte, och absolut placering utgår från padding-boxen. */}
              <div className="relative lg:pt-[10rem] lg:[transform-style:preserve-3d]">
                {/* Främre: Idag. Står först i DOM:en, så den kommer
                    först både på mobil och för skärmläsare.

                    Marginalen uppåt på lg är det som gör kampanjfönstret
                    läsbart: i stället för att lyfta det bakre fönstret ur
                    sektionen skjuts det främre ned, så att bandet ovanför
                    rymmer hela kampanjen — list, namn, status och
                    stapelrad. */}
                <div className="relative z-10 lg:[transform:rotateX(7deg)_rotateY(-13deg)_rotateZ(0.5deg)]">
                  <IdagFonster />
                </div>

                {/* Bakre: kampanjen. Vanligt block under Idag på mobil;
                    från lg lyfts den ur flödet, bakom och uppe till
                    höger, så att den sticker ut som ett andra djup.

                    Förskjutningen uppåt är tilltagen så att bandet ovanför
                    Idag-fönstret rymmer list, kampanjnamn, status och en
                    bit av stapelraden. Låg den närmare syntes bara en
                    titelrad, och då är det inget fönster — bara en kant. */}
                {/* Ingen translateZ här. Den drar elementet mot
                    perspektivets origo — wrapperns mitt — och när wrappern
                    växte hamnade kampanjfönstret rakt bakom Idag i stället
                    för ovanför. Djupet bärs av z-index, skuggan och att
                    rotationen är kraftigare än det främre fönstrets. */}
                <div className="mt-5 lg:absolute lg:top-0 lg:right-[-6%] lg:z-0 lg:mt-0 lg:w-[62%] lg:[transform:rotateX(9deg)_rotateY(-16deg)_rotateZ(1.6deg)_scale(0.96)]">
                  <KampanjFonster />
                </div>

                {/* Handskriven notering. Står ovanför Idag-fönstrets
                    övre vänstra hörn och pekar ned och in mot det
                    rekommenderade nästa steget — utanför fönstret, så
                    den aldrig lägger sig över texten. Bara från lg,
                    där det finns marginal att ställa den i. */}
                <div
                  aria-hidden
                  className="pointer-events-none absolute left-[-3%] top-[4.5rem] z-20 hidden items-start gap-1 lg:flex"
                >
                  <span className="whitespace-nowrap text-[17px] italic leading-none text-text-secondary [font-family:var(--font-cormorant)]">
                    Det viktigaste först.
                  </span>
                  <svg
                    width="38"
                    height="46"
                    viewBox="0 0 38 46"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth={1.3}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="-mt-1 text-text-tertiary"
                  >
                    <path d="M2 3c13 3 22 13 25 28" />
                    <path d="M19 30l9 3 1-8" />
                  </svg>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ── Så fungerar det ─────────────────────────────────
            Lugn med flit: hjälten gör det visuella jobbet. Hierarkin
            ligger i storlek och luft, inte i kort och ikoner. */}
        <section id="sa-fungerar-det" className="scroll-mt-16 bg-surface-sunken">
          <div className="mx-auto w-full max-w-6xl px-5 py-24 sm:px-8 sm:py-28 lg:px-10 lg:py-32">
            <div className="max-w-2xl">
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-primary">
                Så fungerar det
              </p>
              <h2 className="mt-5 text-[clamp(1.6rem,3.2vw,2.35rem)] font-semibold leading-[1.15] tracking-[-0.018em]">
                Tre steg, i den ordning arbetet faktiskt sker.
              </h2>
            </div>

            <ol className="mt-16 grid gap-12 sm:grid-cols-3 sm:gap-10 lg:mt-20 lg:gap-16">
              {STEG.map((s, i) => (
                <li key={s.rubrik}>
                  <span className="block text-[clamp(1.75rem,2.6vw,2.15rem)] font-semibold leading-none tabular-nums text-primary/35">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <div className="mt-5 border-t border-border-strong pt-5">
                    <h3 className="text-[clamp(1.05rem,1.5vw,1.2rem)] font-medium leading-snug tracking-tight">
                      {s.rubrik}
                    </h3>
                    <p className="mt-3 text-[15px] leading-relaxed text-text-secondary">
                      {s.text}
                    </p>
                  </div>
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* ── Avslut ──────────────────────────────────────────
            Kort. Ett påstående och en knapp. */}
        <section className="border-t border-border">
          <div className="mx-auto w-full max-w-6xl px-5 py-20 sm:px-8 sm:py-24 lg:px-10">
            <div className="flex flex-col gap-8 sm:flex-row sm:items-end sm:justify-between">
              <p className="max-w-lg text-[clamp(1.4rem,2.8vw,1.9rem)] font-semibold leading-[1.2] tracking-[-0.015em]">
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

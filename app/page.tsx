// ─────────────────────────────────────────────────────────────
// Landningssidan.
//
// Löftet är beslutet, inte texterna. Den gamla sidan sålde fem inlägg
// och ett nyhetsbrev varje måndag — en volymutfästelse som vem som
// helst med ChatGPT kan matcha. Det produkten är värd står i VISION.md:
// "Här är vad ditt företag bör göra härnäst inom marknadsföring — och
// varför." Rubriken säger det nu, och produktbilden visar det.
//
// Fyra block, inte tolv: hjälte, produktbild, så fungerar det, avslut.
// Ingen funktionskatalog — vi säljer inte en påse verktyg. Inga
// kundlogotyper, inga omdömen, inga siffror om resultat eller antal
// användare. Vi har noll användare; allt sådant vore påhittat.
//
// Luften gör jobbet. Inga gradienter, ingen glöd, inga badges, ingen
// emoji. Emerald förekommer på knappen, i lutningens skugga och i en
// enda ram — inte som yta.
//
// Produktbilden lutar på desktop med ren CSS-transform. Det är enda
// stället på hela sidan med perspektiv, och den rätas upp helt under
// lg: en lutad bild på 375px är bara svårläst.
// ─────────────────────────────────────────────────────────────
import Link from "next/link";
import { ButtonLink } from "@/app/_shared/primitives";
import ProduktPreview from "@/app/_marketing/ProduktPreview";

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
      <header className="sticky top-0 z-20 border-b border-border bg-background/85 backdrop-blur">
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
            {/* Knappen ryms även på 375px, så den står kvar där. Den låg
                först bakom `hidden sm:inline-flex`, men ButtonLink sätter
                redan sin egen display-utility och de två hamnar i samma
                lager — vilken som vann avgjordes av ordningen i den
                genererade CSS:en, inte av avsikten. */}
            <ButtonLink href="/login?mode=signup" size="sm">
              Kom igång
            </ButtonLink>
          </div>
        </div>
      </header>

      <main className="flex-1">
        {/* ── Hjälte ──────────────────────────────────────────
            Vänsterställd i en smal spalt. Centrerad hjälte över hela
            bredden är formatet varenda mall använder; den här sidan ska
            inte se ut som en mall. */}
        <section className="mx-auto w-full max-w-6xl px-5 pb-4 pt-16 sm:px-8 sm:pt-24 lg:px-10 lg:pt-28">
          <h1 className="max-w-3xl text-[clamp(2.1rem,5.2vw,3.5rem)] font-semibold leading-[1.08] tracking-[-0.02em]">
            En tydligare väg framåt
            <br className="hidden sm:block" />{" "}
            för din marknadsföring.
          </h1>

          <p className="mt-6 max-w-xl text-[clamp(1rem,1.6vw,1.15rem)] leading-relaxed text-text-secondary">
            Marketing Copilot lär känna ditt företag, prioriterar vad som är viktigast och
            hjälper dig genomföra det — steg för steg.
          </p>

          <div className="mt-9 flex flex-col gap-3 sm:flex-row sm:items-center">
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
        </section>

        {/* ── Produktbild ─────────────────────────────────────
            overflow-hidden på sektionen, inte på bilden: rotateY skjuter
            ut hörnen några pixlar, och utan spärren ger det vågrät
            rullning på smala skärmar. */}
        <section className="overflow-hidden pb-20 pt-10 sm:pb-24 lg:pb-28 lg:pt-16">
          <div className="mx-auto w-full max-w-5xl px-5 sm:px-8 lg:px-10">
            <div className="relative">
              {/* Handskriven notering — sidans enda. Kursiv Geist och en
                  ritad pil; ingen ny typsnittsberoende för ett element.
                  Bara från lg, där det finns marginal att ställa den i. */}
              <div
                aria-hidden
                className="pointer-events-none absolute -top-2 left-0 z-10 hidden -translate-x-[58%] -translate-y-full items-end gap-1 lg:flex"
              >
                <span className="whitespace-nowrap text-[16px] italic leading-none text-text-tertiary [font-family:var(--font-cormorant)]">
                  Det viktigaste först.
                </span>
                <svg
                  width="46"
                  height="34"
                  viewBox="0 0 46 34"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={1.3}
                  strokeLinecap="round"
                  className="mb-[-6px] text-border-strong"
                >
                  <path d="M2 2c10 14 22 22 39 26" strokeDasharray="0" />
                  <path d="M33 30l8 -1 -3 -7" />
                </svg>
              </div>

              {/* Lutningen. Statisk transform — ingen animation, inget
                  bibliotek, ingenting att räkna om vid scroll. Rätas upp
                  helt under lg. */}
              <div className="[transform:none] lg:[transform:perspective(1800px)_rotateX(6deg)_rotateY(-7deg)_rotateZ(0.4deg)]">
                <ProduktPreview />
              </div>
            </div>
          </div>
        </section>

        {/* ── Så fungerar det ─────────────────────────────────
            Siffror och text. Inga ikoner, inga kort — tre kolumner luft
            med en tunn linje över varje. */}
        <section
          id="sa-fungerar-det"
          className="scroll-mt-16 border-t border-border bg-surface-sunken"
        >
          <div className="mx-auto w-full max-w-6xl px-5 py-20 sm:px-8 sm:py-24 lg:px-10">
            <h2 className="max-w-xl text-[clamp(1.5rem,3vw,2rem)] font-semibold leading-tight tracking-[-0.015em]">
              Så fungerar Marketing Copilot
            </h2>

            <ol className="mt-12 grid gap-10 sm:grid-cols-3 sm:gap-8 lg:gap-12">
              {STEG.map((s, i) => (
                <li key={s.rubrik} className="border-t border-border-strong pt-5">
                  <span className="text-[13px] font-semibold tabular-nums text-primary">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <h3 className="mt-3 text-[17px] font-medium leading-snug tracking-tight">
                    {s.rubrik}
                  </h3>
                  <p className="mt-2.5 text-[14px] leading-relaxed text-text-secondary">
                    {s.text}
                  </p>
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
              <ButtonLink href="/login?mode=signup" className="shrink-0 justify-center sm:justify-start">
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

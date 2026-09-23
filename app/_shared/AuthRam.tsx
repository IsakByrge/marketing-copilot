// ─────────────────────────────────────────────────────────────
// Ramen runt hela inloggningsflödet: /login, /auth/reset och
// /auth/callback.
//
// Tvåspalt på desktop, en spalt på telefon. Vänster är formulärets och
// ingenting annats; höger är en lugn emeraldyta med ett påstående om
// produkten.
//
// Högerspalten stod tidigare full av exempelkort — en hel veckoplan
// att läsa igenom bredvid två fält man kom hit för att fylla i. Den
// konkurrerade med formuläret och sålde dessutom fel sak. Nu är den
// nästan tom: en mening, en tunn linje, ett ordmärke. Ytan ska ge
// produktkänsla, inte vara en annons.
//
// Inget omdöme, inget namn, inget företag, ingen siffra — vi har inga
// kunder att citera, och påhittade vore värre än inga. Se VISION.md.
//
// Under lg försvinner högerspalten helt. På telefon är skärmen
// formulärets; ett budskap man måste scrolla förbi för att logga in
// är i vägen.
//
// Ramen har inga hookar, så den fungerar både i serverkomponenten
// /login och i klientsidorna /auth/reset och /auth/callback. Den rör
// aldrig inloggningslogiken — den ligger i LoginForm.
// ─────────────────────────────────────────────────────────────
import Link from "next/link";

export default function AuthRam({ children }: { children: React.ReactNode }) {
  return (
    <div className="app-light min-h-svh bg-background font-sans text-text-primary lg:grid lg:grid-cols-[1fr_0.85fr] xl:grid-cols-2">
      {/* ── Formuläret ──────────────────────────────────────── */}
      <div className="flex min-h-svh flex-col px-5 py-8 sm:px-10 lg:px-14 lg:py-12">
        <Link
          href="/"
          className="inline-flex items-center gap-2.5 self-start rounded text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
        >
          <span
            aria-hidden
            className="flex h-7 w-7 items-center justify-center rounded bg-primary text-sm font-medium text-white"
          >
            M
          </span>
          <span className="text-sm font-medium tracking-tight">Marketing Copilot</span>
        </Link>

        {/* Formuläret hamnar en bit ned men inte mitt på: en fältruta
            som sitter vertikalt centrerad hoppar när ett felmeddelande
            dyker upp. */}
        <main className="mt-16 w-full max-w-sm lg:mt-24">{children}</main>
      </div>

      {/* ── Emeraldytan ─────────────────────────────────────── */}
      <aside className="relative hidden overflow-hidden bg-primary px-14 py-14 lg:flex lg:flex-col lg:justify-between">
        {/* Enda dekorationen: en mjuk ljuskägla i övre hörnet, så den
            stora ytan inte blir en platt färgplatta. Ingen gradientfest,
            ingen glöd, inget mönster. */}
        <div
          aria-hidden
          className="pointer-events-none absolute -right-24 -top-24 h-[28rem] w-[28rem] rounded-full"
          style={{
            background:
              "radial-gradient(circle, rgba(255,255,255,0.10) 0%, rgba(255,255,255,0) 70%)",
          }}
        />

        <div className="relative" />

        <p className="relative max-w-md text-[clamp(1.5rem,2.3vw,2rem)] font-medium leading-[1.25] tracking-[-0.015em] text-white">
          Marknadsföring blir enklare när nästa steg är tydligt.
        </p>

        <div className="relative">
          <div aria-hidden className="mb-5 h-px w-12 bg-white/25" />
          <p className="text-[13px] leading-relaxed text-white/70">
            Marketing Copilot — din marknadschef i verktygsform.
          </p>
        </div>
      </aside>
    </div>
  );
}

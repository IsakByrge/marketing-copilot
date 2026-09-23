// ─────────────────────────────────────────────────────────────
// Ramen runt hela inloggningsflödet: /login, /auth/reset och
// /auth/callback.
//
// Tvåspalt på desktop, en spalt på telefon. Vänster är formulärets och
// ingenting annats; höger är en lugn emeraldyta med ett påstående om
// produkten.
//
// Högerspalten stod först full av exempelkort — en hel veckoplan att
// läsa igenom bredvid två fält man kom hit för att fylla i. Sedan blev
// den en platt grön rektangel, vilket var tystare men också dödare.
// Nu bär den samma språk som landningssidans hjälte: emerald i botten,
// två mycket svaga varma toner ovanpå och en enda stor organisk form i
// kontur. Ingen gradientfest, ingen glöd — formerna ska ge ytan djup,
// inte mönster.
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
    <div className="app-light min-h-svh bg-background font-sans text-text-primary lg:grid lg:grid-cols-[1fr_0.9fr] xl:grid-cols-2">
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
      <aside className="relative hidden overflow-hidden bg-primary lg:flex lg:flex-col lg:justify-center lg:px-14 lg:py-14">
        {/* Varm ljuskägla uppe till höger — samma papperston som
            bakgrunden på den ljusa sidan, så ytorna hör ihop. */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              "radial-gradient(58% 48% at 82% 14%, rgba(250,247,241,0.16) 0%, rgba(250,247,241,0) 68%)",
          }}
        />
        {/* Djup nedtill vänster, så ytan inte blir platt. */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              "radial-gradient(60% 55% at 8% 92%, rgba(10,52,42,0.45) 0%, rgba(10,52,42,0) 70%)",
          }}
        />
        {/* En enda organisk form, bara som kontur. Den ska anas. */}
        <div
          aria-hidden
          className="pointer-events-none absolute -right-28 top-[18%] h-[26rem] w-[26rem] rounded-[58%_42%_47%_53%/44%_52%_48%_56%] border border-white/10"
        />

        {/* Bara påståendet. Raden under sa "din marknadschef i
            verktygsform" och blev en andra röst bredvid den första;
            budskapet bär sig självt. Linjen är kvar som ett litet märke
            som inleder det. */}
        <div className="relative max-w-md">
          <div aria-hidden className="mb-7 h-px w-12 bg-white/30" />
          <p className="text-[clamp(1.55rem,2.4vw,2.05rem)] font-medium leading-[1.24] tracking-[-0.015em] text-white">
            Marknadsföring blir enklare
            <br />
            när nästa steg är tydligt.
          </p>
        </div>
      </aside>
    </div>
  );
}

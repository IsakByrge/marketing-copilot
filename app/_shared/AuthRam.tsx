// ─────────────────────────────────────────────────────────────
// Ramen runt hela inloggningsflödet: /login, /auth/reset och
// /auth/callback.
//
// Tidigare låg formuläret mitt på en tom yta. Det fungerade, men sa
// ingenting — en besökare som just klickat "Kom igång" möttes av ett
// tomrum. Nu står formuläret vänsterställt högt upp till vänster, och
// till höger ligger produktens löfte med samma exempelkort som
// startsidan visar.
//
// Högerspalten är dold under lg. På telefon är skärmen formulärets, och
// ett löfte man måste scrolla förbi för att logga in är i vägen.
//
// Ingen dekoration: ingen gradient, ingen glöd, inga ikoner. Ytan är
// emerald i full styrka, texten vit.
//
// Ramen har inga hookar, så den fungerar både i serverkomponenten
// /login och i klientsidorna /auth/reset och /auth/callback.
// ─────────────────────────────────────────────────────────────
import Link from "next/link";
import VeckansBrada from "./VeckansBrada";

export default function AuthRam({ children }: { children: React.ReactNode }) {
  return (
    <div className="app-light min-h-svh bg-background font-sans text-text-primary lg:grid lg:grid-cols-2">
      <div className="flex min-h-svh flex-col px-5 py-8 sm:px-10 lg:min-h-svh lg:px-14 lg:py-12">
        <Link href="/" className="flex items-center gap-2.5 self-start text-text-primary">
          <span
            aria-hidden
            className="flex h-7 w-7 items-center justify-center rounded bg-primary text-sm font-medium text-white"
          >
            M
          </span>
          <span className="text-sm font-medium">Marketing Copilot</span>
        </Link>

        <main className="mt-14 w-full max-w-sm lg:mt-20">{children}</main>
      </div>

      <aside className="hidden bg-primary px-14 py-12 lg:flex lg:flex-col lg:justify-center">
        <div className="max-w-xl">
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-white/70">
            Varje måndag
          </p>
          <p className="mt-4 text-[clamp(1.35rem,2.2vw,1.75rem)] font-semibold leading-[1.25] tracking-tight text-white">
            Fem inlägg och ett nyhetsbrev, skrivna utifrån vad ditt företag gör.
          </p>
          <div className="mt-8">
            {/* Markerat som exempel har ocksa. Texten ar pahittad, och
                det ska sta nagonstans aven nar ingen fragar. */}
            <p className="mb-3 text-xs text-white/70">Exempel</p>
            <VeckansBrada ton="mork" kompakt />
          </div>
        </div>
      </aside>
    </div>
  );
}

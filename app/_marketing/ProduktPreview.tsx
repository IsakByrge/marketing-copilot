// ─────────────────────────────────────────────────────────────
// Produktbild för den publika startsidan.
//
// LIGGER I _marketing MED FLIT. Allt här är påhittad demonstrations-
// data för besökare som inte loggat in. Ingenting i den här filen får
// importeras av en inloggad yta, och den läser aldrig någon användares
// data. Katalogen är gränsen: ser du den här filen importerad från
// app/dashboard, app/campaigns eller någon annan produktsida är något
// fel.
//
// Den lilla kampanjgrafen längst ned är en BILD, inte en funktion. Vi
// planerar att kunna jämföra kampanjkörningar längre fram; den
// funktionen finns inte, och den här svg:n är inte en förövning till
// den. Den står här för att visa vad produkten handlar om — beslut och
// uppföljning — inte för att antyda att något mäts i dag.
//
// Ytorna är hämtade ur den riktiga produkten: veckans fokus,
// rekommenderat nästa steg med sin motivering, På radarn, och en
// kampanj med status. Därför känns bilden igen efter inloggning.
//
// Hela bilden är märkt "Exempel" och har ett aria-label i stället för
// att läsas upp fält för fält — påhittade siffror upplästa som fakta
// hjälper ingen.
// ─────────────────────────────────────────────────────────────

/** Veckoetikett + rubrik, som raderna under "På radarn" på Idag. */
const RADAR = [
  { nar: "Denna vecka", vad: "Första riktiga kylan i Småland" },
  { nar: "Nästa vecka", vad: "Höstlovet — fler hemma på dagtid" },
  { nar: "Om 3 veckor", vad: "Säsongsstart för terrassvärmare" },
];

/** Fyra körningar, bara som stapelhöjder. Inga tal, inga axlar.
 *  Höjderna skiljer sig tydligt med flit: ligger de för nära varandra
 *  läses staplarna som laddningsplatshållare i stället för ett utfall. */
const STAPLAR = [30, 56, 43, 85];

function Etikett({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-text-tertiary">
      {children}
    </p>
  );
}

export default function ProduktPreview() {
  return (
    <div
      role="img"
      aria-label="Exempelbild av Marketing Copilot: veckans fokus, ett rekommenderat nästa steg med motivering, kommande händelser och en pågående kampanj."
      className="overflow-hidden rounded-xl border border-border bg-surface shadow-md"
    >
      {/* Fönsterlist — antyder app utan att rita en webbläsare. */}
      <div className="flex items-center gap-2 border-b border-border bg-surface-sunken px-4 py-2.5">
        <span aria-hidden className="flex h-5 w-5 items-center justify-center rounded bg-primary text-[10px] font-medium text-white">
          M
        </span>
        <span className="text-[11px] font-medium text-text-secondary">Idag</span>
        <span className="ml-auto rounded-full border border-border-strong bg-surface px-2 py-0.5 text-[10px] text-text-tertiary">
          Exempel
        </span>
      </div>

      <div className="p-4 sm:p-6">
        {/* ── Veckans fokus ──────────────────────────────── */}
        <Etikett>Vecka 39 · God morgon, Isak</Etikett>
        <p className="mt-2 max-w-md text-[15px] font-semibold leading-snug tracking-tight sm:text-lg">
          Inför kylan: lyft terrassvärmare och gasol till dem som redan handlat hos er.
        </p>

        {/* ── Rekommenderat nästa steg ───────────────────── */}
        <div className="mt-5 rounded-lg border border-primary/30 bg-surface p-3.5 sm:p-4">
          <div className="flex gap-2.5">
            <svg aria-hidden width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className="mt-0.5 shrink-0 text-primary">
              <path d="M5 12h14M13 6l6 6-6 6" />
            </svg>
            <div className="min-w-0">
              <p className="text-[13px] font-semibold leading-snug sm:text-sm">
                Lägg in resultat för Höstkampanj Växjö
              </p>
              <p className="mt-1 text-[12px] leading-relaxed text-text-secondary sm:text-[13px]">
                Kampanjen slutar om 3 dagar och du har inte lagt in några resultat.
              </p>
              <span className="mt-3 inline-flex rounded bg-primary px-2.5 py-1.5 text-[11px] font-medium text-white">
                Öppna kampanjen
              </span>
            </div>
          </div>
        </div>

        {/* ── På radarn + kampanj ────────────────────────── */}
        <div className="mt-5 grid gap-5 sm:grid-cols-[1.1fr_0.9fr] sm:gap-6">
          <div>
            <Etikett>På radarn</Etikett>
            <ul className="mt-2 border-t border-border">
              {RADAR.map((r) => (
                <li key={r.vad} className="flex gap-3 border-b border-border py-2">
                  <span className="w-20 shrink-0 text-[11px] text-text-tertiary">{r.nar}</span>
                  <span className="text-[12px] leading-snug">{r.vad}</span>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <Etikett>Höstkampanj Växjö</Etikett>
            <div className="mt-2 rounded-lg border border-border bg-surface-sunken p-3">
              <div className="flex items-center gap-2">
                <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-primary" />
                <span className="text-[11px] font-medium">Pågår · dag 25 av 28</span>
              </div>

              {/* Kampanjgrafen: fyra körningar som staplar. Ren dekor —
                  inga tal, inga axlar, ingenting att avläsa. */}
              <div aria-hidden className="mt-3 flex h-16 items-end gap-2">
                {STAPLAR.map((h, i) => (
                  <div
                    key={i}
                    style={{ height: `${h}%` }}
                    className={
                      "w-full max-w-[26px] rounded-[3px] " +
                      (i === STAPLAR.length - 1 ? "bg-primary" : "bg-primary/25")
                    }
                  />
                ))}
              </div>
              <p className="mt-2 text-[10px] leading-relaxed text-text-tertiary">
                Fyra körningar av samma strategi
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Produktbild för den publika startsidan — två överlappande fönster.
//
// LIGGER I _marketing MED FLIT. Allt här är påhittad demonstrations-
// data för besökare som inte loggat in. Ingenting i den här filen får
// importeras av en inloggad yta, och den läser aldrig någon användares
// data. Katalogen är gränsen: ser du den här filen importerad från
// app/dashboard, app/campaigns eller någon annan produktsida är något
// fel.
//
// Kampanjfönstrets stapelrad är en BILD, inte en funktion. Vi planerar
// att kunna jämföra kampanjkörningar längre fram; den funktionen finns
// inte, och den här raden är inte en förövning till den. Inga tal,
// inga axlar, aria-hidden.
//
// Ett enda kort räckte inte: det läste som vilken dashboard-mall som
// helst. Två fönster som ligger på olika djup säger i stället att det
// finns en produkt bakom bilden — Idag är det man står i, kampanjen
// ligger bakom och väntar. Främre fönstret bär beslutet, bakre bär
// utfallet.
//
// Ytorna är hämtade ur den riktiga produkten: veckans fokus,
// rekommenderat nästa steg med sin motivering, På radarn, och en
// kampanj med status. Därför känns bilden igen efter inloggning.
//
// Perspektivet sitter på wrappern i page.tsx, inte här. Den här filen
// vet ingenting om lutning — den ritar två fönster, och sidan bestämmer
// hur de står.
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

/** Fönsterlist — antyder app utan att rita en webbläsare. */
function List({ titel, markt }: { titel: string; markt?: boolean }) {
  return (
    <div className="flex items-center gap-2 border-b border-border bg-surface-sunken px-3.5 py-2.5">
      <span
        aria-hidden
        className="flex h-5 w-5 items-center justify-center rounded bg-primary text-[10px] font-medium text-white"
      >
        M
      </span>
      <span className="text-[11px] font-medium text-text-secondary">{titel}</span>
      {markt && (
        <span className="ml-auto rounded-full border border-border-strong bg-surface px-2 py-0.5 text-[10px] text-text-tertiary">
          Exempel
        </span>
      )}
    </div>
  );
}

/* ── Främre fönstret: Idag ──────────────────────────────── */

export function IdagFonster() {
  return (
    <div className="overflow-hidden rounded-xl border border-border bg-surface shadow-[0_24px_60px_-24px_rgba(17,17,17,0.22)]">
      <List titel="Idag" markt />

      <div className="p-4 sm:p-5">
        <Etikett>Vecka 39 · God morgon, Isak</Etikett>
        <p className="mt-2 text-[15px] font-semibold leading-snug tracking-tight">
          Inför kylan: lyft terrassvärmare och gasol till dem som redan handlat hos er.
        </p>

        {/* Rekommenderat nästa steg — det annotationen pekar på. */}
        <div
          id="preview-nasta-steg"
          className="mt-4 rounded-lg border border-primary/30 bg-surface p-3.5"
        >
          <div className="flex gap-2.5">
            <svg
              aria-hidden
              width="15"
              height="15"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={1.8}
              strokeLinecap="round"
              strokeLinejoin="round"
              className="mt-0.5 shrink-0 text-primary"
            >
              <path d="M5 12h14M13 6l6 6-6 6" />
            </svg>
            <div className="min-w-0">
              <p className="text-[13px] font-semibold leading-snug">
                Lägg in resultat för Höstkampanj Växjö
              </p>
              <p className="mt-1 text-[12px] leading-relaxed text-text-secondary">
                Kampanjen slutar om 3 dagar och du har inte lagt in några resultat.
              </p>
              <span className="mt-3 inline-flex rounded bg-primary px-2.5 py-1.5 text-[11px] font-medium text-white">
                Öppna kampanjen
              </span>
            </div>
          </div>
        </div>

        <div className="mt-4">
          <Etikett>På radarn</Etikett>
          <ul className="mt-2 border-t border-border">
            {RADAR.map((r) => (
              <li key={r.vad} className="flex gap-3 border-b border-border py-2 last:border-0">
                <span className="w-[4.5rem] shrink-0 text-[11px] text-text-tertiary">{r.nar}</span>
                <span className="text-[12px] leading-snug">{r.vad}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}

/* ── Bakre fönstret: kampanjen ──────────────────────────── */

export function KampanjFonster() {
  return (
    <div className="overflow-hidden rounded-xl border border-border bg-surface shadow-[0_18px_44px_-20px_rgba(17,17,17,0.18)]">
      <List titel="Kampanjer" />

      {/* Kompakt med flit. På desktop ligger fönstret bakom Idag, och
          bara bandet ovanför syns — får namn, status och stapelrad inte
          plats där uppe syns ingen kampanj alls, bara en titelrad. */}
      <div className="px-4 py-3">
        <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
          <span className="flex items-center gap-2 text-[12px] font-medium">
            <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-primary" />
            Höstkampanj Växjö
          </span>
          <span className="text-[11px] text-text-tertiary">Pågår · dag 25 av 28</span>
        </div>

        {/* Stapelraden: ren dekor, inget att avläsa. */}
        <div aria-hidden className="mt-3 flex h-16 items-end gap-2">
          {STAPLAR.map((h, i) => (
            <div
              key={i}
              style={{ height: `${h}%` }}
              className={
                "w-full max-w-[30px] rounded-[3px] " +
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
  );
}

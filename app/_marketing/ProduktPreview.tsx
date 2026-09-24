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
// Fönstren visar bara sådant produkten faktiskt har. Sidomenyn är vår
// riktiga meny i rätt ordning, ytorna är Idag och Kampanjer, och
// innehållet är veckans fokus, rekommenderat nästa steg med sin
// motivering, På radarn, samt en kampanj med status.
//
// INGA MÄTVÄRDEN. Målbilden visar räckvidd, procenttal och
// annonssiffror i kampanjfönstret. Produkten har noll integrationer
// och mäter ingenting — de siffrorna vore påhittade, och VISION.md
// förbjuder dem. Kampanjen får därför namn, status och den abstrakta
// stapelraden, ingenting mer. Stapelraden är en BILD, inte en
// funktion: inga tal, inga axlar, aria-hidden.
//
// Perspektivet sitter på wrappern i page.tsx, inte här. Den här filen
// vet ingenting om lutning — den ritar två fönster, och sidan bestämmer
// hur de står.
// ─────────────────────────────────────────────────────────────
import {
  IconToday, IconContent, IconPencil, IconSparkle, IconCampaigns, IconHistory,
} from "@/app/_shared/icons";

/** Vår riktiga meny, i AppShells ordning. De sex första får plats. */
const MENY = [
  { namn: "Idag", ikon: IconToday, aktiv: true },
  { namn: "Innehåll", ikon: IconContent },
  { namn: "Produkttexter", ikon: IconPencil },
  { namn: "Facebook", ikon: IconSparkle },
  { namn: "Kampanjer", ikon: IconCampaigns },
  { namn: "Historik", ikon: IconHistory },
];

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

/** Fönsterlist med trafikljus. Ren dekor — antyder app, ritar ingen
 *  webbläsare och lovar inget operativsystem. */
function List({ children }: { children?: React.ReactNode }) {
  return (
    <div className="flex items-center gap-3 border-b border-border bg-surface-sunken px-3.5 py-2.5">
      <span aria-hidden className="flex shrink-0 gap-1.5">
        <span className="h-2 w-2 rounded-full bg-border-strong" />
        <span className="h-2 w-2 rounded-full bg-border-strong" />
        <span className="h-2 w-2 rounded-full bg-border-strong" />
      </span>
      {children}
    </div>
  );
}

function Etikett({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[9px] font-semibold uppercase tracking-[0.14em] text-text-tertiary">
      {children}
    </p>
  );
}

/* ── Främre fönstret: Idag ──────────────────────────────── */

export function IdagFonster() {
  return (
    <div className="overflow-hidden rounded-xl border border-border bg-surface shadow-[0_30px_70px_-28px_rgba(17,17,17,0.26)]">
      <List>
        <span className="ml-auto rounded-full border border-border-strong bg-surface px-2 py-0.5 text-[9px] text-text-tertiary">
          Exempel
        </span>
      </List>

      <div className="flex">
        {/* Sidomenyn — vår riktiga, i rätt ordning. Dold på de smalaste
            skärmarna: där äter den bredd som texten behöver bättre. */}
        <div className="hidden w-[7.5rem] shrink-0 border-r border-border bg-surface-sunken/60 p-2.5 sm:block">
          <div className="mb-3 flex items-center gap-1.5 px-1.5">
            <span
              aria-hidden
              className="flex h-4 w-4 items-center justify-center rounded bg-primary text-[8px] font-medium text-white"
            >
              M
            </span>
            <span className="truncate text-[9px] font-medium">Marketing Copilot</span>
          </div>
          {MENY.map(({ namn, ikon: Ikon, aktiv }) => (
            <div
              key={namn}
              className={
                "mb-0.5 flex items-center gap-1.5 rounded px-1.5 py-1.5 text-[10px] " +
                (aktiv ? "bg-surface font-medium text-primary" : "text-text-tertiary")
              }
            >
              <Ikon size={11} />
              <span className="truncate">{namn}</span>
            </div>
          ))}
        </div>

        {/* Huvudytan */}
        <div className="min-w-0 flex-1 p-3.5 sm:p-4">
          <div className="flex items-baseline justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[15px] font-semibold leading-none tracking-tight">Idag</p>
              <p className="mt-1.5 text-[10px] text-text-tertiary">Måndag 22 september</p>
            </div>
            <span className="shrink-0 rounded border border-border px-2 py-1 text-[9px] text-text-secondary">
              Vecka 39
            </span>
          </div>

          {/* Veckans fokus */}
          <div className="mt-3.5 rounded-lg border border-primary/15 bg-primary/[0.05] p-3">
            <Etikett>Veckans fokus</Etikett>
            <p className="mt-1.5 text-[12px] font-semibold leading-snug">
              Inför kylan: lyft terrassvärmare och gasol
            </p>
            <p className="mt-1 text-[10px] leading-relaxed text-text-secondary">
              Rikta veckan mot dem som redan handlat hos er och vet vad de vill ha.
            </p>
          </div>

          <div className="mt-3.5 grid gap-3.5 sm:grid-cols-[1.15fr_0.85fr]">
            {/* Rekommenderat nästa steg — det annotationen pekar på. */}
            <div>
              <Etikett>Rekommenderat nästa steg</Etikett>
              <div className="mt-1.5 rounded-lg border border-border bg-surface p-2.5">
                <p className="text-[11px] font-semibold leading-snug">
                  Lägg in resultat för Höstkampanj Växjö
                </p>
                <p className="mt-1 text-[10px] leading-relaxed text-text-secondary">
                  Kampanjen slutar om 3 dagar och du har inte lagt in några resultat.
                </p>
                <span className="mt-2.5 inline-flex rounded bg-primary px-2 py-1 text-[9px] font-medium text-white">
                  Öppna kampanjen
                </span>
              </div>
            </div>

            {/* På radarn */}
            <div>
              <Etikett>På radarn</Etikett>
              <ul className="mt-1.5 space-y-1.5">
                {RADAR.map((r) => (
                  <li key={r.vad} className="flex gap-1.5">
                    <span
                      aria-hidden
                      className="mt-[5px] h-1 w-1 shrink-0 rounded-full bg-primary/50"
                    />
                    <span className="min-w-0">
                      <span className="block text-[10px] leading-snug">{r.vad}</span>
                      <span className="block text-[9px] text-text-tertiary">{r.nar}</span>
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── Bakre fönstret: kampanjen ──────────────────────────── */

export function KampanjFonster() {
  return (
    <div className="overflow-hidden rounded-xl border border-border bg-surface shadow-[0_22px_50px_-22px_rgba(17,17,17,0.2)]">
      <List>
        <span className="text-[10px] font-medium text-text-secondary">Kampanjer</span>
      </List>

      <div className="p-3.5">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <span className="text-[12px] font-medium">Höstkampanj Växjö</span>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-2 py-0.5 text-[9px] font-medium text-primary">
            <span aria-hidden className="h-1 w-1 rounded-full bg-primary" />
            Pågår
          </span>
        </div>
        <p className="mt-1 text-[10px] text-text-tertiary">Dag 25 av 28</p>

        {/* Stapelraden: ren dekor, inget att avläsa. */}
        <div aria-hidden className="mt-3 flex h-14 items-end gap-2">
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
        <p className="mt-2 text-[9px] leading-relaxed text-text-tertiary">
          Fyra körningar av samma strategi
        </p>
      </div>
    </div>
  );
}

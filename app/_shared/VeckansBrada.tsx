"use client";

// ─────────────────────────────────────────────────────────────
// Veckans plan som en bräda: fem kort, ett per dag måndag till fredag.
//
// Ersätter det enda roterande exempelkortet. Ett kort visade att
// verktyget kan skriva en text. Bräden visar vad man faktiskt får —
// en hel vecka, med olika roller på olika dagar — och det är det
// produkten säljer.
//
// Flikarna byter bransch. Bytet sker också av sig självt var tionde
// sekund, men bara tills besökaren väljer själv: den som har tagit ett
// beslut ska inte få det överkört några sekunder senare.
//
// Texterna är påhittade men skrivna i appens ton: inga utropstecken,
// inga siffror utan täckning, inga kundcitat, inga riktiga företag.
// Gasolveckan följer säkerhetsregeln — utrustningen lämnas till
// personalen, läsaren får aldrig ett råd om vad hen ska göra med den.
// ─────────────────────────────────────────────────────────────
import { useEffect, useState } from "react";
import { cx } from "./primitives";

export interface Dagskort {
  dag: string;
  roll: string;
  rubrik: string;
  text: string;
  /** Sätts på ett kort per vecka. Alla inlägg länkar inte. */
  lank?: string;
}

export interface Vecka {
  bransch: string;
  dagar: Dagskort[];
}

export const VECKOR: Vecka[] = [
  {
    bransch: "Gasolhandel",
    dagar: [
      {
        dag: "Måndag", roll: "Säljande",
        rubrik: "Betala bara för det som faktiskt fylls",
        text: "Gasol i lösvikt betyder att du betalar för mängden som går i flaskan, inte för en hel ny.",
        lank: "Läs mer på webbplatsen",
      },
      {
        dag: "Tisdag", roll: "Tips",
        rubrik: "Vilken flaskstorlek räcker längst",
        text: "Husbilen, grillen och det lilla köket drar olika mycket. Vi går igenom vilken storlek som passar dig.",
      },
      {
        dag: "Onsdag", roll: "Produkt",
        rubrik: "Gasolgrillen tänds likadant varje gång",
        text: "Jämn värme och steglös reglering gör att maten blir som du tänkt dig, oavsett årstid.",
      },
      {
        dag: "Torsdag", roll: "Lokalt",
        rubrik: "Vi står kvar i Nyköping hela hösten",
        text: "Depån har öppet som vanligt genom höstmörkret. Kom förbi, så tar personalen hand om flaskan.",
      },
      {
        dag: "Fredag", roll: "Socialt",
        rubrik: "Vad lagar du helst utomhus?",
        text: "Vi är nyfikna på vad som hamnar på grillen när kvällarna blir kortare. Berätta i kommentarerna.",
      },
    ],
  },
  {
    bransch: "Frisör",
    dagar: [
      {
        dag: "Måndag", roll: "Säljande",
        rubrik: "Hösten är en bra tid att byta längd",
        text: "När sommaren har gjort sitt behöver topparna oftast kortas. En klippning nu håller formen hösten ut.",
        lank: "Boka tid",
      },
      {
        dag: "Tisdag", roll: "Tips",
        rubrik: "Slingor eller heltäckande färg",
        text: "Valet handlar mest om hur mycket du vill sköta hemma. Vi går igenom vad som håller längst.",
      },
      {
        dag: "Onsdag", roll: "Produkt",
        rubrik: "Balayage som växer ut utan skarp gräns",
        text: "Färgen läggs mjukare i övergången, så det dröjer längre innan ansatsen syns.",
      },
      {
        dag: "Torsdag", roll: "Lokalt",
        rubrik: "Vi finns kvar på hörnet vid torget",
        text: "Samma salong, samma personal. Titta in om du är i närheten, så hittar vi en tid.",
      },
      {
        dag: "Fredag", roll: "Socialt",
        rubrik: "Vilken frisyr har du burit längst?",
        text: "Vissa håller samma i tjugo år, andra byter varje säsong. Vi hör gärna vilken som är din.",
      },
    ],
  },
  {
    bransch: "Däckverkstad",
    dagar: [
      {
        dag: "Måndag", roll: "Säljande",
        rubrik: "Däckbytet går fortare före rusningen",
        text: "Första frostnatten fyller verkstaden på en dag. Bokar du nu väljer du tid själv.",
        lank: "Boka däckbyte",
      },
      {
        dag: "Tisdag", roll: "Tips",
        rubrik: "Dubbat eller odubbat för din körning",
        text: "Det beror på var du kör mest och på vilket underlag. Vi går igenom vad som passar.",
      },
      {
        dag: "Onsdag", roll: "Produkt",
        rubrik: "Däckhotell för den som saknar plats",
        text: "Vi förvarar sommardäcken till våren, tvättade och genomgångna innan de ställs in.",
      },
      {
        dag: "Torsdag", roll: "Lokalt",
        rubrik: "Verkstaden vid infarten har öppet hela hösten",
        text: "Kör in när det passar dig. Har du bokat tid står vi redo när du kommer.",
      },
      {
        dag: "Fredag", roll: "Socialt",
        rubrik: "Vart tar du bilen i höst?",
        text: "Vi hör gärna vart resan går när löven vänder. Berätta i kommentarerna.",
      },
    ],
  },
];

/** Hur länge en bransch står kvar — men bara tills besökaren väljer själv. */
const VAXLING_MS = 10000;
/** Fördröjning mellan korten när bräden tonar in. */
const STEG_MS = 80;

function Dagkort({ kort, ton, kompakt, index }: {
  kort: Dagskort; ton: "ljus" | "mork"; kompakt: boolean; index: number;
}) {
  const mork = ton === "mork";
  return (
    <article
      // fade-in ligger i globals.css och neutraliseras av
      // prefers-reduced-motion-blocket dar, sa trappan forsvinner helt
      // for den som bett om mindre rorelse.
      className={cx(
        "fade-in flex h-full flex-col rounded-lg border",
        kompakt ? "p-3.5" : "p-4 sm:p-5",
        mork ? "border-white/15 bg-white/10" : "border-border bg-surface",
      )}
      style={{ animationDelay: `${index * STEG_MS}ms` }}
    >
      <p className={cx(
        "text-[11px] font-semibold uppercase tracking-[0.1em]",
        mork ? "text-white/70" : "text-text-tertiary",
      )}>
        {kort.dag} · {kort.roll}
      </p>
      <h3 className={cx(
        "mt-2 font-medium leading-snug",
        kompakt ? "text-sm" : "text-[15px]",
        mork ? "text-white" : "text-text-primary",
      )}>
        {kort.rubrik}
      </h3>
      <p className={cx(
        "mt-1.5 line-clamp-3 leading-relaxed",
        kompakt ? "text-xs" : "text-[13px]",
        mork ? "text-white/85" : "text-text-secondary",
      )}>
        {kort.text}
      </p>
      {kort.lank && (
        // Text, inte en <a>. Inlagget ar ett exempel och leder ingenstans.
        <p className={cx(
          "mt-auto pt-3 underline underline-offset-4",
          kompakt ? "text-xs" : "text-[13px]",
          mork ? "text-white/80" : "text-text-secondary",
        )}>
          {kort.lank}
        </p>
      )}
    </article>
  );
}

export default function VeckansBrada({ ton = "ljus", kompakt = false }: {
  ton?: "ljus" | "mork"; kompakt?: boolean;
}) {
  const [index, setIndex] = useState(0);
  const [valtSjalv, setValtSjalv] = useState(false);
  const [pausad, setPausad] = useState(false);
  const mork = ton === "mork";

  useEffect(() => {
    if (valtSjalv || pausad) return;
    // Lases har och inte i state: den styr bara om en timer startar, och
    // da behovs varken hydrering eller en extra rendering.
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const id = setInterval(() => setIndex((i) => (i + 1) % VECKOR.length), VAXLING_MS);
    return () => clearInterval(id);
  }, [valtSjalv, pausad]);

  const vecka = VECKOR[index];

  return (
    <div
      onMouseEnter={() => setPausad(true)}
      onMouseLeave={() => setPausad(false)}
      onFocusCapture={() => setPausad(true)}
      onBlurCapture={() => setPausad(false)}
    >
      <div role="tablist" aria-label="Välj bransch" className="mb-4 flex flex-wrap gap-1.5">
        {VECKOR.map((v, i) => {
          const vald = i === index;
          return (
            <button
              key={v.bransch}
              type="button"
              role="tab"
              aria-selected={vald}
              onClick={() => { setValtSjalv(true); setIndex(i); }}
              className={cx(
                "inline-flex min-h-11 cursor-pointer items-center rounded-full border px-3.5 text-[13px] transition-colors sm:min-h-0 sm:py-1.5",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40",
                vald
                  ? (mork
                    ? "border-white/60 bg-white/15 font-medium text-white"
                    : "border-primary bg-primary/10 font-medium text-primary")
                  : (mork
                    ? "border-white/20 text-white/70 hover:border-white/40 hover:text-white"
                    : "border-border text-text-secondary hover:border-border-strong hover:text-text-primary"),
              )}
            >
              {v.bransch}
            </button>
          );
        })}
      </div>

      {/* key pa branschen: hela braden monteras om vid byte, sa
          intoningen och trappan spelas pa nytt. Det ar overtoningen. */}
      <div key={vecka.bransch}>
        {/* Mobil: vagrat svep. Fem staplade kort skulle gora hjalten
            dubbelt sa hog och trycka ner allt annat under vecket. */}
        <div className="-mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-2 sm:mx-0 sm:grid sm:grid-cols-2 sm:overflow-visible sm:px-0 sm:pb-0">
          {vecka.dagar.map((d, i) => (
            <div
              key={d.dag}
              className={cx(
                "w-[78vw] max-w-[280px] shrink-0 snap-start sm:w-auto sm:max-w-none sm:shrink",
                // Femte kortet lagger sig over bada spalterna, sa braden
                // blir 2-2-1 i stallet for en stel kolumn med ett hal.
                i === 4 && "sm:col-span-2",
              )}
            >
              <Dagkort kort={d} ton={ton} kompakt={kompakt} index={i} />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

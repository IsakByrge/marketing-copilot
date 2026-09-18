"use client";

// ─────────────────────────────────────────────────────────────
// Ett exempelinlägg, satt som appens egna kort.
//
// Startsidan visade tidigare en stiliserad Idag-vy — en låtsasskärm.
// Den berättade hur gränssnittet ser ut, inte vad man får. Det här
// visar produkten i stället: ett färdigt inlägg, med dag, rubrik,
// brödtext och länk, i samma kort som appen använder på riktigt.
//
// Texterna är påhittade men skrivna i appens ton: inga utropstecken,
// inga siffror utan täckning, inga kundcitat och inga riktiga
// företagsnamn. Tre branscher, för att visa att det inte är en mall.
//
// Delas av startsidan och inloggningsflödet, så en besökare möter
// samma sak före och under inloggning.
// ─────────────────────────────────────────────────────────────
import { useEffect, useState } from "react";
import { cx } from "./primitives";

export interface Exempel {
  bransch: string;
  dag: string;
  rubrik: string;
  text: string;
  lank: string;
}

export const EXEMPEL: Exempel[] = [
  {
    bransch: "Gasolhandel",
    dag: "Måndag",
    rubrik: "Betala bara för det som faktiskt fylls",
    text:
      "Gasol i lösvikt betyder att du betalar för mängden som går i flaskan, inte för en hel ny. " +
      "Det passar dig med husbil, grill eller ett litet kök att hålla igång. Ta med flaskan till " +
      "depån så fyller vi medan du handlar klart.",
    lank: "Läs mer på webbplatsen",
  },
  {
    bransch: "Frisör",
    dag: "Onsdag",
    rubrik: "Hösten är en bra tid att byta längd",
    text:
      "När sommaren har gjort sitt brukar topparna behöva kortas. En klippning nu håller formen " +
      "genom hela hösten, och vi går igenom vad som fungerar med din hårtyp innan vi börjar.",
    lank: "Boka tid",
  },
  {
    bransch: "Däckverkstad",
    dag: "Fredag",
    rubrik: "Däckbytet går fortare om du bokar före rusningen",
    text:
      "Första frostnatten fyller verkstaden på en dag. Bokar du redan nu väljer du tid själv i " +
      "stället för att ta den som blir över. Vi förvarar sommardäcken till våren om du vill " +
      "slippa bära hem dem.",
    lank: "Boka däckbyte",
  },
];

/** Hur länge ett exempel står kvar innan nästa tar över. */
const VAXLING_MS = 6000;

/**
 * Kortet. `ton="mork"` sätter det på emeraldytan i inloggningsflödet;
 * samma uppbyggnad, bara inverterad palett.
 *
 * Länken är text, inte en <a>. Inlägget är ett exempel och leder
 * ingenstans — en klickbar länk som inte gör något är värre än ingen.
 */
export function ExempelKort({ post, ton = "ljus" }: { post: Exempel; ton?: "ljus" | "mork" }) {
  const mork = ton === "mork";
  return (
    <article
      className={cx(
        "rounded-lg border p-5 sm:p-6",
        mork ? "border-white/15 bg-white/10" : "border-border bg-surface",
      )}
    >
      <p className={cx(
        "text-xs font-semibold uppercase tracking-[0.12em]",
        mork ? "text-white/80" : "text-text-tertiary",
      )}>
        {post.dag}
      </p>
      <h3 className={cx(
        "mt-3 text-[17px] font-medium leading-snug sm:text-lg",
        mork ? "text-white" : "text-text-primary",
      )}>
        {post.rubrik}
      </h3>
      <p className={cx(
        "mt-2.5 text-sm leading-relaxed",
        mork ? "text-white/85" : "text-text-secondary",
      )}>
        {post.text}
      </p>
      <p className={cx(
        "mt-4 text-sm underline underline-offset-4",
        mork ? "text-white/80" : "text-text-secondary",
      )}>
        {post.lank}
      </p>
    </article>
  );
}

/**
 * Kortet som byter bransch.
 *
 * Växlingen stannar när man pekar på den och när systemet ber om mindre
 * rörelse — ett kort som byter text medan man läser är en sämre sida,
 * inte en livligare. Prickarna under gör samma byte manuellt, så den
 * som vill se en viss bransch slipper vänta.
 */
export function ExempelRotator({ ton = "ljus" }: { ton?: "ljus" | "mork" }) {
  const [index, setIndex] = useState(0);
  const [pausad, setPausad] = useState(false);
  const mork = ton === "mork";

  useEffect(() => {
    if (pausad) return;
    // Lases har och inte i state: den styr bara om en timer startar,
    // och da behovs varken hydrering eller omrendering.
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const id = setInterval(() => setIndex((i) => (i + 1) % EXEMPEL.length), VAXLING_MS);
    return () => clearInterval(id);
  }, [pausad]);

  const post = EXEMPEL[index];

  return (
    <div
      onMouseEnter={() => setPausad(true)}
      onMouseLeave={() => setPausad(false)}
      onFocusCapture={() => setPausad(true)}
      onBlurCapture={() => setPausad(false)}
    >
      {/* key gor att kortet monteras om vid byte, sa fade-in spelas pa
          nytt. Klassen neutraliseras av prefers-reduced-motion i
          globals.css, sa overtoningen forsvinner dar den ska. */}
      <div key={index} className="fade-in">
        <ExempelKort post={post} ton={ton} />
      </div>

      <div className="mt-4 flex items-center gap-1">
        {EXEMPEL.map((e, i) => (
          <button
            key={e.bransch}
            type="button"
            onClick={() => setIndex(i)}
            aria-label={`Visa exempel för ${e.bransch.toLowerCase()}`}
            aria-current={i === index ? "true" : undefined}
            className={cx(
              // px-2.5 kring en 24px-prick ger 44px bredd. Med px-2 blev
              // det 40 och traffytan foll igenom matningen pa bredden.
              "group inline-flex min-h-11 cursor-pointer items-center px-2.5 sm:min-h-0 sm:py-2",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40",
            )}
          >
            <span
              aria-hidden
              className={cx(
                "block h-1.5 w-6 rounded-full transition-colors",
                i === index
                  ? (mork ? "bg-white" : "bg-primary")
                  : (mork ? "bg-white/40 group-hover:bg-white/70" : "bg-border-strong group-hover:bg-text-tertiary"),
              )}
            />
          </button>
        ))}
        <span className={cx("ml-2 text-xs", mork ? "text-white/80" : "text-text-tertiary")}>
          {post.bransch}
        </span>
      </div>
    </div>
  );
}

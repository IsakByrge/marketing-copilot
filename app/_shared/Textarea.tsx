"use client";

// ─────────────────────────────────────────────────────────────
// Textrutan som växer med sitt innehåll.
//
// Bor i en egen fil, inte i primitives.tsx, av ett konkret skäl: den
// behöver useEffect och useRef, och primitives importeras av
// serverkomponenter (bland annat landningssidan). Hookar går inte där.
// useId är undantaget som redan fanns och får stanna.
//
// Rutan hade tidigare fast höjd. En mätning på 390px visade vad det
// betyder i praktiken: nedersta raden klipptes mitt i tecknen, så både
// /innehall och /company visade en remsa av halva bokstäver längst ner.
// Det ser trasigt ut, och det ser trasigt ut just där användaren ska
// läsa igenom sin egen text.
// ─────────────────────────────────────────────────────────────
import { useEffect, useRef, type ComponentPropsWithRef } from "react";
import { cx, fieldControlBase, fieldControlOk, fieldControlError } from "./primitives";

/**
 * Hur många rader rutan växer till innan den börjar scrolla inuti.
 * Tolv rader rymmer ett inlägg på ett par hundra ord utan att äta hela
 * telefonskärmen.
 */
const MAX_RADER = 12;

/**
 * Sätter höjden efter innehållet, upp till ett tak.
 *
 * Taket räknas fram ur den FAKTISKA radhöjden i stället för att sättas i
 * pixlar. Det är hela poängen: ett tak i pixlar hamnar mitt i en rad och
 * klipper den på mitten. Ett tak på ett helt antal rader plus rutans
 * luft kan inte göra det — och det håller även när radhöjden skiljer
 * sig mellan telefon och desktop, vilket den gör sedan fälten blev 16px
 * på mobil och 14px från sm.
 */
function justeraHojd(el: HTMLTextAreaElement): void {
  const st = getComputedStyle(el);
  const rad = parseFloat(st.lineHeight);
  if (!Number.isFinite(rad)) return; // "normal" — lämna rutan i fred
  const ram = el.offsetHeight - el.clientHeight;
  // Taket raknas med paddingTop men UTAN paddingBottom, och det ar inte
  // ett slarvfel. I en ruta som scrollar maskerar bottenpaddningen
  // ingenting - texten rullar rakt igenom den och syns dar. Rakna man in
  // den blir det plats for ytterligare en halv rad langst ner, vilket ar
  // precis den halva textraden vi skulle bli av med. Synlig textyta ar
  // clientHeight minus paddingTop, sa det ar den som ska ga jamnt upp.
  const tak = rad * MAX_RADER + parseFloat(st.paddingTop) + ram;

  el.style.height = "auto";
  const onskad = el.scrollHeight + ram;
  el.style.height = `${Math.min(onskad, tak)}px`;
  el.style.overflowY = onskad > tak ? "auto" : "hidden";
}

export interface TextareaProps extends ComponentPropsWithRef<"textarea"> {
  invalid?: boolean;
}

export function Textarea({ invalid = false, className, rows, ref, onInput, ...props }: TextareaProps) {
  const egen = useRef<HTMLTextAreaElement | null>(null);

  // Anroparen far behalla sin ref. Vi behover en egen for att kunna rakna
  // om hojden nar VARDET andras utifran - en plan som laddas in skriver
  // texten utan att nagon rort tangentbordet.
  const satt = (el: HTMLTextAreaElement | null) => {
    egen.current = el;
    if (typeof ref === "function") ref(el);
    else if (ref) (ref as { current: HTMLTextAreaElement | null }).current = el;
  };

  useEffect(() => { if (egen.current) justeraHojd(egen.current); }, [props.value]);

  return (
    <textarea
      ref={satt}
      rows={rows ?? 4}
      aria-invalid={invalid || undefined}
      onInput={(e) => { justeraHojd(e.currentTarget); onInput?.(e); }}
      // resize-none, inte resize-y: hojden agas nu av innehallet, och en
      // manuell storlek skulle skrivas over vid nasta tangenttryck.
      className={cx(fieldControlBase, "min-h-24 resize-none leading-relaxed", invalid ? fieldControlError : fieldControlOk, className)}
      {...props}
    />
  );
}

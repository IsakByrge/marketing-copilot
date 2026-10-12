"use client";

// ─────────────────────────────────────────────────────────────
// Ljus AppShell på det godkända emerald-systemet.
//
// Första ytan som faktiskt renderar designsystemet. Den gamla mörka
// Shell.tsx lämnas orörd — sidor migreras en i taget, inte i ett svep.
//
// Mobil är huvudfallet: sidomenyn är dold under lg och ersätts av en
// fast tabbrad i botten.
//
// Bottenraden hade tidigare fem sidor och inget mer, vilket gjorde
// Kampanjbyggaren, Historik och Kampanjer OÅTKOMLIGA på telefon — inte
// undangömda, utan omöjliga att nå, eftersom ingen annan sida länkar
// dit. En mätning på 390px bekräftade det: de sju posterna fanns bara i
// <aside>, som är hidden under lg.
//
// Nu är femte platsen "Mer", som öppnar en panel underifrån med resten.
// Fyra sidor man är i varje vecka ligger kvar direkt i raden; det man
// gör då och då ligger ett tryck bort. Ingen yta saknar väg.
// ─────────────────────────────────────────────────────────────
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase-browser";
import { clearAppStorage } from "./appStorage";
import { cx } from "./primitives";
import {
  DARK_QUERY, DEFAULT_PREFERENCE, THEME_ATTRIBUTE, THEME_LABELS, THEME_PREFERENCES,
  followsSystem, readPreference, resolveTheme, writePreference,
  type ThemePreference,
} from "./theme-preference";
import {
  IconToday, IconContent, IconCompany, IconPencil, IconSparkle,
  IconHistory, IconLogout, IconCampaigns, IconMenu, IconClose,
} from "./icons";

interface Item {
  href: string;
  label: string;
  icon: (p: { size?: number }) => React.ReactElement;
  /** Fler sökvägar som räknas som samma menyval. */
  also?: string[];
}

/** Hela menyn, i den ordning desktop visar den. */
const ITEMS: Item[] = [
  { href: "/dashboard", label: "Idag", icon: IconToday },
  { href: "/innehall", label: "Innehåll", icon: IconContent },
  { href: "/produkttexter", label: "Produkttexter", icon: IconPencil },
  { href: "/content/facebook", label: "Facebook", icon: IconSparkle },
  // Kampanjbyggaren är inte längre ett eget menyval: den är steget
  // "strategi" under Kampanjer och nås via Ny kampanj. Därför markeras
  // Kampanjer även när man står i /campaign-builder.
  { href: "/campaigns", label: "Kampanjer", icon: IconCampaigns, also: ["/campaign-builder"] },
  { href: "/history", label: "Historik", icon: IconHistory },
  { href: "/company", label: "Vad jag vet", icon: IconCompany },
];

/** De fyra man är i varje vecka. Femte platsen i raden är "Mer". */
const MOBILE_HREFS = ["/dashboard", "/innehall", "/produkttexter", "/content/facebook"];
const MOBILE_ITEMS: Item[] = MOBILE_HREFS.map(
  (href) => ITEMS.find((i) => i.href === href)!,
);

/**
 * Vad som ligger bakom "Mer". Kampanjer först: en liten handlare kör
 * några kampanjer om året, så den får ingen fast plats i raden, men är
 * det första man når bakom Mer.
 */
const MER_ITEMS: Item[] = [
  ITEMS.find((i) => i.href === "/campaigns")!,
  ITEMS.find((i) => i.href === "/history")!,
  ITEMS.find((i) => i.href === "/company")!,
];

function matches(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(href + "/");
}

/**
 * Temaväljaren: tre uttryckliga val, inte en cyklande ikon.
 *
 * En sol/måne som växlar visar aldrig vilket läge som är valt, och
 * "System" går inte att uttrycka med en ikon alls. Tre knappar kostar
 * lite mer plats och är entydiga.
 *
 * Semantiken är en radiogrupp: skärmläsaren får veta att det är ett val
 * mellan tre, och vilket som gäller. Det aktiva valet markeras med ram,
 * ton OCH aria-checked — aldrig med färg ensam.
 *
 * Ingen ny delad komponent. Knapparna är vanliga button-element med
 * samma tokens som resten av appen.
 */
function TemaVal({ value, onChange }: { value: ThemePreference; onChange: (p: ThemePreference) => void }) {
  return (
    <div
      role="radiogroup"
      aria-label="Utseende"
      className="flex gap-1"
      onKeyDown={(e) => {
        // Piltangenter flyttar inom gruppen, som i en riktig radiogrupp.
        if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
        e.preventDefault();
        const i = THEME_PREFERENCES.indexOf(value);
        const steg = e.key === "ArrowRight" ? 1 : -1;
        onChange(THEME_PREFERENCES[(i + steg + THEME_PREFERENCES.length) % THEME_PREFERENCES.length]);
      }}
    >
      {THEME_PREFERENCES.map((p) => {
        const vald = p === value;
        return (
          <button
            key={p}
            type="button"
            role="radio"
            aria-checked={vald}
            tabIndex={vald ? 0 : -1}
            onClick={() => onChange(p)}
            className={cx(
              "flex-1 rounded border px-2 py-1.5 text-[11px] transition-colors",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40",
              vald
                ? "border-primary/40 bg-surface font-medium text-primary"
                : "border-transparent text-text-tertiary hover:bg-surface hover:text-text-secondary",
            )}
          >
            {THEME_LABELS[p]}
          </button>
        );
      })}
    </div>
  );
}

function isActive(pathname: string, item: Item): boolean {
  return [item.href, ...(item.also ?? [])].some((h) => matches(pathname, h));
}

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() ?? "";
  const router = useRouter();
  const [email, setEmail] = useState<string | null>(null);
  const [merOppen, setMerOppen] = useState(false);

  // Temapreferensen. Bootstrap-scriptet i layout.tsx har redan satt
  // attributet före första paint; det här state:t är bara för att visa
  // vilket val som är aktivt och för att kunna byta.
  //
  // Startar på standarden och läses om efter mount: localStorage finns
  // inte vid förrendering, och att läsa den under render skulle ge en
  // hydration-miss.
  const [tema, setTema] = useState<ThemePreference>(DEFAULT_PREFERENCE);

  useEffect(() => {
    // Utanför den synkrona effektkroppen — samma mönster som
    // Facebook-sidans förifyllning använder, av samma skäl: repots
    // lint-regel tillåter inte setState direkt i en effekt.
    queueMicrotask(() => {
      setTema(readPreference(typeof window === "undefined" ? null : window.localStorage));
    });
  }, []);

  /** Skriver attributet på <html>. Samma ställe som scriptet skriver. */
  function applyTheme(pref: ThemePreference) {
    const morkt = typeof window !== "undefined" && typeof window.matchMedia === "function"
      ? window.matchMedia(DARK_QUERY).matches
      : false;
    document.documentElement.setAttribute(THEME_ATTRIBUTE, resolveTheme(pref, morkt));
  }

  function valjTema(pref: ThemePreference) {
    setTema(pref);
    writePreference(typeof window === "undefined" ? null : window.localStorage, pref);
    applyTheme(pref);
  }

  // Systemläget ska svara medan appen står öppen. Lyssnaren finns BARA
  // i systemläge — väljer användaren Ljust eller Mörkt ska ett OS-byte
  // inte röra appen. Effekten körs om vid varje preferensbyte, så
  // lyssnaren kopplas av så fort valet blir uttryckligt.
  useEffect(() => {
    if (!followsSystem(tema)) return;
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") return;
    const mq = window.matchMedia(DARK_QUERY);
    const vidByte = () => {
      document.documentElement.setAttribute(THEME_ATTRIBUTE, mq.matches ? "dark" : "light");
    };
    vidByte();
    mq.addEventListener("change", vidByte);
    return () => mq.removeEventListener("change", vidByte);
  }, [tema]);

  // Utloggningen satt i gamla Shell.tsx. Den flyttade hit med den, inte
  // bort: appstadningen fore auth.signOut() sa en delad dator aldrig
  // behaller foregaende anvandares plan eller profil.
  async function signOut() {
    clearAppStorage();
    await createClient().auth.signOut();
    router.push("/login");
  }

  useEffect(() => {
    let cancelled = false;
    createClient().auth.getUser()
      .then(({ data }) => { if (!cancelled) setEmail(data.user?.email ?? null); })
      .catch(() => { /* namnet är kosmetiskt — visa inget hellre än ett fel */ });
    return () => { cancelled = true; };
  }, []);

  // Escape stänger. Utan det är en panel utan synlig stängknapp en fälla
  // för den som navigerar med tangentbord.
  useEffect(() => {
    if (!merOppen) return;
    const vidTangent = (e: KeyboardEvent) => { if (e.key === "Escape") setMerOppen(false); };
    document.addEventListener("keydown", vidTangent);
    return () => document.removeEventListener("keydown", vidTangent);
  }, [merOppen]);

  const merAktiv = MER_ITEMS.some((i) => isActive(pathname, i));

  return (
    <div className="app-light min-h-svh bg-background font-sans text-text-primary">
      {/* Sidomenyn ligger på den nedsänkta papperstonen, innehållsytan på
          bakgrunden och korten i vitt — tre steg som ger djup utan skuggor.

          Fast i vänsterkanten över hela skärmhöjden: menyn står still när
          innehållet scrollar. Bara nav-listan scrollar, och bara om den
          blir längre än skärmen — logotyp och konto ligger alltid kvar. */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-56 flex-col overflow-hidden border-r border-border bg-surface-sunken lg:flex">
        <Link href="/dashboard" className="flex shrink-0 items-center gap-2.5 px-5 py-5">
          <span className="flex h-7 w-7 items-center justify-center rounded bg-primary text-sm font-medium text-white">
            M
          </span>
          <span className="text-sm font-medium">Marketing Copilot</span>
        </Link>

        <nav className="min-h-0 flex-1 overflow-y-auto px-3 py-2">
          {ITEMS.map((item) => {
            const { href, label, icon: Icon } = item;
            const on = isActive(pathname, item);
            return (
              <Link
                key={href}
                href={href}
                aria-current={on ? "page" : undefined}
                className={cx(
                  "mb-0.5 flex items-center gap-3 rounded px-3 py-2.5 text-sm transition-colors",
                  on
                    ? "bg-surface font-medium text-primary"
                    : "text-text-secondary hover:bg-surface hover:text-text-primary",
                )}
              >
                <Icon size={17} />
                {label}
              </Link>
            );
          })}
        </nav>

        <div className="shrink-0 border-t border-border px-3 py-3">
          {/* Sekundärt med flit: en liten etikett och tre knappar nere
              vid kontot, inte en ny post i navigationen. */}
          <p className="px-2 pb-1.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-text-tertiary">
            Utseende
          </p>
          <div className="pb-3">
            <TemaVal value={tema} onChange={valjTema} />
          </div>

          {email && (
            <p className="truncate px-2 pb-2 text-xs text-text-tertiary">{email}</p>
          )}
          <button
            type="button"
            onClick={signOut}
            className="flex w-full items-center gap-3 rounded px-3 py-2.5 text-sm text-text-secondary transition-colors hover:bg-surface hover:text-text-primary"
          >
            <IconLogout size={17} />
            Logga ut
          </button>
        </div>
      </aside>

      {/* Utloggningen satt tidigare här uppe, eftersom bottenraden var
          full. Nu bor den i Mer-panelen tillsammans med resten. */}
      <header className="sticky top-0 z-20 flex h-14 items-center gap-2.5 border-b border-border bg-surface-sunken px-4 lg:hidden">
        <span className="flex h-7 w-7 items-center justify-center rounded bg-primary text-sm font-medium text-white">
          M
        </span>
        <span className="text-sm font-medium">Marketing Copilot</span>
      </header>

      <main className="pb-20 lg:ml-56 lg:pb-0">{children}</main>

      {/* ── Mer-panelen ──────────────────────────────────────────
          Ligger över bottenraden, inte bredvid den: panelen är svaret
          på trycket i raden, så den ska täcka den. */}
      {merOppen && (
        <>
          <button
            type="button"
            aria-label="Stäng menyn"
            onClick={() => setMerOppen(false)}
            className="fixed inset-0 z-40 bg-text-primary/30 lg:hidden"
          />
          <div
            id="mer-panel"
            role="dialog"
            aria-modal="true"
            aria-label="Mer i menyn"
            className="fixed inset-x-0 bottom-0 z-50 rounded-t-xl border-t border-border bg-surface pb-[max(1rem,env(safe-area-inset-bottom))] lg:hidden"
          >
            <div className="flex items-center justify-between border-b border-border px-4 py-3">
              <p className="text-sm font-medium">Mer</p>
              <button
                type="button"
                onClick={() => setMerOppen(false)}
                aria-label="Stäng menyn"
                className="flex h-11 w-11 items-center justify-center rounded text-text-secondary transition-colors hover:bg-surface-sunken hover:text-text-primary"
              >
                <IconClose size={18} />
              </button>
            </div>

            <nav className="px-2 py-2">
              {MER_ITEMS.map((item) => {
                const { href, label, icon: Icon } = item;
                const on = isActive(pathname, item);
                return (
                  <Link
                    key={href}
                    href={href}
                    aria-current={on ? "page" : undefined}
                    onClick={() => setMerOppen(false)}
                    className={cx(
                      "flex min-h-11 items-center gap-3 rounded px-3 py-3 text-sm transition-colors",
                      on
                        ? "bg-surface-sunken font-medium text-primary"
                        : "text-text-primary hover:bg-surface-sunken",
                    )}
                  >
                    <Icon size={18} />
                    {label}
                  </Link>
                );
              })}

              <div className="mt-2 border-t border-border pt-2">
                {/* Samma kontroll som på desktop, samma plats i hierarkin:
                    vid kontot, sist. */}
                <p className="px-3 pb-1.5 pt-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-text-tertiary">
                  Utseende
                </p>
                <div className="px-3 pb-3">
                  <TemaVal value={tema} onChange={valjTema} />
                </div>

                {email && (
                  <p className="truncate px-3 pb-1 text-xs text-text-tertiary">{email}</p>
                )}
                <button
                  type="button"
                  onClick={signOut}
                  className="flex min-h-11 w-full items-center gap-3 rounded px-3 py-3 text-sm text-text-secondary transition-colors hover:bg-surface-sunken hover:text-text-primary"
                >
                  <IconLogout size={18} />
                  Logga ut
                </button>
              </div>
            </nav>
          </div>
        </>
      )}

      <nav className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-5 border-t border-border bg-surface-sunken lg:hidden">
        {MOBILE_ITEMS.map((item) => {
          const { href, label, icon: Icon } = item;
          const on = isActive(pathname, item);
          return (
            <Link
              key={href}
              href={href}
              aria-current={on ? "page" : undefined}
              className={cx(
                "flex min-h-[56px] flex-col items-center justify-center gap-1 px-1 text-[11px] transition-colors",
                on ? "font-medium text-primary" : "text-text-tertiary",
              )}
            >
              <Icon size={19} />
              {label}
            </Link>
          );
        })}

        <button
          type="button"
          onClick={() => setMerOppen((v) => !v)}
          aria-expanded={merOppen}
          aria-controls="mer-panel"
          className={cx(
            "flex min-h-[56px] flex-col items-center justify-center gap-1 px-1 text-[11px] transition-colors",
            merOppen || merAktiv ? "font-medium text-primary" : "text-text-tertiary",
          )}
        >
          <IconMenu size={19} />
          Mer
        </button>
      </nav>
    </div>
  );
}

"use client";

// ─────────────────────────────────────────────────────────────
// Delad "Mission Control"-navigation. Tunn, exklusiv sidebar på
// desktop; kompakt drawer på mobil. Används av /dashboard,
// /campaign-builder, /content, /company, /campaigns, /history.
//
// Innehåller ingen affärslogik — bara navigation, användarsession
// (för hälsning/utloggning) och layout.
// ─────────────────────────────────────────────────────────────
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase-browser";
import { T, fontSans, fontSerif, transition } from "./theme";
import {
  IconToday, IconBuilder, IconCampaigns, IconContent, IconCompany, IconHistory,
  IconSettings, IconLogout, IconMenu, IconClose, IconSparkle,
} from "./icons";

export interface NavItem {
  href: string;
  label: string;
  icon: (p: { size?: number }) => React.ReactElement;
}

export const NAV_ITEMS: NavItem[] = [
  { href: "/dashboard", label: "Idag", icon: IconToday },
  { href: "/campaign-builder", label: "Campaign Builder", icon: IconBuilder },
  { href: "/campaigns", label: "Kampanjer", icon: IconCampaigns },
  { href: "/content", label: "Innehåll", icon: IconContent },
  { href: "/content/facebook", label: "Facebook Specialist", icon: IconSparkle },
  { href: "/company", label: "Företagskunskap", icon: IconCompany },
  { href: "/history", label: "Historik", icon: IconHistory },
];

/** Bästa möjliga förnamn ur en e-postadress — ingen persondata utöver det som redan finns. */
export function firstNameFromEmail(email: string | null): string | null {
  if (!email) return null;
  const local = email.split("@")[0];
  if (!local) return null;
  const first = local.split(/[._\-+0-9]+/).filter(Boolean)[0];
  if (!first) return null;
  return first.charAt(0).toUpperCase() + first.slice(1).toLowerCase();
}

function useIsCompact() {
  const [compact, setCompact] = useState(false);
  useEffect(() => {
    const check = () => setCompact(window.innerWidth < 900);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);
  return compact;
}

function useAuthUser() {
  const [email, setEmail] = useState<string | null>(null);
  useEffect(() => {
    let active = true;
    const sb = createClient();
    sb.auth.getUser().then(({ data }) => { if (active) setEmail(data.user?.email ?? null); });
    return () => { active = false; };
  }, []);
  return email;
}

function NavLink({ item, active, onNavigate }: { item: NavItem; active: boolean; onNavigate?: () => void }) {
  const Icon = item.icon;
  return (
    <Link
      href={item.href}
      onClick={onNavigate}
      aria-current={active ? "page" : undefined}
      className="mcx-navlink"
      style={{
        display: "flex", alignItems: "center", gap: 13,
        padding: "10px 14px", borderRadius: 8,
        textDecoration: "none", position: "relative",
        color: active ? T.text : T.text3,
        background: active ? T.purpleDim : "transparent",
        border: `1px solid ${active ? T.purpleBorder : "transparent"}`,
        boxShadow: active ? `0 0 0 1px rgba(139,107,242,0.08), 0 4px 18px -6px ${T.purpleGlow}` : "none",
        transition,
      }}
      onMouseOver={(e) => { if (!active) { e.currentTarget.style.background = T.surface2; e.currentTarget.style.color = T.text; } }}
      onMouseOut={(e) => { if (!active) { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = T.text3; } }}
    >
      {active && (
        <span aria-hidden style={{
          position: "absolute", left: -1, top: "18%", bottom: "18%", width: 2,
          borderRadius: 2, background: T.purpleBright,
        }} />
      )}
      <Icon size={17} />
      <span style={{
        fontFamily: fontSans, fontSize: "0.86rem", fontWeight: active ? 500 : 400,
        letterSpacing: "0.01em", whiteSpace: "nowrap",
      }}>
        {item.label}
      </span>
    </Link>
  );
}

function Wordmark() {
  return (
    <Link href="/dashboard" style={{ display: "flex", alignItems: "center", gap: 10, textDecoration: "none" }}>
      <span aria-hidden style={{
        width: 30, height: 30, borderRadius: 8, flexShrink: 0,
        display: "flex", alignItems: "center", justifyContent: "center",
        background: "linear-gradient(155deg, rgba(139,107,242,0.35), rgba(91,141,239,0.18))",
        border: `1px solid ${T.purpleBorder}`,
      }}>
        <span style={{ fontFamily: fontSerif, fontWeight: 600, fontSize: "0.95rem", color: T.purpleBright }}>M</span>
      </span>
      <span style={{ fontFamily: fontSans, fontSize: "0.92rem", fontWeight: 500, color: T.text, letterSpacing: "0.01em" }}>
        Marketing Copilot
      </span>
    </Link>
  );
}

function SidebarFooter({ email, onSignOut, onNavigate }: { email: string | null; onSignOut: () => void; onNavigate?: () => void }) {
  const name = firstNameFromEmail(email);
  return (
    <div style={{ borderTop: `1px solid ${T.line}`, paddingTop: 14, display: "flex", flexDirection: "column", gap: 2 }}>
      <Link
        href="/profile" onClick={onNavigate} className="mcx-navlink"
        style={{
          display: "flex", alignItems: "center", gap: 13, padding: "10px 14px", borderRadius: 8,
          textDecoration: "none", color: T.text3, transition,
        }}
        onMouseOver={(e) => { e.currentTarget.style.background = T.surface2; e.currentTarget.style.color = T.text; }}
        onMouseOut={(e) => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = T.text3; }}
      >
        <IconSettings size={16} />
        <span style={{ fontFamily: fontSans, fontSize: "0.82rem", fontWeight: 400 }}>Inställningar</span>
      </Link>

      <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 14px" }}>
        <span aria-hidden style={{
          width: 26, height: 26, borderRadius: "50%", flexShrink: 0,
          background: T.surface2, border: `1px solid ${T.line2}`,
          display: "flex", alignItems: "center", justifyContent: "center",
          fontFamily: fontSans, fontSize: "0.7rem", fontWeight: 500, color: T.text2,
        }}>
          {(name ?? email ?? "?").charAt(0).toUpperCase()}
        </span>
        <span style={{ fontFamily: fontSans, fontSize: "0.78rem", fontWeight: 400, color: T.text2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {name ?? email ?? "Inloggad"}
        </span>
      </div>

      <button
        onClick={onSignOut} className="mcx-navlink"
        style={{
          display: "flex", alignItems: "center", gap: 13, padding: "10px 14px", borderRadius: 8,
          background: "none", border: "none", color: T.text3, cursor: "pointer",
          fontFamily: fontSans, fontSize: "0.82rem", fontWeight: 400, textAlign: "left", transition,
        }}
        onMouseOver={(e) => { e.currentTarget.style.background = T.surface2; e.currentTarget.style.color = T.text; }}
        onMouseOut={(e) => { e.currentTarget.style.background = "none"; e.currentTarget.style.color = T.text3; }}
      >
        <IconLogout size={16} />
        Logga ut
      </button>
    </div>
  );
}

export default function Shell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const compact = useIsCompact();
  const email = useAuthUser();
  const [drawerOpen, setDrawerOpen] = useState(false);

  async function signOut() {
    const sb = createClient();
    await sb.auth.signOut();
    router.push("/login");
  }

  const isActive = (href: string) => {
    if (pathname === href) return true;
    if (!pathname?.startsWith(href + "/")) return false;
    // Mest specifika nav-post vinner — så "Innehåll" (/content) inte lyser
    // aktiv samtidigt som "Facebook Specialist" (/content/facebook).
    return !NAV_ITEMS.some(
      (o) => o.href !== href && o.href.startsWith(href + "/") &&
        (pathname === o.href || pathname.startsWith(o.href + "/")),
    );
  };

  return (
    <div style={{ display: "flex", flexDirection: compact ? "column" : "row", minHeight: "100svh", background: T.bg }}>
      {!compact && (
        <aside style={{
          width: 252, flexShrink: 0, position: "sticky", top: 0, height: "100svh",
          background: T.sidebar, borderRight: `1px solid ${T.line}`,
          display: "flex", flexDirection: "column", padding: "22px 14px 16px",
        }}>
          <div style={{ padding: "4px 6px 26px" }}>
            <Wordmark />
          </div>
          <nav aria-label="Huvudnavigation" style={{ display: "flex", flexDirection: "column", gap: 2, flex: 1 }}>
            {NAV_ITEMS.map((item) => (
              <NavLink key={item.href} item={item} active={isActive(item.href)} />
            ))}
          </nav>
          <SidebarFooter email={email} onSignOut={signOut} />
        </aside>
      )}

      {compact && (
        <>
          <header style={{
            position: "sticky", top: 0, zIndex: 100, height: 56,
            display: "flex", alignItems: "center", justifyContent: "space-between",
            padding: "0 18px", background: "rgba(10,10,16,0.9)", backdropFilter: "blur(16px)",
            borderBottom: `1px solid ${T.line}`,
          }}>
            <Wordmark />
            <button
              onClick={() => setDrawerOpen(true)} aria-label="Öppna meny" aria-expanded={drawerOpen}
              style={{ background: "none", border: `1px solid ${T.line2}`, borderRadius: 8, width: 38, height: 38, display: "flex", alignItems: "center", justifyContent: "center", color: T.text2, cursor: "pointer" }}
            >
              <IconMenu size={18} />
            </button>
          </header>

          {drawerOpen && (
            <div role="dialog" aria-modal="true" aria-label="Navigation" style={{ position: "fixed", inset: 0, zIndex: 200 }}>
              <div
                onClick={() => setDrawerOpen(false)}
                style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.55)", animation: "mcxFadeIn .18s ease both" }}
              />
              <div style={{
                position: "absolute", top: 0, right: 0, bottom: 0, width: "min(84vw, 300px)",
                background: T.sidebar, borderLeft: `1px solid ${T.line}`,
                padding: "18px 14px 16px", display: "flex", flexDirection: "column",
                animation: "mcxSlideIn .22s cubic-bezier(.16,1,.3,1) both",
              }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "4px 6px 22px" }}>
                  <Wordmark />
                  <button onClick={() => setDrawerOpen(false)} aria-label="Stäng meny" style={{ background: "none", border: "none", color: T.text3, cursor: "pointer", padding: 6 }}>
                    <IconClose size={18} />
                  </button>
                </div>
                <nav aria-label="Huvudnavigation" style={{ display: "flex", flexDirection: "column", gap: 2, flex: 1 }}>
                  {NAV_ITEMS.map((item) => (
                    <NavLink key={item.href} item={item} active={isActive(item.href)} onNavigate={() => setDrawerOpen(false)} />
                  ))}
                </nav>
                <SidebarFooter email={email} onSignOut={signOut} onNavigate={() => setDrawerOpen(false)} />
              </div>
            </div>
          )}
        </>
      )}

      <main style={{ flex: 1, minWidth: 0, background: T.bg }}>
        {children}
      </main>

      <style>{`
        @keyframes mcxFadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes mcxSlideIn { from { transform: translateX(100%); } to { transform: translateX(0); } }
        .mcx-navlink:focus-visible { outline: 2px solid ${T.purpleBright}; outline-offset: 2px; }
        @media (prefers-reduced-motion: reduce) {
          .mcx-navlink, [style*="animation"] { animation: none !important; transition: none !important; }
        }
      `}</style>
    </div>
  );
}

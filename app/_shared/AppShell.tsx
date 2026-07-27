"use client";

// ─────────────────────────────────────────────────────────────────────
// AppShell — the light "emerald" application frame (Design System 2.0 §10).
//
// This is the FUTURE SHARED shell for the whole product. Overview is the
// first page to adopt it; other routes migrate to it page-by-page in later
// sprints. It is intentionally separate from the frozen dark Mission Control
// `Shell.tsx`, which the not-yet-migrated routes keep using unchanged.
//
// Responsiveness is CSS-driven (Tailwind `lg:` utilities), so the first
// paint is correct on every viewport — no JS breakpoint flash. JavaScript is
// used only to open/close the mobile drawer.
//
// Navigation follows the locked Information Architecture v1.0
// (Översikt · Company Brain · Strategi · Innehåll · Insikter · Inställningar),
// mapped non-destructively onto the routes that exist today. Areas without a
// destination yet are shown as honest "Snart" items, never broken links.
// ─────────────────────────────────────────────────────────────────────
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { createClient } from "@/lib/supabase-browser";
import { cx } from "./primitives";
import {
  IconToday, IconCompany, IconBuilder, IconContent, IconOpportunity,
  IconSettings, IconLogout, IconMenu, IconClose,
} from "./icons";

type IconType = (p: { size?: number }) => ReactNode;

interface NavArea {
  href: string;
  label: string;
  icon: IconType;
}

// Live areas — IA-locked labels mapped to existing routes.
const NAV_AREAS: NavArea[] = [
  { href: "/dashboard", label: "Översikt", icon: IconToday },
  { href: "/company", label: "Company Brain", icon: IconCompany },
  { href: "/campaign-builder", label: "Strategi", icon: IconBuilder },
  { href: "/content", label: "Innehåll", icon: IconContent },
];

// IA-locked areas without a destination yet. Shown, but honestly disabled.
const UPCOMING_AREAS: { label: string; icon: IconType }[] = [
  { label: "Insikter", icon: IconOpportunity },
  { label: "Inställningar", icon: IconSettings },
];

function firstNameFromEmail(email: string | null): string | null {
  if (!email) return null;
  const first = email.split("@")[0]?.split(/[._\-+0-9]+/).filter(Boolean)[0];
  return first ? first.charAt(0).toUpperCase() + first.slice(1).toLowerCase() : null;
}

function isActive(pathname: string | null, href: string): boolean {
  if (!pathname) return false;
  return pathname === href || pathname.startsWith(href + "/");
}

function Wordmark() {
  return (
    <span className="flex items-center gap-2.5 font-sans">
      <span
        aria-hidden
        className="flex h-7 w-7 items-center justify-center rounded-md bg-primary text-[15px] font-semibold text-white"
      >
        M
      </span>
      <span className="text-sm font-semibold text-text-primary">Marketing Copilot</span>
    </span>
  );
}

function NavList({ pathname, onNavigate }: { pathname: string | null; onNavigate?: () => void }) {
  return (
    <nav aria-label="Huvudnavigation" className="flex flex-col gap-0.5">
      {NAV_AREAS.map(({ href, label, icon: Icon }) => {
        const active = isActive(pathname, href);
        return (
          <Link
            key={href}
            href={href}
            onClick={onNavigate}
            aria-current={active ? "page" : undefined}
            className={cx(
              "group flex items-center gap-3 rounded px-3 py-2 text-sm font-medium transition-colors",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2 focus-visible:ring-offset-surface",
              active
                ? "bg-primary-surface text-primary"
                : "text-text-secondary hover:bg-surface-sunken hover:text-text-primary",
            )}
          >
            <Icon size={20} />
            {label}
          </Link>
        );
      })}

      {UPCOMING_AREAS.map(({ label, icon: Icon }) => (
        <span
          key={label}
          aria-disabled="true"
          className="flex items-center gap-3 rounded px-3 py-2 text-sm font-medium text-text-tertiary/70"
        >
          <Icon size={20} />
          {label}
          <span className="ml-auto rounded-full bg-surface-sunken px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-text-tertiary">
            Snart
          </span>
        </span>
      ))}
    </nav>
  );
}

function SidebarBody({
  workspaceName,
  email,
  onSignOut,
  onNavigate,
  pathname,
}: {
  workspaceName?: string | null;
  email: string | null;
  onSignOut: () => void;
  onNavigate?: () => void;
  pathname: string | null;
}) {
  const firstName = firstNameFromEmail(email);
  return (
    <div className="flex h-full flex-col gap-6 p-4">
      <div className="px-2 pt-1">
        <Wordmark />
      </div>

      <div className="flex-1">
        <NavList pathname={pathname} onNavigate={onNavigate} />
      </div>

      <div className="flex flex-col gap-3">
        {workspaceName && (
          <div className="rounded-lg border border-border bg-surface-sunken px-3 py-2.5">
            <p className="text-[11px] font-medium uppercase tracking-wide text-text-tertiary">
              Arbetsyta
            </p>
            <p className="truncate text-sm font-medium text-text-primary">{workspaceName}</p>
          </div>
        )}

        <div className="flex items-center gap-3 px-1">
          <span
            aria-hidden
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary-surface text-xs font-semibold text-primary"
          >
            {(firstName ?? email ?? "?").charAt(0).toUpperCase()}
          </span>
          <div className="min-w-0 flex-1">
            {firstName && <p className="truncate text-sm font-medium text-text-primary">{firstName}</p>}
            {email && <p className="truncate text-xs text-text-tertiary">{email}</p>}
          </div>
          <button
            type="button"
            onClick={onSignOut}
            aria-label="Logga ut"
            className="flex h-9 w-9 items-center justify-center rounded text-text-tertiary transition-colors hover:bg-surface-sunken hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
          >
            <IconLogout size={18} />
          </button>
        </div>
      </div>
    </div>
  );
}

export interface AppShellProps {
  children: ReactNode;
  /** Optional workspace/company label shown in the sidebar footer. */
  workspaceName?: string | null;
}

export default function AppShell({ children, workspaceName }: AppShellProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [email, setEmail] = useState<string | null>(null);
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    let active = true;
    createClient()
      .auth.getUser()
      .then(({ data }) => {
        if (active) setEmail(data.user?.email ?? null);
      });
    return () => {
      active = false;
    };
  }, []);

  const signOut = useCallback(async () => {
    await createClient().auth.signOut();
    router.push("/login");
  }, [router]);

  // Drawer: ESC to close, lock body scroll, move focus to the close button.
  useEffect(() => {
    if (!drawerOpen) return;
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setDrawerOpen(false);
    };
    document.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [drawerOpen]);

  return (
    <div className="min-h-svh bg-background text-text-primary">
      {/* Desktop sidebar — CSS-shown at lg+, so first paint is correct. */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-60 border-r border-border bg-surface lg:block">
        <SidebarBody
          workspaceName={workspaceName}
          email={email}
          onSignOut={signOut}
          pathname={pathname}
        />
      </aside>

      {/* Mobile top bar */}
      <header className="sticky top-0 z-20 flex items-center justify-between border-b border-border bg-surface/95 px-4 py-3 backdrop-blur lg:hidden">
        <Wordmark />
        <button
          type="button"
          onClick={() => setDrawerOpen(true)}
          aria-label="Öppna meny"
          aria-expanded={drawerOpen}
          className="flex h-11 w-11 items-center justify-center rounded text-text-secondary transition-colors hover:bg-surface-sunken focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
        >
          <IconMenu size={22} />
        </button>
      </header>

      {/* Mobile drawer */}
      {drawerOpen && (
        <div className="lg:hidden">
          <div
            className="fixed inset-0 z-40 bg-text-primary/40"
            onClick={() => setDrawerOpen(false)}
            aria-hidden
          />
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Navigation"
            className="fixed inset-y-0 left-0 z-50 w-72 max-w-[85vw] border-r border-border bg-surface shadow-md"
          >
            <div className="flex justify-end p-2">
              <button
                ref={closeRef}
                type="button"
                onClick={() => setDrawerOpen(false)}
                aria-label="Stäng meny"
                className="flex h-11 w-11 items-center justify-center rounded text-text-secondary transition-colors hover:bg-surface-sunken focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
              >
                <IconClose size={22} />
              </button>
            </div>
            <SidebarBody
              workspaceName={workspaceName}
              email={email}
              onSignOut={signOut}
              onNavigate={() => setDrawerOpen(false)}
              pathname={pathname}
            />
          </div>
        </div>
      )}

      {/* Main region — offset by the fixed sidebar on desktop. */}
      <div className="lg:pl-60">
        <main className="mx-auto w-full max-w-[1280px] px-5 py-8 sm:px-8 lg:px-12">{children}</main>
      </div>
    </div>
  );
}

"use client";

// ─────────────────────────────────────────────────────────────
// Ljus AppShell på det godkända emerald-systemet.
//
// Första ytan som faktiskt renderar designsystemet. Den gamla mörka
// Shell.tsx lämnas orörd — sidor migreras en i taget, inte i ett svep.
//
// Mobil är huvudfallet: sidomenyn är dold under lg och ersätts av en
// fast tabbrad i botten med 44px träffyta.
//
// Fyra ytor, inte nio. Fler läggs till när det finns ett verkligt behov.
// ─────────────────────────────────────────────────────────────
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase-browser";
import { cx } from "./primitives";
import { IconToday, IconContent, IconCompany, IconPencil } from "./icons";

interface Item {
  href: string;
  label: string;
  icon: (p: { size?: number }) => React.ReactElement;
}

const ITEMS: Item[] = [
  { href: "/dashboard", label: "Idag", icon: IconToday },
  { href: "/produkttexter", label: "Produkttexter", icon: IconPencil },
  { href: "/innehall", label: "Innehåll", icon: IconContent },
  { href: "/company", label: "Vad jag vet", icon: IconCompany },
];

function isActive(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(href + "/");
}

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() ?? "";
  const [email, setEmail] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    createClient().auth.getUser()
      .then(({ data }) => { if (!cancelled) setEmail(data.user?.email ?? null); })
      .catch(() => { /* namnet är kosmetiskt — visa inget hellre än ett fel */ });
    return () => { cancelled = true; };
  }, []);

  return (
    <div className="app-light min-h-svh bg-background font-sans text-text-primary">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-56 flex-col border-r border-border bg-surface lg:flex">
        <Link href="/dashboard" className="flex items-center gap-2.5 px-5 py-5">
          <span className="flex h-7 w-7 items-center justify-center rounded bg-primary text-sm font-medium text-white">
            M
          </span>
          <span className="text-sm font-medium">Marketing Copilot</span>
        </Link>

        <nav className="flex-1 px-3 py-2">
          {ITEMS.map(({ href, label, icon: Icon }) => {
            const on = isActive(pathname, href);
            return (
              <Link
                key={href}
                href={href}
                aria-current={on ? "page" : undefined}
                className={cx(
                  "mb-0.5 flex items-center gap-3 rounded px-3 py-2.5 text-sm transition-colors",
                  on
                    ? "bg-surface-sunken font-medium text-primary"
                    : "text-text-secondary hover:bg-surface-sunken hover:text-text-primary",
                )}
              >
                <Icon size={17} />
                {label}
              </Link>
            );
          })}
        </nav>

        {email && (
          <div className="border-t border-border px-5 py-4 text-xs text-text-tertiary">
            <p className="truncate">{email}</p>
          </div>
        )}
      </aside>

      <header className="sticky top-0 z-20 flex h-14 items-center gap-2.5 border-b border-border bg-surface px-4 lg:hidden">
        <span className="flex h-7 w-7 items-center justify-center rounded bg-primary text-sm font-medium text-white">
          M
        </span>
        <span className="text-sm font-medium">Marketing Copilot</span>
      </header>

      <main className="pb-20 lg:ml-56 lg:pb-0">{children}</main>

      <nav className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-4 border-t border-border bg-surface lg:hidden">
        {ITEMS.map(({ href, label, icon: Icon }) => {
          const on = isActive(pathname, href);
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
      </nav>
    </div>
  );
}

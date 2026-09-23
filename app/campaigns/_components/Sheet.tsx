"use client";

// ─────────────────────────────────────────────────────────────
// Ark underifrån på telefon, centrerad ruta från sm. Samma form som
// Mer-panelen i AppShell: den ligger ÖVER bottenraden (z-50 mot
// radens z-30), så ingen knapp i arket hamnar bakom menyn.
//
// Escape och klick utanför stänger — utom medan något sparas, så att
// ett pågående anrop inte tappar sin yta. Fokus flyttas in i arket
// och tillbaka till knappen som öppnade det.
// ─────────────────────────────────────────────────────────────
import { useEffect, useId, useRef, type ReactNode } from "react";
import { IconButton } from "@/app/_shared/primitives";
import { IconClose } from "@/app/_shared/icons";

export function Sheet({ title, onClose, busy = false, children }: {
  title: string;
  onClose: () => void;
  /** Medan något sparas går arket inte att stänga. */
  busy?: boolean;
  children: ReactNode;
}) {
  const titleId = useId();
  const panelRef = useRef<HTMLDivElement>(null);
  const busyRef = useRef(busy);
  const closeRef = useRef(onClose);
  useEffect(() => { busyRef.current = busy; closeRef.current = onClose; });

  useEffect(() => {
    const opener = document.activeElement as HTMLElement | null;
    const first = panelRef.current?.querySelector<HTMLElement>("[data-autofocus]") ?? panelRef.current;
    first?.focus();
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !busyRef.current) closeRef.current();
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
      opener?.focus?.();
    };
  }, []);

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-6">
      <button
        type="button"
        aria-label="Stäng"
        tabIndex={-1}
        onClick={() => { if (!busy) onClose(); }}
        className="absolute inset-0 cursor-default bg-text-primary/30"
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className="relative flex max-h-[92svh] w-full flex-col rounded-t-xl border-t border-border bg-surface focus:outline-none sm:max-h-[85svh] sm:max-w-lg sm:rounded-lg sm:border"
      >
        <div className="flex shrink-0 items-center justify-between border-b border-border py-2 pl-4 pr-2">
          <h2 id={titleId} className="text-[15px] font-medium">{title}</h2>
          <IconButton aria-label="Stäng" onClick={onClose} disabled={busy}>
            <IconClose size={18} />
          </IconButton>
        </div>
        <div className="overflow-y-auto px-4 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-4 sm:px-5 sm:pb-5">
          {children}
        </div>
      </div>
    </div>
  );
}

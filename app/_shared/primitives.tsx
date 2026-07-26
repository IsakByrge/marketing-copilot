// ─────────────────────────────────────────────────────────────────────
// DESIGN SYSTEM FOUNDATION — shared UI primitives (Sprint 1)
//
// The light emerald design system. Every primitive is styled purely with
// Tailwind v4 utilities backed by the approved tokens in globals.css
// (@theme static). Interaction states are CSS-only (hover:/active:/
// focus-visible:) — no JavaScript style mutation, and motion is neutralised
// automatically by the global prefers-reduced-motion block.
//
// These are a NEW, standalone layer. They do NOT replace app/_shared/ui.tsx
// (the frozen dark "Mission Control" components), which the existing pages,
// the App Shell and the legacy routes keep using unchanged in Sprint 1.
// Adoption of these primitives happens page-by-page in later sprints.
// ─────────────────────────────────────────────────────────────────────
import type { ComponentPropsWithRef, ReactNode } from "react";

/** Tiny className joiner — drops falsy values, no dependency. */
export function cx(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(" ");
}

// Shared focus ring — emerald, keyboard-only, offset against the canvas.
const focusRing =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 " +
  "focus-visible:ring-offset-2 focus-visible:ring-offset-background";

/* ─── Button ──────────────────────────────────────────────────────── */

export type ButtonVariant = "primary" | "secondary" | "ghost";
export type ButtonSize = "sm" | "md";

const buttonBase =
  "inline-flex items-center justify-center gap-2 font-sans font-medium rounded " +
  "transition-colors disabled:pointer-events-none disabled:opacity-50 " +
  "select-none cursor-pointer " + focusRing;

const buttonSizes: Record<ButtonSize, string> = {
  sm: "text-sm px-3 py-1.5",
  md: "text-sm px-4 py-2.5",
};

const buttonVariants: Record<ButtonVariant, string> = {
  primary: "bg-primary text-white hover:bg-primary-hover active:bg-primary-hover",
  secondary:
    "bg-surface text-text-primary border border-border hover:border-border-strong hover:bg-surface-sunken",
  ghost: "bg-transparent text-text-secondary hover:bg-surface-sunken hover:text-text-primary",
};

export interface ButtonProps extends ComponentPropsWithRef<"button"> {
  variant?: ButtonVariant;
  size?: ButtonSize;
}

export function Button({ variant = "primary", size = "md", className, type, ...props }: ButtonProps) {
  return (
    <button
      type={type ?? "button"}
      className={cx(buttonBase, buttonSizes[size], buttonVariants[variant], className)}
      {...props}
    />
  );
}

/* ─── IconButton ──────────────────────────────────────────────────── */

export type IconButtonSize = "sm" | "md";

const iconButtonSizes: Record<IconButtonSize, string> = {
  sm: "h-8 w-8",
  md: "h-10 w-10",
};

export interface IconButtonProps extends ComponentPropsWithRef<"button"> {
  /** Accessible name — required, since the control has no visible text. */
  "aria-label": string;
  variant?: ButtonVariant;
  size?: IconButtonSize;
}

export function IconButton({ variant = "ghost", size = "md", className, type, ...props }: IconButtonProps) {
  return (
    <button
      type={type ?? "button"}
      className={cx(
        "inline-flex items-center justify-center rounded transition-colors cursor-pointer",
        "disabled:pointer-events-none disabled:opacity-50",
        iconButtonSizes[size],
        buttonVariants[variant],
        focusRing,
        className,
      )}
      {...props}
    />
  );
}

/* ─── Card ────────────────────────────────────────────────────────── */

export type CardPadding = "none" | "sm" | "md" | "lg";

const cardPadding: Record<CardPadding, string> = {
  none: "",
  sm: "p-4",
  md: "p-6",
  lg: "p-8",
};

export interface CardProps extends ComponentPropsWithRef<"div"> {
  padding?: CardPadding;
  /** Adds a hover affordance for clickable cards. */
  interactive?: boolean;
  children?: ReactNode;
}

export function Card({ padding = "md", interactive = false, className, children, ...props }: CardProps) {
  return (
    <div
      className={cx(
        "rounded-lg border border-border bg-surface shadow-sm",
        cardPadding[padding],
        interactive && "transition-colors hover:border-border-strong",
        className,
      )}
      {...props}
    >
      {children}
    </div>
  );
}

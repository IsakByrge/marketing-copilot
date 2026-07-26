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
import { useId } from "react";

/** Tiny className joiner — drops falsy values, no dependency. */
export function cx(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(" ");
}

// Shared focus ring — emerald, keyboard-only, offset against the canvas.
const focusRing =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 " +
  "focus-visible:ring-offset-2 focus-visible:ring-offset-background";

/**
 * CSS-only progress indicator (no dependency). Inherits the control's text
 * colour via border-current; `animate-spin` is neutralised by the global
 * prefers-reduced-motion block (it then reads as a static ring while
 * aria-busy still announces the busy state).
 */
export function Spinner({ className }: { className?: string }) {
  return (
    <span
      aria-hidden
      className={cx(
        "inline-block h-4 w-4 shrink-0 animate-spin rounded-full border-2 border-current border-r-transparent",
        className,
      )}
    />
  );
}

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
  /** Shows a spinner, sets aria-busy and disables the control. */
  loading?: boolean;
}

export function Button({
  variant = "primary",
  size = "md",
  loading = false,
  disabled,
  className,
  type,
  children,
  ...props
}: ButtonProps) {
  return (
    <button
      type={type ?? "button"}
      aria-busy={loading || undefined}
      disabled={disabled || loading}
      className={cx(buttonBase, buttonSizes[size], buttonVariants[variant], "relative", className)}
      {...props}
    >
      {loading && (
        <span className="absolute inset-0 flex items-center justify-center">
          <Spinner />
        </span>
      )}
      {/* Kept in the DOM while loading so width never jumps and the text
          remains the control's accessible name; only visually hidden. */}
      <span className={cx("contents", loading && "invisible")}>{children}</span>
    </button>
  );
}

/* ─── IconButton ──────────────────────────────────────────────────── */

// A single 44×44px control — the locked minimum touch target for icon/touch
// controls (WCAG 2.5.5). A smaller *visual* icon simply sits centred inside
// this hit area (pass e.g. size={18} to the icon child). No sub-44px size is
// offered: there is no verified use case for one, and a smaller hit target
// would violate the locked requirement. If one is ever needed, add it as a
// larger hit area with a centred smaller glyph — never a smaller button box.
export interface IconButtonProps extends ComponentPropsWithRef<"button"> {
  /** Accessible name — required, since the control has no visible text. */
  "aria-label": string;
  variant?: ButtonVariant;
  /** Shows a spinner, sets aria-busy and disables the control. */
  loading?: boolean;
}

export function IconButton({
  variant = "ghost",
  loading = false,
  disabled,
  className,
  type,
  children,
  ...props
}: IconButtonProps) {
  return (
    <button
      type={type ?? "button"}
      aria-busy={loading || undefined}
      disabled={disabled || loading}
      className={cx(
        "inline-flex h-11 w-11 items-center justify-center rounded transition-colors cursor-pointer",
        "disabled:pointer-events-none disabled:opacity-50",
        buttonVariants[variant],
        focusRing,
        className,
      )}
      {...props}
    >
      {/* The 44px hit area is fixed, so swapping icon → spinner never shifts
          layout; the accessible name is carried by the required aria-label. */}
      {loading ? <Spinner /> : children}
    </button>
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
  children?: ReactNode;
}

// A resting Card has NO shadow (per UX Redesign Blueprint v1.0) — separation
// comes from background, border and spacing alone. There is intentionally no
// `interactive` prop: a foundation Card must not encourage clickable <div>s.
// Clickable cards are built later with a semantic <a>/<button> in the sprint
// that implements the real use case.
export function Card({ padding = "md", className, children, ...props }: CardProps) {
  return (
    <div
      className={cx(
        "rounded-lg border border-border bg-surface",
        cardPadding[padding],
        className,
      )}
      {...props}
    >
      {children}
    </div>
  );
}

/* ─── Input / Textarea ────────────────────────────────────────────── */

// A ring on :focus (not only :focus-visible) is the expected affordance for
// text fields — it appears for both pointer and keyboard focus.
const fieldControlBase =
  "w-full font-sans text-sm text-text-primary bg-surface border rounded px-3.5 py-2.5 " +
  "placeholder:text-text-tertiary transition-colors focus:outline-none " +
  "focus:ring-2 disabled:opacity-50 disabled:pointer-events-none";

const fieldControlOk = "border-border focus:border-primary focus:ring-primary/20";
const fieldControlError = "border-danger focus:border-danger focus:ring-danger/20";

export interface InputProps extends ComponentPropsWithRef<"input"> {
  invalid?: boolean;
}

export function Input({ invalid = false, className, type, ...props }: InputProps) {
  return (
    <input
      type={type ?? "text"}
      aria-invalid={invalid || undefined}
      className={cx(fieldControlBase, invalid ? fieldControlError : fieldControlOk, className)}
      {...props}
    />
  );
}

export interface TextareaProps extends ComponentPropsWithRef<"textarea"> {
  invalid?: boolean;
}

export function Textarea({ invalid = false, className, rows, ...props }: TextareaProps) {
  return (
    <textarea
      rows={rows ?? 4}
      aria-invalid={invalid || undefined}
      className={cx(fieldControlBase, "min-h-24 resize-y leading-relaxed", invalid ? fieldControlError : fieldControlOk, className)}
      {...props}
    />
  );
}

/* ─── Field ───────────────────────────────────────────────────────── */

export interface FieldProps {
  label: string;
  /** Rendered with a single form control; receives the generated id + aria wiring. */
  children: (fieldProps: { id: string; invalid: boolean; "aria-describedby"?: string }) => ReactNode;
  hint?: string;
  error?: string;
  optional?: boolean;
  className?: string;
}

/**
 * Labelled wrapper for a single control. Owns id/label association and
 * hint/error wiring via a render-prop so the control receives the right
 * `id`, `aria-invalid` and `aria-describedby` automatically.
 */
export function Field({ label, children, hint, error, optional, className }: FieldProps) {
  const id = useId();
  const hintId = hint ? `${id}-hint` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  const describedBy = [hintId, errorId].filter(Boolean).join(" ") || undefined;

  return (
    <div className={cx("flex flex-col gap-1.5", className)}>
      <label htmlFor={id} className="font-sans text-sm font-medium text-text-primary">
        {label}
        {optional && <span className="ml-1 font-normal text-text-tertiary">— valfritt</span>}
      </label>
      {hint && <p id={hintId} className="font-sans text-xs text-text-tertiary">{hint}</p>}
      {children({ id, invalid: Boolean(error), "aria-describedby": describedBy })}
      {error && <p id={errorId} className="font-sans text-xs font-medium text-danger">{error}</p>}
    </div>
  );
}

/* ─── Chip ────────────────────────────────────────────────────────── */

export type ChipTone = "neutral" | "primary" | "success" | "danger" | "warning";

const chipTones: Record<ChipTone, string> = {
  neutral: "bg-surface-sunken text-text-secondary border-border",
  primary: "bg-primary/10 text-primary border-primary/20",
  success: "bg-success-surface text-success border-success/20",
  danger: "bg-danger-surface text-danger border-danger/20",
  warning: "bg-warning-surface text-warning border-warning/20",
};

export interface ChipProps extends ComponentPropsWithRef<"span"> {
  tone?: ChipTone;
}

export function Chip({ tone = "neutral", className, ...props }: ChipProps) {
  return (
    <span
      className={cx(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 font-sans text-xs font-medium",
        chipTones[tone],
        className,
      )}
      {...props}
    />
  );
}

/* ─── Alert ───────────────────────────────────────────────────────── */

export type AlertTone = "info" | "success" | "warning" | "danger";

const alertTones: Record<AlertTone, { container: string; title: string }> = {
  info: { container: "bg-surface-sunken border-border", title: "text-text-primary" },
  success: { container: "bg-success-surface border-success/30", title: "text-success" },
  warning: { container: "bg-warning-surface border-warning/30", title: "text-warning" },
  danger: { container: "bg-danger-surface border-danger/30", title: "text-danger" },
};

export interface AlertProps extends Omit<ComponentPropsWithRef<"div">, "title"> {
  tone?: AlertTone;
  title?: ReactNode;
  icon?: ReactNode;
  children?: ReactNode;
}

export function Alert({ tone = "info", title, icon, className, children, ...props }: AlertProps) {
  const tokens = alertTones[tone];
  // Assertive for problems the user must act on; polite for neutral/positive.
  const role = tone === "danger" || tone === "warning" ? "alert" : "status";
  return (
    <div
      role={role}
      className={cx("flex items-start gap-3 rounded border px-4 py-3 font-sans", tokens.container, className)}
      {...props}
    >
      {icon && <span aria-hidden className={cx("mt-0.5 shrink-0", tokens.title)}>{icon}</span>}
      <div className="min-w-0 text-sm">
        {title && <p className={cx("font-medium", tokens.title)}>{title}</p>}
        {children && <div className={cx("text-text-secondary leading-relaxed", Boolean(title) && "mt-1")}>{children}</div>}
      </div>
    </div>
  );
}

/* ─── Skeleton ────────────────────────────────────────────────────── */

export type SkeletonShape = "line" | "block" | "circle";

const skeletonShapes: Record<SkeletonShape, string> = {
  line: "h-4 rounded",
  block: "rounded-lg",
  circle: "rounded-full aspect-square",
};

export interface SkeletonProps extends ComponentPropsWithRef<"div"> {
  shape?: SkeletonShape;
}

/** Loading placeholder. `animate-pulse` is neutralised by prefers-reduced-motion. */
export function Skeleton({ shape = "line", className, ...props }: SkeletonProps) {
  return (
    <div
      aria-hidden
      className={cx("animate-pulse bg-surface-sunken", skeletonShapes[shape], className)}
      {...props}
    />
  );
}

/* ─── EmptyState ──────────────────────────────────────────────────── */

export interface EmptyStateProps {
  title: string;
  body?: string;
  icon?: ReactNode;
  action?: ReactNode;
  className?: string;
}

/** Honest empty view — never fabricated data. */
export function EmptyState({ title, body, icon, action, className }: EmptyStateProps) {
  return (
    <div
      className={cx(
        "flex flex-col items-center gap-3 rounded-lg border border-dashed border-border bg-surface px-6 py-12 text-center",
        className,
      )}
    >
      {icon && (
        <span
          aria-hidden
          className="flex h-11 w-11 items-center justify-center rounded-full bg-primary/10 text-primary"
        >
          {icon}
        </span>
      )}
      <p className="font-sans text-base font-medium text-text-primary">{title}</p>
      {body && <p className="max-w-sm font-sans text-sm text-text-secondary leading-relaxed">{body}</p>}
      {action && <div className="mt-1">{action}</div>}
    </div>
  );
}

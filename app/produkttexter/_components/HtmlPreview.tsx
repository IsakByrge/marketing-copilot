// ─────────────────────────────────────────────────────────────
// Visar produkt-HTML som den kommer se ut i butiken.
//
// Både "före" och "efter" går genom sanitizeHtml först. Efter-texten är
// redan sanerad av servern; före-texten är butikens egen och kan innehålla
// vad som helst — den ska inte kunna köra något i vårt gränssnitt.
// ─────────────────────────────────────────────────────────────
import { sanitizeHtml } from "@/lib/productText/html";
import { cx } from "@/app/_shared/primitives";

export function HtmlPreview({ html, className }: { html: string; className?: string }) {
  if (!html.trim()) {
    return <p className={cx("text-sm italic text-text-tertiary", className)}>Ingen text.</p>;
  }
  return (
    <div
      className={cx(
        "space-y-2.5 text-sm leading-relaxed text-text-secondary",
        "[&_li]:ml-4 [&_li]:list-disc [&_p]:m-0 [&_strong]:text-text-primary [&_ul]:space-y-1",
        className,
      )}
      dangerouslySetInnerHTML={{ __html: sanitizeHtml(html) }}
    />
  );
}

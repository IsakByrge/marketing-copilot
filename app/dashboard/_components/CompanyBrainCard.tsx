import { ButtonLink, Card, Chip, type ChipTone } from "@/app/_shared/primitives";
import { IconCheck } from "@/app/_shared/icons";
import type { BrainLevel } from "./overviewLogic";

const LEVEL: Record<BrainLevel, { label: string; tone: ChipTone; line: string }> = {
  basic: {
    label: "Grundläggande",
    tone: "warning",
    line: "Din marknadschef känner till grunderna, men behöver mer för att kunna ge vassa råd.",
  },
  useful: {
    label: "Användbar",
    tone: "primary",
    line: "Din marknadschef förstår företaget tillräckligt för användbara rekommendationer.",
  },
  strong: {
    label: "Stark",
    tone: "success",
    line: "Din marknadschef har en stark bild av företaget att utgå från.",
  },
};

// Answers "Hur väl förstår AI:n mitt företag?" using real, deterministic
// Company Brain completeness — never a fabricated score.
export function CompanyBrainCard({ level, gaps }: { level: BrainLevel; gaps: string[] }) {
  const meta = LEVEL[level];
  return (
    <Card padding="md" className="flex h-full flex-col">
      <div className="mb-1 flex items-center justify-between gap-3">
        <h2 className="text-sm font-semibold text-text-primary">Företagskunskap</h2>
        <Chip tone={meta.tone}>{meta.label}</Chip>
      </div>
      <p className="text-sm leading-relaxed text-text-secondary">{meta.line}</p>

      <div className="mt-4 flex-1">
        {gaps.length > 0 ? (
          <>
            <p className="mb-2 text-xs font-medium uppercase tracking-wide text-text-tertiary">
              Det här skulle stärka underlaget
            </p>
            <ul className="flex flex-col gap-2">
              {gaps.map((g, i) => (
                <li key={i} className="flex items-start gap-2 text-sm text-text-secondary">
                  <span aria-hidden className="mt-0.5 h-1.5 w-1.5 shrink-0 rounded-full bg-border-strong" />
                  {g}
                </li>
              ))}
            </ul>
          </>
        ) : (
          <p className="flex items-center gap-2 text-sm text-success">
            <IconCheck size={16} />
            Inga kunskapsluckor kvar just nu.
          </p>
        )}
      </div>

      <div className="mt-5">
        <ButtonLink href="/company" variant="secondary" size="sm">
          Öppna Company Brain
        </ButtonLink>
      </div>
    </Card>
  );
}

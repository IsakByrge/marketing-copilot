import Link from "next/link";

const options = [
  "Kampanj",
  "Facebook-inlägg",
  "Instagram-inlägg",
  "Nyhetsbrev",
  "Kundutskick",
];

export default function CreatePage() {
  return (
    <main className="mc-page px-5 py-12 md:px-12 md:py-16">
      <div className="mx-auto max-w-4xl">
        <Link href="/dashboard" className="text-xs uppercase tracking-[0.1em] text-[var(--mc-subtle)] hover:text-[var(--mc-text)] transition-colors">
          ← Till dashboard
        </Link>

        <section className="mt-10 border border-[var(--mc-border)] bg-[var(--mc-surface)] p-8">
          <div className="mc-label mb-6">Quick Create</div>

          <h1 className="text-4xl leading-tight tracking-[-0.02em]">
            Vad vill du skapa?
          </h1>

          <p className="mt-4 max-w-2xl text-sm font-light leading-7 text-[var(--mc-muted)]">
            Använd detta när du vill skapa något direkt, utöver den automatiska
            veckoplanen.
          </p>

          <div className="mt-8 grid gap-3 md:grid-cols-2">
            {options.map((option) => (
              <button
                key={option}
                className="border border-[var(--mc-border)] bg-[var(--mc-surface-2)] p-6 text-left transition hover:border-[var(--mc-border-strong)]"
              >
                <h2 className="text-xl leading-tight tracking-[-0.01em]">{option}</h2>
                <p className="mt-2 text-sm font-light leading-6 text-[var(--mc-muted)]">
                  Skapa ett färdigt utkast anpassat efter ditt företag.
                </p>
              </button>
            ))}
          </div>

          <div className="mt-8">
            <label className="mb-3 block text-[0.7rem] font-light uppercase tracking-[0.12em] text-[var(--mc-subtle)]">
              Kort instruktion
            </label>
            <textarea
              className="mc-textarea"
              placeholder="Ex. Skapa en kampanj inför midsommar med fokus på gasol till grill och husbil."
            />
          </div>

          <button className="mc-btn-primary mt-6 w-full">
            Skapa innehåll
          </button>
        </section>
      </div>
    </main>
  );
}

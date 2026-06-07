export default function Home() {
  return (
    <main className="min-h-screen bg-[#F7F4EF] text-[#171717]">
      <section className="mx-auto max-w-6xl px-6 py-8">
        <nav className="flex items-center justify-between">
          <div className="text-xl font-semibold">Marketing Copilot</div>
          <button className="rounded-full bg-black px-5 py-2 text-sm text-white">
            Testa gratis
          </button>
        </nav>

        <div className="grid gap-12 py-24 md:grid-cols-2 md:items-center">
          <div>
            <p className="mb-4 text-sm font-medium text-[#4F7D5A]">
              För små företag som vill synas oftare
            </p>

            <h1 className="mb-6 text-5xl font-semibold tracking-tight md:text-6xl">
              Din marknadsplan är klar.
            </h1>

            <p className="mb-8 max-w-xl text-lg leading-8 text-neutral-600">
              Varje vecka får du färdiga sociala medier-inlägg, nyhetsbrev och
              kampanjidéer – anpassade efter din bransch, säsong och företagets
              fokus.
            </p>

            <div className="flex gap-3">
              <button className="rounded-full bg-black px-6 py-3 text-white">
                Kom igång
              </button>
              <button className="rounded-full border border-neutral-300 px-6 py-3">
                Se exempel
              </button>
            </div>
          </div>

          <div className="rounded-[2rem] bg-white p-5 shadow-2xl shadow-black/10">
            <div className="mb-5 rounded-3xl bg-[#EDF7EF] p-5">
              <p className="text-sm text-neutral-500">Vecka 24</p>
              <h2 className="mt-1 text-2xl font-semibold">
                Din marknadsplan är klar
              </h2>
              <p className="mt-2 text-neutral-600">
                Rekommenderat fokus: Sommarkampanj
              </p>
            </div>

            <div className="space-y-3">
              {[
                "5 sociala medier-inlägg",
                "1 färdigt nyhetsbrev",
                "2 kampanjidéer",
                "Bildidéer och CTA:er",
              ].map((item) => (
                <div
                  key={item}
                  className="flex items-center justify-between rounded-2xl border border-neutral-100 p-4"
                >
                  <span>{item}</span>
                  <span className="text-sm text-[#4F7D5A]">Redo</span>
                </div>
              ))}
            </div>

            <button className="mt-5 w-full rounded-2xl bg-black py-4 text-white">
              Granska veckans plan
            </button>
          </div>
        </div>
      </section>
    </main>
  );
}
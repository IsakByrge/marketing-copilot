import Link from "next/link";

const socialPosts = [
  {
    title: "5 tips för säker grillning i sommar",
    text: "Sommaren är här och många plockar fram grillen. Kontrollera alltid slangar, kopplingar och gasolflaska innan du börjar grilla.",
    cta: "Kom in till oss om du vill fylla på eller kontrollera din gasol.",
    imageIdea: "En familj som grillar ute en sommarkväll.",
  },
  {
    title: "Är gasolflaskan redo för semestern?",
    text: "Innan du ger dig iväg med husbil eller husvagn är det klokt att se över gasolen. En snabb kontroll kan göra resan tryggare.",
    cta: "Besök oss innan avresa.",
    imageIdea: "Husbil på campingplats med gasolflaska i förgrunden.",
  },
  {
    title: "Gasol till grill, camping och husbil",
    text: "Vi hjälper dig med gasolpåfyllning inför sommarens grillkvällar, campingresor och utflykter.",
    cta: "Fyll på hos oss idag.",
    imageIdea: "Gasolflaskor uppradade i butiksmiljö.",
  },
  {
    title: "Så förvarar du gasol säkert",
    text: "Gasol ska alltid förvaras stående, ventilerat och skyddat från stark värme. En enkel vana som gör stor skillnad.",
    cta: "Fråga oss gärna om säker gasolförvaring.",
    imageIdea: "Ren och trygg förvaringsplats för gasol.",
  },
  {
    title: "Dags att byta gasolflaska?",
    text: "Osäker på om flaskan räcker till helgen? Kom förbi så hjälper vi dig att fylla på inför grillning, camping eller resa.",
    cta: "Vi hjälper dig snabbt på plats.",
    imageIdea: "Kund som lämnar in gasolflaska för påfyllning.",
  },
];

export default function PlanPage() {
  return (
    <main className="min-h-screen bg-[#F8F6F2] text-neutral-950">
      <div className="mx-auto max-w-7xl px-6 py-8">
        <div className="mb-8 flex items-center justify-between">
          <div>
            <Link href="/generating" className="text-sm text-neutral-600 hover:text-black">
              ← Till dashboard
            </Link>
            <h1 className="mt-3 text-4xl font-bold tracking-tight text-neutral-950">
              Veckans marknadsplan
            </h1>
            <p className="mt-2 max-w-2xl text-neutral-600">
              Allt material är färdigt att granska, kopiera och publicera.
            </p>
          </div>

          <div className="hidden rounded-2xl bg-white px-5 py-3 shadow-sm md:block">
            <p className="text-sm text-neutral-500">Status</p>
            <p className="font-semibold text-green-700">Redo</p>
          </div>
        </div>

        <section className="mb-8 rounded-3xl bg-neutral-950 p-8 text-white">
          <p className="mb-2 text-sm uppercase tracking-widest text-neutral-400">
            Rekommenderat fokus
          </p>
          <h2 className="text-3xl font-bold">Sommarens gasolsäsong</h2>
          <p className="mt-3 max-w-3xl text-neutral-300">
            Den här veckan bör innehållet fokusera på grillning, camping,
            husbil och säker gasolhantering inför semestern.
          </p>
        </section>

        <section className="mb-10">
          <div className="mb-5 flex items-center justify-between">
            <h2 className="text-2xl font-bold text-neutral-950">
              5 sociala medier-inlägg
            </h2>
            <span className="rounded-full bg-white px-4 py-2 text-sm text-neutral-600 shadow-sm">
              Facebook / Instagram
            </span>
          </div>

          <div className="grid gap-5 lg:grid-cols-2">
            {socialPosts.map((post, index) => (
              <article key={post.title} className="rounded-3xl bg-white p-6 shadow-sm">
                <div className="mb-4 flex items-center justify-between">
                  <span className="rounded-full bg-[#EDF7EF] px-3 py-1 text-sm font-medium text-green-800">
                    Inlägg {index + 1}
                  </span>
                  <div className="flex gap-2">
                    <button className="rounded-full bg-neutral-100 px-3 py-1 text-sm text-neutral-700">
                      👍
                    </button>
                    <button className="rounded-full bg-neutral-100 px-3 py-1 text-sm text-neutral-700">
                      👎
                    </button>
                  </div>
                </div>

                <h3 className="mb-3 text-xl font-bold text-neutral-950">
                  {post.title}
                </h3>

                <div className="space-y-4 text-neutral-700">
                  <div>
                    <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-neutral-500">
                      Text
                    </p>
                    <p>{post.text}</p>
                  </div>

                  <div>
                    <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-neutral-500">
                      CTA
                    </p>
                    <p>{post.cta}</p>
                  </div>

                  <div>
                    <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-neutral-500">
                      Bildidé
                    </p>
                    <p>{post.imageIdea}</p>
                  </div>
                </div>

                <button className="mt-5 w-full rounded-2xl bg-neutral-950 py-3 font-medium text-white">
                  Kopiera text
                </button>
              </article>
            ))}
          </div>
        </section>

        <section className="grid gap-6 lg:grid-cols-2">
          <article className="rounded-3xl bg-white p-6 shadow-sm">
            <span className="rounded-full bg-[#EEF2FF] px-3 py-1 text-sm font-medium text-indigo-700">
              Nyhetsbrev
            </span>

            <h2 className="mt-4 text-2xl font-bold text-neutral-950">
              Sommarens checklista för säker gasol
            </h2>

            <div className="mt-5 space-y-4 text-neutral-700">
              <p>
                <strong>Ämnesrad:</strong> Är din gasol redo för sommaren?
              </p>
              <p>
                <strong>Förhandsvisning:</strong> En enkel checklista inför grillning,
                camping och semester.
              </p>
              <p>
                Sommaren innebär mer grillning, fler resor och mer användning av
                gasol. Därför är det ett bra tillfälle att kontrollera flaskor,
                slangar och kopplingar innan semestern börjar.
              </p>
              <p>
                Hos oss kan du få hjälp med gasolpåfyllning och råd kring säker
                hantering.
              </p>
              <p>
                <strong>CTA:</strong> Kom förbi innan semestern så hjälper vi dig.
              </p>
            </div>

            <button className="mt-6 w-full rounded-2xl bg-neutral-950 py-3 font-medium text-white">
              Kopiera nyhetsbrev
            </button>
          </article>

          <article className="rounded-3xl bg-white p-6 shadow-sm">
            <span className="rounded-full bg-[#FFF7ED] px-3 py-1 text-sm font-medium text-orange-700">
              Kampanjidéer
            </span>

            <h2 className="mt-4 text-2xl font-bold text-neutral-950">
              2 kampanjer för veckan
            </h2>

            <div className="mt-5 space-y-5">
              <div className="rounded-2xl border border-neutral-200 p-4">
                <h3 className="font-bold text-neutral-950">
                  Semesterklar gasol
                </h3>
                <p className="mt-2 text-neutral-700">
                  Erbjud snabb kontroll och påfyllning för husbils- och
                  husvagnsägare inför semestern.
                </p>
              </div>

              <div className="rounded-2xl border border-neutral-200 p-4">
                <h3 className="font-bold text-neutral-950">
                  Grillhelg-kampanj
                </h3>
                <p className="mt-2 text-neutral-700">
                  Påminn kunder om att fylla på gasol inför helgens grillning.
                  Enkel kampanj med lokal räckvidd.
                </p>
              </div>
            </div>

            <button className="mt-6 w-full rounded-2xl bg-neutral-950 py-3 font-medium text-white">
              Kopiera kampanjidéer
            </button>
          </article>
        </section>
      </div>
    </main>
  );
}
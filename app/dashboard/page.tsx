import Link from "next/link";

const items = [
  "5 sociala inlägg klara",
  "1 nyhetsbrev klart",
  "2 kampanjidéer klara",
];

export default function DashboardPage() {
  return (
    <main className="min-h-screen bg-[#F8F6F2] text-neutral-950">
      <div className="mx-auto max-w-7xl px-6 py-8">
        <nav className="mb-10 flex items-center justify-between">
          <Link href="/" className="text-xl font-bold">
            Marketing Copilot
          </Link>

          <Link
            href="/create"
            className="rounded-full bg-neutral-950 px-5 py-3 text-sm font-medium text-white"
          >
            + Skapa direkt
          </Link>
        </nav>

        <section className="mb-8 rounded-[2rem] bg-white p-8 shadow-sm">
          <p className="text-sm font-medium text-green-700">
            Vecka 24 • Autopilot aktiv
          </p>

          <div className="mt-4 grid gap-8 lg:grid-cols-[1.5fr_1fr] lg:items-end">
            <div>
              <h1 className="max-w-3xl text-5xl font-bold tracking-tight">
                God morgon Isak 👋
                <br />
                Din marknadsplan är klar.
              </h1>

              <p className="mt-5 max-w-2xl text-lg leading-8 text-neutral-600">
                AI:n har tagit fram veckans innehåll baserat på bransch,
                säsong och företagets fokusområden.
              </p>
            </div>

            <div className="rounded-3xl bg-[#EDF7EF] p-6">
              <p className="text-sm font-medium text-green-800">
                Rekommenderat fokus
              </p>
              <h2 className="mt-2 text-3xl font-bold">
                Sommarens gasolsäsong
              </h2>
              <div className="mt-5 flex flex-wrap gap-2">
                {["Camping", "Grillning", "Husbil", "Säkerhet"].map((tag) => (
                  <span
                    key={tag}
                    className="rounded-full bg-white px-4 py-2 text-sm font-medium text-neutral-800"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section className="mb-8 grid gap-6 lg:grid-cols-3">
          <div className="rounded-[2rem] bg-neutral-950 p-7 text-white lg:col-span-2">
            <p className="text-sm uppercase tracking-widest text-neutral-400">
              Veckans leverans
            </p>

            <div className="mt-6 space-y-4">
              {items.map((item) => (
                <div key={item} className="flex items-center gap-3">
                  <div className="flex h-7 w-7 items-center justify-center rounded-full bg-green-500 text-sm text-white">
                    ✓
                  </div>
                  <p className="text-lg font-medium">{item}</p>
                </div>
              ))}
            </div>

            <Link
              href="/plan"
              className="mt-8 inline-flex rounded-2xl bg-white px-6 py-4 font-medium text-neutral-950"
            >
              Granska veckans plan
            </Link>
          </div>

          <div className="rounded-[2rem] bg-white p-7 shadow-sm">
            <p className="text-sm font-medium text-neutral-500">
              Status
            </p>
            <h3 className="mt-3 text-4xl font-bold">
              100%
            </h3>
            <p className="mt-2 text-neutral-600">
              Allt material är redo att granskas och publiceras.
            </p>

            <div className="mt-6 rounded-2xl bg-[#F8F6F2] p-4">
              <p className="text-sm text-neutral-500">
                Nästa plan skapas
              </p>
              <p className="mt-1 font-semibold">
                Måndag 15 juni
              </p>
            </div>
          </div>
        </section>

        <section className="mb-8 rounded-[2rem] bg-white p-7 shadow-sm">
          <div className="mb-6 flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-neutral-500">
                Quick Create
              </p>
              <h2 className="text-2xl font-bold">
                Skapa något direkt
              </h2>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            <QuickCard
              title="Ny kampanj"
              text="För erbjudanden, kampanjveckor och säsongsinsatser."
            />
            <QuickCard
              title="Socialt inlägg"
              text="När du snabbt behöver posta något idag."
            />
            <QuickCard
              title="Nyhetsbrev"
              text="Skapa ett kundutskick för mail."
            />
          </div>
        </section>

        <section className="grid gap-6 lg:grid-cols-3">
          <Insight title="Camping" value="+34%" />
          <Insight title="Grillning" value="+18%" />
          <Insight title="Gasolpåfyllning" value="+12%" />
        </section>
      </div>
    </main>
  );
}

function QuickCard({ title, text }: { title: string; text: string }) {
  return (
    <Link
      href="/create"
      className="rounded-3xl border border-neutral-200 p-5 transition hover:border-neutral-950 hover:bg-[#FAFAFA]"
    >
      <h3 className="text-lg font-bold">{title}</h3>
      <p className="mt-2 text-sm leading-6 text-neutral-600">{text}</p>
    </Link>
  );
}

function Insight({ title, value }: { title: string; value: string }) {
  return (
    <div className="rounded-3xl bg-white p-6 shadow-sm">
      <p className="text-sm text-neutral-500">AI-insikt</p>
      <h3 className="mt-2 text-2xl font-bold">{title}</h3>
      <p className="mt-3 text-4xl font-bold text-green-700">{value}</p>
      <p className="mt-2 text-sm text-neutral-600">
        Ökat intresse denna period
      </p>
    </div>
  );
}
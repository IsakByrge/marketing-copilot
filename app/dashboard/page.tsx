import Link from "next/link";
import { companies, getRandomPlan } from "@/lib/mockPlans";

export default function DashboardPage() {
  const plan = getRandomPlan();

  return (
    <main className="min-h-screen bg-[#F8F6F2] text-neutral-950">
      <div className="mx-auto max-w-7xl px-6 py-8">
        <nav className="mb-10 flex items-center justify-between">
          <div>
            <p className="text-sm text-neutral-500">Aktivt företag</p>
            <select className="mt-1 rounded-2xl border border-neutral-200 bg-white px-4 py-3 font-semibold shadow-sm">
              {companies.map((company) => (
                <option key={company.name}>{company.name}</option>
              ))}
            </select>
          </div>

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
                {plan.company}
                <br />
                Marknadsplanen är klar.
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
              <h2 className="mt-2 text-3xl font-bold">{plan.focus}</h2>
              <div className="mt-5 flex flex-wrap gap-2">
                {plan.tags.map((tag) => (
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
              {[
                "5 sociala inlägg klara",
                "1 nyhetsbrev klart",
                "2 kampanjidéer klara",
              ].map((item) => (
                <div key={item} className="flex items-center gap-3">
                  <div className="flex h-7 w-7 items-center justify-center rounded-full bg-green-500 text-sm text-white">
                    ✓
                  </div>
                  <p className="text-lg font-medium">{item}</p>
                </div>
              ))}
            </div>

            <div className="mt-8 flex flex-wrap gap-3">
              <Link
                href="/plan"
                className="rounded-2xl bg-white px-6 py-4 font-medium text-neutral-950"
              >
                Granska veckans plan
              </Link>

              <Link
                href="/generating"
                className="rounded-2xl border border-white/20 px-6 py-4 font-medium text-white"
              >
                Generera ny plan
              </Link>
            </div>
          </div>

          <div className="rounded-[2rem] bg-white p-7 shadow-sm">
            <p className="text-sm font-medium text-neutral-500">Status</p>
            <h3 className="mt-3 text-4xl font-bold">100%</h3>
            <p className="mt-2 text-neutral-600">
              Allt material är redo att granskas och publiceras.
            </p>

            <div className="mt-6 rounded-2xl bg-[#F8F6F2] p-4">
              <p className="text-sm text-neutral-500">Nästa plan skapas</p>
              <p className="mt-1 font-semibold">Måndag 15 juni</p>
            </div>
          </div>
        </section>

        <section className="rounded-[2rem] bg-white p-7 shadow-sm">
          <p className="text-sm font-medium text-neutral-500">Förhandsvisning</p>
          <h2 className="mt-1 text-2xl font-bold">Klickbara inlägg</h2>

          <div className="mt-6 grid gap-4 md:grid-cols-3">
            {plan.posts.map((post, index) => (
              <Link
                key={post.title}
                href={`/plan#post-${index + 1}`}
                className="rounded-3xl border border-neutral-200 p-5 transition hover:border-neutral-950 hover:bg-[#FAFAFA]"
              >
                <p className="text-sm text-green-700">Inlägg {index + 1}</p>
                <h3 className="mt-2 font-bold">{post.title}</h3>
                <p className="mt-2 text-sm text-neutral-600">Öppna →</p>
              </Link>
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}
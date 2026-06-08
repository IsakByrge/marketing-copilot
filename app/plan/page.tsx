import Link from "next/link";
import { plans } from "@/lib/mockPlans";

export default async function PlanPage({
  searchParams,
}: {
  searchParams: Promise<{ company?: string; plan?: string }>;
}) {
  const params = await searchParams;

  const company = params.company;
  const planIndex = Number(params.plan ?? 0);

  const companyPlans = plans.filter((item) => item.company === company);
  const plan = companyPlans[planIndex] ?? plans[0];

  return (
    <main className="min-h-screen bg-[#F8F6F2] px-6 py-8 text-neutral-950">
      <div className="mx-auto max-w-7xl">
        <nav className="mb-8 flex items-center justify-between">
          <Link href="/dashboard" className="text-sm text-neutral-600">
            ← Till dashboard
          </Link>

          <Link
            href="/dashboard"
            className="rounded-full bg-neutral-950 px-5 py-3 text-sm font-medium text-white"
          >
            Generera ny plan
          </Link>
        </nav>

        <section className="mb-8 rounded-[2rem] bg-neutral-950 p-8 text-white">
          <p className="text-sm uppercase tracking-widest text-neutral-400">
            Vecka 24 • {plan.company}
          </p>

          <h1 className="mt-3 text-5xl font-bold tracking-tight">
            {plan.focus}
          </h1>

          <p className="mt-4 max-w-2xl text-neutral-300">
            Färdigt material för sociala medier, nyhetsbrev och kampanjer.
            Granska, kopiera och publicera.
          </p>

          <div className="mt-6 flex flex-wrap gap-2">
            {plan.tags.map((tag) => (
              <span
                key={tag}
                className="rounded-full bg-white/10 px-4 py-2 text-sm text-white"
              >
                {tag}
              </span>
            ))}
          </div>
        </section>

        <section className="mb-10 grid gap-5 md:grid-cols-3">
          <Summary title="Sociala inlägg" value="5" />
          <Summary title="Nyhetsbrev" value="1" />
          <Summary title="Kampanjidéer" value="2" />
        </section>

        <section className="mb-10">
          <h2 className="mb-5 text-2xl font-bold">Sociala medier</h2>

          <div className="grid gap-5 lg:grid-cols-3">
            {plan.posts.map((post, index) => (
              <article
                id={`post-${index + 1}`}
                key={`${plan.id}-${post.title}`}
                className="rounded-[2rem] bg-white p-6 shadow-sm"
              >
                <div className="mb-4 flex items-center justify-between">
                  <span className="rounded-full bg-[#EDF7EF] px-3 py-1 text-sm font-medium text-green-800">
                    Inlägg {index + 1}
                  </span>

                  <div className="flex gap-2">
                    <button className="rounded-full bg-neutral-100 px-3 py-1">
                      👍
                    </button>
                    <button className="rounded-full bg-neutral-100 px-3 py-1">
                      👎
                    </button>
                  </div>
                </div>

                <h3 className="text-xl font-bold">{post.title}</h3>

                <div className="mt-5 space-y-4 text-sm leading-6 text-neutral-700">
                  <Block label="Text" text={post.text} />
                  <Block label="CTA" text={post.cta} />
                  <Block label="Bildidé" text={post.image} />
                </div>

                <button className="mt-6 w-full rounded-2xl bg-neutral-950 py-3 font-medium text-white">
                  Kopiera inlägg
                </button>
              </article>
            ))}
          </div>
        </section>

        <section className="grid gap-6 lg:grid-cols-2">
          <article className="rounded-[2rem] bg-white p-7 shadow-sm">
            <span className="rounded-full bg-[#EEF2FF] px-3 py-1 text-sm font-medium text-indigo-700">
              Nyhetsbrev
            </span>

            <h2 className="mt-4 text-2xl font-bold">
              Nyhetsbrev: {plan.focus}
            </h2>

            <div className="mt-5 space-y-4 text-neutral-700">
              <p>
                <strong>Ämnesrad:</strong> Är du redo för{" "}
                {plan.focus.toLowerCase()}?
              </p>

              <p>
                <strong>Förhandsvisning:</strong> En enkel påminnelse med tips,
                råd och nästa steg.
              </p>

              <p>
                Den här veckan fokuserar vi på {plan.focus.toLowerCase()}. Det
                är ett bra tillfälle att nå kunderna med relevant information
                och tydliga erbjudanden.
              </p>

              <p>
                <strong>CTA:</strong> Kontakta oss eller besök webben för mer
                information.
              </p>
            </div>

            <button className="mt-6 w-full rounded-2xl bg-neutral-950 py-3 font-medium text-white">
              Kopiera nyhetsbrev
            </button>
          </article>

          <article className="rounded-[2rem] bg-white p-7 shadow-sm">
            <span className="rounded-full bg-[#FFF7ED] px-3 py-1 text-sm font-medium text-orange-700">
              Kampanjidéer
            </span>

            <h2 className="mt-4 text-2xl font-bold">
              Rekommenderade kampanjer
            </h2>

            <div className="mt-5 space-y-4">
              <Campaign
                title={`${plan.focus}: kampanjvecka`}
                text="Skapa en kort kampanj med tydlig period, tydlig CTA och lokal relevans."
              />

              <Campaign
                title="Påminnelsekampanj"
                text="Påminn kunderna om varför detta är relevant just nu och gör det enkelt att agera."
              />
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

function Summary({ title, value }: { title: string; value: string }) {
  return (
    <div className="rounded-[2rem] bg-white p-6 shadow-sm">
      <p className="text-sm text-neutral-500">{title}</p>
      <p className="mt-2 text-4xl font-bold">{value}</p>
      <p className="mt-1 text-sm text-green-700">Redo att granska</p>
    </div>
  );
}

function Block({ label, text }: { label: string; text: string }) {
  return (
    <div>
      <p className="mb-1 text-xs font-bold uppercase tracking-wide text-neutral-500">
        {label}
      </p>
      <p>{text}</p>
    </div>
  );
}

function Campaign({ title, text }: { title: string; text: string }) {
  return (
    <div className="rounded-2xl border border-neutral-200 p-4">
      <h3 className="font-bold">{title}</h3>
      <p className="mt-2 text-sm leading-6 text-neutral-600">{text}</p>
    </div>
  );
}
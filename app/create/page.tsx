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
    <main className="min-h-screen bg-[#F8F6F2] px-6 py-8 text-neutral-950">
      <div className="mx-auto max-w-4xl">
        <Link href="/dashboard" className="text-sm text-neutral-600">
          ← Till dashboard
        </Link>

        <section className="mt-8 rounded-[2rem] bg-white p-8 shadow-sm">
          <p className="text-sm font-medium text-green-700">
            Quick Create
          </p>

          <h1 className="mt-3 text-4xl font-bold">
            Vad vill du skapa?
          </h1>

          <p className="mt-3 max-w-2xl text-neutral-600">
            Använd detta när du vill skapa något direkt, utöver den automatiska
            veckoplanen.
          </p>

          <div className="mt-8 grid gap-4 md:grid-cols-2">
            {options.map((option) => (
              <button
                key={option}
                className="rounded-3xl border border-neutral-200 p-6 text-left transition hover:border-neutral-950 hover:bg-[#FAFAFA]"
              >
                <h2 className="text-xl font-bold">{option}</h2>
                <p className="mt-2 text-sm text-neutral-600">
                  Skapa ett färdigt utkast anpassat efter ditt företag.
                </p>
              </button>
            ))}
          </div>

          <div className="mt-8">
            <label className="mb-2 block text-sm font-medium">
              Kort instruktion
            </label>
            <textarea
              className="min-h-32 w-full rounded-2xl border border-neutral-200 bg-[#FAFAFA] p-4 outline-none focus:border-black focus:bg-white"
              placeholder="Ex. Skapa en kampanj inför midsommar med fokus på gasol till grill och husbil."
            />
          </div>

          <button className="mt-6 w-full rounded-2xl bg-neutral-950 py-4 font-medium text-white">
            Skapa innehåll
          </button>
        </section>
      </div>
    </main>
  );
}
export default async function PostPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  return (
    <main className="min-h-screen bg-[#F8F6F2] p-8 text-neutral-950">
      <div className="mx-auto max-w-3xl rounded-[2rem] bg-white p-8 shadow-sm">
        <p className="text-sm text-green-700">
          Socialt inlägg #{id}
        </p>

        <h1 className="mt-3 text-4xl font-bold">
          5 tips för säker grillning
        </h1>

        <div className="mt-8 space-y-6">
          <div>
            <p className="mb-2 text-sm font-bold uppercase">
              Text
            </p>

            <p>
              Sommaren är här och många plockar fram grillen.
              Kontrollera alltid slangar, kopplingar och
              gasolflaska innan användning.
            </p>
          </div>

          <div>
            <p className="mb-2 text-sm font-bold uppercase">
              CTA
            </p>

            <p>
              Kom förbi oss för gasolpåfyllning.
            </p>
          </div>

          <div>
            <p className="mb-2 text-sm font-bold uppercase">
              Bildidé
            </p>

            <p>
              Familj som grillar ute en sommarkväll.
            </p>
          </div>
        </div>

        <div className="mt-8 flex gap-3">
          <button className="rounded-2xl bg-black px-6 py-3 text-white">
            Kopiera
          </button>

          <button className="rounded-2xl bg-green-100 px-6 py-3">
            👍
          </button>

          <button className="rounded-2xl bg-red-100 px-6 py-3">
            👎
          </button>
        </div>
      </div>
    </main>
  );
}
"use client";

// ─────────────────────────────────────────────────────────────
// Landningssidan efter en inloggningslänk.
//
// Sidan hängde tidigare på "LOGGAR IN…" i all oändlighet. Två skäl,
// båda åtgärdade här:
//
// 1. Supabase lämnar sina fel i adressen — ?error_description=… vid
//    PKCE och #error=… vid implicit flöde. Sidan läste varken det ena
//    eller det andra, så en utgången länk såg ut som en sida som
//    laddar.
// 2. getUser() kan ta godtyckligt lång tid — nätet, en låst
//    lagringsnyckel i en annan flik, en Supabase-värd som inte svarar.
//    Utan tidsgräns blir det en evig spinner.
//
// Därför: läs felet först, och kör hela turen mot en klocka. Den som
// inte kommer in ska få veta det och komma vidare, inte sitta och titta
// på en spinner.
//
// Den gamla versionen skickade dessutom vidare till /login när ingen
// session fanns. Eftersom proxyn skickar en inloggad besökare hit från
// /login blev det en studsmatta mellan två sidor så fort sessionen var
// halvtrasig. Nu stannar sidan och säger vad som hände.
// ─────────────────────────────────────────────────────────────
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase-browser";
import { Alert, ButtonLink, Spinner } from "@/app/_shared/primitives";
import AuthRam from "@/app/_shared/AuthRam";

/** Hur länge vi väntar innan vi ger upp. Långt nog för ett trögt nät,
 *  kort nog att ingen hinner tro att sidan är död. */
const TIDSGRANS_MS = 8000;

/** Supabase svarar på engelska. Det här är de fel en riktig användare
 *  faktiskt möter — resten faller tillbaka på en ärlig allmän text. */
function oversatt(rad: string): string {
  const r = rad.toLowerCase();
  if (r.includes("expired")) return "Länken har gått ut. Beställ en ny och försök igen.";
  if (r.includes("invalid") || r.includes("not found"))
    return "Länken gäller inte längre. Den kan redan ha använts.";
  if (r.includes("access_denied") || r.includes("denied"))
    return "Inloggningen avbröts.";
  if (r.includes("code verifier") || r.includes("verifier"))
    return "Länken måste öppnas i samma webbläsare som du beställde den från.";
  return rad;
}

/** Felet gömmer sig i frågesträngen ELLER i fragmentet, beroende på
 *  vilket flöde Supabase använde. Läs båda — det är just det här sidan
 *  inte gjorde, och därför såg en utgången länk ut som en sida som
 *  laddar. */
function urAdressen(): string | null {
  if (typeof window === "undefined") return null;
  const fraga = new URLSearchParams(window.location.search);
  const fragment = new URLSearchParams(window.location.hash.replace(/^#/, ""));
  const las = (namn: string) => fraga.get(namn) ?? fragment.get(namn);
  return las("error_description") ?? las("error") ?? null;
}

export default function AuthCallback() {
  const router = useRouter();
  const [fel, setFel] = useState<string | null>(null);

  useEffect(() => {
    let avbruten = false;
    const sb = createClient();

    async function route(): Promise<string | null> {
      const felIAdressen = urAdressen();
      if (felIAdressen) return oversatt(felIAdressen);

      // Ingen exchangeCodeForSession här. createBrowserClient sätter
      // detectSessionInUrl, så klienten växlar in ?code= själv när den
      // startar. Ett eget anrop skulle träffa en kod som redan är
      // förbrukad och ge felsida på en inloggning som faktiskt lyckades.
      const { data: { user } } = await sb.auth.getUser();
      if (!user) return "Vi hittade ingen inloggning. Logga in igen så ordnar det sig.";

      // Har användaren ett företag går hen till Idag, annars till
      // onboarding. Ett fel här är inte ett inloggningsfel — hen ÄR
      // inloggad — så vi skickar till onboarding i stället för att
      // stoppa på en felsida.
      const { data: companies } = await sb
        .from("companies")
        .select("id")
        .eq("user_id", user.id)
        .limit(1);
      router.replace(companies && companies.length > 0 ? "/dashboard" : "/onboarding");
      return null;
    }

    // Klockan går parallellt. Vinner den har något hängt sig, och då är
    // ett besked bättre än att vänta vidare.
    const klocka = new Promise<string>((res) =>
      setTimeout(() => res("Det tog för lång tid att logga in. Försök igen."), TIDSGRANS_MS),
    );

    Promise.race([route(), klocka])
      .then((meddelande) => { if (!avbruten && meddelande) setFel(meddelande); })
      .catch(() => { if (!avbruten) setFel("Något gick fel under inloggningen."); });

    return () => { avbruten = true; };
  }, [router]);

  return (
    <AuthRam>
      {fel ? (
        <div>
          <h1 className="text-[clamp(1.6rem,4vw,2rem)] font-semibold leading-tight tracking-tight">
            Inloggningen gick inte igenom.
          </h1>
          <Alert tone="danger" title="Det gick inte" className="mt-5">
            {fel}
          </Alert>
          <ButtonLink href="/login" className="mt-6 w-full">
            Till inloggningen
          </ButtonLink>
        </div>
      ) : (
        <p
          aria-live="polite"
          className="flex items-center gap-3 text-sm text-text-secondary"
        >
          <Spinner />
          Loggar in…
        </p>
      )}
    </AuthRam>
  );
}

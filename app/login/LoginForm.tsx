"use client";

// ─────────────────────────────────────────────────────────────
// Logga in, skapa konto och beställ återställningslänk.
//
// Läget styrs av ?mode i adressen: "Kom igång" på startsidan går till
// /login?mode=signup och landar direkt på registrering, medan "Logga
// in" i huvudet hamnar på inloggning. Det gör att rubriken stämmer med
// vad besökaren tryckte på.
//
// useSearchParams kräver en Suspense-gräns på en förrenderad rutt —
// den ligger i page.tsx, som är enda skälet till att formuläret bor i
// en egen fil.
//
// Inloggningslogiken är oförändrad sedan tidigare: samma Supabase-
// anrop, samma översatta fel, samma val av målsida.
// ─────────────────────────────────────────────────────────────
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useState } from "react";
import { createClient } from "@/lib/supabase-browser";
import { Alert, Button, Field, Input } from "@/app/_shared/primitives";

type Mode = "login" | "signup" | "forgot";

/** Dit återställningslänken i mejlet pekar. Måste finnas i Supabase
 *  under Authentication → URL Configuration → Redirect URLs. */
export const RESET_PATH = "/auth/reset";

export default function LoginForm() {
  const params = useSearchParams();
  const [mode, setMode] = useState<Mode>(
    params.get("mode") === "signup" ? "signup" : "login",
  );
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  function byt(nytt: Mode) {
    setMode(nytt);
    setError(null);
    setSent(false);
  }

  async function handleSubmit() {
    setError(null);
    if (mode === "forgot") return handleReset();

    if (!email.trim() || !password.trim()) {
      setError("Fyll i både e-post och lösenord.");
      return;
    }
    if (password.length < 6) {
      setError("Lösenordet måste vara minst 6 tecken.");
      return;
    }

    setLoading(true);
    const sb = createClient();

    try {
      if (mode === "signup") {
        const { error } = await sb.auth.signUp({ email: email.trim(), password });
        if (error) { setError(oversatt(error.message)); setLoading(false); return; }
      } else {
        const { error } = await sb.auth.signInWithPassword({ email: email.trim(), password });
        if (error) { setError(oversatt(error.message)); setLoading(false); return; }
      }

      const { data: { user } } = await sb.auth.getUser();
      let target = "/onboarding";
      if (user) {
        const { data: companies } = await sb
          .from("companies")
          .select("id")
          .eq("user_id", user.id)
          .limit(1);
        if (companies && companies.length > 0) target = "/dashboard";
      }
      // Full omladdning så att sessionscookien hinner följa med.
      window.location.assign(target);

    } catch {
      setError("Något gick fel. Försök igen.");
      setLoading(false);
    }
  }

  async function handleReset() {
    if (!email.trim()) {
      setError("Skriv din e-postadress först.");
      return;
    }
    setLoading(true);
    try {
      const sb = createClient();
      const { error } = await sb.auth.resetPasswordForEmail(email.trim(), {
        redirectTo: `${window.location.origin}${RESET_PATH}`,
      });
      if (error) { setError(oversatt(error.message)); setLoading(false); return; }
      // Bekräftar aldrig om adressen finns — det skulle avslöja vilka
      // som är kunder. Samma svar oavsett.
      setSent(true);
    } catch {
      setError("Kunde inte skicka just nu. Försök igen om en stund.");
    } finally {
      setLoading(false);
    }
  }

  function oversatt(msg: string) {
    if (msg.includes("Invalid login credentials")) return "Fel e-post eller lösenord.";
    if (msg.includes("already registered")) return "E-posten är redan registrerad. Logga in istället.";
    if (msg.includes("User already registered")) return "E-posten är redan registrerad. Logga in istället.";
    if (msg.toLowerCase().includes("rate limit")) return "För många försök. Vänta en stund och försök igen.";
    return msg;
  }

  const rubrik =
    mode === "signup" ? "Skapa konto"
      : mode === "forgot" ? "Glömt lösenordet?"
        : "Välkommen tillbaka.";

  const ingress =
    mode === "signup" ? "E-post och lösenord räcker. Inget kort, ingen uppsägningstid."
      : mode === "forgot" ? "Skriv din e-postadress, så skickar vi en länk där du kan välja ett nytt lösenord."
        : "Logga in för att se veckans texter.";

  return (
    <div className="w-full max-w-sm">
      <h1 className="text-[clamp(1.6rem,4vw,2rem)] font-semibold leading-tight tracking-tight">
        {rubrik}
      </h1>
      <p className="mt-3 text-[15px] leading-relaxed text-text-secondary">{ingress}</p>

      {sent ? (
        <>
          <Alert tone="success" title="Länken är skickad" className="mt-6">
            Om det finns ett konto på {email.trim()} ligger ett mejl på väg. Länken gäller
            en timme. Kolla skräpposten om den inte dyker upp.
          </Alert>
          <Button variant="secondary" onClick={() => byt("login")} className="mt-6 w-full">
            Tillbaka till inloggning
          </Button>
        </>
      ) : (
        <>
          <div className="mt-8 space-y-5">
            <Field label="E-post">
              {(f) => (
                <Input
                  {...f}
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
                  placeholder="namn@foretag.se"
                />
              )}
            </Field>

            {mode !== "forgot" && (
              <Field label="Lösenord">
                {(f) => (
                  <Input
                    {...f}
                    type="password"
                    autoComplete={mode === "login" ? "current-password" : "new-password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
                    placeholder="Minst 6 tecken"
                  />
                )}
              </Field>
            )}
          </div>

          {error && (
            <Alert tone="danger" title="Det gick inte" className="mt-5">{error}</Alert>
          )}

          <Button onClick={handleSubmit} loading={loading} className="mt-6 w-full">
            {mode === "signup" ? "Skapa konto" : mode === "forgot" ? "Skicka länk" : "Logga in"}
          </Button>

          {mode === "login" && (
            <p className="mt-4 text-center text-sm">
              <button
                type="button"
                onClick={() => byt("forgot")}
                className="inline-flex min-h-11 cursor-pointer items-center text-text-secondary underline underline-offset-2 hover:text-text-primary sm:min-h-0"
              >
                Glömt lösenord?
              </button>
            </p>
          )}

          <p className="mt-6 text-center text-sm text-text-secondary">
            {mode === "login" && <>Inget konto? </>}
            {mode === "signup" && <>Har du redan ett konto? </>}
            {mode === "forgot" && <>Kom du på det? </>}
            <button
              type="button"
              onClick={() => byt(mode === "login" ? "signup" : "login")}
              className="inline-flex min-h-11 cursor-pointer items-center font-medium text-primary underline underline-offset-2 sm:min-h-0"
            >
              {mode === "login" ? "Skapa ett" : "Logga in"}
            </button>
          </p>
        </>
      )}

      <p className="mt-10 text-center text-sm">
        <Link href="/" className="inline-flex min-h-11 items-center text-text-tertiary underline underline-offset-2 hover:text-text-secondary sm:min-h-0">
          Till startsidan
        </Link>
      </p>
    </div>
  );
}

"use client";

// ─────────────────────────────────────────────────────────────
// Logga in / skapa konto, i appens system.
//
// All inloggningslogik är oförändrad: samma Supabase-anrop, samma
// översatta felmeddelanden, samma val av målsida (har du redan ett
// företag går du till Idag, annars till onboarding) och samma
// helladdning så sessionscookien hinner med. Bara utseendet är nytt.
// ─────────────────────────────────────────────────────────────
import Link from "next/link";
import { useState } from "react";
import { createClient } from "@/lib/supabase-browser";
import { Alert, Button, Field, Input } from "@/app/_shared/primitives";

export default function LoginPage() {
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit() {
    setError(null);
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

  function oversatt(msg: string) {
    if (msg.includes("Invalid login credentials")) return "Fel e-post eller lösenord.";
    if (msg.includes("already registered")) return "E-posten är redan registrerad. Logga in istället.";
    if (msg.includes("User already registered")) return "E-posten är redan registrerad. Logga in istället.";
    return msg;
  }

  return (
    <div className="app-light flex min-h-svh flex-col bg-background font-sans text-text-primary">
      <header className="border-b border-border">
        <div className="mx-auto flex h-14 max-w-5xl items-center px-4 sm:px-6 lg:px-10">
          <Link href="/" className="flex items-center gap-2.5 text-text-primary">
            <span
              aria-hidden
              className="flex h-7 w-7 items-center justify-center rounded bg-primary text-sm font-medium text-white"
            >
              M
            </span>
            <span className="text-sm font-medium">Marketing Copilot</span>
          </Link>
        </div>
      </header>

      <main className="flex flex-1 items-center justify-center px-4 py-12 sm:px-6">
        <div className="w-full max-w-sm">
          <h1 className="text-[clamp(1.6rem,4vw,2rem)] font-semibold leading-tight tracking-tight">
            {mode === "login" ? "Välkommen tillbaka." : "Skapa ett konto."}
          </h1>
          <p className="mt-3 text-[15px] leading-relaxed text-text-secondary">
            {mode === "login"
              ? "Logga in för att se veckans texter."
              : "E-post och lösenord räcker. Inget kort, ingen uppsägningstid."}
          </p>

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
          </div>

          {error && (
            <Alert tone="danger" title="Det gick inte" className="mt-5">{error}</Alert>
          )}

          <Button onClick={handleSubmit} loading={loading} className="mt-6 w-full">
            {mode === "login" ? "Logga in" : "Skapa konto"}
          </Button>

          <p className="mt-6 text-center text-sm text-text-secondary">
            {mode === "login" ? "Inget konto? " : "Har du redan ett konto? "}
            <button
              type="button"
              onClick={() => { setMode(mode === "login" ? "signup" : "login"); setError(null); }}
              className="cursor-pointer font-medium text-primary underline underline-offset-2"
            >
              {mode === "login" ? "Skapa ett" : "Logga in"}
            </button>
          </p>
        </div>
      </main>
    </div>
  );
}

"use client";

// ─────────────────────────────────────────────────────────────
// Välj nytt lösenord.
//
// Hit pekar länken i återställningsmejlet. Supabase-klienten växlar
// koden i adressen mot en session automatiskt (detectSessionInUrl),
// precis som på /auth/callback — därför väntar sidan in sessionen i
// stället för att läsa adressen själv.
//
// Utan giltig länk visas ingen formulärruta alls, bara vägen tillbaka
// till att beställa en ny. Att visa fälten och först vid sparning säga
// att länken gått ut vore att låta någon skriva i onödan.
// ─────────────────────────────────────────────────────────────
import AuthRam from "@/app/_shared/AuthRam";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase-browser";
import { Alert, Button, ButtonLink, Field, Input } from "@/app/_shared/primitives";

type Lage = "kontrollerar" | "redo" | "ogiltig" | "klar";

export default function ResetPage() {
  const router = useRouter();
  const [lage, setLage] = useState<Lage>("kontrollerar");
  const [password, setPassword] = useState("");
  const [repeat, setRepeat] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let avbruten = false;
    const sb = createClient();

    // Sessionen kan finnas redan, eller dyka upp när koden växlats in.
    const { data: sub } = sb.auth.onAuthStateChange((_event, session) => {
      if (!avbruten && session) setLage("redo");
    });

    (async () => {
      const { data: { user } } = await sb.auth.getUser();
      if (avbruten) return;
      if (user) { setLage("redo"); return; }
      // Ge kodväxlingen en stund innan vi dömer länken som ogiltig.
      setTimeout(async () => {
        if (avbruten) return;
        const { data: { user: senare } } = await sb.auth.getUser();
        if (!avbruten) setLage(senare ? "redo" : "ogiltig");
      }, 1500);
    })();

    return () => { avbruten = true; sub.subscription.unsubscribe(); };
  }, []);

  async function spara() {
    setError(null);
    if (password.length < 6) {
      setError("Lösenordet måste vara minst 6 tecken.");
      return;
    }
    if (password !== repeat) {
      setError("De två lösenorden är inte lika.");
      return;
    }
    setLoading(true);
    try {
      const sb = createClient();
      const { error } = await sb.auth.updateUser({ password });
      if (error) {
        setError(
          error.message.toLowerCase().includes("same")
            ? "Det är samma lösenord som du hade. Välj ett annat."
            : error.message,
        );
        setLoading(false);
        return;
      }
      setLage("klar");
      setTimeout(() => router.push("/dashboard"), 1800);
    } catch {
      setError("Kunde inte spara just nu. Försök igen.");
      setLoading(false);
    }
  }

  return (
    <AuthRam>
      <div>
          {lage === "kontrollerar" && (
            <>
              <h1 className="text-[clamp(1.6rem,4vw,2rem)] font-semibold leading-tight tracking-tight">
                Ett ögonblick.
              </h1>
              <p className="mt-3 text-[15px] leading-relaxed text-text-secondary">
                Kontrollerar länken.
              </p>
            </>
          )}

          {lage === "ogiltig" && (
            <>
              <h1 className="text-[clamp(1.6rem,4vw,2rem)] font-semibold leading-tight tracking-tight">
                Länken gäller inte längre.
              </h1>
              <p className="mt-3 text-[15px] leading-relaxed text-text-secondary">
                Återställningslänkar gäller en timme och kan bara användas en gång.
                Beställ en ny så skickar vi ett nytt mejl.
              </p>
              <ButtonLink href="/login" className="mt-6 w-full">
                Beställ en ny länk
              </ButtonLink>
            </>
          )}

          {lage === "klar" && (
            <>
              <h1 className="text-[clamp(1.6rem,4vw,2rem)] font-semibold leading-tight tracking-tight">
                Klart.
              </h1>
              <Alert tone="success" title="Lösenordet är bytt" className="mt-5">
                Du är inloggad. Vi skickar dig vidare till Idag.
              </Alert>
            </>
          )}

          {lage === "redo" && (
            <>
              <h1 className="text-[clamp(1.6rem,4vw,2rem)] font-semibold leading-tight tracking-tight">
                Välj ett nytt lösenord.
              </h1>
              <p className="mt-3 text-[15px] leading-relaxed text-text-secondary">
                Minst sex tecken. Du blir inloggad direkt efteråt.
              </p>

              <div className="mt-8 space-y-5">
                <Field label="Nytt lösenord">
                  {(f) => (
                    <Input
                      {...f}
                      type="password"
                      autoComplete="new-password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Minst 6 tecken"
                    />
                  )}
                </Field>
                <Field label="Upprepa lösenordet">
                  {(f) => (
                    <Input
                      {...f}
                      type="password"
                      autoComplete="new-password"
                      value={repeat}
                      onChange={(e) => setRepeat(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && spara()}
                      placeholder="Samma en gång till"
                    />
                  )}
                </Field>
              </div>

              {error && (
                <Alert tone="danger" title="Det gick inte" className="mt-5">{error}</Alert>
              )}

              <Button onClick={spara} loading={loading} className="mt-6 w-full">
                Spara lösenordet
              </Button>
            </>
          )}
      </div>
    </AuthRam>
  );
}

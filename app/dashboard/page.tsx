"use client";

// ─────────────────────────────────────────────────────────────
// Idag — startsidan, i variant B:s formspråk.
//
// Rekommendationen står fritt på papperstonen och bär sidan. Korten
// under är vita och lyfter mot den. Sans rakt igenom, versala etiketter
// för sektionerna — samma mönster som /innehall och /produkttexter.
//
// Ärliga tomlägen: finns ingen data visas inget, aldrig en påhittad
// siffra. Se VISION.md.
// ─────────────────────────────────────────────────────────────
import Link from "next/link";
import { useState } from "react";
import AppShell from "@/app/_shared/AppShell";
import { Button, ButtonLink, Card, Alert, EmptyState, Skeleton } from "@/app/_shared/primitives";
import { useAccountData } from "@/app/_shared/useAccountData";
import { firstNameFromEmail } from "@/app/_shared/Shell";
import { isoWeek } from "@/lib/server/voice";
import { createClient } from "@/lib/supabase-browser";

function greeting(d = new Date()): string {
  const h = d.getHours();
  if (h < 10) return "God morgon";
  if (h < 18) return "Hej";
  return "God kväll";
}

function Label({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="mb-3 text-xs font-semibold uppercase tracking-[0.12em] text-text-tertiary">
      {children}
    </h2>
  );
}

export default function DashboardPage() {
  const { profile, plan, setPlan, loaded, email } = useAccountData();
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const name = firstNameFromEmail(email) ?? profile?.companyName?.split(" ")[0];

  async function generatePlan() {
    if (!profile) return;
    setGenerating(true);
    setError(null);
    try {
      const saved = localStorage.getItem("marketing-copilot-brain-files");
      const brainFiles = saved ? JSON.parse(saved) : [];

      const res = await fetch("/api/generate-plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ companyProfile: profile, brainFiles }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error ?? "Kunde inte skapa veckoplanen just nu.");
      }

      const newPlan = await res.json();
      localStorage.setItem("marketing-copilot-plan", JSON.stringify(newPlan));
      setPlan(newPlan);

      try {
        const sb = createClient();
        const { data: { user } } = await sb.auth.getUser();
        if (!user) throw new Error("Ingen inloggad användare");
        const { data: company } = await sb.from("companies").upsert({
          name: profile.companyName, industry: profile.industry, summary: profile.summary,
          customers: profile.customers, products: profile.products, tone: profile.tone,
          strengths: profile.strengths, avoid: profile.avoid,
          content_guidelines: profile.contentGuidelines, user_id: user.id,
        }, { onConflict: "user_id,name" }).select().single();
        if (company) {
          await sb.from("plans").insert({
            company_id: company.id, user_id: user.id,
            focus: newPlan.focus, tags: newPlan.tags, posts: newPlan.posts,
            newsletter: newPlan.newsletter, campaigns: newPlan.campaigns,
            opportunities: newPlan.opportunities,
          });
        }
      } catch (syncError) {
        console.warn("Supabase-synk misslyckades:", syncError);
        setError("Planen skapades men kunde inte sparas. Den finns kvar så länge du inte byter enhet.");
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Något gick fel. Försök igen.");
    } finally {
      setGenerating(false);
    }
  }

  const postCount = plan?.posts?.length ?? 0;
  const opportunities = plan?.opportunities ?? [];

  return (
    <AppShell>
      <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-10 lg:py-12">
        {!loaded && (
          <div className="space-y-4">
            <Skeleton shape="line" className="w-56" />
            <Skeleton shape="block" className="h-40" />
          </div>
        )}

        {loaded && !profile && (
          <EmptyState
            title="Låt din marknadschef lära känna företaget"
            body="Innan jag kan föreslå något behöver jag veta vad ni gör, vilka era kunder är och vad de brukar fråga om."
            action={<ButtonLink href="/onboarding">Kom igång</ButtonLink>}
          />
        )}

        {loaded && profile && (
          <>
            <header className="mb-9">
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-text-tertiary">
                Vecka {isoWeek(new Date())} · {greeting()}, {name ?? profile.companyName}
              </p>

              {plan?.focus ? (
                <>
                  <h1 className="mt-3 max-w-2xl text-[clamp(1.5rem,3.2vw,1.85rem)] font-semibold leading-[1.25] tracking-tight">
                    {plan.focus}
                  </h1>
                  {plan.tags?.length > 0 && (
                    <p className="mt-3 max-w-xl text-[15px] leading-relaxed text-text-secondary">
                      Jag lutar åt {plan.tags.slice(0, 3).join(", ").toLowerCase()} den här veckan,
                      utifrån det du fyllt i under Vad jag vet.
                    </p>
                  )}
                  <div className="mt-6 flex flex-wrap gap-2">
                    <ButtonLink href="/innehall">Se innehållet</ButtonLink>
                    <Button variant="secondary" onClick={generatePlan} loading={generating}>
                      Nytt förslag
                    </Button>
                  </div>
                </>
              ) : (
                <>
                  <h1 className="mt-3 max-w-2xl text-[clamp(1.5rem,3.2vw,1.85rem)] font-semibold leading-[1.25] tracking-tight">
                    Jag har inte skrivit något förslag ännu.
                  </h1>
                  <p className="mt-3 max-w-xl text-[15px] leading-relaxed text-text-secondary">
                    Jag utgår från det du fyllt i under Vad jag vet. Ju konkretare det står där,
                    desto mindre generiskt blir förslaget.
                  </p>
                  <div className="mt-6 flex flex-wrap gap-2">
                    <Button onClick={generatePlan} loading={generating}>
                      Skapa veckans förslag
                    </Button>
                    <ButtonLink href="/company" variant="secondary">
                      Fyll på företagskunskapen
                    </ButtonLink>
                  </div>
                </>
              )}
            </header>

            {error && (
              <Alert tone="danger" title="Det gick inte" className="mb-8">{error}</Alert>
            )}

            <div className="space-y-10">
              <section>
                <Label>Gör något nu</Label>
                <div className="grid gap-3 sm:grid-cols-2">
                  {[
                    {
                      href: "/produkttexter",
                      title: "Produkttexter",
                      body: "Skriv beskrivningar för produkterna i webbshoppen.",
                    },
                    {
                      href: "/innehall",
                      title: "Innehåll",
                      body: postCount
                        ? `${postCount} inlägg och ett nyhetsbrev väntar.`
                        : "Inlägg och nyhetsbrev dyker upp här.",
                    },
                  ].map((a) => (
                    <Link
                      key={a.href}
                      href={a.href}
                      className="group rounded-lg border border-border bg-surface p-5 transition-colors hover:border-border-strong"
                    >
                      <p className="font-medium transition-colors group-hover:text-primary">
                        {a.title}
                      </p>
                      <p className="mt-1 text-sm leading-relaxed text-text-secondary">{a.body}</p>
                    </Link>
                  ))}
                </div>
              </section>

              {opportunities.length > 0 && (
                <section>
                  <Label>Värt att förbereda</Label>
                  <div className="space-y-3">
                    {opportunities.slice(0, 3).map((o, i) => (
                      <Card key={i} padding="sm">
                        <div className="flex flex-wrap items-baseline justify-between gap-2">
                          <p className="font-medium">{o.title}</p>
                          {o.date && <span className="text-xs text-text-tertiary">{o.date}</span>}
                        </div>
                        <p className="mt-1 text-sm leading-relaxed text-text-secondary">
                          {o.relevance}
                        </p>
                      </Card>
                    ))}
                  </div>
                </section>
              )}

              <section>
                <Label>Inte kopplat ännu</Label>
                <Card padding="sm">
                  <p className="text-sm leading-relaxed text-text-secondary">
                    Webbshop, Google Analytics och nyhetsbrevsverktyg är inte anslutna. Först när
                    de är det kan jag visa vad innehållet faktiskt gav — fram till dess visar jag
                    inga siffror jag inte kan belägga.
                  </p>
                </Card>
              </section>
            </div>
          </>
        )}
      </div>
    </AppShell>
  );
}

"use client";

// ─────────────────────────────────────────────────────────────
// Innehåll — allt din marknadschef skrivit, på ett ställe.
//
// Ersätter /content, /post/[id] och /newsletter. Tre sidor blir en:
// samma mönster som produkttexterna — se allt, öppna, redigera direkt,
// kopiera. Ingen navigering fram och tillbaka för att läsa ett inlägg.
//
// Redigeringar lever i den här vyn och följer med i kopieringen. De
// sparas inte till databasen — planen är källan, och det som ska ut
// hamnar ändå i Facebook eller nyhetsbrevsverktyget.
//
// Tummarna sparas däremot: generate-plan läser dem och lutar mot det du
// gillat. Det är produktens enda lärande-loop idag.
// ─────────────────────────────────────────────────────────────
import { useEffect, useState } from "react";
import AppShell from "@/app/_shared/AppShell";
import { Button, Card, Textarea, Chip, Alert, EmptyState, Skeleton, cx } from "@/app/_shared/primitives";
import { useAccountData, type MarketingPlan } from "@/app/_shared/useAccountData";
import { createClient } from "@/lib/supabase-browser";

type Rating = "up" | "down";

function postText(p: { title: string; text: string; cta: string }): string {
  return [p.title, p.text, p.cta].filter(Boolean).join("\n\n");
}

function newsletterText(n: MarketingPlan["newsletter"]): string {
  if (!n) return "";
  return [`Ämnesrad: ${n.subject}`, `Förhandsvisning: ${n.preview}`, "", n.body, n.cta]
    .filter(Boolean).join("\n");
}

function CopyButton({ getText }: { getText: () => string }) {
  const [copied, setCopied] = useState(false);
  return (
    <Button
      size="sm"
      variant="secondary"
      onClick={() => {
        navigator.clipboard.writeText(getText());
        setCopied(true);
        setTimeout(() => setCopied(false), 1800);
      }}
    >
      {copied ? "Kopierat" : "Kopiera"}
    </Button>
  );
}

export default function ContentPage() {
  const { plan, loaded } = useAccountData();
  const [open, setOpen] = useState<string | null>(null);
  const [edits, setEdits] = useState<Record<string, string>>({});
  const [ratings, setRatings] = useState<Record<number, Rating>>({});

  // Tidigare tummar, så knapparna visar rätt läge direkt.
  useEffect(() => {
    if (!plan?.company) return;
    let cancelled = false;
    (async () => {
      try {
        const sb = createClient();
        const { data: { user } } = await sb.auth.getUser();
        if (!user || cancelled) return;
        const { data } = await sb
          .from("content_feedback")
          .select("post_index, rating_text")
          .eq("user_id", user.id)
          .eq("company_name", plan.company);
        if (!data || cancelled) return;
        const next: Record<number, Rating> = {};
        for (const row of data) {
          if (typeof row.post_index === "number") {
            next[row.post_index] = row.rating_text === "up" ? "up" : "down";
          }
        }
        setRatings(next);
      } catch {
        // Tummarna är en förbättring, inte en förutsättning — visa inget fel.
      }
    })();
    return () => { cancelled = true; };
  }, [plan?.company]);

  async function rate(index: number, title: string, rating: Rating) {
    if (!plan?.company) return;
    setRatings((prev) => ({ ...prev, [index]: rating }));
    try {
      const sb = createClient();
      const { data: { user } } = await sb.auth.getUser();
      if (!user) return;
      await sb.from("content_feedback").upsert({
        user_id: user.id,
        company_name: plan.company,
        post_index: index,
        post_title: title,
        rating_text: rating,
      }, { onConflict: "user_id,company_name,post_index" });
    } catch (e) {
      console.warn("Kunde inte spara feedback:", e);
    }
  }

  const posts = plan?.posts ?? [];
  const newsletter = plan?.newsletter;
  const campaigns = plan?.campaigns ?? [];

  return (
    <AppShell>
      <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-10 lg:py-12">
        <header className="mb-8">
          <h1 className="text-2xl font-medium tracking-tight">Innehåll</h1>
          <p className="mt-1.5 text-sm text-text-secondary">
            {plan?.focus
              ? `Veckans fokus: ${plan.focus}`
              : "Inlägg, nyhetsbrev och kampanjförslag från din senaste plan."}
          </p>
        </header>

        {!loaded && (
          <div className="space-y-3">
            <Skeleton shape="block" className="h-20" />
            <Skeleton shape="block" className="h-20" />
            <Skeleton shape="block" className="h-20" />
          </div>
        )}

        {loaded && !plan && (
          <EmptyState
            title="Ingen plan än"
            body="Din marknadschef har inte skrivit något ännu. Generera en veckoplan från Idag så dyker inläggen upp här."
            action={<Button onClick={() => { window.location.href = "/dashboard"; }}>Gå till Idag</Button>}
          />
        )}

        {loaded && plan && (
          <div className="space-y-10">
            {posts.length > 0 && (
              <section>
                <h2 className="mb-3 text-sm font-medium text-text-secondary">
                  Inlägg · {posts.length} st
                </h2>
                <div className="space-y-3">
                  {posts.map((p, i) => {
                    const key = `post-${i}`;
                    const isOpen = open === key;
                    const value = edits[key] ?? postText(p);
                    const rating = ratings[i];
                    return (
                      <Card key={key} padding="sm">
                        <button
                          type="button"
                          onClick={() => setOpen(isOpen ? null : key)}
                          className="flex w-full items-start gap-3 text-left"
                          aria-expanded={isOpen}
                        >
                          <span className="min-w-0 flex-1">
                            <span className="flex flex-wrap items-center gap-2">
                              <span className="font-medium">{p.title}</span>
                              {rating === "up" && <Chip tone="success">Gillad</Chip>}
                              {rating === "down" && <Chip tone="neutral">Ogillad</Chip>}
                            </span>
                            {!isOpen && (
                              <span className="mt-0.5 line-clamp-2 block text-sm text-text-secondary">
                                {p.text}
                              </span>
                            )}
                          </span>
                          <span aria-hidden className="mt-1 shrink-0 text-text-tertiary">
                            {isOpen ? "−" : "+"}
                          </span>
                        </button>

                        {isOpen && (
                          <div className="mt-4">
                            <Textarea
                              rows={7}
                              value={value}
                              onChange={(e) => setEdits({ ...edits, [key]: e.target.value })}
                            />
                            {p.image && (
                              <p className="mt-2 text-xs text-text-tertiary">Bildidé: {p.image}</p>
                            )}
                            <div className="mt-3 flex flex-wrap items-center gap-2">
                              <CopyButton getText={() => edits[key] ?? postText(p)} />
                              <span className="ml-auto flex gap-2">
                                <Button
                                  size="sm"
                                  variant={rating === "up" ? "primary" : "ghost"}
                                  onClick={() => rate(i, p.title, "up")}
                                >
                                  Bra
                                </Button>
                                <Button
                                  size="sm"
                                  variant={rating === "down" ? "secondary" : "ghost"}
                                  onClick={() => rate(i, p.title, "down")}
                                >
                                  Mindre bra
                                </Button>
                              </span>
                            </div>
                          </div>
                        )}
                      </Card>
                    );
                  })}
                </div>
                <p className="mt-3 text-xs text-text-tertiary">
                  Tummarna styr nästa plan — din marknadschef lutar mot det du gillat.
                </p>
              </section>
            )}

            {newsletter && (
              <section>
                <h2 className="mb-3 text-sm font-medium text-text-secondary">Nyhetsbrev</h2>
                <Card padding="sm">
                  <button
                    type="button"
                    onClick={() => setOpen(open === "nl" ? null : "nl")}
                    className="flex w-full items-start gap-3 text-left"
                    aria-expanded={open === "nl"}
                  >
                    <span className="min-w-0 flex-1">
                      <span className="block font-medium">{newsletter.subject}</span>
                      <span className="mt-0.5 block text-sm text-text-secondary">
                        {newsletter.preview}
                      </span>
                    </span>
                    <span aria-hidden className="mt-1 shrink-0 text-text-tertiary">
                      {open === "nl" ? "−" : "+"}
                    </span>
                  </button>

                  {open === "nl" && (
                    <div className="mt-4">
                      <Textarea
                        rows={12}
                        value={edits["nl"] ?? newsletterText(newsletter)}
                        onChange={(e) => setEdits({ ...edits, nl: e.target.value })}
                      />
                      <div className="mt-3">
                        <CopyButton getText={() => edits["nl"] ?? newsletterText(newsletter)} />
                      </div>
                    </div>
                  )}
                </Card>
              </section>
            )}

            {campaigns.length > 0 && (
              <section>
                <h2 className="mb-3 text-sm font-medium text-text-secondary">
                  Kampanjförslag · {campaigns.length} st
                </h2>
                <div className="space-y-3">
                  {campaigns.map((c, i) => (
                    <Card key={i} padding="sm">
                      <p className="font-medium">{c.title}</p>
                      <p className="mt-0.5 text-sm text-text-secondary">{c.goal}</p>
                    </Card>
                  ))}
                </div>
                <Alert className="mt-3">
                  Det här är utkast, inte aktiva kampanjer. Produkten mäter ingenting ännu.
                </Alert>
              </section>
            )}
          </div>
        )}
      </div>
    </AppShell>
  );
}

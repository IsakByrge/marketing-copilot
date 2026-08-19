"use client";

// ─────────────────────────────────────────────────────────────
// Innehåll — allt din marknadschef skrivit, på ett ställe.
//
// Ersätter /content, /post/[id] och /newsletter. Tre sidor blir en:
// samma mönster som produkttexterna — se allt, öppna, redigera direkt,
// kopiera. Ingen navigering fram och tillbaka för att läsa ett inlägg.
//
// Redigeringar sparas lokalt per plan, så de överlever en omladdning.
// Planen i databasen lämnas orörd — den är AI:ns original, och det är
// skillnaden mot din version som är värd något.
//
// När du kopierar en text skickas paret (original, din version) till
// redigeringsminnet. Det är den här sidan du redigerar mest, så det är
// härifrån produkten lär sig din röst snabbast.
//
// Tummarna sparas däremot: generate-plan läser dem och lutar mot det du
// gillat. Det är produktens enda lärande-loop idag.
// ─────────────────────────────────────────────────────────────
import { useEffect, useState } from "react";
import AppShell from "@/app/_shared/AppShell";
import { Button, ButtonLink, Card, Textarea, Chip, Alert, EmptyState, Skeleton, cx } from "@/app/_shared/primitives";
import { useAccountData, type MarketingPlan } from "@/app/_shared/useAccountData";
import ImageMaker from "@/app/_shared/ImageMaker";
import { isoWeek } from "@/lib/server/voice";
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

function CopyButton({ getText, onCopied }: { getText: () => string; onCopied?: () => void }) {
  const [copied, setCopied] = useState(false);
  return (
    <Button
      size="sm"
      variant="secondary"
      onClick={() => {
        navigator.clipboard.writeText(getText());
        onCopied?.();
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

  // Snabbskapande: ett enskilt inlägg utan att hela veckoplanen görs om.
  // Går via /api/create-content, som redan äger prompten server-side.
  const [quickTopic, setQuickTopic] = useState("");
  const [quickType, setQuickType] = useState<"social" | "newsletter" | "offer">("social");
  const [quickBusy, setQuickBusy] = useState(false);
  const [quickError, setQuickError] = useState<string | null>(null);
  const [quickResult, setQuickResult] = useState<{ title: string; body: string; cta?: string } | null>(null);
  const [quickOriginal, setQuickOriginal] = useState("");

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

  // Nyckel per plan, så ändringar i en gammal plan inte läcker in i en ny.
  const editsKey = plan?.id ? `mc-innehall-edits-${plan.id}` : null;

  // Läs tillbaka sparade ändringar när planen laddats.
  useEffect(() => {
    if (!editsKey) return;
    try {
      const saved = localStorage.getItem(editsKey);
      if (saved) setEdits(JSON.parse(saved));
    } catch {
      // Trasig lagring ska inte hindra sidan från att visas.
    }
  }, [editsKey]);

  function updateEdit(key: string, value: string) {
    setEdits((prev) => {
      const next = { ...prev, [key]: value };
      if (editsKey) {
        try {
          localStorage.setItem(editsKey, JSON.stringify(next));
        } catch {
          // Full lagring — ändringen lever ändå kvar i vyn.
        }
      }
      return next;
    });
  }

  /** Skickar paret till redigeringsminnet. Tyst; får aldrig störa. */
  async function rememberEdit(
    kind: "plan_post" | "newsletter",
    original: string,
    edited: string,
    label?: string,
  ) {
    if (!edited || original === edited) return;
    try {
      await fetch("/api/text-edits", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind, original, edited, label }),
      });
    } catch {
      // Minnet är en förbättring, aldrig en förutsättning.
    }
  }

  async function createQuick() {
    const request = quickTopic.trim();
    if (!request) return;

    setQuickBusy(true);
    setQuickError(null);
    try {
      const res = await fetch("/api/create-content", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contentType: quickType, request }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error ?? "Kunde inte skapa innehållet just nu.");
      }
      const data = await res.json();
      const result = {
        title: typeof data.title === "string" ? data.title : "",
        body: typeof data.body === "string" ? data.body : "",
        cta: typeof data.cta === "string" ? data.cta : undefined,
      };
      setQuickResult(result);
      // Spara originalet så redigeringar kan läras in vid kopiering.
      setQuickOriginal([result.title, result.body, result.cta].filter(Boolean).join("\n\n"));
    } catch (e) {
      setQuickError(e instanceof Error ? e.message : "Något gick fel. Försök igen.");
    } finally {
      setQuickBusy(false);
    }
  }

  const quickText = quickResult
    ? [quickResult.title, quickResult.body, quickResult.cta].filter(Boolean).join("\n\n")
    : "";

  const posts = plan?.posts ?? [];
  const newsletter = plan?.newsletter;
  const campaigns = plan?.campaigns ?? [];

  return (
    <AppShell>
      <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-10 lg:py-12">
        {/* Variant B: rekommendationen står fritt på papperstonen och bär
            sidan. Korten under är vita och lyfter mot den. */}
        <header className="mb-9">
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-text-tertiary">
            Vecka {isoWeek(new Date())} · {new Date().toLocaleDateString("sv-SE", { weekday: "long" })}
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
            </>
          ) : (
            <h1 className="mt-3 text-[clamp(1.5rem,3.2vw,1.85rem)] font-semibold leading-[1.25] tracking-tight">
              Inlägg och nyhetsbrev
            </h1>
          )}
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

        {loaded && (
          <section className="mb-10">
            <h2 className="mb-3 text-xs font-semibold uppercase tracking-[0.12em] text-text-tertiary">
              Skriv något nu
            </h2>
            <Card padding="sm">
              <Textarea
                rows={2}
                value={quickTopic}
                onChange={(e) => setQuickTopic(e.target.value)}
                placeholder="t.ex. Terrassvärmare inför hösten — påminn om att se över slangen"
              />
              <div className="mt-3 flex flex-wrap items-center gap-2">
                {([
                  ["social", "Inlägg"],
                  ["newsletter", "Nyhetsbrev"],
                  ["offer", "Erbjudande"],
                ] as const).map(([value, label]) => (
                  <Button
                    key={value}
                    size="sm"
                    variant={quickType === value ? "primary" : "secondary"}
                    onClick={() => setQuickType(value)}
                  >
                    {label}
                  </Button>
                ))}
                <span className="ml-auto">
                  <Button
                    size="sm"
                    onClick={createQuick}
                    loading={quickBusy}
                    disabled={!quickTopic.trim()}
                  >
                    Skriv
                  </Button>
                </span>
              </div>

              {quickError && (
                <Alert tone="danger" title="Det gick inte" className="mt-4">{quickError}</Alert>
              )}

              {quickResult && (
                <div className="mt-4 border-t border-border pt-4">
                  <p className="font-medium">{quickResult.title}</p>
                  <Textarea
                    className="mt-2"
                    rows={7}
                    value={quickText}
                    onChange={(e) => {
                      const [title, ...rest] = e.target.value.split("\n\n");
                      setQuickResult({ title, body: rest.join("\n\n"), cta: undefined });
                    }}
                  />
                  <div className="mt-3 flex flex-wrap gap-2">
                    <CopyButton
                      getText={() => quickText}
                      onCopied={() => void rememberEdit(
                        quickType === "newsletter" ? "newsletter" : "plan_post",
                        quickOriginal,
                        quickText,
                        quickResult.title,
                      )}
                    />
                    <ButtonLink
                      size="sm"
                      variant="ghost"
                      href={`/content/facebook?amne=${encodeURIComponent(quickTopic.slice(0, 400))}`}
                    >
                      Gör om ordentligt
                    </ButtonLink>
                  </div>
                </div>
              )}
            </Card>
          </section>
        )}

        {loaded && plan && (
          <div className="space-y-10">
            {posts.length > 0 && (
              <section>
                <h2 className="mb-3 text-xs font-semibold uppercase tracking-[0.12em] text-text-tertiary">
                  {posts.length} inlägg väntar
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
                              onChange={(e) => updateEdit(key, e.target.value)}
                            />
                            {p.image && (
                              <div className="mt-3">
                                <ImageMaker initialPrompt={p.image} />
                              </div>
                            )}
                            <div className="mt-3 flex flex-wrap items-center gap-2">
                              <CopyButton
                                getText={() => edits[key] ?? postText(p)}
                                onCopied={() => void rememberEdit("plan_post", postText(p), edits[key] ?? "", p.title)}
                              />
                              {/* Veckoplanens inlägg är snabba utkast. Specialisten
                                  granskar kvalitet och ger tre vinklar — den här
                                  knappen tar med ämnet dit utan omskrivning. */}
                              <ButtonLink
                                size="sm"
                                variant="ghost"
                                href={`/content/facebook?amne=${encodeURIComponent(`${p.title}. ${p.text}`.slice(0, 400))}`}
                              >
                                Gör om ordentligt
                              </ButtonLink>
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
                <h2 className="mb-3 text-xs font-semibold uppercase tracking-[0.12em] text-text-tertiary">Nyhetsbrev</h2>
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
                        onChange={(e) => updateEdit("nl", e.target.value)}
                      />
                      <div className="mt-3">
                        <CopyButton
                          getText={() => edits["nl"] ?? newsletterText(newsletter)}
                          onCopied={() => void rememberEdit("newsletter", newsletterText(newsletter), edits["nl"] ?? "", newsletter.subject)}
                        />
                      </div>
                    </div>
                  )}
                </Card>
              </section>
            )}

            {campaigns.length > 0 && (
              <section>
                <h2 className="mb-3 text-xs font-semibold uppercase tracking-[0.12em] text-text-tertiary">
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

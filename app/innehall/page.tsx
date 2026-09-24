"use client";

// ─────────────────────────────────────────────────────────────
// Innehåll — allt din marknadschef skrivit, på ett ställe.
//
// Ersatte /content, /post/[id] och /newsletter, som nu är borttagna
// (se docs/product/PARKERADE_FUNKTIONER.md). Tre sidor blev en: samma
// mönster som produkttexterna — se allt, öppna, redigera direkt,
// kopiera. Ingen navigering fram och tillbaka för att läsa ett inlägg.
//
// Redigeringar sparas i plan_text_edits, en rad per (plan, inlägg).
// De låg tidigare i webbläsarens lagring, men marknadsföringstext är
// affärsdata: på en enhet överlever den en utloggning och följer fel
// konto. Nu ligger den bakom RLS som allt annat.
//
// Planen i databasen lämnas orörd — den är AI:ns original, och det är
// skillnaden mot din version som är värd något. Saknas en sparad rad
// visas originalet.
//
// När du kopierar en text skickas paret (original, din version) till
// redigeringsminnet. Det är den här sidan du redigerar mest, så det är
// härifrån produkten lär sig din röst snabbast.
//
// Tummarna sparas däremot: generate-plan läser dem och lutar mot det du
// gillat. Det är produktens enda lärande-loop idag.
// ─────────────────────────────────────────────────────────────
import { useCallback, useEffect, useRef, useState } from "react";
import AppShell from "@/app/_shared/AppShell";
import { Button, ButtonLink, Card, Chip, Alert, EmptyState, Skeleton } from "@/app/_shared/primitives";
import { Textarea } from "@/app/_shared/Textarea";
import { IconCheck } from "@/app/_shared/icons";
import { useAccountData, type MarketingPlan } from "@/app/_shared/useAccountData";
import ImageMaker from "@/app/_shared/ImageMaker";
import { isoWeek } from "@/lib/server/voice";
import { createClient } from "@/lib/supabase-browser";

type Rating = "up" | "down";

/** Modellen svarar med nycklar utan diakriter; hit hor visningsnamnen. */
const ROLLNAMN: Record<string, string> = {
  saljande: "Säljande",
  tips: "Tips",
  prioriterad_produkt: "Prioriterad produkt",
  lokalt: "Lokalt",
  socialt: "Socialt",
};

/** Veckodag med liten bokstav. Servern normaliserar nya planer, men
 *  aldre kan ha "Mandag", "måndag" eller "monday" om vartannat. */
const DAGNAMN: Record<string, string> = {
  mandag: "måndag", tisdag: "tisdag", onsdag: "onsdag", torsdag: "torsdag",
  fredag: "fredag", lordag: "lördag", sondag: "söndag",
  måndag: "måndag", lördag: "lördag", söndag: "söndag",
};

const visaDag = (d: string) => DAGNAMN[d.toLowerCase()] ?? d.toLowerCase();

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
  const { plan, setPlan, loaded } = useAccountData();
  const [open, setOpen] = useState<string | null>(null);
  const [ratings, setRatings] = useState<Record<number, Rating>>({});

  // "Klar med veckans innehåll". Sätts bara av ett klick — aldrig av
  // redigering, kopiering, tumme, bild eller tid på sidan. Produkten
  // vet inte om något publicerats, och tillståndet påstår inte det.
  const [markerar, setMarkerar] = useState(false);
  const [markeringsfel, setMarkeringsfel] = useState("");

  // Ändringarna hör till en bestämd plan. Genereras en ny plan ska den
  // gamlas text inte ligga kvar i rutorna — därför bär state:t med sig
  // vilken plan det gäller i stället för att nollställas i en effekt.
  const [editStore, setEditStore] = useState<{ planId?: string; values: Record<string, string> }>({ values: {} });
  const planId = plan?.id;
  const edits = editStore.planId === planId ? editStore.values : {};
  const [saveFailed, setSaveFailed] = useState(false);

  // Läs tillbaka sparade ändringar så fort planens id är känt.
  useEffect(() => {
    if (!planId) return;
    let cancelled = false;
    (async () => {
      try {
        const sb = createClient();
        const { data, error } = await sb
          .from("plan_text_edits")
          .select("item_key, edited_text")
          .eq("plan_id", planId);
        if (error) throw error;
        if (cancelled) return;
        const saved: Record<string, string> = {};
        for (const row of data ?? []) {
          if (typeof row.item_key === "string" && typeof row.edited_text === "string") {
            saved[row.item_key] = row.edited_text;
          }
        }
        // Hann du skriva medan hämtningen pågick vinner det du skrev —
        // annars skulle svaret radera bokstäver under fingrarna.
        setEditStore((prev) =>
          prev.planId === planId
            ? { planId, values: { ...saved, ...prev.values } }
            : { planId, values: saved },
        );
      } catch (e) {
        console.warn("Kunde inte läsa sparade ändringar:", e);
      }
    })();
    return () => { cancelled = true; };
  }, [planId]);

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
        // Bara tummar som satts pa just den har planen. Tidigare lastes
        // alla rader for foretaget och mappades pa post_index, sa inlagg 0
        // i en ny plan arvde tummen fran inlagg 0 i en gammal.
        if (!plan.id) return;
        const { data } = await sb
          .from("content_feedback")
          .select("post_index, rating_text")
          .eq("user_id", user.id)
          .eq("plan_id", plan.id);
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
  }, [plan?.company, plan?.id]);

  async function rate(index: number, title: string, rating: Rating) {
    if (!plan?.company) return;
    setRatings((prev) => ({ ...prev, [index]: rating }));
    try {
      const sb = createClient();
      const { data: { user } } = await sb.auth.getUser();
      if (!user) return;
      // Nyckeln ar (user_id, plan_id, post_index) sedan 0008, sa varje
      // plan har egna tummar och forra veckans bevaras. Utan plan_id
      // finns ingen rad att peka pa - da sparas ingen tumme alls, hellre
      // det an att skriva en rad som galler fel text.
      if (!plan.id) return;
      await sb.from("content_feedback").upsert({
        user_id: user.id,
        company_name: plan.company,
        plan_id: plan.id,
        post_index: index,
        post_title: title,
        rating_text: rating,
      }, { onConflict: "user_id,plan_id,post_index" });
    } catch (e) {
      console.warn("Kunde inte spara feedback:", e);
    }
  }

  /**
   * Markerar eller avmarkerar planen som klar.
   *
   * Skriver bara completed_at på just den här planraden. user_id-filtret
   * är defensivt utöver RLS, samma mönster som resten av appen. Inget
   * visas som klart förrän Supabase bekräftat skrivningen.
   */
  async function markeraKlar(klar: boolean) {
    if (!plan?.id || markerar) return;
    setMarkerar(true);
    setMarkeringsfel("");
    const nytt = klar ? new Date().toISOString() : null;
    try {
      const sb = createClient();
      const { data: { user } } = await sb.auth.getUser();
      if (!user) throw new Error("Ingen inloggad användare");
      const { error } = await sb
        .from("plans")
        .update({ completed_at: nytt })
        .eq("id", plan.id)
        .eq("user_id", user.id);
      if (error) throw error;
      setPlan({ ...plan, completedAt: nytt });
    } catch (e) {
      console.warn("Kunde inte spara markeringen:", e);
      setMarkeringsfel(
        klar
          ? "Kunde inte markera veckans innehåll som klart. Försök igen."
          : "Kunde inte ångra markeringen. Försök igen.",
      );
    } finally {
      setMarkerar(false);
    }
  }

  // ── Sparning ────────────────────────────────────────────────
  // Väntar ut skrivandet i stället för att skriva per tangenttryck, och
  // skickar direkt när fältet tappar fokus. user_id sätts aldrig här —
  // kolumnens default är auth.uid(), så klienten kan inte påstå vem den
  // är, och RLS avgör resten.
  const pendingEdits = useRef(new Map<string, string>());
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const flushEdits = useCallback(async () => {
    if (saveTimer.current) {
      clearTimeout(saveTimer.current);
      saveTimer.current = null;
    }
    if (!planId || pendingEdits.current.size === 0) return;

    const rows = [...pendingEdits.current].map(([item_key, edited_text]) => ({
      plan_id: planId, item_key, edited_text,
    }));
    pendingEdits.current.clear();

    try {
      const sb = createClient();
      const { error } = await sb
        .from("plan_text_edits")
        .upsert(rows, { onConflict: "user_id,plan_id,item_key" });
      if (error) throw error;
      setSaveFailed(false);
    } catch (e) {
      console.warn("Kunde inte spara ändringen:", e);
      // Lägg tillbaka raderna så nästa försök tar med dem — men bara där
      // du inte redan hunnit skriva något nyare, som annars skulle tappas.
      for (const row of rows) {
        if (!pendingEdits.current.has(row.item_key)) {
          pendingEdits.current.set(row.item_key, row.edited_text);
        }
      }
      setSaveFailed(true);
    }
  }, [planId]);

  // Lämnar du sidan innan debouncen löpt ut ska ändringen ändå med.
  useEffect(() => () => { void flushEdits(); }, [flushEdits]);

  function updateEdit(key: string, value: string) {
    setEditStore((prev) => ({
      planId,
      values: { ...(prev.planId === planId ? prev.values : {}), [key]: value },
    }));
    if (!planId) return;
    pendingEdits.current.set(key, value);
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => { void flushEdits(); }, 1200);
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
              {/* Samma kalla och samma reservtext som Idag. Tidigare byggde
                  den har sidan sin egen mening av plan.tags. */}
              <p className="mt-3 max-w-xl text-[15px] leading-relaxed text-text-secondary">
                {plan.intro?.trim()
                  ? plan.intro
                  : "Förslaget bygger på det du fyllt i under Vad jag vet."}
              </p>
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
            {/* Tyst tappad text är värre än ett synligt fel — säg det. */}
            {saveFailed && (
              <Alert tone="danger" title="Ändringen är inte sparad">
                Texten finns kvar i rutan, men kunde inte skrivas till databasen.
                Kopiera den någonstans innan du lämnar sidan.
              </Alert>
            )}
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
                              {p.saknas?.length ? <Chip tone="warning">Behöver komplettering</Chip> : null}
                              {p.granskas?.length ? <Chip tone="warning">Behöver granskning</Chip> : null}
                              {rating === "up" && <Chip tone="success">Gillad</Chip>}
                              {rating === "down" && <Chip tone="neutral">Ogillad</Chip>}
                            </span>
                            {/* Roll, dag, produkt och mal - diskret, sa det gar att
                                kontrollera att veckan tacker det den ska. Saknas
                                falten (planer fore sprinten) visas raden inte. */}
                            {(p.roll || p.dag || p.produkt || p.mal) && (
                              <span className="mt-1 block text-xs text-text-tertiary">
                                {[
                                  p.roll ? ROLLNAMN[p.roll] ?? p.roll : null,
                                  p.dag ? visaDag(p.dag) : null,
                                  p.produkt || null,
                                  p.mal || null,
                                ].filter(Boolean).join(" · ")}
                              </span>
                            )}
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
                            {/* Vad som behover fyllas i. Texten innehaller en
                                platshallare, och vi gissar inte fram svaret. */}
                            {p.saknas?.length ? (
                              <Alert tone="warning" title="Texten har luckor" className="mb-3">
                                <ul className="list-disc space-y-1 pl-4">
                                  {p.saknas.map((s) => <li key={s}>{s}</li>)}
                                </ul>
                              </Alert>
                            ) : null}
                            {/* Utrustning namnd i texten. Las igenom att den inte
                                borjat instruera lasaren om nagot vi inte har
                                tackning for. */}
                            {p.granskas?.length ? (
                              <Alert tone="warning" title="Läs igenom innan du publicerar" className="mb-3">
                                Texten nämner {p.granskas.join(", ")}. Kontrollera att den inte ger
                                råd om hur utrustningen ska hanteras — det ska personalen eller
                                tillverkarens anvisningar svara på.
                              </Alert>
                            ) : null}
                            <Textarea
                              rows={7}
                              value={value}
                              onChange={(e) => updateEdit(key, e.target.value)}
                              onBlur={() => void flushEdits()}
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
                        onBlur={() => void flushEdits()}
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

            {/* Sist på sidan, efter allt innehållsarbete. Handlingen ska
                inte konkurrera med huvuduppgiften högst upp — den hör
                hemma när man är färdig, inte när man kommer in.

                Markeringen betyder att ANVÄNDAREN säger sig vara klar.
                Inget här vet om något är publicerat, och texten påstår
                det inte. */}
            {plan.posts?.length > 0 && (
              <section className="border-t border-border pt-8">
                {plan.completedAt ? (
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <p className="flex items-center gap-2 text-sm text-text-secondary">
                      <IconCheck size={16} className="shrink-0 text-primary" />
                      Veckans innehåll är markerat som klart.
                    </p>
                    <button
                      type="button"
                      onClick={() => void markeraKlar(false)}
                      disabled={markerar}
                      className="inline-flex min-h-11 items-center rounded px-1 text-sm font-medium text-text-secondary underline underline-offset-4 transition-colors hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 disabled:opacity-50 sm:min-h-0 sm:py-1"
                    >
                      Ångra
                    </button>
                  </div>
                ) : (
                  <Button
                    variant="secondary"
                    onClick={() => void markeraKlar(true)}
                    loading={markerar}
                    className="w-full sm:w-auto"
                  >
                    Klar med veckans innehåll
                  </Button>
                )}
                {markeringsfel && (
                  <Alert tone="danger" title="Det gick inte" className="mt-3">
                    {markeringsfel}
                  </Alert>
                )}
              </section>
            )}
          </div>
        )}
      </div>
    </AppShell>
  );
}

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
import { useEffect, useMemo, useRef, useState } from "react";
import AppShell from "@/app/_shared/AppShell";
import { Button, ButtonLink, Card, Alert, EmptyState, Skeleton, Field } from "@/app/_shared/primitives";
import { Textarea } from "@/app/_shared/Textarea";
import { useAccountData } from "@/app/_shared/useAccountData";
import UsagePanel from "@/app/_shared/UsagePanel";
import { firstNameFromEmail } from "@/app/_shared/user";
import { IconArrowRight } from "@/app/_shared/icons";
import { isoWeek, greeting, isPlanStale, opportunityWhen } from "@/lib/server/voice";
import { todayIso, formatPeriod, type Campaign } from "@/lib/campaigns/logic";
import { WEEK_INPUT_MAX_CHARS, relevantCampaigns } from "@/lib/server/weekInput";
import { listCampaigns } from "@/lib/campaigns/store";
import { nextStep, type NextStep } from "@/lib/today/nextStep";
import { createClient } from "@/lib/supabase-browser";

/** Dubbelklick, ett andra fönster eller otålighet ska inte kosta en
 *  AI-körning till. Servern har redan rate-limit; det här är för att
 *  slippa skapa ett förslag som omedelbart ersätter det förra. */
const NY_PLAN_KARENS_MS = 60_000;

function Label({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="mb-3 text-xs font-semibold uppercase tracking-[0.12em] text-text-tertiary">
      {children}
    </h2>
  );
}

/**
 * Det rekommenderade steget. Ett kort, aldrig flera — visas två blir
 * ytan en meny igen och sidan har inte svarat på frågan den ställer.
 *
 * Emerald-ramen och den enda primärknappen på sidan är det som gör
 * skillnaden mot genvägarna under.
 */
function NextStepCard({
  steg, onAction, working,
}: {
  steg: NextStep;
  onAction: () => void;
  working: boolean;
}) {
  return (
    <Card className="border-primary/30 p-5 sm:p-6">
      <div className="flex gap-3">
        <IconArrowRight size={18} className="mt-1 shrink-0 text-primary" />
        <div className="min-w-0 flex-1">
          <h2 className="text-[19px] font-semibold leading-snug tracking-tight">{steg.title}</h2>
          <p className="mt-1.5 text-[15px] leading-relaxed text-text-secondary">{steg.why}</p>
          <div className="mt-5">
            {steg.href ? (
              <ButtonLink href={steg.href} className="w-full sm:w-auto">{steg.cta}</ButtonLink>
            ) : (
              <Button onClick={onAction} loading={working} className="w-full sm:w-auto">
                {steg.cta}
              </Button>
            )}
          </div>
        </div>
      </div>
    </Card>
  );
}

/**
 * Veckans underlag — frågan som ställs innan planen skrivs.
 *
 * En plan som bara har Company Brain att gå på har ett enda belagt
 * faktum och upprepar det i varje inlägg. Det som gör veckan till just
 * den här veckan vet bara företagaren. Två minuter här är skillnaden.
 *
 * Underlaget är frivilligt. "Skapa utan" ger samma plan som förut.
 */
function WeekInputCard({
  value, onChange, onSubmit, onCancel, working, campaigns,
}: {
  value: string;
  onChange: (v: string) => void;
  onSubmit: (withInput: boolean) => void;
  onCancel: () => void;
  working: boolean;
  campaigns: Campaign[];
}) {
  const nara = value.length > WEEK_INPUT_MAX_CHARS * 0.8;
  return (
    <Card className="border-primary/30 p-5 sm:p-6">
      <h2 className="text-[19px] font-semibold leading-snug tracking-tight">
        Vad händer hos er den här veckan?
      </h2>
      <p className="mt-1.5 text-[15px] leading-relaxed text-text-secondary">
        Ett erbjudande, något nytt i sortimentet, ett evenemang, något kunderna frågar om.
        Veckans plan byggs kring det du skriver, och priser och datum återges som du skrivit dem.
      </p>

      {campaigns.length > 0 && (
        <p className="mt-3 text-sm text-text-secondary">
          {campaigns.length === 1 ? "Kampanjen " : "Kampanjerna "}
          {campaigns.map((c, i) => (
            <span key={c.id}>
              {i > 0 && (i === campaigns.length - 1 ? " och " : ", ")}
              <span className="font-medium text-text-primary">{c.title}</span>
              {" "}({formatPeriod(c.starts_on, c.ends_on, todayIso())})
            </span>
          ))}
          {" "}tas med automatiskt.
        </p>
      )}

      <Field label="Veckans underlag" optional className="mt-4">
        {(props) => (
          <Textarea
            {...props}
            rows={4}
            maxLength={WEEK_INPUT_MAX_CHARS}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder="Till exempel: 15 % på alla gasolkaminer i Norrköping till och med söndag. Ny leverans av 11 kg-flaskor i Linköping på onsdag."
          />
        )}
      </Field>
      {nara && (
        <p className="mt-1.5 text-xs text-text-tertiary">
          {value.length} av {WEEK_INPUT_MAX_CHARS} tecken
        </p>
      )}

      <div className="mt-5 flex flex-col gap-2 sm:flex-row sm:flex-wrap">
        <Button onClick={() => onSubmit(true)} loading={working} disabled={!value.trim()} className="w-full sm:w-auto">
          Skapa veckans plan
        </Button>
        <Button variant="secondary" onClick={() => onSubmit(false)} disabled={working} className="w-full sm:w-auto">
          Skapa utan underlag
        </Button>
        <Button variant="ghost" onClick={onCancel} disabled={working} className="w-full sm:w-auto">
          Avbryt
        </Button>
      </div>
    </Card>
  );
}

export default function DashboardPage() {
  const { profile, plan, setPlan, loaded, email } = useAccountData();
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [weekOpen, setWeekOpen] = useState(false);
  const [weekText, setWeekText] = useState("");

  // Kampanjerna kommer efter planen och blockerar aldrig sidan. Null
  // betyder "hämtas ännu": rekommendationen bygger då på planen och byts
  // ut när svaret kommer. Går hämtningen inte igenom blir det en tom
  // lista, inte en felruta — kampanjerna är underlag för rekommendationen,
  // inte sidans innehåll, och store.ts har redan loggat felet.
  const [campaigns, setCampaigns] = useState<Campaign[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    listCampaigns().then((res) => {
      if (!cancelled) setCampaigns(res.ok ? res.data : []);
    });
    return () => { cancelled = true; };
  }, []);

  const steg = useMemo(
    () => nextStep({
      campaigns,
      plan: plan
        ? {
            createdAt: plan.createdAt,
            postCount: plan.posts?.length ?? 0,
            completedAt: plan.completedAt,
          }
        : null,
      today: todayIso(),
    }),
    [campaigns, plan],
  );

  const name = firstNameFromEmail(email) ?? profile?.companyName?.split(" ")[0];

  // Senaste körningen i den här fliken. Täcker även fallet där
  // sparningen till Supabase misslyckades och planen saknar createdAt.
  const senastGenererad = useRef<number | null>(null);

  /** Återstående karens i sekunder, 0 när det är fritt fram. */
  function karensKvar(): number {
    const tider: number[] = [];
    if (senastGenererad.current !== null) tider.push(senastGenererad.current);
    if (plan?.createdAt) {
      const t = new Date(plan.createdAt).getTime();
      if (!Number.isNaN(t)) tider.push(t);
    }
    if (tider.length === 0) return 0;
    const gick = Date.now() - Math.max(...tider);
    return gick < NY_PLAN_KARENS_MS ? Math.ceil((NY_PLAN_KARENS_MS - gick) / 1000) : 0;
  }

  /** Kampanjer som ska med i veckans plan — samma urval som servern gör,
   *  så det som står i rutan är det som faktiskt skickas in. */
  const veckansKampanjer = useMemo(
    () => relevantCampaigns(campaigns ?? [], todayIso()) as Campaign[],
    [campaigns],
  );

  /** Frågan om veckan kommer före varje ny plan. Karensen kontrolleras
   *  redan här, så ingen skriver sitt underlag i onödan. */
  function openWeekInput() {
    if (!profile || generating) return;
    const kvar = karensKvar();
    if (kvar > 0) {
      setError(
        `Du skapade ett förslag alldeles nyss. Vänta ${kvar} sekunder om du vill göra ett nytt.`,
      );
      return;
    }
    setError(null);
    setWeekOpen(true);
  }

  async function generatePlan(weekInput: string | null) {
    if (!profile || generating) return;

    const kvar = karensKvar();
    if (kvar > 0) {
      setError(
        `Du skapade ett förslag alldeles nyss. Vänta ${kvar} sekunder om du vill göra ett nytt.`,
      );
      return;
    }

    setGenerating(true);
    setError(null);
    try {
      // Ingen foretagsdata i bodyn: servern hamtar den sjalv ur
      // sessionen. Klienten ska inte kunna bestamma vad planen skrivs om.
      // Bodyn bär bara veckans underlag. Företagsdatan hämtar servern
      // själv ur sessionen.
      const res = await fetch("/api/generate-plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ weekInput }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error ?? "Kunde inte skapa veckoplanen just nu.");
      }

      const newPlan = await res.json();
      setPlan(newPlan);
      setWeekOpen(false);
      setWeekText("");

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
          // Ta emot raden tillbaka: planens id behövs av sidorna som
          // läser vidare på den, och det finns bara efter en insert.
          const { data: saved } = await sb.from("plans").insert({
            company_id: company.id, user_id: user.id,
            focus: newPlan.focus, intro: newPlan.intro ?? null,
            tags: newPlan.tags, posts: newPlan.posts,
            campaigns: newPlan.campaigns,
            opportunities: newPlan.opportunities,
            week_input: newPlan.weekInput ?? null,
          }).select().single();
          if (saved) setPlan({ ...newPlan, id: saved.id, createdAt: saved.created_at });
        }
      } catch (syncError) {
        console.warn("Supabase-synk misslyckades:", syncError);
        setError("Planen skapades men kunde inte sparas. Den ligger kvar tills du laddar om sidan — försök igen då.");
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Något gick fel. Försök igen.");
    } finally {
      senastGenererad.current = Date.now();
      setGenerating(false);
    }
  }

  // Varnar bara när vi faktiskt vet när planen skrevs. Saknas datumet
  // sägs ingenting alls — ingen gissning, se VISION.md.
  const gammaltForslag = isPlanStale(plan?.createdAt);
  const forslagetsVecka = plan?.createdAt ? isoWeek(new Date(plan.createdAt)) : null;

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

                  {/* Förslaget står kvar tills ett nytt skapas. Utan den här
                      raden ser en text från i våras ut som veckans.

                      Tystnar när rekommendationen redan är "skapa veckans
                      förslag": då står samma sak två gånger, och den som
                      bär knappen får säga det. */}
                  {gammaltForslag && steg?.id !== "plan-stale" && (
                    <Alert
                      tone="warning"
                      title={`Det här förslaget är från vecka ${forslagetsVecka}`}
                      className="mt-4"
                    >
                      Det skrevs för en annan vecka. Skapa ett nytt om du vill ha något
                      som utgår från var ni är nu.
                    </Alert>
                  )}
                  {/* Här stod plan.intro: ännu ett stycke prosa om veckans
                      tema, under en rubrik som redan säger samma sak. Två
                      textblock före rekommendationen sköt ned det enda på
                      sidan som kräver en handling. Fältet ligger kvar i
                      planen — det renderas bara inte här. */}
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
                </>
              )}
            </header>

            {error && (
              <Alert tone="danger" title="Det gick inte" className="mb-8">{error}</Alert>
            )}

            {/* Planen säger vad den inte kunde skriva om, i stället för att
                tyst byta ämne. Bara direkt efter att den skapats. */}
            {!weekOpen && (plan?.underlagSaknas?.length ?? 0) > 0 && (
              <Alert tone="warning" title="Det här behöver jag veta mer om" className="mb-8">
                <ul className="mt-1 list-disc space-y-1 pl-5">
                  {plan!.underlagSaknas!.map((t, i) => <li key={i}>{t}</li>)}
                </ul>
                <p className="mt-3">
                  Lägg till det under Vad jag vet, eller skriv det i veckans underlag och skapa planen igen.
                </p>
                <div className="mt-3">
                  <ButtonLink href="/company" variant="secondary" size="sm">Vad jag vet</ButtonLink>
                </div>
              </Alert>
            )}

            <div className="space-y-10">
              {weekOpen ? (
                <WeekInputCard
                  value={weekText}
                  onChange={setWeekText}
                  onSubmit={(withInput) => void generatePlan(withInput ? weekText : null)}
                  onCancel={() => setWeekOpen(false)}
                  working={generating}
                  campaigns={veckansKampanjer}
                />
              ) : steg && (
                <NextStepCard
                  steg={steg}
                  onAction={openWeekInput}
                  working={generating}
                />
              )}

              {/* Genvägarna som tidigare var sidans huvudinnehåll. De ligger
                  kvar, men nedtonade: den som redan vet vad hen vill göra ska
                  komma dit, utan att konkurrera med rekommendationen ovanför.
                  Den genväg steget redan pekar på visas inte två gånger. */}
              <section>
                <Label>Annat du kan göra</Label>
                <div className="flex flex-wrap gap-2">
                  {steg?.href !== "/innehall" && (
                    <ButtonLink href="/innehall" variant="secondary" size="sm">
                      {postCount ? `Innehåll (${postCount} inlägg)` : "Innehåll"}
                    </ButtonLink>
                  )}
                  <ButtonLink href="/produkttexter" variant="secondary" size="sm">
                    Produkttexter
                  </ButtonLink>
                  <ButtonLink href="/campaigns" variant="secondary" size="sm">
                    Kampanjer
                  </ButtonLink>
                  <ButtonLink href="/company" variant="secondary" size="sm">
                    Vad jag vet
                  </ButtonLink>
                  {steg?.action !== "generate-plan" && !weekOpen && (
                    <Button variant="secondary" size="sm" onClick={openWeekInput} loading={generating}>
                      Nytt förslag
                    </Button>
                  )}
                </div>
              </section>

              {/* På radarn — vad som kommer, att skanna på två sekunder.
                  Låg visuell tyngd med flit: raderna får aldrig konkurrera
                  med rekommendationen ovanför. Varje möjlighet bar tidigare
                  ett kort med hela sin relevance-text — tre stycken prosa
                  utan en enda handling. Motiveringen ligger kvar i planen.
                  Etikett och innehåll delas som på /history. */}
              {opportunities.length > 0 && (
                <section>
                  <Label>På radarn</Label>
                  <ul className="border-y border-border">
                    {opportunities.slice(0, 3).map((o, i) => {
                      const nar = opportunityWhen(o.date);
                      return (
                        <li
                          key={i}
                          className="flex flex-col gap-0.5 border-b border-border py-2.5 last:border-0 sm:flex-row sm:items-baseline sm:gap-4"
                        >
                          {nar && (
                            <span className="text-xs text-text-tertiary sm:w-28 sm:shrink-0">{nar}</span>
                          )}
                          <span className="text-sm leading-snug">{o.title}</span>
                        </li>
                      );
                    })}
                  </ul>
                </section>
              )}

              {/* Renderar ingenting for den som inte ar administrator.
                  Rubriken sitter inuti panelen, sa den inte blir kvar
                  ensam ovanfor ett tomrum. */}
              <UsagePanel />
            </div>
          </>
        )}
      </div>
    </AppShell>
  );
}

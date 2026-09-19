"use client";

// ─────────────────────────────────────────────────────────────
// Onboarding, i appens system: papperston, emerald, sans.
//
// Affärslogiken är oförändrad — samma anrop till /api/analyze-company
// och /api/generate-plan, samma upsert mot companies, samma insert mot
// plans. Bara presentationen är ny.
//
// En inloggad användare som redan har ett företag skickas till Idag.
// Onboardingen skriver över företagskunskapen via upsert, och den som
// råkar hamna här igen ska inte kunna radera svaren hen redan gett.
// ─────────────────────────────────────────────────────────────
import { createClient } from "@/lib/supabase-browser";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Alert, Button, Card, Field, Input, Spinner, cx } from "@/app/_shared/primitives";
import { Textarea } from "@/app/_shared/Textarea";
import type { MarketingPlan } from "@/app/_shared/useAccountData";

type CompanyProfile = {
  companyName: string; industry: string; summary: string;
  customers: string[]; products: string[]; tone: string[];
  strengths: string[]; avoid: string[]; contentGuidelines: string[];
  bestCustomer?: string;
  commonQuestion?: string;
  differentiator?: string;
  recentJob?: string;
  _websiteScraped?: boolean;
};

const STEPS_WITH_WEBSITE = [
  "Läser hemsidan…",
  "Identifierar kunder…",
  "Identifierar tjänster…",
  "Föreslår svar åt dig…",
  "Sammanställer företagskunskapen…",
];

const PLAN_STEPS = [
  "Skriver inlägg till sociala medier…",
  "Skriver nyhetsbrev…",
  "Bygger kampanjförslag…",
  "Letar efter möjligheter…",
];

/** Stegen under en väntan. Visar vad som pågår, inte hur långt det är kvar. */
function StepList({ steps, current }: { steps: string[]; current: number }) {
  return (
    <ol className="space-y-1">
      {steps.map((s, i) => {
        const done = i < current;
        const active = i === current;
        return (
          <li
            key={i}
            className={cx(
              "flex items-center gap-3 rounded px-3 py-2.5 text-[15px]",
              active && "bg-surface font-medium",
              !done && !active && "text-text-tertiary",
            )}
          >
            <span aria-hidden className="flex h-5 w-5 shrink-0 items-center justify-center">
              {done ? (
                <svg viewBox="0 0 16 16" className="h-4 w-4 text-primary" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M3 8.5l3.5 3.5L13 5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              ) : active ? (
                <Spinner className="text-primary" />
              ) : (
                <span className="h-1.5 w-1.5 rounded-full bg-border-strong" />
              )}
            </span>
            {s}
          </li>
        );
      })}
    </ol>
  );
}

/* ── STEG 1: Namn + hemsida ────────────────────────────── */
function StartScreen({ onAnalyze, onManual }: {
  onAnalyze: (name: string, website: string) => void;
  onManual: (name: string) => void;
}) {
  const [name, setName] = useState("");
  const [website, setWebsite] = useState("");
  const [showManual, setShowManual] = useState(false);

  const canAnalyze = Boolean(name.trim() && website.trim());
  const canManual = Boolean(name.trim());

  return (
    <div>
      <h1 className="text-[clamp(1.6rem,4vw,2.1rem)] font-semibold leading-tight tracking-tight">
        Berätta om företaget.
      </h1>
      <p className="mt-3 max-w-md text-[15px] leading-relaxed text-text-secondary">
        Skriv adressen till din hemsida, så läser jag den och föreslår svaren åt dig.
        Du behöver bara rätta det som blir fel.
      </p>

      <div className="mt-8 space-y-5">
        <Field label="Företagsnamn">
          {(f) => (
            <Input
              {...f}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="t.ex. Gasolfyllarna Norrköping"
            />
          )}
        </Field>

        {!showManual && (
          <Field label="Hemsida" hint="Jag läser sidan och föreslår svar på frågorna i nästa steg.">
            {(f) => (
              <Input
                {...f}
                value={website}
                onChange={(e) => setWebsite(e.target.value)}
                placeholder="t.ex. shop.gasolfyllarna.se"
              />
            )}
          </Field>
        )}
      </div>

      <div className="mt-8">
        {!showManual ? (
          <>
            <Button onClick={() => onAnalyze(name, website)} disabled={!canAnalyze}>
              Läs hemsidan
            </Button>
            <p className="mt-5 text-sm text-text-secondary">
              Ingen hemsida?{" "}
              <button
                type="button"
                onClick={() => setShowManual(true)}
                className="cursor-pointer font-medium text-primary underline underline-offset-2"
              >
                Fyll i själv
              </button>
            </p>
          </>
        ) : (
          <>
            <Button onClick={() => onManual(name)} disabled={!canManual}>
              Fortsätt
            </Button>
            <p className="mt-5 text-sm text-text-secondary">
              <button
                type="button"
                onClick={() => setShowManual(false)}
                className="cursor-pointer font-medium text-primary underline underline-offset-2"
              >
                Använd hemsidan i stället
              </button>
            </p>
          </>
        )}
      </div>
    </div>
  );
}

/* ── Laddningsskärm under analys ───────────────────────── */
function AnalyzingScreen() {
  const [step, setStep] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setStep(p => Math.min(p + 1, STEPS_WITH_WEBSITE.length - 1)), 700);
    return () => clearInterval(t);
  }, []);
  return (
    <div>
      <h1 className="text-[clamp(1.6rem,4vw,2.1rem)] font-semibold leading-tight tracking-tight">
        Jag läser din hemsida.
      </h1>
      <p className="mt-3 max-w-md text-[15px] leading-relaxed text-text-secondary">
        Strax får du fyra frågor med färdiga förslag på svar.
      </p>
      <div className="mt-8">
        <StepList steps={STEPS_WITH_WEBSITE} current={step} />
      </div>
    </div>
  );
}

/** Svar från en route: ok bara när status är 2xx och kroppen inte är ett felsvar. */
async function readJson<T>(r: Response): Promise<{ ok: boolean; data: (T & { error?: string }) | null }> {
  const data = (await r.json().catch(() => null)) as (T & { error?: string }) | null;
  return { ok: r.ok && Boolean(data) && !data?.error, data };
}

/* ── STEG 2: Förifyllda fält att bekräfta/justera ──────── */
function ConfirmScreen({ profile, prefilled, notice, onConfirm }: {
  profile: CompanyProfile;
  prefilled: boolean;
  /** Varför analysen eller planen inte blev av, med serverns egna ord. */
  notice: string | null;
  onConfirm: (answers: { bestCustomer: string; commonQuestion: string; differentiator: string; recentJob: string }) => void;
}) {
  const [bestCustomer, setBestCustomer] = useState(profile.bestCustomer || "");
  const [commonQuestion, setCommonQuestion] = useState(profile.commonQuestion || "");
  const [differentiator, setDifferentiator] = useState(profile.differentiator || "");
  const [recentJob, setRecentJob] = useState(profile.recentJob || "");

  const canSubmit = Boolean(bestCustomer.trim() && commonQuestion.trim() && differentiator.trim());

  const fields = [
    {
      label: "Er bästa kund",
      hint: "Vem är de, vad gör de, varför anlitar de er?",
      value: bestCustomer, set: setBestCustomer, optional: false,
      placeholder: "t.ex. Husbilsägare 50–70 år som behöver fylla gastank inför semestern.",
    },
    {
      label: "Vad frågar folk om mest?",
      hint: "Det avslöjar vad texterna behöver svara på.",
      value: commonQuestion, set: setCommonQuestion, optional: false,
      placeholder: "t.ex. Hur lång tid tar det? Fyller ni alla typer av flaskor?",
    },
    {
      label: "Vad skiljer er från konkurrenterna?",
      hint: "Varför väljer kunder er framför någon annan?",
      value: differentiator, set: setDifferentiator, optional: false,
      placeholder: "t.ex. Vi fyller i lösvikt — du betalar bara för det som faktiskt fylls i flaskan.",
    },
    {
      label: "Ett jobb ni gjort nyligen",
      hint: "Ett konkret exempel ger mig verkligt material att skriva av.",
      value: recentJob, set: setRecentJob, optional: true,
      placeholder: "t.ex. En familj kom in dagen innan semestern — vi fyllde deras 33-liters tank på 20 minuter.",
    },
  ];

  return (
    <div>
      <h1 className="text-[clamp(1.6rem,4vw,2.1rem)] font-semibold leading-tight tracking-tight">
        {prefilled ? "Stämmer det här om er?" : "Fyra frågor om företaget."}
      </h1>
      <p className="mt-3 max-w-md text-[15px] leading-relaxed text-text-secondary">
        {prefilled
          ? "Jag läste din hemsida och gissade svaren. Läs igenom och ändra det som är fel — det här styr allt jag skriver åt dig."
          : "Var konkret. Generiska svar ger generiska texter."}
      </p>

      {notice && (
        <Alert tone="warning" className="mt-5">{notice}</Alert>
      )}

      {prefilled && (
        <Alert className="mt-5">Förslagen nedan kommer från din hemsida. Ändra fritt.</Alert>
      )}

      <div className="mt-8 space-y-5">
        {fields.map((f) => (
          <Field key={f.label} label={f.label} hint={f.hint} optional={f.optional}>
            {(p) => (
              <Textarea
                {...p}
                rows={3}
                value={f.value}
                onChange={(e) => f.set(e.target.value)}
                placeholder={f.placeholder}
              />
            )}
          </Field>
        ))}
      </div>

      <div className="mt-8">
        <Button
          onClick={() => onConfirm({ bestCustomer, commonQuestion, differentiator, recentJob })}
          disabled={!canSubmit}
        >
          Skapa veckans förslag
        </Button>
      </div>
    </div>
  );
}

/* ── Laddningsskärm under plansgenerering ──────────────── */
function GeneratingScreen() {
  const [step, setStep] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setStep(p => Math.min(p + 1, PLAN_STEPS.length - 1)), 950);
    return () => clearInterval(t);
  }, []);
  return (
    <div>
      <h1 className="text-[clamp(1.6rem,4vw,2.1rem)] font-semibold leading-tight tracking-tight">
        Jag skriver veckans förslag.
      </h1>
      <p className="mt-3 max-w-md text-[15px] leading-relaxed text-text-secondary">
        Det bygger på svaren du precis gav. Det tar en stund.
      </p>
      <div className="mt-8">
        <StepList steps={PLAN_STEPS} current={step} />
      </div>
    </div>
  );
}

export default function OnboardingPage() {
  const router = useRouter();
  const [screen, setScreen] = useState<"start" | "analyzing" | "confirm" | "generating">("start");
  const [profile, setProfile] = useState<CompanyProfile | null>(null);
  const [prefilled, setPrefilled] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  // Tills kontrollen nedan är klar visas ingenting: den som redan har ett
  // företag ska inte hinna se ett tomt formulär och börja fylla i det.
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const sb = createClient();
        const { data: { user } } = await sb.auth.getUser();
        if (!user) { if (!cancelled) setChecking(false); return; }
        const { data: companies } = await sb
          .from("companies").select("id").eq("user_id", user.id).limit(1);
        if (cancelled) return;
        if (companies && companies.length > 0) {
          router.replace("/dashboard");
          return;
        }
        setChecking(false);
      } catch {
        // Går kontrollen inte att göra är det bättre att släppa in än att
        // låsa ute — onboardingen är enda sättet att komma igång.
        if (!cancelled) setChecking(false);
      }
    })();
    return () => { cancelled = true; };
  }, [router]);

  // Hemsidevägen: skrapa + föreslå svar, gå sedan till bekräftelse
  async function handleAnalyze(name: string, website: string) {
    setScreen("analyzing");

    const input = { companyName: name, website: website.trim() };

    const [res] = await Promise.all([
      fetch("/api/analyze-company", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      }).then((r) => readJson<CompanyProfile>(r), () => ({ ok: false, data: null })),
      new Promise(r => setTimeout(r, 3500)),
    ]);
    // Ett felsvar är inte en profil. Förut blev { error } en tom profil och
    // ingen fick veta varför fälten var tomma, inte ens vid slut saldo.
    const result = res.ok ? res.data : null;
    setNotice(res.ok ? null : `${res.data?.error ?? "Hemsidan kunde inte läsas."} Du kan fylla i fälten själv.`);

    const p: CompanyProfile = result || {
      companyName: name, industry: "",
      summary: "", customers: [], products: [], tone: [],
      strengths: [], avoid: [], contentGuidelines: [],
    };
    p.companyName = name;

    setProfile(p);
    setPrefilled(!!(result && result._websiteScraped));
    setScreen("confirm");
  }

  // Manuell väg: hoppa direkt till tomma fält
  function handleManual(name: string) {
    const p: CompanyProfile = {
      companyName: name, industry: "",
      summary: "", customers: [], products: [], tone: [],
      strengths: [], avoid: [], contentGuidelines: [],
      bestCustomer: "", commonQuestion: "", differentiator: "", recentJob: "",
    };
    setProfile(p);
    setPrefilled(false);
    setScreen("confirm");
  }

  // Steg 2 klart: bygg slutlig profil och generera plan
  async function handleConfirm(answers: { bestCustomer: string; commonQuestion: string; differentiator: string; recentJob: string }) {
    if (!profile) return;
    setScreen("generating");

    // Slå ihop den lästa profilen med ägarens (ev. justerade) svar
    const finalProfile: CompanyProfile = {
      ...profile,
      bestCustomer: answers.bestCustomer,
      commonQuestion: answers.commonQuestion,
      differentiator: answers.differentiator,
      recentJob: answers.recentJob,
    };

    // Fyll luckor om analysen inte gav profilfält (t.ex. manuell väg)
    if (!finalProfile.summary) {
      finalProfile.summary = `${profile.companyName} hjälper sina kunder med professionella tjänster och lösningar.`;
    }
    if (!finalProfile.customers?.length && answers.bestCustomer) {
      finalProfile.customers = [answers.bestCustomer.split(" ").slice(0, 8).join(" ")];
    }
    if (!finalProfile.strengths?.length && answers.differentiator) {
      finalProfile.strengths = [answers.differentiator.split(" ").slice(0, 8).join(" ")];
    }

    // Supabase är lagringen — ingen kopia på enheten. Företags-id:t
    // behövs strax nedan för att planen ska hamna på rätt företag.
    let companyId: string | null = null;
    try {
      const sb = createClient();
      const { data: { user } } = await sb.auth.getUser();
      if (user) {
        const { data: company } = await sb.from("companies").upsert({
          name: finalProfile.companyName,
          industry: finalProfile.industry,
          summary: finalProfile.summary,
          customers: finalProfile.customers,
          products: finalProfile.products,
          tone: finalProfile.tone,
          strengths: finalProfile.strengths,
          avoid: finalProfile.avoid,
          content_guidelines: finalProfile.contentGuidelines,
          best_customer: finalProfile.bestCustomer,
          common_question: finalProfile.commonQuestion,
          differentiator: finalProfile.differentiator,
          recent_job: finalProfile.recentJob,
          user_id: user.id,
        }, { onConflict: "user_id,name" }).select().single();
        companyId = company?.id ?? null;
      }
    } catch (sbError) {
      console.warn("Kunde inte spara företag till Supabase:", sbError);
    }
    const [res] = await Promise.all([
      // Foretaget ar redan upsertat ovan, sa servern hittar det sjalv.
      // Ingen foretagsdata skickas i bodyn.
      fetch("/api/generate-plan", { method: "POST" })
        .then((r) => readJson<MarketingPlan>(r), () => ({ ok: false, data: null })),
      new Promise(r => setTimeout(r, 4200)),
    ]);

    // Blev det ingen plan: tillbaka till frågorna med svaren kvar och
    // beskedet synligt. Förut sparades felsvaret som en tom plan och man
    // hamnade på en tom översikt utan förklaring.
    if (!res.ok) {
      setProfile(finalProfile);
      setNotice(res.data?.error ?? "Veckans förslag kunde inte skapas. Försök igen.");
      setScreen("confirm");
      return;
    }
    const result = res.data;

    // Första planen sparas i databasen, inte på enheten. Misslyckas det
    // står dashboarden tom i stället för att visa något som inte finns
    // kvar nästa gång — hellre det än ett falskt minne.
    if (result && companyId) {
      try {
        const sb = createClient();
        const { data: { user } } = await sb.auth.getUser();
        if (user) {
          await sb.from("plans").insert({
            company_id: companyId, user_id: user.id,
            focus: result.focus, intro: result.intro ?? null,
            tags: result.tags, posts: result.posts,
            newsletter: result.newsletter, campaigns: result.campaigns,
            opportunities: result.opportunities,
          });
        }
      } catch (planError) {
        console.warn("Kunde inte spara planen till Supabase:", planError);
      }
    }

    router.push("/dashboard");
  }

  return (
    <div className="app-light min-h-svh bg-background font-sans text-text-primary">
      <header className="border-b border-border">
        <div className="mx-auto flex h-14 max-w-2xl items-center justify-between px-4 sm:px-6 lg:px-10">
          <span className="flex items-center gap-2.5">
            <span
              aria-hidden
              className="flex h-7 w-7 items-center justify-center rounded bg-primary text-sm font-medium text-white"
            >
              M
            </span>
            <span className="text-sm font-medium">Marketing Copilot</span>
          </span>
          <span className="text-sm text-text-tertiary">
            {screen === "start" && "Tar ett par minuter"}
            {(screen === "analyzing" || screen === "generating") && "Arbetar…"}
            {screen === "confirm" && "Sista steget"}
          </span>
        </div>
      </header>

      <div className="mx-auto max-w-2xl px-4 py-10 sm:px-6 lg:px-10 lg:py-14">
        {checking ? (
          <Card>
            <p className="text-[15px] text-text-secondary">Ett ögonblick…</p>
          </Card>
        ) : (
          <>
            {screen === "start" && <StartScreen onAnalyze={handleAnalyze} onManual={handleManual} />}
            {screen === "analyzing" && <AnalyzingScreen />}
            {screen === "confirm" && profile && <ConfirmScreen profile={profile} prefilled={prefilled} notice={notice} onConfirm={handleConfirm} />}
            {screen === "generating" && <GeneratingScreen />}
          </>
        )}
      </div>
    </div>
  );
}

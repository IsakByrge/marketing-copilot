// ─────────────────────────────────────────────────────────────
// Ram runt inloggningsformuläret.
//
// Formuläret läser ?mode med useSearchParams, vilket kräver en
// Suspense-gräns på en förrenderad rutt — annars faller hela
// klientträdet tillbaka till klientrendering vid bygget. Ramen är
// därför en serverkomponent och formuläret ligger i LoginForm.
// ─────────────────────────────────────────────────────────────
import Link from "next/link";
import { Suspense } from "react";
import LoginForm from "./LoginForm";

function Skelett() {
  return (
    <div className="w-full max-w-sm">
      <div className="h-8 w-56 rounded bg-surface-sunken" />
      <div className="mt-4 h-5 w-64 rounded bg-surface-sunken" />
    </div>
  );
}

export default function LoginPage() {
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
        <Suspense fallback={<Skelett />}>
          <LoginForm />
        </Suspense>
      </main>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Ram runt inloggningsformuläret.
//
// Formuläret läser ?mode med useSearchParams, vilket kräver en
// Suspense-gräns på en förrenderad rutt — annars faller hela
// klientträdet tillbaka till klientrendering vid bygget. Ramen är
// därför en serverkomponent och formuläret ligger i LoginForm.
//
// Själva ytan — tvåspalt med exempelkortet till höger — delas med
// /auth/reset och /auth/callback via AuthRam.
// ─────────────────────────────────────────────────────────────
import { Suspense } from "react";
import AuthRam from "@/app/_shared/AuthRam";
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
    <AuthRam>
      <Suspense fallback={<Skelett />}>
        <LoginForm />
      </Suspense>
    </AuthRam>
  );
}

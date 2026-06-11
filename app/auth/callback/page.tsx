"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase-browser";

export default function AuthCallback() {
  const router = useRouter();

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.onAuthStateChange((event, session) => {
      if (session) {
        if (event === "SIGNED_IN") {
          // Rensa localStorage så ny användare börjar från onboarding
          localStorage.removeItem("marketing-copilot-company-profile");
          localStorage.removeItem("marketing-copilot-plan");
          localStorage.removeItem("marketing-copilot-last-generated");
          localStorage.removeItem("marketing-copilot-rhythm");
          localStorage.removeItem("marketing-copilot-brain-files");
          router.push("/onboarding");
        } else {
          const profile = localStorage.getItem("marketing-copilot-company-profile");
          router.push(profile ? "/dashboard" : "/onboarding");
        }
      } else {
        router.push("/login");
      }
    });
  }, [router]);

  return (
    <main style={{ minHeight: "100svh", background: "#2a2f3a", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <span style={{ color: "#c9a96e", fontSize: "0.8rem", letterSpacing: "0.1em", textTransform: "uppercase" }}>Loggar in…</span>
    </main>
  );
}
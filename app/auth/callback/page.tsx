"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase-browser";

export default function AuthCallback() {
  const router = useRouter();

  useEffect(() => {
    const sb = createClient();

    async function route() {
      const { data: { user } } = await sb.auth.getUser();
      if (!user) {
        router.push("/login");
        return;
      }
      const { data: companies } = await sb
        .from("companies")
        .select("id")
        .eq("user_id", user.id)
        .limit(1);
      router.push(companies && companies.length > 0 ? "/dashboard" : "/onboarding");
    }

    route();
  }, [router]);

  return (
    <main style={{ minHeight: "100svh", background: "#2a2f3a", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <span style={{ color: "#c9a96e", fontSize: "0.8rem", letterSpacing: "0.1em", textTransform: "uppercase" }}>Loggar in…</span>
    </main>
  );
}
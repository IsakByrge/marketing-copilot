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
        router.push("/dashboard");
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
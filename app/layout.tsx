import type { Metadata } from "next";
import { Cormorant_Garamond, Outfit, Geist } from "next/font/google";
import "./globals.css";

// Geist is the design-system typeface (weights 400/500/600 come from the
// variable font). Exposed as --font-geist, which the --font-sans design
// token in globals.css references. Registered additively: Outfit + Cormorant
// stay so the frozen dark pages and legacy routes render unchanged in Sprint 1.
const geist = Geist({
  subsets: ["latin"],
  variable: "--font-geist",
  display: "swap",
});

const cormorant = Cormorant_Garamond({
  subsets: ["latin"],
  weight: ["300", "400"],
  style: ["normal", "italic"],
  variable: "--font-cormorant",
  display: "swap",
});

const outfit = Outfit({
  subsets: ["latin"],
  weight: ["300", "400", "500"],
  variable: "--font-outfit",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Marketing Copilot",
  description: "AI-driven marknadsföring för ditt företag.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="sv"
      className={`h-full ${geist.variable} ${cormorant.variable} ${outfit.variable}`}
      style={{ background: "#111111" }}
    >
      <body
        className="min-h-full flex flex-col"
        style={{
          background: "#111111",
          color: "#f0f0f0",
          minHeight: "100svh",
        }}
      >
        {children}
      </body>
    </html>
  );
}
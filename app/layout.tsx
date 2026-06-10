import type { Metadata } from "next";
import { Cormorant_Garamond, Outfit } from "next/font/google";
import "./globals.css";

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
      className={`h-full ${cormorant.variable} ${outfit.variable}`}
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
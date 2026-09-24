import type { Metadata } from "next";
import { Cormorant_Garamond, Outfit, Geist } from "next/font/google";
import {
  ALWAYS_LIGHT_PATHS, DARK_QUERY, DEFAULT_PREFERENCE, THEME_ATTRIBUTE, THEME_STORAGE_KEY,
} from "@/app/_shared/theme-preference";
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

/**
 * Kör före hydration och sätter data-theme på <html>.
 *
 * Konstanterna kommer från theme-preference.ts så att nyckelnamn och
 * publika rutter bara står på ett ställe — scriptet kan inte importera,
 * men det kan byggas av importerade värden.
 *
 * Allt ligger i try/catch: localStorage kastar i privat läge och med
 * blockerade kakor, och matchMedia saknas i äldre webbvyer. Ett tema är
 * inte värt ett undantag som stoppar sidan.
 *
 * Publika rutter tvingas ljusa redan här, inte bara på sin wrapper.
 * Annars skulle överscroll-zonen på landningssidan vara mörk för en
 * användare som valt mörkt inne i appen.
 */
const themeBootstrap = `(function(){try{
var d=document.documentElement;
var pub=${JSON.stringify(ALWAYS_LIGHT_PATHS)};
var p=location.pathname.replace(/\\/+$/,"")||"/";
if(pub.indexOf(p)>-1){d.setAttribute(${JSON.stringify(THEME_ATTRIBUTE)},"light");return;}
var v=null;try{v=localStorage.getItem(${JSON.stringify(THEME_STORAGE_KEY)});}catch(e){}
if(v!=="light"&&v!=="dark")v=${JSON.stringify(DEFAULT_PREFERENCE)};
var t=v==="light"||v==="dark"?v:(window.matchMedia&&window.matchMedia(${JSON.stringify(DARK_QUERY)}).matches?"dark":"light");
d.setAttribute(${JSON.stringify(THEME_ATTRIBUTE)},t);
}catch(e){}})();`;

export const metadata: Metadata = {
  title: "Marketing Copilot",
  description:
    "Marketing Copilot hjälper dig prioritera vad som är viktigast i marknadsföringen och ta nästa steg.",
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
      suppressHydrationWarning
    >
      <head>
        {/* Sätter temat FÖRE första paint. Utan det målas sidan i
            standardtemat och byter sedan när React hunnit läsa
            localStorage — en synlig blink vid varje omladdning.
            Sidorna är statiskt förrenderade, så det finns ingen server
            att läsa preferensen på; den måste läsas här.

            suppressHydrationWarning ovan: scriptet ändrar html-elementet
            innan React tar över, och React ska inte klaga på att
            attributet inte fanns i serverns markup. */}
        <script dangerouslySetInnerHTML={{ __html: themeBootstrap }} />
      </head>
      <body className="flex min-h-full flex-col" style={{ minHeight: "100svh" }}>
        {children}
      </body>
    </html>
  );
}
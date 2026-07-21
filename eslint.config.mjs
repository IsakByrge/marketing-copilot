import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Icke-produktfiler utanför Next-appen: en fristående CJS-engångsskript
    // för färgbyten (körs manuellt med `node`, använder require med flit) och
    // en fristående prototyp som inte importeras någonstans. De ingår inte i
    // bygget och lintas därför inte som appkod. (Kandidater för radering.)
    "node update-colors.js",
    "veckoplan-app.jsx",
  ]),
]);

export default eslintConfig;

const fs = require("fs");
const path = require("path");

const replacements = [
  ['bg: "#0a0908"', 'bg: "#2a2f3a"'],
  ['bg: "#0a0908",', 'bg: "#2a2f3a",'],
  ['bg: "#111111"', 'bg: "#2a2f3a"'],
  ['bg: "#111111",', 'bg: "#2a2f3a",'],
  ['surface: "#111009"', 'surface: "#323845"'],
  ['surface: "#111009",', 'surface: "#323845",'],
  ['surface: "#1a1a1a"', 'surface: "#323845"'],
  ['surface: "#1a1a1a",', 'surface: "#323845",'],
  ['surface2: "#181510"', 'surface2: "#3a4050"'],
  ['surface2: "#181510",', 'surface2: "#3a4050",'],
  ['surface2: "#222222"', 'surface2: "#3a4050"'],
  ['surface2: "#222222",', 'surface2: "#3a4050",'],
  ['text: "#f5f0e8"', 'text: "#ffffff"'],
  ['text: "#f5f0e8",', 'text: "#ffffff",'],
  ['text: "#f0f0f0"', 'text: "#ffffff"'],
  ['text: "#f0f0f0",', 'text: "#ffffff",'],
  ['text2: "rgba(245,240,232,0.55)"', 'text2: "#cbd5e0"'],
  ['text2: "rgba(245,240,232,0.55)",', 'text2: "#cbd5e0",'],
  ['text2: "rgba(240,240,240,0.78)"', 'text2: "#cbd5e0"'],
  ['text2: "rgba(240,240,240,0.78)",', 'text2: "#cbd5e0",'],
  ['text3: "rgba(245,240,232,0.30)"', 'text3: "#a0aec0"'],
  ['text3: "rgba(245,240,232,0.30)",', 'text3: "#a0aec0",'],
  ['text3: "rgba(240,240,240,0.50)"', 'text3: "#a0aec0"'],
  ['text3: "rgba(240,240,240,0.50)",', 'text3: "#a0aec0",'],
  ['line: "rgba(255,248,235,0.08)"', 'line: "rgba(255,255,255,0.10)"'],
  ['line: "rgba(255,248,235,0.08)",', 'line: "rgba(255,255,255,0.10)",'],
  ['line2: "rgba(255,248,235,0.13)"', 'line2: "rgba(255,255,255,0.18)"'],
  ['line2: "rgba(255,248,235,0.13)",', 'line2: "rgba(255,255,255,0.18)",'],
  ['background: "#0a0908"', 'background: "#2a2f3a"'],
  ['background: "#111111"', 'background: "#2a2f3a"'],
  ['"rgba(10,9,8,0.92)"', '"rgba(42,47,58,0.95)"'],
  ['"rgba(10,9,8,0.88)"', '"rgba(42,47,58,0.95)"'],
  ['"rgba(10,9,8,0.90)"', '"rgba(42,47,58,0.95)"'],
  ['"rgba(10,9,8,0.96)"', '"rgba(42,47,58,0.98)"'],
];

const files = [
  "app/dashboard/page.tsx",
  "app/onboarding/page.tsx",
  "app/plan/page.tsx",
  "app/post/[id]/page.tsx",
  "app/newsletter/page.tsx",
  "app/campaign/page.tsx",
  "app/profile/page.tsx",
  "app/create/page.tsx",
  "app/generating/page.tsx",
  "app/page.tsx",
];

let totalChanges = 0;

files.forEach((file) => {
  const filePath = path.join(process.cwd(), file);
  if (!fs.existsSync(filePath)) {
    console.log(`⚠️  Hittades inte: ${file}`);
    return;
  }

  let content = fs.readFileSync(filePath, "utf8");
  let changed = 0;

  replacements.forEach(([from, to]) => {
    if (content.includes(from)) {
      content = content.replaceAll(from, to);
      changed++;
    }
  });

  if (changed > 0) {
    fs.writeFileSync(filePath, content, "utf8");
    console.log(`✓ ${file} — ${changed} ändringar`);
    totalChanges += changed;
  } else {
    console.log(`· ${file} — inga ändringar`);
  }
});

console.log(`\nKlart — ${totalChanges} ändringar totalt`);
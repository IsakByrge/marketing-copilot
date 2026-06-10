const fs = require("fs");
const path = require("path");

const replacements = [
  // Backgrounds
  ['bg: "#0a0908"', 'bg: "#111111"'],
  ['bg: "#0a0908",', 'bg: "#111111",'],
  ["bg: '#0a0908'", "bg: '#111111'"],
  // Surfaces
  ['surface: "#111009"', 'surface: "#1a1a1a"'],
  ['surface: "#111009",', 'surface: "#1a1a1a",'],
  ['surface2: "#181510"', 'surface2: "#222222"'],
  ['surface2: "#181510",', 'surface2: "#222222",'],
  // Inline background references
  ['background: "#0a0908"', 'background: "#111111"'],
  ['background: T.bg', 'background: T.bg'], // keep as-is, T.bg handles it
  // Text — lighten muted and subtle
  ['text2: "rgba(245,240,232,0.55)"', 'text2: "rgba(240,240,240,0.78)"'],
  ['text2: "rgba(245,240,232,0.55)",', 'text2: "rgba(240,240,240,0.78)",'],
  ['text3: "rgba(245,240,232,0.30)"', 'text3: "rgba(240,240,240,0.50)"'],
  ['text3: "rgba(245,240,232,0.30)",', 'text3: "rgba(240,240,240,0.50)",'],
  // Main text
  ['text: "#f5f0e8"', 'text: "#f0f0f0"'],
  ['text: "#f5f0e8",', 'text: "#f0f0f0",'],
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
    if (from === to) return;
    const count = (content.match(new RegExp(from.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "g")) || []).length;
    if (count > 0) {
      content = content.replaceAll(from, to);
      changed += count;
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

console.log(`\n✓ Klart — ${totalChanges} ändringar totalt`);
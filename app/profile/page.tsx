"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";

const T = {
  bg: "#0a0908", surface: "#111009", surface2: "#181510",
  line: "rgba(255,248,235,0.08)", line2: "rgba(255,248,235,0.13)",
  text: "#f5f0e8", text2: "rgba(245,240,232,0.55)", text3: "rgba(245,240,232,0.30)",
  gold: "#c9a96e", goldDim: "rgba(201,169,110,0.10)", goldBorder: "rgba(201,169,110,0.22)",
};

type CompanyInput = {
  companyName: string; website: string; industry: string;
  products: string; customers: string; tone: string;
  avoid: string; previousPosts: string;
};

type UploadedFile = {
  name: string; size: number; type: string;
  addedAt: string; content?: string;
};

function SLabel({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, fontSize: "0.65rem", fontWeight: 400, letterSpacing: "0.18em", textTransform: "uppercase" as const, color: T.gold }}>
      <span style={{ width: 18, height: 1, background: T.gold, opacity: .5, display: "block" }} />
      {children}
    </div>
  );
}

export default function ProfilePage() {
  const [company, setCompany] = useState<CompanyInput | null>(null);
  const [files, setFiles] = useState<UploadedFile[]>([]);
  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const saved = localStorage.getItem("marketing-copilot-company-input");
    if (saved) try { setCompany(JSON.parse(saved)); } catch {}
    const savedFiles = localStorage.getItem("marketing-copilot-brain-files");
    if (savedFiles) try { setFiles(JSON.parse(savedFiles)); } catch {}
  }, []);

  function saveFiles(updated: UploadedFile[]) {
    setFiles(updated);
    localStorage.setItem("marketing-copilot-brain-files", JSON.stringify(updated));
  }

  async function handleFiles(fileList: FileList | null) {
    if (!fileList) return;
    for (const file of Array.from(fileList)) {
      setUploading(file.name);
      await new Promise(r => setTimeout(r, 600)); // simulate processing
      const newFile: UploadedFile = {
        name: file.name,
        size: file.size,
        type: file.type,
        addedAt: new Date().toLocaleDateString("sv-SE"),
      };
      // For text files, read content
      if (file.type === "text/plain" || file.name.endsWith(".txt") || file.name.endsWith(".md")) {
        const text = await file.text();
        newFile.content = text.slice(0, 2000);
      }
      setFiles(prev => {
        const updated = [...prev, newFile];
        localStorage.setItem("marketing-copilot-brain-files", JSON.stringify(updated));
        return updated;
      });
      setUploading(null);
    }
  }

  function removeFile(name: string) {
    saveFiles(files.filter(f => f.name !== name));
  }

  function formatSize(bytes: number) {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  function fileIcon(type: string, name: string) {
    if (type.includes("pdf") || name.endsWith(".pdf")) return "📄";
    if (type.includes("image")) return "🖼";
    if (type.includes("word") || name.endsWith(".docx")) return "📝";
    if (name.endsWith(".csv")) return "📊";
    return "📁";
  }

  if (!company) return (
    <main style={{ minHeight: "100svh", background: T.bg, padding: "80px 48px" }}>
      <Link href="/onboarding" style={{ fontSize: "0.7rem", fontWeight: 400, letterSpacing: "0.1em", textTransform: "uppercase", color: T.text3, textDecoration: "none" }}>← Till onboarding</Link>
      <p style={{ marginTop: 80, fontSize: "1rem", fontWeight: 300, color: T.text2 }}>Ingen företagsprofil hittades.</p>
    </main>
  );

  const fields = [
    ["Företag", company.companyName],
    ["Hemsida", company.website],
    ["Bransch", company.industry],
    ["Vad ni säljer", company.products],
    ["Kunder", company.customers],
    ["Tonalitet", company.tone],
    ["Undvik", company.avoid],
    ["Tidigare inlägg", company.previousPosts],
  ];

  return (
    <main style={{ minHeight: "100svh", background: T.bg }}>

      {/* Nav */}
      <nav style={{
        position: "sticky", top: 0, zIndex: 100,
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "0 48px", height: 56,
        background: "rgba(10,9,8,0.92)", backdropFilter: "blur(20px)",
        borderBottom: `1px solid ${T.line}`,
      }}>
        <a href="/" style={{ fontFamily: "var(--font-cormorant), serif", fontWeight: 500, fontSize: "1.1rem", letterSpacing: "0.08em", textTransform: "uppercase", color: T.text, textDecoration: "none" }}>
          Marketing<span style={{ color: T.gold }}>Copilot</span>
        </a>
        <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
          <Link href="/onboarding" style={{ fontFamily: "var(--font-outfit), sans-serif", fontSize: "0.7rem", fontWeight: 400, letterSpacing: "0.1em", textTransform: "uppercase", padding: "8px 16px", borderRadius: 2, border: `1px solid ${T.line2}`, background: "transparent", color: T.text3, textDecoration: "none" }}>
            Redigera
          </Link>
          <Link href="/dashboard" style={{ fontFamily: "var(--font-outfit), sans-serif", fontSize: "0.7rem", fontWeight: 400, letterSpacing: "0.1em", textTransform: "uppercase", padding: "8px 16px", borderRadius: 2, background: T.gold, color: T.bg, textDecoration: "none" }}>
            Det stämmer →
          </Link>
        </div>
      </nav>

      <div style={{ maxWidth: 900, margin: "0 auto", padding: "60px 48px 100px" }}>

        {/* Header */}
        <div style={{ marginBottom: 56 }}>
          <SLabel>Företagsprofil</SLabel>
          <h1 style={{ fontFamily: "var(--font-cormorant), serif", fontWeight: 300, fontSize: "clamp(2.4rem,5vw,4rem)", lineHeight: .95, letterSpacing: "-0.02em", color: T.text, margin: "16px 0 16px" }}>
            Vad AI vet om{" "}
            <em style={{ fontStyle: "italic", color: T.gold }}>{company.companyName || "företaget"}</em>.
          </h1>
          <p style={{ fontSize: "0.92rem", fontWeight: 300, color: T.text2, lineHeight: 1.8, maxWidth: 480 }}>
            Detta blir grunden för hur Marketing Copilot skriver, prioriterar och rekommenderar innehåll.
          </p>
        </div>

        {/* Profile fields */}
        <div style={{ borderTop: `1px solid ${T.line}`, marginBottom: 72 }}>
          {fields.map(([label, value]) => (
            <div key={label} style={{ display: "grid", gridTemplateColumns: "160px 1fr", gap: 24, padding: "20px 0", borderBottom: `1px solid ${T.line}` }}>
              <span style={{ fontSize: "0.65rem", fontWeight: 400, letterSpacing: "0.14em", textTransform: "uppercase", color: T.text3, paddingTop: 2 }}>{label}</span>
              <span style={{ fontSize: "0.88rem", fontWeight: 300, color: value ? T.text2 : T.text3, lineHeight: 1.75, whiteSpace: "pre-line" }}>
                {value || "Ej angivet"}
              </span>
            </div>
          ))}
        </div>

        {/* File upload — Company Brain */}
        <div>
          <div style={{ marginBottom: 24 }}>
            <SLabel>Material · Company Brain</SLabel>
            <h2 style={{ fontFamily: "var(--font-cormorant), serif", fontWeight: 300, fontSize: "clamp(1.8rem,3.5vw,2.5rem)", letterSpacing: "-0.01em", color: T.text, margin: "12px 0 10px" }}>
              Ladda upp <em style={{ fontStyle: "italic", color: T.gold }}>material</em>.
            </h2>
            <p style={{ fontSize: "0.85rem", fontWeight: 300, color: T.text2, lineHeight: 1.75, maxWidth: 480 }}>
              Bilder, produktblad, broschyrer, kundcase och tidigare nyhetsbrev — ju mer AI:n vet, desto bättre blir innehållet.
            </p>
          </div>

          {/* Drop zone */}
          <div
            onDragOver={e => { e.preventDefault(); setDragging(true); }}
            onDragLeave={() => setDragging(false)}
            onDrop={e => { e.preventDefault(); setDragging(false); handleFiles(e.dataTransfer.files); }}
            onClick={() => fileInputRef.current?.click()}
            style={{
              border: `1px dashed ${dragging ? T.gold : T.line2}`,
              borderRadius: 2, padding: "48px 24px",
              textAlign: "center", cursor: "pointer",
              background: dragging ? T.goldDim : T.surface,
              transition: "all .2s", marginBottom: 16,
            }}
          >
            <div style={{ fontSize: "1.8rem", opacity: .4, marginBottom: 12 }}>📁</div>
            <p style={{ fontSize: "0.82rem", fontWeight: 300, color: T.text2, lineHeight: 1.7, marginBottom: 16 }}>
              Dra och släpp filer hit<br />
              <span style={{ color: T.text3 }}>PDF, bilder, Word-dokument, CSV, textfiler</span>
            </p>
            <div style={{ display: "inline-block", fontFamily: "var(--font-outfit), sans-serif", fontSize: "0.7rem", fontWeight: 400, letterSpacing: "0.1em", textTransform: "uppercase", padding: "8px 18px", borderRadius: 2, border: `1px solid ${T.line2}`, color: T.text3 }}>
              Välj filer
            </div>
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept=".pdf,.doc,.docx,.txt,.md,.csv,.png,.jpg,.jpeg,.webp"
              style={{ display: "none" }}
              onChange={e => handleFiles(e.target.files)}
            />
          </div>

          {/* Uploading indicator */}
          {uploading && (
            <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 16px", background: T.surface, border: `1px solid ${T.line}`, borderRadius: 2, marginBottom: 8 }}>
              <div style={{ width: 14, height: 14, borderRadius: "50%", border: `1.5px solid rgba(201,169,110,.3)`, borderTopColor: T.gold, animation: "spin .7s linear infinite", flexShrink: 0 }} />
              <span style={{ fontSize: "0.8rem", fontWeight: 300, color: T.text2 }}>Bearbetar {uploading}…</span>
            </div>
          )}

          {/* Uploaded files list */}
          {files.length > 0 && (
            <div style={{ borderTop: `1px solid ${T.line}`, marginTop: 8 }}>
              {files.map((f, i) => (
                <div key={i} style={{ display: "flex", alignItems: "center", gap: 14, padding: "14px 0", borderBottom: `1px solid ${T.line}` }}>
                  <div style={{ width: 36, height: 36, borderRadius: 2, background: T.goldDim, border: `1px solid ${T.goldBorder}`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: "1rem", flexShrink: 0 }}>
                    {fileIcon(f.type, f.name)}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: "0.85rem", fontWeight: 400, color: T.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", marginBottom: 2 }}>{f.name}</div>
                    <div style={{ fontSize: "0.7rem", fontWeight: 300, color: T.text3 }}>{formatSize(f.size)} · Tillagd {f.addedAt}</div>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ fontSize: "0.62rem", fontWeight: 400, letterSpacing: "0.08em", textTransform: "uppercase", color: T.gold, background: T.goldDim, border: `1px solid ${T.goldBorder}`, padding: "3px 8px", borderRadius: 1 }}>
                      I Brain
                    </span>
                    <button onClick={() => removeFile(f.name)} style={{ background: "none", border: "none", cursor: "pointer", fontSize: "0.75rem", color: T.text3, padding: "4px", transition: "color .2s" }}
                      onMouseOver={e => (e.currentTarget as HTMLElement).style.color = "#e06060"}
                      onMouseOut={e => (e.currentTarget as HTMLElement).style.color = T.text3}
                    >
                      ✕
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {files.length === 0 && !uploading && (
            <p style={{ fontSize: "0.75rem", fontWeight: 300, color: T.text3, marginTop: 8 }}>
              Inga filer uppladdade än — AI:n använder bara informationen från onboarding.
            </p>
          )}
        </div>
      </div>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @media (max-width: 640px) {
          nav { padding: 0 20px !important; }
          div[style*="padding: 60px 48px"] { padding: 40px 20px 80px !important; }
          div[style*="grid-template-columns: 160px"] { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </main>
  );
}
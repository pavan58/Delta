"use client";
import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import { Textarea } from "./ui/form";

const Monaco = dynamic(() => import("@monaco-editor/react").then((m) => m.default), { ssr: false, loading: () => <p className="p-2 text-xs text-muted">Loading editor…</p> });

/** Monaco editor (loaded from CDN) with a plain textarea fallback if it cannot load. */
export function CodeEditor({ value, onChange, language, height = 260, label }: { value: string; onChange: (v: string) => void; language: string; height?: number; label: string }) {
  const [useMonaco, setUseMonaco] = useState(true);
  const [dark, setDark] = useState(false);
  useEffect(() => {
    setDark(document.documentElement.classList.contains("dark"));
    const t = setTimeout(() => {
      if (!document.querySelector(".monaco-editor")) setUseMonaco(false);
    }, 6000);
    return () => clearTimeout(t);
  }, []);
  if (!useMonaco) return <Textarea aria-label={label} spellCheck={false} className="font-mono text-xs" style={{ height }} value={value} onChange={(e) => onChange(e.target.value)} />;
  return (
    <div className="overflow-hidden rounded-sm border border-line" aria-label={label}>
      <Monaco height={height} language={language} theme={dark ? "vs-dark" : "light"} value={value} onChange={(v) => onChange(v ?? "")} options={{ minimap: { enabled: false }, fontSize: 13, scrollBeyondLastLine: false, wordWrap: "on", tabSize: 2 }} />
    </div>
  );
}

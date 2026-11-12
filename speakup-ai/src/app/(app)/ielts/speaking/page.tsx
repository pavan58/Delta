"use client";
import { useState } from "react";
import { PageHeader } from "@/components/layout/AppShell";
import { CUE_CARDS, PART1 } from "@/content/ielts/speaking";
import { SpeakingTest, buildFullTest, type Step } from "@/components/ielts/SpeakingTest";
import { saveIeltsAttempt } from "@/lib/store/ielts";
import { useAppState } from "@/lib/store/store";
import { useCustomContent } from "@/lib/content/custom";

export default function SpeakingPage() {
  const variant = useAppState((s) => s.profile?.ieltsModule ?? "academic");
  const custom = useCustomContent().ieltsSpeaking;
  const [steps, setSteps] = useState<Step[] | null>(null);
  const [label, setLabel] = useState("");
  const [start, setStart] = useState(0);
  const begin = (s: Step[], l: string) => { setSteps(s); setLabel(l); setStart(Date.now()); };

  if (steps)
    return (
      <div>
        <PageHeader back={{ href: "/ielts/speaking", label: "Speaking menu" }} title="IELTS Speaking" subtitle={label}>
          <button onClick={() => setSteps(null)} className="btn btn-secondary text-sm">Exit</button>
        </PageHeader>
        <SpeakingTest steps={steps} onFinish={(o) => saveIeltsAttempt({ module: "speaking", variant, testId: label, band: o.band.band, details: { ...o.band } }, (Date.now() - start) / 60000)} />
      </div>
    );

  return (
    <div>
      <PageHeader back={{ href: "/ielts", label: "IELTS" }} title="IELTS Speaking" subtitle="Same for Academic and General Training. Answer by voice for fluency and pronunciation indicators." />
      <button onClick={() => begin(buildFullTest(), "Full speaking test (Parts 1–3)")} className="card mb-4 w-full p-5 text-left hover:border-brand-400">
        <p className="font-semibold">🎯 Full speaking test (11–14 min)</p>
        <p className="mt-1 text-sm text-muted">Part 1 (4 questions) → Part 2 cue card with 1-minute preparation → Part 3 discussion (3 questions).</p>
      </button>
      <h2 className="mb-2 font-semibold">Part 1 — Introduction & interview</h2>
      <div className="mb-5 flex flex-wrap gap-2">
        {Object.keys(PART1).map((t) => <button key={t} onClick={() => begin(PART1[t].map((q) => ({ part: 1, question: q, keywords: [] })), `Part 1: ${t}`)} className="chip px-3 py-1.5 hover:border-brand-400">{t}</button>)}
        {custom.filter((c) => c.part === 1).map((c, i) => <button key={i} onClick={() => begin([{ part: 1, question: c.prompt, keywords: [] }], `Part 1: ${c.topic}`)} className="chip px-3 py-1.5">{c.topic}</button>)}
      </div>
      <h2 className="mb-2 font-semibold">Part 2 — Cue cards (with Part 3 discussion)</h2>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {CUE_CARDS.map((c) => (
          <button key={c.id} onClick={() => begin([{ part: 2, question: c.prompt, card: c, keywords: c.keywords }, ...c.part3.map((q) => ({ part: 3 as const, question: q, keywords: c.keywords }))], `Part 2 & 3: ${c.topic}`)} className="card p-4 text-left hover:border-brand-400">
            <span className="chip">{c.topic}</span>
            <p className="mt-2 text-sm">{c.prompt}</p>
          </button>
        ))}
        {custom.filter((c) => c.part === 2).map((c, i) => (
          <button key={`c${i}`} onClick={() => begin([{ part: 2, question: c.prompt, card: { id: `custom${i}`, topic: c.topic, prompt: c.prompt, bullets: c.bullets, part3: [], keywords: [] }, keywords: [] }], `Part 2: ${c.topic}`)} className="card p-4 text-left hover:border-brand-400">
            <span className="chip">{c.topic}</span><p className="mt-2 text-sm">{c.prompt}</p>
          </button>
        ))}
      </div>
    </div>
  );
}

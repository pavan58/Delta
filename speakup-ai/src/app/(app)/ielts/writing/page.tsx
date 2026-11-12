"use client";
import { useState } from "react";
import { PageHeader } from "@/components/layout/AppShell";
import { promptsFor, type WritingPrompt } from "@/content/ielts/writing";
import { WritingTask } from "@/components/ielts/WritingTask";
import { saveIeltsAttempt } from "@/lib/store/ielts";
import { useAppState } from "@/lib/store/store";

export default function WritingPage() {
  const variant = useAppState((s) => s.profile?.ieltsModule ?? "academic");
  const [prompt, setPrompt] = useState<WritingPrompt | null>(null);
  const [timed, setTimed] = useState(false);
  const [start, setStart] = useState(0);
  const t1 = promptsFor(variant === "academic" ? "task1-academic" : "task1-general");
  const t2 = promptsFor("task2");
  if (prompt)
    return (
      <div>
        <PageHeader back={{ href: "/ielts/writing", label: "All writing tasks" }} title="IELTS Writing" subtitle={timed ? `Timed: ${prompt.task === "task2" ? 40 : 20} minutes (recommended)` : "Untimed practice"}>
          <button onClick={() => setPrompt(null)} className="btn btn-secondary text-sm">Choose another task</button>
        </PageHeader>
        <WritingTask key={prompt.id} prompt={prompt} minutes={timed ? (prompt.task === "task2" ? 40 : 20) : undefined}
          onDone={(e) => saveIeltsAttempt({ module: "writing", variant, testId: prompt.id, band: e.band, details: { criteria: e.criteria, words: e.wordCount, task: prompt.task } }, (Date.now() - start) / 60000)} />
      </div>
    );
  const List = ({ title, items }: { title: string; items: WritingPrompt[] }) => (
    <section className="mb-5">
      <h2 className="mb-2 font-semibold">{title}</h2>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {items.map((p) => (
          <button key={p.id} onClick={() => { setPrompt(p); setStart(Date.now()); }} className="card p-4 text-left hover:border-brand-400">
            <span className="chip">{p.label}</span>
            <p className="mt-2 line-clamp-3 text-sm text-muted">{p.prompt}</p>
          </button>
        ))}
      </div>
    </section>
  );
  return (
    <div>
      <PageHeader back={{ href: "/ielts", label: "IELTS" }} title={`IELTS Writing — ${variant === "academic" ? "Academic" : "General Training"}`} subtitle="Feedback on all four criteria, with corrections, vocabulary upgrades and model answers.">
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={timed} onChange={(e) => setTimed(e.target.checked)} /> Timed</label>
      </PageHeader>
      <List title={variant === "academic" ? "Task 1 — graphs, tables, processes, maps" : "Task 1 — letters"} items={t1} />
      <List title="Task 2 — essays" items={t2} />
    </div>
  );
}

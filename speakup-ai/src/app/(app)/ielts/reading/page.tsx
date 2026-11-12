"use client";
import { useState } from "react";
import { PageHeader } from "@/components/layout/AppShell";
import { ReadingTest, type ReadingResult } from "@/components/ielts/ReadingTest";
import { BandResult } from "@/components/ielts/BandResult";
import { saveIeltsAttempt } from "@/lib/store/ielts";
import { setState, useAppState } from "@/lib/store/store";
import { cn } from "@/lib/utils";

export default function ReadingPage() {
  const variant = useAppState((s) => s.profile?.ieltsModule ?? "academic");
  const [timed, setTimed] = useState<boolean | null>(null);
  const [result, setResult] = useState<ReadingResult | null>(null);
  const [start] = useState(() => Date.now());
  return (
    <div>
      <PageHeader back={{ href: "/ielts", label: "IELTS" }} title={`IELTS Reading — ${variant === "academic" ? "Academic" : "General Training"}`} subtitle="Original passages with explanations. Raw scores are scaled to /40 for the band estimate." />
      {timed === null ? (
        <div className="space-y-3">
          <div className="inline-flex rounded-xl surface-2 p-1">
            {(["academic", "general"] as const).map((v) => (
              <button key={v} onClick={() => setState((s) => (s.profile ? { ...s, profile: { ...s.profile, ieltsModule: v } } : s))} className={cn("rounded-lg px-4 py-2 text-sm font-semibold", variant === v ? "bg-[var(--surface)] shadow" : "text-muted")}>{v === "academic" ? "Academic" : "General Training"}</button>
            ))}
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <button onClick={() => setTimed(false)} className="card p-5 text-left hover:border-brand-400"><p className="font-semibold">Practice (untimed)</p><p className="mt-1 text-sm text-muted">Work at your own pace, then review answers with explanations.</p></button>
            <button onClick={() => setTimed(true)} className="card p-5 text-left hover:border-brand-400"><p className="font-semibold">Timed test (60 min)</p><p className="mt-1 text-sm text-muted">Auto-submits when time runs out, like the real test.</p></button>
          </div>
        </div>
      ) : (
        <>
          {result && <div className="mb-4"><BandResult title="Reading result" raw={result.raw} total={result.total} band={result.band} /></div>}
          <ReadingTest variant={variant} timed={timed} onFinish={(r) => { setResult(r); saveIeltsAttempt({ module: "reading", variant, testId: r.testId, raw: r.raw, total: r.total, band: r.band, details: { timed } }, (Date.now() - start) / 60000); window.scrollTo({ top: 0, behavior: "smooth" }); }} />
        </>
      )}
    </div>
  );
}

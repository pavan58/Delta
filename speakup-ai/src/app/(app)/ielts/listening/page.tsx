"use client";
import { useState } from "react";
import { PageHeader } from "@/components/layout/AppShell";
import { ListeningTest, type ListeningResult } from "@/components/ielts/ListeningTest";
import { BandResult } from "@/components/ielts/BandResult";
import { saveIeltsAttempt } from "@/lib/store/ielts";
import { useAppState } from "@/lib/store/store";
import { LISTENING_TEST_ID } from "@/content/ielts/listening";

export default function ListeningPage() {
  const variant = useAppState((s) => s.profile?.ieltsModule ?? "academic");
  const [mode, setMode] = useState<"practice" | "exam" | null>(null);
  const [result, setResult] = useState<ListeningResult | null>(null);
  const [start] = useState(() => Date.now());
  return (
    <div>
      <PageHeader back={{ href: "/ielts", label: "IELTS" }} title="IELTS Listening" subtitle="4 sections · 40 questions · same for Academic and General Training" />
      {!mode ? (
        <div className="grid gap-3 sm:grid-cols-2">
          <button onClick={() => setMode("practice")} className="card p-5 text-left hover:border-brand-400"><p className="font-semibold">Practice mode</p><p className="mt-1 text-sm text-muted">Replay audio, slow it down and view the transcript. No time limit.</p></button>
          <button onClick={() => setMode("exam")} className="card p-5 text-left hover:border-brand-400"><p className="font-semibold">Exam mode</p><p className="mt-1 text-sm text-muted">Each section plays once. 30 minutes + 2 minutes to check (computer-delivered format).</p></button>
        </div>
      ) : (
        <>
          {result && <div className="mb-4"><BandResult title="Listening result" raw={result.raw} total={result.total} band={result.band} /></div>}
          <ListeningTest mode={mode} onFinish={(r) => { setResult(r); saveIeltsAttempt({ module: "listening", variant, testId: LISTENING_TEST_ID, raw: r.raw, total: r.total, band: r.band, details: { mode } }, (Date.now() - start) / 60000); window.scrollTo({ top: 0, behavior: "smooth" }); }} />
        </>
      )}
    </div>
  );
}

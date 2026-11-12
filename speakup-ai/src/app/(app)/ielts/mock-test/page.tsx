"use client";
import { useMemo, useState } from "react";
import { Headphones, BookOpenText, PenLine, Mic, Trophy } from "lucide-react";
import { PageHeader } from "@/components/layout/AppShell";
import { ListeningTest } from "@/components/ielts/ListeningTest";
import { ReadingTest } from "@/components/ielts/ReadingTest";
import { WritingTask } from "@/components/ielts/WritingTask";
import { SpeakingTest, buildFullTest } from "@/components/ielts/SpeakingTest";
import { ShareButtons } from "@/components/sharing/ShareCard";
import { promptsFor } from "@/content/ielts/writing";
import { LISTENING_TEST_ID } from "@/content/ielts/listening";
import { criteriaAverage, overallBand } from "@/lib/scoring/ielts";
import { saveIeltsAttempt } from "@/lib/store/ielts";
import { recordActivity, setState, useAppState } from "@/lib/store/store";
import { XP } from "@/lib/gamification";
import { uid } from "@/lib/utils";

type Stage = "intro" | "listening" | "reading" | "writing1" | "writing2" | "speaking" | "report";
const ORDER: Stage[] = ["intro", "listening", "reading", "writing1", "writing2", "speaking", "report"];

export default function MockTest() {
  const variant = useAppState((s) => s.profile?.ieltsModule ?? "academic");
  const target = useAppState((s) => s.profile?.targetBand ?? 6.5);
  const [stage, setStage] = useState<Stage>("intro");
  const [bands, setBands] = useState<{ listening: number | null; reading: number | null; w1: number | null; w2: number | null; speaking: number | null }>({ listening: null, reading: null, w1: null, w2: null, speaking: null });
  const [stageDone, setStageDone] = useState(false);
  const [start] = useState(() => Date.now());
  const t1 = useMemo(() => { const l = promptsFor(variant === "academic" ? "task1-academic" : "task1-general"); return l[Math.floor(Math.random() * l.length)]; }, [variant]);
  const t2 = useMemo(() => { const l = promptsFor("task2"); return l[Math.floor(Math.random() * l.length)]; }, []);
  const steps = useMemo(() => buildFullTest(), []);

  const next = () => {
    setStageDone(false);
    const n = ORDER[ORDER.indexOf(stage) + 1];
    if (n === "report") finish();
    setStage(n);
    window.scrollTo({ top: 0 });
  };

  // Task 2 counts twice as much as Task 1 in IELTS Writing.
  const writing = bands.w1 !== null && bands.w2 !== null ? criteriaAverage([bands.w1, bands.w2, bands.w2]) : bands.w2 ?? bands.w1;
  const parts = [bands.listening, bands.reading, writing, bands.speaking];
  const complete = parts.every((b) => b !== null);
  const overall = complete ? overallBand(parts as number[]) : null;

  function finish() {
    if (writing !== null) saveIeltsAttempt({ module: "writing", variant, testId: `mock:${t1.id}+${t2.id}`, band: writing, mock: true, details: { task1: bands.w1, task2: bands.w2 } });
    setState((s) => ({ ...s, mocks: [{ id: uid(), date: new Date().toISOString(), variant, listening: bands.listening, reading: bands.reading, writing, speaking: bands.speaking, overall }, ...s.mocks].slice(0, 50) }));
    recordActivity(XP.mockTest, (Date.now() - start) / 60000);
  }

  const header = (title: string, sub: string) => <PageHeader back={{ href: "/ielts", label: "IELTS" }} title={title} subtitle={sub}>{stage !== "intro" && stage !== "report" && <button onClick={next} className="btn btn-secondary text-sm">{stageDone ? "Continue →" : "Skip section"}</button>}</PageHeader>;

  if (stage === "intro")
    return (
      <div>
        {header("IELTS Mock Test", `${variant === "academic" ? "Academic" : "General Training"} · about 2 hours 45 minutes`)}
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {[[Headphones, "Listening", "~30 min · 40 questions · each section plays once"], [BookOpenText, "Reading", "60 min · timed"], [PenLine, "Writing", "60 min · Task 1 (20) + Task 2 (40)"], [Mic, "Speaking", "11–14 min · Parts 1–3"]].map(([Icon, t, d]) => {
            const I = Icon as typeof Headphones;
            return <div key={t as string} className="card p-4"><I className="text-brand-500" /><p className="mt-2 font-semibold">{t as string}</p><p className="text-sm text-muted">{d as string}</p></div>;
          })}
        </div>
        <ul className="mt-4 list-disc space-y-1 pl-5 text-sm text-muted">
          <li>Find a quiet place with headphones and a microphone. Use Chrome or Edge for the best voice support.</li>
          <li>You can skip a section, but the overall band is only calculated when all four skills are completed.</li>
          <li>All bands are automated estimates for practice. The material is original and the audio is synthetic.</li>
        </ul>
        <button onClick={next} className="btn btn-primary mt-5 px-6 py-3">Start mock test</button>
      </div>
    );

  if (stage === "listening")
    return (
      <div>
        {header("Mock test · Listening", "Section by section. Submit at the end.")}
        <ListeningTest mode="exam" onFinish={(r) => { setBands((b) => ({ ...b, listening: r.band })); saveIeltsAttempt({ module: "listening", variant, testId: LISTENING_TEST_ID, raw: r.raw, total: r.total, band: r.band, mock: true }); setStageDone(true); }} />
        {stageDone && <button onClick={next} className="btn btn-primary mt-4 w-full py-3">Continue to Reading →</button>}
      </div>
    );

  if (stage === "reading")
    return (
      <div>
        {header("Mock test · Reading", "60 minutes")}
        <ReadingTest variant={variant} timed onFinish={(r) => { setBands((b) => ({ ...b, reading: r.band })); saveIeltsAttempt({ module: "reading", variant, testId: r.testId, raw: r.raw, total: r.total, band: r.band, mock: true }); setStageDone(true); }} />
        {stageDone && <button onClick={next} className="btn btn-primary mt-4 w-full py-3">Continue to Writing →</button>}
      </div>
    );

  if (stage === "writing1" || stage === "writing2") {
    const p = stage === "writing1" ? t1 : t2;
    return (
      <div>
        {header(`Mock test · Writing ${stage === "writing1" ? "Task 1" : "Task 2"}`, stage === "writing1" ? "20 minutes recommended" : "40 minutes recommended")}
        <WritingTask key={p.id} prompt={p} minutes={stage === "writing1" ? 20 : 40} compact onDone={(e) => { setBands((b) => ({ ...b, [stage === "writing1" ? "w1" : "w2"]: e.band })); setStageDone(true); }} />
        {stageDone && <button onClick={next} className="btn btn-primary mt-4 w-full py-3">Continue →</button>}
      </div>
    );
  }

  if (stage === "speaking")
    return (
      <div>
        {header("Mock test · Speaking", "Parts 1–3")}
        <SpeakingTest steps={steps} showFeedback={false} onFinish={(o) => { setBands((b) => ({ ...b, speaking: o.band.band })); saveIeltsAttempt({ module: "speaking", variant, testId: "mock-speaking", band: o.band.band, mock: true }); setStageDone(true); }} />
        {stageDone && <button onClick={next} className="btn btn-primary mt-4 w-full py-3">See final report →</button>}
      </div>
    );

  return (
    <div>
      {header("Mock test report", `${variant === "academic" ? "Academic" : "General Training"}`)}
      <div className="card p-6 text-center">
        <Trophy className="mx-auto text-accent-500" size={36} />
        <p className="mt-2 text-sm text-muted">Estimated overall band</p>
        <p className="text-6xl font-extrabold">{overall !== null ? overall.toFixed(1) : "—"}</p>
        <p className="mt-1 text-sm text-muted">{overall !== null ? (overall >= target ? `At or above your target of ${target.toFixed(1)} 🎉` : `${(target - overall).toFixed(1)} below your target of ${target.toFixed(1)}`) : "Complete all four sections to get an overall band."}</p>
        <div className="mx-auto mt-5 grid max-w-xl grid-cols-2 gap-3 sm:grid-cols-4">
          {([["Listening", bands.listening], ["Reading", bands.reading], ["Writing", writing], ["Speaking", bands.speaking]] as const).map(([k, v]) => (
            <div key={k} className="rounded-xl surface-2 p-3"><p className="text-xs text-muted">{k}</p><p className="text-2xl font-bold">{v !== null ? v.toFixed(1) : "skipped"}</p></div>
          ))}
        </div>
        <p className="mx-auto mt-4 max-w-xl text-xs text-muted">Overall band = average of the four skills, rounded to the nearest half band (.25 rounds up to .5, .75 rounds up to the next band). Writing combines Task 1 and Task 2 with Task 2 weighted double. This is a practice estimate, not an official IELTS result.</p>
        {overall !== null && <div className="mt-4"><ShareButtons kind="ielts" data={{ band: overall, target, bands: { listening: bands.listening, reading: bands.reading, writing, speaking: bands.speaking } }} /></div>}
      </div>
    </div>
  );
}

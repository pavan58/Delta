"use client";
import { useState } from "react";
import { Clock, Flame, Trophy, TrendingUp } from "lucide-react";
import { PageHeader } from "@/components/layout/AppShell";
import { useAppState } from "@/lib/store/store";
import { progressSummary } from "@/lib/scoring/progress";
import { ACHIEVEMENTS, level } from "@/lib/gamification";
import { Stat } from "@/components/ui/Score";
import { TrendChart, WeeklyActivityChart } from "@/components/charts/Charts";
import { ShareButtons } from "@/components/sharing/ShareCard";
import { BeforeAfter } from "@/components/dashboard/BeforeAfter";
import { CATEGORY_LABELS, type GrammarCategory } from "@/lib/grammar/engine";
import { avg, cn } from "@/lib/utils";

type View = "english" | "ielts" | "interview";

export default function ProgressPage() {
  const s = useAppState();
  const p = progressSummary(s);
  const [view, setView] = useState<View>("english");
  const lvl = level(s.xp);
  return (
    <div>
      <PageHeader title="Your Progress" subtitle="Calculated only from your real practice. Scores are automated estimates." />
      <div className="mb-4 inline-flex rounded-xl surface-2 p-1" role="tablist">
        {([["english", "English Learning"], ["ielts", "IELTS Preparation"], ["interview", "Interview Preparation"]] as const).map(([v, l]) => (
          <button key={v} role="tab" aria-selected={view === v} onClick={() => setView(v)} className={cn("rounded-lg px-3 py-2 text-sm font-semibold sm:px-4", view === v ? "bg-[var(--surface)] shadow" : "text-muted")}>{l}</button>
        ))}
      </div>
      {view === "english" && <English p={p} lvl={lvl} />}
      {view === "ielts" && <Ielts />}
      {view === "interview" && <Interview />}

      <section className="mt-6">
        <h2 className="mb-3 font-semibold">Achievements · {Object.keys(s.achievements).length}/{ACHIEVEMENTS.length}</h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {ACHIEVEMENTS.map((a) => {
            const got = s.achievements[a.id];
            return (
              <div key={a.id} className={cn("card p-3 text-center", !got && "opacity-50 grayscale")}>
                <div className="text-3xl" aria-hidden>{a.emoji}</div>
                <p className="mt-1 text-sm font-semibold">{a.title}</p>
                <p className="text-xs text-muted">{a.description}</p>
                {got && <p className="mt-1 text-[10px] text-mint-500">Unlocked {new Date(got).toLocaleDateString()}</p>}
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}

function English({ p, lvl }: { p: ReturnType<typeof progressSummary>; lvl: ReturnType<typeof level> }) {
  const s = useAppState();
  const series = [...s.sessions].reverse().slice(-30).map((x, i) => ({ label: String(i + 1), Overall: x.scores.overall, Grammar: x.scores.grammar, Fluency: x.scores.fluency, Vocabulary: x.scores.vocabulary }));
  const cats: Partial<Record<GrammarCategory, number>> = {};
  for (const m of s.mistakes) cats[m.category] = (cats[m.category] ?? 0) + 1;
  const revised = s.mistakes.filter((m) => m.revised).length;
  const weekLines = [
    `Practice: ${p.weeklyActivity.reduce((t, d) => t + d.minutes, 0).toFixed(0)} minutes`,
    `Days active: ${p.weeklyActivity.filter((d) => d.xp > 0).length}/7`,
    `Weekly average score: ${p.weeklyAverage ?? "—"}`,
    `XP this week: ${p.weeklyXp}`,
  ];
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Overall (est.)" value={p.overallProgress ?? "—"} sub="Avg of last 20 sessions" icon={<TrendingUp size={18} />} />
        <Stat label="Today" value={p.todayScore ?? "—"} sub={p.previousScore !== null ? `Previous: ${p.previousScore}` : "Daily speaking score"} />
        <Stat label="Monthly change" value={p.monthlyImprovement === null ? "—" : `${p.monthlyImprovement > 0 ? "+" : ""}${p.monthlyImprovement}`} sub="Recent vs earlier sessions" />
        <Stat label="Grammar change" value={p.grammarImprovement === null ? "—" : `${p.grammarImprovement > 0 ? "+" : ""}${p.grammarImprovement}`} sub="Last 3 vs first 3 sessions" />
        <Stat label="Streak" value={`${p.streak} days`} sub={`Longest: ${p.longest}`} icon={<Flame size={18} className="text-accent-500" />} />
        <Stat label="Speaking minutes" value={p.totalMinutes} sub="Measured voice time + practice" icon={<Clock size={18} />} />
        <Stat label="Level" value={lvl.level} sub={`${lvl.into}/${lvl.need} XP to next`} icon={<Trophy size={18} />} />
        <Stat label="Vocabulary" value={p.vocabLearned} sub="Words learned (SRS box 3+)" />
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="card p-4"><p className="mb-1 font-semibold">Weekly activity (minutes)</p><WeeklyActivityChart data={p.weeklyActivity} /></div>
        <div className="card p-4">
          <p className="mb-1 font-semibold">Score trend (last 30 sessions)</p>
          {series.length >= 2 ? <TrendChart data={series} lines={[{ key: "Overall", color: "#3b63f6", name: "Overall" }, { key: "Grammar", color: "#14b88a", name: "Grammar" }, { key: "Fluency", color: "#ff9a1f", name: "Fluency" }]} /> : <p className="py-16 text-center text-sm text-muted">Complete at least two sessions to see your trend.</p>}
        </div>
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="card p-4">
          <p className="font-semibold">Mistake patterns</p>
          {Object.keys(cats).length ? (
            <ul className="mt-2 space-y-2 text-sm">
              {Object.entries(cats).sort((a, b) => (b[1] ?? 0) - (a[1] ?? 0)).map(([c, n]) => (
                <li key={c}><div className="flex justify-between"><span>{CATEGORY_LABELS[c as GrammarCategory]}</span><span>{n}</span></div><div className="h-1.5 rounded-full bg-[var(--border)]"><div className="h-1.5 rounded-full bg-accent-500" style={{ width: `${(n! / s.mistakes.length) * 100}%` }} /></div></li>
              ))}
            </ul>
          ) : <p className="mt-2 text-sm text-muted">No mistakes tracked yet.</p>}
          <p className="mt-3 text-xs text-muted">{revised} of {s.mistakes.length} mistakes revised.</p>
        </div>
        <div className="card flex flex-col items-center justify-center gap-3 p-4 text-center">
          <p className="font-semibold">Share your weekly progress</p>
          <ul className="text-sm text-muted">{weekLines.map((l) => <li key={l}>{l}</li>)}</ul>
          <ShareButtons kind="weekly" data={{ lines: weekLines }} />
        </div>
      </div>
      <BeforeAfter />
      <div className="card p-4">
        <p className="font-semibold">Completed lessons</p>
        <p className="mt-1 text-sm text-muted">{p.completedDays.length ? `30-day challenge days: ${p.completedDays.join(", ")}` : "No challenge days completed yet."}{p.nextDay ? ` · Next: Day ${p.nextDay}` : ""}</p>
      </div>
    </div>
  );
}

function Ielts() {
  const attempts = useAppState((s) => s.ielts);
  const mocks = useAppState((s) => s.mocks);
  const target = useAppState((s) => s.profile?.targetBand ?? 6.5);
  if (!attempts.length) return <div className="card p-8 text-center text-muted">No IELTS practice yet. Try any skill in the IELTS section.</div>;
  const mods = ["listening", "reading", "writing", "speaking"] as const;
  const series = [...attempts].reverse().slice(-20).map((a, i) => ({ label: String(i + 1), [a.module]: a.band }));
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {mods.map((m) => {
          const list = attempts.filter((a) => a.module === m);
          return <Stat key={m} label={m} value={list[0] ? list[0].band.toFixed(1) : "—"} sub={list.length ? `Best ${Math.max(...list.map((a) => a.band)).toFixed(1)} · ${list.length} attempts · target ${target.toFixed(1)}` : "Not attempted"} />;
        })}
      </div>
      <div className="card p-4"><p className="mb-1 font-semibold">Band history</p><TrendChart data={series} lines={[{ key: "listening", color: "#3b63f6", name: "Listening" }, { key: "reading", color: "#14b88a", name: "Reading" }, { key: "writing", color: "#ff9a1f", name: "Writing" }, { key: "speaking", color: "#ef4444", name: "Speaking" }]} /></div>
      <div className="card p-4">
        <p className="font-semibold">Mock tests</p>
        {mocks.length ? <ul className="mt-2 divide-y divide-[var(--border)] text-sm">{mocks.map((m) => <li key={m.id} className="flex justify-between py-2"><span>{new Date(m.date).toLocaleDateString()} · {m.variant}</span><span>L {m.listening ?? "–"} · R {m.reading ?? "–"} · W {m.writing ?? "–"} · S {m.speaking ?? "–"} · <b>Overall {m.overall?.toFixed(1) ?? "–"}</b></span></li>)}</ul> : <p className="mt-1 text-sm text-muted">No mock tests yet.</p>}
      </div>
      <p className="text-xs text-muted">Bands are practice estimates, not official IELTS results.</p>
    </div>
  );
}

function Interview() {
  const list = useAppState((s) => s.interviews);
  if (!list.length) return <div className="card p-8 text-center text-muted">No mock interviews yet. Start one in the Interview Simulator.</div>;
  const series = [...list].reverse().map((x, i) => ({ label: String(i + 1), Total: x.total }));
  const parts = ["communication", "grammar", "vocabulary", "relevance", "fluency"] as const;
  const max = { communication: 20, grammar: 20, vocabulary: 15, relevance: 20, fluency: 15 };
  const answers = list.slice(0, 5).flatMap((x) => x.answers);
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Readiness" value={`${Math.round(avg(list.slice(0, 3).map((x) => x.total)))}/100`} sub="Avg of last 3 interviews" />
        <Stat label="Best score" value={Math.max(...list.map((x) => x.total))} />
        <Stat label="Interviews" value={list.length} />
        <Stat label="Categories" value={new Set(list.map((x) => x.category)).size} />
      </div>
      <div className="card p-4"><p className="mb-1 font-semibold">Interview scores</p><TrendChart data={series} lines={[{ key: "Total", color: "#3b63f6", name: "Total" }]} /></div>
      <div className="card p-4">
        <p className="font-semibold">Average by area (last 5 interviews)</p>
        <ul className="mt-2 space-y-2 text-sm">{parts.map((k) => { const v = Math.round(avg(answers.map((a) => a.scores[k]))); return <li key={k}><div className="flex justify-between capitalize"><span>{k}</span><span>{v}/{max[k]}</span></div><div className="h-1.5 rounded-full bg-[var(--border)]"><div className="h-1.5 rounded-full bg-brand-500" style={{ width: `${(v / max[k]) * 100}%` }} /></div></li>; })}</ul>
      </div>
    </div>
  );
}

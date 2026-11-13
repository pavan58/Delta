"use client";
import Link from "next/link";
import { ArrowRight, Library, BookOpen, Briefcase, CalendarCheck, Clock, Flame, GraduationCap, Mic, Target, TrendingUp, Trophy, Wand2 } from "lucide-react";
import { useAppState } from "@/lib/store/store";
import { latestScores, progressSummary } from "@/lib/scoring/progress";
import { getLesson } from "@/content/lessons/challenge";
import { level } from "@/lib/gamification";
import { Stat, ScoreRing } from "@/components/ui/Score";
import { WeeklyActivityChart } from "@/components/charts/Charts";
import { dueCount } from "@/lib/vocab/srs";
import { localDate } from "@/lib/utils";
import { FOUNDATION_LESSONS } from "@/content/foundation";

export default function Dashboard() {
  const s = useAppState();
  const p = progressSummary(s);
  const latest = latestScores(s);
  const lvl = level(s.xp);
  const next = p.nextDay ? getLesson(p.nextDay) : null;
  const today = localDate();
  const minutesToday = s.activity[today]?.minutes ?? 0;
  const goal = s.profile?.dailyMinutes ?? 15;
  const due = dueCount(s);
  const doneToday = (s.activity[today]?.sessions ?? 0) > 0;
  const fDone = Object.keys(s.foundation ?? {}).length;
  const fNext = FOUNDATION_LESSONS.find((l) => !s.foundation?.[l.id]);
  const isBeginner = s.profile?.level === "beginner" || s.profile?.level === "elementary";
  const foundationCard = fNext && (
    <Link href={`/foundation/${fNext.id}`} className="card group flex min-w-0 items-center gap-4 p-4 hover:border-brand-400">
      <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-mint-500/15 text-mint-500"><Library /></div>
      <div className="min-w-0 flex-1">
        <p className="text-xs font-semibold uppercase tracking-wide text-mint-500">Foundation course · {fDone}/{FOUNDATION_LESSONS.length}</p>
        <p className="truncate font-semibold">{fDone ? "Continue: " : "Start: "}{fNext.title}</p>
        <p className="truncate text-sm text-muted">Grammar, verbs, adjectives & all 12 tenses</p>
      </div>
      <ArrowRight className="text-muted transition group-hover:translate-x-1" />
    </Link>
  );

  return (
    <div className="space-y-5">
      <section className="overflow-hidden rounded-3xl bg-gradient-to-br from-brand-600 to-brand-800 p-5 text-white sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-sm text-brand-100">Level {lvl.level} · {s.profile?.level.replace("-", " ")}</p>
            <h1 className="mt-1 text-2xl font-extrabold sm:text-3xl">{doneToday ? "Great work today! 🎉" : `Ready to speak, ${s.profile?.name.split(" ")[0]}?`}</h1>
            <p className="mt-1 text-brand-100">
              {p.streak ? <>🔥 {p.streak}-day streak — keep it going!</> : "Practise today to start your streak."}
            </p>
            <div className="mt-3 h-2 w-56 rounded-full bg-white/20" aria-label={`Daily goal ${Math.round(minutesToday)} of ${goal} minutes`}>
              <div className="h-2 rounded-full bg-accent-400" style={{ width: `${Math.min(100, (minutesToday / goal) * 100)}%` }} />
            </div>
            <p className="mt-1 text-xs text-brand-100">{minutesToday.toFixed(1)} / {goal} min daily goal</p>
          </div>
          <div className="rounded-2xl bg-white/10 p-3 text-center">
            <ScoreRing value={p.todayScore ?? 0} size={92} label="Today" />
            <p className="mt-1 text-xs text-brand-100">{p.todayScore === null ? "No score yet today" : "Daily speaking score (est.)"}</p>
          </div>
        </div>
      </section>

      <section className="grid gap-3 sm:grid-cols-2">
        {isBeginner && foundationCard}
        {next && (
          <Link href={`/challenge/${next.day}`} className="card group flex min-w-0 items-center gap-4 p-4 hover:border-brand-400">
            <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-accent-500/15 text-2xl">{next.badge}</div>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-semibold uppercase tracking-wide text-accent-500">Today&apos;s challenge · Day {next.day}</p>
              <p className="truncate font-semibold">{next.title}</p>
              <p className="truncate text-sm text-muted">{next.objective}</p>
            </div>
            <ArrowRight className="text-muted transition group-hover:translate-x-1" />
          </Link>
        )}
        <Link href="/speak" className="card group flex min-w-0 items-center gap-4 p-4 hover:border-brand-400">
          <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-brand-500/15 text-brand-500"><Mic /></div>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold uppercase tracking-wide text-brand-500">Free conversation</p>
            <p className="font-semibold">Talk with your English teacher</p>
            <p className="truncate text-sm text-muted">Voice or text · instant corrections</p>
          </div>
          <ArrowRight className="text-muted transition group-hover:translate-x-1" />
        </Link>
        {!isBeginner && foundationCard}
      </section>

      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Current streak" value={`${p.streak} days`} sub={`Best: ${p.longest} days`} icon={<Flame size={18} className="text-accent-500" />} />
        <Stat label="Speaking minutes" value={p.totalMinutes} sub="Total practice time" icon={<Clock size={18} />} />
        <Stat label="Weekly average" value={p.weeklyAverage ?? "—"} sub={p.previousScore !== null ? `Previous day: ${p.previousScore}` : "Score / 100 (est.)"} icon={<TrendingUp size={18} />} />
        <Link href="/vocabulary" className="block"><Stat label="Daily words" value={`${s.dailyWords?.date === today ? s.dailyWords.learned.length : 0}/${s.settings.dailyGoal}`} sub={`${p.vocabLearned} learned in total${due ? ` · ${due} to review` : ""}`} icon={<BookOpen size={18} />} /></Link>
      </section>

      <section className="grid gap-3 lg:grid-cols-3">
        <div className="card p-4 lg:col-span-2">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold">This week</h2>
            <Link href="/progress" className="text-sm font-semibold text-brand-500">Full progress →</Link>
          </div>
          <WeeklyActivityChart data={p.weeklyActivity} />
        </div>
        <div className="card space-y-3 p-4">
          <h2 className="font-semibold">Readiness</h2>
          <Row icon={<Library size={18} />} label="Foundation course" value={`${fDone}/${FOUNDATION_LESSONS.length} lessons`} />
          <Row icon={<CalendarCheck size={18} />} label="30-day challenge" value={`${p.completedDays.length}/30 days`} />
          <Row icon={<Briefcase size={18} />} label="Interview readiness" value={p.interviewReadiness !== null ? `${p.interviewReadiness}/100` : "Not started"} />
          <Row icon={<GraduationCap size={18} />} label="IELTS estimate" value={p.ieltsEstimate !== null ? `Band ${p.ieltsEstimate.toFixed(1)}${p.ieltsSkillsDone < 4 ? ` (${p.ieltsSkillsDone}/4 skills)` : ""}` : "Not started"} />
          {s.profile?.wantsIelts && <Row icon={<Target size={18} />} label="Target band" value={s.profile.targetBand.toFixed(1)} />}
          <Row icon={<Trophy size={18} />} label="Badges" value={`${Object.keys(s.achievements).length}`} />
          {latest && (
            <p className="rounded-xl surface-2 p-2 text-xs text-muted">
              {latest.isToday ? "Today" : "Recent"}: grammar {latest.grammar} · fluency {latest.fluency} · vocabulary {latest.vocabulary}
              {latest.pronunciation !== null ? ` · pronunciation (est.) ${latest.pronunciation}` : ""}
            </p>
          )}
        </div>
      </section>

      <section>
        <h2 className="mb-3 font-semibold">Practise</h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-7">
          {[
            { href: "/foundation", icon: Library, label: "Course", color: "text-mint-500" },
            { href: "/speak", icon: Mic, label: "Speak", color: "text-brand-500" },
            { href: "/grammar", icon: Wand2, label: "Grammar", color: "text-mint-500" },
            { href: "/challenge", icon: CalendarCheck, label: "30-Day", color: "text-accent-500" },
            { href: "/ielts", icon: GraduationCap, label: "IELTS", color: "text-brand-500" },
            { href: "/interview", icon: Briefcase, label: "Interview", color: "text-accent-500" },
            { href: "/vocabulary", icon: BookOpen, label: `Daily ${s.settings.dailyGoal} words`, color: "text-mint-500" },
          ].map((x) => (
            <Link key={x.href} href={x.href} className="card flex flex-col items-center gap-2 p-4 text-center text-sm font-semibold hover:border-brand-400">
              <x.icon className={x.color} /> {x.label}
            </Link>
          ))}
        </div>
      </section>

      {s.mistakes.filter((m) => !m.revised).length > 0 && (
        <Link href="/grammar?tab=mistakes" className="card flex items-center justify-between p-4 hover:border-brand-400">
          <div>
            <p className="font-semibold">Revise your mistakes</p>
            <p className="text-sm text-muted">{s.mistakes.filter((m) => !m.revised).length} sentences waiting in your personal mistake tracker.</p>
          </div>
          <ArrowRight className="text-muted" />
        </Link>
      )}
    </div>
  );
}

function Row({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-center justify-between text-sm">
      <span className="flex items-center gap-2 text-muted">{icon} {label}</span>
      <span className="font-semibold">{value}</span>
    </div>
  );
}

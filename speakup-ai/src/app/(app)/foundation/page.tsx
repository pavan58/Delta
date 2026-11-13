"use client";
import Link from "next/link";
import { ArrowRight, CheckCircle2, Circle } from "lucide-react";
import { PageHeader } from "@/components/layout/AppShell";
import { FOUNDATION_LESSONS, FOUNDATION_UNITS } from "@/content/foundation";
import { useAppState } from "@/lib/store/store";
import { cn } from "@/lib/utils";

export default function FoundationPage() {
  const progress = useAppState((s) => s.foundation ?? {});
  const done = Object.keys(progress).length;
  const next = FOUNDATION_LESSONS.find((l) => !progress[l.id]);
  const total = FOUNDATION_LESSONS.length;
  return (
    <div>
      <PageHeader title="Spoken English Foundation Course" subtitle="Start from the basics: sentence structure, verbs, adjectives, all 12 tenses and everyday sentence skills — with Hindi explanations.">
        <span className="chip">{done}/{total} lessons</span>
      </PageHeader>

      <div className="mb-5 h-3 rounded-full bg-[var(--border)]" aria-label={`${done} of ${total} lessons completed`}>
        <div className="h-3 rounded-full bg-gradient-to-r from-brand-500 to-mint-500 transition-all" style={{ width: `${(done / total) * 100}%` }} />
      </div>

      {next ? (
        <Link href={`/foundation/${next.id}`} className="card mb-6 flex items-center gap-4 p-4 hover:border-brand-400">
          <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-brand-500/15 text-2xl">{FOUNDATION_UNITS[next.unit - 1].emoji}</div>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold uppercase tracking-wide text-brand-500">{done ? "Continue" : "Start here"} · Unit {next.unit}</p>
            <p className="truncate font-semibold">{next.title}</p>
            <p className="truncate text-sm text-muted">{next.objective}</p>
          </div>
          <ArrowRight className="text-muted" />
        </Link>
      ) : (
        <div className="card mb-6 p-4 text-center font-semibold">🎓 You completed the Foundation Course! Keep practising in the 30-Day Challenge and Speaking Teacher.</div>
      )}

      <p className="mb-4 text-sm text-muted">Each lesson: <b>Learn</b> the rule (with Hindi) → <b>Practise</b> 6 interactive exercises → <b>Speak</b> using the rule and get a score. About 10–15 minutes per lesson. Follow the order, or jump to any topic you need.</p>

      {FOUNDATION_UNITS.map((u) => {
        const lessons = FOUNDATION_LESSONS.filter((l) => l.unit === u.id);
        const unitDone = lessons.filter((l) => progress[l.id]).length;
        return (
          <section key={u.id} className="mb-6">
            <div className="mb-2 flex items-end justify-between gap-2">
              <div>
                <h2 className="font-semibold">{u.emoji} Unit {u.id} · {u.title}</h2>
                <p className="text-sm text-muted">{u.description}</p>
              </div>
              <span className="shrink-0 text-xs text-muted">{unitDone}/{lessons.length}</span>
            </div>
            <ol className="grid gap-2 sm:grid-cols-2">
              {lessons.map((l) => {
                const p = progress[l.id];
                const n = FOUNDATION_LESSONS.indexOf(l) + 1;
                return (
                  <li key={l.id}>
                    <Link href={`/foundation/${l.id}`} className={cn("card flex min-w-0 items-center gap-3 p-3 hover:border-brand-400", next?.id === l.id && "ring-2 ring-accent-400")}>
                      {p ? <CheckCircle2 className="shrink-0 text-mint-500" size={20} /> : <Circle className="shrink-0 text-muted" size={20} />}
                      <span className="min-w-0 flex-1">
                        <span className="block text-xs text-muted">Lesson {n}</span>
                        <span className="block truncate font-medium">{l.title}</span>
                      </span>
                      {p && <span className="shrink-0 text-sm font-semibold text-mint-500">{p.best}%</span>}
                    </Link>
                  </li>
                );
              })}
            </ol>
          </section>
        );
      })}
    </div>
  );
}

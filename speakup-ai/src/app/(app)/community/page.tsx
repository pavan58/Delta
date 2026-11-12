"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { Copy, Crown, Flame, Gift, Swords, Target, Users } from "lucide-react";
import { PageHeader } from "@/components/layout/AppShell";
import { updateSettings, useAppState } from "@/lib/store/store";
import { useAuth } from "@/lib/supabase/auth";
import { authHeader } from "@/lib/supabase/client";
import { currentStreak, weeklyXp } from "@/lib/gamification";
import { CHALLENGE } from "@/content/lessons/challenge";
import { addDays, localDate, weekStart } from "@/lib/utils";
import { whatsappUrl, shareText } from "@/lib/share/card";
import { cn } from "@/lib/utils";

interface Entry { display_name: string; xp: number; streak: number }

export default function CommunityPage() {
  const s = useAppState();
  const auth = useAuth();
  const [entries, setEntries] = useState<Entry[] | null>(null);
  const [configured, setConfigured] = useState(true);
  const [refCount, setRefCount] = useState<number | null>(null);
  const [copied, setCopied] = useState("");
  const wk = weekStart();
  const myXp = weeklyXp(s.activity);

  useEffect(() => {
    fetch(`/api/leaderboard?week=${wk}`).then((r) => r.json()).then((j) => { setConfigured(j.configured); setEntries(j.entries ?? []); }).catch(() => setEntries([]));
  }, [wk, s.settings.leaderboardOptIn]);
  useEffect(() => {
    if (!auth.user) return;
    authHeader().then((h) => fetch("/api/referrals", { headers: h })).then((r) => r.json()).then((j) => setRefCount(j.count)).catch(() => {});
  }, [auth.user]);

  const origin = typeof window !== "undefined" ? location.origin : "";
  const inviteUrl = `${origin}/?ref=${s.referralCode}`;
  const best = s.sessions[0];
  const [day, setDay] = useState(1);
  const lesson = CHALLENGE.find((l) => l.day === day)!;
  const myBest = s.challenge[day]?.score ?? null;
  const friendUrl = `${origin}/challenge-friend?d=${day}&n=${encodeURIComponent((s.settings.displayName || s.profile?.name || "A friend").slice(0, 30))}${myBest !== null ? `&s=${myBest}` : ""}&ref=${s.referralCode}`;

  // 7-day speaking competition (personal): practise on 7 days this week.
  const week = Array.from({ length: 7 }, (_, i) => addDays(wk, i));
  const activeThisWeek = week.filter((d) => (s.activity[d]?.sessions ?? 0) > 0).length;
  // Monthly English challenge: 20 active days this calendar month.
  const month = localDate().slice(0, 7);
  const activeThisMonth = Object.keys(s.activity).filter((d) => d.startsWith(month) && s.activity[d].sessions > 0).length;
  // Daily challenges derived from today's real activity.
  const today = localDate();
  const todaySessions = s.sessions.filter((x) => localDate(new Date(x.date)) === today);
  const daily = [
    { label: "Complete one speaking session", done: todaySessions.length > 0 },
    { label: "Speak for 3+ minutes by voice", done: todaySessions.filter((x) => x.input === "voice").reduce((t, x) => t + x.durationSec, 0) >= 180 },
    { label: "Score 70+ in any answer", done: todaySessions.some((x) => x.scores.overall >= 70) },
    { label: "Revise a past mistake", done: s.mistakes.some((m) => m.revised && m.attempts > 0) && (s.activity[today]?.xp ?? 0) > 0 },
  ];

  const copy = (t: string, k: string) => navigator.clipboard?.writeText(t).then(() => { setCopied(k); setTimeout(() => setCopied(""), 1500); });

  return (
    <div>
      <PageHeader title="Community" subtitle="Compete, challenge friends and grow together. Sharing is always opt-in." />
      <div className="grid gap-4 lg:grid-cols-2">
        <section className="card p-4">
          <div className="flex items-center justify-between"><h2 className="flex items-center gap-2 font-semibold"><Crown size={18} className="text-accent-500" /> Weekly leaderboard</h2><span className="text-xs text-muted">Week of {wk}</span></div>
          {!auth.configured || !configured ? (
            <p className="mt-3 text-sm text-muted">The public leaderboard needs a free account (Supabase must be configured by the site owner). In guest mode only you can see your score: <b>{myXp} XP</b> this week.</p>
          ) : !auth.user ? (
            <p className="mt-3 text-sm text-muted"><Link href="/login" className="font-semibold text-brand-500">Sign in</Link> and opt in to appear on the leaderboard.</p>
          ) : (
            <label className="mt-3 flex items-center gap-2 text-sm"><input type="checkbox" checked={s.settings.leaderboardOptIn} onChange={(e) => updateSettings({ leaderboardOptIn: e.target.checked })} /> Show my display name, weekly XP and streak on the public leaderboard</label>
          )}
          {entries && entries.length > 0 ? (
            <ol className="mt-3 divide-y divide-[var(--border)]">
              {entries.map((e, i) => (
                <li key={i} className="flex items-center gap-3 py-2 text-sm">
                  <span className={cn("grid h-7 w-7 place-items-center rounded-full text-xs font-bold", i < 3 ? "bg-accent-500 text-white" : "surface-2")}>{i + 1}</span>
                  <span className="flex-1 truncate">{e.display_name}</span>
                  <span className="flex items-center gap-1 text-muted"><Flame size={14} /> {e.streak}</span>
                  <span className="w-16 text-right font-semibold">{e.xp} XP</span>
                </li>
              ))}
            </ol>
          ) : entries && configured && auth.configured ? <p className="mt-3 text-sm text-muted">No one has joined this week&apos;s leaderboard yet. Be the first!</p> : null}
          <p className="mt-2 text-xs text-muted">Only real XP from completed practice counts. Voice recordings and detailed scores are never shown publicly.</p>
        </section>

        <section className="card p-4">
          <h2 className="flex items-center gap-2 font-semibold"><Target size={18} className="text-brand-500" /> Today&apos;s daily challenges</h2>
          <ul className="mt-3 space-y-2">{daily.map((d) => <li key={d.label} className="flex items-center gap-2 text-sm"><span className={cn("grid h-5 w-5 place-items-center rounded-full text-xs", d.done ? "bg-mint-500 text-white" : "border border-base")}>{d.done ? "✓" : ""}</span>{d.label}</li>)}</ul>
          <div className="mt-4 grid grid-cols-2 gap-3">
            <div className="rounded-xl surface-2 p-3">
              <p className="text-xs font-semibold text-muted">7-day speaking competition</p>
              <p className="mt-1 text-2xl font-bold">{activeThisWeek}/7 days</p>
              <div className="mt-1 flex gap-1">{week.map((d) => <span key={d} className={cn("h-2 flex-1 rounded-full", (s.activity[d]?.sessions ?? 0) > 0 ? "bg-mint-500" : "bg-[var(--border)]")} />)}</div>
            </div>
            <div className="rounded-xl surface-2 p-3">
              <p className="text-xs font-semibold text-muted">Monthly English challenge</p>
              <p className="mt-1 text-2xl font-bold">{activeThisMonth}/20 days</p>
              <div className="mt-2 h-2 rounded-full bg-[var(--border)]"><div className="h-2 rounded-full bg-brand-500" style={{ width: `${Math.min(100, (activeThisMonth / 20) * 100)}%` }} /></div>
            </div>
          </div>
        </section>

        <section className="card p-4">
          <h2 className="flex items-center gap-2 font-semibold"><Swords size={18} className="text-red-500" /> Challenge a friend</h2>
          <p className="mt-1 text-sm text-muted">Pick a speaking task. Your friend answers the same task and compares scores — no account needed.</p>
          <select className="input mt-3" value={day} onChange={(e) => setDay(Number(e.target.value))} aria-label="Speaking task">
            {CHALLENGE.map((l) => <option key={l.day} value={l.day}>Day {l.day}: {l.title}{s.challenge[l.day] ? ` (your best: ${s.challenge[l.day].score})` : ""}</option>)}
          </select>
          <p className="mt-2 text-sm"><b>Task:</b> {lesson.task}</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <a href={whatsappUrl(`Can you beat my English speaking score${myBest !== null ? ` of ${myBest}/100` : ""}? Try the "${lesson.title}" challenge on SpeakUp AI: ${friendUrl}`)} target="_blank" rel="noopener noreferrer" className="btn bg-[#25D366] text-white">Send on WhatsApp</a>
            <button onClick={() => copy(friendUrl, "friend")} className="btn btn-secondary"><Copy size={16} /> {copied === "friend" ? "Copied!" : "Copy link"}</button>
          </div>
          {myBest === null && <p className="mt-2 text-xs text-muted">Tip: complete this day first so your friend has a score to beat.</p>}
        </section>

        <section className="card p-4">
          <h2 className="flex items-center gap-2 font-semibold"><Gift size={18} className="text-mint-500" /> Invite friends</h2>
          <p className="mt-1 text-sm text-muted">Share your personal invite link. Practising with friends makes streaks easier to keep.</p>
          <div className="mt-3 flex gap-2"><input className="input text-sm" readOnly value={inviteUrl} aria-label="Invite link" /><button onClick={() => copy(inviteUrl, "invite")} className="btn btn-secondary"><Copy size={16} /></button></div>
          <div className="mt-3 flex flex-wrap gap-2">
            <a href={whatsappUrl(shareText("referral", { referralUrl: inviteUrl }))} target="_blank" rel="noopener noreferrer" className="btn bg-[#25D366] text-white">Invite on WhatsApp</a>
          </div>
          <p className="mt-3 flex items-center gap-2 text-sm"><Users size={16} /> Your code: <b>{s.referralCode}</b>{refCount !== null && <> · {refCount} friend{refCount === 1 ? "" : "s"} joined</>}</p>
          {refCount === null && <p className="text-xs text-muted">Sign in to track how many friends joined with your code.</p>}
          {best && <p className="mt-2 text-xs text-muted">We never message your contacts automatically.</p>}
        </section>
      </div>
      <p className="mt-4 text-xs text-muted">Streak: {currentStreak(s.activity)} days · This week: {myXp} XP</p>
    </div>
  );
}

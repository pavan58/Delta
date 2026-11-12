"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { fetchAiStatus } from "@/lib/ai/client";
import {
  BookOpen, Briefcase, CalendarCheck, Flame, GraduationCap, LayoutDashboard, LineChart, Mic, Settings, Shield, Users, Wand2, Zap,
} from "lucide-react";
import { Logo } from "@/components/ui/Logo";
import { ThemeToggle } from "@/components/ui/ThemeToggle";
import { useAppState, useHydrated } from "@/lib/store/store";
import { currentStreak } from "@/lib/gamification";
import { useAuth } from "@/lib/supabase/auth";
import { useCloudSync } from "@/lib/supabase/sync";
import { cn } from "@/lib/utils";

const NAV = [
  { href: "/dashboard", label: "Home", icon: LayoutDashboard, mobile: true },
  { href: "/speak", label: "Speak", icon: Mic, mobile: true },
  { href: "/challenge", label: "30-Day", icon: CalendarCheck, mobile: true },
  { href: "/ielts", label: "IELTS", icon: GraduationCap, mobile: true },
  { href: "/interview", label: "Interview", icon: Briefcase, mobile: true },
  { href: "/grammar", label: "Grammar", icon: Wand2 },
  { href: "/vocabulary", label: "Vocabulary", icon: BookOpen },
  { href: "/progress", label: "Progress", icon: LineChart },
  { href: "/community", label: "Community", icon: Users },
  { href: "/profile", label: "Settings", icon: Settings },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const path = usePathname();
  const router = useRouter();
  const hydrated = useHydrated();
  const profile = useAppState((s) => s.profile);
  const activity = useAppState((s) => s.activity);
  const xp = useAppState((s) => s.xp);
  const auth = useAuth();
  useCloudSync();
  const streak = currentStreak(activity);
  const [features, setFeatures] = useState<Record<string, boolean>>({});
  useEffect(() => {
    fetchAiStatus().then((st) => st && setFeatures(st.features ?? {}));
  }, []);
  // Admin can switch modules off (feature flags). Map path prefix -> flag key.
  const flagOf = (href: string) => ({ "/speak": "speak", "/grammar": "grammar", "/challenge": "challenge", "/ielts": "ielts", "/interview": "interview", "/vocabulary": "vocabulary", "/community": "community" } as Record<string, string>)[href];
  const enabled = (href: string) => features[flagOf(href) ?? ""] !== false;
  const currentFlagHref = Object.keys({ "/speak": 1, "/grammar": 1, "/challenge": 1, "/ielts": 1, "/interview": 1, "/vocabulary": 1, "/community": 1 }).find((h) => path === h || path.startsWith(h + "/"));
  const blocked = currentFlagHref ? !enabled(currentFlagHref) : false;

  useEffect(() => {
    if (hydrated && !profile?.onboarded && path !== "/grammar") router.replace("/start");
  }, [hydrated, profile, path, router]);

  const nav = (auth.role === "admin" ? [...NAV, { href: "/admin", label: "Admin", icon: Shield }] : NAV).filter((n) => enabled(n.href));
  const active = (href: string) => path === href || path.startsWith(href + "/");

  return (
    <div className="min-h-dvh md:grid md:grid-cols-[240px_1fr]">
      <aside className="sticky top-0 hidden h-dvh flex-col border-r border-base bg-[var(--surface)] p-4 md:flex">
        <Logo href="/dashboard" />
        <nav className="mt-6 flex flex-1 flex-col gap-1" aria-label="Main">
          {nav.map((n) => (
            <Link key={n.href} href={n.href} className={cn("flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition", active(n.href) ? "bg-brand-50 text-brand-700 dark:bg-brand-900/40 dark:text-brand-200" : "text-muted hover:bg-[var(--surface-2)] hover:text-[var(--text)]")}>
              <n.icon size={18} /> {n.label}
            </Link>
          ))}
        </nav>
        {!auth.user && (
          <div className="rounded-xl surface-2 p-3 text-xs text-muted">
            <p className="font-semibold text-[var(--text)]">Guest mode</p>
            <p className="mt-1">Progress is saved only in this browser.</p>
            {auth.configured && <Link href="/signup" className="mt-2 inline-block font-semibold text-brand-500">Create free account →</Link>}
          </div>
        )}
      </aside>

      <div className="min-w-0">
        <header className="sticky top-0 z-20 flex items-center justify-between gap-2 border-b border-base bg-[var(--bg)]/85 px-4 py-2.5 backdrop-blur">
          <div className="md:hidden"><Logo href="/dashboard" /></div>
          <div className="hidden text-sm text-muted md:block">{profile ? `Hi ${profile.name.split(" ")[0] || "there"} 👋` : ""}</div>
          <div className="flex items-center gap-1.5">
            <span className="chip" title="Current daily streak"><Flame size={14} className={streak ? "text-accent-500" : "text-muted"} /> {streak}</span>
            <span className="chip" title="Experience points"><Zap size={14} className="text-brand-500" /> {xp}<span className="hidden sm:inline"> XP</span></span>
            <span className="hidden sm:inline-flex"><ThemeToggle /></span>
            <Link href="/profile" className="grid h-9 w-9 place-items-center rounded-full bg-brand-600 text-sm font-bold text-white" aria-label="Profile and settings">
              {(profile?.name?.[0] ?? "G").toUpperCase()}
            </Link>
          </div>
        </header>
        <main className="mx-auto w-full max-w-5xl px-4 pb-28 pt-5 md:pb-10">{!hydrated ? <div className="h-40 animate-pulse rounded-2xl surface-2" /> : blocked ? <div className="card p-6">This module is temporarily unavailable. Please try another activity.</div> : children}</main>
      </div>

      <nav className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-5 border-t border-base bg-[var(--surface)] pb-[env(safe-area-inset-bottom)] md:hidden" aria-label="Main mobile">
        {NAV.filter((n) => n.mobile && enabled(n.href)).map((n) => (
          <Link key={n.href} href={n.href} className={cn("flex flex-col items-center gap-0.5 py-2 text-[11px] font-medium", active(n.href) ? "text-brand-600 dark:text-brand-300" : "text-muted")}>
            <n.icon size={20} /> {n.label}
          </Link>
        ))}
      </nav>
    </div>
  );
}

export function PageHeader({ title, subtitle, children, back }: { title: string; subtitle?: React.ReactNode; children?: React.ReactNode; back?: { href: string; label: string } }) {
  return (
    <div className="mb-5">
      {back && <Link href={back.href} className="mb-2 inline-block text-sm font-medium text-brand-500">← {back.label}</Link>}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight sm:text-3xl">{title}</h1>
          {subtitle && <p className="mt-1 text-muted">{subtitle}</p>}
        </div>
        {children}
      </div>
    </div>
  );
}

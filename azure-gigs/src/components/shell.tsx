"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Bell, ChevronLeft, ChevronRight, LogOut, Menu, Moon, Plus, Search, Settings, Sun, X } from "lucide-react";
import { NAV } from "./nav";
import { NavIcon } from "./icons";
import { api } from "@/lib/client";
import { cn, timeAgo } from "@/lib/utils";

type Activity = { id: string; operation: string; status: string; resourceName: string | null; createdAt: string; resourceId: string | null };

function useClickOutside(ref: React.RefObject<HTMLElement | null>, onOut: () => void) {
  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onOut();
    };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, [ref, onOut]);
}

function GlobalSearch() {
  const [q, setQ] = useState("");
  const [results, setResults] = useState<{ kind: string; label: string; href: string }[]>([]);
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  const router = useRouter();
  useClickOutside(box, () => setOpen(false));
  useEffect(() => {
    if (q.trim().length < 2) {
      setResults([]);
      return;
    }
    const t = setTimeout(() => api(`/api/search?q=${encodeURIComponent(q)}`).then((r) => setResults(r.results)).catch(() => setResults([])), 200);
    return () => clearTimeout(t);
  }, [q]);
  return (
    <div ref={box} className="relative w-full max-w-xl">
      <label htmlFor="global-search" className="sr-only">Search resources, services and labs</label>
      <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-white/70" aria-hidden />
      <input
        id="global-search"
        value={q}
        onChange={(e) => { setQ(e.target.value); setOpen(true); }}
        onFocus={() => setOpen(true)}
        onKeyDown={(e) => { if (e.key === "Enter" && results[0]) { router.push(results[0].href); setOpen(false); } }}
        placeholder="Search resources, services and labs (/)"
        className="h-8 w-full rounded-sm border border-white/20 bg-white/10 pl-8 pr-2 text-sm text-white placeholder:text-white/70 focus:bg-white focus:text-ink focus:placeholder:text-muted focus:outline-none"
      />
      {open && results.length > 0 && (
        <ul className="absolute left-0 right-0 top-9 z-50 max-h-80 overflow-auto rounded-sm border border-line bg-surface py-1 shadow-lg">
          {results.map((r, i) => (
            <li key={i}>
              <Link href={r.href} onClick={() => setOpen(false)} className="flex items-center justify-between gap-3 px-3 py-1.5 text-sm text-ink hover:bg-subtle">
                <span className="truncate">{r.label}</span>
                <span className="shrink-0 text-xs text-muted">{r.kind}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function Notifications() {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<Activity[]>([]);
  const ref = useRef<HTMLDivElement>(null);
  useClickOutside(ref, () => setOpen(false));
  useEffect(() => {
    if (open) api("/api/activity?take=15").then((r) => setItems(r.logs)).catch(() => undefined);
  }, [open]);
  return (
    <div ref={ref} className="relative">
      <button aria-label="Notifications" aria-expanded={open} onClick={() => setOpen((o) => !o)} className="grid size-9 place-items-center text-white hover:bg-white/10">
        <Bell className="size-4" />
      </button>
      {open && (
        <div className="absolute right-0 top-10 z-50 w-80 rounded-sm border border-line bg-surface shadow-lg">
          <div className="flex items-center justify-between border-b border-line px-3 py-2">
            <p className="text-sm font-semibold text-ink">Notifications</p>
            <Link href="/monitor?tab=activity" onClick={() => setOpen(false)} className="text-xs text-brand">Activity log</Link>
          </div>
          <ul className="max-h-96 overflow-auto">
            {items.length === 0 && <li className="px-3 py-4 text-sm text-muted">No recent operations.</li>}
            {items.map((a) => (
              <li key={a.id} className="border-b border-line px-3 py-2 text-sm last:border-0">
                <p className="font-medium text-ink">{a.operation}</p>
                <p className="text-xs text-muted">
                  <span className={a.status === "Failed" ? "text-danger" : "text-ok"}>{a.status}</span> · {a.resourceName ?? "subscription"} · {timeAgo(a.createdAt)}
                </p>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function UserMenu({ user }: { user: { name: string; email: string; isAdmin?: boolean } }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useClickOutside(ref, () => setOpen(false));
  const logout = async () => {
    await api("/api/auth/logout", { method: "POST", body: {} }).catch(() => undefined);
    window.location.href = "/login";
  };
  return (
    <div ref={ref} className="relative">
      <button aria-label="Account" aria-expanded={open} onClick={() => setOpen((o) => !o)} className="flex h-9 items-center gap-2 px-2 text-white hover:bg-white/10">
        <span className="grid size-6 place-items-center rounded-full bg-white/20 text-xs font-semibold">{user.name.slice(0, 1).toUpperCase()}</span>
        <span className="hidden max-w-36 truncate text-xs md:block">{user.email}</span>
      </button>
      {open && (
        <div className="absolute right-0 top-10 z-50 w-64 rounded-sm border border-line bg-surface p-3 shadow-lg">
          <p className="text-sm font-semibold text-ink">{user.name}</p>
          <p className="truncate text-xs text-muted">{user.email}</p>
          <p className="mt-1 text-xs text-muted">Junior Azure Cloud Engineer · Contoso Digital Services (simulated)</p>
          <div className="mt-3 grid gap-1">
            <Link href="/dashboard" onClick={() => setOpen(false)} className="rounded-sm px-2 py-1 text-sm text-ink hover:bg-subtle">My progress</Link>
            {user.isAdmin && <Link href="/admin" onClick={() => setOpen(false)} className="rounded-sm px-2 py-1 text-sm text-ink hover:bg-subtle">Administration</Link>}
            <button onClick={logout} className="flex items-center gap-2 rounded-sm px-2 py-1 text-left text-sm text-danger hover:bg-subtle"><LogOut className="size-4" />Sign out</button>
          </div>
        </div>
      )}
    </div>
  );
}

function ThemeToggle() {
  const [dark, setDark] = useState(false);
  useEffect(() => setDark(document.documentElement.classList.contains("dark")), []);
  const toggle = () => {
    const next = !dark;
    document.documentElement.classList.toggle("dark", next);
    try {
      localStorage.setItem("ag-theme", next ? "dark" : "light");
    } catch {}
    setDark(next);
  };
  return (
    <button aria-label={dark ? "Switch to light theme" : "Switch to dark theme"} title="Settings: theme" onClick={toggle} className="grid size-9 place-items-center text-white hover:bg-white/10">
      {dark ? <Sun className="size-4" /> : <Moon className="size-4" />}
    </button>
  );
}

export function Shell({ user, children }: { user: { name: string; email: string; isAdmin?: boolean }; children: React.ReactNode }) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  useEffect(() => {
    try {
      setCollapsed(localStorage.getItem("ag-nav") === "collapsed");
    } catch {}
  }, []);
  useEffect(() => setMobileOpen(false), [pathname]);
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (e.key === "/" && !(e.target instanceof HTMLInputElement) && !(e.target instanceof HTMLTextAreaElement)) {
        e.preventDefault();
        document.getElementById("global-search")?.focus();
      }
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, []);
  const toggle = () => {
    setCollapsed((c) => {
      try {
        localStorage.setItem("ag-nav", c ? "open" : "collapsed");
      } catch {}
      return !c;
    });
  };
  const groups = [...new Set(NAV.map((n) => n.group))];
  const nav = (
    <nav aria-label="Primary" className="flex flex-col gap-0.5 py-2">
      {groups.map((g) => (
        <div key={g} className="mb-1">
          {!collapsed && <p className="px-4 pb-1 pt-2 text-[10px] font-semibold uppercase tracking-wider text-muted">{g}</p>}
          {NAV.filter((n) => n.group === g).map((n) => {
            const active = pathname === n.href || pathname.startsWith(n.href + "/");
            return (
              <Link key={n.key} href={n.href} title={n.label} aria-current={active ? "page" : undefined} className={cn("mx-1 flex items-center gap-3 rounded-sm px-3 py-1.5 text-sm text-ink hover:bg-subtle", active && "bg-brand-bg font-semibold text-brand")}>
                <NavIcon name={n.icon} className="size-4 shrink-0" />
                {!collapsed && <span className="truncate">{n.label}</span>}
              </Link>
            );
          })}
        </div>
      ))}
    </nav>
  );
  return (
    <div className="flex min-h-screen flex-col">
      <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:left-2 focus:top-2 focus:z-50 focus:bg-surface focus:p-2">Skip to content</a>
      <header className="sticky top-0 z-40 flex h-10 items-center gap-2 bg-header px-2 text-white">
        <button className="grid size-9 place-items-center hover:bg-white/10 md:hidden" aria-label="Open navigation" onClick={() => setMobileOpen(true)}>
          <Menu className="size-4" />
        </button>
        <Link href="/home" className="flex shrink-0 items-center gap-2 px-2 text-sm font-semibold">
          <span className="grid size-6 place-items-center rounded-sm bg-white text-xs font-bold text-header">AG</span>
          <span className="hidden sm:inline">Azure Gigs</span>
          <span className="hidden rounded-sm bg-white/15 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide lg:inline">Virtual mode</span>
        </Link>
        <div className="flex flex-1 justify-center px-2">
          <GlobalSearch />
        </div>
        <Link href="/services" className="hidden h-9 items-center gap-1 px-2 text-sm text-white hover:bg-white/10 sm:flex" title="Create a resource">
          <Plus className="size-4" /> <span className="hidden lg:inline">Create</span>
        </Link>
        <Notifications />
        <Link href="/company" aria-label="Settings and workplace" className="hidden size-9 place-items-center text-white hover:bg-white/10 sm:grid">
          <Settings className="size-4" />
        </Link>
        <ThemeToggle />
        <UserMenu user={user} />
      </header>
      <div className="flex flex-1">
        <aside className={cn("sticky top-10 hidden h-[calc(100vh-2.5rem)] shrink-0 overflow-y-auto border-r border-line bg-surface md:block", collapsed ? "w-14" : "w-60")}>
          <button onClick={toggle} aria-label={collapsed ? "Expand navigation" : "Collapse navigation"} className="flex w-full items-center justify-end px-3 py-1.5 text-muted hover:text-ink">
            {collapsed ? <ChevronRight className="size-4" /> : <ChevronLeft className="size-4" />}
          </button>
          {nav}
        </aside>
        {mobileOpen && (
          <div className="fixed inset-0 z-50 md:hidden" role="dialog" aria-modal="true" aria-label="Navigation">
            <div className="absolute inset-0 bg-black/40" onClick={() => setMobileOpen(false)} />
            <div className="absolute inset-y-0 left-0 w-72 overflow-y-auto bg-surface">
              <div className="flex items-center justify-between border-b border-line px-3 py-2">
                <span className="text-sm font-semibold">Azure Gigs</span>
                <button aria-label="Close navigation" onClick={() => setMobileOpen(false)} className="grid size-8 place-items-center"><X className="size-4" /></button>
              </div>
              {nav}
            </div>
          </div>
        )}
        <main id="main" className="min-w-0 flex-1 px-4 py-4 md:px-6">{children}</main>
      </div>
    </div>
  );
}

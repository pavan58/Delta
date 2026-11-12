"use client";
import { useEffect, useState } from "react";
import { hydrate, onUnlock, useAppState } from "@/lib/store/store";
import type { Achievement } from "@/lib/gamification";
import { AuthProvider } from "@/lib/supabase/auth";

function ThemeSync() {
  const theme = useAppState((s) => s.settings.theme);
  useEffect(() => {
    const apply = () => {
      const dark = theme === "dark" || (theme === "system" && matchMedia("(prefers-color-scheme: dark)").matches);
      document.documentElement.classList.toggle("dark", dark);
    };
    apply();
    const mq = matchMedia("(prefers-color-scheme: dark)");
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, [theme]);
  return null;
}

function AchievementToasts() {
  const [items, setItems] = useState<Array<Achievement & { key: number }>>([]);
  useEffect(
    () =>
      onUnlock((list) => {
        const stamped = list.map((a, i) => ({ ...a, key: Date.now() + i }));
        setItems((cur) => [...cur, ...stamped]);
        setTimeout(() => setItems((cur) => cur.filter((x) => !stamped.some((s) => s.key === x.key))), 5000);
      }),
    [],
  );
  if (!items.length) return null;
  return (
    <div className="fixed bottom-24 left-1/2 z-50 flex -translate-x-1/2 flex-col gap-2 md:bottom-6" role="status" aria-live="polite">
      {items.map((a) => (
        <div key={a.key} className="card fade-in flex items-center gap-3 px-4 py-3 shadow-lg">
          <span className="text-2xl" aria-hidden>{a.emoji}</span>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-brand-500">Achievement unlocked</p>
            <p className="font-semibold">{a.title}</p>
          </div>
        </div>
      ))}
    </div>
  );
}

function ServiceWorker() {
  useEffect(() => {
    if ("serviceWorker" in navigator && process.env.NODE_ENV === "production") {
      navigator.serviceWorker.register("/sw.js").catch(() => {});
    }
  }, []);
  return null;
}

export function Providers({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    hydrate();
    const ref = new URLSearchParams(location.search).get("ref");
    if (ref) {
      import("@/lib/store/store").then(({ setState }) =>
        setState((s) => (s.referredBy || ref === s.referralCode ? s : { ...s, referredBy: ref.slice(0, 12) })),
      );
    }
  }, []);
  return (
    <AuthProvider>
      <ThemeSync />
      <ServiceWorker />
      {children}
      <AchievementToasts />
    </AuthProvider>
  );
}

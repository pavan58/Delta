"use client";
import { Moon, Sun } from "lucide-react";
import { updateSettings, useAppState } from "@/lib/store/store";

export function ThemeToggle() {
  const theme = useAppState((s) => s.settings.theme);
  const toggle = () => {
    const isDark = document.documentElement.classList.contains("dark");
    updateSettings({ theme: isDark ? "light" : "dark" });
  };
  return (
    <button onClick={toggle} className="btn btn-ghost h-10 w-10 p-0" aria-label={`Switch theme (current: ${theme})`} title="Toggle light / dark">
      <Sun size={18} className="hidden dark:block" />
      <Moon size={18} className="dark:hidden" />
    </button>
  );
}

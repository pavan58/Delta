"use client";
/**
 * Local-first store. Everything a learner does is saved in this browser
 * (guest mode). When Supabase is configured and the learner signs in, the
 * sync layer mirrors this state to Postgres (see lib/supabase/sync.ts).
 */
import { useSyncExternalStore } from "react";
import type { AppState, DayActivity, Mistake, Settings } from "./types";
import { localDate, uid } from "@/lib/utils";
import { newlyUnlocked, type Achievement } from "@/lib/gamification";

const KEY = "speakup:v1";

export const DEFAULT_SETTINGS: Settings = {
  theme: "system",
  aiEnabled: false,
  aiConsent: false,
  userProvider: "",
  userApiKey: "",
  userModel: "",
  speechRate: 1,
  voiceURI: "",
  recognitionLang: "en-IN",
  keepRecordings: false,
  leaderboardOptIn: false,
  displayName: "",
};

export function initialState(): AppState {
  return {
    version: 1,
    guestId: uid(),
    profile: null,
    settings: { ...DEFAULT_SETTINGS },
    xp: 0,
    activity: {},
    sessions: [],
    mistakes: [],
    challenge: {},
    foundation: {},
    vocab: {},
    learnedWords: [],
    ielts: [],
    mocks: [],
    interviews: [],
    achievements: {},
    referralCode: Math.random().toString(36).slice(2, 8).toUpperCase(),
    referredBy: "",
    aiUsage: { date: "", count: 0 },
    updatedAt: new Date().toISOString(),
  };
}

const SERVER_STATE: AppState = { ...initialState(), guestId: "server", referralCode: "" };

let state: AppState = SERVER_STATE;
let hydrated = false;
const listeners = new Set<() => void>();
const unlockListeners = new Set<(a: Achievement[]) => void>();

function load(): AppState {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return initialState();
    const parsed = JSON.parse(raw) as Partial<AppState>;
    const base = initialState();
    return { ...base, ...parsed, settings: { ...base.settings, ...(parsed.settings ?? {}) } } as AppState;
  } catch {
    return initialState();
  }
}

function persist() {
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
    localStorage.setItem("speakup:theme", JSON.stringify(state.settings.theme));
  } catch {
    /* storage full or blocked - keep in memory */
  }
}

export function hydrate() {
  if (hydrated || typeof window === "undefined") return;
  state = load();
  hydrated = true;
  persist();
  listeners.forEach((l) => l());
}

export function isHydrated() {
  return hydrated;
}

export function getState(): AppState {
  return state;
}

export function setState(updater: (s: AppState) => AppState, opts: { silent?: boolean } = {}) {
  if (!hydrated) hydrate();
  let next = updater(state);
  next = { ...next, updatedAt: new Date().toISOString() };
  const unlocked = newlyUnlocked(next);
  if (unlocked.length) {
    const now = new Date().toISOString();
    next = { ...next, achievements: { ...next.achievements, ...Object.fromEntries(unlocked.map((a) => [a.id, now])) } };
  }
  state = next;
  persist();
  listeners.forEach((l) => l());
  if (unlocked.length && !opts.silent) unlockListeners.forEach((l) => l(unlocked));
}

export function replaceState(next: AppState) {
  state = next;
  persist();
  listeners.forEach((l) => l());
}

export function subscribe(l: () => void) {
  listeners.add(l);
  return () => {
    listeners.delete(l);
  };
}

export function onUnlock(l: (a: Achievement[]) => void) {
  unlockListeners.add(l);
  return () => {
    unlockListeners.delete(l);
  };
}

export function useAppState(): AppState;
export function useAppState<T>(selector: (s: AppState) => T): T;
export function useAppState<T>(selector?: (s: AppState) => T) {
  const snap = useSyncExternalStore(subscribe, getState, () => SERVER_STATE);
  return selector ? selector(snap) : snap;
}

export function useHydrated() {
  return useSyncExternalStore(subscribe, () => hydrated, () => false);
}

/* ---------------- actions ---------------- */

export function recordActivity(xp: number, minutes = 0, countsAsSession = true) {
  const today = localDate();
  setState((s) => {
    const cur: DayActivity = s.activity[today] ?? { minutes: 0, xp: 0, sessions: 0 };
    return {
      ...s,
      xp: s.xp + xp,
      activity: {
        ...s.activity,
        [today]: { minutes: +(cur.minutes + minutes).toFixed(2), xp: cur.xp + xp, sessions: cur.sessions + (countsAsSession ? 1 : 0) },
      },
    };
  });
}

export function addMistakes(items: Array<Omit<Mistake, "id" | "createdAt" | "revised" | "attempts">>) {
  if (!items.length) return;
  setState((s) => {
    const existing = new Set(s.mistakes.map((m) => m.original.toLowerCase()));
    const fresh = items
      .filter((m) => !existing.has(m.original.toLowerCase()))
      .map((m) => ({ ...m, id: uid(), createdAt: new Date().toISOString(), revised: false, attempts: 0 }));
    return { ...s, mistakes: [...fresh, ...s.mistakes].slice(0, 500) };
  });
}

export function updateSettings(patch: Partial<Settings>) {
  setState((s) => ({ ...s, settings: { ...s.settings, ...patch } }));
}

export function resetAllData() {
  try {
    localStorage.removeItem(KEY);
  } catch {}
  state = initialState();
  persist();
  listeners.forEach((l) => l());
}

export function exportData(): string {
  return JSON.stringify(state, null, 2);
}

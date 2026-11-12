"use client";
import { recordActivity, setState } from "./store";
import type { IeltsAttempt } from "./types";
import { XP } from "@/lib/gamification";
import { uid } from "@/lib/utils";

export function saveIeltsAttempt(a: Omit<IeltsAttempt, "id" | "date">, minutes = 0) {
  const attempt: IeltsAttempt = { ...a, id: uid(), date: new Date().toISOString() };
  setState((s) => ({ ...s, ielts: [attempt, ...s.ielts].slice(0, 300) }));
  if (!a.mock) recordActivity(XP.ieltsPractice, minutes);
  return attempt;
}

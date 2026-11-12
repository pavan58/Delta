"use client";
import { authHeader } from "@/lib/supabase/client";
import { getState, setState } from "@/lib/store/store";
import type { AiTask } from "./prompts";
import { localDate } from "@/lib/utils";

export interface AiStatus {
  serverAi: boolean;
  provider: string | null;
  model: string | null;
  aiEnabled: boolean;
  limits: { guest: number; user: number };
  features: Record<string, boolean>;
}

let statusPromise: Promise<AiStatus | null> | null = null;
export function fetchAiStatus(): Promise<AiStatus | null> {
  statusPromise ??= fetch("/api/ai/status").then((r) => (r.ok ? r.json() : null)).catch(() => null);
  return statusPromise;
}

/** True when the learner turned AI on, gave consent, and a provider (server or own key) exists. */
export async function aiAvailable(): Promise<boolean> {
  const s = getState().settings;
  if (!s.aiEnabled || !s.aiConsent) return false;
  if (s.userProvider && s.userApiKey) return true;
  return Boolean((await fetchAiStatus())?.serverAi);
}

export async function askAi(task: AiTask, messages: Array<{ role: "user" | "assistant"; content: string }>): Promise<{ text: string; model: string } | { error: string }> {
  const s = getState().settings;
  if (!s.aiEnabled || !s.aiConsent) return { error: "AI is off." };
  try {
    const res = await fetch("/api/ai/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json", ...(await authHeader()) },
      body: JSON.stringify({
        task,
        messages,
        consent: true,
        userKey: s.userProvider && s.userApiKey ? { provider: s.userProvider, apiKey: s.userApiKey, model: s.userModel || undefined } : undefined,
      }),
    });
    const j = await res.json();
    if (!res.ok) return { error: j.error ?? "AI request failed." };
    const today = localDate();
    setState((st) => ({ ...st, aiUsage: { date: today, count: st.aiUsage.date === today ? st.aiUsage.count + 1 : 1 } }), { silent: true });
    return { text: j.text, model: j.model };
  } catch {
    return { error: "Network error — showing free-mode feedback." };
  }
}

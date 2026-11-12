"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Download, KeyRound, LogOut, Mic, Shield, Sparkles, Trash2, User, Volume2 } from "lucide-react";
import { PageHeader } from "@/components/layout/AppShell";
import { exportData, resetAllData, setState, updateSettings, useAppState } from "@/lib/store/store";
import type { Level, Settings } from "@/lib/store/types";
import { useSpeechSynthesis } from "@/lib/speech/useSpeechSynthesis";
import { getRecognitionCtor } from "@/lib/speech/useSpeechRecognition";
import { fetchAiStatus, type AiStatus } from "@/lib/ai/client";
import { useAuth } from "@/lib/supabase/auth";
import { authHeader, getSupabase } from "@/lib/supabase/client";
import { localDate } from "@/lib/utils";
import { FeedbackForm } from "@/components/layout/FeedbackForm";

export default function ProfilePage() {
  const s = useAppState();
  const auth = useAuth();
  const router = useRouter();
  const tts = useSpeechSynthesis();
  const [ai, setAi] = useState<AiStatus | null>(null);
  const [srOk, setSrOk] = useState<boolean | null>(null);
  const [msg, setMsg] = useState("");
  useEffect(() => {
    fetchAiStatus().then(setAi);
    setSrOk(!!getRecognitionCtor());
  }, []);
  const p = s.profile;
  const setProfile = (patch: Partial<NonNullable<typeof p>>) => setState((st) => (st.profile ? { ...st, profile: { ...st.profile, ...patch } } : st));
  const set = (patch: Partial<Settings>) => updateSettings(patch);

  async function signOut() {
    await getSupabase()?.auth.signOut();
    router.push("/");
  }

  async function deleteAccount() {
    if (!confirm("Permanently delete your account and all cloud data? This cannot be undone.")) return;
    const res = await fetch("/api/account", { method: "DELETE", headers: await authHeader() });
    if (res.ok) {
      resetAllData();
      await getSupabase()?.auth.signOut();
      router.push("/");
    } else setMsg((await res.json()).error ?? "Could not delete account.");
  }

  function downloadData() {
    const blob = new Blob([exportData()], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `speakup-ai-data-${localDate()}.json`;
    a.click();
  }

  const usedToday = s.aiUsage.date === localDate() ? s.aiUsage.count : 0;

  return (
    <div className="space-y-4">
      <PageHeader title="Profile & Settings" />

      <section className="card p-4">
        <h2 className="flex items-center gap-2 font-semibold"><User size={18} /> Account</h2>
        {auth.user ? (
          <div className="mt-2 flex flex-wrap items-center gap-3 text-sm">
            <span>Signed in as <b>{auth.user.email}</b>{auth.role === "admin" && <span className="chip ml-2">admin</span>}</span>
            <span className="text-muted">Your progress syncs to your account.</span>
            <button onClick={signOut} className="btn btn-secondary ml-auto"><LogOut size={16} /> Sign out</button>
          </div>
        ) : (
          <div className="mt-2 text-sm">
            <p><b>Guest mode.</b> Your progress is stored only in this browser and will be lost if you clear browser data or switch devices.</p>
            {auth.configured ? (
              <div className="mt-2 flex gap-2"><Link href="/signup" className="btn btn-primary">Create free account</Link><Link href="/login" className="btn btn-secondary">Log in</Link></div>
            ) : (
              <p className="mt-1 text-muted">Accounts are not enabled on this installation (the site owner has not configured Supabase). Use &ldquo;Download my data&rdquo; to back up your progress.</p>
            )}
          </div>
        )}
      </section>

      {p && (
        <section className="card grid gap-3 p-4 sm:grid-cols-2">
          <h2 className="font-semibold sm:col-span-2">Learning profile</h2>
          <label className="text-sm"><span className="label">Name</span><input className="input mt-1" value={p.name} maxLength={40} onChange={(e) => setProfile({ name: e.target.value })} /></label>
          <label className="text-sm"><span className="label">Public display name (leaderboard)</span><input className="input mt-1" value={s.settings.displayName} maxLength={30} onChange={(e) => set({ displayName: e.target.value })} /></label>
          <label className="text-sm"><span className="label">English level</span>
            <select className="input mt-1" value={p.level} onChange={(e) => setProfile({ level: e.target.value as Level })}>
              {["beginner", "elementary", "intermediate", "upper-intermediate", "advanced"].map((l) => <option key={l} value={l}>{l.replace("-", " ")}</option>)}
            </select>
          </label>
          <label className="text-sm"><span className="label">Daily goal (minutes)</span>
            <select className="input mt-1" value={p.dailyMinutes} onChange={(e) => setProfile({ dailyMinutes: Number(e.target.value) })}>{[5, 10, 15, 30, 45].map((m) => <option key={m}>{m}</option>)}</select>
          </label>
          <label className="text-sm"><span className="label">Explanations</span>
            <select className="input mt-1" value={p.explainLang} onChange={(e) => setProfile({ explainLang: e.target.value as "en" | "hi" | "both" })}>
              <option value="en">English</option><option value="both">English + Hindi</option><option value="hi">Hindi</option>
            </select>
          </label>
          <label className="text-sm"><span className="label">Theme</span>
            <select className="input mt-1" value={s.settings.theme} onChange={(e) => set({ theme: e.target.value as Settings["theme"] })}>
              <option value="system">System</option><option value="light">Light</option><option value="dark">Dark</option>
            </select>
          </label>
          <Link href="/start" className="text-sm font-semibold text-brand-500">Redo onboarding questions →</Link>
        </section>
      )}

      <section className="card space-y-3 p-4">
        <h2 className="flex items-center gap-2 font-semibold"><Mic size={18} /> Voice</h2>
        <p className="text-sm">Speech recognition: {srOk === null ? "checking…" : srOk ? <span className="text-mint-500">supported in this browser</span> : <span className="text-amber-600">not supported — use Chrome, Edge or Safari, or type answers</span>}. Speech output: {tts.supported ? <span className="text-mint-500">supported</span> : <span className="text-amber-600">not supported</span>}.</p>
        <details className="text-sm text-muted">
          <summary className="cursor-pointer font-semibold text-brand-500">Microphone permission help</summary>
          <ul className="mt-2 list-disc space-y-1 pl-5">
            <li>Chrome/Edge (desktop): click the lock icon left of the address → Site settings → Microphone → Allow, then reload.</li>
            <li>Android Chrome: ⋮ → Settings → Site settings → Microphone → allow this site.</li>
            <li>iPhone Safari: Settings app → Safari → Microphone → Ask or Allow.</li>
            <li>Speech recognition needs an internet connection in most browsers because the browser&apos;s own speech service transcribes the audio.</li>
          </ul>
        </details>
        <div className="grid gap-3 sm:grid-cols-3">
          <label className="text-sm"><span className="label">Accent for recognition</span>
            <select className="input mt-1" value={s.settings.recognitionLang} onChange={(e) => set({ recognitionLang: e.target.value as Settings["recognitionLang"] })}><option value="en-IN">English (India)</option><option value="en-US">English (US)</option><option value="en-GB">English (UK)</option></select>
          </label>
          <label className="text-sm"><span className="label">Teacher voice</span>
            <select className="input mt-1" value={s.settings.voiceURI} onChange={(e) => set({ voiceURI: e.target.value })}>
              <option value="">Automatic</option>
              {tts.voices.map((v) => <option key={v.voiceURI} value={v.voiceURI}>{v.name} ({v.lang})</option>)}
            </select>
          </label>
          <label className="text-sm"><span className="label">Speaking speed: {s.settings.speechRate.toFixed(2)}×</span>
            <input type="range" min={0.6} max={1.3} step={0.05} className="mt-3 w-full" value={s.settings.speechRate} onChange={(e) => set({ speechRate: Number(e.target.value) })} />
          </label>
        </div>
        <button onClick={() => tts.speak("Hello! This is how I will sound when I teach you.", { rate: s.settings.speechRate, voiceURI: s.settings.voiceURI })} className="btn btn-secondary text-sm"><Volume2 size={16} /> Test voice</button>
      </section>

      <section className="card space-y-3 p-4">
        <h2 className="flex items-center gap-2 font-semibold"><Sparkles size={18} /> AI mode (optional)</h2>
        <p className="text-sm text-muted">SpeakUp AI works fully in <b>Free Mode</b> with a rule-based coach. AI mode adds context-aware corrections, better interview answers and detailed IELTS feedback using an external AI provider.</p>
        <p className="text-sm">Server AI: {ai === null ? "checking…" : ai.serverAi ? <span className="text-mint-500">available ({ai.provider} · {ai.model}), {auth.user ? ai.limits.user : ai.limits.guest} requests/day</span> : <span className="text-muted">not configured on this installation</span>}. Used today: {usedToday}.</p>
        <label className="flex items-start gap-2 text-sm"><input type="checkbox" className="mt-1" checked={s.settings.aiConsent} onChange={(e) => set({ aiConsent: e.target.checked, aiEnabled: e.target.checked ? s.settings.aiEnabled : false })} />
          <span>I understand that when AI mode is on, the text of my answers (not audio, not my name or email) is sent through SpeakUp AI&apos;s server to the selected AI provider, which processes it under its own privacy terms.</span>
        </label>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" disabled={!s.settings.aiConsent} checked={s.settings.aiEnabled} onChange={(e) => set({ aiEnabled: e.target.checked })} /> Enable AI mode</label>
        <details className="text-sm">
          <summary className="flex cursor-pointer items-center gap-1 font-semibold text-brand-500"><KeyRound size={14} /> Use my own AI API key (optional)</summary>
          <p className="mt-2 text-muted">Your key is stored only in this browser (never in our database) and is sent with each AI request to our server, which forwards it to the provider and discards it. You pay your provider directly.</p>
          <div className="mt-2 grid gap-2 sm:grid-cols-3">
            <select className="input" value={s.settings.userProvider} onChange={(e) => set({ userProvider: e.target.value as Settings["userProvider"] })} aria-label="Provider">
              <option value="">— none —</option><option value="anthropic">Anthropic (Claude)</option><option value="openai">OpenAI</option><option value="gemini">Google Gemini</option><option value="groq">Groq</option><option value="openrouter">OpenRouter</option>
            </select>
            <input className="input" type="password" autoComplete="off" placeholder="API key" value={s.settings.userApiKey} onChange={(e) => set({ userApiKey: e.target.value.trim() })} aria-label="API key" />
            <input className="input" placeholder="Model (optional)" value={s.settings.userModel} onChange={(e) => set({ userModel: e.target.value.trim() })} aria-label="Model" />
          </div>
          {s.settings.userApiKey && <button onClick={() => set({ userApiKey: "", userProvider: "" })} className="btn btn-ghost mt-2 text-sm text-red-500">Remove my key</button>}
        </details>
      </section>

      <section className="card space-y-3 p-4">
        <h2 className="flex items-center gap-2 font-semibold"><Shield size={18} /> Privacy</h2>
        <label className="flex items-start gap-2 text-sm"><input type="checkbox" className="mt-1" checked={s.settings.keepRecordings} onChange={(e) => set({ keepRecordings: e.target.checked })} />
          <span>Let me play back my own voice after speaking. Audio stays in this browser tab&apos;s memory only and is discarded when you leave the page. It is never uploaded.</span>
        </label>
        <label className="flex items-start gap-2 text-sm"><input type="checkbox" className="mt-1" checked={s.settings.leaderboardOptIn} disabled={!auth.user} onChange={(e) => set({ leaderboardOptIn: e.target.checked })} />
          <span>Show my display name, weekly XP and streak on the public leaderboard {!auth.user && "(requires an account)"}.</span>
        </label>
        <div className="flex flex-wrap gap-2">
          <button onClick={downloadData} className="btn btn-secondary text-sm"><Download size={16} /> Download my data</button>
          <button onClick={() => { if (confirm("Delete all SpeakUp AI data stored in this browser?")) { resetAllData(); router.push("/"); } }} className="btn btn-secondary text-sm text-red-500"><Trash2 size={16} /> Delete data on this device</button>
          {auth.user && <button onClick={deleteAccount} className="btn btn-secondary text-sm text-red-500"><Trash2 size={16} /> Delete my account</button>}
        </div>
        {msg && <p className="text-sm text-red-500">{msg}</p>}
        <p className="text-xs text-muted">Read the <Link href="/privacy" className="underline">privacy policy</Link> and <Link href="/terms" className="underline">terms</Link>.</p>
      </section>
      <FeedbackForm />
    </div>
  );
}

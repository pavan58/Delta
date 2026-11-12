"use client";
import { useEffect, useRef, useState } from "react";
import { Bot, Gauge, Languages, RefreshCw, Repeat, Sparkles, Turtle, Volume2 } from "lucide-react";
import { PageHeader } from "@/components/layout/AppShell";
import { VoiceInput, type VoiceAnswer } from "@/components/voice/VoiceInput";
import { GrammarFeedback, ScoreReport } from "@/components/voice/Feedback";
import { TOPICS, levelToMode, teacherReply, type TeachingMode, type Topic } from "@/lib/ai/teacher";
import { aiAvailable, askAi } from "@/lib/ai/client";
import { scoreSpeaking, type SpeakingResult } from "@/lib/scoring/speaking";
import { saveSpeakingSession } from "@/lib/store/actions";
import { updateSettings, useAppState } from "@/lib/store/store";
import { useSpeechSynthesis } from "@/lib/speech/useSpeechSynthesis";
import type { GrammarReport } from "@/lib/grammar/engine";
import { cn } from "@/lib/utils";

interface Msg {
  role: "teacher" | "learner";
  text: string;
  report?: GrammarReport;
  result?: SpeakingResult;
  source?: "free" | "ai";
  model?: string;
}

const MODES: Array<{ v: TeachingMode; label: string; hint: string }> = [
  { v: "beginner", label: "Beginner", hint: "Simple English, Hindi help" },
  { v: "intermediate", label: "Intermediate", hint: "Natural conversation" },
  { v: "advanced", label: "Advanced", hint: "Professional fluency" },
];

export default function SpeakPage() {
  const profile = useAppState((s) => s.profile);
  const settings = useAppState((s) => s.settings);
  const [mode, setMode] = useState<TeachingMode>(levelToMode(profile?.level));
  const [topic, setTopic] = useState<Topic>(TOPICS[0]);
  const [hindi, setHindi] = useState(profile?.explainLang !== "en");
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [turn, setTurn] = useState(0);
  const [busy, setBusy] = useState(false);
  const [useAi, setUseAi] = useState(false);
  const [selected, setSelected] = useState<number | null>(null);
  const tts = useSpeechSynthesis();
  const endRef = useRef<HTMLDivElement>(null);
  const rate = settings.speechRate * (settings.speechRate < 0.9 ? 1 : 1);

  useEffect(() => {
    aiAvailable().then(setUseAi);
  }, [settings.aiEnabled, settings.aiConsent, settings.userApiKey]);

  useEffect(() => {
    const first = topic.questions[mode][0];
    setMsgs([{ role: "teacher", text: `Let's talk about ${topic.title.toLowerCase()}. ${first}`, source: "free" }]);
    setTurn(0);
    setSelected(null);
  }, [topic, mode]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [msgs]);

  const say = (text: string) => tts.speak(text.replace(/Correct sentence:/, "The correct sentence is:"), { rate: settings.speechRate, voiceURI: settings.voiceURI });

  async function onAnswer(a: VoiceAnswer) {
    const lastQ = [...msgs].reverse().find((m) => m.role === "teacher")?.text ?? "";
    const result = scoreSpeaking({ transcript: a.text, durationSec: a.durationSec, input: a.input, confidence: a.confidence, minSeconds: mode === "beginner" ? 10 : 20 });
    const reply = teacherReply({ text: a.text, source: a.input, mode, topic, turn, hindi });
    setMsgs((m) => [...m, { role: "learner", text: a.text, report: reply.report, result }]);
    setSelected(msgs.length);
    saveSpeakingSession({ module: "speak", prompt: lastQ, transcript: a.text, input: a.input, durationSec: a.durationSec, result });
    setTurn((t) => t + 1);

    let text = reply.text;
    let source: Msg["source"] = "free";
    let model: string | undefined;
    if (useAi) {
      setBusy(true);
      const history = msgs.slice(-8).map((m) => ({ role: m.role === "teacher" ? ("assistant" as const) : ("user" as const), content: m.text }));
      while (history.length && history[0].role !== "user") history.shift();
      const r = await askAi("teacher", [...history, { role: "user", content: `${hindi ? "(Please add a short Hindi explanation.) " : ""}[Level: ${mode}] ${a.text}` }]);
      setBusy(false);
      if ("text" in r && r.text) {
        text = r.text;
        source = "ai";
        model = r.model;
      }
    }
    setMsgs((m) => [...m, { role: "teacher", text, source, model }]);
    say(text);
  }

  const sel = selected !== null ? msgs[selected] : [...msgs].reverse().find((m) => m.role === "learner");

  return (
    <div>
      <PageHeader title="AI English Speaking Teacher" subtitle="Speak or type. Get corrections, explanations and a follow-up question.">
        <span className={cn("chip", useAi ? "text-brand-500" : "")} title={useAi ? "AI provider enabled" : "Free rule-based coach"}>
          {useAi ? <><Sparkles size={14} /> AI mode</> : <><Bot size={14} /> Free coach (rule-based)</>}
        </span>
      </PageHeader>

      <div className="mb-4 flex flex-wrap gap-2" role="group" aria-label="Teaching mode">
        {MODES.map((m) => (
          <button key={m.v} onClick={() => setMode(m.v)} className={cn("btn btn-secondary py-1.5 text-sm", mode === m.v && "border-brand-500 ring-2 ring-brand-500/30")} aria-pressed={mode === m.v} title={m.hint}>
            {m.label}
          </button>
        ))}
        <button onClick={() => setHindi(!hindi)} className={cn("btn btn-secondary py-1.5 text-sm", hindi && "border-brand-500 ring-2 ring-brand-500/30")} aria-pressed={hindi}>
          <Languages size={16} /> हिंदी help
        </button>
        <button onClick={() => updateSettings({ speechRate: settings.speechRate < 0.9 ? 1 : 0.75 })} className={cn("btn btn-secondary py-1.5 text-sm", settings.speechRate < 0.9 && "border-brand-500 ring-2 ring-brand-500/30")} aria-pressed={settings.speechRate < 0.9}>
          <Turtle size={16} /> Slow speech
        </button>
      </div>

      <div className="mb-4 flex gap-2 overflow-x-auto pb-1">
        {TOPICS.map((t) => (
          <button key={t.id} onClick={() => setTopic(t)} className={cn("chip shrink-0 px-3 py-1.5 text-sm", topic.id === t.id && "border-brand-500 bg-brand-500 text-white")}>
            {t.emoji} {t.title}
          </button>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_380px]">
        <div className="flex min-h-[420px] flex-col">
          <div className="card flex-1 space-y-3 overflow-y-auto p-3 sm:p-4" style={{ maxHeight: "60vh" }} aria-live="polite">
            {msgs.map((m, i) => (
              <div key={i} className={cn("flex", m.role === "learner" ? "justify-end" : "justify-start")}>
                <div
                  onClick={() => m.role === "learner" && setSelected(i)}
                  className={cn(
                    "max-w-[88%] whitespace-pre-line rounded-2xl px-3.5 py-2.5 text-[15px]",
                    m.role === "learner" ? "cursor-pointer rounded-tr-sm bg-brand-600 text-white" : "rounded-tl-sm surface-2",
                    selected === i && "ring-2 ring-accent-400",
                  )}
                >
                  {m.text}
                  {m.role === "learner" && m.result && <div className="mt-1 text-xs text-brand-100">Score {m.result.scores.overall}/100 · tap for details</div>}
                  {m.role === "teacher" && (
                    <div className="mt-1.5 flex items-center gap-1">
                      <button onClick={() => say(m.text)} className="btn btn-ghost px-1.5 py-0.5 text-xs" aria-label="Replay"><Volume2 size={14} /> Replay</button>
                      <button onClick={() => tts.speak(m.text, { rate: 0.7, voiceURI: settings.voiceURI })} className="btn btn-ghost px-1.5 py-0.5 text-xs" aria-label="Replay slowly"><Repeat size={14} /> Slow</button>
                      <span className="ml-auto text-[10px] text-muted">{m.source === "ai" ? `AI · ${m.model}` : "Free coach"}</span>
                    </div>
                  )}
                </div>
              </div>
            ))}
            {busy && <div className="w-24 animate-pulse rounded-2xl surface-2 px-3 py-2 text-sm text-muted">Thinking…</div>}
            <div ref={endRef} />
          </div>
          <div className="mt-3">
            <VoiceInput onSubmit={onAnswer} disabled={busy} submitLabel="Send" placeholder="Type your answer in English…" compact />
          </div>
          <div className="mt-2 flex justify-between text-xs text-muted">
            <span>Voice uses your browser&apos;s speech recognition — some browsers process audio on their own servers. No audio is stored by SpeakUp AI.</span>
            <button onClick={() => setTopic({ ...topic })} className="flex shrink-0 items-center gap-1 font-semibold text-brand-500"><RefreshCw size={12} /> Restart</button>
          </div>
        </div>

        <aside className="space-y-4">
          {sel?.report && sel.result ? (
            <>
              <div className="card p-4">
                <p className="mb-2 font-semibold">Feedback on: <span className="font-normal text-muted">&ldquo;{sel.text.slice(0, 80)}{sel.text.length > 80 ? "…" : ""}&rdquo;</span></p>
                <GrammarFeedback report={sel.report} />
              </div>
              <ScoreReport scores={sel.result.scores} tips={sel.result.tips} title="Answer score" />
            </>
          ) : (
            <div className="card p-5 text-sm text-muted">
              <Gauge className="mb-2 text-brand-500" />
              <p className="font-semibold text-[var(--text)]">How it works</p>
              <ol className="mt-2 list-decimal space-y-1 pl-4">
                <li>Choose a level and a topic.</li>
                <li>Tap the mic and answer the teacher&apos;s question (or type).</li>
                <li>See the correct sentence, why, a better version and your score.</li>
                <li>Answer the follow-up question to keep the conversation going.</li>
              </ol>
              <p className="mt-3">Mistakes are saved to your personal tracker in the Grammar Coach for revision.</p>
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}

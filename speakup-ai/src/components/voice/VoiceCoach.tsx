"use client";
/**
 * Hands-free Voice Coach: the coach speaks a question, listens automatically,
 * detects when the learner stops talking, gives spoken feedback and a follow-up
 * question, then listens again — like a phone call with an English teacher.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { Hand, Languages, Mic, MicOff, Pause, PhoneOff, Play, Repeat, Sparkles, Turtle, Volume2 } from "lucide-react";
import { TOPICS, levelToMode, teacherReply, type TeachingMode, type Topic } from "@/lib/ai/teacher";
import { aiAvailable, askAi } from "@/lib/ai/client";
import { scoreSpeaking, type SpeakingResult } from "@/lib/scoring/speaking";
import { saveSpeakingSession } from "@/lib/store/actions";
import { updateSettings, useAppState } from "@/lib/store/store";
import { useSpeechRecognition } from "@/lib/speech/useSpeechRecognition";
import { cancelSpeech, speakChunks, synthesisSupported } from "@/lib/speech/useSpeechSynthesis";
import { GrammarFeedback } from "./Feedback";
import { avg, cn } from "@/lib/utils";

type Phase = "setup" | "speaking" | "listening" | "finishing" | "thinking" | "paused" | "ended";

interface Turn {
  role: "coach" | "you";
  text: string;
  result?: SpeakingResult;
  source?: "free" | "ai";
}

/** How long a pause (ms) means "I've finished my answer". */
const PAUSE_OPTIONS = [{ ms: 1800, label: "Short" }, { ms: 2800, label: "Normal" }, { ms: 4200, label: "Long" }];
const NO_SPEECH_MS = 15000;

/** Turns the written teacher reply into natural speech (no labels, no Hindi script). */
export function toSpoken(text: string) {
  return text
    .split("\n")
    .filter((l) => !/[ऀ-ॿ]/.test(l))
    .map((l) => l.replace(/^Correct sentence:\s*/i, "The correct sentence is: ").replace(/^Why\?\s*/i, "").replace(/^A more professional way to say it:\s*/i, "A more professional way is: ").replace(/["“”]/g, ""))
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
}

export function VoiceCoach() {
  const profile = useAppState((s) => s.profile);
  const settings = useAppState((s) => s.settings);
  const sr = useSpeechRecognition(settings.recognitionLang);
  const [phase, setPhase] = useState<Phase>("setup");
  const [mode, setMode] = useState<TeachingMode>(levelToMode(profile?.level));
  const [topic, setTopic] = useState<Topic>(TOPICS[0]);
  const [hindi, setHindi] = useState(profile?.explainLang !== "en");
  const [pauseMs, setPauseMs] = useState(PAUSE_OPTIONS[1].ms);
  const [turns, setTurns] = useState<Turn[]>([]);
  const [turnNo, setTurnNo] = useState(0);
  const [useAi, setUseAi] = useState(false);
  const [notice, setNotice] = useState("");
  const latestRef = useRef({ text: "", conf: null as number | null, dur: 0 });
  const silenceTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const noSpeechTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const stopSpeechRef = useRef<() => void>(() => {});
  const phaseRef = useRef<Phase>("setup");
  phaseRef.current = phase;
  const lastCoach = [...turns].reverse().find((t) => t.role === "coach")?.text ?? "";
  const rate = settings.speechRate;
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    aiAvailable().then(setUseAi);
  }, [settings.aiEnabled, settings.aiConsent, settings.userApiKey]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [turns, phase]);

  const clearTimers = () => {
    clearTimeout(silenceTimer.current);
    clearTimeout(noSpeechTimer.current);
  };

  const listen = useCallback(() => {
    if (phaseRef.current === "paused" || phaseRef.current === "ended") return;
    latestRef.current = { text: "", conf: null, dur: 0 };
    setNotice("");
    setPhase("listening");
    sr.reset();
    sr.start();
    clearTimeout(noSpeechTimer.current);
    noSpeechTimer.current = setTimeout(() => {
      if (phaseRef.current === "listening" && !latestRef.current.text) {
        sr.stop();
        setPhase("paused");
        setNotice("I didn't hear anything. Tap “Resume” when you're ready to answer.");
      }
    }, NO_SPEECH_MS);
  }, [sr]);

  const say = useCallback(
    (text: string, then?: () => void) => {
      setPhase("speaking");
      stopSpeechRef.current = speakChunks(toSpoken(text), { rate, voiceURI: settings.voiceURI, onEnd: () => then?.() });
    },
    [rate, settings.voiceURI],
  );

  // Track what the learner is saying and detect the end of their answer by silence.
  useEffect(() => {
    if (phase !== "listening") return;
    const text = `${sr.result.transcript} ${sr.result.interim}`.trim();
    if (!text) return;
    latestRef.current = { text, conf: sr.result.confidence, dur: sr.result.durationSec };
    clearTimeout(noSpeechTimer.current);
    clearTimeout(silenceTimer.current);
    silenceTimer.current = setTimeout(() => finishAnswer(), pauseMs);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sr.result.transcript, sr.result.interim, phase, pauseMs]);

  // If the browser stops listening by itself (errors), surface it.
  useEffect(() => {
    if (phase === "listening" && (sr.status === "denied" || sr.status === "error")) {
      clearTimers();
      setPhase("paused");
      setNotice(sr.error || "The microphone stopped. Tap “Resume” to try again.");
    }
  }, [sr.status, sr.error, phase]);

  function finishAnswer() {
    if (phaseRef.current !== "listening") return;
    clearTimers();
    setPhase("finishing");
    sr.stop();
  }

  // After recognition has fully stopped, the final text is available: evaluate and reply.
  useEffect(() => {
    if (phase !== "finishing" || sr.listening) return;
    const text = (sr.result.transcript || latestRef.current.text).trim();
    const dur = sr.result.durationSec || latestRef.current.dur;
    if (text.split(/\s+/).length < 2) {
      say("Sorry, I didn't catch that. Could you say it again?", listen);
      return;
    }
    void respond(text, dur, sr.result.confidence ?? latestRef.current.conf, "voice");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, sr.listening]);

  async function respond(text: string, durationSec: number, confidence: number | null, input: "voice" | "text") {
    setPhase("thinking");
    const question = lastCoach;
    const result = scoreSpeaking({ transcript: text, durationSec, input, confidence, minSeconds: mode === "beginner" ? 8 : 15 });
    const reply = teacherReply({ text, source: input, mode, topic, turn: turnNo, hindi });
    setTurns((t) => [...t, { role: "you", text, result }]);
    saveSpeakingSession({ module: "speak", prompt: question, transcript: text, input, durationSec, result });
    setTurnNo((n) => n + 1);
    let answer = reply.text;
    let source: Turn["source"] = "free";
    if (useAi) {
      const history = turns.slice(-8).map((m) => ({ role: m.role === "coach" ? ("assistant" as const) : ("user" as const), content: m.text }));
      while (history.length && history[0].role !== "user") history.shift();
      const r = await askAi("teacher", [...history, { role: "user", content: `${hindi ? "(Please add a short Hindi explanation.) " : ""}[Level: ${mode}] ${text}` }]);
      if ("text" in r && r.text) {
        answer = r.text;
        source = "ai";
      }
    }
    if (phaseRef.current === "ended") return;
    setTurns((t) => [...t, { role: "coach", text: answer, source }]);
    say(answer, listen);
  }

  function start() {
    // Must run inside the tap: browsers only allow audio after a user gesture.
    const name = profile?.name?.split(" ")[0] || "there";
    const first = topic.questions[mode][0];
    const greeting = `Hi ${name}! I'm your English coach. Let's talk about ${topic.title.toLowerCase()}. Answer in full sentences, and when you finish, just pause. ${first}`;
    setTurns([{ role: "coach", text: greeting }]);
    setTurnNo(0);
    say(greeting, listen);
    // Ask for microphone permission now, while we still have the user's tap.
    navigator.mediaDevices?.getUserMedia?.({ audio: true }).then((st) => st.getTracks().forEach((t) => t.stop())).catch((e: { name?: string }) => {
      if (e?.name === "NotAllowedError") setNotice("Microphone access is blocked. Allow the microphone in your browser settings (lock icon in the address bar), then tap Resume.");
    });
  }

  function pause() {
    clearTimers();
    stopSpeechRef.current();
    cancelSpeech();
    sr.stop();
    setPhase("paused");
  }

  function resume() {
    setNotice("");
    listen();
  }

  function end() {
    clearTimers();
    stopSpeechRef.current();
    cancelSpeech();
    sr.stop();
    setPhase("ended");
  }

  useEffect(() => () => {
    clearTimers();
    cancelSpeech();
  }, []);

  if (sr.supported === false || !synthesisSupported())
    return (
      <div className="card p-5">
        <MicOff className="text-amber-500" />
        <p className="mt-2 font-semibold">Hands-free voice isn&apos;t supported in this browser.</p>
        <p className="mt-1 text-sm text-muted">Please open SpeakUp AI in <b>Google Chrome</b> (Android or computer), <b>Microsoft Edge</b> or <b>Safari</b> (iPhone). Firefox does not support speech recognition. You can still use the “Chat &amp; type” mode.</p>
      </div>
    );

  if (phase === "setup")
    return (
      <div className="space-y-4">
        <div className="card p-5 text-center">
          <div className="mx-auto grid h-20 w-20 place-items-center rounded-full bg-brand-600 text-white"><Volume2 size={34} /></div>
          <h2 className="mt-3 text-xl font-bold">Talk with your English coach</h2>
          <p className="mx-auto mt-1 max-w-md text-sm text-muted">The coach asks a question out loud. Answer by speaking — when you pause, the coach corrects you, explains, and asks the next question. No typing or tapping needed.</p>
          <button onClick={start} className="btn btn-primary mt-4 px-8 py-3 text-base"><Play size={18} /> Start conversation</button>
          <p className="mt-2 text-xs text-muted">Use headphones if you can, so the microphone doesn&apos;t hear the coach. Allow microphone access when asked.</p>
        </div>
        <div className="card space-y-3 p-4">
          <div>
            <p className="label mb-1">Level</p>
            <div className="flex flex-wrap gap-2">
              {(["beginner", "intermediate", "advanced"] as const).map((m) => (
                <button key={m} onClick={() => setMode(m)} aria-pressed={mode === m} className={cn("chip px-3 py-1.5 capitalize", mode === m && "border-brand-500 bg-brand-500 text-white")}>{m}</button>
              ))}
            </div>
          </div>
          <div>
            <p className="label mb-1">Topic</p>
            <div className="flex flex-wrap gap-2">
              {TOPICS.map((t) => (
                <button key={t.id} onClick={() => setTopic(t)} aria-pressed={topic.id === t.id} className={cn("chip px-3 py-1.5", topic.id === t.id && "border-brand-500 bg-brand-500 text-white")}>{t.emoji} {t.title}</button>
              ))}
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <p className="label">I need</p>
            {PAUSE_OPTIONS.map((p) => (
              <button key={p.ms} onClick={() => setPauseMs(p.ms)} aria-pressed={pauseMs === p.ms} className={cn("chip px-3 py-1.5", pauseMs === p.ms && "border-brand-500 bg-brand-500 text-white")}>{p.label} pauses</button>
            ))}
          </div>
          <div className="flex flex-wrap gap-2">
            <button onClick={() => setHindi(!hindi)} aria-pressed={hindi} className={cn("btn btn-secondary py-1.5 text-sm", hindi && "border-brand-500 ring-2 ring-brand-500/30")}><Languages size={16} /> हिंदी help on screen</button>
            <button onClick={() => updateSettings({ speechRate: rate < 0.9 ? 1 : 0.8 })} aria-pressed={rate < 0.9} className={cn("btn btn-secondary py-1.5 text-sm", rate < 0.9 && "border-brand-500 ring-2 ring-brand-500/30")}><Turtle size={16} /> Slow coach voice</button>
          </div>
        </div>
      </div>
    );

  if (phase === "ended") {
    const mine = turns.filter((t) => t.role === "you" && t.result);
    const avgScore = mine.length ? Math.round(avg(mine.map((t) => t.result!.scores.overall))) : 0;
    const mistakes = mine.flatMap((t) => t.result!.grammar.issues.filter((i) => i.category !== "filler" && i.category !== "punctuation"));
    return (
      <div className="space-y-4">
        <div className="card p-5 text-center">
          <p className="text-4xl">🎉</p>
          <h2 className="mt-2 text-xl font-bold">Great conversation!</h2>
          <p className="text-muted">{mine.length} {mine.length === 1 ? "answer" : "answers"} · average score {avgScore}/100 (estimate)</p>
          {mistakes.length > 0 && (
            <div className="mx-auto mt-4 max-w-md text-left">
              <p className="font-semibold">Practise these corrections:</p>
              <ul className="mt-1 space-y-1 text-sm">{mistakes.slice(0, 6).map((m, i) => <li key={i}><span className="text-red-500 line-through">{m.original}</span> → <b className="text-mint-500">{m.replacement}</b></li>)}</ul>
            </div>
          )}
          <button onClick={() => { setTurns([]); setPhase("setup"); }} className="btn btn-primary mt-4">Start another conversation</button>
        </div>
      </div>
    );
  }

  const live = `${sr.result.transcript} ${sr.result.interim}`.trim();
  return (
    <div className="space-y-3">
      <div className="card flex flex-col items-center gap-3 p-5 text-center" aria-live="polite">
        <div className={cn("grid h-24 w-24 place-items-center rounded-full text-white transition",
          phase === "listening" ? "pulse-ring bg-red-500" : phase === "speaking" ? "bg-brand-600" : phase === "paused" ? "bg-[var(--muted)]" : "animate-pulse bg-accent-500")}>
          {phase === "listening" ? <Mic size={40} /> : phase === "paused" ? <Pause size={40} /> : <Volume2 size={40} />}
        </div>
        <p className="text-lg font-semibold">
          {phase === "speaking" ? "Coach is speaking…" : phase === "listening" ? (live ? "Listening… pause when you finish" : "Your turn — speak now") : phase === "paused" ? "Paused" : "Coach is thinking…"}
        </p>
        {phase === "listening" && <p className="min-h-6 max-w-xl text-[15px] text-muted">{live}</p>}
        {notice && <p className="rounded-lg bg-amber-500/10 p-2 text-sm text-amber-700 dark:text-amber-300" role="alert">{notice}</p>}
        <div className="flex flex-wrap justify-center gap-2">
          {phase === "listening" && <button onClick={finishAnswer} className="btn btn-primary" disabled={!live}><Hand size={16} /> I&apos;m done</button>}
          {phase === "paused" ? (
            <button onClick={resume} className="btn btn-primary"><Mic size={16} /> Resume</button>
          ) : (
            <button onClick={pause} className="btn btn-secondary"><Pause size={16} /> Pause</button>
          )}
          <button onClick={() => { clearTimers(); sr.stop(); say(lastCoach, listen); }} className="btn btn-secondary" disabled={phase === "thinking" || phase === "finishing"}><Repeat size={16} /> Repeat</button>
          <button onClick={end} className="btn btn-secondary text-red-500"><PhoneOff size={16} /> End</button>
        </div>
        <span className="text-xs text-muted">{useAi ? <><Sparkles size={12} className="inline" /> AI coach</> : "Free coach (rule-based)"} · {topic.emoji} {topic.title} · {mode}</span>
      </div>

      <div className="space-y-3">
        {turns.map((t, i) => (
          <div key={i} className={cn("flex", t.role === "you" ? "justify-end" : "justify-start")}>
            <div className={cn("max-w-[90%] rounded-2xl px-3.5 py-2.5 text-[15px]", t.role === "you" ? "rounded-tr-sm bg-brand-600 text-white" : "card rounded-tl-sm")}>
              <p className="whitespace-pre-line">{t.text}</p>
              {t.role === "you" && t.result && (
                <details className="mt-1 text-sm">
                  <summary className="cursor-pointer text-brand-100">Score {t.result.scores.overall}/100 · corrections</summary>
                  <div className="mt-2 rounded-xl bg-[var(--surface)] p-2 text-[var(--text)]"><GrammarFeedback report={t.result.grammar} showProfessional={false} /></div>
                </details>
              )}
            </div>
          </div>
        ))}
        <div ref={endRef} />
      </div>
    </div>
  );
}

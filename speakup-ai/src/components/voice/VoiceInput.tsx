"use client";
import { useEffect, useRef, useState } from "react";
import { Keyboard, Mic, MicOff, Play, Send, Square, RotateCcw, Info } from "lucide-react";
import { useSpeechRecognition } from "@/lib/speech/useSpeechRecognition";
import { useAppState } from "@/lib/store/store";
import { cn, mmss } from "@/lib/utils";

export interface VoiceAnswer {
  text: string;
  input: "voice" | "text";
  durationSec: number;
  confidence: number | null;
}

interface Props {
  onSubmit: (a: VoiceAnswer) => void;
  placeholder?: string;
  minSeconds?: number;
  maxSeconds?: number;
  submitLabel?: string;
  disabled?: boolean;
  compact?: boolean;
  /** Start in text mode (e.g. writing tasks). */
  defaultMode?: "voice" | "text";
  autoStart?: boolean;
}

export function VoiceInput({ onSubmit, placeholder = "Type your answer…", minSeconds, maxSeconds, submitLabel = "Check my answer", disabled, compact, defaultMode, autoStart }: Props) {
  const settings = useAppState((s) => s.settings);
  const sr = useSpeechRecognition(settings.recognitionLang);
  const [mode, setMode] = useState<"voice" | "text">(defaultMode ?? "voice");
  const [text, setText] = useState("");
  const [typedStart, setTypedStart] = useState<number | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const mediaRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const startedAt = useRef(0);

  useEffect(() => {
    if (sr.supported === false && !defaultMode) setMode("text");
  }, [sr.supported, defaultMode]);

  useEffect(() => {
    if (!sr.listening) return;
    startedAt.current = performance.now() - sr.result.durationSec * 1000;
    const t = setInterval(() => {
      const e = (performance.now() - startedAt.current) / 1000;
      setElapsed(e);
      if (maxSeconds && e >= maxSeconds) stopVoice();
    }, 250);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sr.listening]);

  useEffect(() => {
    if (autoStart && sr.supported && mode === "voice") startVoice();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoStart, sr.supported]);

  useEffect(() => () => { if (audioUrl) URL.revokeObjectURL(audioUrl); }, [audioUrl]);

  async function startVoice() {
    setElapsed(0);
    setAudioUrl(null);
    sr.start();
    if (settings.keepRecordings && typeof MediaRecorder !== "undefined") {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        const mr = new MediaRecorder(stream);
        chunksRef.current = [];
        mr.ondataavailable = (e) => chunksRef.current.push(e.data);
        mr.onstop = () => {
          stream.getTracks().forEach((t) => t.stop());
          setAudioUrl(URL.createObjectURL(new Blob(chunksRef.current, { type: mr.mimeType })));
        };
        mr.start();
        mediaRef.current = mr;
      } catch {
        /* recording is optional */
      }
    }
  }

  function stopVoice() {
    sr.stop();
    if (mediaRef.current?.state === "recording") mediaRef.current.stop();
  }

  const voiceText = (sr.result.transcript + " " + sr.result.interim).trim();
  const tooShort = minSeconds && mode === "voice" && !sr.listening && sr.result.transcript && sr.result.durationSec < minSeconds;

  function submit() {
    if (mode === "voice") {
      const t = sr.result.transcript.trim() || text.trim();
      if (!t) return;
      onSubmit({ text: t, input: sr.result.transcript ? "voice" : "text", durationSec: sr.result.durationSec || elapsed, confidence: sr.result.confidence });
      sr.reset();
      setText("");
      setElapsed(0);
    } else {
      if (!text.trim()) return;
      const dur = typedStart ? (Date.now() - typedStart) / 1000 : 0;
      onSubmit({ text: text.trim(), input: "text", durationSec: dur, confidence: null });
      setText("");
      setTypedStart(null);
    }
  }

  return (
    <div className={cn("card p-3", compact ? "" : "sm:p-4")}>
      {mode === "voice" ? (
        <div>
          <div className={cn("min-h-16 rounded-xl p-3 text-[15px] surface-2", !voiceText && "text-muted")} aria-live="polite">
            {voiceText ? (
              <>
                {sr.result.transcript} <span className="text-muted">{sr.result.interim}</span>
              </>
            ) : sr.listening ? (
              "Listening… start speaking."
            ) : sr.supported === false ? (
              "Voice input isn't supported in this browser. Use Chrome, Edge or Safari, or type your answer."
            ) : (
              "Tap the microphone and speak. Your words will appear here."
            )}
          </div>
          {sr.error && (
            <p className="mt-2 flex items-start gap-2 rounded-lg bg-amber-500/10 p-2 text-sm text-amber-700 dark:text-amber-300" role="alert">
              <Info size={16} className="mt-0.5 shrink-0" /> {sr.error}
            </p>
          )}
          {tooShort ? <p className="mt-2 text-sm text-amber-600">Try to speak for at least {minSeconds} seconds for a reliable score (you can continue).</p> : null}
          <div className="mt-3 flex flex-wrap items-center gap-2">
            {sr.listening ? (
              <button onClick={stopVoice} className="btn pulse-ring h-12 w-12 rounded-full bg-red-500 p-0 text-white" aria-label="Stop recording">
                <Square size={18} />
              </button>
            ) : (
              <button
                onClick={() => (sr.result.transcript ? sr.start({ append: true }) : startVoice())}
                disabled={disabled || sr.supported === false || sr.status === "denied"}
                className="btn h-12 w-12 rounded-full bg-red-500 p-0 text-white hover:bg-red-600"
                aria-label={sr.result.transcript ? "Continue speaking" : "Start speaking"}
              >
                {sr.status === "denied" ? <MicOff size={20} /> : <Mic size={20} />}
              </button>
            )}
            <span className="font-mono text-sm tabular-nums text-muted" aria-label="Elapsed time">
              {mmss(sr.listening ? elapsed : sr.result.durationSec)}
              {maxSeconds ? ` / ${mmss(maxSeconds)}` : ""}
            </span>
            {sr.result.transcript && !sr.listening && (
              <button onClick={() => { sr.reset(); setElapsed(0); setAudioUrl(null); }} className="btn btn-ghost text-sm" aria-label="Clear and retry">
                <RotateCcw size={16} /> Retry
              </button>
            )}
            {audioUrl && (
              <button onClick={() => new Audio(audioUrl).play()} className="btn btn-ghost text-sm">
                <Play size={16} /> My recording
              </button>
            )}
            <div className="ml-auto flex gap-2">
              <button onClick={() => setMode("text")} className="btn btn-ghost text-sm" aria-label="Switch to typing">
                <Keyboard size={16} /> <span className="hidden sm:inline">Type</span>
              </button>
              <button onClick={submit} disabled={disabled || !sr.result.transcript || sr.listening} className="btn btn-primary">
                <Send size={16} /> {submitLabel}
              </button>
            </div>
          </div>
        </div>
      ) : (
        <div>
          <textarea
            className="input min-h-28 resize-y text-[15px]"
            placeholder={placeholder}
            value={text}
            disabled={disabled}
            onChange={(e) => {
              if (!typedStart) setTypedStart(Date.now());
              setText(e.target.value);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) submit();
            }}
            aria-label="Your answer"
          />
          <div className="mt-2 flex items-center gap-2">
            {sr.supported !== false && (
              <button onClick={() => setMode("voice")} className="btn btn-ghost text-sm">
                <Mic size={16} /> Speak instead
              </button>
            )}
            <span className="text-xs text-muted">{text.trim() ? text.trim().split(/\s+/).length : 0} words</span>
            <button onClick={submit} disabled={disabled || !text.trim()} className="btn btn-primary ml-auto">
              <Send size={16} /> {submitLabel}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

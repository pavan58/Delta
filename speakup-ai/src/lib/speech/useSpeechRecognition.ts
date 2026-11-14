"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { collapseRepeats, joinWithOverlap, mergeSession } from "./transcript";
import { cancelSpeech } from "./useSpeechSynthesis";

/* Minimal typings for the Web Speech API (not in lib.dom for all TS versions). */
interface SRAlternative { transcript: string; confidence: number }
interface SRResult { isFinal: boolean; length: number; [i: number]: SRAlternative }
interface SREvent { resultIndex: number; results: { length: number; [i: number]: SRResult } }
interface SRErrorEvent { error: string; message?: string }
interface SR {
  lang: string; continuous: boolean; interimResults: boolean; maxAlternatives: number;
  start(): void; stop(): void; abort(): void;
  onresult: ((e: SREvent) => void) | null;
  onerror: ((e: SRErrorEvent) => void) | null;
  onend: (() => void) | null;
  onstart: (() => void) | null;
}
type SRCtor = new () => SR;

export function getRecognitionCtor(): SRCtor | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as { SpeechRecognition?: SRCtor; webkitSpeechRecognition?: SRCtor };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

export type RecognitionStatus = "idle" | "listening" | "unsupported" | "denied" | "error";

export const RECOGNITION_ERRORS: Record<string, string> = {
  "not-allowed": "Microphone permission was blocked. Click the lock icon in your browser's address bar, allow the microphone, then try again.",
  "service-not-allowed": "Your browser's speech service is not available here. You can type your answer instead.",
  "no-speech": "We didn't hear anything. Check your microphone and speak a little louder.",
  "audio-capture": "No microphone was found. Connect a microphone or type your answer.",
  network: "The browser's speech service needs an internet connection. Check your connection or type your answer.",
  aborted: "",
  "language-not-supported": "This language/accent setting is not supported. Change it in Settings.",
};

export interface RecognitionResult {
  transcript: string;
  interim: string;
  /** Mean confidence of final segments (0..1) when the browser provides it. */
  confidence: number | null;
  durationSec: number;
}

/**
 * Wraps browser speech recognition. Some browsers (e.g. Chrome) send audio to
 * their own cloud speech service; this is disclosed in the UI.
 */
export function useSpeechRecognition(lang = "en-IN") {
  const [supported, setSupported] = useState<boolean | null>(null);
  const [status, setStatus] = useState<RecognitionStatus>("idle");
  const [error, setError] = useState("");
  const [result, setResult] = useState<RecognitionResult>({ transcript: "", interim: "", confidence: null, durationSec: 0 });
  const recRef = useRef<SR | null>(null);
  /** Text committed by earlier recognition sessions (Chrome restarts after silences). */
  const finalRef = useRef("");
  const confRef = useRef<number[]>([]);
  /** Final text and confidences of the CURRENT session, rebuilt on every result event. */
  const sessionRef = useRef<{ final: string; confidences: number[] }>({ final: "", confidences: [] });
  const startRef = useRef(0);
  const wantRef = useRef(false);
  const elapsedRef = useRef(0);

  useEffect(() => {
    const ok = !!getRecognitionCtor();
    setSupported(ok);
    if (!ok) setStatus("unsupported");
  }, []);

  const stop = useCallback(() => {
    wantRef.current = false;
    recRef.current?.stop();
  }, []);

  const reset = useCallback(() => {
    finalRef.current = "";
    confRef.current = [];
    sessionRef.current = { final: "", confidences: [] };
    elapsedRef.current = 0;
    setResult({ transcript: "", interim: "", confidence: null, durationSec: 0 });
    setError("");
  }, []);

  const start = useCallback(
    (opts: { append?: boolean } = {}) => {
      const Ctor = getRecognitionCtor();
      if (!Ctor) {
        setStatus("unsupported");
        return;
      }
      if (!opts.append) {
        finalRef.current = "";
        confRef.current = [];
        elapsedRef.current = 0;
      }
      sessionRef.current = { final: "", confidences: [] };
      // Stop the teacher's voice first, otherwise the microphone transcribes it as if you said it.
      cancelSpeech();
      setError("");
      const rec = new Ctor();
      rec.lang = lang;
      rec.continuous = true;
      rec.interimResults = true;
      rec.maxAlternatives = 1;
      rec.onstart = () => {
        startRef.current = performance.now();
        setStatus("listening");
      };
      rec.onresult = (e) => {
        // Rebuild this session from ALL results (not just from resultIndex) so cumulative or
        // duplicated results from some browsers never repeat the sentence.
        const raw = [];
        for (let i = 0; i < e.results.length; i++) raw.push({ final: e.results[i].isFinal, text: e.results[i][0].transcript, confidence: e.results[i][0].confidence });
        const merged = mergeSession(raw);
        sessionRef.current = { final: merged.final, confidences: merged.confidences };
        const transcript = collapseRepeats(joinWithOverlap(finalRef.current, merged.final));
        const confs = [...confRef.current, ...merged.confidences];
        const conf = confs.length ? confs.reduce((a, b) => a + b, 0) / confs.length : null;
        setResult({ transcript, interim: merged.interim, confidence: conf, durationSec: elapsedRef.current + (performance.now() - startRef.current) / 1000 });
      };
      rec.onerror = (e) => {
        if (e.error === "not-allowed" || e.error === "service-not-allowed") {
          wantRef.current = false;
          setStatus("denied");
        } else if (e.error !== "no-speech" && e.error !== "aborted") {
          setStatus("error");
        }
        const msg = RECOGNITION_ERRORS[e.error] ?? `Speech recognition error: ${e.error}`;
        if (msg) setError(msg);
      };
      rec.onend = () => {
        elapsedRef.current += (performance.now() - startRef.current) / 1000;
        // Commit this session's text before Chrome restarts listening.
        finalRef.current = collapseRepeats(joinWithOverlap(finalRef.current, sessionRef.current.final));
        confRef.current = [...confRef.current, ...sessionRef.current.confidences];
        sessionRef.current = { final: "", confidences: [] };
        // Chrome stops after silence; restart while the learner still wants to talk.
        if (wantRef.current) {
          try {
            startRef.current = performance.now();
            rec.start();
            return;
          } catch {
            /* fall through */
          }
        }
        setStatus((s) => (s === "listening" ? "idle" : s));
        setResult((r) => ({ ...r, interim: "", durationSec: elapsedRef.current }));
      };
      recRef.current = rec;
      wantRef.current = true;
      try {
        rec.start();
      } catch {
        setStatus("error");
        setError("Could not start the microphone. Please try again.");
      }
    },
    [lang],
  );

  useEffect(() => () => {
    wantRef.current = false;
    recRef.current?.abort();
  }, []);

  return { supported, status, error, result, start, stop, reset, listening: status === "listening" };
}

"use client";
import { useCallback, useEffect, useState } from "react";

export function synthesisSupported() {
  return typeof window !== "undefined" && "speechSynthesis" in window;
}

let session = 0;

/** Splits text into sentence-sized chunks: Chrome cuts off utterances longer than ~15 seconds. */
export function chunkForSpeech(text: string): string[] {
  const clean = text.replace(/[*_#>`]/g, "").replace(/\s+/g, " ").trim();
  const parts = clean.match(/[^.!?\n]+[.!?]*/g) ?? [clean];
  const out: string[] = [];
  for (const p of parts.map((x) => x.trim()).filter(Boolean)) {
    if (out.length && (out[out.length - 1] + " " + p).length < 160) out[out.length - 1] += " " + p;
    else out.push(p);
  }
  return out;
}

/**
 * Speaks text sentence by sentence and calls onEnd exactly once. A timer per chunk covers
 * browsers (notably Android Chrome) that sometimes never fire the utterance 'end' event.
 */
export function speakChunks(text: string, opts: { rate?: number; voiceURI?: string; voice?: "any" | "female" | "male"; onStart?: () => void; onEnd?: () => void }) {
  if (!synthesisSupported()) {
    opts.onEnd?.();
    return () => {};
  }
  const synth = window.speechSynthesis;
  synth.cancel();
  const my = ++session;
  const chunks = chunkForSpeech(text);
  const rate = opts.rate ?? 1;
  const v = pickVoice(synth.getVoices(), opts.voiceURI, opts.voice);
  let finished = false;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const finish = () => {
    if (finished || my !== session) return;
    finished = true;
    clearTimeout(timer);
    opts.onEnd?.();
  };
  const play = (i: number) => {
    if (my !== session) return;
    if (i >= chunks.length) return finish();
    const u = new SpeechSynthesisUtterance(chunks[i]);
    if (v) u.voice = v;
    u.lang = v?.lang ?? "en-IN";
    u.rate = rate;
    let next = false;
    const go = () => {
      if (next) return;
      next = true;
      clearTimeout(timer);
      play(i + 1);
    };
    u.onstart = () => i === 0 && opts.onStart?.();
    u.onend = go;
    u.onerror = go;
    // Fallback: ~2.6 words/sec at rate 1, plus margin.
    const secs = chunks[i].split(/\s+/).length / (2.2 * rate) + 3;
    clearTimeout(timer);
    timer = setTimeout(go, secs * 1000);
    synth.speak(u);
  };
  play(0);
  return () => {
    session++;
    clearTimeout(timer);
    synth.cancel();
  };
}

/** Stops any speech, including the remaining sentences of a chunked message. */
export function cancelSpeech() {
  session++;
  if (synthesisSupported()) window.speechSynthesis.cancel();
}

export function pickVoice(voices: SpeechSynthesisVoice[], preferredURI?: string, accent: "any" | "female" | "male" = "any") {
  if (preferredURI) {
    const v = voices.find((x) => x.voiceURI === preferredURI);
    if (v) return v;
  }
  const en = voices.filter((v) => v.lang.toLowerCase().startsWith("en"));
  const order = ["en-in", "en-gb", "en-us", "en-au"];
  const sorted = [...en].sort((a, b) => {
    const ia = order.indexOf(a.lang.toLowerCase());
    const ib = order.indexOf(b.lang.toLowerCase());
    return (ia === -1 ? 9 : ia) - (ib === -1 ? 9 : ib) || Number(b.localService) - Number(a.localService);
  });
  if (accent !== "any") {
    const hint = accent === "female" ? /female|zira|samantha|heera|veena|susan|serena|karen|moira|tessa|libby|sonia/i : /male|david|daniel|ravi|rishi|george|alex|fred|ryan|guy/i;
    const v = sorted.find((x) => hint.test(x.name) && !(accent === "male" && /female/i.test(x.name)));
    if (v) return v;
  }
  return sorted[0] ?? voices[0];
}

/** Text-to-speech with the browser's built-in voices (free, offline on many devices). */
export function useSpeechSynthesis() {
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [speaking, setSpeaking] = useState(false);
  const [supported, setSupported] = useState(false);

  useEffect(() => {
    if (!synthesisSupported()) return;
    setSupported(true);
    const load = () => setVoices(window.speechSynthesis.getVoices());
    load();
    window.speechSynthesis.addEventListener("voiceschanged", load);
    return () => {
      window.speechSynthesis.removeEventListener("voiceschanged", load);
      window.speechSynthesis.cancel();
    };
  }, []);

  const speak = useCallback(
    (text: string, opts: { rate?: number; voiceURI?: string; voice?: "any" | "female" | "male"; onEnd?: () => void } = {}) => {
      if (!synthesisSupported() || !text) {
        opts.onEnd?.();
        return;
      }
      speakChunks(text, {
        rate: opts.rate,
        voiceURI: opts.voiceURI,
        voice: opts.voice,
        onStart: () => setSpeaking(true),
        onEnd: () => {
          setSpeaking(false);
          opts.onEnd?.();
        },
      });
    },
    [],
  );

  const cancel = useCallback(() => {
    cancelSpeech();
    setSpeaking(false);
  }, []);

  return { supported, voices: voices.filter((v) => v.lang.toLowerCase().startsWith("en")), speaking, speak, cancel };
}

/** Speaks a sequence of lines (e.g. a listening dialogue) with alternating voices. */
export function speakSequence(
  lines: Array<{ speaker: string; text: string }>,
  opts: { rate?: number; onLine?: (i: number) => void; onDone?: () => void; voiceMap?: Record<string, "female" | "male" | "any"> },
) {
  if (!synthesisSupported()) {
    opts.onDone?.();
    return () => {};
  }
  const synth = window.speechSynthesis;
  synth.cancel();
  let cancelled = false;
  const voices = synth.getVoices();
  lines.forEach((line, i) => {
    const u = new SpeechSynthesisUtterance(line.text);
    const v = pickVoice(voices, undefined, opts.voiceMap?.[line.speaker] ?? "any");
    if (v) u.voice = v;
    u.lang = v?.lang ?? "en-GB";
    u.rate = opts.rate ?? 0.95;
    u.pitch = opts.voiceMap?.[line.speaker] === "male" ? 0.9 : opts.voiceMap?.[line.speaker] === "female" ? 1.1 : 1;
    u.onstart = () => !cancelled && opts.onLine?.(i);
    if (i === lines.length - 1) u.onend = () => !cancelled && opts.onDone?.();
    synth.speak(u);
  });
  return () => {
    cancelled = true;
    synth.cancel();
  };
}

"use client";
import { useCallback, useEffect, useState } from "react";

export function synthesisSupported() {
  return typeof window !== "undefined" && "speechSynthesis" in window;
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
      window.speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(text.replace(/[*_#>`]/g, ""));
      const v = pickVoice(window.speechSynthesis.getVoices(), opts.voiceURI, opts.voice);
      if (v) u.voice = v;
      u.lang = v?.lang ?? "en-IN";
      u.rate = opts.rate ?? 1;
      u.onstart = () => setSpeaking(true);
      u.onend = () => {
        setSpeaking(false);
        opts.onEnd?.();
      };
      u.onerror = () => {
        setSpeaking(false);
        opts.onEnd?.();
      };
      window.speechSynthesis.speak(u);
    },
    [],
  );

  const cancel = useCallback(() => {
    if (synthesisSupported()) window.speechSynthesis.cancel();
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

"use client";
import { useCallback, useEffect, useRef, useState } from "react";

/** Countdown timer. Calls onExpire once when it reaches zero. */
export function useCountdown(seconds: number, onExpire?: () => void) {
  const [left, setLeft] = useState(seconds);
  const [running, setRunning] = useState(false);
  const endRef = useRef(0);
  const cb = useRef(onExpire);
  cb.current = onExpire;

  useEffect(() => {
    if (!running) return;
    const t = setInterval(() => {
      const l = Math.max(0, (endRef.current - Date.now()) / 1000);
      setLeft(l);
      if (l <= 0) {
        setRunning(false);
        cb.current?.();
      }
    }, 250);
    return () => clearInterval(t);
  }, [running]);

  const start = useCallback((s?: number) => {
    const secs = s ?? seconds;
    endRef.current = Date.now() + secs * 1000;
    setLeft(secs);
    setRunning(true);
  }, [seconds]);
  const stop = useCallback(() => setRunning(false), []);
  return { left, running, start, stop };
}

"use client";
import { useCallback, useEffect, useRef, useState } from "react";

export async function post<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(path, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  if (!res.ok) {
    let msg = `Request failed (${res.status})`;
    try {
      const j = (await res.json()) as { error?: string };
      if (j.error) msg = j.error;
    } catch {
      /* ignore */
    }
    throw new Error(msg);
  }
  return (await res.json()) as T;
}

/** POST-based data hook with loading / error / reload. `enabled` gates the request. */
export function usePost<T>(path: string, body: unknown, enabled = true) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(enabled);
  const key = JSON.stringify(body);
  const seq = useRef(0);

  const run = useCallback(async () => {
    const id = ++seq.current;
    setLoading(true);
    setError(null);
    try {
      const d = await post<T>(path, JSON.parse(key));
      if (id === seq.current) setData(d);
    } catch (e) {
      if (id === seq.current) setError(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      if (id === seq.current) setLoading(false);
    }
  }, [path, key]);

  useEffect(() => {
    if (enabled) void run();
    else setLoading(false);
  }, [run, enabled]);

  return { data, error, loading, reload: run, setData };
}

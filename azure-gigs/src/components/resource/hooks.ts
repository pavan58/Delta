"use client";
import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/client";

export type ResRow = { id: string; name: string; type: string; resourceGroup: string; location: string; status: string; properties: any; tags: Record<string, string>; createdAt: string; health?: string; armId?: string }; // eslint-disable-line @typescript-eslint/no-explicit-any

export function useResources(types: string[], resourceGroup?: string) {
  const [rows, setRows] = useState<ResRow[] | null>(null);
  const [error, setError] = useState("");
  const key = types.join("|") + (resourceGroup ?? "");
  const load = useCallback(async () => {
    if (!types.length) {
      setRows([]);
      return;
    }
    try {
      const qs = new URLSearchParams();
      types.forEach((t) => qs.append("type", t));
      if (resourceGroup) qs.set("resourceGroup", resourceGroup);
      const r = await api(`/api/resources?${qs.toString()}`);
      setRows(r.resources);
      setError("");
    } catch (e) {
      setError((e as Error).message);
      setRows([]);
    }
  }, [key]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    load();
  }, [load]);
  return { rows, error, reload: load };
}

/** Runs an async action with busy/error/result state. */
export function useAction<T = any>() { // eslint-disable-line @typescript-eslint/no-explicit-any
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<T | null>(null);
  const run = useCallback(async (fn: () => Promise<T>) => {
    setBusy(true);
    setError("");
    try {
      const r = await fn();
      setResult(r);
      return r;
    } catch (e) {
      setError((e as Error).message);
      return null;
    } finally {
      setBusy(false);
    }
  }, []);
  return { busy, error, result, run, setError, setResult };
}

export function action(id: string, name: string, body: unknown = {}) {
  return api(`/api/resources/${id}/actions/${name}`, { body });
}

"use client";
import { useEffect, useRef, useState } from "react";
import { api } from "@/lib/client";
import { Badge, Card, CardHeader } from "./ui/misc";
import { timeAgo } from "@/lib/utils";

type Line = { kind: "in" | "out" | "err" | "meta"; text: string };
type Shell = "az" | "pwsh" | "bash";
const SHELLS: { id: Shell; label: string; hint: string }[] = [
  { id: "az", label: "Azure CLI", hint: "Try: az login → az group create -n rg-demo -l eastus → az group list -o table" },
  { id: "pwsh", label: "Azure PowerShell", hint: "Try: Connect-AzAccount → Get-AzResourceGroup | Format-Table" },
  { id: "bash", label: "Bash", hint: "Linux sandbox with a virtual filesystem; az and kubectl also work here. Try: ls -la; cat notes/runbook.md" },
];

export function Terminal({ compact = false, initialShell = "az" }: { compact?: boolean; initialShell?: Shell }) {
  const [shell, setShell] = useState<Shell>(initialShell);
  const [lines, setLines] = useState<Record<Shell, Line[]>>({ az: [], pwsh: [], bash: [] });
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [prompt, setPrompt] = useState<Record<Shell, string>>({ az: "learner@azuregigs:~$", pwsh: "PS ~>", bash: "learner@azuregigs:~$" });
  const [hist, setHist] = useState<{ id: string; shell: string; command: string; exitCode: number; durationMs: number; createdAt: string; changes: string[] }[]>([]);
  const [hIdx, setHIdx] = useState(-1);
  const [identity, setIdentity] = useState<string | null>(null);
  const out = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const loadHist = () => api("/api/terminal").then((r) => setHist(r.history)).catch(() => undefined);
  useEffect(() => {
    loadHist();
  }, []);
  useEffect(() => {
    out.current?.scrollTo({ top: out.current.scrollHeight });
  }, [lines, shell]);
  const push = (s: Shell, add: Line[]) => setLines((l) => ({ ...l, [s]: [...l[s], ...add].slice(-500) }));
  const run = async (cmd: string) => {
    const s = shell;
    if (cmd.trim() === "clear" || cmd.trim() === "cls") {
      setLines((l) => ({ ...l, [s]: [] }));
      setInput("");
      return;
    }
    push(s, [{ kind: "in", text: `${prompt[s]} ${cmd}` }]);
    setInput("");
    setHIdx(-1);
    if (!cmd.trim()) return;
    setBusy(true);
    try {
      const r = await api("/api/terminal", { body: { shell: s, command: cmd } });
      const add: Line[] = [];
      if (r.stdout && r.stdout !== "\u001bc") add.push({ kind: "out", text: r.stdout });
      if (r.stderr) add.push({ kind: "err", text: r.stderr });
      add.push({ kind: "meta", text: `exit ${r.exitCode} · ${r.durationMs} ms${r.changes.length ? ` · changes: ${r.changes.join("; ")}` : ""}` });
      if (r.stdout === "\u001bc") setLines((l) => ({ ...l, [s]: [] }));
      else push(s, add);
      setPrompt((p) => ({ ...p, [s]: r.prompt }));
      setIdentity(r.identity);
      loadHist();
    } catch (e) {
      push(s, [{ kind: "err", text: (e as Error).message }]);
    } finally {
      setBusy(false);
      inputRef.current?.focus();
    }
  };
  const shellHist = hist.filter((h) => h.shell === shell);
  const onKey = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && !busy) run(input);
    if (e.key === "ArrowUp") {
      e.preventDefault();
      const i = Math.min(hIdx + 1, shellHist.length - 1);
      if (shellHist[i]) { setHIdx(i); setInput(shellHist[i].command); }
    }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      const i = hIdx - 1;
      setHIdx(Math.max(-1, i));
      setInput(i >= 0 ? shellHist[i].command : "");
    }
    if (e.key === "l" && e.ctrlKey) {
      e.preventDefault();
      setLines((l) => ({ ...l, [shell]: [] }));
    }
  };
  return (
    <div className={compact ? "" : "grid gap-4 xl:grid-cols-[1fr_320px]"}>
      <Card className="overflow-hidden">
        <div role="tablist" aria-label="Shell" className="flex flex-wrap items-center gap-1 border-b border-line bg-subtle px-2">
          {SHELLS.map((s) => <button key={s.id} role="tab" aria-selected={shell === s.id} onClick={() => setShell(s.id)} className={`-mb-px border-b-2 px-3 py-2 text-sm ${shell === s.id ? "border-brand font-semibold text-brand" : "border-transparent text-muted"}`}>{s.label}</button>)}
          <span className="ml-auto px-2 text-xs text-muted">{identity ? <>Signed in as <Badge color="amber">{identity}</Badge> (RBAC enforced)</> : "Identity: you (Owner)"}</span>
        </div>
        <div ref={out} onClick={() => inputRef.current?.focus()} className={`overflow-y-auto bg-code p-3 font-mono text-[13px] leading-relaxed text-code-ink ${compact ? "h-72" : "h-[60vh] min-h-80"}`} aria-live="polite" aria-label="Terminal output">
          <p className="text-[#7ea6d6]">Azure Gigs Cloud Shell (simulated) - {SHELLS.find((s) => s.id === shell)!.hint}</p>
          <p className="mb-2 text-[#7ea6d6]">Commands run against your simulated subscription. Nothing is executed on a real server.</p>
          {lines[shell].map((l, i) => (
            <pre key={i} className={`whitespace-pre-wrap break-words ${l.kind === "in" ? "text-[#9be89b]" : l.kind === "err" ? "text-[#ff8a8a]" : l.kind === "meta" ? "text-[11px] text-[#7d8590]" : ""}`}>{l.text}</pre>
          ))}
          <div className="flex gap-2">
            <span className="shrink-0 text-[#9be89b]">{prompt[shell]}</span>
            <label htmlFor="term-input" className="sr-only">Command</label>
            <input id="term-input" ref={inputRef} autoFocus autoComplete="off" spellCheck={false} disabled={busy} value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={onKey} className="min-w-0 flex-1 bg-transparent text-code-ink outline-none" />
            {busy && <span className="text-[#7d8590]">running…</span>}
          </div>
        </div>
      </Card>
      {!compact && (
        <Card>
          <CardHeader title="Command history" subtitle="Exit codes, duration and resource changes" />
          <ul className="max-h-[60vh] divide-y divide-line overflow-y-auto">
            {hist.map((h) => (
              <li key={h.id} className="px-3 py-2">
                <button className="w-full text-left font-mono text-xs text-ink hover:text-brand" onClick={() => { setShell(h.shell === "kql" ? "az" : (h.shell as Shell)); setInput(h.command); inputRef.current?.focus(); }}>{h.command}</button>
                <p className="text-[11px] text-muted"><Badge color={h.exitCode === 0 ? "green" : "red"}>exit {h.exitCode}</Badge> {h.shell} · {h.durationMs} ms · {timeAgo(h.createdAt)}</p>
                {h.changes?.length > 0 && <p className="text-[11px] text-ok">{h.changes.join("; ")}</p>}
              </li>
            ))}
            {!hist.length && <li className="px-3 py-3 text-sm text-muted">No commands yet.</li>}
          </ul>
        </Card>
      )}
    </div>
  );
}

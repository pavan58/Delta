/** Terminal entry point: parses a command line, executes it against the simulator and records history. */
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { badRequest } from "@/lib/errors";
import type { Ctx } from "@/lib/sim/engine";
import { runAz } from "./az";
import { BASH } from "./bash";
import { runKubectl } from "./kubectl";
import { runPwsh } from "./pwsh";
import { splitTopLevel, tokenize } from "./parse";
import { CliError, CmdResult, defaultState, ShellState, Term } from "./types";
import { resolvePath, writeFile } from "./vfs";

export type Shell = "az" | "pwsh" | "bash";
export type TerminalResult = { stdout: string; stderr: string; exitCode: number; durationMs: number; changes: string[]; cwd: string; prompt: string; identity: string | null };

const MAX_LINE = 4000;

function expandVars(s: string, env: Record<string, string>) {
  return s.replace(/\$\{?([A-Za-z_][A-Za-z0-9_]*)\}?/g, (m, k) => (k in env ? env[k] : m.startsWith("${") ? "" : m));
}

async function runSimple(t: Term, shell: Shell, segment: string, stdin: string | null): Promise<CmdResult> {
  // Output redirection: cmd > file / cmd >> file
  let redirect: { path: string; append: boolean } | null = null;
  const r = /\s(>>?)\s*([^\s>]+)\s*$/.exec(" " + segment);
  if (r && !/["'][^"']*>[^"']*["']/.test(segment.slice(segment.lastIndexOf(r[1])))) {
    redirect = { path: r[2], append: r[1] === ">>" };
    segment = (" " + segment).slice(0, r.index).trim();
  }
  const tokens = tokenize(shell === "bash" ? expandVars(segment, t.state.env) : segment);
  if (!tokens.length) return { stdout: "" };
  const [cmd, ...args] = tokens;
  let res: CmdResult;
  // Variable assignment: FOO=bar
  if (shell === "bash" && /^[A-Za-z_][A-Za-z0-9_]*=/.test(cmd) && !args.length) {
    const i = cmd.indexOf("=");
    t.state.env[cmd.slice(0, i)] = cmd.slice(i + 1);
    res = { stdout: "" };
  } else if (cmd === "az") res = await runAz(t, args);
  else if (cmd === "kubectl" || cmd === "k") res = await runKubectl(t, args);
  else if (BASH[cmd] && (shell === "bash" || stdin !== null || ["grep", "head", "tail", "wc", "sort", "uniq", "clear", "echo", "cat", "ls", "pwd", "cd", "help"].includes(cmd))) {
    try {
      res = await BASH[cmd](t, args, stdin);
    } catch (e) {
      if (e instanceof CliError) res = { stdout: "", stderr: `${cmd}: ${e.message.replace(new RegExp(`^${cmd}: `), "")}`, exitCode: e.exitCode };
      else throw e;
    }
  } else if (shell === "az") res = { stdout: "", stderr: `'${cmd}' is not an Azure CLI command. This terminal runs 'az' and 'kubectl' commands (plus pipes to grep/head/tail/wc). Switch to the Bash tab for Linux commands.`, exitCode: 127 };
  else res = { stdout: "", stderr: `bash: ${cmd}: command not found`, exitCode: 127 };
  if (redirect) {
    try {
      writeFile(t.state, resolvePath(t.state, redirect.path), res.stdout + (res.stdout ? "\n" : ""), redirect.append);
      t.changes.push(`Wrote ${redirect.path}`);
      return { ...res, stdout: "" };
    } catch (e) {
      if (e instanceof CliError) return { stdout: "", stderr: `bash: ${e.message}`, exitCode: 1 };
      throw e;
    }
  }
  return res;
}

async function runPipeline(t: Term, shell: Shell, line: string): Promise<CmdResult> {
  const { parts } = splitTopLevel(line, ["|"]);
  let stdin: string | null = null;
  let last: CmdResult = { stdout: "" };
  let stderr = "";
  for (const part of parts) {
    if (!part) return { stdout: "", stderr: "bash: syntax error near unexpected token `|'", exitCode: 2 };
    last = await runSimple(t, shell, part, stdin);
    if (last.stderr) stderr += (stderr ? "\n" : "") + last.stderr;
    stdin = last.stdout;
  }
  return { ...last, stderr };
}

export async function execute(t: Term, shell: Shell, line: string): Promise<CmdResult> {
  if (shell === "pwsh") return runPwsh(t, line);
  const { parts, seps } = splitTopLevel(line, ["&&", "||", ";"]);
  const out: string[] = [];
  const err: string[] = [];
  let code = 0;
  for (let i = 0; i < parts.length; i++) {
    if (i > 0) {
      const sep = seps[i - 1];
      if (sep === "&&" && code !== 0) continue;
      if (sep === "||" && code === 0) continue;
    }
    if (!parts[i]) continue;
    const r = await runPipeline(t, shell, parts[i]);
    if (r.stdout) out.push(r.stdout);
    if (r.stderr) err.push(r.stderr);
    code = r.exitCode ?? 0;
  }
  return { stdout: out.join("\n"), stderr: err.join("\n"), exitCode: code };
}

export function loadState(raw: unknown): ShellState {
  const d = defaultState();
  if (!raw || typeof raw !== "object" || !("fs" in raw)) return d;
  const s = raw as ShellState;
  return { ...d, ...s, az: { ...d.az, ...(s.az ?? {}) }, env: { ...d.env, ...(s.env ?? {}) }, services: { ...d.services, ...(s.services ?? {}) } };
}

export async function runTerminal(ctx: Ctx, shell: Shell, command: string): Promise<TerminalResult> {
  if (!["az", "pwsh", "bash"].includes(shell)) throw badRequest("InvalidShell", "shell must be az, pwsh or bash");
  const line = command.trim();
  if (line.length > MAX_LINE) throw badRequest("CommandTooLong", `Commands are limited to ${MAX_LINE} characters.`);
  const user = await prisma.user.findUniqueOrThrow({ where: { id: ctx.userId } });
  const sub = await prisma.subscription.findFirstOrThrow({ where: { userId: ctx.userId }, orderBy: { createdAt: "asc" } });
  const state = loadState(user.shellState);
  const term: Term = { ctx: { ...ctx, source: shell === "pwsh" ? "pwsh" : shell === "az" ? "cli" : "bash" }, state, sub, userName: user.name, changes: [] };
  if (state.az.identity) term.ctx.caller = state.az.identity;
  const started = Date.now();
  let res: CmdResult;
  if (!line) res = { stdout: "" };
  else {
    try {
      res = await execute(term, shell, line);
    } catch (e) {
      console.error("terminal error", e);
      res = { stdout: "", stderr: "Internal simulator error while executing the command.", exitCode: 1 };
    }
  }
  const durationMs = Date.now() - started;
  await prisma.user.update({ where: { id: ctx.userId }, data: { shellState: state as unknown as Prisma.InputJsonValue } });
  if (line) {
    await prisma.commandHistory.create({
      data: { userId: ctx.userId, shell, command: line.slice(0, 4000), stdout: (res.stdout ?? "").slice(0, 20000), stderr: (res.stderr ?? "").slice(0, 8000), exitCode: res.exitCode ?? 0, durationMs, changes: term.changes as Prisma.InputJsonValue },
    });
  }
  return {
    stdout: res.stdout ?? "",
    stderr: res.stderr ?? "",
    exitCode: res.exitCode ?? 0,
    durationMs,
    changes: term.changes,
    cwd: state.cwd,
    prompt: shell === "pwsh" ? `PS ${state.cwd.replace("/home/learner", "~")}>` : `learner@azuregigs:${state.cwd.replace("/home/learner", "~")}$`,
    identity: state.az.identity,
  };
}

/** Per-learner virtual filesystem persisted as JSON (no host filesystem access). */
import { CliError, FsNode, HOME, ShellState } from "./types";

export const MAX_FILES = 300;
export const MAX_FILE_BYTES = 64 * 1024;
export const MAX_TOTAL_BYTES = 1024 * 1024;

export function normalize(path: string): string {
  const parts: string[] = [];
  for (const seg of path.split("/")) {
    if (!seg || seg === ".") continue;
    if (seg === "..") parts.pop();
    else parts.push(seg);
  }
  return "/" + parts.join("/");
}

export function resolvePath(s: ShellState, p: string): string {
  if (p === "~") return HOME;
  if (p.startsWith("~/")) return normalize(HOME + p.slice(1));
  return normalize(p.startsWith("/") ? p : `${s.cwd}/${p}`);
}

export const parentOf = (p: string) => (p === "/" ? "/" : normalize(p + "/.."));
export const baseName = (p: string) => p.split("/").filter(Boolean).pop() ?? "/";

export function node(s: ShellState, p: string): FsNode | undefined {
  return s.fs[p];
}

export function readFile(s: ShellState, p: string): string {
  const n = s.fs[p];
  if (!n) throw new CliError(`${p}: No such file or directory`);
  if (n.type === "dir") throw new CliError(`${p}: Is a directory`);
  if (!n.mode.match(/^[4-7]/)) throw new CliError(`${p}: Permission denied`);
  return n.content ?? "";
}

function totalBytes(s: ShellState) {
  return Object.values(s.fs).reduce((a, n) => a + (n.content?.length ?? 0), 0);
}

export function writeFile(s: ShellState, p: string, content: string, append = false) {
  const parent = s.fs[parentOf(p)];
  if (!parent || parent.type !== "dir") throw new CliError(`${p}: No such file or directory`);
  if (!p.startsWith(HOME) && !p.startsWith("/tmp")) throw new CliError(`${p}: Permission denied (you can write inside ${HOME} and /tmp)`);
  const existing = s.fs[p];
  if (existing?.type === "dir") throw new CliError(`${p}: Is a directory`);
  const next = append && existing ? (existing.content ?? "") + content : content;
  if (next.length > MAX_FILE_BYTES) throw new CliError(`${p}: File too large (sandbox limit ${MAX_FILE_BYTES / 1024} KB)`);
  if (!existing && Object.keys(s.fs).length >= MAX_FILES) throw new CliError(`No space left on device (sandbox limit of ${MAX_FILES} files)`);
  if (totalBytes(s) - (existing?.content?.length ?? 0) + next.length > MAX_TOTAL_BYTES) throw new CliError("No space left on device (sandbox quota 1 MB)");
  s.fs[p] = { type: "file", content: next, mode: existing?.mode ?? "644", mtime: new Date().toISOString() };
}

export function mkdir(s: ShellState, p: string, parents = false) {
  if (s.fs[p]) {
    if (parents && s.fs[p].type === "dir") return;
    throw new CliError(`cannot create directory '${p}': File exists`);
  }
  if (!p.startsWith(HOME) && !p.startsWith("/tmp")) throw new CliError(`cannot create directory '${p}': Permission denied`);
  const parent = parentOf(p);
  if (!s.fs[parent]) {
    if (!parents) throw new CliError(`cannot create directory '${p}': No such file or directory`);
    mkdir(s, parent, true);
  }
  if (Object.keys(s.fs).length >= MAX_FILES) throw new CliError("No space left on device");
  s.fs[p] = { type: "dir", mode: "755", mtime: new Date().toISOString() };
}

export function children(s: ShellState, dir: string): string[] {
  const prefix = dir === "/" ? "/" : dir + "/";
  return Object.keys(s.fs).filter((k) => k !== dir && k.startsWith(prefix) && !k.slice(prefix.length).includes("/")).sort();
}

export function remove(s: ShellState, p: string, recursive: boolean) {
  const n = s.fs[p];
  if (!n) throw new CliError(`cannot remove '${p}': No such file or directory`);
  if (!p.startsWith(HOME + "/") && !p.startsWith("/tmp/")) throw new CliError(`cannot remove '${p}': Permission denied`);
  if (n.type === "dir") {
    if (!recursive) throw new CliError(`cannot remove '${p}': Is a directory`);
    for (const k of Object.keys(s.fs)) if (k.startsWith(p + "/")) delete s.fs[k];
  }
  delete s.fs[p];
}

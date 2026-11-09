/** Simulated Linux bash. Runs against a per-learner virtual filesystem; never executes host commands. */
import { CliError, CmdResult, HOME, Term } from "./types";
import { baseName, children, mkdir, node, parentOf, readFile, remove, resolvePath, writeFile } from "./vfs";
import { parseArgs } from "./parse";

type Run = (t: Term, args: string[], stdin: string | null) => Promise<CmdResult>;

function grepLines(text: string, pattern: string, flags: Set<string>) {
  let re: RegExp;
  try {
    re = new RegExp(pattern, flags.has("i") ? "i" : "");
  } catch {
    re = new RegExp(pattern.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), flags.has("i") ? "i" : "");
  }
  const lines = text.split("\n").filter((l, i, arr) => !(i === arr.length - 1 && l === ""));
  const out = lines.map((l, i) => ({ l, n: i + 1 })).filter((x) => re.test(x.l) !== flags.has("v"));
  return out;
}

function shortFlags(args: string[]) {
  const f = new Set<string>();
  const rest: string[] = [];
  for (const a of args) {
    if (/^-[A-Za-z]+$/.test(a)) for (const c of a.slice(1)) f.add(c);
    else rest.push(a);
  }
  return { f, rest };
}

const modeStr = (type: string, mode: string) => (type === "dir" ? "d" : "-") + mode.split("").map((d) => { const n = Number(d); return `${n & 4 ? "r" : "-"}${n & 2 ? "w" : "-"}${n & 1 ? "x" : "-"}`; }).join("");

export const BASH: Record<string, Run> = {
  pwd: async (t) => ({ stdout: t.state.cwd }),
  cd: async (t, args) => {
    const target = resolvePath(t.state, args[0] ?? "~");
    const n = node(t.state, target);
    if (!n) throw new CliError(`cd: ${args[0]}: No such file or directory`);
    if (n.type !== "dir") throw new CliError(`cd: ${args[0]}: Not a directory`);
    t.state.cwd = target;
    return { stdout: "" };
  },
  ls: async (t, args) => {
    const { f, rest } = shortFlags(args);
    const targets = rest.length ? rest : ["."];
    const out: string[] = [];
    for (const raw of targets) {
      const p = resolvePath(t.state, raw);
      const n = node(t.state, p);
      if (!n) throw new CliError(`ls: cannot access '${raw}': No such file or directory`);
      const entries = n.type === "dir" ? children(t.state, p) : [p];
      const visible = entries.filter((e) => f.has("a") || !baseName(e).startsWith("."));
      if (targets.length > 1) out.push(`${raw}:`);
      if (f.has("l")) {
        out.push(`total ${visible.length * 4}`);
        if (f.has("a") && n.type === "dir") out.push(`drwxr-xr-x 2 learner learner 4096 ${new Date().toDateString().slice(4, 10)} .`, `drwxr-xr-x 3 learner learner 4096 ${new Date().toDateString().slice(4, 10)} ..`);
        for (const e of visible) { const x = t.state.fs[e]; out.push(`${modeStr(x.type, x.mode)} 1 learner learner ${String(x.type === "dir" ? 4096 : x.content?.length ?? 0).padStart(5)} ${new Date(x.mtime).toDateString().slice(4, 10)} ${baseName(e)}${x.type === "dir" && f.has("F") ? "/" : ""}`); }
      } else out.push(visible.map((e) => baseName(e) + (t.state.fs[e].type === "dir" ? "/" : "")).join("  "));
    }
    return { stdout: out.join("\n") };
  },
  mkdir: async (t, args) => { const { f, rest } = shortFlags(args); if (!rest.length) throw new CliError("mkdir: missing operand"); for (const d of rest) mkdir(t.state, resolvePath(t.state, d), f.has("p")); return { stdout: "" }; },
  touch: async (t, args) => { if (!args.length) throw new CliError("touch: missing file operand"); for (const a of args) { const p = resolvePath(t.state, a); const n = node(t.state, p); if (n) n.mtime = new Date().toISOString(); else writeFile(t.state, p, ""); } return { stdout: "" }; },
  cat: async (t, args, stdin) => ({ stdout: args.length ? args.map((a) => readFile(t.state, resolvePath(t.state, a))).join("") .replace(/\n$/, "") : (stdin ?? "") }),
  echo: async (_t, args) => ({ stdout: args.filter((a) => a !== "-n" && a !== "-e").join(" ") }),
  rm: async (t, args) => { const { f, rest } = shortFlags(args); if (!rest.length) throw new CliError("rm: missing operand"); for (const a of rest) { try { remove(t.state, resolvePath(t.state, a), f.has("r") || f.has("R")); } catch (e) { if (!f.has("f")) throw e; } } return { stdout: "" }; },
  rmdir: async (t, args) => { for (const a of args) { const p = resolvePath(t.state, a); if (children(t.state, p).length) throw new CliError(`rmdir: failed to remove '${a}': Directory not empty`); remove(t.state, p, true); } return { stdout: "" }; },
  cp: async (t, args) => {
    const { f, rest } = shortFlags(args);
    if (rest.length < 2) throw new CliError("cp: missing destination file operand");
    const src = resolvePath(t.state, rest[0]);
    let dst = resolvePath(t.state, rest[1]);
    if (node(t.state, dst)?.type === "dir") dst = `${dst}/${baseName(src)}`;
    const n = node(t.state, src);
    if (n?.type === "dir") {
      if (!f.has("r")) throw new CliError(`cp: -r not specified; omitting directory '${rest[0]}'`);
      mkdir(t.state, dst, true);
      for (const k of Object.keys(t.state.fs).filter((k) => k.startsWith(src + "/")).sort()) { const target = dst + k.slice(src.length); if (t.state.fs[k].type === "dir") mkdir(t.state, target, true); else writeFile(t.state, target, t.state.fs[k].content ?? ""); }
    } else writeFile(t.state, dst, readFile(t.state, src));
    return { stdout: "" };
  },
  mv: async (t, args) => {
    if (args.length < 2) throw new CliError("mv: missing destination file operand");
    const src = resolvePath(t.state, args[0]);
    let dst = resolvePath(t.state, args[1]);
    if (node(t.state, dst)?.type === "dir") dst = `${dst}/${baseName(src)}`;
    const n = node(t.state, src);
    if (!n) throw new CliError(`mv: cannot stat '${args[0]}': No such file or directory`);
    if (!node(t.state, parentOf(dst))) throw new CliError(`mv: cannot move to '${args[1]}': No such file or directory`);
    for (const k of Object.keys(t.state.fs).filter((k) => k === src || k.startsWith(src + "/"))) { t.state.fs[dst + k.slice(src.length)] = t.state.fs[k]; delete t.state.fs[k]; }
    return { stdout: "" };
  },
  grep: async (t, args, stdin) => {
    const { f, rest } = shortFlags(args);
    const [pattern, ...files] = rest;
    if (pattern === undefined) throw new CliError("Usage: grep [OPTION]... PATTERNS [FILE]...");
    const sources = files.length ? files.map((fn) => ({ fn, text: readFile(t.state, resolvePath(t.state, fn)) })) : [{ fn: "", text: stdin ?? "" }];
    const out: string[] = [];
    let total = 0;
    for (const s of sources) {
      const m = grepLines(s.text, pattern, f);
      total += m.length;
      if (f.has("c")) out.push(`${files.length > 1 ? s.fn + ":" : ""}${m.length}`);
      else if (f.has("l")) { if (m.length) out.push(s.fn); }
      else out.push(...m.map((x) => `${files.length > 1 ? s.fn + ":" : ""}${f.has("n") ? x.n + ":" : ""}${x.l}`));
    }
    return { stdout: out.join("\n"), exitCode: total || f.has("c") ? 0 : 1 };
  },
  head: async (t, args, stdin) => { const p = parseArgs(args, { n: "lines" }); const n = Number(p.flags.lines?.[0] ?? 10); const text = p.positional[0] ? readFile(t.state, resolvePath(t.state, p.positional[0])) : stdin ?? ""; return { stdout: text.split("\n").slice(0, n).join("\n") }; },
  tail: async (t, args, stdin) => { const p = parseArgs(args, { n: "lines" }); const n = Number(p.flags.lines?.[0] ?? 10); const text = (p.positional[0] ? readFile(t.state, resolvePath(t.state, p.positional[0])) : stdin ?? "").replace(/\n$/, ""); return { stdout: text.split("\n").slice(-n).join("\n") }; },
  wc: async (t, args, stdin) => { const { f, rest } = shortFlags(args); const text = rest[0] ? readFile(t.state, resolvePath(t.state, rest[0])) : stdin ?? ""; const lines = text ? text.replace(/\n$/, "").split("\n").length : 0; const words = text.split(/\s+/).filter(Boolean).length; if (f.has("l")) return { stdout: `${lines}${rest[0] ? " " + rest[0] : ""}` }; if (f.has("w")) return { stdout: String(words) }; if (f.has("c")) return { stdout: String(text.length) }; return { stdout: `${lines} ${words} ${text.length}${rest[0] ? " " + rest[0] : ""}` }; },
  sort: async (_t, args, stdin) => { const { f } = shortFlags(args); const lines = (stdin ?? "").split("\n").filter(Boolean).sort((a, b) => (f.has("n") ? Number(a) - Number(b) : a.localeCompare(b))); return { stdout: (f.has("r") ? lines.reverse() : lines).join("\n") }; },
  uniq: async (_t, _a, stdin) => ({ stdout: (stdin ?? "").split("\n").filter((l, i, a) => l !== a[i - 1]).join("\n") }),
  chmod: async (t, args) => {
    const [mode, ...files] = args;
    if (!mode || !files.length) throw new CliError("chmod: missing operand");
    for (const fn of files) {
      const p = resolvePath(t.state, fn);
      const n = node(t.state, p);
      if (!n) throw new CliError(`chmod: cannot access '${fn}': No such file or directory`);
      if (/^[0-7]{3}$/.test(mode)) n.mode = mode;
      else if (/^[ugoa]*[+-][rwx]+$/.test(mode)) {
        const [who, perms] = mode.split(/[+-]/);
        const add = mode.includes("+");
        const bits = (perms.includes("r") ? 4 : 0) + (perms.includes("w") ? 2 : 0) + (perms.includes("x") ? 1 : 0);
        const targets = !who || who.includes("a") ? [0, 1, 2] : [who.includes("u") ? 0 : -1, who.includes("g") ? 1 : -1, who.includes("o") ? 2 : -1].filter((x) => x >= 0);
        n.mode = n.mode.split("").map((d, i) => (targets.includes(i) ? String(add ? Number(d) | bits : Number(d) & ~bits) : d)).join("");
      } else throw new CliError(`chmod: invalid mode: '${mode}'`);
    }
    return { stdout: "" };
  },
  whoami: async () => ({ stdout: "learner" }),
  hostname: async () => ({ stdout: "learner-sandbox" }),
  uname: async (_t, args) => ({ stdout: args.includes("-a") ? "Linux learner-sandbox 6.8.0-azure-gigs #1 SMP x86_64 GNU/Linux" : "Linux" }),
  date: async () => ({ stdout: new Date().toUTCString() }),
  uptime: async () => ({ stdout: ` ${new Date().toTimeString().slice(0, 8)} up 3 days,  2:14,  1 user,  load average: 0.08, 0.05, 0.01` }),
  id: async () => ({ stdout: "uid=1000(learner) gid=1000(learner) groups=1000(learner),27(sudo)" }),
  env: async (t) => ({ stdout: Object.entries(t.state.env).map(([k, v]) => `${k}=${v}`).join("\n") }),
  export: async (t, args) => { for (const a of args) { const i = a.indexOf("="); if (i > 0) t.state.env[a.slice(0, i)] = a.slice(i + 1); } return { stdout: "" }; },
  which: async (_t, args) => ({ stdout: args.map((a) => (BASH[a] || ["az", "kubectl"].includes(a) ? `/usr/bin/${a}` : "")).filter(Boolean).join("\n"), exitCode: args.every((a) => BASH[a] || ["az", "kubectl"].includes(a)) ? 0 : 1 }),
  ps: async (t) => ({ stdout: ["  PID TTY          TIME CMD", "    1 ?        00:00:02 systemd", ...Object.entries(t.state.services).filter(([, s]) => s === "running").map(([n], i) => `  ${String(300 + i * 41).padStart(3)} ?        00:00:00 ${n === "ssh" ? "sshd" : n === "docker" ? "dockerd" : n}`), " 1201 pts/0    00:00:00 bash", " 1388 pts/0    00:00:00 ps"].join("\n") }),
  top: async (t) => ({ stdout: [`top - ${new Date().toTimeString().slice(0, 8)} up 3 days,  1 user,  load average: 0.08, 0.05, 0.01`, "Tasks:  42 total,   1 running,  41 sleeping", "%Cpu(s):  2.1 us,  0.7 sy,  0.0 ni, 97.0 id", "MiB Mem :   3911.2 total,   2604.4 free,    611.9 used", "", "  PID USER      %CPU %MEM COMMAND", ...Object.entries(t.state.services).filter(([, s]) => s === "running").map(([n], i) => `  ${300 + i * 41} root       0.3  1.2 ${n}`), " 1201 learner    0.0  0.1 bash", "(snapshot - interactive top is not available in the web terminal)"].join("\n") }),
  df: async (t, args) => { const used = Object.values(t.state.fs).reduce((a, n) => a + (n.content?.length ?? 0), 0); const h = args.includes("-h"); return { stdout: ["Filesystem      Size  Used Avail Use% Mounted on", `/dev/root      ${h ? " 30G" : "31457280"}  ${h ? "4.2G" : "4404019"}  ${h ? " 26G" : "27053261"}  14% /`, `learnerfs      ${h ? " 1.0M" : "1024"}  ${h ? Math.ceil(used / 1024) + "K" : Math.ceil(used / 1024)}  ${h ? Math.max(0, 1024 - Math.ceil(used / 1024)) + "K" : 1024 - Math.ceil(used / 1024)}  ${Math.round((used / (1024 * 1024)) * 100)}% ${HOME}`, `tmpfs          ${h ? "1.9G" : "2002400"}     0  ${h ? "1.9G" : "2002400"}   0% /dev/shm`].join("\n") }; },
  free: async (_t, args) => ({ stdout: args.includes("-h") ? "               total        used        free      shared  buff/cache   available\nMem:           3.8Gi       611Mi       2.5Gi       1.0Mi       717Mi       3.0Gi\nSwap:             0B          0B          0B" : "               total        used        free      shared  buff/cache   available\nMem:         4005060      626588     2666906        1024      734542     3132112\nSwap:              0           0           0" }),
  systemctl: async (t, args) => {
    const [verb, unit] = args;
    const svc = unit?.replace(/\.service$/, "");
    if (verb === "list-units" || !verb) return { stdout: ["UNIT                LOAD   ACTIVE SUB     DESCRIPTION", ...Object.entries(t.state.services).map(([n, s]) => `${(n + ".service").padEnd(20)}loaded ${s === "running" ? "active  running" : "inactive dead   "} ${n}`)].join("\n") };
    if (!svc) throw new CliError(`Too few arguments.`);
    if (!(svc in t.state.services)) {
      if (verb === "status") return { stdout: "", stderr: `Unit ${svc}.service could not be found.`, exitCode: 4 };
      throw new CliError(`Failed to ${verb} ${svc}.service: Unit ${svc}.service not found.`, 5);
    }
    switch (verb) {
      case "status": { const s = t.state.services[svc]; return { stdout: `● ${svc}.service - ${svc}\n     Loaded: loaded (/lib/systemd/system/${svc}.service; enabled)\n     Active: ${s === "running" ? "active (running)" : "inactive (dead)"} since ${new Date().toUTCString()}`, exitCode: s === "running" ? 0 : 3 }; }
      case "start": case "restart": case "reload": t.state.services[svc] = "running"; t.changes.push(`Started ${svc} in sandbox`); return { stdout: "" };
      case "stop": t.state.services[svc] = "stopped"; t.changes.push(`Stopped ${svc} in sandbox`); return { stdout: "" };
      case "enable": case "disable": return { stdout: `${verb === "enable" ? "Created symlink" : "Removed"} /etc/systemd/system/multi-user.target.wants/${svc}.service.` };
      case "is-active": return { stdout: t.state.services[svc] === "running" ? "active" : "inactive", exitCode: t.state.services[svc] === "running" ? 0 : 3 };
    }
    throw new CliError(`Unknown command verb ${verb}.`);
  },
  apt: async (t, args) => BASH["apt-get"](t, args, null),
  "apt-get": async (t, args) => {
    if (args[0] === "install") { const pkg = args.filter((a) => !a.startsWith("-"))[1]; if (!pkg) throw new CliError("E: No packages specified"); if (pkg === "nginx") t.state.services.nginx = "running"; return { stdout: `Reading package lists... Done\nBuilding dependency tree... Done\nSetting up ${pkg} ...\n(simulated install - no software is actually downloaded)` }; }
    if (args[0] === "update") return { stdout: "Hit:1 http://azure.archive.ubuntu.com/ubuntu jammy InRelease\nReading package lists... Done" };
    throw new CliError("E: Invalid operation " + (args[0] ?? ""));
  },
  sudo: async (t, args, stdin) => { const [cmd, ...rest] = args; if (!cmd) throw new CliError("usage: sudo command"); const fn = BASH[cmd]; if (!fn) throw new CliError(`sudo: ${cmd}: command not found`, 127); return fn(t, rest, stdin); },
  clear: async () => ({ stdout: "\u001bc" }),
  history: async () => ({ stdout: "(history is shown in the panel on the right)" }),
  curl: async (_t, args) => { const url = args.find((a) => !a.startsWith("-")) ?? ""; if (/^https?:\/\/(localhost|127\.0\.0\.1)/.test(url)) return { stdout: "", stderr: "curl: (7) Failed to connect to localhost port 80: Connection refused", exitCode: 7 }; return { stdout: "", stderr: `curl: (6) Outbound network access is disabled in the sandbox. To test a simulated VM use: az vm run-command invoke ... --scripts "curl localhost"`, exitCode: 6 }; },
  ping: async (_t, args) => ({ stdout: "", stderr: `ping: ${args[args.length - 1] ?? ""}: ICMP is not available in the sandbox. Use 'az network watcher test-connectivity' for simulated resources.`, exitCode: 2 }),
  ssh: async (_t, args) => ({ stdout: "", stderr: `ssh: connect to host ${args[args.length - 1]?.split("@").pop()} port 22: simulated VMs do not accept SSH from the web terminal.\nUse: az vm run-command invoke -g <rg> -n <vm> --command-id RunShellScript --scripts "<command>"`, exitCode: 255 }),
  nano: async (_t, args) => ({ stdout: "", stderr: `nano: interactive editors are not available. Use: cat > ${args[0] ?? "file"} <<< "text" or echo "text" > ${args[0] ?? "file"}`, exitCode: 1 }),
  vim: async (t, args) => BASH.nano(t, args, null),
  vi: async (t, args) => BASH.nano(t, args, null),
  help: async () => ({ stdout: `Supported commands: ${Object.keys(BASH).sort().join(", ")}, az, kubectl\nOperators: |, >, >>, &&, ||, ;` }),
};

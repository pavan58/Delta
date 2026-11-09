/** Shell-style tokenizer and argument helpers shared by all simulated shells. */
import { badRequest } from "@/lib/errors";

export function tokenize(line: string): string[] {
  const out: string[] = [];
  let cur = "";
  let quote: string | null = null;
  let has = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (quote) {
      if (c === quote) quote = null;
      else if (c === "\\" && quote === '"' && i + 1 < line.length && ['"', "\\", "$"].includes(line[i + 1])) cur += line[++i];
      else cur += c;
      continue;
    }
    if (c === '"' || c === "'") { quote = c; has = true; continue; }
    if (c === "\\" && i + 1 < line.length) { cur += line[++i]; has = true; continue; }
    if (/\s/.test(c)) { if (cur || has) out.push(cur); cur = ""; has = false; continue; }
    cur += c;
    has = true;
  }
  if (quote) throw badRequest("ParseError", `Unterminated ${quote === '"' ? "double" : "single"} quote.`);
  if (cur || has) out.push(cur);
  return out;
}

/** Splits on an operator outside quotes. Returns parts and the operators between them. */
export function splitTopLevel(line: string, ops: string[]): { parts: string[]; seps: string[] } {
  const parts: string[] = [];
  const seps: string[] = [];
  let cur = "";
  let quote: string | null = null;
  let depth = 0;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (quote) { cur += c; if (c === quote) quote = null; continue; }
    if (c === '"' || c === "'") { quote = c; cur += c; continue; }
    if (c === "{" || c === "(") depth++;
    if (c === "}" || c === ")") depth--;
    if (depth === 0) {
      const op = ops.find((o) => line.startsWith(o, i) && !(o === "|" && line[i + 1] === "|") && !(o === "&" && line[i + 1] === "&"));
      if (op) { parts.push(cur.trim()); seps.push(op); cur = ""; i += op.length - 1; continue; }
    }
    cur += c;
  }
  parts.push(cur.trim());
  return { parts, seps };
}

export type Parsed = { positional: string[]; flags: Record<string, string[]>; bools: Set<string> };

/**
 * Parses GNU-style flags. Multi-value flags (e.g. --tags a=b c=d) collect values until the next flag.
 * aliases maps short flags to long names (e.g. { g: "resource-group", n: "name" }).
 */
export function parseArgs(args: string[], aliases: Record<string, string> = {}): Parsed {
  const positional: string[] = [];
  const flags: Record<string, string[]> = {};
  const bools = new Set<string>();
  let i = 0;
  while (i < args.length) {
    const a = args[i];
    if (/^--?[A-Za-z]/.test(a) && !/^-\d/.test(a)) {
      let name = a.replace(/^--?/, "");
      let inlineVal: string | undefined;
      if (name.includes("=")) { inlineVal = name.slice(name.indexOf("=") + 1); name = name.slice(0, name.indexOf("=")); }
      name = aliases[name] ?? name;
      if (inlineVal !== undefined) { (flags[name] ??= []).push(inlineVal); i++; continue; }
      const vals: string[] = [];
      i++;
      while (i < args.length && !(/^--?[A-Za-z]/.test(args[i]) && !/^-\d/.test(args[i]))) vals.push(args[i++]);
      if (vals.length) (flags[name] ??= []).push(...vals);
      else bools.add(name);
      continue;
    }
    positional.push(a);
    i++;
  }
  return { positional, flags, bools };
}

export function flag(p: Parsed, name: string, required = false, hint?: string): string | undefined {
  const v = p.flags[name]?.[0];
  if (required && (v === undefined || v === "")) throw badRequest("MissingArgument", `the following arguments are required: --${name}${hint ? ` (${hint})` : ""}`);
  return v;
}
export function flagReq(p: Parsed, name: string, hint?: string): string {
  return flag(p, name, true, hint)!;
}
export function flagList(p: Parsed, name: string): string[] {
  return p.flags[name] ?? [];
}
export function boolFlag(p: Parsed, name: string): boolean {
  if (p.bools.has(name)) return true;
  const v = p.flags[name]?.[0]?.toLowerCase();
  return v === "true" || v === "yes" || v === "1";
}
export function optBool(p: Parsed, name: string): boolean | undefined {
  if (p.bools.has(name)) return true;
  const v = p.flags[name]?.[0]?.toLowerCase();
  if (v === undefined) return undefined;
  return v === "true" || v === "yes" || v === "1" || v === "enabled";
}
export function parseTags(vals: string[]): Record<string, string> {
  const tags: Record<string, string> = {};
  for (const v of vals) {
    if (!v) continue;
    const i = v.indexOf("=");
    tags[i < 0 ? v : v.slice(0, i)] = i < 0 ? "" : v.slice(i + 1);
  }
  return tags;
}

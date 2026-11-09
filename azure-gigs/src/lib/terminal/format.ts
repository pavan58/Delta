/** Output formatting: JSON, table, tsv and a small JMESPath subset for --query. */
import { badRequest } from "@/lib/errors";

type Any = any; // eslint-disable-line @typescript-eslint/no-explicit-any

function getPath(obj: Any, path: string): Any {
  if (path === "@" || path === "") return obj;
  let cur = obj;
  for (const seg of path.split(".")) {
    if (cur === null || cur === undefined) return null;
    const m = /^([^[]*)((?:\[\d+\])*)$/.exec(seg);
    if (!m) return null;
    if (m[1]) {
      const key = Object.keys(cur).find((k) => k === m[1]) ?? Object.keys(cur).find((k) => k.toLowerCase() === m[1].toLowerCase());
      cur = key ? cur[key] : null;
    }
    for (const idx of m[2].match(/\d+/g) ?? []) cur = Array.isArray(cur) ? cur[Number(idx)] : null;
  }
  return cur === undefined ? null : cur;
}

function projectExpr(obj: Any, expr: string): Any {
  expr = expr.trim();
  const multi = /^\{(.*)\}$/.exec(expr);
  if (multi) {
    const out: Record<string, Any> = {};
    for (const part of multi[1].split(",")) {
      const [k, v] = part.split(":").map((s) => s.trim());
      if (!k || !v) throw badRequest("InvalidQuery", `Invalid --query multiselect '${part}'.`);
      out[k] = getPath(obj, v);
    }
    return out;
  }
  const list = /^\[(.*)\]$/.exec(expr);
  if (list && !/^\d+$/.test(list[1])) return list[1].split(",").map((p) => getPath(obj, p.trim()));
  return getPath(obj, expr);
}

function filterMatch(obj: Any, cond: string): boolean {
  const m = /^(.+?)\s*(==|!=)\s*'([^']*)'$/.exec(cond.trim()) ?? /^(.+?)\s*(==|!=)\s*`([^`]*)`$/.exec(cond.trim());
  if (m) {
    const v = getPath(obj, m[1].trim());
    const eq = String(v) === m[3];
    return m[2] === "==" ? eq : !eq;
  }
  const c = /^contains\((.+?),\s*'([^']*)'\)$/.exec(cond.trim());
  if (c) return String(getPath(obj, c[1].trim()) ?? "").includes(c[2]);
  throw badRequest("InvalidQuery", `Unsupported filter expression '${cond}'. Supported: [?field=='value'], [?field!='value'], [?contains(field,'x')].`);
}

/** Supports: field.sub, [0], [].field, [].{A:a,B:b}, [?a=='x'].name, length(@), length([]) */
export function jmes(data: Any, query: string): Any {
  const q = query.trim();
  const len = /^length\((.*)\)$/.exec(q);
  if (len) { const v = jmes(data, len[1] || "@"); return Array.isArray(v) ? v.length : typeof v === "string" ? v.length : v && typeof v === "object" ? Object.keys(v).length : 0; }
  const arr = /^\[(\?[^\]]*|\*|)\](?:\.?(.*))?$/.exec(q);
  if (arr) {
    if (!Array.isArray(data)) return null;
    let items = data;
    if (arr[1].startsWith("?")) items = items.filter((x) => filterMatch(x, arr[1].slice(1)));
    if (!arr[2]) return items;
    return items.map((x) => projectExpr(x, arr[2]));
  }
  const idx = /^\[(\d+)\](?:\.(.*))?$/.exec(q);
  if (idx) { const v = Array.isArray(data) ? data[Number(idx[1])] : null; return idx[2] ? jmes(v, idx[2]) : v ?? null; }
  return projectExpr(data, q);
}

function cell(v: Any): string {
  if (v === null || v === undefined) return "";
  if (typeof v === "object") return Array.isArray(v) ? v.map(cell).join(",") : "";
  return String(v);
}

export function asTable(rows: Any[]): string {
  if (!Array.isArray(rows)) rows = [rows];
  if (!rows.length) return "";
  if (typeof rows[0] !== "object" || rows[0] === null) return rows.map(cell).join("\n");
  const cols = [...new Set(rows.flatMap((r) => Object.keys(r).filter((k) => r[k] === null || typeof r[k] !== "object" || Array.isArray(r[k]))))];
  const title = (c: string) => c.replace(/^./, (x) => x.toUpperCase());
  const widths = cols.map((c) => Math.min(60, Math.max(title(c).length, ...rows.map((r) => cell(r[c]).length))));
  const line = (vals: string[]) => vals.map((v, i) => v.slice(0, widths[i]).padEnd(widths[i])).join("  ").trimEnd();
  return [line(cols.map(title)), line(widths.map((w) => "-".repeat(w))), ...rows.map((r) => line(cols.map((c) => cell(r[c]))))].join("\n");
}

export function asTsv(data: Any): string {
  const rows = Array.isArray(data) ? data : [data];
  return rows.map((r) => (r && typeof r === "object" ? Object.values(r).filter((v) => v === null || typeof v !== "object").map(cell).join("\t") : cell(r))).join("\n");
}

export function render(data: Any, output: string | undefined, query?: string): string {
  let d = data;
  if (query) d = jmes(d, query);
  if (d === undefined) return "";
  switch ((output ?? "json").toLowerCase()) {
    case "table": return asTable(d);
    case "tsv": return asTsv(d);
    case "none": return "";
    case "yaml": case "yamlc": return toYaml(d);
    case "json": case "jsonc": return JSON.stringify(d, null, 2);
    default: throw badRequest("InvalidArgumentValue", `argument --output/-o: invalid choice: '${output}' (choose from 'json', 'jsonc', 'none', 'table', 'tsv', 'yaml', 'yamlc')`);
  }
}

export function toYaml(d: Any, indent = 0): string {
  const pad = " ".repeat(indent);
  if (Array.isArray(d)) return d.map((x) => (x && typeof x === "object" ? `${pad}- ${toYaml(x, indent + 2).trimStart()}` : `${pad}- ${x}`)).join("\n");
  if (d && typeof d === "object") return Object.entries(d).map(([k, v]) => (v && typeof v === "object" ? `${pad}${k}:\n${toYaml(v, indent + 2)}` : `${pad}${k}: ${v ?? "null"}`)).join("\n");
  return `${pad}${d}`;
}

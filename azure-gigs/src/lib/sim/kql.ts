/**
 * A compact Kusto Query Language (KQL) interpreter for learning purposes.
 * Supports: where, project, project-away, extend, summarize ... by (incl. bin()), sort/order by,
 * take/limit, top, count, distinct, join (inner/leftouter/leftanti) and render.
 */
export type Row = Record<string, unknown>;
export type Tables = Record<string, Row[]>;
export type KqlResult = { columns: string[]; rows: Row[]; chart?: string; stats: { rowsScanned: number; durationMs: number } };

export class KqlError extends Error {}

// ---------------- Tokenizer ----------------
type Tok = { t: "id" | "num" | "str" | "op" | "ts" | "eof"; v: string; pos: number };

const TIMESPAN = /^(\d+(?:\.\d+)?)(ms|d|h|m|s)\b/;

function tokenize(src: string): Tok[] {
  const toks: Tok[] = [];
  let i = 0;
  while (i < src.length) {
    const c = src[i];
    if (/\s/.test(c)) { i++; continue; }
    if (c === "/" && src[i + 1] === "/") { while (i < src.length && src[i] !== "\n") i++; continue; }
    const rest = src.slice(i);
    if (c === '"' || c === "'") {
      let j = i + 1, s = "";
      while (j < src.length && src[j] !== c) { if (src[j] === "\\" && j + 1 < src.length) { s += src[j + 1]; j += 2; } else s += src[j++]; }
      if (j >= src.length) throw new KqlError(`Unterminated string literal at position ${i}`);
      toks.push({ t: "str", v: s, pos: i });
      i = j + 1;
      continue;
    }
    const ts = TIMESPAN.exec(rest);
    if (ts && !/[A-Za-z_]/.test(rest[ts[0].length] ?? "")) { toks.push({ t: "ts", v: ts[0], pos: i }); i += ts[0].length; continue; }
    const num = /^\d+(?:\.\d+)?/.exec(rest);
    if (num) { toks.push({ t: "num", v: num[0], pos: i }); i += num[0].length; continue; }
    const id = /^[A-Za-z_$][A-Za-z0-9_]*(?:-[a-z]+)?/.exec(rest);
    if (id) {
      let v = id[0];
      // only allow hyphenated keywords we know about
      if (v.includes("-") && !["project-away", "project-rename", "!contains"].includes(v)) v = v.split("-")[0];
      toks.push({ t: "id", v, pos: i });
      i += v.length;
      continue;
    }
    const op = /^(==|!=|<=|>=|=~|!~|\.\.|!contains|!in|!has|!startswith|[|(),=<>+\-*/%!\[\].~])/.exec(rest);
    if (op) { toks.push({ t: "op", v: op[0], pos: i }); i += op[0].length; continue; }
    throw new KqlError(`Unexpected character '${c}' at position ${i}`);
  }
  toks.push({ t: "eof", v: "", pos: src.length });
  return toks;
}

// ---------------- AST ----------------
type Expr =
  | { k: "lit"; v: unknown }
  | { k: "col"; name: string }
  | { k: "bin"; op: string; l: Expr; r: Expr }
  | { k: "un"; op: string; e: Expr }
  | { k: "call"; name: string; args: Expr[] }
  | { k: "in"; neg: boolean; ci: boolean; e: Expr; list: Expr[] }
  | { k: "between"; e: Expr; lo: Expr; hi: Expr };

type Assign = { name: string; e: Expr };
type Op =
  | { op: "where"; e: Expr }
  | { op: "project"; cols: Assign[] }
  | { op: "project-away"; cols: string[] }
  | { op: "extend"; cols: Assign[] }
  | { op: "summarize"; aggs: Assign[]; by: Assign[] }
  | { op: "sort"; keys: { e: Expr; desc: boolean }[] }
  | { op: "take"; n: number }
  | { op: "top"; n: number; e: Expr; desc: boolean }
  | { op: "count" }
  | { op: "distinct"; cols: string[] }
  | { op: "join"; kind: string; right: Query; on: string[] }
  | { op: "render"; chart: string };
type Query = { table: string; ops: Op[] };

const TS_MS: Record<string, number> = { d: 86400000, h: 3600000, m: 60000, s: 1000, ms: 1 };
const parseTs = (v: string) => { const m = TIMESPAN.exec(v)!; return Number(m[1]) * TS_MS[m[2]]; };

class Parser {
  i = 0;
  constructor(private toks: Tok[]) {}
  peek(o = 0) { return this.toks[this.i + o]; }
  next() { return this.toks[this.i++]; }
  is(v: string) { const t = this.peek(); return (t.t === "op" || t.t === "id") && t.v.toLowerCase() === v.toLowerCase(); }
  accept(v: string) { if (this.is(v)) { this.i++; return true; } return false; }
  expect(v: string) { if (!this.accept(v)) throw new KqlError(`Expected '${v}' but found '${this.peek().v || "end of query"}' at position ${this.peek().pos}`); }
  ident(): string { const t = this.next(); if (t.t !== "id") throw new KqlError(`Expected a name but found '${t.v || "end of query"}' at position ${t.pos}`); return t.v; }

  query(): Query {
    const table = this.ident();
    const ops: Op[] = [];
    while (this.accept("|")) ops.push(this.operator());
    return { table, ops };
  }

  operator(): Op {
    const name = this.ident().toLowerCase();
    switch (name) {
      case "where": case "filter": return { op: "where", e: this.expr() };
      case "project": return { op: "project", cols: this.assignList() };
      case "project-away": { const cols = [this.ident()]; while (this.accept(",")) cols.push(this.ident()); return { op: "project-away", cols }; }
      case "extend": return { op: "extend", cols: this.assignList() };
      case "summarize": {
        const aggs = this.is("by") ? [] : this.assignList();
        const by = this.accept("by") ? this.assignList() : [];
        return { op: "summarize", aggs, by };
      }
      case "sort": case "order": {
        this.expect("by");
        const keys = [this.sortKey()];
        while (this.accept(",")) keys.push(this.sortKey());
        return { op: "sort", keys };
      }
      case "take": case "limit": return { op: "take", n: this.number() };
      case "top": { const n = this.number(); this.expect("by"); const k = this.sortKey(); return { op: "top", n, e: k.e, desc: k.desc }; }
      case "count": return { op: "count" };
      case "distinct": { const cols = [this.ident()]; while (this.accept(",")) cols.push(this.ident()); return { op: "distinct", cols }; }
      case "join": {
        let kind = "innerunique";
        if (this.accept("kind")) { this.expect("="); kind = this.ident().toLowerCase(); }
        this.expect("(");
        const right = this.query();
        this.expect(")");
        this.expect("on");
        const on: string[] = [];
        do {
          if (this.accept("$left")) { this.expect("."); on.push(this.ident()); this.expect("=="); this.accept("$right"); this.accept("."); this.ident(); }
          else on.push(this.ident());
        } while (this.accept(","));
        return { op: "join", kind, right, on };
      }
      case "render": { const chart = this.ident(); while (this.peek().t !== "eof" && !this.is("|")) this.next(); return { op: "render", chart }; }
      default: throw new KqlError(`Unknown or unsupported operator '${name}'. Supported: where, project, project-away, extend, summarize, sort/order by, take/limit, top, count, distinct, join, render.`);
    }
  }
  number() { const t = this.next(); if (t.t !== "num") throw new KqlError(`Expected a number at position ${t.pos}`); return Number(t.v); }
  sortKey() { const e = this.expr(); let desc = true; if (this.accept("asc")) desc = false; else this.accept("desc"); return { e, desc }; }
  assignList(): Assign[] {
    const out: Assign[] = [];
    do {
      if (this.peek().t === "id" && this.peek(1).t === "op" && this.peek(1).v === "=") { const name = this.ident(); this.next(); out.push({ name, e: this.expr() }); }
      else { const e = this.expr(); out.push({ name: defaultName(e), e }); }
    } while (this.accept(","));
    return out;
  }

  expr(): Expr { return this.or(); }
  or(): Expr { let l = this.and(); while (this.accept("or")) l = { k: "bin", op: "or", l, r: this.and() }; return l; }
  and(): Expr { let l = this.cmp(); while (this.accept("and")) l = { k: "bin", op: "and", l, r: this.cmp() }; return l; }
  cmp(): Expr {
    const l = this.add();
    const t = this.peek();
    const ops = ["==", "!=", "<", ">", "<=", ">=", "=~", "!~", "contains", "!contains", "has", "!has", "startswith", "!startswith", "endswith", "contains_cs", "matches"];
    if ((t.t === "op" || t.t === "id") && ops.includes(t.v.toLowerCase())) {
      this.next();
      let op = t.v.toLowerCase();
      if (op === "matches") { this.expect("regex"); op = "matches"; }
      return { k: "bin", op, l, r: this.add() };
    }
    if (this.is("in") || this.is("!in") || (this.is("in~"))) {
      const neg = this.next().v === "!in";
      const ci = this.accept("~");
      this.expect("(");
      const list = [this.expr()];
      while (this.accept(",")) list.push(this.expr());
      this.expect(")");
      return { k: "in", neg, ci, e: l, list };
    }
    if (this.accept("between")) { this.expect("("); const lo = this.add(); this.expect(".."); const hi = this.add(); this.expect(")"); return { k: "between", e: l, lo, hi }; }
    return l;
  }
  add(): Expr { let l = this.mul(); while (this.is("+") || this.is("-")) { const op = this.next().v; l = { k: "bin", op, l, r: this.mul() }; } return l; }
  mul(): Expr { let l = this.unary(); while (this.is("*") || this.is("/") || this.is("%")) { const op = this.next().v; l = { k: "bin", op, l, r: this.unary() }; } return l; }
  unary(): Expr {
    if (this.accept("not")) { this.expect("("); const e = this.expr(); this.expect(")"); return { k: "un", op: "not", e }; }
    if (this.accept("-")) return { k: "un", op: "-", e: this.unary() };
    return this.primary();
  }
  primary(): Expr {
    const t = this.next();
    if (t.t === "num") return { k: "lit", v: Number(t.v) };
    if (t.t === "str") return { k: "lit", v: t.v };
    if (t.t === "ts") return { k: "lit", v: parseTs(t.v) };
    if (t.t === "op" && t.v === "(") { const e = this.expr(); this.expect(")"); return e; }
    if (t.t === "id") {
      const lower = t.v.toLowerCase();
      if (lower === "true" || lower === "false") return { k: "lit", v: lower === "true" };
      if (this.accept("(")) {
        const args: Expr[] = [];
        if (!this.is(")")) { do { args.push(this.is("*") ? (this.next(), { k: "lit", v: "*" }) : this.expr()); } while (this.accept(",")); }
        this.expect(")");
        return { k: "call", name: lower, args };
      }
      return { k: "col", name: t.v };
    }
    throw new KqlError(`Unexpected '${t.v || "end of query"}' at position ${t.pos}`);
  }
}

function defaultName(e: Expr): string {
  if (e.k === "col") return e.name;
  if (e.k === "call") {
    const arg = e.args[0];
    if (e.name === "count") return "count_";
    if (e.name === "bin" && arg?.k === "col") return arg.name;
    return `${e.name}_${arg && arg.k === "col" ? arg.name : ""}`.replace(/_$/, "_");
  }
  return "Column1";
}

// ---------------- Evaluation ----------------
const AGGS = ["count", "countif", "sum", "avg", "min", "max", "dcount", "percentile", "make_set", "make_list", "any", "stdev"];

function toNum(v: unknown) { if (v instanceof Date) return v.getTime(); return typeof v === "number" ? v : Number(v); }
function toStr(v: unknown) { return v === null || v === undefined ? "" : v instanceof Date ? v.toISOString() : String(v); }
function asTime(v: unknown): number { if (v instanceof Date) return v.getTime(); if (typeof v === "string") return Date.parse(v); return Number(v); }

function evalExpr(e: Expr, row: Row, now: number): unknown {
  switch (e.k) {
    case "lit": return e.v;
    case "col": {
      if (!(e.name in row)) {
        const key = Object.keys(row).find((k) => k.toLowerCase() === e.name.toLowerCase());
        if (key) throw new KqlError(`Column '${e.name}' not found. Column names are case-sensitive - did you mean '${key}'?`);
        throw new KqlError(`Failed to resolve column or scalar expression named '${e.name}'`);
      }
      return row[e.name];
    }
    case "un": { const v = evalExpr(e.e, row, now); return e.op === "not" ? !v : -toNum(v); }
    case "in": {
      const v = evalExpr(e.e, row, now);
      const list = e.list.map((x) => evalExpr(x, row, now));
      const hit = list.some((x) => (e.ci ? toStr(x).toLowerCase() === toStr(v).toLowerCase() : x === v || toStr(x) === toStr(v)));
      return e.neg ? !hit : hit;
    }
    case "between": { const v = toNum(evalExpr(e.e, row, now)); return v >= toNum(evalExpr(e.lo, row, now)) && v <= toNum(evalExpr(e.hi, row, now)); }
    case "bin": {
      if (e.op === "and") return !!evalExpr(e.l, row, now) && !!evalExpr(e.r, row, now);
      if (e.op === "or") return !!evalExpr(e.l, row, now) || !!evalExpr(e.r, row, now);
      const l = evalExpr(e.l, row, now), r = evalExpr(e.r, row, now);
      const ls = toStr(l), rs = toStr(r);
      const isTime = l instanceof Date || r instanceof Date;
      const cmpL = isTime ? asTime(l) : l, cmpR = isTime ? asTime(r) : r;
      switch (e.op) {
        case "==": return isTime ? cmpL === cmpR : l === r || (typeof l !== typeof r && ls === rs);
        case "!=": return !(isTime ? cmpL === cmpR : l === r || (typeof l !== typeof r && ls === rs));
        case "=~": return ls.toLowerCase() === rs.toLowerCase();
        case "!~": return ls.toLowerCase() !== rs.toLowerCase();
        case "<": return (cmpL as number) < (cmpR as number);
        case ">": return (cmpL as number) > (cmpR as number);
        case "<=": return (cmpL as number) <= (cmpR as number);
        case ">=": return (cmpL as number) >= (cmpR as number);
        case "contains": return ls.toLowerCase().includes(rs.toLowerCase());
        case "contains_cs": return ls.includes(rs);
        case "!contains": return !ls.toLowerCase().includes(rs.toLowerCase());
        case "has": return new RegExp(`(^|[^A-Za-z0-9])${rs.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}($|[^A-Za-z0-9])`, "i").test(ls);
        case "!has": return !new RegExp(`(^|[^A-Za-z0-9])${rs.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}($|[^A-Za-z0-9])`, "i").test(ls);
        case "startswith": return ls.toLowerCase().startsWith(rs.toLowerCase());
        case "!startswith": return !ls.toLowerCase().startsWith(rs.toLowerCase());
        case "endswith": return ls.toLowerCase().endsWith(rs.toLowerCase());
        case "matches": try { return new RegExp(rs).test(ls); } catch { throw new KqlError(`Invalid regex '${rs}'`); }
        case "+": return l instanceof Date ? new Date(l.getTime() + toNum(r)) : toNum(l) + toNum(r);
        case "-": return l instanceof Date ? (r instanceof Date ? l.getTime() - r.getTime() : new Date(l.getTime() - toNum(r))) : toNum(l) - toNum(r);
        case "*": return toNum(l) * toNum(r);
        case "/": return toNum(r) === 0 ? null : toNum(l) / toNum(r);
        case "%": return toNum(l) % toNum(r);
      }
      throw new KqlError(`Unsupported operator ${e.op}`);
    }
    case "call": {
      if (AGGS.includes(e.name)) throw new KqlError(`Aggregation function '${e.name}()' can only be used inside 'summarize'.`);
      const a = e.args.map((x) => evalExpr(x, row, now));
      switch (e.name) {
        case "ago": return new Date(now - toNum(a[0]));
        case "now": return new Date(now + (a.length ? toNum(a[0]) : 0));
        case "datetime": return new Date(toStr(a[0]));
        case "bin": case "floor": {
          if (a[0] instanceof Date) { const s = toNum(a[1]); return new Date(Math.floor(a[0].getTime() / s) * s); }
          const s = toNum(a[1]); return Math.floor(toNum(a[0]) / s) * s;
        }
        case "tolower": return toStr(a[0]).toLowerCase();
        case "toupper": return toStr(a[0]).toUpperCase();
        case "strlen": return toStr(a[0]).length;
        case "tostring": return toStr(a[0]);
        case "toint": case "tolong": return Math.trunc(toNum(a[0]));
        case "todouble": case "toreal": return toNum(a[0]);
        case "round": { const d = a.length > 1 ? toNum(a[1]) : 0; return Math.round(toNum(a[0]) * 10 ** d) / 10 ** d; }
        case "isempty": return a[0] === null || a[0] === undefined || a[0] === "";
        case "isnotempty": return !(a[0] === null || a[0] === undefined || a[0] === "");
        case "isnull": return a[0] === null || a[0] === undefined;
        case "isnotnull": return !(a[0] === null || a[0] === undefined);
        case "iff": case "iif": return a[0] ? a[1] : a[2];
        case "substring": return toStr(a[0]).substr(toNum(a[1]), a.length > 2 ? toNum(a[2]) : undefined);
        case "strcat": return a.map(toStr).join("");
        case "split": return toStr(a[0]).split(toStr(a[1]));
        case "hourofday": return new Date(asTime(a[0])).getUTCHours();
        case "dayofweek": return new Date(asTime(a[0])).getUTCDay() * 86400000;
        case "startofday": { const d = new Date(asTime(a[0])); d.setUTCHours(0, 0, 0, 0); return d; }
        case "format_datetime": return new Date(asTime(a[0])).toISOString();
        case "abs": return Math.abs(toNum(a[0]));
        case "coalesce": return a.find((x) => x !== null && x !== undefined && x !== "") ?? null;
      }
      throw new KqlError(`Unknown function '${e.name}()'.`);
    }
  }
}

function aggregate(e: Expr, rows: Row[], now: number): unknown {
  if (e.k !== "call" || !AGGS.includes(e.name)) {
    if (e.k === "bin" || e.k === "un") throw new KqlError("Arithmetic over aggregates is not supported; use extend after summarize.");
    throw new KqlError("summarize expects aggregation functions such as count(), avg(), sum(), min(), max(), dcount().");
  }
  const vals = () => rows.map((r) => evalExpr(e.args[0], r, now));
  switch (e.name) {
    case "count": return rows.length;
    case "countif": return rows.filter((r) => !!evalExpr(e.args[0], r, now)).length;
    case "sum": return vals().reduce((a: number, v) => a + toNum(v), 0);
    case "avg": { const v = vals(); return v.length ? Math.round((v.reduce((a: number, x) => a + toNum(x), 0) / v.length) * 1000) / 1000 : null; }
    case "min": { const v = vals(); return v.length ? v.reduce((a, x) => (toNum(x) < toNum(a) ? x : a)) : null; }
    case "max": { const v = vals(); return v.length ? v.reduce((a, x) => (toNum(x) > toNum(a) ? x : a)) : null; }
    case "dcount": return new Set(vals().map(toStr)).size;
    case "make_set": return [...new Set(vals().map(toStr))];
    case "make_list": return vals();
    case "any": return vals()[0] ?? null;
    case "stdev": { const v = vals().map(toNum); const m = v.reduce((a, x) => a + x, 0) / (v.length || 1); return Math.sqrt(v.reduce((a, x) => a + (x - m) ** 2, 0) / Math.max(1, v.length - 1)); }
    case "percentile": { const v = vals().map(toNum).sort((a, b) => a - b); const p = toNum(evalExpr(e.args[1], {}, now)); return v.length ? v[Math.min(v.length - 1, Math.floor((p / 100) * v.length))] : null; }
  }
  return null;
}

function cmpValues(a: unknown, b: unknown) {
  if (a instanceof Date || b instanceof Date) return asTime(a) - asTime(b);
  if (typeof a === "number" && typeof b === "number") return a - b;
  return toStr(a).localeCompare(toStr(b));
}

function execQuery(q: Query, tables: Tables, now: number, scanned: { n: number }): { rows: Row[]; columns: string[]; chart?: string } {
  const key = Object.keys(tables).find((k) => k === q.table);
  if (!key) {
    const ci = Object.keys(tables).find((k) => k.toLowerCase() === q.table.toLowerCase());
    throw new KqlError(ci ? `Table '${q.table}' not found. Table names are case-sensitive - did you mean '${ci}'?` : `Table '${q.table}' not found. Available tables: ${Object.keys(tables).join(", ")}.`);
  }
  let rows = tables[key].map((r) => ({ ...r }));
  scanned.n += rows.length;
  let columns = rows.length ? Object.keys(rows[0]) : [];
  let chart: string | undefined;
  for (const op of q.ops) {
    switch (op.op) {
      case "where": rows = rows.filter((r) => !!evalExpr(op.e, r, now)); break;
      case "project": rows = rows.map((r) => Object.fromEntries(op.cols.map((c) => [c.name, evalExpr(c.e, r, now)]))); columns = op.cols.map((c) => c.name); break;
      case "project-away": for (const c of op.cols) if (!columns.includes(c)) throw new KqlError(`Column '${c}' not found.`); columns = columns.filter((c) => !op.cols.includes(c)); rows = rows.map((r) => Object.fromEntries(columns.map((c) => [c, r[c]]))); break;
      case "extend": rows = rows.map((r) => { const o = { ...r }; for (const c of op.cols) o[c.name] = evalExpr(c.e, o, now); return o; }); for (const c of op.cols) if (!columns.includes(c.name)) columns.push(c.name); break;
      case "summarize": {
        const groups = new Map<string, { keyVals: unknown[]; rows: Row[] }>();
        for (const r of rows) {
          const kv = op.by.map((b) => evalExpr(b.e, r, now));
          const k = JSON.stringify(kv.map(toStr));
          if (!groups.has(k)) groups.set(k, { keyVals: kv, rows: [] });
          groups.get(k)!.rows.push(r);
        }
        if (!op.by.length && !groups.size) groups.set("[]", { keyVals: [], rows: [] });
        rows = [...groups.values()].map((g) => {
          const o: Row = {};
          op.by.forEach((b, i) => (o[b.name] = g.keyVals[i]));
          for (const a of op.aggs) o[a.name] = aggregate(a.e, g.rows, now);
          return o;
        });
        columns = [...op.by.map((b) => b.name), ...op.aggs.map((a) => a.name)];
        break;
      }
      case "sort": rows = [...rows].sort((a, b) => { for (const k of op.keys) { const c = cmpValues(evalExpr(k.e, a, now), evalExpr(k.e, b, now)); if (c) return k.desc ? -c : c; } return 0; }); break;
      case "take": rows = rows.slice(0, op.n); break;
      case "top": rows = [...rows].sort((a, b) => { const c = cmpValues(evalExpr(op.e, a, now), evalExpr(op.e, b, now)); return op.desc ? -c : c; }).slice(0, op.n); break;
      case "count": rows = [{ Count: rows.length }]; columns = ["Count"]; break;
      case "distinct": { const seen = new Set<string>(); rows = rows.filter((r) => { const k = JSON.stringify(op.cols.map((c) => toStr(r[c]))); if (seen.has(k)) return false; seen.add(k); return true; }).map((r) => Object.fromEntries(op.cols.map((c) => [c, r[c]]))); columns = op.cols; break; }
      case "join": {
        const right = execQuery(op.right, tables, now, scanned);
        const out: Row[] = [];
        const rightIdx = new Map<string, Row[]>();
        for (const r of right.rows) { const k = JSON.stringify(op.on.map((c) => toStr(r[c]))); if (!rightIdx.has(k)) rightIdx.set(k, []); rightIdx.get(k)!.push(r); }
        for (const l of rows) {
          const k = JSON.stringify(op.on.map((c) => toStr(l[c])));
          let matches = rightIdx.get(k) ?? [];
          if (op.kind === "innerunique") matches = matches.slice(0, 1);
          if (op.kind === "leftanti") { if (!matches.length) out.push(l); continue; }
          if (!matches.length && op.kind === "leftouter") out.push({ ...l });
          for (const m of matches) { const merged: Row = { ...l }; for (const [c, v] of Object.entries(m)) merged[c in l && !op.on.includes(c) ? `${c}1` : c] = v; out.push(merged); }
        }
        rows = out;
        const extra = op.kind === "leftanti" ? [] : right.columns.filter((c) => !op.on.includes(c)).map((c) => (columns.includes(c) ? `${c}1` : c));
        columns = [...columns, ...extra];
        break;
      }
      case "render": chart = op.chart; break;
    }
    if (rows.length > 50000) throw new KqlError("Query produced too many rows. Add filters or summarize.");
  }
  return { rows, columns, chart };
}

export function runKql(query: string, tables: Tables, now = Date.now()): KqlResult {
  const started = Date.now();
  if (query.length > 5000) throw new KqlError("Query is too long (max 5000 characters).");
  const toks = tokenize(query.trim().replace(/;\s*$/, ""));
  const p = new Parser(toks);
  const q = p.query();
  if (p.peek().t !== "eof") throw new KqlError(`Unexpected '${p.peek().v}' at position ${p.peek().pos}. Did you forget a '|'?`);
  const scanned = { n: 0 };
  const r = execQuery(q, tables, now, scanned);
  const rows = r.rows.slice(0, 1000).map((row) => Object.fromEntries(r.columns.map((c) => [c, row[c] instanceof Date ? (row[c] as Date).toISOString() : row[c] ?? null])));
  return { columns: r.columns, rows, chart: r.chart, stats: { rowsScanned: scanned.n, durationMs: Date.now() - started } };
}

export const EXAMPLE_QUERIES = [
  { title: "Latest heartbeat per computer", query: "Heartbeat\n| summarize LastSeen = max(TimeGenerated) by Computer\n| sort by LastSeen desc" },
  { title: "Average CPU per computer (last 6h)", query: "Perf\n| where TimeGenerated > ago(6h) and CounterName == \"% Processor Time\"\n| summarize AvgCPU = avg(CounterValue) by Computer\n| sort by AvgCPU desc" },
  { title: "CPU trend in 30 minute bins", query: "Perf\n| where CounterName == \"% Processor Time\"\n| summarize avg(CounterValue) by bin(TimeGenerated, 30m)\n| sort by TimeGenerated asc\n| render timechart" },
  { title: "Failed HTTP requests by URL", query: "AppRequests\n| where Success == false\n| summarize Failures = count() by Url, ResultCode\n| top 10 by Failures desc" },
  { title: "Slowest requests (p95)", query: "AppRequests\n| summarize P95 = percentile(DurationMs, 95), Requests = count() by Name\n| sort by P95 desc" },
  { title: "Syslog errors", query: "Syslog\n| where SeverityLevel in (\"err\", \"crit\")\n| project TimeGenerated, Computer, Facility, SyslogMessage\n| take 50" },
  { title: "Failed sign-ins by user", query: "SigninLogs\n| where ResultType != 0\n| summarize Failures = count() by UserPrincipalName, ResultDescription" },
  { title: "Who deleted resources?", query: "AzureActivity\n| where OperationNameValue contains \"Delete\"\n| project TimeGenerated, Caller, ResourceGroup, Resource, ActivityStatusValue" },
  { title: "Join heartbeat with perf", query: "Heartbeat\n| summarize LastSeen = max(TimeGenerated) by Computer\n| join kind=inner (Perf | where CounterName == \"% Processor Time\" | summarize AvgCPU = avg(CounterValue) by Computer) on Computer\n| project Computer, LastSeen, AvgCPU" },
  { title: "Computers that stopped reporting", query: "Heartbeat\n| summarize LastSeen = max(TimeGenerated) by Computer\n| where LastSeen < ago(15m)" },
];

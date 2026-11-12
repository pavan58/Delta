"use client";
import { useCallback, useEffect, useState } from "react";
import { BarChart3, FileText, MessageSquare, Settings2, Trash2 } from "lucide-react";
import { PageHeader } from "@/components/layout/AppShell";
import { Stat } from "@/components/ui/Score";
import { useAuth } from "@/lib/supabase/auth";
import { authHeader } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

type Tab = "overview" | "content" | "settings" | "feedback";

async function api(path: string, init: RequestInit = {}) {
  const res = await fetch(path, { ...init, headers: { "Content-Type": "application/json", ...(await authHeader()), ...(init.headers ?? {}) } });
  const j = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(j.error ?? `Request failed (${res.status})`);
  return j;
}

export default function AdminPage() {
  const auth = useAuth();
  const [tab, setTab] = useState<Tab>("overview");
  if (!auth.configured) return <div className="card p-6">The admin panel requires Supabase. See <b>docs/DEPLOYMENT.md</b> → &ldquo;Admin setup&rdquo;.</div>;
  if (auth.loading) return null;
  if (auth.role !== "admin") return <div className="card p-6">Admin access only. Your account does not have the admin role.</div>;
  return (
    <div>
      <PageHeader title="Admin" subtitle="Manage content, AI usage, limits and feedback. All actions are checked server-side." />
      <div className="mb-4 flex flex-wrap gap-2">
        {([["overview", "Overview", BarChart3], ["content", "Content", FileText], ["settings", "Limits & features", Settings2], ["feedback", "Feedback", MessageSquare]] as const).map(([v, l, I]) => (
          <button key={v} onClick={() => setTab(v)} className={cn("btn btn-secondary text-sm", tab === v && "border-brand-500 ring-2 ring-brand-500/30")}><I size={16} /> {l}</button>
        ))}
      </div>
      {tab === "overview" && <Overview />}
      {tab === "content" && <Content />}
      {tab === "settings" && <SettingsTab />}
      {tab === "feedback" && <Feedback />}
    </div>
  );
}

interface Stats {
  users: number; sessions: number; sessionsWeek: number; interviews: number; ielts: number; activeToday: number;
  ai: { requestsToday: number; requestsWeek: number; costToday: number; costWeek: number; tokensWeek: number; userKeyShare: number; byTask: Record<string, number> };
  feedback: Array<{ id: string; created_at: string; message: string; rating: number | null; page: string | null; status: string }>;
}

function Overview() {
  const [s, setS] = useState<Stats | null>(null);
  const [err, setErr] = useState("");
  useEffect(() => { api("/api/admin/stats").then(setS).catch((e) => setErr(e.message)); }, []);
  if (err) return <p className="text-red-500">{err}</p>;
  if (!s) return <p className="text-muted">Loading…</p>;
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
        <Stat label="Registered users" value={s.users} />
        <Stat label="Active today" value={s.activeToday} sub="Signed-in users with practice today" />
        <Stat label="Speaking sessions" value={s.sessions} sub={`${s.sessionsWeek} in last 7 days`} />
        <Stat label="Mock interviews" value={s.interviews} />
        <Stat label="IELTS attempts" value={s.ielts} />
        <Stat label="Open feedback" value={s.feedback.filter((f) => f.status === "new").length} />
      </div>
      <div className="card p-4">
        <h2 className="font-semibold">AI usage & estimated cost</h2>
        <div className="mt-3 grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Stat label="Requests today" value={s.ai.requestsToday} />
          <Stat label="Requests (7 days)" value={s.ai.requestsWeek} />
          <Stat label="Est. cost today" value={`$${s.ai.costToday.toFixed(4)}`} />
          <Stat label="Est. cost (7 days)" value={`$${s.ai.costWeek.toFixed(4)}`} sub={`${s.ai.tokensWeek.toLocaleString()} tokens · ${(s.ai.userKeyShare * 100).toFixed(0)}% on users' own keys`} />
        </div>
        <p className="mt-3 text-sm text-muted">By task: {Object.entries(s.ai.byTask).map(([k, v]) => `${k} ${v}`).join(" · ") || "none"}</p>
        <p className="mt-1 text-xs text-muted">Costs are estimates from token counts × list prices for known models (requests made with users&apos; own keys count as $0). Set provider-side spending limits as well — see the deployment guide.</p>
      </div>
    </div>
  );
}

const FIELDS: Record<string, Array<{ k: string; label: string; type?: "text" | "textarea" | "list" | "select" | "number" | "bool"; options?: string[] }>> = {
  vocabulary: [
    { k: "word", label: "Word" }, { k: "category", label: "Category", type: "select", options: ["daily", "office", "interview", "ielts", "professional", "travel", "business"] },
    { k: "meaning", label: "Meaning" }, { k: "pronunciation", label: "Pronunciation (e.g. kuh-MYOOT)" }, { k: "example", label: "Example sentence" },
    { k: "synonyms", label: "Synonyms (comma-separated)", type: "list" }, { k: "antonyms", label: "Antonyms (comma-separated)", type: "list" }, { k: "usage", label: "Usage note" }, { k: "hindi", label: "Hindi explanation" },
  ],
  interview_questions: [
    { k: "category", label: "Category", type: "select", options: ["hr", "fresher", "desktop", "helpdesk", "techsupport", "aws", "azure", "mainframe", "sysadmin", "customer", "teamlead", "manager"] },
    { k: "question", label: "Question", type: "textarea" }, { k: "keywords", label: "Expected keywords (comma-separated)", type: "list" }, { k: "tip", label: "Hint for learners" },
    { k: "sample_answer", label: "Sample answer (optional)", type: "textarea" }, { k: "behavioural", label: "Behavioural (STAR) question", type: "bool" },
  ],
  ielts_questions: [
    { k: "module", label: "Module", type: "select", options: ["speaking"] }, { k: "variant", label: "Variant", type: "select", options: ["both", "academic", "general"] },
    { k: "title", label: "Title" }, { k: "content.part", label: "Speaking part (1 or 2)", type: "number" }, { k: "content.topic", label: "Topic" }, { k: "content.prompt", label: "Question / cue card", type: "textarea" },
    { k: "content.bullets", label: "Cue-card bullets (comma-separated)", type: "list" },
  ],
  daily_lessons: [
    { k: "day", label: "Challenge day (1–30) to override", type: "number" }, { k: "title", label: "Title" }, { k: "objective", label: "Objective" }, { k: "task", label: "Speaking task", type: "textarea" },
    { k: "lesson", label: "Lesson points (one per line)", type: "textarea" }, { k: "keywords", label: "Relevance keywords (comma-separated)", type: "list" }, { k: "min_seconds", label: "Minimum seconds", type: "number" },
  ],
};

function Content() {
  const [table, setTable] = useState("interview_questions");
  const [rows, setRows] = useState<Array<Record<string, unknown>>>([]);
  const [form, setForm] = useState<Record<string, string | boolean>>({});
  const [msg, setMsg] = useState("");
  const load = useCallback(() => { api(`/api/admin/content?table=${table}`).then((j) => setRows(j.rows)).catch((e) => setMsg(e.message)); }, [table]);
  useEffect(() => { setForm({}); setMsg(""); load(); }, [load]);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    const body: Record<string, unknown> = { published: true };
    for (const f of FIELDS[table]) {
      const raw = form[f.k];
      if (raw === undefined || raw === "") continue;
      let v: unknown = raw;
      if (f.type === "list") v = String(raw).split(",").map((x) => x.trim()).filter(Boolean);
      if (f.type === "number") v = Number(raw);
      if (table === "daily_lessons" && f.k === "lesson") v = String(raw).split("\n").map((x) => x.trim()).filter(Boolean);
      if (f.k.startsWith("content.")) body.content = { ...(body.content as object), [f.k.slice(8)]: v };
      else body[f.k] = v;
    }
    if (table === "ielts_questions" && !body.content) body.content = {};
    try {
      await api(`/api/admin/content?table=${table}`, { method: "POST", body: JSON.stringify(body) });
      setMsg("Saved. Learners will see it on their next visit.");
      setForm({});
      load();
    } catch (err) { setMsg((err as Error).message); }
  }

  async function remove(id: string) {
    if (!confirm("Delete this item?")) return;
    await api(`/api/admin/content?table=${table}&id=${id}`, { method: "DELETE" }).catch((e) => setMsg(e.message));
    load();
  }

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <form onSubmit={save} className="card space-y-3 p-4">
        <select className="input" value={table} onChange={(e) => setTable(e.target.value)} aria-label="Content type">
          <option value="interview_questions">Interview questions</option><option value="vocabulary">Vocabulary</option><option value="ielts_questions">IELTS speaking questions</option><option value="daily_lessons">30-day curriculum overrides</option>
        </select>
        {FIELDS[table].map((f) => (
          <label key={f.k} className="block text-sm">
            <span className="label">{f.label}</span>
            {f.type === "textarea" ? <textarea className="input mt-1 min-h-20" value={String(form[f.k] ?? "")} onChange={(e) => setForm({ ...form, [f.k]: e.target.value })} />
              : f.type === "select" ? <select className="input mt-1" value={String(form[f.k] ?? "")} onChange={(e) => setForm({ ...form, [f.k]: e.target.value })}><option value="">Choose…</option>{f.options!.map((o) => <option key={o}>{o}</option>)}</select>
              : f.type === "bool" ? <input type="checkbox" className="ml-2" checked={!!form[f.k]} onChange={(e) => setForm({ ...form, [f.k]: e.target.checked })} />
              : <input className="input mt-1" type={f.type === "number" ? "number" : "text"} value={String(form[f.k] ?? "")} onChange={(e) => setForm({ ...form, [f.k]: e.target.value })} />}
          </label>
        ))}
        <button className="btn btn-primary w-full">Add / publish</button>
        {msg && <p className="text-sm text-muted">{msg}</p>}
      </form>
      <div className="card max-h-[70vh] overflow-y-auto p-4">
        <p className="font-semibold">Existing items ({rows.length})</p>
        <ul className="mt-2 divide-y divide-[var(--border)] text-sm">
          {rows.map((r) => (
            <li key={String(r.id)} className="flex items-start gap-2 py-2">
              <span className="flex-1">{String(r.question ?? r.word ?? r.title ?? "")}<span className="block text-xs text-muted">{String(r.category ?? r.module ?? (r.day ? `Day ${r.day}` : ""))}</span></span>
              <button onClick={() => remove(String(r.id))} className="text-muted hover:text-red-500" aria-label="Delete"><Trash2 size={16} /></button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

interface AppSettings { ai_enabled: boolean; ai_daily_limit_guest: number; ai_daily_limit_user: number; ai_global_daily_limit: number; features: Record<string, boolean> }

function SettingsTab() {
  const [s, setS] = useState<AppSettings | null>(null);
  const [msg, setMsg] = useState("");
  useEffect(() => { api("/api/admin/settings").then((j) => setS(j.settings)).catch((e) => setMsg(e.message)); }, []);
  if (!s) return <p className="text-muted">{msg || "Loading…"}</p>;
  const save = () => api("/api/admin/settings", { method: "PUT", body: JSON.stringify(s) }).then(() => setMsg("Saved.")).catch((e) => setMsg(e.message));
  return (
    <div className="card max-w-xl space-y-3 p-4">
      <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={s.ai_enabled} onChange={(e) => setS({ ...s, ai_enabled: e.target.checked })} /> AI features enabled (kill switch)</label>
      {([["ai_daily_limit_guest", "AI requests per guest (per IP) per day"], ["ai_daily_limit_user", "AI requests per signed-in user per day"], ["ai_global_daily_limit", "Global AI requests per day (per server instance)"]] as const).map(([k, l]) => (
        <label key={k} className="block text-sm"><span className="label">{l}</span><input type="number" min={0} className="input mt-1" value={s[k]} onChange={(e) => setS({ ...s, [k]: Number(e.target.value) })} /></label>
      ))}
      <p className="label">Feature availability</p>
      <div className="grid grid-cols-2 gap-2">
        {Object.entries(s.features).map(([k, v]) => <label key={k} className="flex items-center gap-2 text-sm capitalize"><input type="checkbox" checked={v} onChange={(e) => setS({ ...s, features: { ...s.features, [k]: e.target.checked } })} /> {k}</label>)}
      </div>
      <button onClick={save} className="btn btn-primary">Save settings</button>
      {msg && <p className="text-sm text-muted">{msg}</p>}
    </div>
  );
}

function Feedback() {
  const [items, setItems] = useState<Stats["feedback"]>([]);
  const load = () => api("/api/admin/stats").then((j) => setItems(j.feedback)).catch(() => {});
  useEffect(() => { load(); }, []);
  const setStatus = (id: string, status: string) => api("/api/feedback", { method: "PATCH", body: JSON.stringify({ id, status }) }).then(load);
  if (!items.length) return <p className="text-muted">No feedback yet.</p>;
  return (
    <ul className="space-y-2">
      {items.map((f) => (
        <li key={f.id} className="card p-3 text-sm">
          <div className="flex justify-between text-xs text-muted"><span>{new Date(f.created_at).toLocaleString()} · {f.page ?? ""} {f.rating ? `· ${"★".repeat(f.rating)}` : ""}</span>
            <select value={f.status} onChange={(e) => setStatus(f.id, e.target.value)} className="rounded border border-base bg-transparent text-xs"><option>new</option><option>reviewed</option><option>resolved</option></select>
          </div>
          <p className="mt-1">{f.message}</p>
        </li>
      ))}
    </ul>
  );
}

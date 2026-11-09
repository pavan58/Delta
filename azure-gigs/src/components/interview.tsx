"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { api } from "@/lib/client";
import { Button } from "./ui/button";
import { Select, Textarea } from "./ui/form";
import { Alert, Badge, Card, CardHeader, KV, statusColor, Table, Td, Th } from "./ui/misc";
import { timeAgo } from "@/lib/utils";

type Any = any; // eslint-disable-line @typescript-eslint/no-explicit-any

function IncidentPanel({ inc, onChange }: { inc: Any; onChange: () => void }) {
  const [rca, setRca] = useState({ rootCause: "", fixSummary: "", verification: "" });
  const [res, setRes] = useState<Any>(null);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const resolve = async () => {
    setBusy(true);
    setErr("");
    try {
      const r = await api(`/api/incidents/${inc.id}/resolve`, { body: rca });
      setRes(r);
      onChange();
    } catch (e) {
      setErr((e as Error).message);
    }
    setBusy(false);
  };
  const overdue = inc.status === "Open" && new Date(inc.dueAt) < new Date();
  return (
    <Card data-testid="incident-panel">
      <CardHeader title={`${inc.ticketNumber}: ${inc.title}`} subtitle={`Opened ${timeAgo(inc.createdAt)} · assigned to you`} actions={<><Badge color={statusColor(inc.severity)}>{inc.severity}</Badge><Badge color={statusColor(inc.status)}>{inc.status}</Badge>{overdue && <Badge color="red">SLA breached</Badge>}</>} />
      <div className="grid gap-4 p-4">
        <p className="text-sm">{inc.description}</p>
        <KV items={[["Business impact", inc.impact], ["Due", new Date(inc.dueAt).toLocaleString()], ["Affected resource", inc.targetResourceId ? <Link key="t" className="text-brand hover:underline" href={`/resources/${inc.targetResourceId}`}>Open resource</Link> : "-"], ["Hints used", `${inc.hintsUsed} / ${inc.totalHints} (−5 points each)`]]} />
        <div><p className="text-xs font-semibold text-muted">Acceptance criteria</p><ul className="ml-5 list-disc text-sm">{inc.acceptance.map((a: string) => <li key={a}>{a}</li>)}</ul></div>
        <Alert kind="info">Investigate with the portal (activity log, resource health, metrics, NSG rules, run command) or the <Link className="underline" href="/terminal">Cloud terminal</Link>. Your investigation steps are part of the score.</Alert>
        {inc.hints.map((h: string, i: number) => <Alert key={i} kind="warning">Hint {i + 1}: {h}</Alert>)}
        {inc.status === "Open" && (
          <>
            <div className="flex flex-wrap gap-2">{inc.hintsUsed < inc.totalHints && <Button size="sm" variant="secondary" onClick={() => api(`/api/incidents/${inc.id}/hint`, { body: {} }).then(onChange)}>Request a hint</Button>}<Button size="sm" variant="ghost" onClick={() => { if (window.confirm("Abandon this incident? The solution will be revealed and no score recorded.")) api(`/api/incidents/${inc.id}/abandon`, { body: {} }).then((r) => { setRes({ abandoned: true, solution: r.solution }); onChange(); }); }}>Abandon</Button></div>
            <div className="grid gap-2">
              <p className="text-sm font-semibold">Resolve with RCA</p>
              <label className="text-xs font-semibold" htmlFor={`rc-${inc.id}`}>Root cause</label><Textarea id={`rc-${inc.id}`} rows={2} value={rca.rootCause} onChange={(e) => setRca({ ...rca, rootCause: e.target.value })} />
              <label className="text-xs font-semibold" htmlFor={`fx-${inc.id}`}>Fix applied</label><Textarea id={`fx-${inc.id}`} rows={2} value={rca.fixSummary} onChange={(e) => setRca({ ...rca, fixSummary: e.target.value })} />
              <label className="text-xs font-semibold" htmlFor={`vf-${inc.id}`}>Verification</label><Textarea id={`vf-${inc.id}`} rows={2} value={rca.verification} onChange={(e) => setRca({ ...rca, verification: e.target.value })} />
              <div><Button onClick={resolve} disabled={busy || !rca.rootCause || !rca.fixSummary || !rca.verification}>{busy ? "Verifying…" : "Resolve incident"}</Button></div>
            </div>
          </>
        )}
        {err && <Alert kind="error">{err}</Alert>}
        {res && !res.abandoned && <Alert kind={res.resolved ? "success" : "error"} ><strong>{res.message}</strong>{res.resolved && <> Score: {res.score}/100</>}<ul className="ml-4 mt-1 list-disc text-xs">{Object.entries(res.breakdown).filter(([k]) => !["diagnosticsUsed", "verdict", "solution"].includes(k)).map(([k, v]) => <li key={k}>{k}: {String(v)}</li>)}<li>verdict: {res.breakdown.verdict}</li>{res.breakdown.solution && <li>solution: {res.breakdown.solution}</li>}</ul></Alert>}
        {res?.abandoned && <Alert kind="warning">Abandoned. Solution: {res.solution}</Alert>}
        {inc.resolution && <Alert kind="success">Resolved with score {inc.resolution.score}/100. Root cause: {inc.resolution.rootCause}</Alert>}
      </div>
    </Card>
  );
}

export function Incidents({ faults, focus }: { faults: { type: string; title: string; severity: string }[]; focus?: string }) {
  const [list, setList] = useState<Any[] | null>(null);
  const [sel, setSel] = useState<string | null>(focus ?? null);
  const [fault, setFault] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const load = () => api("/api/incidents").then((r) => { setList(r.incidents); if (!sel && r.incidents[0]) setSel(r.incidents.find((i: Any) => i.status === "Open")?.id ?? r.incidents[0].id); }).catch(() => setList([]));
  useEffect(() => {
    load();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const inject = async () => {
    setBusy(true);
    setErr("");
    try {
      const r = await api("/api/incidents", { body: { faultType: fault || undefined } });
      setSel(r.incident.id);
      await load();
    } catch (e) {
      setErr((e as Error).message);
    }
    setBusy(false);
  };
  const current = (list ?? []).find((i) => i.id === sel);
  return (
    <div className="grid gap-4 lg:grid-cols-[340px_1fr]">
      <div className="grid content-start gap-4">
        <Card className="grid gap-2 p-4">
          <p className="text-sm font-semibold">Inject a production fault</p>
          <p className="text-xs text-muted">A fault is injected into your subscription (reusing your resources where possible, otherwise in rg-contoso-prod). The solution is hidden until you resolve, request hints, or abandon.</p>
          <Select aria-label="Fault type" value={fault} onChange={(e) => setFault(e.target.value)}><option value="">Random fault (interview mode)</option>{faults.map((f) => <option key={f.type} value={f.type}>{f.title} ({f.severity})</option>)}</Select>
          <Button onClick={inject} disabled={busy}>{busy ? "Injecting…" : "Inject fault & open ticket"}</Button>
          {err && <Alert kind="error">{err}</Alert>}
        </Card>
        <Card><CardHeader title="Tickets" />
          <ul className="divide-y divide-line">{(list ?? []).map((i) => <li key={i.id}><button onClick={() => setSel(i.id)} className={`w-full px-3 py-2 text-left text-sm hover:bg-subtle ${sel === i.id ? "bg-brand-bg" : ""}`}><span className="font-mono text-xs">{i.ticketNumber}</span> <Badge color={statusColor(i.status)}>{i.status}</Badge><br />{i.title}</button></li>)}{list && !list.length && <li className="px-3 py-3 text-sm text-muted">No incidents yet.</li>}</ul>
        </Card>
      </div>
      {current ? <IncidentPanel key={current.id + current.hintsUsed} inc={current} onChange={load} /> : <Card className="p-6 text-sm text-muted">Select or inject an incident.</Card>}
    </div>
  );
}

export function MockInterview({ questions }: { questions: { topic: string; level: string; q: string }[] }) {
  const [picked, setPicked] = useState<number[]>([]);
  const [answers, setAnswers] = useState<Record<number, string>>({});
  const [res, setRes] = useState<Any>(null);
  const start = () => {
    const idx = [...questions.keys()].sort(() => Math.random() - 0.5).slice(0, 5);
    setPicked(idx);
    setAnswers({});
    setRes(null);
  };
  return (
    <Card><CardHeader title="Mock technical interview" subtitle="5 random questions. Answers are scored on key concepts; model answers are revealed after submission." actions={<Button size="sm" onClick={start}>{picked.length ? "New interview" : "Start interview"}</Button>} />
      {picked.length > 0 && (
        <div className="grid gap-4 p-4">
          {picked.map((i, n) => (
            <div key={i} className="grid gap-1">
              <label className="text-sm font-semibold" htmlFor={`mi-${i}`}>{n + 1}. {questions[i].q} <span className="text-xs font-normal text-muted">({questions[i].topic}, {questions[i].level})</span></label>
              <Textarea id={`mi-${i}`} rows={3} value={answers[i] ?? ""} onChange={(e) => setAnswers({ ...answers, [i]: e.target.value })} />
              {res && <Alert kind={res.review[n].score >= 60 ? "success" : "warning"}>Score {res.review[n].score}/100. Missed: {res.review[n].missed.join(", ") || "nothing"}.<br /><span className="text-xs">Model answer: {res.review[n].modelAnswer}</span></Alert>}
            </div>
          ))}
          <div className="flex items-center gap-3"><Button onClick={() => api("/api/interview", { body: { answers: picked.map((i) => ({ index: i, answer: answers[i] ?? "" })) } }).then(setRes)}>Submit answers</Button>{res && <Badge color={res.score >= 60 ? "green" : "amber"}>Overall {res.score}/100</Badge>}</div>
        </div>
      )}
    </Card>
  );
}

export function QuestionBank({ questions }: { questions: { topic: string; level: string; q: string; a: string }[] }) {
  const [topic, setTopic] = useState("");
  const topics = [...new Set(questions.map((q) => q.topic))];
  return (
    <Card><CardHeader title="Question bank" actions={<Select aria-label="Topic" className="h-7 w-44 text-xs" value={topic} onChange={(e) => setTopic(e.target.value)}><option value="">All topics</option>{topics.map((t) => <option key={t}>{t}</option>)}</Select>} />
      <Table><thead><tr><Th>Question</Th><Th>Topic</Th><Th>Level</Th></tr></thead><tbody>{questions.filter((q) => !topic || q.topic === topic).map((q, i) => <tr key={i}><Td><details><summary className="cursor-pointer">{q.q}</summary><p className="mt-1 text-muted">{q.a}</p></details></Td><Td>{q.topic}</Td><Td>{q.level}</Td></tr>)}</tbody></Table>
    </Card>
  );
}

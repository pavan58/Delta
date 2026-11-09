"use client";
import Link from "next/link";
import { useMemo, useState } from "react";
import { api } from "@/lib/client";
import { Button } from "./ui/button";
import { Input, Select, Textarea } from "./ui/form";
import { Alert, Badge, Card, CardHeader, Pre, statusColor, Table, Td, Th } from "./ui/misc";
import { Progress } from "./charts";
import { Terminal } from "./terminal";

type Any = any; // eslint-disable-line @typescript-eslint/no-explicit-any

export function LabCatalog({ labs }: { labs: { slug: string; title: string; difficulty: string; category: string; durationMinutes: number; isCapstone: boolean; status: string; bestScore: number }[] }) {
  const [q, setQ] = useState("");
  const [diff, setDiff] = useState("");
  const [cat, setCat] = useState("");
  const [status, setStatus] = useState("");
  const cats = useMemo(() => [...new Set(labs.map((l) => l.category))].sort(), [labs]);
  const rows = labs.filter((l) => (!q || l.title.toLowerCase().includes(q.toLowerCase())) && (!diff || l.difficulty === diff) && (!cat || l.category === cat) && (!status || l.status === status));
  return (
    <Card>
      <div className="grid gap-2 border-b border-line p-3 sm:grid-cols-4">
        <Input aria-label="Search labs" placeholder="Search labs…" value={q} onChange={(e) => setQ(e.target.value)} />
        <Select aria-label="Difficulty" value={diff} onChange={(e) => setDiff(e.target.value)}><option value="">All levels</option><option>Beginner</option><option>Intermediate</option><option>Advanced</option></Select>
        <Select aria-label="Category" value={cat} onChange={(e) => setCat(e.target.value)}><option value="">All categories</option>{cats.map((c) => <option key={c}>{c}</option>)}</Select>
        <Select aria-label="Status" value={status} onChange={(e) => setStatus(e.target.value)}><option value="">Any status</option><option value="not started">Not started</option><option value="started">In progress</option><option value="completed">Completed</option></Select>
      </div>
      <p className="px-3 pt-2 text-xs text-muted">{rows.length} of {labs.length} labs</p>
      <Table><thead><tr><Th>Lab</Th><Th>Level</Th><Th>Category</Th><Th>Time</Th><Th>Status</Th><Th>Best score</Th></tr></thead><tbody>
        {rows.map((l) => <tr key={l.slug}><Td><Link className="font-medium text-brand hover:underline" href={`/labs/${l.slug}`}>{l.title}</Link>{l.isCapstone && <Badge color="blue" className="ml-2">Capstone</Badge>}</Td><Td>{l.difficulty}</Td><Td>{l.category}</Td><Td>{l.durationMinutes} min</Td><Td><Badge color={l.status === "completed" ? "green" : l.status === "started" ? "amber" : "gray"}>{l.status}</Badge></Td><Td>{l.bestScore || "-"}</Td></tr>)}
      </tbody></Table>
    </Card>
  );
}

export function LabRunner({ lab, progress, lastScore }: { lab: Any; progress: Any; lastScore: Any }) {
  const [started, setStarted] = useState(!!progress);
  const [incidentId, setIncidentId] = useState<string | null>(null);
  const [hints, setHints] = useState(0);
  const [notes, setNotes] = useState("");
  const [result, setResult] = useState<Any>(lastScore);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [showSolution, setShowSolution] = useState(false);
  const start = async () => {
    setBusy(true);
    setError("");
    try {
      const r = await api(`/api/labs/${lab.slug}/start`, { body: {} });
      setStarted(true);
      setIncidentId(r.incidentId);
    } catch (e) {
      setError((e as Error).message);
    }
    setBusy(false);
  };
  const submit = async () => {
    setBusy(true);
    setError("");
    try {
      setResult(await api(`/api/labs/${lab.slug}/submit`, { body: { notes } }));
    } catch (e) {
      setError((e as Error).message);
    }
    setBusy(false);
  };
  return (
    <div className="grid gap-4 xl:grid-cols-[1fr_1fr]">
      <div className="grid content-start gap-4">
        <Card className="p-4">
          <div className="flex flex-wrap gap-2"><Badge color="blue">{lab.difficulty}</Badge><Badge>{lab.category}</Badge><Badge>{lab.durationMinutes} min</Badge>{progress?.status === "completed" && <Badge color="green">Completed · best {progress.bestScore}</Badge>}</div>
          <h2 className="mt-3 text-sm font-semibold">Learning objective</h2><p className="text-sm">{lab.objective}</p>
          <h2 className="mt-3 text-sm font-semibold">Business scenario</h2><p className="text-sm">{lab.scenario}</p>
          {lab.prerequisites.length > 0 && <><h2 className="mt-3 text-sm font-semibold">Prerequisites</h2><p className="text-sm">{lab.prerequisites.map((p: string) => <span key={p} className="mr-2">{p.includes(" ") ? p : <Link className="text-brand hover:underline" href={`/labs/${p}`}>{p}</Link>}</span>)}</p></>}
          <h2 className="mt-3 text-sm font-semibold">Expected outcome</h2><p className="text-sm">{lab.expectedOutcome}</p>
          {!started ? <Button className="mt-4" onClick={start} disabled={busy}>{busy ? "Starting…" : lab.setupFault ? "Start lab (opens an incident)" : "Start lab"}</Button> : <Alert kind="success" className="mt-4">Lab started. Work in the portal or the terminal - your real simulator state is graded on submit.{incidentId && <> An incident ticket was opened: <Link className="underline" href={`/interview?incident=${incidentId}`}>view ticket</Link>.</>}</Alert>}
          {error && <Alert kind="error" className="mt-3">{error}</Alert>}
        </Card>
        <Card><CardHeader title="Step-by-step instructions" />
          <ol className="grid gap-3 p-4">{lab.steps.map((s: Any, i: number) => <li key={i} className="grid grid-cols-[28px_1fr] gap-2"><span className="grid size-6 place-items-center rounded-full bg-brand-bg text-xs font-semibold text-brand">{i + 1}</span><div><p className="text-sm font-semibold">{s.title}</p><p className="whitespace-pre-wrap text-sm text-ink">{s.body}</p></div></li>)}</ol>
        </Card>
        {lab.commands.length > 0 && <Card><CardHeader title="Terminal commands" subtitle="Reference commands (adapt names to yours)" /><div className="p-3"><Pre>{lab.commands.join("\n")}</Pre></div></Card>}
        <Card><CardHeader title="Validation checks" subtitle="What the auto-grader verifies (100 points: configuration 40, execution 30, security 20, documentation 10)" />
          <ul className="grid gap-1 p-4 text-sm">{lab.checks.map((c: Any, i: number) => <li key={i} className="flex gap-2"><Badge>{c.category}</Badge>{c.label}</li>)}</ul>
        </Card>
        <Card className="grid gap-2 p-4">
          <h2 className="text-sm font-semibold">Common mistakes</h2><ul className="ml-5 list-disc text-sm">{lab.commonMistakes.map((m: string) => <li key={m}>{m}</li>)}{!lab.commonMistakes.length && <li>Skipping verification.</li>}</ul>
          <h2 className="mt-2 text-sm font-semibold">Hints</h2>
          {lab.hints.slice(0, hints).map((h: string, i: number) => <Alert key={i} kind="info">{h}</Alert>)}
          {hints < lab.hints.length && <div><Button size="sm" variant="secondary" onClick={() => setHints(hints + 1)}>Reveal hint {hints + 1} of {lab.hints.length}</Button></div>}
        </Card>
      </div>
      <div className="grid content-start gap-4">
        <Terminal compact />
        <Card>
          <CardHeader title="Submit for grading" subtitle="The grader inspects your live resources, command history, activity log and incidents." />
          <div className="grid gap-2 p-4">
            <label className="text-xs font-semibold" htmlFor="lab-notes">Notes / documentation (counts for 10 points)</label>
            <Textarea id="lab-notes" rows={5} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="What did you build, how did you verify it, what would you change in production?" />
            <div><Button onClick={submit} disabled={busy || !started}>{busy ? "Grading…" : "Submit lab"}</Button>{!started && <span className="ml-2 text-xs text-muted">Start the lab first.</span>}</div>
          </div>
        </Card>
        {result && (
          <Card data-testid="lab-result">
            <CardHeader title={`Score: ${result.total}/100 - ${result.passed ? "Passed" : "Not passed yet"}`} subtitle="Pass mark: 70" />
            <div className="grid gap-3 p-4">
              <Progress value={result.total} label="Total" />
              <div className="grid grid-cols-2 gap-2 text-sm sm:grid-cols-4">{Object.entries(result.scores).map(([k, v]) => <div key={k} className="rounded-sm bg-subtle p-2"><p className="text-xs capitalize text-muted">{k}</p><p className="font-semibold">{v as number}</p></div>)}</div>
              <Table><thead><tr><Th>Check</Th><Th>Result</Th><Th>Detail</Th></tr></thead><tbody>{result.results.map((r: Any, i: number) => <tr key={i}><Td>{r.label}<p className="text-[11px] text-muted">{r.category}</p></Td><Td><Badge color={r.passed ? "green" : "red"}>{r.passed ? "Passed" : "Failed"}</Badge></Td><Td className="text-xs">{r.detail}{r.hint && <p className="mt-1 text-brand">Hint: {r.hint}</p>}</Td></tr>)}</tbody></Table>
              {result.suggestions?.length > 0 && <Alert kind="warning"><p className="font-semibold">Improvement suggestions</p><ul className="ml-4 list-disc">{result.suggestions.map((s: string, i: number) => <li key={i}>{s}</li>)}</ul></Alert>}
              {result.solution && <Alert kind="success"><strong>Solution explanation:</strong> {result.solution}</Alert>}
            </div>
          </Card>
        )}
        {(progress?.status === "completed" || result?.passed) && (
          <Card className="grid gap-2 p-4">
            <h2 className="text-sm font-semibold">Interview questions</h2>
            {lab.interviewQuestions.map((q: Any, i: number) => <details key={i} className="text-sm"><summary className="cursor-pointer font-medium">{q.q}</summary><p className="mt-1 text-muted">{q.a}</p></details>)}
            {!showSolution ? <div><Button size="sm" variant="secondary" onClick={() => setShowSolution(true)}>Show solution</Button></div> : <Alert kind="info">{lab.solution}</Alert>}
          </Card>
        )}
      </div>
    </div>
  );
}

export function PathDetail({ data }: { data: Any }) {
  const [questions, setQuestions] = useState<Any[] | null>(null);
  const [answers, setAnswers] = useState<number[]>([]);
  const [res, setRes] = useState<Any>(null);
  const [cert, setCert] = useState<Any>(data.certificate);
  const [error, setError] = useState("");
  const loadQ = () => {
    setQuestions(data.assessmentQuestions);
    setAnswers(new Array(data.assessmentQuestions.length).fill(-1));
  };
  return (
    <div className="grid gap-4">
      <Card className="p-4"><Progress value={data.totals.percent} label={`${data.totals.completed} of ${data.totals.labs} labs completed`} /></Card>
      {data.modules.map((m: Any, i: number) => (
        <Card key={m.slug}><CardHeader title={`Module ${i + 1}: ${m.title}`} subtitle={m.description} />
          <Table><tbody>{m.labs.map((l: Any) => <tr key={l.slug}><Td><Link className="text-brand hover:underline" href={`/labs/${l.slug}`}>{l.title}</Link>{l.isCapstone && <Badge color="blue" className="ml-2">Capstone</Badge>}</Td><Td>{l.difficulty}</Td><Td>{l.durationMinutes} min</Td><Td><Badge color={l.status === "completed" ? "green" : l.status === "started" ? "amber" : "gray"}>{l.status}</Badge></Td><Td>{l.bestScore || "-"}</Td></tr>)}</tbody></Table>
        </Card>
      ))}
      {data.assessment && (
        <Card><CardHeader title="Path assessment" subtitle={`${data.assessment.questions} questions · pass mark ${data.assessment.passMark}% · best ${data.assessment.best ?? "-"}%`} actions={!questions && <Button size="sm" onClick={loadQ}>Take assessment</Button>} />
          {questions && (
            <div className="grid gap-4 p-4">
              {questions.map((q: Any, i: number) => (
                <fieldset key={i} className="grid gap-1"><legend className="text-sm font-semibold">{i + 1}. {q.q}</legend>
                  {q.options.map((o: string, j: number) => <label key={j} className="flex items-center gap-2 text-sm"><input type="radio" className="accent-brand" name={`q${i}`} checked={answers[i] === j} onChange={() => setAnswers(answers.map((a, k) => (k === i ? j : a)))} />{o}</label>)}
                  {res && <p className={`text-xs ${res.review[i].correct ? "text-ok" : "text-danger"}`}>{res.review[i].correct ? "Correct" : `Incorrect - ${q.options[res.review[i].correctAnswer]}`}. {res.review[i].explanation}</p>}
                </fieldset>
              ))}
              <div className="flex items-center gap-3"><Button onClick={() => api(`/api/assessments/${data.assessment.slug}`, { body: { answers } }).then(setRes).catch((e) => setError(e.message))}>Submit answers</Button>{res && <Badge color={res.passed ? "green" : "red"}>{res.score}% - {res.passed ? "Passed" : "Not passed"}</Badge>}</div>
            </div>
          )}
        </Card>
      )}
      <Card className="grid gap-2 p-4">
        <h2 className="text-sm font-semibold">Course-completion certificate</h2>
        <p className="text-xs text-muted">Requires 80% of the path's labs passed and the assessment passed. Azure Gigs certificates are not Microsoft certifications.</p>
        {cert ? <Alert kind="success">Certificate <strong className="font-mono">{cert.certificateId}</strong> issued {new Date(cert.issuedAt).toDateString()}. Verification URL: <Link className="underline" href={`/verify/${cert.certificateId}`}>/verify/{cert.certificateId}</Link></Alert> : <div><Button onClick={() => api("/api/certificates", { body: { path: data.slug } }).then((r) => setCert(r.certificate)).catch((e) => setError(e.message))}>Claim certificate</Button></div>}
        {error && <Alert kind="error">{error}</Alert>}
      </Card>
    </div>
  );
}

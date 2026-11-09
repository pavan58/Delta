"use client";
import Link from "next/link";
import { useState } from "react";
import { Play } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Select, Textarea } from "@/components/ui/form";
import { Alert, Badge, Card, CardHeader, KV, Pre, statusColor, Table, Td, Th } from "@/components/ui/misc";
import { CodeEditor } from "@/components/code-editor";
import { action, useAction, useResources } from "./hooks";
import { ActionResult } from "./panels-compute";
import type { Detail } from "./detail";
import { T } from "@/lib/sim/types";
import { timeAgo } from "@/lib/utils";

type P = { d: Detail; reload: () => void };

// ---------------- DevOps ----------------
function Boards({ d, reload }: P) {
  const items = d.resource.properties.workItems as Detail[];
  const [f, setF] = useState({ type: "User Story", title: "", assignedTo: "" });
  const a = useAction();
  const cols = ["New", "Active", "Resolved", "Closed"];
  return (
    <div className="grid gap-3">
      <Card className="flex flex-wrap gap-2 p-3">
        <Select aria-label="Work item type" className="w-36" value={f.type} onChange={(e) => setF({ ...f, type: e.target.value })}>{["Epic", "Feature", "User Story", "Task", "Bug"].map((t) => <option key={t}>{t}</option>)}</Select>
        <Input aria-label="Title" className="min-w-60 flex-1" placeholder="Title" value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} />
        <Input aria-label="Assigned to" className="w-48" placeholder="Assigned to" value={f.assignedTo} onChange={(e) => setF({ ...f, assignedTo: e.target.value })} />
        <Button onClick={() => a.run(() => action(d.resource.id, "addWorkItem", f)).then((r) => { if (r) setF({ ...f, title: "" }); reload(); })}>New work item</Button>
      </Card>
      <ActionResult a={a} />
      <div className="grid gap-3 md:grid-cols-4">
        {cols.map((c) => (
          <Card key={c} className="bg-subtle">
            <p className="border-b border-line px-3 py-2 text-xs font-semibold uppercase text-muted">{c} ({items.filter((i) => i.state === c).length})</p>
            <div className="grid gap-2 p-2">
              {items.filter((i) => i.state === c).map((i) => (
                <div key={i.id} className="rounded-sm border border-line bg-surface p-2 text-sm">
                  <p className="text-xs text-muted">{i.type} #{i.id}</p>
                  <p className="font-medium">{i.title}</p>
                  {i.assignedTo && <p className="text-xs text-muted">{i.assignedTo}</p>}
                  <Select aria-label={`Move ${i.title}`} className="mt-1 h-7 text-xs" value={i.state} onChange={(e) => a.run(() => action(d.resource.id, "moveWorkItem", { id: i.id, state: e.target.value })).then(reload)}>{cols.map((x) => <option key={x}>{x}</option>)}</Select>
                </div>
              ))}
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}

function Repos({ d, reload }: P) {
  const repos = d.resource.properties.repos as Detail[];
  const [repo, setRepo] = useState(repos[0]?.name);
  const r = repos.find((x) => x.name === repo) ?? repos[0];
  const [branch, setBranch] = useState(r?.defaultBranch ?? "main");
  const files = r?.branches[branch]?.files ?? {};
  const [path, setPath] = useState("azure-pipelines.yml");
  const [content, setContent] = useState<string>(files["azure-pipelines.yml"] ?? "");
  const [msg, setMsg] = useState("Update file");
  const [newBranch, setNewBranch] = useState("");
  const [policy, setPolicy] = useState({ requirePr: !!r?.branchPolicy?.requirePr, minReviewers: r?.branchPolicy?.minReviewers ?? 1 });
  const a = useAction();
  const open = (p: string) => { setPath(p); setContent(files[p] ?? ""); };
  return (
    <div className="grid gap-3 lg:grid-cols-[260px_1fr]">
      <Card>
        <div className="grid gap-2 border-b border-line p-3">
          <Select aria-label="Repository" value={repo} onChange={(e) => setRepo(e.target.value)}>{repos.map((x) => <option key={x.name}>{x.name}</option>)}</Select>
          <Select aria-label="Branch" value={branch} onChange={(e) => { setBranch(e.target.value); setContent(r.branches[e.target.value]?.files[path] ?? ""); }}>{Object.keys(r?.branches ?? {}).map((b) => <option key={b}>{b}</option>)}</Select>
          <div className="flex gap-1"><Input aria-label="New branch name" placeholder="feature/x" value={newBranch} onChange={(e) => setNewBranch(e.target.value)} /><Button size="sm" onClick={() => a.run(() => action(d.resource.id, "createBranch", { repo, name: newBranch, from: branch })).then(() => { setBranch(newBranch); setNewBranch(""); reload(); })}>Branch</Button></div>
        </div>
        <ul className="py-1">{Object.keys(files).sort().map((f) => <li key={f}><button onClick={() => open(f)} className={`w-full px-3 py-1 text-left font-mono text-xs hover:bg-subtle ${f === path ? "bg-brand-bg text-brand" : ""}`}>{f}</button></li>)}</ul>
        <div className="grid gap-2 border-t border-line p-3 text-sm">
          <p className="text-xs font-semibold">Branch policy ({r?.defaultBranch})</p>
          <label className="flex items-center gap-2"><input type="checkbox" className="accent-brand" checked={policy.requirePr} onChange={(e) => setPolicy({ ...policy, requirePr: e.target.checked })} />Require pull request</label>
          <label className="flex items-center gap-2">Min reviewers <Input aria-label="Minimum reviewers" className="h-7 w-16" type="number" value={policy.minReviewers} onChange={(e) => setPolicy({ ...policy, minReviewers: Number(e.target.value) })} /></label>
          <Button size="sm" variant="secondary" onClick={() => a.run(() => action(d.resource.id, "setBranchPolicy", { repo, ...policy })).then(reload)}>Save policy</Button>
        </div>
      </Card>
      <Card className="grid gap-2 p-3">
        <div className="flex flex-wrap gap-2"><Input aria-label="File path" className="w-72 font-mono text-xs" value={path} onChange={(e) => setPath(e.target.value)} /><Input aria-label="Commit message" className="min-w-48 flex-1" value={msg} onChange={(e) => setMsg(e.target.value)} /><Button onClick={() => a.run(() => action(d.resource.id, "commitFile", { repo, branch, path, content, message: msg })).then(reload)}>Commit</Button></div>
        <CodeEditor label={`Editor for ${path}`} language={path.endsWith(".yml") || path.endsWith(".yaml") ? "yaml" : path.endsWith(".json") ? "json" : path.endsWith(".js") ? "javascript" : "plaintext"} value={content} onChange={setContent} height={360} />
        <ActionResult a={a} />
        {a.result?.triggered?.length > 0 && <Alert kind="info">CI triggered: {a.result.triggered.map((t: Detail) => `${t.pipeline} #${t.id} ${t.status}`).join(", ")}</Alert>}
        <h3 className="mt-2 text-sm font-semibold">Commits ({branch})</h3>
        <ul className="text-xs">{(r?.branches[branch]?.commits ?? []).slice(0, 10).map((c: Detail) => <li key={c.id} className="flex gap-2 py-0.5"><span className="font-mono text-brand">{c.id}</span><span>{c.message}</span><span className="text-muted">{c.author} · {timeAgo(c.time)}</span></li>)}</ul>
      </Card>
    </div>
  );
}

function PullRequests({ d, reload }: P) {
  const p = d.resource.properties;
  const repo = p.repos[0];
  const [f, setF] = useState({ source: Object.keys(repo.branches).find((b) => b !== "main") ?? "", target: "main", title: "" });
  const a = useAction();
  return (
    <Card>
      <div className="flex flex-wrap gap-2 border-b border-line p-3">
        <Select aria-label="Source branch" className="w-44" value={f.source} onChange={(e) => setF({ ...f, source: e.target.value })}><option value="">source</option>{Object.keys(repo.branches).map((b) => <option key={b}>{b}</option>)}</Select>
        <Select aria-label="Target branch" className="w-36" value={f.target} onChange={(e) => setF({ ...f, target: e.target.value })}>{Object.keys(repo.branches).map((b) => <option key={b}>{b}</option>)}</Select>
        <Input aria-label="PR title" className="min-w-48 flex-1" placeholder="Title" value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} />
        <Button onClick={() => a.run(() => action(d.resource.id, "createPullRequest", { repo: repo.name, ...f })).then(reload)}>Create pull request</Button>
      </div>
      <div className="p-3"><ActionResult a={a} /></div>
      <Table><thead><tr><Th>ID</Th><Th>Title</Th><Th>Branches</Th><Th>Approvals</Th><Th>Status</Th><Th /></tr></thead><tbody>
        {(p.pullRequests as Detail[]).map((pr) => <tr key={pr.id}><Td>!{pr.id}</Td><Td>{pr.title}<p className="text-xs text-muted">{pr.changes.map((c: Detail) => `${c.change} ${c.path}`).join(", ")}</p></Td><Td className="text-xs">{pr.source} → {pr.target}</Td><Td>{pr.approvals}</Td><Td><Badge color={pr.status === "Completed" ? "green" : "blue"}>{pr.status}</Badge></Td>
          <Td className="whitespace-nowrap">{pr.status === "Active" && <><Button size="sm" variant="ghost" onClick={() => a.run(() => action(d.resource.id, "approvePullRequest", { id: pr.id })).then(reload)}>Approve</Button><Button size="sm" variant="ghost" onClick={() => a.run(() => action(d.resource.id, "completePullRequest", { id: pr.id })).then(reload)}>Complete</Button></>}</Td></tr>)}
      </tbody></Table>
    </Card>
  );
}

function Pipelines({ d, reload }: P) {
  const p = d.resource.properties;
  const [f, setF] = useState({ name: "", yamlPath: "azure-pipelines.yml" });
  const [run, setRun] = useState<Detail | null>(null);
  const a = useAction();
  const trigger = async (name: string, approve = false) => {
    const r = await a.run(() => action(d.resource.id, "runPipeline", { pipeline: name, approve }));
    if (r) setRun(r.result);
    reload();
  };
  return (
    <div className="grid gap-3">
      <Card className="flex flex-wrap gap-2 p-3"><Input aria-label="Pipeline name" className="w-48" placeholder="todo-ci" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /><Input aria-label="YAML path" className="w-56 font-mono text-xs" value={f.yamlPath} onChange={(e) => setF({ ...f, yamlPath: e.target.value })} /><Button onClick={() => a.run(() => action(d.resource.id, "createPipeline", f)).then(reload)}>New pipeline</Button></Card>
      <ActionResult a={a} />
      <Card><Table><thead><tr><Th>Pipeline</Th><Th>Definition</Th><Th>Last run</Th><Th /></tr></thead><tbody>
        {(p.pipelines as Detail[]).map((pl) => <tr key={pl.name}><Td>{pl.name}</Td><Td className="font-mono text-xs">{pl.yamlPath}</Td><Td>{pl.runs[0] ? <button className="text-left" onClick={() => setRun(pl.runs[0])}><Badge color={statusColor(pl.runs[0].status)}>#{pl.runs[0].id} {pl.runs[0].status}</Badge></button> : "Never run"}</Td>
          <Td className="whitespace-nowrap"><Button size="sm" onClick={() => trigger(pl.name)}><Play />Run</Button>{pl.runs[0]?.status === "pending approval" && <Button size="sm" variant="secondary" className="ml-1" onClick={() => trigger(pl.name, true)}>Approve & deploy</Button>}</Td></tr>)}
        {!p.pipelines.length && <tr><Td colSpan={4} className="text-muted">No pipelines. Create one from a YAML file in the repo.</Td></tr>}
      </tbody></Table></Card>
      {(p.pipelines as Detail[]).flatMap((pl) => pl.runs.slice(0, 5)).length > 0 && (
        <Card><CardHeader title="Run history" /><Table><thead><tr><Th>Run</Th><Th>Reason</Th><Th>Branch</Th><Th>Status</Th><Th>Started</Th></tr></thead><tbody>{(p.pipelines as Detail[]).flatMap((pl) => pl.runs.slice(0, 5)).map((r: Detail) => <tr key={`${r.pipeline}-${r.id}`} className="cursor-pointer hover:bg-subtle" onClick={() => setRun(r)}><Td>{r.pipeline} #{r.id}</Td><Td>{r.reason}</Td><Td>{r.branch}</Td><Td><Badge color={statusColor(r.status)}>{r.status}</Badge></Td><Td>{timeAgo(r.startedAt)}</Td></tr>)}</tbody></Table></Card>
      )}
      {run && (
        <Card>
          <CardHeader title={`${run.pipeline} #${run.id} - ${run.status}`} subtitle={run.errorSummary} />
          <div className="grid gap-3 p-3">
            {run.stages.map((s: Detail) => (
              <div key={s.name}><p className="text-sm font-semibold">Stage {s.name} <Badge color={statusColor(s.status)}>{s.status}</Badge>{s.environment && <span className="ml-2 text-xs text-muted">environment: {s.environment}</span>}</p>
                {s.jobs.map((j: Detail) => <div key={j.name} className="ml-3 mt-1"><p className="text-xs font-semibold">Job {j.name} <Badge color={statusColor(j.status)}>{j.status}</Badge></p>{j.steps.map((st: Detail, i: number) => <details key={i} className="ml-3 text-xs" open={st.status === "failed"}><summary className="cursor-pointer"><Badge color={statusColor(st.status)}>{st.status}</Badge> {st.name}</summary><Pre>{st.log.join("\n")}</Pre></details>)}</div>)}
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}

function Settings({ d, reload }: P) {
  const p = d.resource.properties;
  const [sc, setSc] = useState({ name: "", type: "AzureRM", target: "" });
  const [env, setEnv] = useState({ name: "", approvals: false });
  const a = useAction();
  return (
    <div className="grid gap-3 md:grid-cols-2">
      <Card><CardHeader title="Service connections" />
        <Table><tbody>{(p.serviceConnections as Detail[]).map((s) => <tr key={s.name}><Td>{s.name}</Td><Td>{s.type}</Td><Td className="text-xs text-muted">{s.registry ?? s.cluster ?? s.authScheme}</Td></tr>)}</tbody></Table>
        <div className="grid gap-2 border-t border-line p-3"><Input aria-label="Connection name" placeholder="azure-prod" value={sc.name} onChange={(e) => setSc({ ...sc, name: e.target.value })} /><Select aria-label="Connection type" value={sc.type} onChange={(e) => setSc({ ...sc, type: e.target.value })}><option>AzureRM</option><option>DockerRegistry</option><option>Kubernetes</option></Select>{sc.type !== "AzureRM" && <Input aria-label="Target registry or cluster" placeholder={sc.type === "DockerRegistry" ? "registry name" : "cluster name"} value={sc.target} onChange={(e) => setSc({ ...sc, target: e.target.value })} />}<Button size="sm" onClick={() => a.run(() => action(d.resource.id, "addServiceConnection", { ...sc, target: sc.target || undefined })).then(reload)}>Add connection</Button></div>
      </Card>
      <Card><CardHeader title="Environments" />
        <Table><tbody>{(p.environments as Detail[]).map((e) => <tr key={e.name}><Td>{e.name}</Td><Td>{e.approvals ? <Badge color="amber">Approval required</Badge> : <Badge>No checks</Badge>}</Td></tr>)}</tbody></Table>
        <div className="flex flex-wrap gap-2 border-t border-line p-3"><Input aria-label="Environment name" className="w-40" placeholder="qa" value={env.name} onChange={(e) => setEnv({ ...env, name: e.target.value })} /><label className="flex items-center gap-1 text-sm"><input type="checkbox" className="accent-brand" checked={env.approvals} onChange={(e) => setEnv({ ...env, approvals: e.target.checked })} />Approvals</label><Button size="sm" onClick={() => a.run(() => action(d.resource.id, "addEnvironment", env)).then(reload)}>Save</Button></div>
      </Card>
      <div className="md:col-span-2"><ActionResult a={a} /></div>
    </div>
  );
}

export const DEVOPS_PANEL = {
  tabs: ["Boards", "Repos", "Pull requests", "Pipelines", "Project settings"],
  render: ({ tab, d, reload }: P & { tab: string }) => tab === "Boards" ? <Boards d={d} reload={reload} /> : tab === "Repos" ? <Repos d={d} reload={reload} /> : tab === "Pull requests" ? <PullRequests d={d} reload={reload} /> : tab === "Pipelines" ? <Pipelines d={d} reload={reload} /> : <Settings d={d} reload={reload} />,
};

// ---------------- Containers ----------------
function AcrPanel({ d, reload }: P) {
  const [image, setImage] = useState("web:v1");
  const [dockerfile, setDockerfile] = useState('FROM node:20-alpine\nWORKDIR /app\nCOPY . .\nRUN npm ci --omit=dev\nEXPOSE 8080\nCMD ["node", "server.js"]');
  const a = useAction();
  const repos = d.resource.properties.repositories as Record<string, Detail[]>;
  return (
    <div className="grid gap-3 lg:grid-cols-2">
      <Card><CardHeader title="Repositories" subtitle={d.resource.properties.loginServer} />
        <Table><thead><tr><Th>Repository</Th><Th>Tag</Th><Th>Digest</Th><Th /></tr></thead><tbody>{Object.entries(repos).flatMap(([repo, tags]) => tags.map((t) => <tr key={repo + t.tag}><Td>{repo}</Td><Td>{t.tag}</Td><Td className="font-mono text-xs">{t.digest.slice(0, 19)}…</Td><Td><Button size="sm" variant="ghost" onClick={() => a.run(() => action(d.resource.id, "deleteImage", { image: `${repo}:${t.tag}` })).then(reload)}>Delete</Button></Td></tr>))}{!Object.keys(repos).length && <tr><Td colSpan={4} className="text-muted">No images yet. Build one.</Td></tr>}</tbody></Table>
      </Card>
      <Card className="grid gap-2 p-3"><p className="text-sm font-semibold">Quick build (az acr build)</p><Input aria-label="Image name and tag" value={image} onChange={(e) => setImage(e.target.value)} /><CodeEditor label="Dockerfile" language="dockerfile" value={dockerfile} onChange={setDockerfile} height={180} /><div><Button onClick={() => a.run(() => action(d.resource.id, "build", { image, dockerfile })).then(reload)}>Build & push</Button></div><ActionResult a={a} />{a.result && <Pre>{a.result.log?.join("\n") ?? JSON.stringify(a.result, null, 2)}</Pre>}</Card>
    </div>
  );
}

function AciOverview({ d, reload }: P) {
  const a = useAction();
  const p = d.resource.properties;
  return (
    <Card><CardHeader title="Container instance" actions={<>{["start", "stop", "restart"].map((x) => <Button key={x} size="sm" variant="secondary" onClick={() => a.run(() => action(d.resource.id, x)).then(reload)}>{x[0].toUpperCase() + x.slice(1)}</Button>)}</>} />
      <div className="grid gap-3 p-4"><ActionResult a={a} /><KV items={[["State", <Badge key="s" color={statusColor(p.state)}>{p.state}</Badge>], ["Image", p.image], ["IP address", p.ipAddress], ["FQDN", p.fqdn ?? "-"], ["Ports", p.ports.join(", ")], ["CPU / memory", `${p.cpu} cores / ${p.memoryGB} GB`], ["Restarts", p.restartCount]]} />
        <h3 className="text-sm font-semibold">Events</h3><Table><tbody>{(p.events as Detail[]).map((e, i) => <tr key={i}><Td>{timeAgo(e.time)}</Td><Td><Badge color={e.type === "Normal" ? "green" : "amber"}>{e.type}</Badge></Td><Td>{e.message}</Td></tr>)}</tbody></Table>
        <h3 className="text-sm font-semibold">Logs</h3><Pre>{(p.logs as string[]).join("\n") || "No logs."}</Pre>
      </div>
    </Card>
  );
}

function AksWorkloads({ d, reload }: P) {
  const p = d.resource.properties;
  const [f, setF] = useState({ name: "web", image: "nginx", replicas: "2", namespace: "default", requiredEnv: false });
  const a = useAction();
  return (
    <div className="grid gap-3">
      <Card className="flex flex-wrap gap-2 p-3">
        <Input aria-label="Deployment name" className="w-36" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} />
        <Input aria-label="Image" className="w-72" value={f.image} onChange={(e) => setF({ ...f, image: e.target.value })} />
        <Input aria-label="Replicas" className="w-20" type="number" value={f.replicas} onChange={(e) => setF({ ...f, replicas: e.target.value })} />
        <Select aria-label="Namespace" className="w-36" value={f.namespace} onChange={(e) => setF({ ...f, namespace: e.target.value })}>{(p.namespaces as string[]).map((n) => <option key={n}>{n}</option>)}</Select>
        <label className="flex items-center gap-1 text-sm"><input type="checkbox" className="accent-brand" checked={f.requiredEnv} onChange={(e) => setF({ ...f, requiredEnv: e.target.checked })} />requires DB_HOST</label>
        <Button onClick={() => a.run(() => action(d.resource.id, "createDeployment", { name: f.name, image: f.image, replicas: Number(f.replicas), namespace: f.namespace, requiredEnv: f.requiredEnv ? ["DB_HOST"] : undefined })).then(reload)}>Create deployment</Button>
      </Card>
      <ActionResult a={a} />
      <Card><Table><thead><tr><Th>Name</Th><Th>Namespace</Th><Th>Ready</Th><Th>Image</Th><Th>Status</Th><Th /></tr></thead><tbody>
        {(p.deployments as Detail[]).map((x) => <tr key={x.namespace + x.name}><Td>{x.name}</Td><Td>{x.namespace}</Td><Td>{x.readyReplicas}/{x.replicas}</Td><Td className="break-all font-mono text-xs">{x.image}</Td><Td><Badge color={statusColor(x.podStatus)}>{x.podStatus}</Badge></Td>
          <Td className="whitespace-nowrap"><Button size="sm" variant="ghost" onClick={() => a.run(() => action(d.resource.id, "scale", { deployment: x.name, replicas: x.replicas + 1, namespace: x.namespace })).then(reload)}>Scale +1</Button><Button size="sm" variant="ghost" onClick={() => a.run(() => action(d.resource.id, "rolloutRestart", { deployment: x.name, namespace: x.namespace })).then(reload)}>Restart</Button><Button size="sm" variant="ghost" onClick={() => a.run(() => action(d.resource.id, "deleteDeployment", { deployment: x.name, namespace: x.namespace })).then(reload)}>Delete</Button></Td></tr>)}
      </tbody></Table></Card>
    </div>
  );
}

export const AKS_PANEL = {
  tabs: ["Workloads", "Pods", "Services", "Node pools", "Events"],
  overview: ({ d, reload }: P) => {
    const a = useAction(); // eslint-disable-line react-hooks/rules-of-hooks
    const acrs = useResources([T.ACR]); // eslint-disable-line react-hooks/rules-of-hooks
    const p = d.resource.properties;
    return <Card><CardHeader title="Cluster" actions={<><Button size="sm" variant="secondary" onClick={() => a.run(() => action(d.resource.id, p.powerState === "Running" ? "stop" : "start")).then(reload)}>{p.powerState === "Running" ? "Stop" : "Start"}</Button><Select aria-label="Attach ACR" className="h-7 w-44 text-xs" value="" onChange={(e) => e.target.value && a.run(() => action(d.resource.id, "attachAcr", { acr: e.target.value })).then(reload)}><option value="">Attach registry…</option>{(acrs.rows ?? []).map((r) => <option key={r.id}>{r.name}</option>)}</Select></>} /><div className="grid gap-3 p-4"><ActionResult a={a} /><KV items={[["Power state", <Badge key="p" color={statusColor(p.powerState)}>{p.powerState}</Badge>], ["Kubernetes version", p.kubernetesVersion], ["API server", p.fqdn], ["Nodes", `${p.nodeCount} × ${p.nodeVmSize}`], ["Network plugin", p.networkPlugin], ["Attached ACR", p.attachedAcr ?? "None"]]} /><p className="text-xs text-muted">Use the Cloud terminal: <code className="font-mono">az aks get-credentials -g {d.resource.resourceGroup} -n {d.resource.name}</code> then kubectl.</p></div></Card>;
  },
  render: ({ tab, d, reload }: P & { tab: string }) => {
    const p = d.resource.properties;
    if (tab === "Workloads") return <AksWorkloads d={d} reload={reload} />;
    if (tab === "Pods") return <Card><Table><thead><tr><Th>Name</Th><Th>Namespace</Th><Th>Ready</Th><Th>Status</Th><Th>Restarts</Th><Th>Node</Th><Th>Reason</Th></tr></thead><tbody>{(p.pods as Detail[]).map((x) => <tr key={x.name}><Td className="font-mono text-xs">{x.name}</Td><Td>{x.namespace}</Td><Td>{x.ready}</Td><Td><Badge color={statusColor(x.status)}>{x.status}</Badge></Td><Td>{x.restarts}</Td><Td className="text-xs">{x.node}</Td><Td className="text-xs">{x.reason}</Td></tr>)}</tbody></Table></Card>;
    if (tab === "Services") return <Card><Table><thead><tr><Th>Name</Th><Th>Type</Th><Th>Cluster IP</Th><Th>External IP</Th><Th>Port</Th></tr></thead><tbody>{(p.services as Detail[]).map((s) => <tr key={s.name}><Td>{s.name}</Td><Td>{s.type}</Td><Td>{s.clusterIP}</Td><Td>{s.externalIP ?? "<none>"}</Td><Td>{s.port}:{s.targetPort}</Td></tr>)}</tbody></Table></Card>;
    if (tab === "Node pools") return <NodePools d={d} reload={reload} />;
    return <Card><Table><tbody>{(p.events as Detail[]).map((e, i) => <tr key={i}><Td>{timeAgo(e.time)}</Td><Td><Badge color={e.type === "Normal" ? "green" : "amber"}>{e.type}</Badge></Td><Td>{e.object}</Td><Td>{e.message}</Td></tr>)}</tbody></Table></Card>;
  },
};

function NodePools({ d, reload }: P) {
  const [n, setN] = useState(String(d.resource.properties.nodeCount));
  const a = useAction();
  return <Card className="grid gap-3 p-4"><Table><thead><tr><Th>Node</Th><Th>Status</Th><Th>Version</Th></tr></thead><tbody>{(d.resource.properties.nodes as Detail[]).map((x) => <tr key={x.name}><Td className="font-mono text-xs">{x.name}</Td><Td><Badge color={statusColor(x.status)}>{x.status}</Badge></Td><Td>{x.version}</Td></tr>)}</tbody></Table><div className="flex gap-2"><Input aria-label="Node count" className="w-24" type="number" value={n} onChange={(e) => setN(e.target.value)} /><Button onClick={() => a.run(() => action(d.resource.id, "scaleNodes", { count: Number(n) })).then(reload)}>Scale node pool</Button></div><ActionResult a={a} /></Card>;
}

// ---------------- Backup ----------------
function BackupItems({ d, reload }: P) {
  const p = d.resource.properties;
  const vms = useResources([T.VM]);
  const [f, setF] = useState({ vmName: "", policy: "DefaultPolicy" });
  const [restoreName, setRestoreName] = useState("");
  const a = useAction();
  return (
    <div className="grid gap-3">
      <Card className="flex flex-wrap gap-2 p-3"><Select aria-label="VM to protect" className="w-52" value={f.vmName} onChange={(e) => setF({ ...f, vmName: e.target.value })}><option value="">Select VM</option>{(vms.rows ?? []).map((v) => <option key={v.id} value={v.name}>{v.name} ({v.location})</option>)}</Select><Select aria-label="Policy" className="w-44" value={f.policy} onChange={(e) => setF({ ...f, policy: e.target.value })}>{(p.policies as Detail[]).map((x) => <option key={x.name}>{x.name}</option>)}</Select><Button onClick={() => a.run(() => action(d.resource.id, "enableProtection", f)).then(reload)}>Enable backup</Button></Card>
      <ActionResult a={a} />
      <Card><Table><thead><tr><Th>VM</Th><Th>Policy</Th><Th>State</Th><Th>Last backup</Th><Th>Recovery points</Th><Th /></tr></thead><tbody>
        {(p.protectedItems as Detail[]).map((i) => <tr key={i.vmId}><Td>{i.vmName}</Td><Td>{i.policy}</Td><Td>{i.protectionState}</Td><Td>{i.lastBackup ? timeAgo(i.lastBackup) : "Never"}</Td><Td>{i.recoveryPoints.length}</Td>
          <Td className="whitespace-nowrap"><Button size="sm" variant="ghost" onClick={() => a.run(() => action(d.resource.id, "backupNow", { vmName: i.vmName })).then(reload)}>Backup now</Button>{i.recoveryPoints.length > 0 && <span className="inline-flex gap-1"><Input aria-label="Restore as" className="h-7 w-36" placeholder={`${i.vmName}-restored`} value={restoreName} onChange={(e) => setRestoreName(e.target.value)} /><Button size="sm" variant="ghost" onClick={() => a.run(() => action(d.resource.id, "restore", { vmName: i.vmName, targetVmName: restoreName || `${i.vmName}-restored` })).then(reload)}>Restore</Button></span>}</Td></tr>)}
      </tbody></Table></Card>
    </div>
  );
}

function Policies({ d, reload }: P) {
  const [f, setF] = useState({ name: "", scheduleTime: "23:00", retentionDays: "30", frequency: "Daily" });
  const a = useAction();
  return <Card><Table><thead><tr><Th>Name</Th><Th>Frequency</Th><Th>Time</Th><Th>Retention</Th></tr></thead><tbody>{(d.resource.properties.policies as Detail[]).map((x) => <tr key={x.name}><Td>{x.name}</Td><Td>{x.frequency}</Td><Td>{x.scheduleTime}</Td><Td>{x.retentionDays} days</Td></tr>)}</tbody></Table><div className="flex flex-wrap gap-2 border-t border-line p-3"><Input aria-label="Policy name" className="w-36" placeholder="daily-30" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /><Select aria-label="Frequency" className="w-28" value={f.frequency} onChange={(e) => setF({ ...f, frequency: e.target.value })}><option>Daily</option><option>Weekly</option></Select><Input aria-label="Time" className="w-24" value={f.scheduleTime} onChange={(e) => setF({ ...f, scheduleTime: e.target.value })} /><Input aria-label="Retention days" className="w-24" type="number" value={f.retentionDays} onChange={(e) => setF({ ...f, retentionDays: e.target.value })} /><Button onClick={() => a.run(() => action(d.resource.id, "createPolicy", { ...f, retentionDays: Number(f.retentionDays) })).then(reload)}>Create policy</Button></div><div className="px-3 pb-3"><ActionResult a={a} /></div></Card>;
}

export const BACKUP_PANEL = {
  tabs: ["Backup items", "Backup policies", "Backup jobs"],
  render: ({ tab, d, reload }: P & { tab: string }) => tab === "Backup items" ? <BackupItems d={d} reload={reload} /> : tab === "Backup policies" ? <Policies d={d} reload={reload} /> : <Card><Table><thead><tr><Th>Operation</Th><Th>Item</Th><Th>Status</Th><Th>Start</Th><Th>Duration</Th></tr></thead><tbody>{(d.resource.properties.jobs as Detail[]).map((j) => <tr key={j.id}><Td>{j.operation}</Td><Td>{j.item}</Td><Td><Badge color="green">{j.status}</Badge></Td><Td>{timeAgo(j.start)}</Td><Td>{j.durationSec}s</Td></tr>)}</tbody></Table></Card>,
};

export const ACR_PANEL = { tabs: ["Repositories & builds"], render: (props: P & { tab: string }) => <AcrPanel {...props} /> };
export const ACI_PANEL = { tabs: [] as string[], overview: AciOverview, render: () => null };
export const LINK_OVERVIEW = (href: string, label: string) => function LinkOverview() {
  return <Card className="p-4"><Link className="text-brand hover:underline" href={href}>{label}</Link></Card>;
};
export function Textual({ text }: { text: string }) {
  return <Textarea readOnly value={text} />;
}

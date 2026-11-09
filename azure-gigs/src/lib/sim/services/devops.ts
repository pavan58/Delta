/** Simulated Azure DevOps: boards, repos, pull requests, YAML pipelines, environments. */
import { z } from "zod";
import YAML from "yaml";
import { badRequest, conflict, notFound } from "@/lib/errors";
import { createResource, Ctx, fakeGuid, findAnyByName, getById, mutate, Props, Res } from "../engine";
import { T } from "../types";
import { deploySite } from "./apps";
import { acrBuild, aksSetImage } from "./containers";

const DEFAULT_YAML = `trigger:
  branches:
    include:
      - main

pool:
  vmImage: ubuntu-latest

stages:
  - stage: Build
    jobs:
      - job: BuildJob
        steps:
          - script: npm ci
            displayName: Install dependencies
          - script: npm test
            displayName: Run unit tests
          - script: npm run build
            displayName: Build
`;

export async function createProject(ctx: Ctx, raw: unknown) {
  const input = z.object({ resourceGroup: z.string().min(1), organization: z.string().min(1).max(50).regex(/^[a-zA-Z0-9-]+$/), name: z.string().min(1).max(64).regex(/^[\w .-]+$/), description: z.string().max(400).optional(), process: z.enum(["Agile", "Scrum", "Basic"]).default("Agile"), location: z.string().optional() }).parse(raw);
  const files = {
    "README.md": `# ${input.name}\n\nSample service used in Azure Gigs DevOps labs.`,
    "package.json": JSON.stringify({ name: input.name.toLowerCase().replace(/\W+/g, "-"), version: "1.0.0", scripts: { test: "node --test", build: "node build.js", start: "node server.js" } }, null, 2),
    "server.js": "require('http').createServer((q,s)=>s.end('ok')).listen(process.env.PORT||8080)",
    "Dockerfile": "FROM node:20-alpine\nWORKDIR /app\nCOPY . .\nRUN npm ci --omit=dev\nEXPOSE 8080\nCMD [\"node\", \"server.js\"]",
    "azure-pipelines.yml": DEFAULT_YAML,
  };
  const commit = { id: fakeGuid().replace(/-/g, "").slice(0, 8), message: "Initial commit", author: ctx.caller, time: new Date().toISOString() };
  return createResource(ctx, {
    type: T.DEVOPS_PROJECT,
    resourceGroup: input.resourceGroup,
    name: input.name,
    location: input.location,
    properties: {
      organization: input.organization,
      description: input.description ?? "",
      process: input.process,
      url: `https://dev.sim.azuregigs.local/${input.organization}/${encodeURIComponent(input.name)}`,
      workItems: [] as Props[],
      nextWorkItemId: 1,
      repos: [{ name: input.name, defaultBranch: "main", branches: { main: { files, commits: [commit] } } }],
      pullRequests: [] as Props[],
      nextPrId: 1,
      pipelines: [] as Props[],
      environments: [{ name: "dev", approvals: false }, { name: "staging", approvals: false }, { name: "production", approvals: true }],
      serviceConnections: [] as Props[],
    },
  });
}

const WI_STATES = ["New", "Active", "Resolved", "Closed"];

export async function addWorkItem(ctx: Ctx, proj: Res, raw: unknown) {
  const input = z.object({ type: z.enum(["Epic", "Feature", "User Story", "Task", "Bug"]), title: z.string().min(1).max(200), description: z.string().max(4000).optional(), assignedTo: z.string().max(200).optional(), priority: z.coerce.number().int().min(1).max(4).default(2), storyPoints: z.coerce.number().min(0).max(100).optional() }).parse(raw);
  return mutate(ctx, proj, (p) => {
    p.workItems.push({ id: p.nextWorkItemId++, ...input, state: "New", createdAt: new Date().toISOString() });
  }, "Create Work Item", { title: input.title, type: input.type });
}

export async function moveWorkItem(ctx: Ctx, proj: Res, id: number, state: string) {
  if (!WI_STATES.includes(state)) throw badRequest("InvalidState", `State must be one of ${WI_STATES.join(", ")}.`);
  if (!(proj.properties.workItems as Props[]).some((w) => w.id === id)) throw notFound(`Work item ${id} not found.`);
  return mutate(ctx, proj, (p) => {
    const w = p.workItems.find((x: Props) => x.id === id);
    w.state = state;
    w.changedAt = new Date().toISOString();
  }, "Update Work Item", { id, state });
}

function repoOf(p: Props, name?: string) {
  const r = name ? (p.repos as Props[]).find((x) => x.name.toLowerCase() === name.toLowerCase()) : p.repos[0];
  if (!r) throw notFound(`Repository '${name}' not found.`);
  return r;
}

export async function createRepo(ctx: Ctx, proj: Res, name: string) {
  if (!/^[\w.-]{1,64}$/.test(name)) throw badRequest("InvalidName", "Invalid repository name.");
  if ((proj.properties.repos as Props[]).some((r) => r.name.toLowerCase() === name.toLowerCase())) throw conflict("RepoExists", `Repository '${name}' already exists.`);
  return mutate(ctx, proj, (p) => {
    p.repos.push({ name, defaultBranch: "main", branches: { main: { files: { "README.md": `# ${name}` }, commits: [{ id: fakeGuid().slice(0, 8), message: "Initial commit", author: ctx.caller, time: new Date().toISOString() }] } } });
  }, "Create Repository", { repo: name });
}

export async function createBranch(ctx: Ctx, proj: Res, raw: unknown) {
  const input = z.object({ repo: z.string().optional(), name: z.string().min(1).max(100).regex(/^[\w./-]+$/), from: z.string().default("main") }).parse(raw);
  const repo = repoOf(proj.properties, input.repo);
  if (!repo.branches[input.from]) throw notFound(`Source branch '${input.from}' not found.`);
  if (repo.branches[input.name]) throw conflict("BranchExists", `Branch '${input.name}' already exists.`);
  return mutate(ctx, proj, (p) => {
    const r = repoOf(p, input.repo);
    r.branches[input.name] = structuredClone(r.branches[input.from]);
  }, "Create Branch", { branch: input.name });
}

export async function commitFile(ctx: Ctx, proj: Res, raw: unknown) {
  const input = z.object({ repo: z.string().optional(), branch: z.string().default("main"), path: z.string().min(1).max(200).regex(/^[\w./-]+$/), content: z.string().max(50000), message: z.string().min(1).max(200), delete: z.boolean().optional() }).parse(raw);
  const repo = repoOf(proj.properties, input.repo);
  if (!repo.branches[input.branch]) throw notFound(`Branch '${input.branch}' not found.`);
  const protectedMain = input.branch === repo.defaultBranch && (repo.branchPolicy?.requirePr ?? false);
  if (protectedMain) throw conflict("BranchPolicyViolation", `TF402455: Pushes to '${input.branch}' are not permitted because it requires a pull request.`);
  const id = fakeGuid().replace(/-/g, "").slice(0, 8);
  const out = await mutate(ctx, proj, (p) => {
    const b = repoOf(p, input.repo).branches[input.branch];
    if (input.delete) delete b.files[input.path];
    else b.files[input.path] = input.content;
    b.commits.unshift({ id, message: input.message, author: ctx.caller, time: new Date().toISOString() });
  }, "Push Commit", { branch: input.branch, path: input.path, commit: id });
  // CI trigger
  const triggered: Props[] = [];
  for (const pl of out.properties.pipelines as Props[]) {
    if ((pl.repo ?? repo.name) === repo.name && pl.yamlPath && (triggerBranches(out.properties, pl).includes(input.branch))) {
      triggered.push(await runPipeline(ctx, await getById(ctx, proj.id), { pipeline: pl.name, branch: input.branch, reason: "CI" }));
    }
  }
  return { project: await getById(ctx, proj.id), commit: id, triggered };
}

export async function setBranchPolicy(ctx: Ctx, proj: Res, raw: unknown) {
  const input = z.object({ repo: z.string().optional(), requirePr: z.boolean(), minReviewers: z.coerce.number().int().min(0).max(5).default(1), requireBuild: z.boolean().default(false) }).parse(raw);
  return mutate(ctx, proj, (p) => {
    repoOf(p, input.repo).branchPolicy = input;
  }, "Update Branch Policy", input);
}

export async function createPullRequest(ctx: Ctx, proj: Res, raw: unknown) {
  const input = z.object({ repo: z.string().optional(), source: z.string(), target: z.string().default("main"), title: z.string().min(1).max(200), description: z.string().max(4000).optional() }).parse(raw);
  const repo = repoOf(proj.properties, input.repo);
  if (!repo.branches[input.source] || !repo.branches[input.target]) throw notFound("Source or target branch not found.");
  if (input.source === input.target) throw badRequest("SameBranch", "Source and target branch must differ.");
  const src = repo.branches[input.source].files as Record<string, string>, tgt = repo.branches[input.target].files as Record<string, string>;
  const changes = [...new Set([...Object.keys(src), ...Object.keys(tgt)])].filter((f) => src[f] !== tgt[f]).map((f) => ({ path: f, change: !(f in tgt) ? "add" : !(f in src) ? "delete" : "edit" }));
  if (!changes.length) throw conflict("NoChanges", "There are no changes between the branches.");
  return mutate(ctx, proj, (p) => {
    p.pullRequests.unshift({ id: p.nextPrId++, repo: repo.name, ...input, status: "Active", approvals: 0, changes, createdBy: ctx.caller, createdAt: new Date().toISOString() });
  }, "Create Pull Request", { title: input.title });
}

export async function approvePullRequest(ctx: Ctx, proj: Res, id: number) {
  return mutate(ctx, proj, (p) => {
    const pr = p.pullRequests.find((x: Props) => x.id === id);
    if (!pr) throw notFound(`Pull request ${id} not found.`);
    pr.approvals = (pr.approvals ?? 0) + 1;
  }, "Approve Pull Request", { id });
}

export async function completePullRequest(ctx: Ctx, proj: Res, id: number) {
  const pr = (proj.properties.pullRequests as Props[]).find((x) => x.id === id);
  if (!pr) throw notFound(`Pull request ${id} not found.`);
  if (pr.status !== "Active") throw conflict("PrNotActive", `Pull request ${id} is ${pr.status}.`);
  const repo = repoOf(proj.properties, pr.repo);
  const policy = repo.branchPolicy;
  if (policy?.requirePr && pr.approvals < policy.minReviewers) throw conflict("PolicyNotMet", `Branch policy requires ${policy.minReviewers} approval(s); this PR has ${pr.approvals}.`);
  const commitId = fakeGuid().replace(/-/g, "").slice(0, 8);
  await mutate(ctx, proj, (p) => {
    const r = repoOf(p, pr.repo);
    r.branches[pr.target].files = { ...r.branches[pr.target].files, ...r.branches[pr.source].files };
    for (const c of pr.changes as Props[]) if (c.change === "delete") delete r.branches[pr.target].files[c.path];
    r.branches[pr.target].commits.unshift({ id: commitId, message: `Merged PR ${id}: ${pr.title}`, author: ctx.caller, time: new Date().toISOString() });
    const x = p.pullRequests.find((y: Props) => y.id === id);
    x.status = "Completed";
    x.completedAt = new Date().toISOString();
  }, "Complete Pull Request", { id });
  const fresh = await getById(ctx, proj.id);
  const triggered: Props[] = [];
  for (const pl of fresh.properties.pipelines as Props[]) if ((pl.repo ?? repo.name) === repo.name && triggerBranches(fresh.properties, pl).includes(pr.target)) triggered.push(await runPipeline(ctx, await getById(ctx, proj.id), { pipeline: pl.name, branch: pr.target, reason: "PullRequestMerge" }));
  return { project: await getById(ctx, proj.id), triggered };
}

function triggerBranches(p: Props, pl: Props): string[] {
  try {
    const repo = repoOf(p, pl.repo);
    const doc = YAML.parse(repo.branches[repo.defaultBranch].files[pl.yamlPath] ?? "") ?? {};
    const t = doc.trigger;
    if (t === "none") return [];
    if (Array.isArray(t)) return t;
    return t?.branches?.include ?? ["main"];
  } catch {
    return [];
  }
}

export async function createPipeline(ctx: Ctx, proj: Res, raw: unknown) {
  const input = z.object({ name: z.string().min(1).max(100), repo: z.string().optional(), yamlPath: z.string().default("azure-pipelines.yml") }).parse(raw);
  const repo = repoOf(proj.properties, input.repo);
  if (!(input.yamlPath in repo.branches[repo.defaultBranch].files)) throw notFound(`File '${input.yamlPath}' does not exist in ${repo.name}/${repo.defaultBranch}.`);
  if ((proj.properties.pipelines as Props[]).some((p) => p.name.toLowerCase() === input.name.toLowerCase())) throw conflict("PipelineExists", `Pipeline '${input.name}' already exists.`);
  return mutate(ctx, proj, (p) => {
    p.pipelines.push({ id: p.pipelines.length + 1, name: input.name, repo: repo.name, yamlPath: input.yamlPath, runs: [], nextRun: 1 });
  }, "Create Pipeline", input);
}

export async function addServiceConnection(ctx: Ctx, proj: Res, raw: unknown) {
  const input = z.object({ name: z.string().min(1).max(100), type: z.enum(["AzureRM", "DockerRegistry", "Kubernetes"]).default("AzureRM"), scopeResourceGroup: z.string().optional(), target: z.string().optional() }).parse(raw);
  if ((proj.properties.serviceConnections as Props[]).some((s) => s.name === input.name)) throw conflict("Exists", `Service connection '${input.name}' already exists.`);
  return mutate(ctx, proj, (p) => {
    p.serviceConnections.push({ ...input, registry: input.type === "DockerRegistry" ? input.target ?? input.name : undefined, cluster: input.type === "Kubernetes" ? input.target ?? input.name : undefined, id: fakeGuid(), authScheme: "WorkloadIdentityFederation", createdAt: new Date().toISOString() });
  }, "Create Service Connection", { name: input.name, type: input.type });
}

export async function addEnvironment(ctx: Ctx, proj: Res, raw: unknown) {
  const input = z.object({ name: z.string().min(1).max(64).regex(/^[\w-]+$/), approvals: z.boolean().default(false) }).parse(raw);
  return mutate(ctx, proj, (p) => {
    p.environments = (p.environments as Props[]).filter((e) => e.name !== input.name);
    p.environments.push(input);
  }, "Create or Update Environment", input);
}

type StepResult = { name: string; status: "succeeded" | "failed" | "skipped"; log: string[] };

/** Executes a YAML pipeline against the simulator. Tasks can deploy to App Service, push to ACR or roll out to AKS. */
export async function runPipeline(ctx: Ctx, proj: Res, raw: unknown) {
  const input = z.object({ pipeline: z.string(), branch: z.string().optional(), reason: z.string().default("Manual"), approve: z.boolean().optional() }).parse(raw);
  const pl = (proj.properties.pipelines as Props[]).find((p) => p.name.toLowerCase() === input.pipeline.toLowerCase());
  if (!pl) throw notFound(`Pipeline '${input.pipeline}' not found.`);
  const repo = repoOf(proj.properties, pl.repo);
  const branch = input.branch ?? repo.defaultBranch;
  const files = repo.branches[branch]?.files as Record<string, string> | undefined;
  if (!files) throw notFound(`Branch '${branch}' not found.`);
  const runId = pl.nextRun ?? pl.runs.length + 1;
  const stages: { name: string; status: string; environment?: string; jobs: { name: string; status: string; steps: StepResult[] }[] }[] = [];
  let status: "succeeded" | "failed" | "pending approval" = "succeeded";
  let errorSummary = "";
  try {
    const yamlText = files[pl.yamlPath];
    if (!yamlText) throw new Error(`${pl.yamlPath} was not found on branch ${branch}.`);
    let doc: Props;
    try {
      doc = YAML.parse(yamlText);
    } catch (e) {
      throw new Error(`/${pl.yamlPath}: YAML syntax error - ${(e as Error).message.split("\n")[0]}`);
    }
    if (!doc || typeof doc !== "object") throw new Error(`/${pl.yamlPath}: the pipeline definition is empty.`);
    const vars: Record<string, string> = {};
    if (Array.isArray(doc.variables)) for (const v of doc.variables) vars[v.name] = String(v.value);
    else if (doc.variables && typeof doc.variables === "object") for (const [k, v] of Object.entries(doc.variables)) vars[k] = String(v);
    const sub = (s: string) => String(s).replace(/\$\(([\w.]+)\)/g, (_, k) => vars[k] ?? (k === "Build.BuildId" ? String(runId) : k === "Build.SourceBranchName" ? branch : `$(${k})`));
    const stageDefs: Props[] = doc.stages ?? [{ stage: "__default", jobs: doc.jobs ?? [{ job: "Job", steps: doc.steps ?? [] }] }];
    if (!Array.isArray(stageDefs) || !stageDefs.length) throw new Error("The pipeline must define 'stages', 'jobs' or 'steps'.");
    let failed = false;
    for (const st of stageDefs) {
      const stage = { name: st.stage ?? "Stage", status: "succeeded", jobs: [] as { name: string; status: string; steps: StepResult[] }[], environment: undefined as string | undefined };
      stages.push(stage);
      if (failed) { stage.status = "skipped"; continue; }
      for (const jd of (st.jobs ?? []) as Props[]) {
        const job = { name: jd.job ?? jd.deployment ?? "Job", status: "succeeded", steps: [] as StepResult[] };
        stage.jobs.push(job);
        let steps: Props[] = jd.steps ?? [];
        if (jd.deployment) {
          const envName = typeof jd.environment === "string" ? jd.environment : jd.environment?.name;
          const env = (proj.properties.environments as Props[]).find((e) => e.name === envName);
          stage.environment = envName;
          if (!env) { job.steps.push({ name: "Check environment", status: "failed", log: [`##[error]Environment '${envName}' could not be found. Create it in Pipelines > Environments.`] }); job.status = "failed"; failed = true; break; }
          if (env.approvals && !input.approve) { job.steps.push({ name: "Approval", status: "skipped", log: [`Waiting for approval on environment '${envName}'...`] }); job.status = "pending"; stage.status = "pending"; status = "pending approval"; failed = true; break; }
          steps = jd.strategy?.runOnce?.deploy?.steps ?? steps;
        }
        for (const s of steps) {
          const r = await runStep(ctx, proj, s, files, sub, runId, branch);
          job.steps.push(r);
          if (r.status === "failed" && !s.continueOnError) { job.status = "failed"; failed = true; errorSummary = r.log.filter((l) => l.startsWith("##[error]")).join(" "); break; }
        }
        if (failed) break;
      }
      if (stage.status !== "pending") stage.status = failed ? "failed" : "succeeded";
    }
    if (failed && status !== "pending approval") status = "failed";
  } catch (e) {
    status = "failed";
    errorSummary = (e as Error).message;
    stages.push({ name: "Initialize", status: "failed", jobs: [{ name: "Validate YAML", status: "failed", steps: [{ name: "Parse pipeline", status: "failed", log: [`##[error]${errorSummary}`] }] }] });
  }
  const run = { id: runId, pipeline: pl.name, branch, reason: input.reason, status, errorSummary, stages, commit: repo.branches[branch].commits[0]?.id, startedAt: new Date().toISOString(), durationSec: 20 + stages.length * 17, requestedBy: ctx.caller };
  await mutate(ctx, proj, (p) => {
    const x = p.pipelines.find((y: Props) => y.name === pl.name);
    x.runs = [run, ...x.runs].slice(0, 30);
    x.nextRun = runId + 1;
  }, `Pipeline run ${status}`, { pipeline: pl.name, run: runId, status });
  return run;
}

async function runStep(ctx: Ctx, proj: Res, s: Props, files: Record<string, string>, sub: (x: string) => string, runId: number, branch: string): Promise<StepResult> {
  const name = s.displayName ?? (s.script ? String(s.script).split("\n")[0] : s.task ?? "step");
  const log: string[] = [];
  const fail = (msg: string): StepResult => ({ name, status: "failed", log: [...log, `##[error]${msg}`] });
  if (s.script !== undefined || s.bash !== undefined || s.pwsh !== undefined) {
    const script = sub(s.script ?? s.bash ?? s.pwsh);
    for (const line of script.split("\n").map((l: string) => l.trim()).filter(Boolean)) {
      log.push(`> ${line}`);
      if (/^exit\s+[1-9]/.test(line)) return fail(`Bash exited with code '${line.split(/\s+/)[1]}'.`);
      if (/^echo\s+/.test(line)) { log.push(line.replace(/^echo\s+/, "").replace(/^["']|["']$/g, "")); continue; }
      if (/^npm (ci|install)/.test(line)) { if (!files["package.json"]) return fail("npm ERR! enoent Could not read package.json"); log.push("added 214 packages in 6s"); continue; }
      if (/^npm (run )?test/.test(line)) {
        if (!files["package.json"]) return fail("npm ERR! Missing script: test");
        const failing = Object.entries(files).filter(([f, c]) => /\.test\.(js|ts)$/.test(f) && /assert\.(fail|equal\(1,\s*2\))|expect\(false\)\.toBe\(true\)/.test(c));
        if (failing.length) return fail(`Tests failed: ${failing.map(([f]) => f).join(", ")} (1 failing)`);
        log.push(`# tests ${3 + Object.keys(files).length}`, "# pass  all", "# fail  0");
        continue;
      }
      if (/^npm run build/.test(line)) { log.push("Build completed."); continue; }
      if (/^(dotnet|pip|python|mvn|terraform|az|docker|kubectl)\b/.test(line)) { log.push(`(simulated) ${line.split(" ")[0]} completed successfully`); continue; }
      log.push("(simulated) done");
    }
    return { name, status: "succeeded", log };
  }
  const task = String(s.task ?? "");
  const inputs: Props = Object.fromEntries(Object.entries(s.inputs ?? {}).map(([k, v]) => [k, sub(String(v))]));
  const needConn = async (key: string, type: string) => {
    const connName = inputs[key];
    const conn = (proj.properties.serviceConnections as Props[]).find((c) => c.name === connName && c.type === type);
    if (!conn) throw new Error(`The pipeline is not valid. Job: Input '${key}' references service connection '${connName}' which could not be found. The service connection does not exist, has been disabled or has not been authorized for use.`);
    return conn;
  };
  try {
    if (/^AzureWebApp@\d/.test(task) || /^AzureRmWebAppDeployment@\d/.test(task)) {
      await needConn(inputs.azureSubscription ? "azureSubscription" : "ConnectedServiceName", "AzureRM");
      const appName = inputs.appName ?? inputs.WebAppName;
      const site = await findAnyByName(ctx, T.SITE, appName ?? "");
      if (!site) return fail(`Web app '${appName}' was not found in the subscription.`);
      const pkg = inputs.package && !inputs.package.includes("$(") ? inputs.package : "hello-node";
      const r = await deploySite({ ...ctx, source: "pipeline" }, site, { package: pkg.replace(/\.zip$/, "").split("/").pop(), source: `Azure Pipelines run #${runId}`, commit: branch });
      log.push(...(r.deployment.log as string[]));
      return r.deployment.status === "Success" ? { name, status: "succeeded", log: [...log, `App Service Application URL: https://${site.properties.defaultHostName}`] } : fail("Deployment failed.");
    }
    if (/^Docker@\d/.test(task)) {
      await needConn("containerRegistry", "DockerRegistry");
      const conn = (proj.properties.serviceConnections as Props[]).find((c) => c.name === inputs.containerRegistry)!;
      const registry = await findAnyByName(ctx, T.ACR, conn.registry ?? inputs.containerRegistry.replace(/-connection$/, ""));
      const acr = registry ?? (await findAnyByName(ctx, T.ACR, String(inputs.containerRegistry)));
      if (!acr) return fail(`Container registry for connection '${inputs.containerRegistry}' not found. Name the connection after the registry (e.g. 'myregistry').`);
      const dockerfile = files[inputs.Dockerfile ?? "Dockerfile"] ?? files["Dockerfile"];
      if (!dockerfile) return fail(`Unhandled: No Dockerfile matching ${inputs.Dockerfile ?? "Dockerfile"} was found.`);
      const tag = (inputs.tags ?? String(runId)).split("\n")[0].trim();
      const b = await acrBuild({ ...ctx, source: "pipeline" }, acr, { image: `${inputs.repository ?? "app"}:${tag}`, dockerfile });
      log.push(...b.log);
      return b.status === "Succeeded" ? { name, status: "succeeded", log } : fail("Docker build failed.");
    }
    if (/^KubernetesManifest@\d/.test(task) || /^Kubernetes@\d/.test(task)) {
      await needConn("kubernetesServiceConnection", "Kubernetes");
      const conn = (proj.properties.serviceConnections as Props[]).find((c) => c.name === inputs.kubernetesServiceConnection)!;
      const cluster = await findAnyByName(ctx, T.AKS, conn.cluster ?? inputs.kubernetesServiceConnection.replace(/-connection$/, ""));
      if (!cluster) return fail(`AKS cluster for connection '${inputs.kubernetesServiceConnection}' was not found. Name the connection after the cluster.`);
      const image = String(inputs.containers ?? "").trim();
      const deployment = inputs.deployment ?? inputs.name ?? "web";
      const r = await aksSetImage({ ...ctx, source: "pipeline" }, cluster, { deployment, image, namespace: inputs.namespace ?? "default", createIfMissing: true });
      log.push(`deployment.apps/${deployment} configured`, `Waiting for rollout... ${r.readyReplicas}/${r.replicas} ready`);
      return r.readyReplicas === r.replicas ? { name, status: "succeeded", log } : fail(`Rollout failed: pods for deployment '${deployment}' are ${r.podStatus}.`);
    }
    if (/^AzureCLI@\d/.test(task)) {
      await needConn("azureSubscription", "AzureRM");
      log.push(`(simulated) ${inputs.inlineScript ?? "az script"} executed`);
      return { name, status: "succeeded", log };
    }
    if (/^(NodeTool|UseDotNet|UsePythonVersion|PublishBuildArtifacts|PublishPipelineArtifact|ArchiveFiles|CopyFiles|DownloadPipelineArtifact)@\d/.test(task)) {
      log.push(`Task ${task} completed`);
      return { name, status: "succeeded", log };
    }
    if (s.checkout) return { name: "Checkout", status: "succeeded", log: [`Checked out ${branch}`] };
    return fail(`A task is missing or unknown: '${task || JSON.stringify(s).slice(0, 80)}'. The simulator supports script/bash/pwsh steps and the tasks AzureWebApp@1, AzureRmWebAppDeployment@4, Docker@2, KubernetesManifest@1, AzureCLI@2, NodeTool@0, UseDotNet@2, Publish/CopyFiles/ArchiveFiles.`);
  } catch (e) {
    return fail((e as Error).message);
  }
}

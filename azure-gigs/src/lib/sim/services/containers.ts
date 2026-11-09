/** Azure Container Registry, Container Instances and AKS simulation. */
import { z } from "zod";
import { badRequest, conflict, notFound } from "@/lib/errors";
import { createResource, Ctx, fakeGuid, findAnyByName, getById, logActivity, mutate, Props, Res, seeded } from "../engine";
import { findSize } from "../catalog";
import { T } from "../types";
import { publicIpFor } from "./network";

export const PUBLIC_IMAGES = ["nginx", "httpd", "redis", "busybox", "node", "python", "mcr.microsoft.com/azuredocs/aci-helloworld", "mcr.microsoft.com/dotnet/samples", "mcr.microsoft.com/azuredocs/azure-vote-front", "postgres", "alpine", "ubuntu"];

export async function createRegistry(ctx: Ctx, raw: unknown) {
  const input = z.object({ resourceGroup: z.string().min(1), name: z.string().min(5).max(50), location: z.string().optional(), sku: z.enum(["Basic", "Standard", "Premium"]).default("Basic"), adminUserEnabled: z.boolean().default(false) }).parse(raw);
  return createResource(ctx, { type: T.ACR, resourceGroup: input.resourceGroup, name: input.name, location: input.location, properties: { sku: input.sku, loginServer: `${input.name.toLowerCase()}.azurecr.sim`, adminUserEnabled: input.adminUserEnabled, repositories: {} as Record<string, Props[]>, builds: [] as Props[] } });
}

const DOCKER_INSTRUCTIONS = ["FROM", "RUN", "CMD", "LABEL", "EXPOSE", "ENV", "ADD", "COPY", "ENTRYPOINT", "VOLUME", "USER", "WORKDIR", "ARG", "ONBUILD", "STOPSIGNAL", "HEALTHCHECK", "SHELL"];

/** Simulates `az acr build`: validates the Dockerfile and records an image tag. */
export async function acrBuild(ctx: Ctx, acr: Res, raw: unknown) {
  const input = z.object({ image: z.string().min(1).max(200).regex(/^[a-z0-9._/-]+(:[\w.-]+)?$/, "Image must be lowercase repo[:tag]"), dockerfile: z.string().min(1).max(20000) }).parse(raw);
  const [repo, tag = "latest"] = input.image.split(":");
  const lines = input.dockerfile.split("\n").map((l) => l.trim()).filter((l) => l && !l.startsWith("#"));
  const log: string[] = [`Queued a build with ID: ${fakeGuid().slice(0, 4)}`, "Sending context to registry...", "Step 0/0 : Analyzing Dockerfile"];
  let status = "Succeeded";
  let exposed: number[] = [];
  let baseImage = "";
  if (!lines.length || !/^FROM\s+/i.test(lines[0]) && !/^ARG\s+/i.test(lines[0])) {
    status = "Failed";
    log.push("Error response from daemon: dockerfile parse error: no FROM instruction found (the first instruction must be FROM)");
  } else {
    lines.forEach((l, i) => {
      if (status === "Failed") return;
      const instr = l.split(/\s+/)[0].toUpperCase();
      if (!DOCKER_INSTRUCTIONS.includes(instr)) {
        status = "Failed";
        log.push(`Error: dockerfile parse error line ${i + 1}: unknown instruction: ${instr}`);
        return;
      }
      log.push(`Step ${i + 1}/${lines.length} : ${l}`);
      if (instr === "FROM") baseImage = l.split(/\s+/)[1];
      if (instr === "EXPOSE") exposed = l.split(/\s+/).slice(1).map((x) => parseInt(x, 10)).filter((n) => !Number.isNaN(n));
      if (instr === "RUN" && /exit\s+[1-9]|false$/.test(l)) {
        status = "Failed";
        log.push(`The command '/bin/sh -c ${l.slice(4)}' returned a non-zero code: 1`);
      }
      log.push(` ---> ${fakeGuid().replace(/-/g, "").slice(0, 12)}`);
    });
  }
  const digest = `sha256:${fakeGuid(seeded(input.image + Date.now())).replace(/-/g, "")}${"0".repeat(32)}`.slice(0, 71);
  if (status === "Succeeded") log.push(`Successfully tagged ${acr.properties.loginServer}/${repo}:${tag}`, `${tag}: digest: ${digest} size: 1784`);
  const updated = await mutate(ctx, acr, (p) => {
    if (status === "Succeeded") {
      const tags = (p.repositories[repo] ?? []).filter((t: Props) => t.tag !== tag);
      tags.unshift({ tag, digest, created: new Date().toISOString(), baseImage, exposed });
      p.repositories[repo] = tags;
    }
    p.builds = [{ id: fakeGuid().slice(0, 4), image: input.image, status, time: new Date().toISOString() }, ...p.builds].slice(0, 30);
  }, status === "Succeeded" ? "Build and Push Image" : undefined, { image: input.image });
  if (status !== "Succeeded") await logActivity(ctx, acr, "Build and Push Image", "Failed", { image: input.image });
  return { status, log, image: `${acr.properties.loginServer}/${repo}:${tag}`, registry: updated };
}

export async function deleteImage(ctx: Ctx, acr: Res, image: string) {
  const [repo, tag] = image.split(":");
  if (!acr.properties.repositories[repo]) throw notFound(`Repository '${repo}' not found.`);
  return mutate(ctx, acr, (p) => {
    if (tag) p.repositories[repo] = p.repositories[repo].filter((t: Props) => t.tag !== tag);
    if (!tag || !p.repositories[repo].length) delete p.repositories[repo];
  }, "Delete Repository or Tag", { image });
}

/** Resolves whether an image reference can be pulled by the simulator. */
export async function resolveImage(ctx: Ctx, image: string): Promise<{ ok: boolean; reason: string; exposed?: number[] }> {
  const m = /^([a-z0-9]+)\.azurecr\.sim\/([^:]+)(?::(.+))?$/.exec(image);
  if (m) {
    const acr = await findAnyByName(ctx, T.ACR, m[1]);
    if (!acr) return { ok: false, reason: `Failed to pull image "${image}": registry ${m[1]}.azurecr.sim not found` };
    const tags = acr.properties.repositories[m[2]] as Props[] | undefined;
    const t = tags?.find((x) => x.tag === (m[3] ?? "latest"));
    if (!t) return { ok: false, reason: `Failed to pull image "${image}": manifest unknown: manifest tagged by "${m[3] ?? "latest"}" is not found` };
    return { ok: true, reason: "pulled", exposed: t.exposed };
  }
  const base = image.split(":")[0];
  if (PUBLIC_IMAGES.includes(base)) return { ok: true, reason: "pulled", exposed: base === "nginx" || base === "httpd" ? [80] : [] };
  return { ok: false, reason: `Failed to pull image "${image}": pull access denied, repository does not exist or may require authorization` };
}

export async function createContainerGroup(ctx: Ctx, raw: unknown) {
  const input = z.object({ resourceGroup: z.string().min(1), name: z.string().min(1).max(63).regex(/^[a-z0-9]([a-z0-9-]*[a-z0-9])?$/, "Lowercase letters, digits and hyphens"), location: z.string().optional(), image: z.string().min(1), cpu: z.coerce.number().min(0.5).max(4).default(1), memoryGB: z.coerce.number().min(0.5).max(16).default(1.5), ports: z.array(z.coerce.number().int().min(1).max(65535)).default([80]), dnsNameLabel: z.string().optional(), environmentVariables: z.record(z.string(), z.string()).default({}), restartPolicy: z.enum(["Always", "OnFailure", "Never"]).default("Always") }).parse(raw);
  const pull = await resolveImage(ctx, input.image);
  const state = pull.ok ? "Running" : "Waiting";
  return createResource(ctx, {
    type: T.ACI,
    resourceGroup: input.resourceGroup,
    name: input.name,
    location: input.location,
    status: pull.ok ? "Succeeded" : "Failed",
    properties: { ...input, state, ipAddress: publicIpFor(`${ctx.userId}:aci:${input.name}`), fqdn: input.dnsNameLabel ? `${input.dnsNameLabel}.sim-aci.azuregigs.local` : null, events: [{ time: new Date().toISOString(), type: pull.ok ? "Normal" : "Warning", message: pull.ok ? `Successfully pulled image "${input.image}"` : pull.reason }, ...(pull.ok ? [{ time: new Date().toISOString(), type: "Normal", message: "Started container" }] : [])], logs: pull.ok ? [`Listening on port ${input.ports[0]}`] : [], restartCount: 0 },
  });
}

export async function containerGroupAction(ctx: Ctx, cg: Res, action: "start" | "stop" | "restart") {
  return mutate(ctx, cg, (p) => {
    p.state = action === "stop" ? "Stopped" : "Running";
    if (action === "restart") p.restartCount = (p.restartCount ?? 0) + 1;
    p.events.push({ time: new Date().toISOString(), type: "Normal", message: action === "stop" ? "Container group stopped" : "Started container" });
  }, `${action[0].toUpperCase()}${action.slice(1)} Container Group`);
}

// ---------------- AKS ----------------

export async function createCluster(ctx: Ctx, raw: unknown) {
  const input = z.object({ resourceGroup: z.string().min(1), name: z.string().min(1).max(63), location: z.string().optional(), kubernetesVersion: z.enum(["1.30", "1.31", "1.32"]).default("1.31"), nodeCount: z.coerce.number().int().min(1).max(10).default(2), nodeVmSize: z.string().default("Standard_D2s_v5"), attachAcr: z.string().optional(), networkPlugin: z.enum(["azure", "kubenet"]).default("azure") }).parse(raw);
  const size = findSize(input.nodeVmSize);
  if (!size) throw badRequest("SkuNotAvailable", `Node VM size '${input.nodeVmSize}' is not available.`);
  if (size.vcpus < 2) throw badRequest("InsufficientVCPUQuota", "AKS system node pools require VM sizes with at least 2 vCPUs.");
  let acrName: string | null = null;
  if (input.attachAcr) {
    const acr = await findAnyByName(ctx, T.ACR, input.attachAcr);
    if (!acr) throw notFound(`Container registry '${input.attachAcr}' not found.`);
    acrName = acr.name;
  }
  const nodes = Array.from({ length: input.nodeCount }, (_, i) => ({ name: `aks-nodepool1-${(10000000 + Math.floor(seeded(input.name)() * 89999999)).toString()}-vmss00000${i}`, status: "Ready", version: `v${input.kubernetesVersion}.2` }));
  return createResource(ctx, {
    type: T.AKS,
    resourceGroup: input.resourceGroup,
    name: input.name,
    location: input.location,
    properties: { kubernetesVersion: input.kubernetesVersion, nodeCount: input.nodeCount, nodeVmSize: size.name, nodes, powerState: "Running", fqdn: `${input.name.toLowerCase()}-dns.hcp.sim.azuregigs.local`, attachedAcr: acrName, networkPlugin: input.networkPlugin, namespaces: ["default", "kube-system"], deployments: [] as Props[], pods: [] as Props[], services: [] as Props[], events: [] as Props[] },
  });
}

function podName(dep: string, i: number, seed: string) {
  const r = seeded(`${dep}:${seed}:${i}`);
  const c = "bcdfghjklmnpqrstvwxz2456789";
  const s = (n: number) => Array.from({ length: n }, () => c[Math.floor(r() * c.length)]).join("");
  return `${dep}-${s(10)}-${s(5)}`;
}

/** Recomputes pods for a deployment based on image availability and env requirements. */
async function reconcile(ctx: Ctx, cluster: Props, dep: Props): Promise<void> {
  let status = "Running";
  let reason = "";
  const pull = await resolveImage(ctx, dep.image);
  if (cluster.powerState !== "Running") { status = "Pending"; reason = "cluster stopped"; }
  else if (!pull.ok) { status = "ImagePullBackOff"; reason = pull.reason; }
  else if (/\.azurecr\.sim\//.test(dep.image) && cluster.attachedAcr?.toLowerCase() !== dep.image.split(".")[0]) { status = "ImagePullBackOff"; reason = `Failed to pull image "${dep.image}": 401 Unauthorized (cluster kubelet identity has no AcrPull role on the registry - run 'az aks update --attach-acr')`; }
  else if ((dep.requiredEnv ?? []).some((k: string) => !(k in (dep.env ?? {})))) { status = "CrashLoopBackOff"; reason = `Error: environment variable ${(dep.requiredEnv as string[]).find((k) => !(k in (dep.env ?? {})))} is not set`; }
  const seed = `${dep.generation ?? 1}`;
  cluster.pods = (cluster.pods as Props[]).filter((p) => !(p.deployment === dep.name && p.namespace === dep.namespace));
  for (let i = 0; i < dep.replicas; i++) {
    cluster.pods.push({ name: podName(dep.name, i, seed), namespace: dep.namespace, deployment: dep.name, image: dep.image, status, ready: status === "Running" ? "1/1" : "0/1", restarts: status === "CrashLoopBackOff" ? 5 + i : 0, node: cluster.nodes[i % cluster.nodes.length].name, ip: `10.244.${i % 3}.${10 + i}`, reason, age: new Date().toISOString() });
  }
  dep.readyReplicas = status === "Running" ? dep.replicas : 0;
  dep.podStatus = status;
  cluster.events = [{ time: new Date().toISOString(), type: status === "Running" ? "Normal" : "Warning", object: `deployment/${dep.name}`, message: status === "Running" ? `Scaled up replica set ${dep.name} to ${dep.replicas}` : reason }, ...(cluster.events ?? [])].slice(0, 100);
}

export const deploymentSchema = z.object({ name: z.string().min(1).max(63).regex(/^[a-z0-9]([a-z0-9-]*[a-z0-9])?$/), namespace: z.string().default("default"), image: z.string().min(1), replicas: z.coerce.number().int().min(0).max(20).default(1), port: z.coerce.number().int().optional(), env: z.record(z.string(), z.string()).optional(), requiredEnv: z.array(z.string()).optional() });

export async function aksCreateDeployment(ctx: Ctx, aks: Res, raw: unknown) {
  const input = deploymentSchema.parse(raw);
  if (!(aks.properties.namespaces as string[]).includes(input.namespace)) throw notFound(`namespaces "${input.namespace}" not found`);
  if ((aks.properties.deployments as Props[]).some((d) => d.name === input.name && d.namespace === input.namespace)) throw conflict("AlreadyExists", `deployments.apps "${input.name}" already exists`);
  const p = structuredClone(aks.properties);
  const dep = { ...input, env: input.env ?? {}, generation: 1, readyReplicas: 0 };
  p.deployments.push(dep);
  await reconcile(ctx, p, dep);
  return mutate(ctx, aks, () => p, "Create Kubernetes Deployment", { deployment: input.name });
}

function findDep(p: Props, name: string, ns: string) {
  const d = (p.deployments as Props[]).find((x) => x.name === name && x.namespace === ns);
  if (!d) throw notFound(`deployments.apps "${name}" not found in namespace "${ns}"`);
  return d;
}

export async function aksScale(ctx: Ctx, aks: Res, name: string, replicas: number, ns = "default") {
  if (replicas < 0 || replicas > 20) throw badRequest("Invalid", "replicas must be 0-20");
  const p = structuredClone(aks.properties);
  const d = findDep(p, name, ns);
  d.replicas = replicas;
  await reconcile(ctx, p, d);
  return mutate(ctx, aks, () => p, "Scale Kubernetes Deployment", { deployment: name, replicas });
}

export async function aksSetImage(ctx: Ctx, aks: Res, raw: unknown) {
  const input = z.object({ deployment: z.string(), image: z.string().min(1), namespace: z.string().default("default"), createIfMissing: z.boolean().default(false) }).parse(raw);
  const p = structuredClone(aks.properties);
  let d = (p.deployments as Props[]).find((x) => x.name === input.deployment && x.namespace === input.namespace);
  if (!d) {
    if (!input.createIfMissing) throw notFound(`deployments.apps "${input.deployment}" not found`);
    d = { name: input.deployment, namespace: input.namespace, image: input.image, replicas: 2, env: {}, generation: 0, readyReplicas: 0 };
    p.deployments.push(d);
  }
  d.image = input.image;
  d.generation = (d.generation ?? 1) + 1;
  await reconcile(ctx, p, d);
  await mutate(ctx, aks, () => p, "Update Kubernetes Deployment Image", input);
  return d;
}

export async function aksSetEnv(ctx: Ctx, aks: Res, name: string, env: Record<string, string>, ns = "default") {
  const p = structuredClone(aks.properties);
  const d = findDep(p, name, ns);
  d.env = { ...(d.env ?? {}), ...env };
  d.generation = (d.generation ?? 1) + 1;
  await reconcile(ctx, p, d);
  return mutate(ctx, aks, () => p, "Update Kubernetes Deployment Env", { deployment: name, keys: Object.keys(env) });
}

export async function aksRolloutRestart(ctx: Ctx, aks: Res, name: string, ns = "default") {
  const p = structuredClone(aks.properties);
  const d = findDep(p, name, ns);
  d.generation = (d.generation ?? 1) + 1;
  await reconcile(ctx, p, d);
  return mutate(ctx, aks, () => p, "Restart Kubernetes Deployment", { deployment: name });
}

export async function aksDeleteDeployment(ctx: Ctx, aks: Res, name: string, ns = "default") {
  const p = structuredClone(aks.properties);
  findDep(p, name, ns);
  p.deployments = p.deployments.filter((d: Props) => !(d.name === name && d.namespace === ns));
  p.pods = p.pods.filter((x: Props) => !(x.deployment === name && x.namespace === ns));
  p.services = p.services.filter((s: Props) => !(s.selector === name && s.namespace === ns));
  return mutate(ctx, aks, () => p, "Delete Kubernetes Deployment", { deployment: name });
}

export async function aksDeletePod(ctx: Ctx, aks: Res, pod: string, ns = "default") {
  const p = structuredClone(aks.properties);
  const x = (p.pods as Props[]).find((q) => q.name === pod && q.namespace === ns);
  if (!x) throw notFound(`pods "${pod}" not found`);
  const d = findDep(p, x.deployment, ns);
  d.generation = (d.generation ?? 1) + 1;
  await reconcile(ctx, p, d);
  return mutate(ctx, aks, () => p, "Delete Pod", { pod });
}

export async function aksExpose(ctx: Ctx, aks: Res, raw: unknown) {
  const input = z.object({ deployment: z.string(), namespace: z.string().default("default"), port: z.coerce.number().int().min(1).max(65535), targetPort: z.coerce.number().int().optional(), type: z.enum(["ClusterIP", "LoadBalancer", "NodePort"]).default("ClusterIP") }).parse(raw);
  const p = structuredClone(aks.properties);
  findDep(p, input.deployment, input.namespace);
  p.services = p.services.filter((s: Props) => !(s.name === input.deployment && s.namespace === input.namespace));
  p.services.push({ name: input.deployment, namespace: input.namespace, selector: input.deployment, type: input.type, port: input.port, targetPort: input.targetPort ?? input.port, clusterIP: `10.0.${Math.floor(Math.random() * 250)}.${Math.floor(Math.random() * 250)}`, externalIP: input.type === "LoadBalancer" ? publicIpFor(`${aks.id}:${input.deployment}`) : null });
  return mutate(ctx, aks, () => p, "Create Kubernetes Service", input);
}

export async function aksCreateNamespace(ctx: Ctx, aks: Res, name: string) {
  if (!/^[a-z0-9]([a-z0-9-]*[a-z0-9])?$/.test(name)) throw badRequest("Invalid", `namespace name "${name}" is invalid`);
  if ((aks.properties.namespaces as string[]).includes(name)) throw conflict("AlreadyExists", `namespaces "${name}" already exists`);
  return mutate(ctx, aks, (p) => {
    p.namespaces.push(name);
  }, "Create Namespace", { name });
}

export async function aksPower(ctx: Ctx, aks: Res, action: "start" | "stop") {
  const p = structuredClone(aks.properties);
  p.powerState = action === "stop" ? "Stopped" : "Running";
  for (const n of p.nodes) n.status = action === "stop" ? "NotReady" : "Ready";
  for (const d of p.deployments) await reconcile(ctx, p, d);
  return mutate(ctx, aks, () => p, action === "stop" ? "Stop Managed Cluster" : "Start Managed Cluster");
}

export async function aksScaleNodes(ctx: Ctx, aks: Res, count: number) {
  if (count < 1 || count > 10) throw badRequest("Invalid", "Node count must be 1-10.");
  const p = structuredClone(aks.properties);
  p.nodeCount = count;
  const base = p.nodes[0]?.name.replace(/\d$/, "") ?? "aks-nodepool1-00000000-vmss00000";
  p.nodes = Array.from({ length: count }, (_, i) => ({ name: `${base}${i}`, status: p.powerState === "Running" ? "Ready" : "NotReady", version: `v${p.kubernetesVersion}.2` }));
  return mutate(ctx, aks, () => p, "Scale Node Pool", { count });
}

export async function aksAttachAcr(ctx: Ctx, aks: Res, acrName: string) {
  const acr = await findAnyByName(ctx, T.ACR, acrName);
  if (!acr) throw notFound(`Container registry '${acrName}' not found.`);
  const p = structuredClone(aks.properties);
  p.attachedAcr = acr.name;
  for (const d of p.deployments) await reconcile(ctx, p, d);
  return mutate(ctx, aks, () => p, "Attach Container Registry", { acr: acr.name });
}

export async function refreshCluster(ctx: Ctx, aks: Res) {
  const fresh = await getById(ctx, aks.id);
  const p = structuredClone(fresh.properties);
  for (const d of p.deployments) await reconcile(ctx, p, d);
  return mutate(ctx, fresh, () => p);
}

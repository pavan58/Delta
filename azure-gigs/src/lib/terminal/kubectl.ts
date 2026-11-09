/** Simulated kubectl against the AKS cluster selected by `az aks get-credentials`. */
import YAML from "yaml";
import { AppError } from "@/lib/errors";
import { findByName, getById, Props, Res } from "@/lib/sim/engine";
import { T } from "@/lib/sim/types";
import { runAction } from "@/lib/sim/registry";
import { refreshCluster } from "@/lib/sim/services/containers";
import { parseArgs, flag, boolFlag } from "./parse";
import { asTable, toYaml } from "./format";
import { CliError, CmdResult, Term } from "./types";
import { readFile, resolvePath } from "./vfs";

const age = (iso: string) => {
  const m = Math.max(0, Math.round((Date.now() - Date.parse(iso)) / 60000));
  return m < 60 ? `${m}m` : m < 1440 ? `${Math.round(m / 60)}h` : `${Math.round(m / 1440)}d`;
};

const KIND: Record<string, string> = { po: "pods", pod: "pods", pods: "pods", deploy: "deployments", deployment: "deployments", deployments: "deployments", svc: "services", service: "services", services: "services", no: "nodes", node: "nodes", nodes: "nodes", ns: "namespaces", namespace: "namespaces", namespaces: "namespaces", ev: "events", events: "events" };

function table(rows: Props[]) {
  return asTable(rows).split("\n").filter((_, i) => i !== 1).join("\n").replace(/^.*$/m, (h) => h.toUpperCase());
}

export async function runKubectl(t: Term, argv: string[]): Promise<CmdResult> {
  if (!t.state.az.aksContext) return { stdout: "", stderr: "error: no context exists. Run 'az aks get-credentials -g <rg> -n <cluster>' first.\nThe connection to the server localhost:8080 was refused - did you specify the right host or port?", exitCode: 1 };
  const cluster = await findByName(t.ctx, T.AKS, t.state.az.aksContext.resourceGroup, t.state.az.aksContext.cluster);
  if (!cluster) return { stdout: "", stderr: `error: cluster '${t.state.az.aksContext.cluster}' no longer exists`, exitCode: 1 };
  const p = parseArgs(argv, { n: "namespace", o: "output", A: "all-namespaces", f: "filename" });
  const ns = flag(p, "namespace") ?? "default";
  const all = boolFlag(p, "all-namespaces");
  const [verb, ...rest] = p.positional;
  const act = async (a: string, payload: Props) => {
    const r = await runAction(t.ctx, cluster, a, payload);
    t.changes.push(`kubectl ${verb} on ${cluster.name}`);
    return r;
  };
  try {
    if (cluster.properties.powerState !== "Running" && verb !== "config") throw new CliError(`Unable to connect to the server: dial tcp: lookup ${cluster.properties.fqdn}: cluster is stopped`);
    const c = (await refreshCluster(t.ctx, cluster)).properties;
    switch (verb) {
      case "version": return { stdout: `Client Version: v1.31.2\nServer Version: v${c.kubernetesVersion}.2` };
      case "cluster-info": return { stdout: `Kubernetes control plane is running at https://${c.fqdn}:443\nCoreDNS is running at https://${c.fqdn}:443/api/v1/namespaces/kube-system/services/kube-dns:dns/proxy` };
      case "config": return { stdout: rest[0] === "current-context" ? cluster.name : `contexts:\n- name: ${cluster.name}` };
      case "get": {
        const [kindRaw, name] = (rest[0] ?? "").includes("/") ? rest[0].split("/") : rest;
        const kind = KIND[kindRaw ?? ""];
        if (!kind) throw new CliError(`error: the server doesn't have a resource type "${kindRaw ?? ""}"`);
        const inNs = (x: Props) => all || x.namespace === ns;
        let rows: Props[] = [];
        if (kind === "pods") rows = (c.pods as Props[]).filter(inNs).filter((x) => !name || x.name === name).map((x) => ({ ...(all ? { namespace: x.namespace } : {}), name: x.name, ready: x.ready, status: x.status, restarts: x.restarts, age: age(x.age), ...(flag(p, "output") === "wide" ? { ip: x.ip, node: x.node } : {}) }));
        if (kind === "deployments") rows = (c.deployments as Props[]).filter(inNs).filter((x) => !name || x.name === name).map((x) => ({ ...(all ? { namespace: x.namespace } : {}), name: x.name, ready: `${x.readyReplicas}/${x.replicas}`, "up-to-date": x.replicas, available: x.readyReplicas, ...(flag(p, "output") === "wide" ? { images: x.image } : {}) }));
        if (kind === "services") rows = [{ name: "kubernetes", type: "ClusterIP", "cluster-ip": "10.0.0.1", "external-ip": "<none>", "port(s)": "443/TCP", namespace: "default" }, ...(c.services as Props[]).map((x) => ({ name: x.name, type: x.type, "cluster-ip": x.clusterIP, "external-ip": x.externalIP ?? "<none>", "port(s)": `${x.port}/TCP`, namespace: x.namespace }))].filter(inNs).map(({ namespace, ...r }) => (all ? { namespace, ...r } : r));
        if (kind === "nodes") rows = (c.nodes as Props[]).map((x) => ({ name: x.name, status: x.status, roles: "<none>", age: age(cluster.createdAt.toISOString()), version: x.version }));
        if (kind === "namespaces") rows = (c.namespaces as string[]).map((x) => ({ name: x, status: "Active" }));
        if (kind === "events") rows = (c.events as Props[]).slice(0, 30).map((e) => ({ "last seen": age(e.time), type: e.type, object: e.object, message: e.message }));
        if (name && !rows.length) throw new CliError(`Error from server (NotFound): ${kind} "${name}" not found`);
        if (!rows.length) return { stdout: `No resources found in ${all ? "any" : ns} namespace.` };
        if (flag(p, "output") === "json") return { stdout: JSON.stringify({ items: rows }, null, 2) };
        if (flag(p, "output") === "yaml") return { stdout: toYaml({ items: rows }) };
        return { stdout: table(rows) };
      }
      case "describe": {
        const [kindRaw, name] = (rest[0] ?? "").includes("/") ? rest[0].split("/") : rest;
        const kind = KIND[kindRaw ?? ""];
        if (kind === "pods") {
          const pod = (c.pods as Props[]).find((x) => x.name === name && x.namespace === ns);
          if (!pod) throw new CliError(`Error from server (NotFound): pods "${name}" not found`);
          const dep = (c.deployments as Props[]).find((d) => d.name === pod.deployment);
          const events = pod.status === "Running" ? ["Normal  Scheduled  Successfully assigned", `Normal  Pulled     Container image "${pod.image}" already present on machine`, "Normal  Started    Started container"] : pod.status === "ImagePullBackOff" ? [`Warning Failed     ${pod.reason}`, "Warning Failed     Error: ErrImagePull", `Normal  BackOff    Back-off pulling image "${pod.image}"`] : ["Normal  Started    Started container", `Warning BackOff    Back-off restarting failed container`];
          return { stdout: [`Name:         ${pod.name}`, `Namespace:    ${pod.namespace}`, `Node:         ${pod.node}`, `Status:       ${pod.status === "Running" ? "Running" : "Pending"}`, `IP:           ${pod.ip}`, "Containers:", `  ${pod.deployment}:`, `    Image:          ${pod.image}`, `    State:          ${pod.status === "Running" ? "Running" : "Waiting"}`, ...(pod.status !== "Running" ? [`      Reason:       ${pod.status}`] : []), `    Restart Count:  ${pod.restarts}`, "    Environment:", ...Object.entries(dep?.env ?? {}).map(([k, v]) => `      ${k}:  ${v}`), ...(Object.keys(dep?.env ?? {}).length ? [] : ["      <none>"]), "Events:", ...events.map((e) => `  ${e}`)].join("\n") };
        }
        if (kind === "deployments") {
          const d = (c.deployments as Props[]).find((x) => x.name === name && x.namespace === ns);
          if (!d) throw new CliError(`Error from server (NotFound): deployments.apps "${name}" not found`);
          return { stdout: [`Name:               ${d.name}`, `Namespace:          ${d.namespace}`, `Replicas:           ${d.replicas} desired | ${d.replicas} updated | ${d.replicas} total | ${d.readyReplicas} available | ${d.replicas - d.readyReplicas} unavailable`, `StrategyType:       RollingUpdate`, `Pod Template:`, `  Containers:`, `   ${d.name}:`, `    Image:  ${d.image}`, `    Environment:`, ...Object.entries(d.env ?? {}).map(([k, v]) => `      ${k}: ${v}`)].join("\n") };
        }
        if (kind === "nodes") return { stdout: (c.nodes as Props[]).map((n) => `Name: ${n.name}\nConditions:\n  Ready  ${n.status === "Ready" ? "True" : "False"}\nCapacity:\n  cpu: 2\n  memory: 8Gi`).join("\n\n") };
        throw new CliError(`error: describe for "${kindRaw}" is not supported by the simulator (use pod, deployment, node)`);
      }
      case "logs": {
        const pod = (c.pods as Props[]).find((x) => x.name === rest[0] && x.namespace === ns);
        if (!pod) throw new CliError(`Error from server (NotFound): pods "${rest[0]}" not found`);
        if (pod.status === "ImagePullBackOff") throw new CliError(`Error from server (BadRequest): container "${pod.deployment}" in pod "${pod.name}" is waiting to start: trying and failing to pull image`);
        if (pod.status === "CrashLoopBackOff") return { stdout: `Starting application...\n${pod.reason}\nProcess exited with code 1` };
        return { stdout: `Server listening on :8080\nGET /health 200 2ms\nGET / 200 5ms` };
      }
      case "scale": {
        const target = (rest[0] ?? "").replace(/^deployment(s)?\//, "").replace(/^deploy\//, "") || rest[1];
        const replicas = Number(flag(p, "replicas"));
        if (Number.isNaN(replicas)) throw new CliError("error: --replicas=COUNT is required");
        await act("scale", { deployment: target, replicas, namespace: ns });
        return { stdout: `deployment.apps/${target} scaled` };
      }
      case "set": {
        const target = (rest[1] ?? "").split("/").pop()!;
        if (rest[0] === "image") {
          const [, image] = (rest[2] ?? "").split("=");
          if (!image) throw new CliError("error: expected CONTAINER=IMAGE");
          await act("setImage", { deployment: target, image, namespace: ns });
          return { stdout: `deployment.apps/${target} image updated` };
        }
        if (rest[0] === "env") {
          const env = Object.fromEntries(rest.slice(2).map((kv) => kv.split("=")).filter((x) => x.length === 2));
          await act("setEnv", { deployment: target, env, namespace: ns });
          return { stdout: `deployment.apps/${target} env updated` };
        }
        throw new CliError(`error: unknown command "set ${rest[0]}"`);
      }
      case "rollout": {
        const target = (rest[1] ?? "").split("/").pop()!;
        if (rest[0] === "restart") { await act("rolloutRestart", { deployment: target, namespace: ns }); return { stdout: `deployment.apps/${target} restarted` }; }
        if (rest[0] === "status") {
          const d = (c.deployments as Props[]).find((x) => x.name === target && x.namespace === ns);
          if (!d) throw new CliError(`Error from server (NotFound): deployments.apps "${target}" not found`);
          return d.readyReplicas === d.replicas ? { stdout: `deployment "${target}" successfully rolled out` } : { stdout: `Waiting for deployment "${target}" rollout to finish: 0 of ${d.replicas} updated replicas are available...`, stderr: `error: deployment "${target}" exceeded its progress deadline`, exitCode: 1 };
        }
        throw new CliError(`error: unknown rollout subcommand "${rest[0]}"`);
      }
      case "create": {
        if (rest[0] === "deployment") {
          const image = flag(p, "image");
          if (!image) throw new CliError("error: required flag(s) \"image\" not set");
          await act("createDeployment", { name: rest[1], image, replicas: Number(flag(p, "replicas") ?? 1), namespace: ns });
          return { stdout: `deployment.apps/${rest[1]} created` };
        }
        if (rest[0] === "namespace" || rest[0] === "ns") { await act("createNamespace", { name: rest[1] }); return { stdout: `namespace/${rest[1]} created` }; }
        throw new CliError(`error: create ${rest[0]} is not supported by the simulator (deployment, namespace)`);
      }
      case "expose": {
        const target = (rest[0] === "deployment" ? rest[1] : rest[0]?.split("/").pop()) ?? "";
        await act("expose", { deployment: target, namespace: ns, port: Number(flag(p, "port")), targetPort: flag(p, "target-port") ? Number(flag(p, "target-port")) : undefined, type: flag(p, "type") ?? "ClusterIP" });
        return { stdout: `service/${target} exposed` };
      }
      case "delete": {
        const [kindRaw, name] = (rest[0] ?? "").includes("/") ? rest[0].split("/") : rest;
        const kind = KIND[kindRaw ?? ""];
        if (kind === "pods") { await act("deletePod", { pod: name, namespace: ns }); return { stdout: `pod "${name}" deleted` }; }
        if (kind === "deployments") { await act("deleteDeployment", { deployment: name, namespace: ns }); return { stdout: `deployment.apps "${name}" deleted` }; }
        throw new CliError(`error: delete ${kindRaw} is not supported by the simulator`);
      }
      case "apply": {
        const file = flag(p, "filename");
        if (!file) throw new CliError("error: must specify -f");
        const docs = YAML.parseAllDocuments(readFile(t.state, resolvePath(t.state, file))).map((d) => d.toJSON() as Props);
        const out: string[] = [];
        for (const d of docs) {
          if (!d) continue;
          const name = d.metadata?.name;
          const dns = d.metadata?.namespace ?? ns;
          if (d.kind === "Deployment") {
            const ct = d.spec?.template?.spec?.containers?.[0];
            if (!ct?.image) throw new CliError(`error: Deployment "${name}" is invalid: spec.template.spec.containers[0].image: Required value`);
            const env = Object.fromEntries(((ct.env ?? []) as Props[]).map((e) => [e.name, String(e.value ?? "")]));
            const exists = (c.deployments as Props[]).some((x) => x.name === name && x.namespace === dns);
            if (exists) {
              await act("setImage", { deployment: name, image: ct.image, namespace: dns });
              if (Object.keys(env).length) await act("setEnv", { deployment: name, env, namespace: dns });
              await act("scale", { deployment: name, replicas: d.spec.replicas ?? 1, namespace: dns });
              out.push(`deployment.apps/${name} configured`);
            } else {
              await act("createDeployment", { name, image: ct.image, replicas: d.spec.replicas ?? 1, namespace: dns, env });
              out.push(`deployment.apps/${name} created`);
            }
          } else if (d.kind === "Service") {
            await act("expose", { deployment: d.spec?.selector?.app ?? name, namespace: dns, port: d.spec?.ports?.[0]?.port ?? 80, targetPort: d.spec?.ports?.[0]?.targetPort, type: d.spec?.type ?? "ClusterIP" });
            out.push(`service/${name} created`);
          } else if (d.kind === "Namespace") {
            await act("createNamespace", { name });
            out.push(`namespace/${name} created`);
          } else throw new CliError(`error: resource kind "${d.kind}" is not supported by the simulator (Deployment, Service, Namespace)`);
        }
        return { stdout: out.join("\n") };
      }
      case "top": {
        const fresh = (await getById(t.ctx, cluster.id)) as Res;
        if (rest[0]?.startsWith("no")) return { stdout: table((fresh.properties.nodes as Props[]).map((n, i) => ({ name: n.name, "cpu(cores)": `${120 + i * 37}m`, "cpu%": `${6 + i * 2}%`, "memory(bytes)": `${1400 + i * 120}Mi`, "memory%": `${21 + i}%` }))) };
        return { stdout: table((fresh.properties.pods as Props[]).filter((x) => x.namespace === ns && x.status === "Running").map((x) => ({ name: x.name, "cpu(cores)": "3m", "memory(bytes)": "24Mi" }))) || "No resources found" };
      }
      default:
        throw new CliError(`error: unknown command "${verb ?? ""}" for "kubectl". Supported: get, describe, logs, scale, set image|env, rollout restart|status, create deployment|namespace, expose, delete, apply -f, top, cluster-info, config, version`);
    }
  } catch (e) {
    if (e instanceof CliError) return { stdout: "", stderr: e.message, exitCode: 1 };
    if (e instanceof AppError) return { stdout: "", stderr: `Error from server: ${e.message}`, exitCode: 1 };
    throw e;
  }
}

/** Metrics generation, resource health, metric alerts, cost estimates and budgets. */
import { z } from "zod";
import { badRequest, notFound } from "@/lib/errors";
import { createResource, Ctx, getById, listResources, mutate, Props, Res, seeded } from "../engine";
import { MONTHLY_PRICE, PLAN_SKUS, SQL_SKUS, VM_SIZES } from "../catalog";
import { T } from "../types";

export const METRICS: Record<string, { name: string; unit: string }[]> = {
  [T.VM]: [
    { name: "Percentage CPU", unit: "%" },
    { name: "Available Memory Percentage", unit: "%" },
    { name: "OS Disk Used Percentage", unit: "%" },
    { name: "Network In Total", unit: "MB" },
  ],
  [T.SITE]: [
    { name: "Requests", unit: "count" },
    { name: "Http5xx", unit: "count" },
    { name: "Response Time", unit: "ms" },
  ],
  [T.STORAGE]: [
    { name: "Used Capacity", unit: "KB" },
    { name: "Transactions", unit: "count" },
  ],
  [T.SQL_DB]: [
    { name: "DTU Percentage", unit: "%" },
    { name: "Failed Connections", unit: "count" },
  ],
  [T.AKS]: [{ name: "Node CPU Percentage", unit: "%" }, { name: "Ready Pods", unit: "count" }],
};

/** Deterministic time series: values depend on resource state (stopped VM = 0, injected high CPU = ~97%). */
export function metricSeries(r: Res, metric: string, points = 30, stepMinutes = 2): { t: string; v: number }[] {
  const now = Date.now();
  const out: { t: string; v: number }[] = [];
  const p = r.properties;
  for (let i = points - 1; i >= 0; i--) {
    const ts = now - i * stepMinutes * 60000;
    const bucket = Math.floor(ts / (stepMinutes * 60000));
    const rand = seeded(`${r.id}:${metric}:${bucket}`)();
    let v = 0;
    switch (metric) {
      case "Percentage CPU": {
        const running = p.powerState === "VM running";
        const startedAt = Date.parse(p.lastStartTime ?? r.createdAt.toISOString());
        const runaway = (p.processes ?? []).filter((x: Props) => x.runaway).reduce((a: number, x: Props) => a + x.cpu, 0);
        const runawaySince = Math.min(...(p.processes ?? []).filter((x: Props) => x.runaway).map((x: Props) => Date.parse(x.since)), Infinity);
        v = !running || ts < startedAt ? 0 : 3 + rand * 9 + (ts >= runawaySince ? Math.min(95, runaway) : 0);
        break;
      }
      case "Available Memory Percentage":
        v = p.powerState === "VM running" ? 55 + rand * 15 - ((p.processes ?? []).some((x: Props) => x.runaway) ? 30 : 0) : 0;
        break;
      case "OS Disk Used Percentage":
        v = p.diskUsedPercent ?? 18;
        break;
      case "Network In Total":
        v = p.powerState === "VM running" ? 0.5 + rand * 4 : 0;
        break;
      case "Requests":
        v = p.state === "Running" ? Math.round(20 + rand * 80) : 0;
        break;
      case "Http5xx": {
        const recent = (p.requests ?? []).filter((x: Props) => x.status >= 500 && Math.abs(Date.parse(x.time) - ts) < stepMinutes * 60000).length;
        v = recent + (p.lastHealth === "Unhealthy" ? Math.round(5 + rand * 10) : 0);
        break;
      }
      case "Response Time":
        v = p.state === "Running" ? 80 + rand * 140 : 0;
        break;
      case "Used Capacity":
        v = Math.round(((p.containers ?? []) as Props[]).reduce((a, c) => a + (c.blobs as Props[]).reduce((b, x) => b + x.size, 0), 0) / 1024);
        break;
      case "Transactions":
        v = Math.round(rand * 50);
        break;
      case "DTU Percentage":
        v = 2 + rand * 20 + Math.min(60, (p.queryCount ?? 0) / 2);
        break;
      case "Failed Connections":
        v = Math.round((p.failedQueries ?? 0) > 0 ? rand * 3 : 0);
        break;
      case "Node CPU Percentage":
        v = p.powerState === "Stopped" ? 0 : 10 + rand * 25;
        break;
      case "Ready Pods":
        v = ((p.deployments ?? []) as Props[]).reduce((a, d) => a + (d.readyReplicas ?? 0), 0);
        break;
      default:
        v = 0;
    }
    out.push({ t: new Date(ts).toISOString(), v: Math.round(v * 10) / 10 });
  }
  return out;
}

export function resourceHealth(r: Res): { state: "Available" | "Unavailable" | "Degraded" | "Unknown"; reason: string } {
  const p = r.properties;
  switch (r.type) {
    case T.VM: {
      if (p.powerState === "VM deallocated") return { state: "Unavailable", reason: "The virtual machine is deallocated (stopped by user)." };
      if (p.powerState === "VM stopped") return { state: "Unavailable", reason: "The virtual machine is stopped." };
      const failed = Object.entries(p.services as Record<string, Props>).filter(([, s]) => s.enabled && s.state !== "running");
      if ((p.processes ?? []).some((x: Props) => x.runaway)) return { state: "Degraded", reason: "High CPU utilization detected inside the guest OS." };
      if (p.diskUsedPercent >= 95) return { state: "Degraded", reason: "OS disk is almost full." };
      if (failed.length) return { state: "Degraded", reason: `Guest service(s) not running: ${failed.map(([n]) => n).join(", ")}.` };
      return { state: "Available", reason: "There aren't any known Azure platform problems affecting this virtual machine." };
    }
    case T.SITE:
      if (p.state === "Stopped") return { state: "Unavailable", reason: "The web app is stopped." };
      if (p.lastHealth === "Unhealthy") return { state: "Degraded", reason: "Recent requests returned HTTP 5xx errors." };
      return { state: "Available", reason: "The web app is running." };
    case T.AKS:
      if (p.powerState === "Stopped") return { state: "Unavailable", reason: "Cluster is stopped." };
      return ((p.deployments ?? []) as Props[]).some((d) => d.readyReplicas < d.replicas) ? { state: "Degraded", reason: "Some deployments have unavailable replicas." } : { state: "Available", reason: "All nodes ready." };
    default:
      return { state: "Available", reason: "No known issues." };
  }
}

export const alertSchema = z.object({
  resourceGroup: z.string().min(1),
  name: z.string().min(1).max(100),
  targetResourceId: z.string().min(1),
  metric: z.string().min(1),
  operator: z.enum(["GreaterThan", "GreaterThanOrEqual", "LessThan", "LessThanOrEqual"]).default("GreaterThan"),
  threshold: z.coerce.number(),
  aggregation: z.enum(["Average", "Maximum", "Minimum"]).default("Average"),
  windowMinutes: z.coerce.number().int().min(1).max(1440).default(10),
  severity: z.coerce.number().int().min(0).max(4).default(2),
  actionGroupEmail: z.string().email().optional(),
});

export async function createAlert(ctx: Ctx, raw: unknown) {
  const input = alertSchema.parse(raw);
  const target = await getById(ctx, input.targetResourceId);
  const valid = METRICS[target.type]?.map((m) => m.name) ?? [];
  if (!valid.includes(input.metric)) throw badRequest("InvalidMetric", `Metric '${input.metric}' is not available for ${target.type}. Available: ${valid.join(", ") || "none"}.`);
  return createResource(ctx, {
    type: T.ALERT,
    resourceGroup: input.resourceGroup,
    name: input.name,
    location: target.location,
    properties: { ...input, targetName: target.name, targetType: target.type, enabled: true, state: "Resolved", history: [] as Props[], lastEvaluated: null },
    dependsOn: [{ toId: target.id, kind: "alertTarget" }],
  });
}

function compare(op: string, v: number, t: number) {
  return op === "GreaterThan" ? v > t : op === "GreaterThanOrEqual" ? v >= t : op === "LessThan" ? v < t : v <= t;
}

/** Evaluates all enabled alert rules for the learner and records Fired/Resolved transitions. */
export async function evaluateAlerts(ctx: Ctx) {
  const alerts = await listResources(ctx, { type: T.ALERT });
  const results: Props[] = [];
  for (const a of alerts) {
    const p = a.properties;
    if (!p.enabled) continue;
    const target = await getById(ctx, p.targetResourceId).catch(() => null);
    if (!target) continue;
    const pts = Math.max(1, Math.round(p.windowMinutes / 2));
    const series = metricSeries(target, p.metric, pts);
    const vals = series.map((s) => s.v);
    const agg = p.aggregation === "Maximum" ? Math.max(...vals) : p.aggregation === "Minimum" ? Math.min(...vals) : vals.reduce((x, y) => x + y, 0) / vals.length;
    const firing = compare(p.operator, agg, p.threshold);
    const newState = firing ? "Fired" : "Resolved";
    if (newState !== p.state || !p.lastEvaluated) {
      await mutate(ctx, a, (pp) => {
        pp.state = newState;
        pp.lastEvaluated = new Date().toISOString();
        if (newState !== p.state) pp.history = [{ time: new Date().toISOString(), state: newState, value: Math.round(agg * 10) / 10, threshold: p.threshold, severity: p.severity }, ...pp.history].slice(0, 100);
      }, newState !== p.state ? `Alert ${newState}` : undefined, { metric: p.metric, value: agg });
    }
    results.push({ id: a.id, name: a.name, state: newState, value: Math.round(agg * 10) / 10, threshold: p.threshold, metric: p.metric, target: target.name, severity: p.severity });
  }
  return results;
}

export async function setAlertEnabled(ctx: Ctx, a: Res, enabled: boolean) {
  return mutate(ctx, a, (p) => {
    p.enabled = enabled;
  }, enabled ? "Enable Alert Rule" : "Disable Alert Rule");
}

// ---------------- Cost ----------------

export function monthlyCost(r: Res): number {
  const p = r.properties;
  switch (r.type) {
    case T.VM: {
      const size = VM_SIZES.find((s) => s.name === p.vmSize);
      const winUplift = p.osType === "Windows" ? 1.45 : 1;
      return p.powerState === "VM deallocated" ? 0 : (size?.hourly ?? 0.05) * 730 * winUplift;
    }
    case T.DISK:
      return (p.sizeGB ?? 30) * (p.sku === "Premium_LRS" ? 0.15 : p.sku === "StandardSSD_LRS" ? 0.075 : 0.045);
    case T.STORAGE: {
      const gb = Math.max(1, ((p.containers ?? []) as Props[]).reduce((a, c) => a + (c.blobs as Props[]).reduce((b, x) => b + x.size, 0), 0) / 1e9);
      const factor = String(p.sku).includes("GRS") || String(p.sku).includes("GZRS") ? 2 : String(p.sku).includes("ZRS") ? 1.25 : 1;
      return 1 + gb * 0.02 * factor;
    }
    case T.PLAN:
      return PLAN_SKUS.find((s) => s.name === p.sku)?.monthly ?? 0;
    case T.SQL_DB:
      return SQL_SKUS.find((s) => s.name === p.sku)?.monthly ?? 5;
    case T.AKS:
      return p.powerState === "Stopped" ? 0 : (p.nodeCount ?? 1) * ((VM_SIZES.find((s) => s.name === p.nodeVmSize)?.hourly ?? 0.096) * 730);
    case T.ACI:
      return p.state === "Running" ? (p.cpu ?? 1) * 32 + (p.memoryGB ?? 1.5) * 3.5 : 0;
    case T.FUNCTION_APP:
      return Math.min(5, ((p.invocations ?? []) as Props[]).length * 0.0000002 + 0.1);
    default:
      return MONTHLY_PRICE[r.type] ?? 0;
  }
}

export async function costSummary(ctx: Ctx) {
  const resources = (await listResources(ctx)).filter((r) => ![T.RG, T.ENTRA_USER, T.ENTRA_GROUP, T.ENTRA_SP, T.ROLE_ASSIGNMENT, T.BUDGET].includes(r.type as never));
  const items = resources.map((r) => ({ id: r.id, name: r.name, type: r.type, resourceGroup: r.resourceGroup, monthly: Math.round(monthlyCost(r) * 100) / 100 }));
  const total = items.reduce((a, i) => a + i.monthly, 0);
  const byGroup: Record<string, number> = {};
  const byType: Record<string, number> = {};
  for (const i of items) {
    byGroup[i.resourceGroup] = (byGroup[i.resourceGroup] ?? 0) + i.monthly;
    byType[i.type] = (byType[i.type] ?? 0) + i.monthly;
  }
  const dayOfMonth = new Date().getDate();
  const daysInMonth = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).getDate();
  const budgets = (await listResources(ctx, { type: T.BUDGET })).map((b) => {
    const scopeCost = b.properties.resourceGroup ? byGroup[b.properties.resourceGroup] ?? 0 : total;
    const forecast = scopeCost;
    const actual = (scopeCost * dayOfMonth) / daysInMonth;
    return { id: b.id, name: b.name, amount: b.properties.amount, scope: b.properties.resourceGroup || "Subscription", actual: Math.round(actual * 100) / 100, forecast: Math.round(forecast * 100) / 100, thresholds: b.properties.thresholds, breached: (b.properties.thresholds as number[]).filter((t) => forecast >= (b.properties.amount * t) / 100) };
  });
  return { currency: "USD", disclaimer: "Simulated estimates based on illustrative list prices. No real charges are incurred in Virtual Azure Mode.", total: Math.round(total * 100) / 100, monthToDate: Math.round(((total * dayOfMonth) / daysInMonth) * 100) / 100, items: items.sort((a, b) => b.monthly - a.monthly), byGroup, byType, budgets };
}

export async function createBudget(ctx: Ctx, raw: unknown) {
  const input = z.object({ name: z.string().min(1).max(63).regex(/^[\w-]+$/), amount: z.coerce.number().positive().max(1e7), resourceGroup: z.string().optional(), thresholds: z.array(z.coerce.number().int().min(1).max(1000)).default([50, 80, 100]), contactEmail: z.string().email().optional() }).parse(raw);
  if (input.resourceGroup && !(await listResources(ctx, { type: T.RG })).some((r) => r.nameKey === input.resourceGroup!.toLowerCase())) throw notFound(`Resource group '${input.resourceGroup}' not found.`);
  return createResource(ctx, { type: T.BUDGET, resourceGroup: "", name: input.name, properties: { amount: input.amount, resourceGroup: input.resourceGroup ?? "", thresholds: input.thresholds, contactEmail: input.contactEmail ?? null, timeGrain: "Monthly" } });
}

/** Auto-grading engine: evaluates lab checks against the learner's persistent simulator state. */
import type { Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { conflict, notFound } from "@/lib/errors";
import { Ctx, listResources, Props, Res } from "@/lib/sim/engine";
import { T } from "@/lib/sim/types";
import { testConnectivity } from "@/lib/sim/services/compute";
import { browseSite } from "@/lib/sim/services/apps";
import { checkAccess } from "@/lib/sim/services/rbac";
import { LAB_BY_SLUG } from "@/content/labs";
import type { Category, Check, Cond, LabDef } from "./types";
import { injectIncident } from "./incidents";

export const WEIGHTS: Record<Category, number> = { configuration: 40, execution: 30, security: 20, documentation: 10 };
export const PASS_MARK = 70;

export function toRegex(pattern: string) {
  let flags = "i";
  let p = pattern;
  if (p.startsWith("(?i)")) p = p.slice(4);
  try {
    return new RegExp(p, flags);
  } catch {
    flags = "i";
    return new RegExp(p.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), flags);
  }
}

export function getPath(obj: unknown, path: string): unknown {
  let cur: unknown = obj;
  for (const seg of path.split(".")) {
    if (cur === null || cur === undefined || typeof cur !== "object") return undefined;
    const rec = cur as Record<string, unknown>;
    cur = seg in rec ? rec[seg] : rec[Object.keys(rec).find((k) => k.toLowerCase() === seg.toLowerCase()) ?? seg];
  }
  return cur;
}

export function evalCond(obj: unknown, c: Cond): boolean {
  const v = getPath(obj, c.path);
  switch (c.op) {
    case "eq": return typeof v === "string" && typeof c.value === "string" ? v.toLowerCase() === c.value.toLowerCase() : v === c.value;
    case "neq": return v !== c.value;
    case "regex": return v !== undefined && v !== null && toRegex(String(c.value)).test(String(v));
    case "gte": return typeof v === "number" && v >= Number(c.value);
    case "lte": return typeof v === "number" && v <= Number(c.value);
    case "exists": return v !== undefined && v !== null && v !== "";
    case "notExists": return v === undefined || v === null || v === "";
    case "contains": return Array.isArray(v) ? v.some((x) => (typeof x === "string" && typeof c.value === "string" ? x.toLowerCase() === c.value.toLowerCase() : x === c.value)) : typeof v === "string" && v.includes(String(c.value));
    case "in": return Array.isArray(c.value) && c.value.includes(v);
    case "lengthGte": return (Array.isArray(v) ? v.length : v && typeof v === "object" ? Object.keys(v).length : 0) >= Number(c.value);
    case "some": return Array.isArray(v) && v.some((x) => (c.where ?? []).every((w) => evalCond(x, w)));
    case "none": return !Array.isArray(v) || !v.some((x) => (c.where ?? []).every((w) => evalCond(x, w)));
  }
}

export type CheckResult = { label: string; category: Category; passed: boolean; detail: string; hint?: string };

type GradeEnv = { ctx: Ctx; notes: string; startedAt: Date; resources: Res[] };

async function runCheck(env: GradeEnv, c: Check): Promise<{ passed: boolean; detail: string }> {
  const { ctx, resources } = env;
  switch (c.kind) {
    case "resource": {
      let matches = resources.filter((r) => r.type === c.type);
      if (c.name) matches = matches.filter((r) => toRegex(c.name!).test(r.name));
      if (c.resourceGroup) matches = matches.filter((r) => toRegex(c.resourceGroup!).test(r.resourceGroup));
      const found = matches.length;
      if (c.where?.length) matches = matches.filter((r) => c.where!.every((w) => evalCond(r, w)));
      const min = c.min ?? 1;
      if (matches.length >= min) return { passed: true, detail: `Found ${matches.map((m) => m.name).slice(0, 3).join(", ")}` };
      return { passed: false, detail: found ? `Found ${found} matching resource(s) but the configuration is not as required.` : "No matching resource found." };
    }
    case "command": {
      const where: Prisma.CommandHistoryWhereInput = { userId: ctx.userId };
      if (c.shell && c.shell !== "any") where.shell = c.shell;
      if (c.successOnly) where.exitCode = 0;
      const cmds = await prisma.commandHistory.findMany({ where, orderBy: { createdAt: "desc" }, take: 2000, select: { command: true } });
      const re = toRegex(c.pattern);
      const hit = cmds.find((x) => re.test(x.command));
      return hit ? { passed: true, detail: `Ran: ${hit.command.slice(0, 80)}` } : { passed: false, detail: "No matching command found in your history." };
    }
    case "activity": {
      const logs = await prisma.activityLog.findMany({ where: { userId: ctx.userId, status: { not: "Failed" }, source: { notIn: ["fault"] } }, orderBy: { createdAt: "desc" }, take: 3000, select: { operation: true } });
      const re = toRegex(c.operation === ".*" ? ".*" : `^${c.operation}`);
      const n = logs.filter((l) => re.test(l.operation)).length;
      return n >= (c.min ?? 1) ? { passed: true, detail: `${n} matching activity log entr${n === 1 ? "y" : "ies"}` } : { passed: false, detail: `Expected ${c.min ?? 1} '${c.operation}' activity log entr${(c.min ?? 1) === 1 ? "y" : "ies"}, found ${n}.` };
    }
    case "connectivity": {
      const vm = resources.find((r) => r.type === T.VM && toRegex(c.vm).test(r.name));
      if (!vm) return { passed: false, detail: "VM not found." };
      const r = await testConnectivity({ ...ctx, source: "system" }, vm, { port: c.port, source: c.source ?? "Internet" });
      return r.status === c.expect ? { passed: true, detail: `${vm.name}:${c.port} is ${r.status}` } : { passed: false, detail: `${vm.name}:${c.port} is ${r.status}. ${r.hops.filter((h) => h.result === "Fail").map((h) => `${h.step}: ${h.detail}`).join(" ")}` };
    }
    case "nsgNoOpenPort": {
      const bad: string[] = [];
      for (const n of resources.filter((r) => r.type === T.NSG)) {
        for (const rule of n.properties.securityRules as Props[]) {
          if (rule.direction !== "Inbound" || rule.access !== "Allow") continue;
          const open = ["*", "internet", "any", "0.0.0.0/0"].includes(String(rule.sourceAddressPrefix).toLowerCase());
          const ports = String(rule.destinationPortRange).split(",").map((p) => p.trim());
          const covers = (port: number) => ports.some((p) => p === "*" || (p.includes("-") ? port >= Number(p.split("-")[0]) && port <= Number(p.split("-")[1]) : Number(p) === port));
          if (open && c.ports.some(covers)) bad.push(`${n.name}/${rule.name}`);
        }
      }
      return bad.length ? { passed: false, detail: `Open to the Internet: ${bad.join(", ")}` } : { passed: true, detail: "No management ports exposed to the Internet." };
    }
    case "rbac": {
      const r = await checkAccess(ctx, c.principal, c.action, c.scope);
      return r.allowed === c.expect ? { passed: true, detail: r.reason } : { passed: false, detail: `${c.expect ? "Expected allowed" : "Expected denied"}: ${r.reason}` };
    }
    case "incidentResolved": {
      const inc = await prisma.incident.findFirst({ where: { userId: ctx.userId, faultType: c.faultType, status: "Resolved" }, include: { resolution: true }, orderBy: { createdAt: "desc" } });
      return inc ? { passed: true, detail: `${inc.ticketNumber} resolved (incident score ${inc.resolution?.score ?? "?"})` } : { passed: false, detail: `No resolved '${c.faultType}' incident yet.` };
    }
    case "notes": {
      const text = env.notes.trim();
      if (text.length < c.minLength) return { passed: false, detail: `Notes too short (${text.length}/${c.minLength} characters).` };
      const missing = (c.keywords ?? []).filter((k) => !text.toLowerCase().includes(k.toLowerCase()));
      return missing.length ? { passed: false, detail: `Notes should mention: ${missing.join(", ")}` } : { passed: true, detail: "Documentation provided." };
    }
    case "pipelineRun": {
      const projects = resources.filter((r) => r.type === T.DEVOPS_PROJECT && (!c.project || toRegex(c.project).test(r.name)));
      const runs = projects.flatMap((p) => (p.properties.pipelines as Props[]).map((pl) => pl.runs?.[0]).filter(Boolean)) as Props[];
      const hit = runs.find((r) => r.status === c.status);
      return hit ? { passed: true, detail: `Run #${hit.id} of ${hit.pipeline}: ${hit.status}` } : { passed: false, detail: runs.length ? `Latest runs: ${runs.map((r) => `${r.pipeline}#${r.id} ${r.status}`).join(", ")}` : "No pipeline runs found." };
    }
    case "siteHttp": {
      const site = resources.find((r) => r.type === T.SITE && toRegex(c.site).test(r.name));
      if (!site) return { passed: false, detail: "Web app not found." };
      const r = await browseSite({ ...ctx, source: "system" }, site, "/");
      return r.status === c.status ? { passed: true, detail: `${r.url} → ${r.status}` } : { passed: false, detail: `${r.url} → ${r.status}` };
    }
    case "storageNoPublic": {
      const pub = resources.filter((r) => r.type === T.STORAGE && r.properties.allowBlobPublicAccess);
      return pub.length ? { passed: false, detail: `Public access enabled on ${pub.map((p) => p.name).join(", ")}` } : { passed: true, detail: "No public storage accounts." };
    }
  }
}

export async function gradeLab(ctx: Ctx, lab: LabDef, notes: string, startedAt: Date) {
  const resources = await listResources(ctx);
  const env: GradeEnv = { ctx, notes, startedAt, resources };
  const results: CheckResult[] = [];
  for (const c of lab.checks) {
    let r: { passed: boolean; detail: string };
    try {
      r = await runCheck(env, c);
    } catch (e) {
      r = { passed: false, detail: `Check could not be evaluated: ${(e as Error).message}` };
    }
    results.push({ label: c.label, category: c.category, passed: r.passed, detail: r.detail, hint: r.passed ? undefined : c.hint });
  }
  const scores = {} as Record<Category, number>;
  for (const cat of Object.keys(WEIGHTS) as Category[]) {
    const inCat = results.filter((r) => r.category === cat);
    scores[cat] = inCat.length ? Math.round((WEIGHTS[cat] * inCat.filter((r) => r.passed).length) / inCat.length) : WEIGHTS[cat];
  }
  const total = scores.configuration + scores.execution + scores.security + scores.documentation;
  const failed = results.filter((r) => !r.passed);
  const suggestions = [
    ...failed.filter((f) => f.category === "security").map((f) => `Security: ${f.label} - ${f.detail}`),
    ...(scores.documentation < WEIGHTS.documentation ? ["Document what you did, how you verified it and what you'd change in production."] : []),
    ...(total < PASS_MARK ? lab.hints.slice(0, 2) : []),
  ];
  return { total, passed: total >= PASS_MARK, scores, results, suggestions };
}

export const submitSchema = z.object({ notes: z.string().max(10000).default(""), evidence: z.record(z.string(), z.string().max(4000)).optional() });

export async function startLab(ctx: Ctx, slug: string) {
  const lab = LAB_BY_SLUG.get(slug);
  const row = await prisma.lab.findUnique({ where: { slug } });
  if (!lab || !row) throw notFound(`Lab '${slug}' not found.`);
  const existing = await prisma.userProgress.findUnique({ where: { userId_labId: { userId: ctx.userId, labId: row.id } } });
  let incident = null;
  if (lab.setupFault) {
    const open = await prisma.incident.findFirst({ where: { userId: ctx.userId, faultType: lab.setupFault, status: "Open" } });
    incident = open ?? (await injectIncident(ctx, lab.setupFault));
  }
  const progress = existing
    ? await prisma.userProgress.update({ where: { id: existing.id }, data: { status: existing.status === "completed" ? "completed" : "started" } })
    : await prisma.userProgress.create({ data: { userId: ctx.userId, labId: row.id, status: "started" } });
  return { progress, incidentId: incident?.id ?? null };
}

export async function submitLab(ctx: Ctx, slug: string, raw: unknown) {
  const input = submitSchema.parse(raw);
  const lab = LAB_BY_SLUG.get(slug);
  const row = await prisma.lab.findUnique({ where: { slug } });
  if (!lab || !row) throw notFound(`Lab '${slug}' not found.`);
  const progress = await prisma.userProgress.findUnique({ where: { userId_labId: { userId: ctx.userId, labId: row.id } } });
  if (!progress) throw conflict("LabNotStarted", "Start the lab before submitting it.");
  const g = await gradeLab(ctx, lab, input.notes, progress.startedAt);
  const submission = await prisma.labSubmission.create({
    data: {
      userId: ctx.userId,
      labId: row.id,
      notes: input.notes,
      evidence: (input.evidence ?? {}) as Prisma.InputJsonValue,
      score: { create: { total: g.total, configuration: g.scores.configuration, execution: g.scores.execution, security: g.scores.security, documentation: g.scores.documentation, passed: g.passed, results: { checks: g.results, suggestions: g.suggestions } as unknown as Prisma.InputJsonValue } },
    },
    include: { score: true },
  });
  await prisma.userProgress.update({
    where: { id: progress.id },
    data: { attempts: { increment: 1 }, bestScore: Math.max(progress.bestScore, g.total), ...(g.passed ? { status: "completed", completedAt: progress.completedAt ?? new Date() } : {}) },
  });
  return { submissionId: submission.id, ...g, solution: g.passed ? lab.solution : null };
}

/** Seeded Log Analytics tables built from the learner's own simulated environment. */
import { prisma } from "@/lib/db";
import { Ctx, listResources, Props, seeded } from "./engine";
import { T } from "./types";
import type { Tables, Row } from "./kql";

export async function buildTables(ctx: Ctx, now = Date.now()): Promise<Tables> {
  const vms = await listResources(ctx, { type: T.VM });
  const computers = vms.length
    ? vms.map((v) => ({ name: v.properties.computerName as string, os: v.properties.osType as string, rg: v.resourceGroup, running: v.properties.powerState === "VM running", runaway: (v.properties.processes ?? []).some((p: Props) => p.runaway), disk: v.properties.diskUsedPercent as number, stoppedAt: Date.parse(v.updatedAt.toISOString()) }))
    : [
        { name: "vm-web-01", os: "Linux", rg: "rg-contoso-prod", running: true, runaway: false, disk: 41, stoppedAt: 0 },
        { name: "vm-app-01", os: "Linux", rg: "rg-contoso-prod", running: true, runaway: false, disk: 63, stoppedAt: 0 },
        { name: "vm-db-01", os: "Windows", rg: "rg-contoso-prod", running: false, runaway: false, disk: 72, stoppedAt: now - 40 * 60000 },
      ];
  const Heartbeat: Row[] = [];
  const Perf: Row[] = [];
  const Syslog: Row[] = [];
  const Event: Row[] = [];
  for (const c of computers) {
    const rnd = seeded(`${ctx.userId}:${c.name}`);
    for (let i = 0; i < 24 * 12; i++) {
      const t = now - i * 5 * 60000;
      if (c.running || t < c.stoppedAt) Heartbeat.push({ TimeGenerated: new Date(t), Computer: c.name, OSType: c.os, ResourceGroup: c.rg, Category: "Direct Agent", ComputerIP: `10.0.0.${4 + (c.name.length % 50)}` });
    }
    for (let i = 0; i < 24 * 4; i++) {
      const t = now - i * 15 * 60000;
      if (!c.running && t > c.stoppedAt) continue;
      const cpu = c.runaway && i < 8 ? 92 + rnd() * 7 : 4 + rnd() * 30;
      Perf.push({ TimeGenerated: new Date(t), Computer: c.name, ObjectName: "Processor", CounterName: "% Processor Time", InstanceName: "_Total", CounterValue: Math.round(cpu * 10) / 10 });
      Perf.push({ TimeGenerated: new Date(t), Computer: c.name, ObjectName: "Memory", CounterName: "Available MBytes", InstanceName: "", CounterValue: Math.round(800 + rnd() * 2400) });
      Perf.push({ TimeGenerated: new Date(t), Computer: c.name, ObjectName: "LogicalDisk", CounterName: "% Used Space", InstanceName: "/", CounterValue: Math.min(100, c.disk + Math.round(rnd() * 2)) });
    }
    const msgs = c.os === "Linux"
      ? [["daemon", "info", "Started Daily apt download activities."], ["authpriv", "notice", "Accepted publickey for azureuser"], ["kern", "warning", "TCP: request_sock_TCP: Possible SYN flooding on port 80."], ["daemon", "err", "nginx: [error] connect() failed (111: Connection refused) while connecting to upstream"], ["user", "crit", c.disk >= 95 ? "write error: No space left on device" : "app: health check timeout"], ["daemon", "info", "systemd: Reloading."]]
      : [["System", "Information", "The Windows Update service entered the running state."], ["Application", "Error", "Application Error: w3wp.exe faulting module"], ["Security", "Warning", "An account failed to log on."]];
    for (let i = 0; i < 60; i++) {
      const m = msgs[Math.floor(rnd() * msgs.length)];
      const t = new Date(now - Math.floor(rnd() * 24 * 3600000));
      if (c.os === "Linux") Syslog.push({ TimeGenerated: t, Computer: c.name, Facility: m[0], SeverityLevel: m[1], SyslogMessage: m[2], ProcessName: m[2].split(":")[0] });
      else Event.push({ TimeGenerated: t, Computer: c.name, EventLog: m[0], EventLevelName: m[1], RenderedDescription: m[2], EventID: 1000 + Math.floor(rnd() * 50) });
    }
  }

  const sites = await listResources(ctx, { type: T.SITE });
  const appNames = sites.length ? sites.map((s) => s.name) : ["contoso-web", "contoso-api"];
  const AppRequests: Row[] = [];
  const rnd = seeded(`${ctx.userId}:requests`);
  const urls = ["/", "/api/orders", "/api/customers", "/login", "/health", "/api/cart"];
  for (let i = 0; i < 600; i++) {
    const app = appNames[i % appNames.length];
    const url = urls[Math.floor(rnd() * urls.length)];
    const fail = rnd() < (url === "/api/cart" ? 0.35 : 0.04);
    const code = fail ? (rnd() < 0.7 ? 500 : 503) : rnd() < 0.05 ? 404 : 200;
    AppRequests.push({ TimeGenerated: new Date(now - Math.floor(rnd() * 24 * 3600000)), AppRoleName: app, Name: `GET ${url}`, Url: `https://${app}.sim-apps.azuregigs.local${url}`, ResultCode: String(code), Success: code < 400, DurationMs: Math.round((fail ? 900 : 60) + rnd() * (fail ? 4000 : 400)), ClientCity: ["Pune", "Seattle", "London", "Sydney"][Math.floor(rnd() * 4)] });
  }

  const logs = await prisma.activityLog.findMany({ where: { userId: ctx.userId }, orderBy: { createdAt: "desc" }, take: 1000 });
  const AzureActivity: Row[] = logs.map((l) => ({ TimeGenerated: l.createdAt, Caller: l.caller, OperationNameValue: l.operation, ActivityStatusValue: l.status, ResourceGroup: l.resourceGroup ?? "", Resource: l.resourceName ?? "", ResourceProviderValue: l.resourceType?.split("/")[0] ?? "", CategoryValue: "Administrative", Source: l.source }));

  const users = await listResources(ctx, { type: T.ENTRA_USER });
  const SigninLogs: Row[] = [];
  const srnd = seeded(`${ctx.userId}:signins`);
  const upns = users.length ? users.map((u) => u.name) : ["alex@contoso.sim.azuregigs.local", "priya@contoso.sim.azuregigs.local", "sam@contoso.sim.azuregigs.local"];
  for (const u of users) for (const s of (u.properties.signIns ?? []) as Props[]) SigninLogs.push({ TimeGenerated: new Date(s.time), UserPrincipalName: u.name, AppDisplayName: s.app, ResultType: s.code, ResultDescription: s.reason || "Success", Location: s.location, IPAddress: s.ipAddress });
  for (let i = 0; i < 150; i++) {
    const fail = srnd() < 0.15;
    SigninLogs.push({ TimeGenerated: new Date(now - Math.floor(srnd() * 7 * 86400000)), UserPrincipalName: upns[Math.floor(srnd() * upns.length)], AppDisplayName: ["Azure Gigs Portal", "Azure CLI", "Microsoft Teams"][Math.floor(srnd() * 3)], ResultType: fail ? 50126 : 0, ResultDescription: fail ? "Invalid username or password." : "Success", Location: ["Pune, IN", "Mumbai, IN", "Dublin, IE", "Lagos, NG"][Math.floor(srnd() * 4)], IPAddress: `203.0.113.${Math.floor(srnd() * 250)}` });
  }

  const clusters = await listResources(ctx, { type: T.AKS });
  const KubePodInventory: Row[] = [];
  for (const c of clusters) for (const pod of (c.properties.pods ?? []) as Props[]) KubePodInventory.push({ TimeGenerated: new Date(now), ClusterName: c.name, Namespace: pod.namespace, Name: pod.name, PodStatus: pod.status, ContainerRestartCount: pod.restarts, Image: pod.image });

  return { Heartbeat, Perf, Syslog, Event, AppRequests, AzureActivity, SigninLogs, KubePodInventory };
}

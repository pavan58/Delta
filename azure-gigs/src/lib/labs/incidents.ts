/**
 * Injected-fault engine. Each fault prepares a target (reusing the learner's resources when possible),
 * mutates persistent simulator state, and later verifies the fix against that state.
 */
import type { Prisma, Incident } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { badRequest, conflict, notFound } from "@/lib/errors";
import { Ctx, findAnyByName, findByName, getById, listResources, logActivity, mutate, Props, Res, deleteResource } from "@/lib/sim/engine";
import { T } from "@/lib/sim/types";
import { createByType, runAction } from "@/lib/sim/registry";
import { testConnectivity, vmNetwork } from "@/lib/sim/services/compute";
import { browseSite } from "@/lib/sim/services/apps";
import { checkAccess } from "@/lib/sim/services/rbac";
import { testStorageAccess } from "@/lib/sim/services/storage";

const PROD_RG = "rg-contoso-prod";
const APP_OUTBOUND_IP = "20.111.4.9";

type FaultDef = {
  type: string;
  title: string;
  severity: "Sev1" | "Sev2" | "Sev3";
  impact: string;
  ticket: (target: string) => string;
  acceptance: string[];
  prepare: (ctx: Ctx) => Promise<Res>;
  inject: (ctx: Ctx, target: Res) => Promise<Props>;
  verify: (ctx: Ctx, target: Res, state: Props, since: Date) => Promise<{ fixed: boolean; detail: string }>;
  rootCause: string[]; // keywords; RCA root-cause text must mention at least one group
  diagnostics: RegExp[]; // commands or activity operations that count as investigation
  hints: string[];
};

const faultCtx = (ctx: Ctx): Ctx => ({ ...ctx, caller: "ops-automation@contoso.sim.azuregigs.local", source: "fault" });

async function ensureRg(ctx: Ctx) {
  if (!(await findByName(ctx, T.RG, PROD_RG, PROD_RG))) await createByType(ctx, T.RG, { name: PROD_RG, location: "eastus", tags: { env: "prod", owner: "cloud-ops" } });
}

/** A running Linux VM with a public IP, an NSG allowing 80 and nginx installed. Reuses one if available. */
async function ensureWebVm(ctx: Ctx): Promise<Res> {
  for (const vm of await listResources(ctx, { type: T.VM })) {
    if (vm.properties.osType !== "Linux" || vm.properties.powerState !== "VM running") continue;
    if (!vm.properties.services?.nginx) continue;
    const r = await testConnectivity({ ...ctx, source: "system" }, vm, { port: 80 }).catch(() => null);
    if (r?.reachable) return vm;
  }
  await ensureRg(ctx);
  const sys = { ...ctx, source: "system" as const };
  if (!(await findByName(ctx, T.VNET, PROD_RG, "vnet-prod"))) await createByType(sys, T.VNET, { resourceGroup: PROD_RG, name: "vnet-prod", addressPrefixes: ["10.200.0.0/16"], subnets: [{ name: "snet-web", addressPrefix: "10.200.1.0/24" }] });
  if (!(await findByName(ctx, T.NSG, PROD_RG, "nsg-prod-web"))) await createByType(sys, T.NSG, { resourceGroup: PROD_RG, name: "nsg-prod-web", rules: [{ name: "allow-http", priority: 200, destinationPortRange: "80", protocol: "Tcp", access: "Allow", direction: "Inbound", sourceAddressPrefix: "Internet" }, { name: "allow-https", priority: 210, destinationPortRange: "443", protocol: "Tcp", access: "Allow", direction: "Inbound", sourceAddressPrefix: "Internet" }] });
  const existing = await findByName(ctx, T.VM, PROD_RG, "vm-web-prod");
  if (existing) {
    if (existing.properties.powerState !== "VM running") await runAction(sys, existing, "start", {});
    return getById(ctx, existing.id);
  }
  return createByType(sys, T.VM, { resourceGroup: PROD_RG, name: "vm-web-prod", image: "Ubuntu2204", size: "Standard_B2s", vnetName: "vnet-prod", subnetName: "snet-web", nsgName: "nsg-prod-web", installWebServer: true, generateSshKeys: true, tags: { env: "prod" } });
}

async function ensurePlan(ctx: Ctx) {
  await ensureRg(ctx);
  return (await findByName(ctx, T.PLAN, PROD_RG, "plan-prod")) ?? createByType({ ...ctx, source: "system" }, T.PLAN, { resourceGroup: PROD_RG, name: "plan-prod", sku: "S1" });
}

async function ensureSite(ctx: Ctx, name: string, settings: Record<string, string> = {}) {
  await ensurePlan(ctx);
  const sys = { ...ctx, source: "system" as const };
  const uniq = `${name}-${ctx.userId.slice(-5)}`;
  let site = await findByName(ctx, T.SITE, PROD_RG, uniq);
  if (!site) site = await createByType(sys, T.SITE, { resourceGroup: PROD_RG, name: uniq, planName: "plan-prod", runtime: "NODE|20-lts", identity: true });
  site = await getById(ctx, site.id);
  if (!site.properties.activePackage) await runAction(sys, site, "deploy", { package: "todo-api" });
  if (Object.keys(settings).length) await runAction(sys, await getById(ctx, site.id), "setAppSettings", { settings });
  return getById(ctx, site.id);
}

async function nsgForVm(ctx: Ctx, vm: Res) {
  const net = await vmNetwork(ctx, vm);
  const nsg = net.nicNsg ?? net.subnetNsg;
  if (!nsg) throw conflict("NoNsg", "Target VM has no NSG.");
  return nsg;
}

async function lastRun(ctx: Ctx, projectId: string, pipeline: string) {
  const p = await getById(ctx, projectId);
  return ((p.properties.pipelines as Props[]).find((x) => x.name === pipeline)?.runs ?? [])[0] as Props | undefined;
}

export const FAULTS: Record<string, FaultDef> = {
  "vm-unavailable": {
    type: "vm-unavailable", title: "Production web VM is unavailable", severity: "Sev1", impact: "Customer-facing website is down for all users.",
    ticket: (t) => `Monitoring reports that ${t} stopped responding about 5 minutes ago. Customers receive timeouts. Restore service as quickly as possible and find out why it happened.`,
    acceptance: ["The website responds on port 80", "Root cause identified from evidence", "RCA submitted"],
    prepare: ensureWebVm,
    inject: async (ctx, vm) => { await runAction(faultCtx(ctx), vm, "deallocate", {}); return { vmId: vm.id }; },
    verify: async (ctx, vm) => { const r = await testConnectivity({ ...ctx, source: "system" }, await getById(ctx, vm.id), { port: 80 }); return { fixed: r.reachable, detail: r.reachable ? "VM reachable on port 80." : `Still unreachable: ${r.hops.filter((h) => h.result === "Fail").map((h) => h.detail).join("; ")}` }; },
    rootCause: ["deallocat", "stopped", "automation", "power"],
    diagnostics: [/vm (show|list|get-instance-view)/, /Get-AzVM/, /activity/i, /Connectivity Check/, /resource health/i],
    hints: ["Check the VM's power state on the overview page.", "The activity log shows who performed the last operation on the VM.", "Start the VM, then run a connectivity check on port 80."],
  },
  "nsg-deny-http": {
    type: "nsg-deny-http", title: "Website unreachable after a security change", severity: "Sev2", impact: "HTTP traffic to the web tier is blocked; HTTPS clients unaffected.",
    ticket: (t) => `Users report 'connection timed out' when browsing http://${t}. The VM is running and nginx is healthy according to the app team. A security hardening change was rolled out last night.`,
    acceptance: ["Port 80 reachable from the Internet", "No management ports opened as a side effect", "RCA submitted"],
    prepare: ensureWebVm,
    inject: async (ctx, vm) => {
      const nsg = await nsgForVm(ctx, vm);
      const used = new Set((nsg.properties.securityRules as Props[]).filter((r) => r.direction === "Inbound").map((r) => r.priority));
      let priority = 110;
      while (used.has(priority)) priority++;
      const allow = (nsg.properties.securityRules as Props[]).filter((r) => r.access === "Allow" && r.direction === "Inbound").map((r) => r.priority);
      if (allow.length && priority > Math.min(...allow)) { priority = Math.max(100, Math.min(...allow) - 1); while (used.has(priority) && priority > 100) priority--; }
      await runAction(faultCtx(ctx), nsg, "addRule", { name: "Harden-DenyHTTP-Inbound", priority, direction: "Inbound", access: "Deny", protocol: "Tcp", sourceAddressPrefix: "Internet", destinationPortRange: "80", description: "CHG-5521 security hardening" });
      return { vmId: vm.id, nsgId: nsg.id, rule: "Harden-DenyHTTP-Inbound", priority };
    },
    verify: async (ctx, vm) => { const r = await testConnectivity({ ...ctx, source: "system" }, await getById(ctx, vm.id), { port: 80 }); return { fixed: r.reachable, detail: r.reachable ? "Port 80 reachable." : `Still blocked: ${r.hops.filter((h) => h.result === "Fail").map((h) => h.detail).join("; ")}` }; },
    rootCause: ["deny", "nsg", "security rule", "priority", "harden"],
    diagnostics: [/nsg rule list/, /nsg show/, /IP Flow Verify/, /test-ip-flow/, /Connectivity Check/, /test-connectivity/, /NetworkSecurityRuleConfig/],
    hints: ["Run a connectivity check from the Internet to port 80 and look at the failing hop.", "List NSG rules sorted by priority - lower numbers win.", "Remove or re-prioritise the Deny rule added by the hardening change."],
  },
  "storage-access-denied": {
    type: "storage-access-denied", title: "Application cannot access storage", severity: "Sev2", impact: "Image uploads fail for all customers.",
    ticket: (t) => `The web application (outbound IP ${APP_OUTBOUND_IP}) receives 403 AuthorizationFailure when writing to storage account ${t}. Nothing changed in the app.`,
    acceptance: [`Requests from ${APP_OUTBOUND_IP} are authorized`, "Public network access is NOT opened to everyone", "RCA submitted"],
    prepare: async (ctx) => {
      await ensureRg(ctx);
      const name = `stprod${ctx.userId.slice(-8).toLowerCase().replace(/[^a-z0-9]/g, "")}`;
      return (await findByName(ctx, T.STORAGE, PROD_RG, name)) ?? createByType({ ...ctx, source: "system" }, T.STORAGE, { resourceGroup: PROD_RG, name, sku: "Standard_ZRS" });
    },
    inject: async (ctx, sa) => { await runAction(faultCtx(ctx), sa, "updateConfig", { networkDefaultAction: "Deny", ipRules: ["203.0.113.50"] }); if (!(sa.properties.containers as Props[]).some((c) => c.name === "uploads")) await runAction(faultCtx(ctx), await getById(ctx, sa.id), "createContainer", { name: "uploads" }); return { storageId: sa.id }; },
    verify: async (ctx, sa) => {
      const fresh = await getById(ctx, sa.id);
      const r = await testStorageAccess({ ...ctx, source: "system" }, fresh, { container: "uploads", operation: "write", method: "accountKey", clientIp: APP_OUTBOUND_IP });
      const tooOpen = fresh.properties.networkRules.defaultAction === "Allow";
      return { fixed: r.allowed && !tooOpen, detail: !r.allowed ? "The app IP is still blocked." : tooOpen ? "Access works, but the firewall now allows ALL networks - add the app IP instead." : `App IP ${APP_OUTBOUND_IP} allowed while the firewall stays restrictive.` };
    },
    rootCause: ["firewall", "network rule", "defaultaction", "deny", "ip rule"],
    diagnostics: [/storage account (show|update)/, /network-rule/, /Test Storage Access/, /Get-AzStorageAccount/],
    hints: ["Open the storage account's Networking settings.", "The default action is Deny - which IPs are allowed?", `Add ${APP_OUTBOUND_IP} to the IP rules rather than allowing all networks.`],
  },
  "dns-failure": {
    type: "dns-failure", title: "VMs cannot resolve DNS names", severity: "Sev2", impact: "Outbound calls from the web tier to partner APIs fail.",
    ticket: (t) => `Since this morning, applications on ${t} log 'Temporary failure in name resolution'. Networking says 'we only changed DNS settings for the new AD rollout'.`,
    acceptance: ["nslookup from the VM succeeds", "RCA submitted"],
    prepare: ensureWebVm,
    inject: async (ctx, vm) => { const net = await vmNetwork(ctx, vm); if (!net.vnet) throw conflict("NoVnet", "VM has no VNet"); await runAction(faultCtx(ctx), net.vnet, "setDnsServers", { dnsServers: ["10.200.0.250"] }); return { vmId: vm.id, vnetId: net.vnet.id }; },
    verify: async (ctx, vm, state) => { const v = await getById(ctx, state.vnetId); const dns = (v.properties.dnsServers ?? []) as string[]; const ok = dns.length === 0 || dns.includes("168.63.129.16"); return { fixed: ok, detail: ok ? "VNet uses Azure-provided DNS." : `VNet still points to ${dns.join(", ")}.` }; },
    rootCause: ["dns server", "custom dns", "dns"],
    diagnostics: [/nslookup|dig/, /vnet show/, /Run Command/, /dns/i],
    hints: ["Run `nslookup contoso.com` on the VM using Run command.", "Check the virtual network's DNS servers setting.", "Revert to Azure-provided DNS (or 168.63.129.16)."],
  },
  "expired-secret": {
    type: "expired-secret", title: "Application fails with HTTP 500 after secret expiry", severity: "Sev1", impact: "Checkout API returns 500 for all requests.",
    ticket: (t) => `${t} started returning HTTP 500 at 00:00 UTC. No deployments happened. App logs mention Key Vault.`,
    acceptance: ["The app returns HTTP 200", "Secret is valid and not expired", "RCA submitted"],
    prepare: async (ctx) => {
      await ensureRg(ctx);
      const kvName = `kv-prod-${ctx.userId.slice(-6).toLowerCase().replace(/[^a-z0-9]/g, "")}`;
      const sys = { ...ctx, source: "system" as const };
      const kv = (await findByName(ctx, T.KEYVAULT, PROD_RG, kvName)) ?? (await createByType(sys, T.KEYVAULT, { resourceGroup: PROD_RG, name: kvName }));
      const site = await ensureSite(ctx, "app-checkout");
      await runAction(sys, await getById(ctx, kv.id), "setAccessPolicy", { principal: site.properties.identity.principalName, secretPermissions: ["get", "list"] });
      await runAction(sys, await getById(ctx, kv.id), "setSecret", { name: "PaymentApiKey", value: "pk_live_simulated_value" });
      await runAction(sys, site, "setAppSettings", { settings: { PAYMENT_API_KEY: `@Microsoft.KeyVault(VaultName=${kvName};SecretName=PaymentApiKey)` } });
      return getById(ctx, site.id);
    },
    inject: async (ctx, site) => {
      const kvName = /VaultName=([^;]+)/.exec(site.properties.appSettings.PAYMENT_API_KEY)![1];
      const kv = (await findAnyByName(ctx, T.KEYVAULT, kvName))!;
      await runAction(faultCtx(ctx), kv, "setSecret", { name: "PaymentApiKey", value: "pk_live_simulated_value_v2", expires: new Date(Date.now() - 3600_000).toISOString() });
      return { siteId: site.id, kvId: kv.id };
    },
    verify: async (ctx, site) => { const r = await browseSite({ ...ctx, source: "system" }, site, "/"); return { fixed: r.status === 200, detail: r.status === 200 ? "App returns 200." : `App still returns ${r.status}.` }; },
    rootCause: ["expire", "secret", "key vault"],
    diagnostics: [/log tail|Logs/i, /keyvault secret (show|list)/, /Get-AzKeyVaultSecret/, /Test Secret Retrieval/, /browse/],
    hints: ["Check the app's log stream - which setting fails to resolve?", "Look at the secret versions in Key Vault: is the latest version expired?", "Set a new version without an expiry in the past (or with a future expiry), then browse the app."],
  },
  "pipeline-failure": {
    type: "pipeline-failure", title: "Release pipeline failing", severity: "Sev3", impact: "No deployments to production possible; hotfix blocked.",
    ticket: (t) => `Pipeline '${t}' has failed on every run since the service connection cleanup. A hotfix is waiting to ship.`,
    acceptance: ["A new pipeline run succeeds", "RCA submitted"],
    prepare: async (ctx) => {
      await ensureRg(ctx);
      const site = await ensureSite(ctx, "app-release");
      const sys = { ...ctx, source: "system" as const };
      let proj = await findByName(ctx, T.DEVOPS_PROJECT, PROD_RG, "contoso-release");
      if (!proj) proj = await createByType(sys, T.DEVOPS_PROJECT, { resourceGroup: PROD_RG, organization: "contoso", name: "contoso-release" });
      if (!(proj.properties.serviceConnections as Props[]).some((s) => s.name === "azure-prod-2025")) await runAction(sys, proj, "addServiceConnection", { name: "azure-prod-2025", type: "AzureRM" });
      const yaml = `trigger: none\nstages:\n  - stage: Build\n    jobs:\n      - job: Build\n        steps:\n          - script: npm ci\n          - script: npm test\n  - stage: Deploy\n    jobs:\n      - job: Deploy\n        steps:\n          - task: AzureWebApp@1\n            inputs:\n              azureSubscription: azure-prod-2025\n              appName: ${site.name}\n              package: todo-api\n`;
      await runAction(sys, await getById(ctx, proj.id), "commitFile", { path: "release.yml", content: yaml, message: "Add release pipeline" });
      if (!((await getById(ctx, proj.id)).properties.pipelines as Props[]).some((p) => p.name === "release")) await runAction(sys, await getById(ctx, proj.id), "createPipeline", { name: "release", yamlPath: "release.yml" });
      return getById(ctx, proj.id);
    },
    inject: async (ctx, proj) => {
      const f = faultCtx(ctx);
      await mutate(f, proj, (p) => { p.serviceConnections = (p.serviceConnections as Props[]).filter((s) => s.name !== "azure-prod-2025"); p.serviceConnections.push({ name: "azure-prod", type: "AzureRM", id: "sc-new", authScheme: "WorkloadIdentityFederation", createdAt: new Date().toISOString() }); }, "Delete Service Connection", { name: "azure-prod-2025" });
      await runAction(f, await getById(ctx, proj.id), "runPipeline", { pipeline: "release", reason: "Scheduled" });
      return { projectId: proj.id };
    },
    verify: async (ctx, proj, _s, since) => { const r = await lastRun(ctx, proj.id, "release"); const ok = r?.status === "succeeded" && Date.parse(r.startedAt) >= since.getTime(); return { fixed: !!ok, detail: ok ? `Run #${r!.id} succeeded.` : "No successful run since the incident was opened." }; },
    rootCause: ["service connection", "azure-prod-2025", "connection"],
    diagnostics: [/Pipeline run/, /runPipeline/, /Commit/i],
    hints: ["Open the failed run and read the first ##[error] line.", "Compare the service connection name in release.yml with the existing service connections.", "Update release.yml to use 'azure-prod' (or recreate the connection), then run again."],
  },
  "db-connection-failure": {
    type: "db-connection-failure", title: "Application cannot connect to the database", severity: "Sev1", impact: "Orders cannot be placed.",
    ticket: (t) => `${t} returns 500 and logs 'Cannot open server ... requested by the login'. The DBA team changed SQL networking settings during a compliance review.`,
    acceptance: ["App returns HTTP 200", "SQL server not opened to all IPs", "RCA submitted"],
    prepare: async (ctx) => {
      await ensureRg(ctx);
      const sys = { ...ctx, source: "system" as const };
      const sname = `sql-prod-${ctx.userId.slice(-6).toLowerCase().replace(/[^a-z0-9]/g, "")}`;
      const server = (await findByName(ctx, T.SQL_SERVER, PROD_RG, sname)) ?? (await createByType(sys, T.SQL_SERVER, { resourceGroup: PROD_RG, name: sname, adminLogin: "contosoadmin", adminPassword: "Pr0d#Simulated!Pass" }));
      if (!(await findByName(ctx, T.SQL_DB, PROD_RG, `${server.name}/ordersdb`))) await createByType(sys, T.SQL_DB, { resourceGroup: PROD_RG, serverName: server.name, name: "ordersdb" });
      return ensureSite(ctx, "app-orders", { DB_CONNECTION: `Server=tcp:${server.name}.database.sim.azuregigs.local,1433;Initial Catalog=ordersdb;Authentication=Active Directory Default` });
    },
    inject: async (ctx, site) => { const name = /Server=tcp:([a-z0-9-]+)\./.exec(site.properties.appSettings.DB_CONNECTION)![1]; const server = (await findAnyByName(ctx, T.SQL_SERVER, name))!; await runAction(faultCtx(ctx), server, "updateNetwork", { allowAzureServices: false }); return { siteId: site.id, serverId: server.id }; },
    verify: async (ctx, site, state) => { const r = await browseSite({ ...ctx, source: "system" }, site, "/"); const server = await getById(ctx, state.serverId); const wide = (server.properties.firewallRules as Props[]).some((f) => f.startIp === "0.0.0.0" && f.endIp === "255.255.255.255"); return { fixed: r.status === 200 && !wide, detail: wide ? "Firewall opened to the whole Internet - not acceptable." : r.status === 200 ? "App returns 200." : `App still returns ${r.status}.` }; },
    rootCause: ["firewall", "allow azure services", "azure services", "network"],
    diagnostics: [/sql server (show|firewall)/, /log tail|Logs/i, /browse/, /Execute Query/],
    hints: ["Read the app's log stream.", "Open the SQL server Networking blade.", "Re-enable 'Allow Azure services and resources to access this server'."],
  },
  "high-cpu": {
    type: "high-cpu", title: "High CPU on production web VM", severity: "Sev2", impact: "Page load times above 8 seconds.",
    ticket: (t) => `Alert: Percentage CPU > 95% on ${t} for 20 minutes. Response times degraded. No traffic spike observed.`,
    acceptance: ["CPU back to normal (no runaway process)", "VM still running", "RCA submitted"],
    prepare: ensureWebVm,
    inject: async (ctx, vm) => { await mutate(faultCtx(ctx), vm, (p) => { p.processes = [...(p.processes ?? []), { pid: 31337, user: "www-data", cpu: 97.8, mem: 3.1, cmd: "/tmp/.x/kworkerd --donate-level 1", runaway: true, since: new Date(Date.now() - 20 * 60000).toISOString() }]; }); await logActivity(faultCtx(ctx), vm, "Guest OS: process started", "Succeeded", {}); return { vmId: vm.id }; },
    verify: async (ctx, vm) => { const v = await getById(ctx, vm.id); const ok = v.properties.powerState === "VM running" && !(v.properties.processes ?? []).some((p: Props) => p.runaway); return { fixed: ok, detail: ok ? "No runaway processes; VM running." : "A runaway process is still consuming CPU (or the VM is not running)." }; },
    rootCause: ["process", "kworkerd", "miner", "runaway", "31337"],
    diagnostics: [/ps|top/, /metrics/i, /Run Command/, /Percentage CPU/],
    hints: ["Check the CPU metric chart on the VM.", "Use Run command: `ps aux` or `top`.", "Kill the offending PID (and in real life: treat it as a security incident)."],
  },
  "disk-full": {
    type: "disk-full", title: "Web server down: disk full", severity: "Sev1", impact: "Website returns connection refused.",
    ticket: (t) => `nginx on ${t} crashed and refuses to start. Last night debug logging was enabled to investigate a bug.`,
    acceptance: ["OS disk usage below 90%", "nginx running and port 80 reachable", "RCA submitted"],
    prepare: ensureWebVm,
    inject: async (ctx, vm) => { await mutate(faultCtx(ctx), vm, (p) => { p.diskUsedPercent = 100; p.logFiles = [{ path: "/var/log/app/debug.log", sizeGB: 21 }, { path: "/var/log/app/debug.log.1", sizeGB: 3 }]; if (p.services.nginx) { p.services.nginx.state = "failed"; p.services.nginx.error = 'nginx: [emerg] open() "/var/log/nginx/error.log" failed (28: No space left on device)'; } }); await logActivity(faultCtx(ctx), vm, "Guest OS: service failed", "Failed", { service: "nginx" }); return { vmId: vm.id }; },
    verify: async (ctx, vm) => { const v = await getById(ctx, vm.id); const r = await testConnectivity({ ...ctx, source: "system" }, v, { port: 80 }); const ok = v.properties.diskUsedPercent < 90 && r.reachable; return { fixed: ok, detail: ok ? "Disk usage normal; port 80 reachable." : v.properties.diskUsedPercent >= 90 ? `Disk still ${v.properties.diskUsedPercent}% full.` : "nginx is not serving on port 80." }; },
    rootCause: ["disk", "no space", "log", "debug"],
    diagnostics: [/df|du/, /systemctl status/, /Run Command/, /OS Disk/],
    hints: ["Run command: `systemctl status nginx`.", "Run `df -h` and `du` to find what fills the disk.", "Remove the debug logs under /var/log/app and restart nginx."],
  },
  "rbac-wrong": {
    type: "rbac-wrong", title: "Developer cannot read blobs", severity: "Sev3", impact: "Data team blocked from reading exports.",
    ticket: (t) => `Sneha Kulkarni reports 'AuthorizationPermissionMismatch' when reading blobs from ${t} using her Entra ID account. It worked last week. IAM cleanup happened on Friday.`,
    acceptance: ["Sneha can read blobs", "Sneha cannot write blobs (least privilege)", "RCA submitted"],
    prepare: async (ctx) => {
      await ensureRg(ctx);
      const name = `stexports${ctx.userId.slice(-6).toLowerCase().replace(/[^a-z0-9]/g, "")}`;
      const sys = { ...ctx, source: "system" as const };
      const sa = (await findByName(ctx, T.STORAGE, PROD_RG, name)) ?? (await createByType(sys, T.STORAGE, { resourceGroup: PROD_RG, name }));
      if (!(sa.properties.containers as Props[]).some((c) => c.name === "exports")) await runAction(sys, sa, "createContainer", { name: "exports" });
      await createByType(sys, T.ROLE_ASSIGNMENT, { principal: "sneha.kulkarni", role: "Storage Blob Data Reader", scope: `/resourceGroups/${PROD_RG}/providers/${T.STORAGE}/${sa.name}` }).catch(() => undefined);
      return getById(ctx, sa.id);
    },
    inject: async (ctx, sa) => {
      const ras = (await listResources(ctx, { type: T.ROLE_ASSIGNMENT })).filter((r) => /^sneha\.kulkarni@/.test(r.properties.principalName) && /Storage Blob Data/.test(r.properties.roleDefinitionName));
      for (const r of ras) await deleteResource(faultCtx(ctx), r);
      await createByType(faultCtx(ctx), T.ROLE_ASSIGNMENT, { principal: "sneha.kulkarni", role: "Storage Account Contributor", scope: `/resourceGroups/${PROD_RG}/providers/${T.STORAGE}/${sa.name}` }).catch(() => undefined);
      return { storageId: sa.id };
    },
    verify: async (ctx, sa) => {
      const scope = `/resourceGroups/${sa.resourceGroup}/providers/${T.STORAGE}/${sa.name}`;
      const read = await checkAccess(ctx, "sneha.kulkarni", "Microsoft.Storage/storageAccounts/blobServices/containers/blobs/read", scope);
      const write = await checkAccess(ctx, "sneha.kulkarni", "Microsoft.Storage/storageAccounts/blobServices/containers/blobs/write", scope);
      return { fixed: read.allowed && !write.allowed, detail: !read.allowed ? "Sneha still cannot read blobs." : write.allowed ? "Sneha can now WRITE blobs too - too much access." : "Read allowed, write denied (least privilege)." };
    },
    rootCause: ["role", "data reader", "data plane", "rbac", "assignment"],
    diagnostics: [/role assignment list/, /Check access/, /Get-AzRoleAssignment/, /Test Storage Access/],
    hints: ["Storage Account Contributor is a management-plane role: it does not grant blob data access.", "Use Check access with the blob read data action.", "Assign 'Storage Blob Data Reader' at the storage account scope."],
  },
};

export const FAULT_LIST = Object.values(FAULTS).map((f) => ({ type: f.type, title: f.title, severity: f.severity }));

function targetLabel(r: Res) {
  if (r.type === T.SITE) return `https://${r.properties.defaultHostName}`;
  if (r.type === T.DEVOPS_PROJECT) return "release";
  return r.name;
}

export async function injectIncident(ctx: Ctx, faultType?: string): Promise<Incident> {
  const open = await prisma.incident.count({ where: { userId: ctx.userId, status: "Open" } });
  if (open >= 3) throw conflict("TooManyOpenIncidents", "You already have 3 open incidents. Resolve or abandon one first.");
  const keys = Object.keys(FAULTS);
  const type = faultType ?? keys[Math.floor(Math.random() * keys.length)];
  const f = FAULTS[type];
  if (!f) throw badRequest("UnknownFault", `Unknown fault type '${type}'.`);
  if (await prisma.incident.findFirst({ where: { userId: ctx.userId, status: "Open", faultType: type } })) throw conflict("IncidentOpen", "An incident of this type is already open.");
  const target = await f.prepare(ctx);
  const state = await f.inject(ctx, await getById(ctx, target.id));
  const due = { Sev1: 30, Sev2: 120, Sev3: 480 }[f.severity];
  return prisma.incident.create({
    data: {
      userId: ctx.userId,
      ticketNumber: `INC${String(Date.now()).slice(-7)}`,
      faultType: type,
      title: f.title,
      description: f.ticket(targetLabel(target)),
      severity: f.severity,
      impact: f.impact,
      targetResourceId: target.id,
      faultState: { ...state, acceptance: f.acceptance } as Prisma.InputJsonValue,
      dueAt: new Date(Date.now() + due * 60000),
    },
  });
}

export function publicIncident(i: Incident & { resolution?: unknown }) {
  const f = FAULTS[i.faultType];
  const st = i.faultState as Props;
  return { id: i.id, ticketNumber: i.ticketNumber, title: i.title, description: i.description, severity: i.severity, impact: i.impact, status: i.status, createdAt: i.createdAt, dueAt: i.dueAt, hintsUsed: i.hintsUsed, hints: f?.hints.slice(0, i.hintsUsed) ?? [], totalHints: f?.hints.length ?? 0, acceptance: st.acceptance ?? [], targetResourceId: i.targetResourceId, resolution: i.resolution ?? null, faultType: i.faultType };
}

export async function getIncident(ctx: Ctx, id: string) {
  const i = await prisma.incident.findFirst({ where: { id, userId: ctx.userId }, include: { resolution: true } });
  if (!i) throw notFound("Incident not found.");
  return i;
}

export async function takeHint(ctx: Ctx, id: string) {
  const i = await getIncident(ctx, id);
  const f = FAULTS[i.faultType];
  if (i.hintsUsed >= f.hints.length) throw conflict("NoMoreHints", "All hints have been revealed.");
  const u = await prisma.incident.update({ where: { id }, data: { hintsUsed: i.hintsUsed + 1 }, include: { resolution: true } });
  return publicIncident(u);
}

export const rcaSchema = z.object({ rootCause: z.string().min(1).max(4000), fixSummary: z.string().min(1).max(4000), verification: z.string().min(1).max(4000) });

/** Grades an incident: investigation 25, root cause 25, resolution 30, verification 10, RCA 10, minus 5 per hint. */
export async function resolveIncident(ctx: Ctx, id: string, raw: unknown) {
  const input = rcaSchema.parse(raw);
  const i = await getIncident(ctx, id);
  if (i.status !== "Open" && i.resolution) throw conflict("AlreadyResolved", "This incident is already resolved.");
  const f = FAULTS[i.faultType];
  const target = i.targetResourceId ? await getById(ctx, i.targetResourceId).catch(() => null) : null;
  if (!target) throw conflict("TargetGone", "The affected resource no longer exists, so the fix cannot be verified. Abandon this incident and inject a new one.");
  const verdict = await f.verify(ctx, target, i.faultState as Props, i.createdAt);

  const [cmds, logs] = await Promise.all([
    prisma.commandHistory.findMany({ where: { userId: ctx.userId, createdAt: { gte: i.createdAt } }, orderBy: { createdAt: "asc" } }),
    prisma.activityLog.findMany({ where: { userId: ctx.userId, createdAt: { gte: i.createdAt }, source: { notIn: ["fault", "system"] } }, orderBy: { createdAt: "asc" } }),
  ]);
  const signals = [...cmds.map((c) => ({ text: c.command, at: c.createdAt })), ...logs.map((l) => ({ text: `${l.operation} ${JSON.stringify(l.details)}`, at: l.createdAt }))];
  const matched = f.diagnostics.filter((re) => signals.some((s) => re.test(s.text)));
  const investigation = Math.min(25, Math.round((matched.length / Math.min(2, f.diagnostics.length)) * 25));
  const rcText = `${input.rootCause} ${input.fixSummary}`.toLowerCase();
  const rootCause = f.rootCause.some((k) => rcText.includes(k)) ? 25 : 0;
  const resolution = verdict.fixed ? 30 : 0;
  const DIAG_OPS = /Connectivity Check|IP Flow Verify|Run Command|Test |browse|Execute Query|Check access|Pipeline run|nslookup|curl|show|list|status/i;
  const lastWrite = [...logs].reverse().find((l) => !DIAG_OPS.test(l.operation));
  const verifiedAfter = signals.some((s) => (!lastWrite || s.at > lastWrite.createdAt) && DIAG_OPS.test(s.text));
  const verification = verdict.fixed && verifiedAfter && input.verification.trim().length >= 15 ? 10 : verdict.fixed && input.verification.trim().length >= 15 ? 5 : 0;
  const rcaLen = input.rootCause.length + input.fixSummary.length + input.verification.length;
  const documentation = rcaLen >= 200 ? 10 : rcaLen >= 100 ? 6 : 3;
  const penalty = i.hintsUsed * 5;
  const score = Math.max(0, investigation + rootCause + resolution + verification + documentation - penalty);
  const breakdown = { investigation, rootCause, resolution, verification, documentation, hintPenalty: -penalty, diagnosticsUsed: matched.map((m) => m.source), verdict: verdict.detail, solution: verdict.fixed ? f.hints[f.hints.length - 1] : null };

  if (!verdict.fixed) {
    return { resolved: false, score, breakdown, message: `Not resolved yet: ${verdict.detail}` };
  }
  await prisma.$transaction([
    prisma.incidentResolution.upsert({ where: { incidentId: i.id }, create: { incidentId: i.id, ...input, score, breakdown }, update: { ...input, score, breakdown } }),
    prisma.incident.update({ where: { id: i.id }, data: { status: "Resolved" } }),
  ]);
  await logActivity(ctx, target, `Incident ${i.ticketNumber} resolved`, "Succeeded", { score });
  return { resolved: true, score, breakdown, message: "Incident resolved." };
}

export async function abandonIncident(ctx: Ctx, id: string) {
  const i = await getIncident(ctx, id);
  if (i.status !== "Open") throw conflict("NotOpen", "Incident is not open.");
  await prisma.incident.update({ where: { id }, data: { status: "Abandoned" } });
  const f = FAULTS[i.faultType];
  return { abandoned: true, solution: f.hints[f.hints.length - 1] };
}

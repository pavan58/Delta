/**
 * Single dispatch point used by the portal API and the terminal:
 * create resources by type, run resource actions, and build sanitized detail views.
 */
import { z } from "zod";
import { badRequest, notFound } from "@/lib/errors";
import { Ctx, dependenciesOf, dependentsOf, getSubscription, armId, Props, Res, listResources, updateResource } from "./engine";
import { T, TYPE_LABELS } from "./types";
import * as net from "./services/network";
import * as compute from "./services/compute";
import * as storage from "./services/storage";
import * as rbac from "./services/rbac";
import * as kv from "./services/keyvault";
import * as apps from "./services/apps";
import * as mon from "./services/monitor";
import * as devops from "./services/devops";
import * as cont from "./services/containers";
import * as backup from "./services/backup";
import * as misc from "./services/misc";
import { createResource } from "./engine";

export const rgSchema = z.object({ name: z.string().min(1).max(90), location: z.string().min(1), tags: z.record(z.string(), z.string()).optional() });

export async function createResourceGroup(ctx: Ctx, raw: unknown) {
  const input = rgSchema.parse(raw);
  return createResource(ctx, { type: T.RG, resourceGroup: input.name, name: input.name, location: input.location, tags: input.tags, properties: { provisioningState: "Succeeded" } }, { operation: "Create Resource Group" });
}

type Creator = (ctx: Ctx, input: unknown) => Promise<Res>;
export const CREATORS: Record<string, Creator> = {
  [T.RG]: createResourceGroup,
  [T.VM]: compute.createVm,
  [T.VNET]: net.createVnet,
  [T.NSG]: net.createNsg,
  [T.PIP]: net.createPublicIp,
  [T.STORAGE]: storage.createStorage,
  [T.ENTRA_USER]: rbac.createUser,
  [T.ENTRA_GROUP]: rbac.createGroup,
  [T.ROLE_ASSIGNMENT]: rbac.createRoleAssignment,
  [T.PLAN]: apps.createPlan,
  [T.SITE]: apps.createSite,
  [T.FUNCTION_APP]: apps.createFunctionApp,
  [T.SQL_SERVER]: apps.createSqlServer,
  [T.SQL_DB]: apps.createDatabase,
  [T.KEYVAULT]: kv.createVault,
  [T.ALERT]: mon.createAlert,
  [T.WORKSPACE]: misc.createWorkspace,
  [T.APPINSIGHTS]: misc.createAppInsights,
  [T.DEVOPS_PROJECT]: devops.createProject,
  [T.ACR]: cont.createRegistry,
  [T.ACI]: cont.createContainerGroup,
  [T.AKS]: cont.createCluster,
  [T.BACKUP_VAULT]: backup.createBackupVault,
  [T.BUDGET]: mon.createBudget,
};

export async function createByType(ctx: Ctx, type: string, input: unknown) {
  const fn = CREATORS[type];
  if (!fn) throw badRequest("UnsupportedType", `Creating '${type}' is not supported.`);
  return fn(ctx, input);
}

const s = (v: unknown) => String(v ?? "");
const b = (v: unknown) => v === true || v === "true";
type Action = (ctx: Ctx, r: Res, a: Props) => Promise<unknown>;

export const ACTIONS: Record<string, Record<string, Action>> = {
  [T.VM]: {
    start: (c, r) => compute.vmPowerAction(c, r, "start"),
    stop: (c, r) => compute.vmPowerAction(c, r, "stop"),
    restart: (c, r) => compute.vmPowerAction(c, r, "restart"),
    deallocate: (c, r) => compute.vmPowerAction(c, r, "deallocate"),
    resize: (c, r, a) => compute.resizeVm(c, r, s(a.size)),
    runCommand: (c, r, a) => compute.runCommand(c, r, s(a.script)),
    testConnectivity: (c, r, a) => compute.testConnectivity(c, r, a),
    attachNsg: (c, r, a) => compute.attachNsgToNic(c, r, a.nsgName ? s(a.nsgName) : null),
    attachPublicIp: (c, r) => compute.attachPublicIp(c, r),
  },
  [T.VNET]: {
    addSubnet: (c, r, a) => net.addSubnet(c, r, a),
    deleteSubnet: (c, r, a) => net.deleteSubnet(c, r, s(a.name)),
    associateNsg: (c, r, a) => net.associateSubnetNsg(c, r, s(a.subnet), a.nsgName ? s(a.nsgName) : null),
    addPeering: (c, r, a) => net.addPeering(c, r, a),
    removePeering: (c, r, a) => net.removePeering(c, r, s(a.name)),
    updateAddressSpace: (c, r, a) => net.updateAddressSpace(c, r, z.array(z.string()).min(1).parse(a.addressPrefixes)),
    setDnsServers: (c, r, a) => net.setDnsServers(c, r, z.array(z.string()).parse(a.dnsServers ?? [])),
  },
  [T.NSG]: {
    addRule: (c, r, a) => net.addRule(c, r, a),
    updateRule: (c, r, a) => net.updateRule(c, r, s(a.name), a),
    deleteRule: (c, r, a) => net.deleteRule(c, r, s(a.name)),
    evaluate: (c, r, a) => net.evaluateFlow(c, r, a),
  },
  [T.STORAGE]: {
    updateConfig: (c, r, a) => storage.updateStorageConfig(c, r, a),
    createContainer: (c, r, a) => storage.createContainer(c, r, a),
    deleteContainer: (c, r, a) => storage.deleteContainer(c, r, s(a.name)),
    setContainerAccess: (c, r, a) => storage.setContainerAccess(c, r, s(a.name), s(a.publicAccess)),
    uploadBlob: (c, r, a) => storage.uploadBlob(c, r, a),
    deleteBlob: (c, r, a) => storage.deleteBlob(c, r, s(a.container), s(a.name)),
    setBlobTier: (c, r, a) => storage.setBlobTier(c, r, s(a.container), s(a.name), s(a.tier)),
    rotateKey: (c, r) => storage.rotateKey(c, r),
    testAccess: (c, r, a) => storage.testStorageAccess(c, r, a),
  },
  [T.ENTRA_USER]: {
    enable: (c, r) => rbac.setUserEnabled(c, r, true),
    disable: (c, r) => rbac.setUserEnabled(c, r, false),
    resetPassword: (c, r) => rbac.resetPassword(c, r),
    signIn: (c, r, a) => rbac.simulateSignIn(c, r, a),
  },
  [T.ENTRA_GROUP]: {
    addMember: (c, r, a) => rbac.addGroupMember(c, r, s(a.user)),
    removeMember: (c, r, a) => rbac.removeGroupMember(c, r, s(a.user)),
  },
  [T.SITE]: {
    deploy: (c, r, a) => apps.deploySite(c, r, a),
    start: (c, r) => apps.siteAction(c, r, "start"),
    stop: (c, r) => apps.siteAction(c, r, "stop"),
    restart: (c, r) => apps.siteAction(c, r, "restart"),
    setAppSettings: (c, r, a) => apps.setAppSettings(c, r, a),
    setIdentity: (c, r, a) => apps.setIdentity(c, r, b(a.enabled)),
    browse: async (c, r, a) => {
      const res = await apps.browseSite(c, r, s(a.path || "/"));
      const fresh = await (await import("./engine")).getById(c, r.id);
      await updateResource(c, fresh, { properties: { ...fresh.properties, lastHealth: res.status >= 500 ? "Unhealthy" : "Healthy" } });
      return res;
    },
  },
  [T.FUNCTION_APP]: {
    createFunction: (c, r, a) => apps.createFunction(c, r, a),
    invoke: (c, r, a) => apps.invokeFunction(c, r, a),
    disableFunction: (c, r, a) => apps.setFunctionDisabled(c, r, s(a.name), true),
    enableFunction: (c, r, a) => apps.setFunctionDisabled(c, r, s(a.name), false),
    setAppSettings: (c, r, a) => apps.setAppSettings(c, r, a),
    start: (c, r) => apps.siteAction(c, r, "start"),
    stop: (c, r) => apps.siteAction(c, r, "stop"),
  },
  [T.SQL_SERVER]: {
    addFirewallRule: (c, r, a) => apps.addFirewallRule(c, r, a),
    deleteFirewallRule: (c, r, a) => apps.deleteFirewallRule(c, r, s(a.name)),
    updateNetwork: (c, r, a) => apps.updateSqlNetwork(c, r, a),
  },
  [T.SQL_DB]: { query: (c, r, a) => apps.queryDatabase(c, r, a) },
  [T.KEYVAULT]: {
    setSecret: (c, r, a) => kv.setSecret(c, r, a),
    getSecret: (c, r, a) => kv.getSecret(c, r, a),
    disableVersion: (c, r, a) => kv.setVersionEnabled(c, r, s(a.name), s(a.version), false),
    enableVersion: (c, r, a) => kv.setVersionEnabled(c, r, s(a.name), s(a.version), true),
    deleteSecret: (c, r, a) => kv.deleteSecret(c, r, s(a.name)),
    recoverSecret: (c, r, a) => kv.recoverSecret(c, r, s(a.name)),
    purgeSecret: (c, r, a) => kv.purgeSecret(c, r, s(a.name)),
    setAccessPolicy: (c, r, a) => kv.setAccessPolicy(c, r, a),
    setPermissionModel: (c, r, a) => kv.setPermissionModel(c, r, b(a.rbac)),
    testRetrieval: (c, r, a) => kv.testRetrieval(c, r, a),
  },
  [T.ALERT]: {
    enable: (c, r) => mon.setAlertEnabled(c, r, true),
    disable: (c, r) => mon.setAlertEnabled(c, r, false),
  },
  [T.DEVOPS_PROJECT]: {
    addWorkItem: (c, r, a) => devops.addWorkItem(c, r, a),
    moveWorkItem: (c, r, a) => devops.moveWorkItem(c, r, Number(a.id), s(a.state)),
    createRepo: (c, r, a) => devops.createRepo(c, r, s(a.name)),
    createBranch: (c, r, a) => devops.createBranch(c, r, a),
    commitFile: (c, r, a) => devops.commitFile(c, r, a),
    setBranchPolicy: (c, r, a) => devops.setBranchPolicy(c, r, a),
    createPullRequest: (c, r, a) => devops.createPullRequest(c, r, a),
    approvePullRequest: (c, r, a) => devops.approvePullRequest(c, r, Number(a.id)),
    completePullRequest: (c, r, a) => devops.completePullRequest(c, r, Number(a.id)),
    createPipeline: (c, r, a) => devops.createPipeline(c, r, a),
    runPipeline: (c, r, a) => devops.runPipeline(c, r, a),
    addServiceConnection: (c, r, a) => devops.addServiceConnection(c, r, a),
    addEnvironment: (c, r, a) => devops.addEnvironment(c, r, a),
  },
  [T.ACR]: {
    build: (c, r, a) => cont.acrBuild(c, r, a),
    deleteImage: (c, r, a) => cont.deleteImage(c, r, s(a.image)),
  },
  [T.ACI]: {
    start: (c, r) => cont.containerGroupAction(c, r, "start"),
    stop: (c, r) => cont.containerGroupAction(c, r, "stop"),
    restart: (c, r) => cont.containerGroupAction(c, r, "restart"),
  },
  [T.AKS]: {
    createDeployment: (c, r, a) => cont.aksCreateDeployment(c, r, a),
    scale: (c, r, a) => cont.aksScale(c, r, s(a.deployment), Number(a.replicas), s(a.namespace || "default")),
    setImage: (c, r, a) => cont.aksSetImage(c, r, a),
    setEnv: (c, r, a) => cont.aksSetEnv(c, r, s(a.deployment), z.record(z.string(), z.string()).parse(a.env), s(a.namespace || "default")),
    rolloutRestart: (c, r, a) => cont.aksRolloutRestart(c, r, s(a.deployment), s(a.namespace || "default")),
    deleteDeployment: (c, r, a) => cont.aksDeleteDeployment(c, r, s(a.deployment), s(a.namespace || "default")),
    deletePod: (c, r, a) => cont.aksDeletePod(c, r, s(a.pod), s(a.namespace || "default")),
    expose: (c, r, a) => cont.aksExpose(c, r, a),
    createNamespace: (c, r, a) => cont.aksCreateNamespace(c, r, s(a.name)),
    start: (c, r) => cont.aksPower(c, r, "start"),
    stop: (c, r) => cont.aksPower(c, r, "stop"),
    scaleNodes: (c, r, a) => cont.aksScaleNodes(c, r, Number(a.count)),
    attachAcr: (c, r, a) => cont.aksAttachAcr(c, r, s(a.acr)),
  },
  [T.BACKUP_VAULT]: {
    createPolicy: (c, r, a) => backup.createPolicy(c, r, a),
    enableProtection: (c, r, a) => backup.enableProtection(c, r, a),
    backupNow: (c, r, a) => backup.backupNow(c, r, s(a.vmName)),
    stopProtection: (c, r, a) => backup.stopProtection(c, r, s(a.vmName), b(a.deleteData)),
    restore: (c, r, a) => backup.restoreVm(c, r, a),
  },
};

export async function runAction(ctx: Ctx, r: Res, action: string, payload: Props) {
  const fn = ACTIONS[r.type]?.[action];
  if (!fn) throw notFound(`Action '${action}' is not available for ${TYPE_LABELS[r.type] ?? r.type}.`);
  return fn(ctx, r, payload ?? {});
}

/** Removes secrets and large payloads before sending a resource to the browser. */
export function sanitize(r: Res): Res {
  const p = structuredClone(r.properties ?? {});
  if (r.type === T.KEYVAULT) {
    p.secrets = kv.secretMetadata(r);
    p.deletedSecrets = (p.deletedSecrets ?? []).map((d: Props) => ({ name: d.name, deletedDate: d.deletedDate, scheduledPurgeDate: d.scheduledPurgeDate }));
  }
  if (r.type === T.STORAGE) for (const c of p.containers ?? []) for (const bl of c.blobs ?? []) delete bl.data;
  if (r.type === T.SQL_DB) p.statementCount = (p.statements ?? []).length;
  return { ...r, properties: p };
}

export async function resourceDetail(ctx: Ctx, r: Res): Promise<Props> {
  const sub = await getSubscription(ctx);
  const [deps, dependents] = await Promise.all([dependenciesOf(ctx, r.id), dependentsOf(ctx, r.id)]);
  const extra: Props = {};
  if (r.type === T.VM) extra.network = await compute.vmView(ctx, r);
  if (r.type === T.VNET) extra.connected = await net.connectedResources(ctx, r);
  if (r.type === T.STORAGE) extra.usageBytes = storage.usageBytes(r.properties);
  if (r.type === T.SQL_SERVER) extra.databases = (await apps.listSqlDatabases(ctx, r)).map((d) => ({ id: d.id, name: d.name, sku: d.properties.sku }));
  if (r.type === T.RG) extra.resources = (await listResources(ctx, { resourceGroup: r.name })).filter((x) => x.type !== T.RG).map((x) => ({ id: x.id, name: x.name, type: x.type, location: x.location, status: x.status }));
  if (r.type === T.ENTRA_USER) {
    const groups = (await listResources(ctx, { type: T.ENTRA_GROUP })).filter((g) => (g.properties.members as string[]).includes(r.properties.objectId));
    extra.groups = groups.map((g) => g.name);
    extra.roleAssignments = (await listResources(ctx, { type: T.ROLE_ASSIGNMENT })).filter((a) => a.properties.principalId === r.properties.objectId).map((a) => a.properties);
  }
  if (r.type === T.ENTRA_GROUP) {
    const users = await listResources(ctx, { type: T.ENTRA_USER });
    extra.memberDetails = users.filter((u) => (r.properties.members as string[]).includes(u.properties.objectId)).map((u) => ({ name: u.name, displayName: u.properties.displayName }));
  }
  const health = mon.resourceHealth(r);
  return {
    resource: sanitize(r),
    id: armId(sub.subscriptionId, r),
    subscriptionId: sub.subscriptionId,
    typeLabel: TYPE_LABELS[r.type] ?? r.type,
    dependsOn: deps.map((d) => ({ id: d.resource.id, name: d.resource.name, type: d.resource.type, kind: d.kind })),
    usedBy: dependents.map((d) => ({ id: d.resource.id, name: d.resource.name, type: d.resource.type, kind: d.kind })),
    health,
    metrics: mon.METRICS[r.type]?.map((m) => ({ ...m, series: mon.metricSeries(r, m.name) })) ?? [],
    monthlyCost: Math.round(mon.monthlyCost(r) * 100) / 100,
    ...extra,
  };
}

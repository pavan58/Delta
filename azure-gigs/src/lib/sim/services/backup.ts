/** Recovery Services vault: backup policies, VM protection, recovery points and restore. */
import { z } from "zod";
import { badRequest, conflict, notFound } from "@/lib/errors";
import { createResource, Ctx, fakeGuid, findAnyByName, findByName, getById, mutate, Props, Res } from "../engine";
import { T } from "../types";
import { baseServices } from "./compute";

export async function createBackupVault(ctx: Ctx, raw: unknown) {
  const input = z.object({ resourceGroup: z.string().min(1), name: z.string().min(2).max(50), location: z.string().optional(), redundancy: z.enum(["LocallyRedundant", "GeoRedundant", "ZoneRedundant"]).default("GeoRedundant") }).parse(raw);
  return createResource(ctx, {
    type: T.BACKUP_VAULT,
    resourceGroup: input.resourceGroup,
    name: input.name,
    location: input.location,
    properties: { storageRedundancy: input.redundancy, softDelete: true, policies: [{ name: "DefaultPolicy", scheduleTime: "02:00", retentionDays: 30, frequency: "Daily" }], protectedItems: [] as Props[], jobs: [] as Props[] },
  });
}

export async function createPolicy(ctx: Ctx, vault: Res, raw: unknown) {
  const input = z.object({ name: z.string().min(1).max(64).regex(/^[\w-]+$/), scheduleTime: z.string().regex(/^\d{2}:\d{2}$/).default("23:00"), retentionDays: z.coerce.number().int().min(7).max(9999).default(30), frequency: z.enum(["Daily", "Weekly"]).default("Daily") }).parse(raw);
  if ((vault.properties.policies as Props[]).some((p) => p.name === input.name)) throw conflict("PolicyExists", `Policy '${input.name}' already exists.`);
  return mutate(ctx, vault, (p) => {
    p.policies.push(input);
  }, "Create Backup Policy", input);
}

function job(p: Props, operation: string, item: string, status = "Completed") {
  p.jobs = [{ id: fakeGuid().slice(0, 8), operation, item, status, start: new Date().toISOString(), durationSec: operation === "Backup" ? 312 : operation === "Restore" ? 845 : 5 }, ...(p.jobs ?? [])].slice(0, 100);
}

export async function enableProtection(ctx: Ctx, vault: Res, raw: unknown) {
  const input = z.object({ vmName: z.string().min(1), policy: z.string().default("DefaultPolicy") }).parse(raw);
  const vm = await findAnyByName(ctx, T.VM, input.vmName);
  if (!vm) throw notFound(`Virtual machine '${input.vmName}' not found.`);
  if (vm.location !== vault.location) throw badRequest("VaultLocationMismatch", `The VM is in ${vm.location} but the vault is in ${vault.location}. A vault can only protect VMs in its own region.`);
  if (!(vault.properties.policies as Props[]).some((p) => p.name === input.policy)) throw notFound(`Backup policy '${input.policy}' not found.`);
  if ((vault.properties.protectedItems as Props[]).some((i) => i.vmId === vm.id)) throw conflict("AlreadyProtected", `VM '${vm.name}' is already protected by this vault.`);
  return mutate(ctx, vault, (p) => {
    p.protectedItems.push({ vmId: vm.id, vmName: vm.name, resourceGroup: vm.resourceGroup, policy: input.policy, protectionState: "Protected", lastBackup: null, recoveryPoints: [] });
    job(p, "Configure backup", vm.name);
  }, "Enable Backup Protection", { vm: vm.name, policy: input.policy });
}

export async function backupNow(ctx: Ctx, vault: Res, vmName: string) {
  const item = (vault.properties.protectedItems as Props[]).find((i) => i.vmName.toLowerCase() === vmName.toLowerCase());
  if (!item) throw notFound(`VM '${vmName}' is not protected by vault '${vault.name}'. Enable backup first.`);
  const vm = await getById(ctx, item.vmId).catch(() => null);
  if (!vm) throw notFound(`The protected VM '${vmName}' no longer exists; restore from an existing recovery point instead.`);
  const rp = { id: fakeGuid().replace(/-/g, "").slice(0, 12), time: new Date().toISOString(), type: "Snapshot and Vault-Standard", snapshot: { vmSize: vm.properties.vmSize, image: vm.properties.image.alias, osType: vm.properties.osType, adminUsername: vm.properties.adminUsername, services: Object.keys(vm.properties.services ?? {}), nicId: vm.properties.nicId, location: vm.location, resourceGroup: vm.resourceGroup } };
  return mutate(ctx, vault, (p) => {
    const it = p.protectedItems.find((i: Props) => i.vmId === item.vmId);
    it.recoveryPoints.unshift(rp);
    it.lastBackup = rp.time;
    job(p, "Backup", vm.name);
  }, "Backup Now", { vm: vm.name, recoveryPoint: rp.id });
}

export async function stopProtection(ctx: Ctx, vault: Res, vmName: string, deleteData: boolean) {
  return mutate(ctx, vault, (p) => {
    const it = p.protectedItems.find((i: Props) => i.vmName.toLowerCase() === vmName.toLowerCase());
    if (!it) throw notFound(`VM '${vmName}' is not protected.`);
    if (deleteData) p.protectedItems = p.protectedItems.filter((i: Props) => i !== it);
    else it.protectionState = "ProtectionStopped";
    job(p, deleteData ? "Stop protection and delete data" : "Stop protection", vmName);
  }, "Stop Backup Protection", { vm: vmName, deleteData });
}

/** Restores a recovery point as a new VM (alternate location restore). */
export async function restoreVm(ctx: Ctx, vault: Res, raw: unknown) {
  const input = z.object({ vmName: z.string(), recoveryPointId: z.string().optional(), targetVmName: z.string().min(1).max(64) }).parse(raw);
  const item = (vault.properties.protectedItems as Props[]).find((i) => i.vmName.toLowerCase() === input.vmName.toLowerCase());
  if (!item) throw notFound(`No backup item for VM '${input.vmName}'.`);
  const rp = input.recoveryPointId ? (item.recoveryPoints as Props[]).find((r) => r.id === input.recoveryPointId) : item.recoveryPoints[0];
  if (!rp) throw notFound("No recovery point available. Run a backup first.");
  if (await findByName(ctx, T.VM, rp.snapshot.resourceGroup, input.targetVmName)) throw conflict("ResourceExists", `VM '${input.targetVmName}' already exists.`);
  const { createVm } = await import("./compute");
  const nic = rp.snapshot.nicId ? await getById(ctx, rp.snapshot.nicId).catch(() => null) : null;
  const vnet = nic ? await getById(ctx, nic.properties.subnet.vnetId).catch(() => null) : null;
  const vm = await createVm({ ...ctx, source: "system" }, {
    resourceGroup: rp.snapshot.resourceGroup,
    name: input.targetVmName,
    image: rp.snapshot.image,
    size: rp.snapshot.vmSize,
    adminUsername: rp.snapshot.adminUsername,
    authenticationType: rp.snapshot.osType === "Windows" ? "password" : "ssh",
    adminPassword: rp.snapshot.osType === "Windows" ? `Restored!${fakeGuid().slice(0, 8)}A1` : undefined,
    generateSshKeys: true,
    vnetName: vnet?.name,
    subnetName: nic?.properties.subnet.name,
    nsgName: nic?.properties.nsgName ?? undefined,
    publicIp: true,
  });
  const restored = await mutate(ctx, vm, (p) => {
    p.services = { ...baseServices(rp.snapshot.osType, false), ...Object.fromEntries((rp.snapshot.services as string[]).map((s) => [s, { state: "running", enabled: true, ...(s === "nginx" || s === "W3SVC" ? { port: 80 } : s === "sshd" ? { port: 22 } : s === "TermService" ? { port: 3389 } : {}) }])) };
    p.restoredFrom = { vault: vault.name, recoveryPoint: rp.id, sourceVm: input.vmName };
  });
  await mutate(ctx, vault, (p) => job(p, "Restore", `${input.vmName} -> ${input.targetVmName}`), "Restore Virtual Machine", { from: input.vmName, to: input.targetVmName, recoveryPoint: rp.id });
  return restored;
}

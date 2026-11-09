import { z } from "zod";
import { createHash } from "node:crypto";
import { badRequest, conflict, notFound } from "@/lib/errors";
import {
  addDependency, createResource, Ctx, dependenciesOf, findAnyByName, findByName, getById, getByName, listResources, logActivity, mutate, Props, removeDependency, Res,
} from "../engine";
import { findImage, findSize, VM_IMAGES, VM_SIZES } from "../catalog";
import { T } from "../types";
import { allocateIp, evaluateNsg, Flow, isPrivateIp, NsgRule } from "../net";
import { addRule, createNsg, createPublicIp, createVnet, nicsInSubnet, publicIpFor } from "./network";

const RESERVED_USERNAMES = ["administrator", "admin", "user", "user1", "test", "user2", "test1", "user3", "admin1", "1", "123", "a", "actuser", "adm", "admin2", "aspnet", "backup", "console", "david", "guest", "john", "owner", "root", "server", "sql", "support", "support_388945a0", "sys", "test2", "test3", "user4", "user5"];

export const vmSchema = z.object({
  resourceGroup: z.string().min(1),
  name: z.string().min(1).max(64),
  location: z.string().optional(),
  image: z.string().default("Ubuntu2204"),
  size: z.string().default("Standard_B1s"),
  adminUsername: z.string().min(1).max(64).default("azureuser"),
  authenticationType: z.enum(["password", "ssh"]).optional(),
  adminPassword: z.string().optional(),
  sshPublicKey: z.string().optional(),
  generateSshKeys: z.boolean().optional(),
  vnetName: z.string().optional(),
  subnetName: z.string().optional(),
  publicIp: z.boolean().default(true),
  nsgName: z.string().optional().nullable(), // existing NSG name to attach to NIC; "" for none
  createNsg: z.boolean().optional(), // create <vm>-nsg with a rule for SSH/RDP (CLI default behaviour)
  nsgRule: z.enum(["SSH", "RDP", "NONE"]).optional(),
  osDiskType: z.enum(["Standard_LRS", "StandardSSD_LRS", "Premium_LRS"]).default("Premium_LRS"),
  osDiskSizeGB: z.coerce.number().int().min(30).max(4095).optional(),
  dataDisks: z.array(z.object({ sizeGB: z.coerce.number().int().min(4).max(32767), sku: z.enum(["Standard_LRS", "StandardSSD_LRS", "Premium_LRS"]).default("Premium_LRS") })).max(8).optional(),
  installWebServer: z.boolean().optional(),
  bootDiagnostics: z.boolean().default(true),
  zone: z.string().optional(),
  tags: z.record(z.string(), z.string()).optional(),
});
export type VmInput = z.infer<typeof vmSchema>;

function validatePassword(pw: string) {
  if (pw.length < 12 || pw.length > 123) throw badRequest("InvalidParameter", "The supplied password must be between 12-123 characters long.");
  const classes = [/[a-z]/, /[A-Z]/, /\d/, /[^a-zA-Z\d]/].filter((r) => r.test(pw)).length;
  if (classes < 3) throw badRequest("InvalidParameter", "The supplied password must satisfy at least 3 of: a lowercase character, an uppercase character, a digit, a special character.");
  if (["P@ssw0rd123", "Password123!", "Password1234"].includes(pw)) throw badRequest("InvalidParameter", "This password is not allowed (commonly used).");
}

export function baseServices(os: string, web: boolean): Props {
  return os === "Linux"
    ? { sshd: { state: "running", enabled: true, port: 22 }, ...(web ? { nginx: { state: "running", enabled: true, port: 80 } } : {}) }
    : { TermService: { state: "running", enabled: true, port: 3389 }, ...(web ? { W3SVC: { state: "running", enabled: true, port: 80 } } : {}) };
}

export async function createVm(ctx: Ctx, raw: unknown) {
  const input = vmSchema.parse(raw);
  const image = findImage(input.image);
  if (!image) throw badRequest("InvalidImage", `Image '${input.image}' is not available. Use one of: ${VM_IMAGES.map((i) => i.alias).join(", ")}.`);
  const size = findSize(input.size);
  if (!size) throw badRequest("SkuNotAvailable", `VM size '${input.size}' is not available. Use one of: ${VM_SIZES.map((s) => s.name).join(", ")}.`);
  if (RESERVED_USERNAMES.includes(input.adminUsername.toLowerCase()))
    throw badRequest("InvalidParameter", `The admin username '${input.adminUsername}' is reserved. Choose a different username.`);
  if (!/^[a-zA-Z][a-zA-Z0-9_.-]*$/.test(input.adminUsername)) throw badRequest("InvalidParameter", "Admin username must start with a letter and contain only letters, digits, '_', '.', '-'.");

  const authType = input.authenticationType ?? (image.os === "Windows" ? "password" : input.adminPassword ? "password" : "ssh");
  if (image.os === "Windows" && authType === "ssh") throw badRequest("InvalidParameter", "SSH authentication is not supported for Windows images; use a password.");
  let sshKeyFingerprint: string | null = null;
  if (authType === "password") {
    if (!input.adminPassword) throw badRequest("InvalidParameter", "An admin password is required for password authentication.");
    validatePassword(input.adminPassword);
  } else {
    if (input.sshPublicKey) {
      if (!/^(ssh-rsa|ssh-ed25519|ecdsa-sha2-nistp256) [A-Za-z0-9+/=]{16,}/.test(input.sshPublicKey.trim())) throw badRequest("InvalidParameter", "The SSH public key is not in a valid OpenSSH format.");
      sshKeyFingerprint = "SHA256:" + createHash("sha256").update(input.sshPublicKey.trim()).digest("base64").replace(/=+$/, "");
    } else if (input.generateSshKeys !== false) {
      sshKeyFingerprint = "SHA256:" + createHash("sha256").update(`${ctx.userId}:${input.name}:generated`).digest("base64").replace(/=+$/, "");
    } else throw badRequest("InvalidParameter", "Provide an SSH public key or choose to generate one.");
  }

  const rg = await getByName(ctx, T.RG, input.resourceGroup, input.resourceGroup);
  const location = input.location ?? rg.location;
  if (await findByName(ctx, T.VM, rg.name, input.name)) throw conflict("ResourceExists", `A virtual machine named '${input.name}' already exists in resource group '${rg.name}'.`);

  // ---- Network: use existing VNet/subnet or create defaults like `az vm create` does.
  let vnet: Res | null = null;
  if (input.vnetName) {
    vnet = await findByName(ctx, T.VNET, rg.name, input.vnetName) ?? (await findAnyByName(ctx, T.VNET, input.vnetName));
    if (!vnet) throw notFound(`Virtual network '${input.vnetName}' was not found.`);
  } else {
    const defName = `${input.name}VNET`;
    vnet = (await findByName(ctx, T.VNET, rg.name, defName)) ?? (await createVnet(ctx, { resourceGroup: rg.name, name: defName, location, addressPrefixes: ["10.0.0.0/16"], subnets: [{ name: `${input.name}Subnet`, addressPrefix: "10.0.0.0/24" }] }));
  }
  if (vnet.location !== location) throw badRequest("InvalidResourceReference", `Virtual network '${vnet.name}' is in ${vnet.location}; the VM must be in the same region (${location}).`);
  const subnets = vnet.properties.subnets as Props[];
  const subnet = input.subnetName ? subnets.find((s) => s.name.toLowerCase() === input.subnetName!.toLowerCase()) : subnets[0];
  if (!subnet) throw notFound(input.subnetName ? `Subnet '${input.subnetName}' not found in virtual network '${vnet.name}'.` : `Virtual network '${vnet.name}' has no subnets. Create a subnet first.`);

  let nsg: Res | null = null;
  if (input.nsgName) {
    nsg = (await findByName(ctx, T.NSG, rg.name, input.nsgName)) ?? (await findAnyByName(ctx, T.NSG, input.nsgName));
    if (!nsg) throw notFound(`Network security group '${input.nsgName}' was not found.`);
  } else if (input.createNsg ?? input.nsgName === undefined) {
    const nsgName = `${input.name}NSG`;
    nsg = (await findByName(ctx, T.NSG, rg.name, nsgName)) ?? (await createNsg(ctx, { resourceGroup: rg.name, name: nsgName, location }));
    const ruleKind = input.nsgRule ?? (image.os === "Windows" ? "RDP" : "SSH");
    if (ruleKind !== "NONE" && !(nsg.properties.securityRules as NsgRule[]).some((r) => r.name === `default-allow-${ruleKind.toLowerCase()}`)) {
      nsg = await addRule(ctx, nsg, { name: `default-allow-${ruleKind.toLowerCase()}`, priority: 1000, direction: "Inbound", access: "Allow", protocol: "Tcp", sourceAddressPrefix: "*", sourcePortRange: "*", destinationAddressPrefix: "*", destinationPortRange: ruleKind === "SSH" ? "22" : "3389" });
    }
  }

  const usedIps = (await nicsInSubnet(ctx, vnet.id, subnet.name)).map((n) => n.properties.privateIpAddress as string);
  const privateIp = allocateIp(subnet.addressPrefix, usedIps);

  let pip: Res | null = null;
  if (input.publicIp) pip = await createPublicIp(ctx, { resourceGroup: rg.name, name: `${input.name}PublicIP`, location });

  const nic = await createResource(ctx, {
    type: T.NIC,
    resourceGroup: rg.name,
    name: `${input.name}VMNic`,
    location,
    properties: {
      subnet: { vnetId: vnet.id, vnetName: vnet.name, name: subnet.name },
      privateIpAddress: privateIp,
      privateIpAllocationMethod: "Dynamic",
      publicIpId: pip?.id ?? null,
      nsgId: nsg?.id ?? null,
      nsgName: nsg?.name ?? null,
      enableAcceleratedNetworking: false,
    },
    dependsOn: [{ toId: vnet.id, kind: "subnet" }, ...(nsg ? [{ toId: nsg.id, kind: "nsg" }] : []), ...(pip ? [{ toId: pip.id, kind: "publicIp" }] : [])],
  });

  const osDisk = await createResource(ctx, {
    type: T.DISK,
    resourceGroup: rg.name,
    name: `${input.name}_OsDisk_1`,
    location,
    properties: { sizeGB: input.osDiskSizeGB ?? (image.os === "Windows" ? 127 : 30), sku: input.osDiskType, osType: image.os, diskState: "Attached" },
  });
  const dataDisks: Res[] = [];
  for (const [i, d] of (input.dataDisks ?? []).entries()) {
    dataDisks.push(await createResource(ctx, { type: T.DISK, resourceGroup: rg.name, name: `${input.name}_DataDisk_${i}`, location, properties: { sizeGB: d.sizeGB, sku: d.sku, diskState: "Attached", lun: i } }));
  }

  const vm = await createResource(ctx, {
    type: T.VM,
    resourceGroup: rg.name,
    name: input.name,
    location,
    tags: input.tags,
    status: "Succeeded",
    properties: {
      vmSize: size.name,
      vcpus: size.vcpus,
      memoryGiB: size.memoryGiB,
      image: { alias: image.alias, urn: image.urn, display: image.display },
      osType: image.os,
      computerName: input.name.slice(0, 15),
      adminUsername: input.adminUsername,
      authenticationType: authType,
      passwordConfigured: authType === "password", // the password itself is never stored
      sshKeyFingerprint,
      nicId: nic.id,
      osDiskId: osDisk.id,
      dataDiskIds: dataDisks.map((d) => d.id),
      powerState: "VM running",
      bootDiagnostics: input.bootDiagnostics,
      zone: input.zone ?? null,
      services: baseServices(image.os, !!input.installWebServer),
      processes: [],
      diskUsedPercent: 18,
      logFiles: [],
      bootLog: [],
      lastStartTime: new Date().toISOString(),
      vmId: crypto.randomUUID(),
    },
    dependsOn: [{ toId: nic.id, kind: "nic" }, { toId: osDisk.id, kind: "osDisk" }, ...dataDisks.map((d) => ({ toId: d.id, kind: "dataDisk" }))],
  });
  // Mark children as owned by the VM (deleted together with it).
  for (const child of [nic, osDisk, ...dataDisks, ...(pip ? [pip] : [])]) {
    await mutate(ctx, child, (p) => {
      p.ownerId = vm.id;
      p.ownerName = vm.name;
    });
  }
  if (pip) await addDependency(nic.id, pip.id, "publicIp");
  return getById(ctx, vm.id);
}

export async function vmNetwork(ctx: Ctx, vm: Res) {
  const nic = vm.properties.nicId ? await getById(ctx, vm.properties.nicId).catch(() => null) : null;
  const pip = nic?.properties.publicIpId ? await getById(ctx, nic.properties.publicIpId).catch(() => null) : null;
  const nicNsg = nic?.properties.nsgId ? await getById(ctx, nic.properties.nsgId).catch(() => null) : null;
  const vnet = nic?.properties.subnet?.vnetId ? await getById(ctx, nic.properties.subnet.vnetId).catch(() => null) : null;
  const subnet = vnet ? (vnet.properties.subnets as Props[]).find((s) => s.name === nic!.properties.subnet.name) : null;
  const subnetNsg = subnet?.nsgId ? await getById(ctx, subnet.nsgId).catch(() => null) : null;
  return { nic, pip, nicNsg, vnet, subnet, subnetNsg };
}

export function bootLines(vm: Res, event: string): string[] {
  const ts = new Date().toISOString();
  return vm.properties.osType === "Linux"
    ? [
        `[${ts}] ${event}`,
        `[    0.000000] Linux version 6.8.0-azure (buildd@lcy02) #1 SMP`,
        `[    1.204512] hv_vmbus: registering driver hv_netvsc`,
        `[    3.118201] systemd[1]: Reached target Network.`,
        `[    4.552010] cloud-init[812]: Cloud-init v. 24.1 finished. Datasource DataSourceAzure.`,
        `${vm.properties.computerName} login:`,
      ]
    : [`[${ts}] ${event}`, "Windows Boot Manager: loading Windows Server", "Applying computer settings...", "Windows is ready. Press Ctrl+Alt+Del to sign in."];
}

export async function vmPowerAction(ctx: Ctx, vm: Res, action: "start" | "stop" | "restart" | "deallocate") {
  const state = vm.properties.powerState as string;
  if (vm.status === "Failed") throw conflict("OperationNotAllowed", `VM '${vm.name}' is in a failed state.`);
  if (action === "start" && state === "VM running") throw conflict("OperationNotAllowed", `VM '${vm.name}' is already running.`);
  if (action === "stop" && state !== "VM running") throw conflict("OperationNotAllowed", `VM '${vm.name}' is not running (current state: ${state}).`);
  if (action === "restart" && state !== "VM running") throw conflict("OperationNotAllowed", `Cannot restart VM '${vm.name}' because it is not running. Start it instead.`);
  if (action === "deallocate" && state === "VM deallocated") throw conflict("OperationNotAllowed", `VM '${vm.name}' is already deallocated.`);
  const opName = { start: "Start Virtual Machine", stop: "Power Off Virtual Machine", restart: "Restart Virtual Machine", deallocate: "Deallocate Virtual Machine" }[action];
  return mutate(ctx, vm, (p) => {
    if (action === "start" || action === "restart") {
      p.powerState = "VM running";
      p.lastStartTime = new Date().toISOString();
      // On boot, enabled services start (unless the disk is full) and runaway processes are gone.
      for (const s of Object.values(p.services as Record<string, Props>)) {
        if (s.enabled) s.state = p.diskUsedPercent >= 100 && s.port === 80 ? "failed" : "running";
      }
      p.processes = (p.processes ?? []).filter((x: Props) => !x.runaway);
      p.bootLog = [...(p.bootLog ?? []), ...bootLines(vm, action === "start" ? "Starting VM" : "Restarting VM")].slice(-60);
    } else {
      p.powerState = action === "stop" ? "VM stopped" : "VM deallocated";
      for (const s of Object.values(p.services as Record<string, Props>)) s.state = "stopped";
      p.bootLog = [...(p.bootLog ?? []), `[${new Date().toISOString()}] ${action === "stop" ? "Guest shutdown requested" : "VM deallocated; compute released"}`].slice(-60);
    }
  }, opName);
}

export async function resizeVm(ctx: Ctx, vm: Res, sizeName: string) {
  const size = findSize(sizeName);
  if (!size) throw badRequest("SkuNotAvailable", `VM size '${sizeName}' is not available.`);
  return mutate(ctx, vm, (p) => {
    p.vmSize = size.name;
    p.vcpus = size.vcpus;
    p.memoryGiB = size.memoryGiB;
  }, "Resize Virtual Machine", { size: size.name });
}

export async function attachNsgToNic(ctx: Ctx, vm: Res, nsgName: string | null) {
  const { nic } = await vmNetwork(ctx, vm);
  if (!nic) throw notFound("The VM has no network interface.");
  await removeDependency(nic.id, "nsg");
  let nsg: Res | null = null;
  if (nsgName) {
    nsg = await findAnyByName(ctx, T.NSG, nsgName);
    if (!nsg) throw notFound(`Network security group '${nsgName}' was not found.`);
    await addDependency(nic.id, nsg.id, "nsg");
  }
  return mutate(ctx, nic, (p) => {
    p.nsgId = nsg?.id ?? null;
    p.nsgName = nsg?.name ?? null;
  }, nsg ? "Associate NSG to Network Interface" : "Dissociate NSG from Network Interface", { nsg: nsg?.name });
}

export async function attachPublicIp(ctx: Ctx, vm: Res) {
  const { nic, pip } = await vmNetwork(ctx, vm);
  if (!nic) throw notFound("The VM has no network interface.");
  if (pip) throw conflict("PublicIpAlreadyAttached", "The NIC already has a public IP.");
  const newPip = await createPublicIp(ctx, { resourceGroup: vm.resourceGroup, name: `${vm.name}PublicIP`, location: vm.location }, { ownerId: vm.id });
  await addDependency(nic.id, newPip.id, "publicIp");
  return mutate(ctx, nic, (p) => {
    p.publicIpId = newPip.id;
  }, "Associate Public IP Address", { ip: newPip.properties.ipAddress });
}

export function listeningPorts(vm: Res): number[] {
  if (vm.properties.powerState !== "VM running") return [];
  return Object.values(vm.properties.services as Record<string, Props>).filter((s) => s.state === "running" && s.port).map((s) => s.port as number);
}

export type Hop = { step: string; result: "Pass" | "Fail" | "Skipped"; detail: string };

/** Network Watcher-style connectivity check to a VM. */
export async function testConnectivity(ctx: Ctx, vm: Res, raw: unknown) {
  const input = z.object({ port: z.coerce.number().int().min(1).max(65535), protocol: z.enum(["Tcp", "Udp"]).default("Tcp"), source: z.string().default("Internet") }).parse(raw);
  const hops: Hop[] = [];
  const fresh = await getById(ctx, vm.id);
  const net = await vmNetwork(ctx, fresh);
  let reachable = true;
  const fail = (step: string, detail: string) => {
    hops.push({ step, result: "Fail", detail });
    reachable = false;
  };

  if (fresh.properties.powerState !== "VM running") fail("VM power state", `VM is '${fresh.properties.powerState}'. Start the VM.`);
  else hops.push({ step: "VM power state", result: "Pass", detail: "VM running" });

  let sourceEp = { ip: "203.0.113.10", inVnet: false };
  const fromInternet = input.source.toLowerCase() === "internet";
  if (!fromInternet) {
    const srcVm = /^\d+\.\d+\.\d+\.\d+$/.test(input.source) ? null : await findAnyByName(ctx, T.VM, input.source);
    if (srcVm) {
      const sn = await vmNetwork(ctx, srcVm);
      const peered = sn.vnet && net.vnet && (sn.vnet.id === net.vnet.id || (sn.vnet.properties.peerings as Props[]).some((p) => p.remoteVnetId === net.vnet!.id && p.peeringState === "Connected"));
      sourceEp = { ip: sn.nic?.properties.privateIpAddress ?? "10.0.0.250", inVnet: !!peered };
      if (!peered) fail("Routing", `Source VM '${srcVm.name}' is in a different virtual network with no peering to '${net.vnet?.name}'.`);
      else hops.push({ step: "Routing", result: "Pass", detail: sn.vnet!.id === net.vnet!.id ? "Same virtual network" : "Via VNet peering" });
    } else if (/^\d+\.\d+\.\d+\.\d+$/.test(input.source)) {
      sourceEp = { ip: input.source, inVnet: isPrivateIp(input.source) };
    } else throw notFound(`Source '${input.source}' not found. Use 'Internet', an IP address or a VM name.`);
  }

  if (fromInternet || !sourceEp.inVnet) {
    if (!net.pip) fail("Public IP", "The VM's network interface has no public IP address, so it is not reachable from the Internet.");
    else hops.push({ step: "Public IP", result: "Pass", detail: `${net.pip.properties.ipAddress}` });
  }

  const dest = { ip: net.nic?.properties.privateIpAddress ?? "10.0.0.4", inVnet: true };
  const flow: Flow = { direction: "Inbound", protocol: input.protocol, source: sourceEp, sourcePort: "*", destination: dest, destinationPort: input.port };
  for (const [label, nsg] of [["Subnet NSG", net.subnetNsg], ["NIC NSG", net.nicNsg]] as const) {
    if (!nsg) {
      hops.push({ step: label, result: "Skipped", detail: "No NSG associated" });
      continue;
    }
    const r = evaluateNsg(nsg.properties.securityRules, flow);
    if (r.access === "Deny") fail(label, `Traffic denied by rule '${r.rule.name}' (priority ${r.rule.priority}) in NSG '${nsg.name}'.`);
    else hops.push({ step: label, result: "Pass", detail: `Allowed by rule '${r.rule.name}' (priority ${r.rule.priority}) in NSG '${nsg.name}'` });
  }
  if (!net.subnetNsg && !net.nicNsg && (fromInternet || !sourceEp.inVnet)) {
    hops.push({ step: "Platform default", result: "Pass", detail: "No NSG: all inbound traffic is allowed (not recommended)." });
  }

  const ports = listeningPorts(fresh);
  if (fresh.properties.powerState === "VM running") {
    if (!ports.includes(input.port)) {
      const svc = Object.entries(fresh.properties.services as Record<string, Props>).find(([, s]) => s.port === input.port);
      fail("Guest OS", svc ? `Service '${svc[0]}' listening on port ${input.port} is ${svc[1].state}.` : `Nothing is listening on port ${input.port} inside the VM.`);
    } else hops.push({ step: "Guest OS", result: "Pass", detail: `Port ${input.port} is listening` });
  }

  const result = { reachable, status: reachable ? "Reachable" : "Unreachable", source: fromInternet ? "Internet" : input.source, destination: `${fresh.name}:${input.port}`, hops };
  await logActivity(ctx, fresh, "Network Watcher Connectivity Check", "Succeeded", { port: input.port, source: result.source, status: result.status });
  return result;
}

// ---------------- Run command (simulated guest OS) ----------------

type Out = { out: string[]; changed: boolean };

function serviceCmd(p: Props, verb: string, name: string, o: Out) {
  const svcs = p.services as Record<string, Props>;
  const key = Object.keys(svcs).find((k) => k.toLowerCase() === name.replace(/\.service$/, "").toLowerCase());
  if (!key) {
    o.out.push(verb === "status" ? `Unit ${name}.service could not be found.` : `Failed to ${verb} ${name}.service: Unit ${name}.service not found.`);
    return;
  }
  const s = svcs[key];
  switch (verb) {
    case "status":
      o.out.push(`● ${key}.service`, `     Loaded: loaded (/lib/systemd/system/${key}.service; ${s.enabled ? "enabled" : "disabled"})`, `     Active: ${s.state === "running" ? "active (running)" : s.state === "failed" ? "failed (Result: exit-code)" : "inactive (dead)"}`);
      if (s.state === "failed" && s.error) o.out.push(`   ${s.error}`);
      return;
    case "start":
    case "restart":
      if (p.diskUsedPercent >= 100 && s.port === 80) {
        s.state = "failed";
        s.error = `${key}: [emerg] open() "/var/log/${key}/error.log" failed (28: No space left on device)`;
        o.out.push(`Job for ${key}.service failed because the control process exited with error code.`, s.error);
      } else {
        s.state = "running";
        delete s.error;
      }
      o.changed = true;
      return;
    case "stop":
      s.state = "stopped";
      o.changed = true;
      return;
    case "enable":
      s.enabled = true;
      o.out.push(`Created symlink /etc/systemd/system/multi-user.target.wants/${key}.service.`);
      o.changed = true;
      return;
    case "disable":
      s.enabled = false;
      o.changed = true;
      return;
  }
  o.out.push(`Unknown operation '${verb}'.`);
}

export async function runCommand(ctx: Ctx, vm: Res, script: string) {
  const fresh = await getById(ctx, vm.id);
  if (fresh.properties.powerState !== "VM running") throw conflict("OperationNotAllowed", `Run command requires the VM to be running (current state: ${fresh.properties.powerState}).`);
  if (script.length > 4000) throw badRequest("InvalidParameter", "Script too long.");
  const o: Out = { out: [], changed: false };
  const linux = fresh.properties.osType === "Linux";
  const p = structuredClone(fresh.properties);
  for (const rawLine of script.split(/\n|;|&&/).map((l) => l.trim()).filter(Boolean)) {
    const line = rawLine.replace(/^sudo\s+/, "");
    const [cmd, ...args] = line.split(/\s+/);
    o.out.push(`$ ${line}`);
    if (!linux) {
      runWindows(p, cmd, args, line, o);
      continue;
    }
    switch (cmd) {
      case "systemctl":
        serviceCmd(p, args[0] ?? "status", args[1] ?? "", o);
        break;
      case "service":
        serviceCmd(p, args[1] ?? "status", args[0] ?? "", o);
        break;
      case "apt-get":
      case "apt":
      case "yum":
      case "dnf":
        if (args.includes("install")) {
          const pkg = args.filter((a) => !a.startsWith("-") && a !== "install")[0];
          if (!pkg) { o.out.push("E: No package specified"); break; }
          if (p.diskUsedPercent >= 100) { o.out.push("E: You don't have enough free space in /var/cache/apt/archives/."); break; }
          const port = pkg === "nginx" || pkg === "apache2" || pkg === "httpd" ? 80 : undefined;
          p.services[pkg] = { state: "running", enabled: true, ...(port ? { port } : {}) };
          o.out.push(`Reading package lists... Done`, `Setting up ${pkg} ...`, `Created symlink for ${pkg}.service`);
          o.changed = true;
        } else if (args.includes("update")) o.out.push("Hit:1 http://azure.archive.ubuntu.com/ubuntu jammy InRelease", "Reading package lists... Done");
        else o.out.push(`${cmd}: unsupported operation in simulator`);
        break;
      case "ps":
      case "top": {
        o.out.push("  PID USER      %CPU %MEM COMMAND");
        const procs = [{ pid: 1, user: "root", cpu: 0.0, mem: 0.3, cmd: "/sbin/init" }, ...Object.entries(p.services as Record<string, Props>).filter(([, s]) => s.state === "running").map(([n], i) => ({ pid: 400 + i * 37, user: n === "nginx" ? "www-data" : "root", cpu: 0.3, mem: 1.1, cmd: n })), ...(p.processes ?? [])];
        for (const x of procs) o.out.push(`${String(x.pid).padStart(5)} ${x.user.padEnd(9)} ${x.cpu.toFixed(1).padStart(4)} ${x.mem.toFixed(1).padStart(4)} ${x.cmd}`);
        break;
      }
      case "kill":
      case "pkill": {
        const target = args.filter((a) => !a.startsWith("-"))[0];
        const before = (p.processes ?? []).length;
        p.processes = (p.processes ?? []).filter((x: Props) => String(x.pid) !== target && x.cmd.split(/[\s/]/).pop() !== target && !x.cmd.includes(target ?? "\u0000"));
        if (p.processes.length === before) o.out.push(`${cmd}: (${target}) - No such process`);
        else o.changed = true;
        break;
      }
      case "df": {
        const total = 30;
        const used = Math.round((total * p.diskUsedPercent) / 100);
        o.out.push("Filesystem      Size  Used Avail Use% Mounted on", `/dev/root        ${total}G   ${used}G  ${total - used}G  ${p.diskUsedPercent}% /`, "/dev/sdb1        16G   28K   15G   1% /mnt");
        break;
      }
      case "du":
        for (const f of p.logFiles ?? []) o.out.push(`${f.sizeGB}G\t${f.path}`);
        if (!(p.logFiles ?? []).length) o.out.push("12M\t/var/log");
        break;
      case "rm":
      case "truncate":
      case "journalctl": {
        const target = args.filter((a) => !a.startsWith("-"))[0] ?? "";
        const before = (p.logFiles ?? []) as Props[];
        const removed = before.filter((f) => cmd === "journalctl" ? f.path.startsWith("/var/log/journal") : matchesGlob(f.path, target) || f.path.startsWith(target.replace(/\*$/, "")) && target.startsWith("/var/log"));
        if (target === "/" || target === "/*") { o.out.push("rm: refusing to remove '/' (simulator safety)"); break; }
        p.logFiles = before.filter((f) => !removed.includes(f));
        const freed = removed.reduce((a, f) => a + f.sizeGB, 0);
        p.diskUsedPercent = Math.max(18, Math.round(p.diskUsedPercent - (freed / 30) * 100));
        if (removed.length) { o.out.push(`Freed ${freed}G`); o.changed = true; }
        break;
      }
      case "curl": {
        const url = args.find((a) => !a.startsWith("-")) ?? "";
        const m = /^(?:https?:\/\/)?(localhost|127\.0\.0\.1)(?::(\d+))?/.exec(url);
        if (!m) { o.out.push(`curl: (6) Could not resolve host: ${url} (outbound HTTP is simulated only for localhost)`); break; }
        const port = Number(m[2] ?? 80);
        const svc = Object.entries(p.services as Record<string, Props>).find(([, s]) => s.port === port && s.state === "running");
        o.out.push(svc ? `HTTP/1.1 200 OK\nServer: ${svc[0]}\n\n<h1>Welcome to ${fresh.name}</h1>` : `curl: (7) Failed to connect to localhost port ${port}: Connection refused`);
        break;
      }
      case "ss":
      case "netstat":
        o.out.push("State   Local Address:Port   Process");
        for (const [n, s] of Object.entries(p.services as Record<string, Props>)) if (s.state === "running" && s.port) o.out.push(`LISTEN  0.0.0.0:${s.port}         ${n}`);
        break;
      case "nslookup":
      case "dig": {
        const host = args.find((a) => !a.startsWith("-")) ?? "";
        const net = await vmNetwork(ctx, fresh);
        const dns = (net.vnet?.properties.dnsServers ?? []) as string[];
        if (dns.length && !dns.includes("168.63.129.16")) o.out.push(`;; connection timed out; no servers could be reached (DNS server ${dns[0]} unreachable)`);
        else o.out.push(`Server:  168.63.129.16`, `Name:    ${host}`, `Address: ${publicIpFor(host)}`);
        break;
      }
      case "hostname":
        o.out.push(p.computerName);
        break;
      case "uptime":
        o.out.push(` ${new Date().toTimeString().slice(0, 8)} up ${Math.max(1, Math.round((Date.now() - Date.parse(p.lastStartTime)) / 60000))} min,  1 user,  load average: ${(p.processes ?? []).some((x: Props) => x.runaway) ? "3.98, 3.95, 3.90" : "0.04, 0.03, 0.01"}`);
        break;
      case "free":
        o.out.push("               total        used        free", `Mem:          ${p.memoryGiB * 1024}         ${Math.round(p.memoryGiB * 1024 * 0.35)}         ${Math.round(p.memoryGiB * 1024 * 0.65)}`);
        break;
      case "cat":
        if (args[0] === "/etc/os-release") o.out.push(`PRETTY_NAME="${p.image.display}"`);
        else o.out.push(`cat: ${args[0] ?? ""}: Permission denied or not present in the simulated VM`);
        break;
      case "echo":
        o.out.push(args.join(" "));
        break;
      default:
        o.out.push(`${cmd}: command not supported by the simulated run-command agent. Supported: systemctl, service, apt-get, ps, top, kill, df, du, rm (logs), journalctl, curl localhost, ss, nslookup, hostname, uptime, free, cat /etc/os-release, echo`);
    }
  }
  let updated = fresh;
  if (o.changed) updated = await mutate(ctx, fresh, () => p, "Run Command on Virtual Machine", { script });
  else await logActivity(ctx, fresh, "Run Command on Virtual Machine", "Succeeded", { script });
  return { output: o.out.join("\n"), vm: updated };
}

function matchesGlob(path: string, glob: string) {
  if (!glob) return false;
  const re = new RegExp("^" + glob.replace(/[.+^${}()|[\]\\]/g, "\\$&").replace(/\*/g, ".*") + "$");
  return re.test(path);
}

function runWindows(p: Props, cmd: string, args: string[], line: string, o: Out) {
  const lc = cmd.toLowerCase();
  const nameArg = (args.find((_, i) => args[i - 1]?.toLowerCase() === "-name") ?? args.find((a) => !a.startsWith("-")) ?? "").replace(/['"]/g, "");
  if (lc === "get-service") {
    o.out.push("Status   Name");
    for (const [n, s] of Object.entries(p.services as Record<string, Props>)) if (!nameArg || n.toLowerCase() === nameArg.toLowerCase()) o.out.push(`${s.state === "running" ? "Running" : "Stopped"}  ${n}`);
  } else if (lc === "start-service" || lc === "restart-service") serviceCmd(p, "start", nameArg, o);
  else if (lc === "stop-service") serviceCmd(p, "stop", nameArg, o);
  else if (lc === "install-windowsfeature" && /web-server/i.test(line)) {
    p.services.W3SVC = { state: "running", enabled: true, port: 80 };
    o.out.push("Success Restart Needed Exit Code      Feature Result", "------- -------------- ---------      --------------", "True    No             Success        {Web Server (IIS)}");
    o.changed = true;
  } else if (lc === "get-process") {
    for (const x of p.processes ?? []) o.out.push(`${x.pid}  ${x.cpu}%  ${x.cmd}`);
    o.out.push("System Idle Process");
  } else if (lc === "stop-process") {
    const id = args.find((_, i) => args[i - 1]?.toLowerCase() === "-id");
    p.processes = (p.processes ?? []).filter((x: Props) => String(x.pid) !== id && x.cmd.toLowerCase() !== nameArg.toLowerCase());
    o.changed = true;
  } else if (lc === "hostname") o.out.push(p.computerName);
  else o.out.push(`${cmd}: not supported by the simulated run-command agent. Supported: Get-Service, Start-Service, Stop-Service, Restart-Service, Install-WindowsFeature Web-Server, Get-Process, Stop-Process, hostname`);
}

export async function vmView(ctx: Ctx, vm: Res) {
  const net = await vmNetwork(ctx, vm);
  const deps = await dependenciesOf(ctx, vm.id);
  return {
    privateIp: net.nic?.properties.privateIpAddress ?? null,
    publicIp: vm.properties.powerState === "VM deallocated" && net.pip?.properties.publicIPAllocationMethod === "Dynamic" ? null : net.pip?.properties.ipAddress ?? null,
    nic: net.nic && { id: net.nic.id, name: net.nic.name },
    vnet: net.vnet && { id: net.vnet.id, name: net.vnet.name },
    subnet: net.subnet?.name ?? null,
    nicNsg: net.nicNsg && { id: net.nicNsg.id, name: net.nicNsg.name },
    subnetNsg: net.subnetNsg && { id: net.subnetNsg.id, name: net.subnetNsg.name },
    disks: deps.filter((d) => d.resource.type === T.DISK).map((d) => ({ id: d.resource.id, name: d.resource.name, sizeGB: d.resource.properties.sizeGB, sku: d.resource.properties.sku, kind: d.kind })),
  };
}

export async function listVms(ctx: Ctx, resourceGroup?: string) {
  return listResources(ctx, { type: T.VM, resourceGroup });
}

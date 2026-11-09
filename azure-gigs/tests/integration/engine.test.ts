import { describe, it, expect } from "vitest";
import { newLearner } from "../helpers";
import { createByType, runAction, resourceDetail } from "@/lib/sim/registry";
import { T } from "@/lib/sim/types";
import { deleteResource, getById, listResources, getByName } from "@/lib/sim/engine";

describe("simulation engine", () => {
  it("creates RG, VNet, subnet, NSG, rule and VM with dependencies", async () => {
    const { ctx } = await newLearner();
    await createByType(ctx, T.RG, { name: "rg-demo", location: "eastus" });
    const vnet = await createByType(ctx, T.VNET, { resourceGroup: "rg-demo", name: "vnet-demo", addressPrefixes: ["10.10.0.0/16"] });
    await runAction(ctx, vnet, "addSubnet", { name: "snet-web", addressPrefix: "10.10.1.0/24" });
    const nsg = await createByType(ctx, T.NSG, { resourceGroup: "rg-demo", name: "nsg-web" });
    await runAction(ctx, nsg, "addRule", { name: "allow-http", priority: 200, destinationPortRange: "80", protocol: "Tcp", access: "Allow", direction: "Inbound" });
    const vm = await createByType(ctx, T.VM, { resourceGroup: "rg-demo", name: "vm-web-01", image: "Ubuntu2204", size: "Standard_B2s", vnetName: "vnet-demo", subnetName: "snet-web", nsgName: "nsg-web", installWebServer: true, generateSshKeys: true });
    const detail = await resourceDetail(ctx, vm);
    expect(detail.network?.privateIp).toBe("10.10.1.4");
    expect(detail.network?.nicNsg?.name).toBe("nsg-web");
    const conn = (await runAction(ctx, vm, "testConnectivity", { port: 80 })) as { reachable: boolean };
    expect(conn.reachable).toBe(true);

    // Deny rule with higher priority blocks traffic
    await runAction(ctx, await getById(ctx, nsg.id), "addRule", { name: "deny-http", priority: 150, destinationPortRange: "80", access: "Deny" });
    const conn2 = (await runAction(ctx, vm, "testConnectivity", { port: 80 })) as { reachable: boolean; hops: { detail: string }[] };
    expect(conn2.reachable).toBe(false);
    expect(conn2.hops.some((h) => h.detail.includes("deny-http"))).toBe(true);

    // Deleting the VNet is blocked while the NIC uses it
    await expect(deleteResource(ctx, await getById(ctx, vnet.id))).rejects.toThrow(/in use/);
    // Deleting the VM removes its NIC, disk and public IP
    await deleteResource(ctx, await getById(ctx, vm.id));
    const left = await listResources(ctx, { resourceGroup: "rg-demo" });
    expect(left.map((r) => r.type).sort()).toEqual([T.NSG, T.RG, T.VNET].sort());
    // RG requires cascade
    const rg = await getByName(ctx, T.RG, "rg-demo", "rg-demo");
    await expect(deleteResource(ctx, rg)).rejects.toThrow(/contains/);
    await deleteResource(ctx, rg, { cascade: true });
    expect(await listResources(ctx, { resourceGroup: "rg-demo" })).toHaveLength(0);
  });

  it("isolates tenants", async () => {
    const a = await newLearner("Learner A");
    const b = await newLearner("Learner B");
    const rg = await createByType(a.ctx, T.RG, { name: "rg-private", location: "westeurope" });
    await expect(getById(b.ctx, rg.id)).rejects.toThrow(/not found/);
    expect((await listResources(b.ctx, { type: T.RG })).length).toBe(0);
  });
});

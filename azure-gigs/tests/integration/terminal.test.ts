import { describe, it, expect } from "vitest";
import { newLearner } from "../helpers";
import { runTerminal } from "@/lib/terminal";
import { listResources } from "@/lib/sim/engine";
import { T } from "@/lib/sim/types";

describe("terminal", () => {
  it("requires az login, then creates resources that persist", async () => {
    const { ctx } = await newLearner();
    const r0 = await runTerminal(ctx, "az", "az group list");
    expect(r0.exitCode).toBe(1);
    expect(r0.stderr).toMatch(/az login/);
    expect((await runTerminal(ctx, "az", "az login")).exitCode).toBe(0);
    const r1 = await runTerminal(ctx, "az", "az group create -n rg-cli -l eastus --tags env=dev owner=learner");
    expect(r1.exitCode).toBe(0);
    expect(JSON.parse(r1.stdout).tags).toEqual({ env: "dev", owner: "learner" });
    const r2 = await runTerminal(ctx, "az", "az group list --query \"[].name\" -o tsv");
    expect(r2.stdout.trim()).toBe("rg-cli");
    const r3 = await runTerminal(ctx, "az", "az vm create -g rg-cli -n vm1 --image Ubuntu2204 --size Standard_B1s --generate-ssh-keys");
    expect(r3.exitCode).toBe(0);
    expect(JSON.parse(r3.stdout).privateIpAddress).toBe("10.0.0.4");
    const vms = await listResources(ctx, { type: T.VM });
    expect(vms).toHaveLength(1);
    const r4 = await runTerminal(ctx, "az", "az vm stop -g rg-cli -n vm1");
    expect(r4.exitCode).toBe(0);
    const r5 = await runTerminal(ctx, "az", "az vm list -d -o table");
    expect(r5.stdout).toMatch(/VM stopped/);
    const r6 = await runTerminal(ctx, "az", "az vm show -g rg-cli -n nope");
    expect(r6.exitCode).toBe(3);
    const r7 = await runTerminal(ctx, "az", "az group delete -n rg-cli");
    expect(r7.exitCode).toBe(1);
    expect(r7.stderr).toMatch(/--yes/);
    expect((await runTerminal(ctx, "az", "az group delete -n rg-cli --yes")).exitCode).toBe(0);
    expect(await listResources(ctx, { type: T.VM })).toHaveLength(0);
  });

  it("enforces RBAC when signed in as a directory user", async () => {
    const { ctx } = await newLearner();
    await runTerminal(ctx, "az", "az login");
    await runTerminal(ctx, "az", "az group create -n rg-rbac -l westeurope");
    await runTerminal(ctx, "az", "az role assignment create --assignee sneha.kulkarni --role Reader --resource-group rg-rbac");
    expect((await runTerminal(ctx, "az", "az login --username sneha.kulkarni")).exitCode).toBe(0);
    expect((await runTerminal(ctx, "az", "az network vnet list -g rg-rbac")).exitCode).toBe(0);
    const denied = await runTerminal(ctx, "az", "az network vnet create -g rg-rbac -n vnet1");
    expect(denied.exitCode).toBe(1);
    expect(denied.stderr).toMatch(/AuthorizationFailed/);
  });

  it("supports bash with a virtual filesystem, pipes and redirection", async () => {
    const { ctx } = await newLearner();
    await runTerminal(ctx, "bash", "mkdir -p projects/app && cd projects/app");
    const pwd = await runTerminal(ctx, "bash", "pwd");
    expect(pwd.stdout).toBe("/home/learner/projects/app");
    await runTerminal(ctx, "bash", "echo hello azure > notes.txt && echo second line >> notes.txt");
    expect((await runTerminal(ctx, "bash", "cat notes.txt | grep -c line")).stdout).toBe("1");
    expect((await runTerminal(ctx, "bash", "wc -l notes.txt")).stdout).toMatch(/^2/);
    await runTerminal(ctx, "bash", "chmod 600 notes.txt");
    expect((await runTerminal(ctx, "bash", "ls -l")).stdout).toMatch(/-rw------- .* notes.txt/);
    expect((await runTerminal(ctx, "bash", "rm /etc/hostname")).exitCode).not.toBe(0);
    expect((await runTerminal(ctx, "bash", "nonexistentcmd")).exitCode).toBe(127);
    expect((await runTerminal(ctx, "bash", "systemctl start nginx && systemctl is-active nginx")).stdout).toBe("active");
  });

  it("supports PowerShell cmdlets and pipelines", async () => {
    const { ctx } = await newLearner();
    expect((await runTerminal(ctx, "pwsh", "Get-AzResourceGroup")).stderr).toMatch(/Connect-AzAccount/);
    await runTerminal(ctx, "pwsh", "Connect-AzAccount");
    expect((await runTerminal(ctx, "pwsh", "New-AzResourceGroup -Name rg-ps -Location eastus")).exitCode).toBe(0);
    await runTerminal(ctx, "pwsh", "New-AzResourceGroup -Name rg-ps2 -Location westus2");
    const r = await runTerminal(ctx, "pwsh", "Get-AzResourceGroup | Where-Object { $_.Location -eq 'westus2' } | Select-Object ResourceGroupName");
    expect(r.stdout).toMatch(/rg-ps2/);
    expect(r.stdout).not.toMatch(/rg-ps\b/);
  });

  it("records command history with exit codes", async () => {
    const { ctx } = await newLearner();
    await runTerminal(ctx, "az", "az login");
    await runTerminal(ctx, "az", "az nonsense");
    const { prisma } = await import("@/lib/db");
    const h = await prisma.commandHistory.findMany({ where: { userId: ctx.userId }, orderBy: { createdAt: "asc" } });
    expect(h.map((x) => x.exitCode)).toEqual([0, 2]);
  });
});

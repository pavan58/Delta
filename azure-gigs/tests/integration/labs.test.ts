import { describe, it, expect } from "vitest";
import { newLearner } from "../helpers";
import { createByType, runAction } from "@/lib/sim/registry";
import { T } from "@/lib/sim/types";
import { getById, listResources, findByName } from "@/lib/sim/engine";
import { startLab, submitLab } from "@/lib/labs/grader";
import { injectIncident, resolveIncident, takeHint, FAULTS } from "@/lib/labs/incidents";
import { runTerminal } from "@/lib/terminal";
import { dashboard, submitAssessment, issueCertificate, pathProgress } from "@/lib/labs/progress";
import { prisma } from "@/lib/db";

describe("labs, grading and incidents", () => {
  it("runs the MVP end-to-end scenario: build, inject NSG fault, diagnose, fix, verify, submit, score", async () => {
    const { ctx } = await newLearner();
    await startLab(ctx, "web-vm-nsg-troubleshooting");
    // Build
    await createByType(ctx, T.RG, { name: "rg-demo", location: "eastus", tags: { env: "dev" } });
    const vnet = await createByType(ctx, T.VNET, { resourceGroup: "rg-demo", name: "vnet-demo", addressPrefixes: ["10.1.0.0/16"] });
    await runAction(ctx, vnet, "addSubnet", { name: "snet-web", addressPrefix: "10.1.1.0/24" });
    const nsg = await createByType(ctx, T.NSG, { resourceGroup: "rg-demo", name: "nsg-demo-web" });
    await runAction(ctx, nsg, "addRule", { name: "allow-http", priority: 200, destinationPortRange: "80", protocol: "Tcp", sourceAddressPrefix: "Internet" });
    await createByType(ctx, T.VM, { resourceGroup: "rg-demo", name: "vm-web-01", image: "Ubuntu2204", size: "Standard_B2s", vnetName: "vnet-demo", subnetName: "snet-web", nsgName: "nsg-demo-web", installWebServer: true, generateSshKeys: true });
    // CLI
    await runTerminal(ctx, "az", "az login");
    const show = await runTerminal(ctx, "az", "az vm show -g rg-demo -n vm-web-01 -d -o json");
    expect(JSON.parse(show.stdout).powerState).toBe("VM running");

    // Inject
    const inc = await injectIncident(ctx, "nsg-deny-http");
    expect(inc.targetResourceId).toBeTruthy();
    const vm = (await findByName(ctx, T.VM, "rg-demo", "vm-web-01"))!;
    expect(inc.targetResourceId).toBe(vm.id); // reuses the learner's VM
    const broken = (await runAction(ctx, vm, "testConnectivity", { port: 80 })) as { reachable: boolean };
    expect(broken.reachable).toBe(false);

    // Premature resolution is rejected
    const early = await resolveIncident(ctx, inc.id, { rootCause: "unknown", fixSummary: "none", verification: "none" });
    expect(early.resolved).toBe(false);

    // Diagnose
    const rules = await runTerminal(ctx, "az", "az network nsg rule list -g rg-demo --nsg-name nsg-demo-web -o table");
    expect(rules.stdout).toMatch(/Harden-DenyHTTP-Inbound/);
    await runTerminal(ctx, "az", "az network watcher test-connectivity -g rg-demo --dest-resource vm-web-01 --dest-port 80");
    // Fix
    const fix = await runTerminal(ctx, "az", "az network nsg rule delete -g rg-demo --nsg-name nsg-demo-web -n Harden-DenyHTTP-Inbound");
    expect(fix.exitCode).toBe(0);
    // Verify
    const verify = await runTerminal(ctx, "az", "az network watcher test-connectivity -g rg-demo --dest-resource vm-web-01 --dest-port 80");
    expect(JSON.parse(verify.stdout).connectionStatus).toBe("Reachable");
    const res = await resolveIncident(ctx, inc.id, {
      rootCause: "A Deny rule 'Harden-DenyHTTP-Inbound' for TCP 80 was added to the NSG with priority 110, which is evaluated before allow-http (200).",
      fixSummary: "Deleted the deny rule after confirming with the security team that HTTP must stay open for the redirect to HTTPS.",
      verification: "Network Watcher connectivity check from Internet to vm-web-01:80 now returns Reachable.",
    });
    expect(res.resolved).toBe(true);
    expect(res.score).toBeGreaterThanOrEqual(80);

    // Submit the lab
    const graded = await submitLab(ctx, "web-vm-nsg-troubleshooting", { notes: "Built the web tier behind nsg-demo-web. The incident was a deny rule at a lower priority number than allow-http; I removed it and verified port 80 with a connectivity check." });
    expect(graded.results.filter((r) => !r.passed)).toEqual([]);
    expect(graded.total).toBe(100);
    expect(graded.passed).toBe(true);
    const progress = await prisma.userProgress.findFirst({ where: { userId: ctx.userId, lab: { slug: "web-vm-nsg-troubleshooting" } } });
    expect(progress?.status).toBe("completed");
    expect(progress?.bestScore).toBe(100);
    const d = await dashboard(ctx.userId);
    expect(d.labs.completed).toBe(1);
    expect(d.incidents.resolved).toBe(1);
  });

  it("gives partial credit and hints for incomplete work", async () => {
    const { ctx } = await newLearner();
    await startLab(ctx, "create-resource-group");
    await createByType(ctx, T.RG, { name: "rg-web-dev", location: "westus2" });
    const g = await submitLab(ctx, "create-resource-group", { notes: "" });
    expect(g.passed).toBe(false);
    expect(g.total).toBeLessThan(70);
    const failed = g.results.filter((r) => !r.passed).map((r) => r.label);
    expect(failed).toContain("rg-web-dev is in East US");
    expect(failed).toContain("rg-web-dev has env=dev tag");
  });

  it("rejects submissions for labs not started", async () => {
    const { ctx } = await newLearner();
    await expect(submitLab(ctx, "create-first-vm", { notes: "x" })).rejects.toThrow(/Start the lab/);
  });

  it("injects and verifies every fault type", async () => {
    const { ctx } = await newLearner();
    for (const type of Object.keys(FAULTS)) {
      const inc = await injectIncident(ctx, type);
      const r = await resolveIncident(ctx, inc.id, { rootCause: "x", fixSummary: "y", verification: "z" });
      expect(r.resolved, `${type} should not be resolved before fixing`).toBe(false);
      await prisma.incident.update({ where: { id: inc.id }, data: { status: "Abandoned" } });
    }
  }, 60000);

  it("resolves disk-full via run-command and expired-secret via a new secret version", async () => {
    const { ctx } = await newLearner();
    const disk = await injectIncident(ctx, "disk-full");
    const vm = await getById(ctx, disk.targetResourceId!);
    await takeHint(ctx, disk.id);
    await runTerminal(ctx, "az", "az login");
    await runTerminal(ctx, "az", `az vm run-command invoke -g ${vm.resourceGroup} -n ${vm.name} --command-id RunShellScript --scripts "df -h"`);
    await runTerminal(ctx, "az", `az vm run-command invoke -g ${vm.resourceGroup} -n ${vm.name} --command-id RunShellScript --scripts "rm /var/log/app/debug.log*; systemctl restart nginx"`);
    await runTerminal(ctx, "az", `az network watcher test-connectivity -g ${vm.resourceGroup} --dest-resource ${vm.name} --dest-port 80`);
    const r = await resolveIncident(ctx, disk.id, { rootCause: "Debug logs filled the OS disk to 100% so nginx could not write logs (no space left on device).", fixSummary: "Removed /var/log/app/debug.log* and restarted nginx.", verification: "df shows 18% used, connectivity check on port 80 reachable." });
    expect(r.resolved).toBe(true);
    expect(r.breakdown.hintPenalty).toBe(-5);

    const sec = await injectIncident(ctx, "expired-secret");
    const kv = (await listResources(ctx, { type: T.KEYVAULT }))[0];
    await runTerminal(ctx, "az", `az keyvault secret set --vault-name ${kv.name} -n PaymentApiKey --value pk_live_rotated`);
    const r2 = await resolveIncident(ctx, sec.id, { rootCause: "The PaymentApiKey secret version expired so the Key Vault reference failed.", fixSummary: "Created a new secret version without a past expiry.", verification: "Browsed the app: HTTP 200." });
    expect(r2.resolved).toBe(true);
  }, 60000);

  it("grades assessments and issues certificates only when eligible", async () => {
    const { ctx } = await newLearner();
    const a = await prisma.assessment.findUniqueOrThrow({ where: { slug: "az-900-fundamentals-assessment" } });
    const qs = a.questions as { answer: number }[];
    const res = await submitAssessment(ctx.userId, a.slug, { answers: qs.map((q) => q.answer) });
    expect(res.score).toBe(100);
    await expect(issueCertificate(ctx.userId, "az-900-fundamentals")).rejects.toThrow(/80%/);
    // Mark all path labs completed to become eligible
    const p = await pathProgress(ctx.userId, "az-900-fundamentals");
    for (const m of p.modules) for (const l of m.labs) {
      const lab = await prisma.lab.findUniqueOrThrow({ where: { slug: l.slug } });
      await prisma.userProgress.upsert({ where: { userId_labId: { userId: ctx.userId, labId: lab.id } }, create: { userId: ctx.userId, labId: lab.id, status: "completed", bestScore: 90 }, update: { status: "completed" } });
    }
    const cert = await issueCertificate(ctx.userId, "az-900-fundamentals");
    expect(cert.certificateId).toMatch(/^AG-[0-9A-F]{12}$/);
    const again = await issueCertificate(ctx.userId, "az-900-fundamentals");
    expect(again.certificateId).toBe(cert.certificateId);
  });
});

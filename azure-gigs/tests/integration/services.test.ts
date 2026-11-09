import { describe, it, expect } from "vitest";
import { newLearner } from "../helpers";
import { createByType, runAction } from "@/lib/sim/registry";
import { T } from "@/lib/sim/types";
import { getById, deleteResource } from "@/lib/sim/engine";
import { runTerminal } from "@/lib/terminal";
import { runKqlForUser } from "@/lib/sim/kqlRun";
import { evaluateAlerts, costSummary } from "@/lib/sim/services/monitor";
import { checkAccess } from "@/lib/sim/services/rbac";

describe("service simulations", () => {
  it("storage: containers, blobs, tiers, firewall and access tests", async () => {
    const { ctx } = await newLearner();
    await createByType(ctx, T.RG, { name: "rg-s", location: "eastus" });
    const sa = await createByType(ctx, T.STORAGE, { resourceGroup: "rg-s", name: `st${Date.now().toString(36)}` });
    await runAction(ctx, sa, "createContainer", { name: "docs" });
    await expect(runAction(ctx, await getById(ctx, sa.id), "createContainer", { name: "pub", publicAccess: "blob" })).rejects.toThrow(/Public access is not permitted/);
    await runAction(ctx, await getById(ctx, sa.id), "uploadBlob", { container: "docs", name: "a.txt", content: "hello" });
    await runAction(ctx, await getById(ctx, sa.id), "setBlobTier", { container: "docs", name: "a.txt", tier: "Archive" });
    const { downloadBlob } = await import("@/lib/sim/services/storage");
    await expect(downloadBlob(ctx, await getById(ctx, sa.id), "docs", "a.txt")).rejects.toThrow(/archived/);
    await runAction(ctx, await getById(ctx, sa.id), "updateConfig", { networkDefaultAction: "Deny", ipRules: ["203.0.113.50"] });
    const denied = (await runAction(ctx, await getById(ctx, sa.id), "testAccess", { container: "docs", method: "accountKey", clientIp: "198.51.100.1" })) as { allowed: boolean };
    expect(denied.allowed).toBe(false);
    const allowed = (await runAction(ctx, await getById(ctx, sa.id), "testAccess", { container: "docs", method: "accountKey", clientIp: "203.0.113.50" })) as { allowed: boolean };
    expect(allowed.allowed).toBe(true);
  });

  it("SQL sandbox: queries, writes persist, dangerous statements and runaway queries are blocked", async () => {
    const { ctx } = await newLearner();
    await createByType(ctx, T.RG, { name: "rg-sql", location: "eastus" });
    await createByType(ctx, T.SQL_SERVER, { resourceGroup: "rg-sql", name: `sql-${Date.now().toString(36)}`, adminLogin: "dbadminuser", adminPassword: "Str0ng!Passw0rd" });
    const server = (await (await import("@/lib/sim/engine")).listResources(ctx, { type: T.SQL_SERVER }))[0];
    const db = await createByType(ctx, T.SQL_DB, { resourceGroup: "rg-sql", serverName: server.name, name: "salesdb" });
    const r = (await runAction(ctx, db, "query", { sql: "SELECT COUNT(*) AS n FROM Customers WHERE Tier = 'Gold'" })) as { ok: boolean; rows: { n: number }[] };
    expect(r.rows[0].n).toBe(2);
    await runAction(ctx, await getById(ctx, db.id), "query", { sql: "INSERT INTO Customers VALUES (7,'Contoso','Pune','Gold','2026-01-01')" });
    const r2 = (await runAction(ctx, await getById(ctx, db.id), "query", { sql: "SELECT COUNT(*) AS n FROM Customers WHERE Tier = 'Gold'" })) as { rows: { n: number }[] };
    expect(r2.rows[0].n).toBe(3);
    await expect(runAction(ctx, await getById(ctx, db.id), "query", { sql: "ATTACH DATABASE '/etc/passwd' AS x" })).rejects.toThrow(/not allowed/);
    const loop = (await runAction(ctx, await getById(ctx, db.id), "query", { sql: "WITH RECURSIVE c(x) AS (SELECT 1 UNION ALL SELECT x+1 FROM c) SELECT COUNT(*) FROM c" })) as { ok: boolean; error: string };
    expect(loop.ok).toBe(false);
    expect(loop.error).toMatch(/timeout/i);
  }, 20000);

  it("functions: keys, templates and invocation logs", async () => {
    const { ctx } = await newLearner();
    await createByType(ctx, T.RG, { name: "rg-f", location: "eastus" });
    const sa = await createByType(ctx, T.STORAGE, { resourceGroup: "rg-f", name: `stf${Date.now().toString(36)}` });
    const fa = await createByType(ctx, T.FUNCTION_APP, { resourceGroup: "rg-f", name: `func-${Date.now().toString(36)}`, storageAccount: sa.name });
    const withFn = (await runAction(ctx, fa, "createFunction", { name: "Calc", template: "HttpCalculator" })) as { properties: { functions: { key: string }[] } };
    const key = withFn.properties.functions[0].key;
    const unauth = (await runAction(ctx, await getById(ctx, fa.id), "invoke", { name: "Calc", query: { a: "2", b: "3" } })) as { status: number };
    expect(unauth.status).toBe(401);
    const ok = (await runAction(ctx, await getById(ctx, fa.id), "invoke", { name: "Calc", query: { a: "2", b: "3" }, key })) as { status: number; body: string };
    expect(ok.status).toBe(200);
    expect(JSON.parse(ok.body).sum).toBe(5);
    await deleteResource(ctx, await getById(ctx, sa.id), { cascade: true }).catch(() => undefined);
  });

  it("DevOps: YAML pipeline deploys to App Service and fails on bad service connections", async () => {
    const { ctx } = await newLearner();
    await createByType(ctx, T.RG, { name: "rg-d", location: "eastus" });
    await createByType(ctx, T.PLAN, { resourceGroup: "rg-d", name: "plan-d" });
    const site = await createByType(ctx, T.SITE, { resourceGroup: "rg-d", name: `app-${Date.now().toString(36)}`, planName: "plan-d" });
    let proj = await createByType(ctx, T.DEVOPS_PROJECT, { resourceGroup: "rg-d", organization: "contoso", name: "demo" });
    const yaml = `trigger:\n  branches:\n    include: [main]\nstages:\n  - stage: Build\n    jobs:\n      - job: B\n        steps:\n          - script: npm ci\n          - script: npm test\n  - stage: Deploy\n    jobs:\n      - job: D\n        steps:\n          - task: AzureWebApp@1\n            inputs:\n              azureSubscription: azure-prod\n              appName: ${site.name}\n              package: todo-api\n`;
    await runAction(ctx, proj, "commitFile", { path: "azure-pipelines.yml", content: yaml, message: "pipeline" });
    await runAction(ctx, await getById(ctx, proj.id), "createPipeline", { name: "ci" });
    let run = (await runAction(ctx, await getById(ctx, proj.id), "runPipeline", { pipeline: "ci" })) as { status: string; errorSummary: string };
    expect(run.status).toBe("failed");
    expect(run.errorSummary).toMatch(/service connection 'azure-prod'/);
    await runAction(ctx, await getById(ctx, proj.id), "addServiceConnection", { name: "azure-prod", type: "AzureRM" });
    run = (await runAction(ctx, await getById(ctx, proj.id), "runPipeline", { pipeline: "ci" })) as { status: string; errorSummary: string };
    expect(run.status).toBe("succeeded");
    expect((await getById(ctx, site.id)).properties.activePackage).toBe("todo-api");
    proj = await getById(ctx, proj.id);
    // CI trigger on push
    const pushed = (await runAction(ctx, proj, "commitFile", { path: "README.md", content: "x", message: "docs" })) as { triggered: { status: string }[] };
    expect(pushed.triggered[0].status).toBe("succeeded");
  });

  it("AKS + kubectl: ImagePullBackOff until ACR is attached", async () => {
    const { ctx } = await newLearner();
    await runTerminal(ctx, "bash", "az login");
    await runTerminal(ctx, "bash", "az group create -n rg-k -l eastus");
    const acrName = `acr${Date.now().toString(36)}`;
    await runTerminal(ctx, "bash", `az acr create -g rg-k -n ${acrName}`);
    expect((await runTerminal(ctx, "bash", `az acr build -r ${acrName} -t web:v1 --file Dockerfile`)).exitCode).toBe(0);
    await runTerminal(ctx, "bash", "az aks create -g rg-k -n aks1 --node-count 2");
    await runTerminal(ctx, "bash", "az aks get-credentials -g rg-k -n aks1");
    await runTerminal(ctx, "bash", `kubectl create deployment web --image=${acrName}.azurecr.sim/web:v1 --replicas=2`);
    expect((await runTerminal(ctx, "bash", "kubectl get pods")).stdout).toMatch(/ImagePullBackOff/);
    await runTerminal(ctx, "bash", `az aks update -g rg-k -n aks1 --attach-acr ${acrName}`);
    const pods = await runTerminal(ctx, "bash", "kubectl get pods | grep -c Running");
    expect(pods.stdout.trim()).toBe("2");
    expect((await runTerminal(ctx, "bash", "kubectl rollout status deployment/web")).stdout).toMatch(/successfully rolled out/);
  });

  it("KQL runs on the learner's data and is recorded; alerts and costs work", async () => {
    const { ctx } = await newLearner();
    await createByType(ctx, T.RG, { name: "rg-m", location: "eastus" });
    const vm = await createByType(ctx, T.VM, { resourceGroup: "rg-m", name: "vm-mon", generateSshKeys: true });
    const r = await runKqlForUser(ctx, "Heartbeat | summarize count() by Computer");
    expect(r.ok && r.rows.map((x) => x.Computer)).toEqual(["vm-mon"]);
    await createByType(ctx, T.ALERT, { resourceGroup: "rg-m", name: "down", targetResourceId: vm.id, metric: "Percentage CPU", operator: "LessThan", threshold: 1, windowMinutes: 4 });
    await runAction(ctx, await getById(ctx, vm.id), "deallocate", {});
    const alerts = await evaluateAlerts(ctx);
    expect(alerts[0].state).toBe("Fired");
    const cost = await costSummary(ctx);
    expect(cost.items.find((i) => i.name === "vm-mon")?.monthly).toBe(0);
  });

  it("RBAC: group membership grants inherited access", async () => {
    const { ctx } = await newLearner();
    await createByType(ctx, T.RG, { name: "rg-r", location: "eastus" });
    await createByType(ctx, T.ROLE_ASSIGNMENT, { principal: "Cloud Operations", role: "Virtual Machine Contributor", scope: "/resourceGroups/rg-r" });
    expect((await checkAccess(ctx, "arjun.mehta", "Microsoft.Compute/virtualMachines/write", "/resourceGroups/rg-r/providers/Microsoft.Compute/virtualMachines/vm1")).allowed).toBe(true);
    expect((await checkAccess(ctx, "priya.nair", "Microsoft.Compute/virtualMachines/write", "/resourceGroups/rg-r")).allowed).toBe(false);
  });
});

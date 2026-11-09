/** App Service, Azure Functions and Azure SQL simulation. */
import { z } from "zod";
import { badRequest, conflict, notFound, forbidden } from "@/lib/errors";
import { createResource, Ctx, fakeGuid, findAnyByName, findByName, getById, listResources, logActivity, mutate, Props, Res, addDependency } from "../engine";
import { APP_RUNTIMES, PLAN_SKUS, SQL_SKUS } from "../catalog";
import { T } from "../types";
import { getSecret } from "./keyvault";
import { ensureManagedIdentity } from "./rbac";
import { runSql, SAMPLE_SCHEMA } from "./sqlsandbox";
import { randomBytes } from "node:crypto";
import { ipToInt } from "../net";

// ---------------- App Service plans & web apps ----------------

export async function createPlan(ctx: Ctx, raw: unknown) {
  const input = z.object({ resourceGroup: z.string().min(1), name: z.string().min(1).max(60), location: z.string().optional(), sku: z.string().default("B1"), os: z.enum(["Linux", "Windows"]).default("Linux"), tags: z.record(z.string(), z.string()).optional() }).parse(raw);
  const sku = PLAN_SKUS.find((s) => s.name.toLowerCase() === input.sku.toLowerCase());
  if (!sku) throw badRequest("InvalidSku", `Plan SKU '${input.sku}' is invalid. Use one of: ${PLAN_SKUS.map((s) => s.name).join(", ")}.`);
  return createResource(ctx, { type: T.PLAN, resourceGroup: input.resourceGroup, name: input.name, location: input.location, tags: input.tags, properties: { sku: sku.name, tier: sku.tier, os: input.os, numberOfWorkers: 1, maxWorkers: sku.name === "F1" ? 1 : sku.name === "B1" ? 3 : 10 } });
}

export const siteSchema = z.object({
  resourceGroup: z.string().min(1),
  name: z.string().min(2).max(60),
  planName: z.string().min(1),
  runtime: z.string().default("NODE|20-lts"),
  location: z.string().optional(),
  httpsOnly: z.boolean().default(true),
  identity: z.boolean().default(false),
  tags: z.record(z.string(), z.string()).optional(),
});

export async function createSite(ctx: Ctx, raw: unknown) {
  const input = siteSchema.parse(raw);
  if (!APP_RUNTIMES.includes(input.runtime)) throw badRequest("InvalidRuntime", `Runtime '${input.runtime}' is not supported. Use one of: ${APP_RUNTIMES.join(", ")}.`);
  const plan = (await findByName(ctx, T.PLAN, input.resourceGroup, input.planName)) ?? (await findAnyByName(ctx, T.PLAN, input.planName));
  if (!plan) throw notFound(`App Service plan '${input.planName}' was not found.`);
  if (await findAnyByName(ctx, T.FUNCTION_APP, input.name)) throw conflict("NameNotAvailable", `Hostname '${input.name}' is already used by a function app.`);
  const location = input.location ?? plan.location;
  if (location !== plan.location) throw badRequest("InvalidLocation", `The web app must be in the same region as its plan (${plan.location}).`);
  const site = await createResource(ctx, {
    type: T.SITE,
    resourceGroup: input.resourceGroup,
    name: input.name,
    location,
    tags: input.tags,
    properties: {
      kind: "app",
      planId: plan.id,
      planName: plan.name,
      runtime: input.runtime,
      state: "Running",
      defaultHostName: `${input.name.toLowerCase()}.sim-apps.azuregigs.local`,
      httpsOnly: input.httpsOnly,
      appSettings: {} as Record<string, string>,
      connectionStrings: {} as Record<string, string>,
      identity: input.identity ? { type: "SystemAssigned", principalName: `${input.name.toLowerCase()}@msi` } : null,
      deployments: [] as Props[],
      logs: [] as string[],
      healthCheckPath: null,
      alwaysOn: plan.properties.sku !== "F1",
    },
    dependsOn: [{ toId: plan.id, kind: "plan" }],
  });
  if (input.identity) await ensureManagedIdentity(ctx, site);
  return site;
}

function appendLogs(p: Props, lines: string[]) {
  const ts = new Date().toISOString();
  p.logs = [...(p.logs ?? []), ...lines.map((l) => `${ts} ${l}`)].slice(-200);
}

const SAMPLE_APPS: Record<string, { files: number; build: string[]; startup: string }> = {
  "hello-node": { files: 14, build: ["npm ci --production", "added 57 packages in 3.2s"], startup: "node server.js" },
  "todo-api": { files: 42, build: ["npm ci", "added 212 packages in 7.9s", "npm run build", "tsc -p . (0 errors)"], startup: "node dist/index.js" },
  "flask-hello": { files: 9, build: ["python -m pip install -r requirements.txt", "Successfully installed Flask-3.0.3 gunicorn-22.0"], startup: "gunicorn app:app" },
  "dotnet-weather": { files: 27, build: ["dotnet publish -c Release", "WeatherApi -> /home/site/wwwroot"], startup: "dotnet WeatherApi.dll" },
};
export const SAMPLE_APP_NAMES = Object.keys(SAMPLE_APPS);

export async function deploySite(ctx: Ctx, site: Res, raw: unknown) {
  const input = z.object({ package: z.string().default("hello-node"), source: z.string().default("Zip deploy"), commit: z.string().optional(), imageTag: z.string().optional() }).parse(raw);
  const app = SAMPLE_APPS[input.package];
  const id = fakeGuid().slice(0, 8);
  const log: string[] = [`Deployment ${id} started (${input.source})`, `Package: ${input.package}${input.commit ? ` @ ${input.commit}` : ""}`];
  let status = "Success";
  if (!app) {
    status = "Failed";
    log.push(`ERROR: Package '${input.package}' not found. Available sample apps: ${SAMPLE_APP_NAMES.join(", ")}`);
  } else {
    const rtFamily = site.properties.runtime.split("|")[0];
    const appFamily = input.package.includes("flask") ? "PYTHON" : input.package.includes("dotnet") ? "DOTNETCORE" : "NODE";
    log.push(`Copying ${app.files} files to /home/site/wwwroot`, "Running Oryx build...", ...app.build.map((b) => `  ${b}`));
    if (rtFamily !== appFamily) {
      status = "Failed";
      log.push(`ERROR: Oryx could not detect a ${rtFamily} application. The package looks like a ${appFamily} app; change the runtime stack or deploy a matching package.`);
    } else log.push(`Startup command: ${app.startup}`, "Deployment successful.");
  }
  const updated = await mutate(ctx, site, (p) => {
    p.deployments = [{ id, status, time: new Date().toISOString(), source: input.source, package: input.package, commit: input.commit ?? null, log }, ...p.deployments].slice(0, 30);
    if (status === "Success") p.activePackage = input.package;
    appendLogs(p, status === "Success" ? [`Container ${site.name}_0 started for site ${site.name}`, `Site started. Listening on port 8080`] : [`Deployment ${id} failed`]);
  }, "Deploy Web App", { deploymentId: id, status });
  if (status !== "Success") await logActivity(ctx, site, "Deploy Web App", "Failed", { deploymentId: id });
  return { deployment: updated.properties.deployments[0], site: updated };
}

export async function siteAction(ctx: Ctx, site: Res, action: "start" | "stop" | "restart") {
  return mutate(ctx, site, (p) => {
    p.state = action === "stop" ? "Stopped" : "Running";
    appendLogs(p, [action === "stop" ? "Site stopped" : `Site ${action === "restart" ? "restarted" : "started"}`]);
    p.restartedAt = new Date().toISOString();
  }, `${action[0].toUpperCase()}${action.slice(1)} Web App`);
}

export async function setAppSettings(ctx: Ctx, site: Res, raw: unknown) {
  const input = z.object({ settings: z.record(z.string().regex(/^[A-Za-z0-9_.:-]{1,128}$/, "Invalid setting name"), z.string().max(4000)), remove: z.array(z.string()).optional() }).parse(raw);
  return mutate(ctx, site, (p) => {
    Object.assign(p.appSettings, input.settings);
    for (const k of input.remove ?? []) delete p.appSettings[k];
    appendLogs(p, ["App settings updated; site restarting"]);
  }, "Update Application Settings", { keys: [...Object.keys(input.settings), ...(input.remove ?? []).map((k) => `-${k}`)] });
}

export async function setIdentity(ctx: Ctx, site: Res, enabled: boolean) {
  if (enabled) await ensureManagedIdentity(ctx, site);
  else {
    const sp = await findByName(ctx, T.ENTRA_SP, "", `${site.name.toLowerCase()}@msi`);
    if (sp) await (await import("../engine")).deleteResource(ctx, sp, { cascade: true });
  }
  return mutate(ctx, site, (p) => {
    p.identity = enabled ? { type: "SystemAssigned", principalName: `${site.name.toLowerCase()}@msi` } : null;
  }, enabled ? "Enable System Assigned Identity" : "Disable System Assigned Identity");
}

/** Resolves app settings (Key Vault references, SQL connection) the way the platform would on startup. */
async function resolveSettings(ctx: Ctx, site: Res): Promise<{ ok: boolean; errors: string[] }> {
  const errors: string[] = [];
  for (const [k, v] of Object.entries(site.properties.appSettings as Record<string, string>)) {
    const kvRef = /^@Microsoft\.KeyVault\(VaultName=([^;]+);SecretName=([^;)]+)\)$/i.exec(v);
    if (kvRef) {
      const kv = await findAnyByName(ctx, T.KEYVAULT, kvRef[1]);
      if (!kv) errors.push(`${k}: Key Vault reference failed - vault '${kvRef[1]}' not found.`);
      else if (!site.properties.identity) errors.push(`${k}: Key Vault reference failed - the app has no managed identity.`);
      else {
        try {
          await getSecret(ctx, kv, { name: kvRef[2], principal: site.properties.identity.principalName });
        } catch (e) {
          errors.push(`${k}: Key Vault reference failed - ${(e as Error).message}`);
        }
      }
    }
    const sqlRef = /Server=tcp:([a-z0-9-]+)\.database/i.exec(v);
    if (sqlRef) {
      const server = await findAnyByName(ctx, T.SQL_SERVER, sqlRef[1]);
      if (!server) errors.push(`${k}: A network-related error occurred while establishing a connection to SQL Server '${sqlRef[1]}' (server not found).`);
      else if (server.properties.publicNetworkAccess === "Disabled" || !server.properties.allowAzureServices) {
        errors.push(`${k}: Cannot open server '${server.name}' requested by the login. Client with IP address '20.111.4.9' is not allowed to access the server (firewall).`);
      }
      const dbName = /Initial Catalog=([^;]+)|Database=([^;]+)/i.exec(v);
      if (server && dbName) {
        const db = await findAnyByName(ctx, T.SQL_DB, `${server.name}/${dbName[1] ?? dbName[2]}`);
        if (!db) errors.push(`${k}: Cannot open database '${dbName[1] ?? dbName[2]}' requested by the login. The login failed.`);
      }
    }
  }
  return { ok: errors.length === 0, errors };
}

/** Simulates an HTTP request to the web app's default hostname. */
export async function browseSite(ctx: Ctx, site: Res, path = "/") {
  const fresh = await getById(ctx, site.id);
  const p = fresh.properties;
  let status = 200;
  let body = "";
  const plan = p.planId ? await getById(ctx, p.planId).catch(() => null) : null;
  if (!plan) {
    status = 503;
    body = "Service Unavailable: the App Service plan for this app no longer exists.";
  } else if (p.state === "Stopped") {
    status = 403;
    body = "Error 403 - This web app is stopped.";
  } else if (!p.activePackage) {
    body = `<h1>Your web app is running and waiting for your content</h1>`;
  } else {
    const r = await resolveSettings(ctx, fresh);
    if (!r.ok) {
      status = 500;
      body = "500 Internal Server Error - the application failed to start.";
      await mutate(ctx, fresh, (pp) => appendLogs(pp, r.errors.map((e) => `ERROR ${e}`)));
    } else if (path === "/health" || path === "/") body = path === "/health" ? `{"status":"Healthy"}` : `<h1>${p.activePackage} on ${fresh.name}</h1>`;
    else {
      status = 404;
      body = "Not Found";
    }
  }
  await mutate(ctx, fresh, (pp) => {
    pp.requests = [{ time: new Date().toISOString(), path, status }, ...(pp.requests ?? [])].slice(0, 100);
  });
  return { url: `https://${p.defaultHostName}${path}`, status, body };
}

// ---------------- Function apps ----------------

export const FUNCTION_TEMPLATES = {
  HttpHello: "Returns a greeting using the 'name' query parameter or body field.",
  HttpEcho: "Echoes the request method, query and body as JSON.",
  HttpEnvReader: "Returns the value of the app setting named in the 'key' query parameter (non-secret settings only).",
  HttpCalculator: "Adds the numbers 'a' and 'b' from the query or body.",
} as const;

export async function createFunctionApp(ctx: Ctx, raw: unknown) {
  const input = z.object({ resourceGroup: z.string().min(1), name: z.string().min(2).max(60), location: z.string().optional(), runtime: z.enum(["node", "python", "dotnet-isolated", "java", "powershell"]).default("node"), storageAccount: z.string().min(3), plan: z.enum(["Consumption", "FlexConsumption", "Premium"]).default("Consumption"), tags: z.record(z.string(), z.string()).optional() }).parse(raw);
  const sa = await findAnyByName(ctx, T.STORAGE, input.storageAccount);
  if (!sa) throw notFound(`Storage account '${input.storageAccount}' was not found. Function apps require a storage account (AzureWebJobsStorage).`);
  if (await findAnyByName(ctx, T.SITE, input.name)) throw conflict("NameNotAvailable", `Hostname '${input.name}' is already used by a web app.`);
  const fa = await createResource(ctx, {
    type: T.FUNCTION_APP,
    resourceGroup: input.resourceGroup,
    name: input.name,
    location: input.location,
    tags: input.tags,
    properties: {
      kind: "functionapp",
      runtime: input.runtime,
      plan: input.plan,
      state: "Running",
      defaultHostName: `${input.name.toLowerCase()}.sim-functions.azuregigs.local`,
      appSettings: { AzureWebJobsStorage: `DefaultEndpointsProtocol=https;AccountName=${sa.name};AccountKey=***`, FUNCTIONS_WORKER_RUNTIME: input.runtime, FUNCTIONS_EXTENSION_VERSION: "~4" } as Record<string, string>,
      functions: [] as Props[],
      invocations: [] as Props[],
      storageAccountId: sa.id,
    },
    dependsOn: [{ toId: sa.id, kind: "storage" }],
  });
  return fa;
}

export async function createFunction(ctx: Ctx, fa: Res, raw: unknown) {
  const input = z.object({ name: z.string().min(1).max(64).regex(/^[A-Za-z][A-Za-z0-9_-]*$/, "Function names must start with a letter"), template: z.enum(Object.keys(FUNCTION_TEMPLATES) as [keyof typeof FUNCTION_TEMPLATES]), authLevel: z.enum(["anonymous", "function", "admin"]).default("function"), methods: z.array(z.enum(["GET", "POST", "PUT", "DELETE"])).default(["GET", "POST"]) }).parse(raw);
  if ((fa.properties.functions as Props[]).some((f) => f.name.toLowerCase() === input.name.toLowerCase())) throw conflict("FunctionExists", `Function '${input.name}' already exists.`);
  return mutate(ctx, fa, (p) => {
    p.functions.push({ ...input, key: randomBytes(18).toString("base64url"), disabled: false, invokeUrl: `https://${p.defaultHostName}/api/${input.name}` });
  }, "Create Function", { function: input.name, template: input.template });
}

export async function invokeFunction(ctx: Ctx, fa: Res, raw: unknown) {
  const input = z.object({ name: z.string(), method: z.enum(["GET", "POST", "PUT", "DELETE"]).default("GET"), query: z.record(z.string(), z.string()).default({}), body: z.string().max(10000).default(""), key: z.string().optional() }).parse(raw);
  const started = Date.now();
  const p = fa.properties;
  const fn = (p.functions as Props[]).find((f) => f.name.toLowerCase() === input.name.toLowerCase());
  let status = 200;
  let response = "";
  const logs: string[] = [];
  const id = fakeGuid();
  if (!fn) {
    status = 404;
    response = "Function not found";
  } else if (p.state !== "Running") {
    status = 503;
    response = "Function host is not running (app stopped).";
  } else if (fn.disabled) {
    status = 404;
    response = "Function is disabled";
  } else if (!(fn.methods as string[]).includes(input.method)) {
    status = 405;
    response = `Method ${input.method} not allowed`;
  } else if (fn.authLevel !== "anonymous" && input.key !== fn.key) {
    status = 401;
    response = "Unauthorized: a valid function key (x-functions-key or ?code=) is required.";
  } else if (!(await findAnyByName(ctx, T.STORAGE, p.appSettings.AzureWebJobsStorage?.match(/AccountName=([^;]+)/)?.[1] ?? ""))) {
    status = 500;
    response = "Function host failed to start: AzureWebJobsStorage connection is invalid (storage account not found).";
  } else {
    logs.push(`Executing 'Functions.${fn.name}' (Reason='This function was programmatically called via the host APIs.', Id=${id})`);
    let body: Props = {};
    try {
      body = input.body ? JSON.parse(input.body) : {};
    } catch {
      body = {};
    }
    switch (fn.template) {
      case "HttpHello": {
        const name = input.query.name ?? body.name;
        response = name ? `Hello, ${String(name).slice(0, 100)}. This HTTP triggered function executed successfully.` : "This HTTP triggered function executed successfully. Pass a name in the query string or in the request body for a personalized response.";
        logs.push("C# HTTP trigger function processed a request.");
        break;
      }
      case "HttpEcho":
        response = JSON.stringify({ method: input.method, query: input.query, body }, null, 2);
        break;
      case "HttpEnvReader": {
        const key = input.query.key ?? body.key;
        if (!key) {
          status = 400;
          response = "Pass ?key=<APP_SETTING_NAME>";
        } else if (/key|secret|password|connection|storage/i.test(key)) {
          status = 403;
          response = `Refusing to return sensitive setting '${key}'.`;
        } else response = p.appSettings[key] ?? `Setting '${key}' is not configured.`;
        if (!p.appSettings[key]) logs.push(`Warning: app setting '${key}' not found`);
        break;
      }
      case "HttpCalculator": {
        const a = Number(input.query.a ?? body.a), b = Number(input.query.b ?? body.b);
        if (Number.isNaN(a) || Number.isNaN(b)) {
          status = 400;
          response = "Provide numeric 'a' and 'b'.";
        } else response = JSON.stringify({ a, b, sum: a + b });
        break;
      }
    }
    logs.push(`Executed 'Functions.${fn.name}' (${status < 400 ? "Succeeded" : "Failed"}, Id=${id}, Duration=${Date.now() - started + 12}ms)`);
  }
  const inv = { id, function: input.name, time: new Date().toISOString(), method: input.method, status, durationMs: Date.now() - started + 12, logs };
  await mutate(ctx, fa, (pp) => {
    pp.invocations = [inv, ...(pp.invocations ?? [])].slice(0, 100);
  });
  await logActivity(ctx, fa, "Invoke Function", status < 400 ? "Succeeded" : "Failed", { function: input.name, status });
  return { status, body: response, invocation: inv };
}

export async function setFunctionDisabled(ctx: Ctx, fa: Res, name: string, disabled: boolean) {
  if (!(fa.properties.functions as Props[]).some((f) => f.name === name)) throw notFound(`Function '${name}' not found.`);
  return mutate(ctx, fa, (p) => {
    p.functions.find((f: Props) => f.name === name).disabled = disabled;
  }, disabled ? "Disable Function" : "Enable Function", { function: name });
}

// ---------------- Azure SQL ----------------

export async function createSqlServer(ctx: Ctx, raw: unknown) {
  const input = z.object({ resourceGroup: z.string().min(1), name: z.string().min(1).max(63), location: z.string().optional(), adminLogin: z.string().min(1).max(128), adminPassword: z.string().min(8).max(128), tags: z.record(z.string(), z.string()).optional() }).parse(raw);
  if (["admin", "administrator", "sa", "root", "dbmanager", "loginmanager", "guest", "public"].includes(input.adminLogin.toLowerCase())) throw badRequest("InvalidLogin", `Login '${input.adminLogin}' is reserved.`);
  const classes = [/[a-z]/, /[A-Z]/, /\d/, /[^a-zA-Z\d]/].filter((r) => r.test(input.adminPassword)).length;
  if (classes < 3) throw badRequest("PasswordNotComplex", "Password must contain characters from three of: uppercase, lowercase, digits, non-alphanumeric.");
  return createResource(ctx, {
    type: T.SQL_SERVER,
    resourceGroup: input.resourceGroup,
    name: input.name,
    location: input.location,
    tags: input.tags,
    properties: { fullyQualifiedDomainName: `${input.name}.database.sim.azuregigs.local`, administratorLogin: input.adminLogin, version: "12.0", publicNetworkAccess: "Enabled", allowAzureServices: true, minimalTlsVersion: "1.2", firewallRules: [] as Props[], entraAdmin: null },
  });
}

export async function addFirewallRule(ctx: Ctx, server: Res, raw: unknown) {
  const input = z.object({ name: z.string().min(1).max(128).regex(/^[\w.-]+$/), startIp: z.string(), endIp: z.string() }).parse(raw);
  if (ipToInt(input.startIp) > ipToInt(input.endIp)) throw badRequest("InvalidFirewallRule", "Start IP must be less than or equal to end IP.");
  return mutate(ctx, server, (p) => {
    p.firewallRules = (p.firewallRules as Props[]).filter((r) => r.name !== input.name);
    p.firewallRules.push(input);
  }, "Create or Update Firewall Rule", input);
}
export async function deleteFirewallRule(ctx: Ctx, server: Res, name: string) {
  return mutate(ctx, server, (p) => {
    p.firewallRules = (p.firewallRules as Props[]).filter((r) => r.name !== name);
  }, "Delete Firewall Rule", { name });
}
export async function updateSqlNetwork(ctx: Ctx, server: Res, raw: unknown) {
  const input = z.object({ publicNetworkAccess: z.enum(["Enabled", "Disabled"]).optional(), allowAzureServices: z.boolean().optional() }).parse(raw);
  return mutate(ctx, server, (p) => {
    if (input.publicNetworkAccess) p.publicNetworkAccess = input.publicNetworkAccess;
    if (input.allowAzureServices !== undefined) p.allowAzureServices = input.allowAzureServices;
  }, "Update SQL Server Networking", input);
}

export async function createDatabase(ctx: Ctx, raw: unknown) {
  const input = z.object({ resourceGroup: z.string().min(1), serverName: z.string().min(1), name: z.string().min(1).max(128).regex(/^[^<>*%&:\\/?]+$/), sku: z.string().default("Basic"), sampleData: z.boolean().default(true), tags: z.record(z.string(), z.string()).optional() }).parse(raw);
  const server = (await findByName(ctx, T.SQL_SERVER, input.resourceGroup, input.serverName)) ?? (await findAnyByName(ctx, T.SQL_SERVER, input.serverName));
  if (!server) throw notFound(`SQL server '${input.serverName}' was not found.`);
  const sku = SQL_SKUS.find((s) => s.name.toLowerCase() === input.sku.toLowerCase());
  if (!sku) throw badRequest("InvalidSku", `Database SKU '${input.sku}' is invalid. Use: ${SQL_SKUS.map((s) => s.name).join(", ")}.`);
  const db = await createResource(ctx, {
    type: T.SQL_DB,
    resourceGroup: server.resourceGroup,
    name: `${server.name}/${input.name}`,
    location: server.location,
    tags: input.tags,
    properties: { serverId: server.id, serverName: server.name, databaseName: input.name, sku: sku.name, maxSizeGB: sku.name === "Basic" ? 2 : 250, collation: "SQL_Latin1_General_CP1_CI_AS", statements: input.sampleData ? [...SAMPLE_SCHEMA] : [], queryCount: 0, failedQueries: 0, history: [] as Props[] },
  });
  await addDependency(db.id, server.id, "server");
  return db;
}

export async function queryDatabase(ctx: Ctx, db: Res, raw: unknown) {
  const input = z.object({ sql: z.string().min(1).max(20000), clientIp: z.string().default("198.51.100.25"), viaPortal: z.boolean().default(true) }).parse(raw);
  const server = await getById(ctx, db.properties.serverId).catch(() => null);
  if (!server) throw notFound("The parent SQL server no longer exists.");
  if (!input.viaPortal) {
    if (server.properties.publicNetworkAccess === "Disabled") throw forbidden("PublicNetworkAccessDisabled", "Connections over the public network are denied because Public Network Access is Disabled.");
    const allowed = (server.properties.firewallRules as Props[]).some((r) => {
      const n = ipToInt(input.clientIp);
      return n >= ipToInt(r.startIp) && n <= ipToInt(r.endIp);
    });
    if (!allowed) throw forbidden("ClientIpNotAllowed", `Cannot open server '${server.name}' requested by the login. Client with IP address '${input.clientIp}' is not allowed to access the server.`);
  }
  const started = Date.now();
  const r = await runSql(db.properties.statements, input.sql);
  const durationMs = Date.now() - started;
  await mutate(ctx, db, (p) => {
    p.queryCount = (p.queryCount ?? 0) + 1;
    if (!r.ok) p.failedQueries = (p.failedQueries ?? 0) + 1;
    if (r.ok && !r.isRead) {
      if (p.statements.length >= 300) throw conflict("SandboxLimit", "This sandbox database reached its 300 write-statement limit. Create a new database.");
      p.statements.push(input.sql);
    }
    p.history = [{ time: new Date().toISOString(), sql: input.sql.slice(0, 500), ok: r.ok, durationMs, rows: r.ok ? r.rows.length : 0 }, ...(p.history ?? [])].slice(0, 50);
  });
  await logActivity(ctx, db, "Execute Query", r.ok ? "Succeeded" : "Failed", { durationMs });
  return { ...r, durationMs };
}

export async function listSqlDatabases(ctx: Ctx, server: Res) {
  return (await listResources(ctx, { type: T.SQL_DB })).filter((d) => d.properties.serverId === server.id);
}

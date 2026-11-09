# Azure Gigs - the virtual Azure cloud experience

Azure Gigs is a hands-on Azure learning simulator. It gives each learner a portal like the Azure Portal, a persistent simulated subscription, a working terminal, 110 auto-graded labs, injected production incidents and a learner dashboard. It is built for AZ-900 and AZ-104 candidates, junior cloud and DevOps engineers, and anyone preparing for cloud interviews.

> **Not affiliated with Microsoft.** Azure Gigs is an independent learning platform. In **Virtual Azure Mode** (the default), every resource is a simulation stored in PostgreSQL. Nothing runs in Microsoft Azure, and the UI says so. **Real Azure Mode** is optional and acts on a subscription the learner connects with Microsoft sign-in. Certificates are course-completion certificates, not Microsoft credentials.

## What works

| Area | What you can do |
|---|---|
| Portal | Header with global search, Create, notifications (activity feed), theme toggle and profile menu. Collapsible left navigation with 23+ sections, breadcrumbs, searchable resource tables, create blades with Review + create, tabbed resource blades, activity log, tags editor and JSON view. Works on desktop and mobile. |
| Simulation engine | 25 resource types persisted per learner. The engine validates names, regions, CIDRs, priorities, passwords and quotas. It tracks dependencies (blocks deletes that would break other resources; cascade deletes need typed confirmation) and writes an activity log for every change. |
| Compute | VM wizard (Basics, Disks, Networking, Management, Review). Start, stop, restart, deallocate, resize, delete. NIC, OS disk and public IP are created with the VM. Run command inside a simulated guest OS (systemctl, ps, kill, df, rm logs, curl localhost, nslookup and more). Boot diagnostics, CPU and memory charts. |
| Networking | VNets with overlap validation, subnets, IP allocation (5 reserved IPs), peering (rejects overlapping address spaces), DNS servers. NSGs with priority evaluation and default rules, plus IP flow verify. Network Watcher-style connectivity checks across power state, public IP, subnet NSG, NIC NSG and guest listener. |
| Storage | Redundancy, tiers, TLS, anonymous access, containers, blob upload, download, delete and tiering (Archive blocks reads), firewall and IP rules, and a data-plane access tester (firewall, anonymous access, shared key, RBAC data roles). |
| Entra ID & RBAC | Users, groups, managed identities and 19 built-in roles with actions, notActions and dataActions. Scope inheritance and group membership. Check access, sign-in logs and audit logs. `az login --username <user>` makes the terminal enforce that user's RBAC. |
| App Service & Functions | Plans and web apps, sample package deployments with Oryx-like build logs (runtime mismatch fails), app settings, Key Vault references, managed identity, browse (HTTP status), log stream. Function apps with safe templated HTTP functions, function keys and invocation logs. |
| Azure SQL | Servers, firewall rules, public network access and "Allow Azure services". Databases with a query editor that runs real SQL in an isolated in-memory SQLite worker with a 2-second timeout. Writes persist via a replay log. |
| Key Vault | Secrets with versions, expiry, enable/disable, soft delete, recover and purge (purge protection). Access policies or the RBAC model, a retrieval tester and an audit history. Secret values are AES-256-GCM encrypted at rest and redacted from all views. |
| Monitor & Logs | Metrics derived from resource state (a stopped VM shows 0% CPU, a runaway process about 97%). Resource health, metric alert rules with fired/resolved history, and the subscription activity log. A KQL interpreter (where, project, extend, summarize ... by bin(), sort, top, take, count, distinct, join, render) over tables built from the learner's own environment. |
| DevOps | Projects with Boards (kanban), Repos (branches, commits, branch policies), pull requests (approve, complete), YAML pipelines (stages, jobs, deployment jobs, environments with approvals, CI triggers). Tasks really act on the simulator: AzureWebApp@1 deploys, Docker@2 pushes to ACR, KubernetesManifest@1 rolls out to AKS. |
| Containers | ACR with `az acr build` Dockerfile validation, ACI, and AKS with deployments, pods, services, namespaces, node pools and events. Includes `kubectl get/describe/logs/scale/set/rollout/expose/apply -f`, and realistic ImagePullBackOff and CrashLoopBackOff. |
| Backup & Cost | Recovery Services vaults, policies, protection, backup-now, restore to a new VM, and jobs. Cost Management estimates by resource group and service, plus budgets with thresholds. |
| Terminal | Azure CLI (173 commands, `--query` JMESPath subset, `-o json/table/tsv/yaml`), Azure PowerShell (Az cmdlets with Where-Object, Select-Object and Format-Table pipelines) and Bash (virtual filesystem, pipes, redirection, `&&`/`||`). Shows history, exit codes, timings and resource changes. Commands parse into engine operations; responses are not hard-coded. |
| Learning | 110 labs (29 beginner, 50 intermediate, 31 advanced), 7 learning paths with modules, assessments and 6 capstones, the Contoso Digital Services company environment (mentor, teams, environments, KT sessions, the Observe → Production Support progression), and certificates with a public verification URL. |
| Auto-grading | Every lab has checks in four categories: configuration (40), execution (30), security (20) and documentation (10). Checks read live resources, command and KQL history, activity logs, connectivity results, RBAC evaluations, pipeline runs, HTTP status and incidents. Results show passed and failed checks, hints and suggestions. Progress is stored. |
| Incidents | 10 fault types: VM unavailable, wrong NSG rule, storage access denied, DNS failure, expired secret, pipeline failure, DB connection failure, high CPU, disk full and wrong RBAC. Each is injected into the learner's own resources (or a provisioned `rg-contoso-prod`). Scoring covers investigation, root cause, verified resolution, verification and RCA, minus 5 points per hint. Solutions are revealed only after resolving or abandoning. |
| Real Azure Mode | Microsoft sign-in (authorization code + PKCE) with encrypted tokens. Lists subscriptions, resource groups and resources. Creates resource groups (free). Creates storage accounts only after a Retail Prices API estimate and explicit cost confirmation. Deleting a resource group requires typing its name. Every action is audited. |

## Quick start (local)

```bash
cd azure-gigs
cp .env.example .env            # then set ENCRYPTION_KEY (openssl rand -base64 32)
npm ci
npx prisma migrate deploy       # needs PostgreSQL running (see docs/INSTALL.md)
npm run db:seed                 # loads 110 labs, 7 paths, assessments
npm run dev                     # http://localhost:3000
```

Or run the whole stack with Docker: `docker compose up --build` (Postgres, Redis, a migrate/seed job and the app).

## Documentation

- [docs/INSTALL.md](docs/INSTALL.md): installation and environment variables
- [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md): Vercel, Azure Container Apps, managed PostgreSQL, CI/CD
- [docs/REAL_AZURE.md](docs/REAL_AZURE.md): connecting a real subscription (app registration, scopes, costs)
- [docs/SECURITY.md](docs/SECURITY.md): security model and production checklist
- [docs/TESTING.md](docs/TESTING.md): unit, integration and Playwright end-to-end tests
- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md): code map and design decisions

## Tech stack

Next.js 16 (App Router), React 19, TypeScript, Tailwind CSS 4 with shadcn/ui-style primitives, Lucide icons and Monaco Editor (YAML, SQL, KQL and Dockerfile editing). Also PostgreSQL with Prisma 6, Zod validation, Vitest and Playwright.

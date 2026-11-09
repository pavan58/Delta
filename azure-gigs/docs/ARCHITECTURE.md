# Architecture

```
Browser (Next.js App Router, React client components)
   │  same-origin fetch (JSON)                         server components read via lib/* directly
   ▼
API routes  src/app/api/**  ── withUser(): origin check → session → rate limit → zod → AppError mapping
   │
   ├─ Simulation engine   src/lib/sim/engine.ts      persistence, validation, dependencies, activity log
   │     ├─ services/*    network · compute · storage · rbac · keyvault · apps(SQL, Functions) · monitor · devops · containers · backup
   │     ├─ registry.ts   CREATORS (type → create) and ACTIONS (type → action → handler), sanitize/detail views
   │     ├─ net.ts        CIDR + NSG evaluation      kql.ts / kqlData.ts  KQL interpreter + per-learner tables
   ├─ Terminal            src/lib/terminal/          tokenizer → az / pwsh / bash / kubectl → engine (no host exec)
   ├─ Learning            src/lib/labs/              grader, incidents (fault injection), progress, certificates
   ├─ Content             src/content/               110 labs, paths, assessments, company, interview questions
   └─ Real Azure          src/lib/azure/real.ts      OAuth PKCE, encrypted tokens, ARM REST
   ▼
PostgreSQL (Prisma)  prisma/schema.prisma
```

## Key decisions

- **One simulator, many front doors.** The portal, the CLI, PowerShell, kubectl, pipelines and fault injection all call the same engine functions. A VM stopped from PowerShell shows as stopped in the portal, drops to 0% CPU in metrics, fires a "VM down" alert, fails the grader's connectivity check and appears in `AzureActivity` in KQL.
- **Resources are typed JSON documents** (`SimulatedResource.properties`) with case-insensitive unique keys `(userId, type, rgKey, nameKey)`, as in ARM. Relationships that matter for safety (NIC → subnet, VM → NIC, subnet → NSG, peering) are rows in `ResourceDependency`.
- **Grading is declarative.** Labs list checks (`resource`, `command`, `activity`, `connectivity`, `rbac`, `incidentResolved`, `pipelineRun`, `siteHttp`, `notes`, ...) stored in `Lab.checks`. The grader evaluates them against live state, so learners must show the result. Clicking "complete" is not enough.
- **Faults are reversible state mutations** with a `verify()` that checks the outcome (port 80 reachable, app returns 200, pipeline green), not one specific fix. Any valid fix passes.
- **Safety first for learner code.** User SQL runs in a worker-thread sandbox. Everything else is interpreted, not executed.

## Data model highlights

`User`, `Session`, `Organization`, `Subscription`, `SimulatedResource`, `ResourceDependency`, `CommandHistory`, `ActivityLog`, `AuditLog`, `LearningPath`, `Module`, `ModuleLab`, `Lab`, `LabStep`, `LabSubmission`, `LabScore`, `UserProgress`, `Incident`, `IncidentResolution`, `Assessment`, `AssessmentAttempt`, `Certificate`, `ConnectedAzureAccount`. Indexes cover all per-user listings, and all learner data cascades on user deletion.

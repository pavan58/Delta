# Production deployment guide

Azure Gigs is a single Next.js application: the UI and the API routes run in the same process. It needs:

1. **Managed PostgreSQL** (for example Azure Database for PostgreSQL Flexible Server, Neon or Supabase). Use `sslmode=require`.
2. **A Node.js host**: Vercel (serverless) or Azure Container Apps (containers).
3. **A one-off migrate + seed step** for each release.

## Option A - Vercel (frontend + API)

1. Import the repository in Vercel and set **Root Directory** to `azure-gigs`.
2. Add environment variables (Production and Preview): `DATABASE_URL`, `ENCRYPTION_KEY`, `APP_URL` (your Vercel domain), and optionally `AZURE_AD_*` and `ADMIN_*`.
3. `vercel.json` runs `prisma migrate deploy` and the idempotent content seed before `npm run build`, so every deploy has an up-to-date schema and lab library. With Supabase, use the **session pooler** host (`aws-N-<region>.pooler.supabase.com:5432`, user `<role>.<project-ref>`) and append `?schema=azuregigs&sslmode=require&connection_limit=1`; the direct `db.<ref>.supabase.co` host is IPv6-only and unreachable from Vercel.
4. To seed manually instead: `DATABASE_URL=... npm run db:seed` (it upserts, so re-running is safe).
5. Serverless note: the in-memory rate limiter is per instance. Put Vercel Firewall or WAF rate limits in front of `/api/auth/*`, or implement the Redis store described in SECURITY.md.

## Option B - Azure Container Apps (backend containers)

```bash
ACR=myregistry
az acr build -r $ACR -t azure-gigs:1.0 --target runner .
az acr build -r $ACR -t azure-gigs-tools:1.0 --target tools .
az deployment group create -g rg-azuregigs -f infra/containerapp.bicep \
  -p image=$ACR.azurecr.io/azure-gigs:1.0 toolsImage=$ACR.azurecr.io/azure-gigs-tools:1.0 \
     acrLoginServer=$ACR.azurecr.io appUrl=https://<your-domain> \
     databaseUrl="<postgres url>" encryptionKey="<base64 key>"
# grant the output identity AcrPull on the registry, then:
az containerapp job start -g rg-azuregigs -n azure-gigs-migrate
```

The Bicep template creates a Log Analytics workspace, a Container Apps environment, a user-assigned identity (for pulling from ACR), the web app (HTTPS ingress, liveness probe on `/api/health`) and the migration job. Secrets are passed as Container Apps secrets. For production, reference them from Key Vault.

You can also host the frontend on Vercel and the API on Container Apps. Because the API lives in the same Next.js app, the simplest production setup uses **one** host. Pick Vercel or Container Apps based on your scaling and network needs.

## Database configuration

- Run `npx prisma migrate deploy` for every release (Vercel does this in its build step; Container Apps uses the migrate job).
- Content (labs, paths, assessments) lives in `src/content/*.ts`. Run `npm run db:seed` after changing it.
- Back up the database with your provider's PITR. Learner progress, simulated resources and audit logs all live there.

## CI/CD

`.github/workflows/azure-gigs-ci.yml` (at the repository root) runs on changes under `azure-gigs/`. It installs dependencies, migrates and seeds a Postgres service, then runs the typecheck, Vitest, the production build and Playwright E2E. It also builds both Docker targets. To add continuous deployment, chain a job that deploys after `test` succeeds: Vercel CLI with `VERCEL_TOKEN`, or `az acr build` plus `az containerapp update` using OIDC federated credentials (no stored cloud secrets).

## Health check

`GET /api/health` returns `{"status":"ok","db":"ok"}`, or HTTP 503 if the database is unreachable.

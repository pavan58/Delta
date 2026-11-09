# Testing guide

| Suite | Command | Covers |
|---|---|---|
| Unit | `npm run test:unit` | CIDR math, IP allocation, NSG evaluation, KQL interpreter, terminal tokenizer, flag parser and JMESPath, crypto, rate limiting, RBAC role semantics, grader conditions, content library integrity (≥100 labs, all sections, 4 grading categories, 7 paths, 6 capstones) |
| Integration | `npm run test:integration` | Real PostgreSQL (`TEST_DATABASE_URL`). Engine CRUD, dependencies and cascades. Tenant isolation through API routes. Auth (register, login, duplicates, weak passwords, hashed sessions). CSRF origin rejection. Secret redaction. Azure CLI, PowerShell, Bash and kubectl. RBAC enforcement as a directory user. Storage, SQL sandbox (including timeout and forbidden statements), Functions, DevOps pipelines, AKS. Grading with partial credit, all 10 incident faults, incident scoring, assessments, certificates. Real Azure Mode with mocked Microsoft endpoints (PKCE, encrypted tokens, cost confirmation, delete confirmation, isolation). |
| End-to-end | `npm run build && npm run test:e2e` | Playwright against `next start` on port 3100 using the test database. **The full MVP demonstration**: register → sign out/in → dashboard → start lab → resource group → VNet → subnet (plus overlap validation) → NSG → inbound rule → VM wizard attached to the subnet and NSG → Azure CLI → inspect config → inject the NSG fault → diagnose with a connectivity check → delete the bad rule → verify → resolve with RCA → submit the lab → score 100/100 → dashboard progress. Also: every navigation item returns a working page, and unauthenticated access is redirected or rejected. |

## Running locally

```bash
createdb azuregigs_test   # or the SQL in INSTALL.md
DATABASE_URL=$TEST_DATABASE_URL npx prisma migrate deploy
DATABASE_URL=$TEST_DATABASE_URL npx tsx prisma/seed.ts
npm test                  # unit + integration (Vitest)
npm run build
npm run test:e2e          # Playwright (Chromium)
```

Tests create uniquely named learners, so you can re-run them without resetting the database.

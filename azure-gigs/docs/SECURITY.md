# Security model and checklist

## Controls implemented

| Control | Implementation |
|---|---|
| Authentication | Email and password accounts (bcrypt cost 12, length/complexity rules). Sessions are random 256-bit tokens in an `httpOnly`, `SameSite=Lax`, `Secure` (production) cookie. Only the SHA-256 hash is stored, with a 7-day expiry, and sessions are deleted on logout. Login uses a uniform bcrypt comparison to reduce user enumeration through timing. |
| Authorization & tenant isolation | Every simulator query filters by `userId` (`src/lib/sim/engine.ts`). API routes resolve the user from the session (`withUser`). Integration tests verify cross-learner reads, deletes and listings fail with 404. The admin page requires role `ADMIN` and returns 404 to everyone else. |
| CSRF | State-changing API calls check that `Origin` matches the host. Browsers always send `Origin` on POST, PATCH and DELETE. Requests marked `Sec-Fetch-Site: cross-site` without an Origin are rejected. Cookies are SameSite=Lax. |
| XSS | React escaping everywhere. There is no `dangerouslySetInnerHTML` except the static theme bootstrap. CSP sets `frame-ancestors 'none'`, plus `X-Content-Type-Options` and `X-Frame-Options`. Blob downloads are served as `application/octet-stream` attachments. |
| SQL injection | Prisma parameterised queries only. The learner SQL sandbox runs in an isolated in-memory SQLite worker thread with a 2-second hard timeout and a 64 MB heap limit. It denies ATTACH, PRAGMA, VACUUM and extension loading, caps rows and stores nothing on the host filesystem. |
| Input validation | Zod schemas on every API body and simulator operation. Azure-style errors are returned with codes. Request bodies are capped at 1 MB and commands at 4,000 characters. |
| Rate limiting | Per-user global (600/min) plus per-route budgets (for example incidents 20/min, KQL 60/min). Register is limited to 10/hour/IP and login to 20/15 min/IP. |
| Secure execution | **No learner command ever runs on the server.** The terminal parses commands into simulator operations. Bash uses a per-learner virtual filesystem (300 files, 64 KB per file, 1 MB total, writes only under the home directory and /tmp). Run command, Functions and pipelines use simulated, templated behaviour. |
| Secrets | All secrets come from environment variables, and `.env` is git-ignored. Azure OAuth tokens and simulated Key Vault secret values are AES-256-GCM encrypted. VM and SQL admin passwords are validated but never stored. API responses redact secret values except an explicit `getSecret` call by the owner. |
| Quotas & cleanup | 400 resources per learner, at most 3 open incidents, size limits on blobs and databases. Deletes check dependencies, and cascading deletion requires typed confirmation. Deleting a learner cascades their data. |
| Audit | `AuditLog` records registration, login success and failure (with IP) and every Real Azure action. `ActivityLog` records every simulator change with caller and source (portal, cli, pwsh, bash, pipeline, fault). |

## Production checklist

- [ ] Generate a unique `ENCRYPTION_KEY` per environment and keep it in Key Vault or the platform secret store. Rotating it requires re-encrypting `ConnectedAzureAccount` tokens (or asking learners to reconnect) and resetting simulated Key Vault secrets.
- [ ] Serve over HTTPS only. Set `APP_URL` to the HTTPS origin.
- [ ] Use a managed Postgres with TLS (`sslmode=require`), private networking, PITR backups and a least-privilege database role (no superuser).
- [ ] If you run more than one instance, replace the in-memory rate-limit store with Redis (`src/lib/security/rateLimit.ts`) or put WAF rate limiting in front of `/api/auth/*`.
- [ ] Set `ADMIN_*` only during the seed run. Rotate the admin password afterwards.
- [ ] For Real Azure Mode, use a dedicated app registration per environment. Store the client secret in a secret store (or switch to a certificate). Review the redirect URI.
- [ ] Monitor `/api/health`. Ship logs to Log Analytics. Alert on spikes in `auth.login.failed`.
- [ ] Run `npm audit` and keep Next.js, Prisma and dependencies patched.
- [ ] Review the CSP if you self-host Monaco instead of loading it from jsdelivr.

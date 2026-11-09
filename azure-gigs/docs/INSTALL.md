# Installation guide

## Prerequisites

- Node.js 22+ and npm 10+
- PostgreSQL 14+ (16 recommended)
- Optional: Docker for `docker compose`, and Redis (see SECURITY.md for when you need it)

## 1. Database

Create a role and two databases. The second one is for automated tests, which create data freely.

```sql
CREATE USER azuregigs WITH PASSWORD 'choose-a-password' CREATEDB;
CREATE DATABASE azuregigs OWNER azuregigs;
CREATE DATABASE azuregigs_test OWNER azuregigs;
```

## 2. Environment variables

Copy `.env.example` to `.env` and fill it in:

| Variable | Required | Purpose |
|---|---|---|
| `DATABASE_URL` | yes | Prisma connection string |
| `ENCRYPTION_KEY` | yes | 32 random bytes, base64 (`openssl rand -base64 32`). Encrypts OAuth tokens and simulated Key Vault secrets. |
| `APP_URL` | yes for Real Azure Mode | Public base URL, used to build the OAuth redirect URI |
| `TEST_DATABASE_URL` | for tests | Separate database for Vitest/Playwright |
| `ADMIN_EMAIL`, `ADMIN_PASSWORD` | optional | Creates or promotes an administrator when you run `npm run db:seed` |
| `AZURE_AD_CLIENT_ID`, `AZURE_AD_CLIENT_SECRET`, `AZURE_AD_TENANT` | optional | Real Azure Mode (see REAL_AZURE.md) |
| `REDIS_URL` | optional | Reserved for shared rate limiting when running several instances |

Never commit `.env`. It is git-ignored.

## 3. Install, migrate, seed and run

```bash
npm ci
npx prisma migrate deploy          # apply migrations
npm run db:seed                    # labs, paths, assessments (+ admin if configured)
npm run dev                        # development server on :3000
# or production mode
npm run build && npm start
```

Configurations for local, staging and production: `.env.example` (local), `config/staging.env.example` and `config/production.env.example`.

## 4. First login

Open http://localhost:3000, choose **Create a learner account**, and you get:

- a simulated subscription ("Azure Gigs Sandbox (Simulated)") with a GUID,
- the Contoso directory: Rahul Sharma (mentor), Priya Nair, Arjun Mehta, Sneha Kulkarni, Vikram Rao, and groups,
- an empty set of resources. Start with **My Labs → Create a tagged resource group**.

### Administrator

Set `ADMIN_EMAIL` and `ADMIN_PASSWORD` (at least 10 characters, with letters and digits) and run `npm run db:seed`. The account is created with the `ADMIN` role, or promoted if it already exists. Sign in normally; **Administration** then appears in the profile menu (`/admin`: platform stats, recent learners, security audit log). Learners get a 404 on that page. Keep admin credentials in your secret store, not in source control.

## Docker Compose

```bash
echo "ENCRYPTION_KEY=$(openssl rand -base64 32)" > .env
docker compose up --build
```

The `migrate` service runs `prisma migrate deploy` and seeds content before `app` starts.

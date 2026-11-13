# Deployment guide

SpeakUp AI is a Next.js 16 app. It runs with **zero configuration** (Free Mode + guest mode).
Supabase and AI providers are optional add-ons.

## 1. Run locally

```bash
cd speakup-ai
npm install
npm run dev            # http://localhost:3000
```

Optional: `cp .env.example .env.local` and fill in values.

## 2. Hosting options (free tiers — verify current limits before launch)

| Host | Free tier notes | How |
|---|---|---|
| **Vercel** (simplest) | Hobby plan is for **non-commercial** use only. Use Pro ($20/mo) once you charge money or run ads. | Import the GitHub repo, set **Root Directory = `speakup-ai`**, framework Next.js, Node 22. Every push to the production branch deploys. |
| **Cloudflare Workers** (commercial use allowed on free plan) | 100k requests/day on the free plan; 3 MB compressed worker size limit (paid plan 10 MB). | Uses the OpenNext adapter — see below. |
| Netlify | Free tier allows commercial use with bandwidth/build-minute limits. | Import repo, base directory `speakup-ai`. |

### Cloudflare Workers (OpenNext)

```bash
cd speakup-ai
npm install -D @opennextjs/cloudflare wrangler
npx wrangler login
npm run cf:deploy      # = opennextjs-cloudflare build && deploy
```

Create `wrangler.jsonc` the first time (`npx opennextjs-cloudflare` scaffolds it), then add secrets with
`npx wrangler secret put SUPABASE_SERVICE_ROLE_KEY` (and AI keys). Public `NEXT_PUBLIC_*` variables must be
present at **build** time. The app's API routes only use `fetch` and the official SDKs, which run on Workers.

## 3. Supabase (accounts, sync, leaderboard, admin) — optional

1. Create a free project at supabase.com (free tier: 500 MB DB, 50k monthly active users; projects pause after 1 week of inactivity).
2. **SQL Editor → run** `supabase/migrations/20261112000000_init.sql` (or `supabase db push` with the CLI).
3. **Project Settings → API**: copy the URL, `anon` key and `service_role` key into your host's environment:
   - `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` (public)
   - `SUPABASE_SERVICE_ROLE_KEY` (**server only, never expose**)
4. **Authentication → URL configuration**: set Site URL to your domain and add `https://YOUR_DOMAIN/**` to redirect URLs.
5. Email: Supabase's built-in email is rate-limited (a few emails/hour). For production, add custom SMTP (e.g. Resend/Brevo free tiers).
6. Google login (optional): Authentication → Providers → Google (needs a Google Cloud OAuth client), then set `NEXT_PUBLIC_GOOGLE_AUTH_ENABLED=true`.

### Admin setup

Sign up in the app, then in the Supabase SQL editor:

```sql
update public.user_profiles set role = 'admin'
where id = (select id from auth.users where email = 'you@example.com');
```

Reload the app — an **Admin** item appears in the sidebar (`/admin`). Every admin API checks the role server-side
with the service key; learners cannot change their own role (database trigger).

## 4. Optional AI provider

Set `AI_PROVIDER` and the matching key (see `.env.example`). Recommended low-cost choices:

| Provider | Env | Notes |
|---|---|---|
| Anthropic | `AI_PROVIDER=anthropic`, `ANTHROPIC_API_KEY`, `ANTHROPIC_MODEL=claude-haiku-5-5` | Default model is the cheapest Claude model; low effort is used for short replies. |
| Google Gemini | `AI_PROVIDER=gemini`, `GEMINI_API_KEY` | Has a free tier with rate limits (check current terms). |
| Groq / OpenRouter / OpenAI | `AI_PROVIDER=groq` etc., `OPENAI_API_KEY`, `OPENAI_MODEL` | OpenAI-compatible endpoint. |
| Ollama (local dev) | `AI_PROVIDER=ollama` | Free, runs on your machine; not reachable from a cloud host. |

Learners can also paste **their own key** in Settings (stored only in their browser, forwarded per request).

**Always set a spending limit in your provider's console.** In-app limits: `AI_DAILY_LIMIT_GUEST`,
`AI_DAILY_LIMIT_USER`, `AI_GLOBAL_DAILY_LIMIT` (admins can change them in `/admin`).

## 5. Verify a deployment

```bash
curl https://YOUR_DOMAIN/api/health        # {"ok":true,...}
curl https://YOUR_DOMAIN/api/ai/status     # serverAi true/false
E2E_BASE_URL=https://YOUR_DOMAIN npx playwright test --trace off
```

## 6. Payments (future)

Billing is intentionally not active. When ready, add Razorpay (INR) via a server route that creates orders and a
webhook that sets a `plan` column on `user_profiles`; gate premium AI features on that column server-side.

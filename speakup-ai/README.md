# SpeakUp AI — Your Personal English Coach

**Stop Hesitating. Start Speaking.** A free-first English speaking coach, IELTS practice platform and job-interview
simulator for Indian learners. Mobile-first PWA built with Next.js, TypeScript, Tailwind, Recharts and (optionally)
Supabase and any AI provider.

- 🎙️ AI English Speaking Teacher (voice or text, corrections, Hindi explanations, follow-ups, TTS replay & slow mode)
- ✍️ Grammar & pronunciation coach with a personal mistake tracker
- 📅 30-Day English Confidence Challenge with scores, badges and a before/after report
- 🎓 IELTS Academic & General: Listening, Reading, Writing, Speaking, full mock test (band **estimates**)
- 💼 Interview simulator: 12 categories (HR, Fresher, Desktop Support, Helpdesk, AWS, Azure, Mainframe, …) scored /100
- 📚 Vocabulary builder with spaced repetition; 📈 progress dashboard; 🔥 streaks, XP, badges, leaderboard
- 📲 WhatsApp / native share cards (PNG), challenge-a-friend and referral links
- 🛡️ Admin panel, Supabase RLS, privacy controls, data export & account deletion

## Quick start

```bash
npm install
npm run dev     # http://localhost:3000 — works with no environment variables
```

| Script | Purpose |
|---|---|
| `npm run build` / `start` | Production build / server |
| `npm test` | Unit tests (Vitest) |
| `npm run test:db` | Applies the Supabase migration to in-memory Postgres and checks RLS |
| `npm run test:e2e` | Playwright end-to-end tests (desktop + mobile) |
| `npm run test:all` | Typecheck + unit + DB + build |
| `npm run icons` | Regenerate PWA icons |

## Architecture

```
src/app            Next.js routes — (app)/ = signed-in shell: dashboard, speak, grammar, challenge, ielts/*,
                   interview, vocabulary, progress, community, profile, admin; api/* = server endpoints
src/components     ui, voice, ielts, charts, sharing, layout, dashboard
src/lib/grammar    rule-based grammar engine (free mode)
src/lib/scoring    speaking score, IELTS bands & writing evaluation, interview score, progress maths
src/lib/ai         provider adapter (Anthropic SDK, OpenAI-compatible, Gemini, Ollama), prompts, limits, free teacher
src/lib/speech     Web Speech API recognition & synthesis hooks
src/lib/store      local-first store (guest mode) + actions
src/lib/supabase   browser/server clients, auth context, cloud sync
src/content        original lessons, vocabulary, IELTS tests & prompts, interview bank
supabase/migrations  Postgres schema with RLS
```

**Local-first:** all progress is saved in the browser immediately (guest mode). When Supabase is configured and the
learner signs in, `lib/supabase/sync.ts` merges and mirrors it to Postgres. **AI is optional:** the client always
computes rule-based feedback; if the learner enables AI (with explicit consent) the server adapter enriches it.
API keys never reach the browser.

## Docs

- [Deployment guide](docs/DEPLOYMENT.md) (Vercel, Cloudflare, Supabase, admin setup, AI providers)
- [Testing report](docs/TESTING.md)
- [Costs, limitations & scaling plan](docs/COSTS_AND_LIMITS.md)

IELTS is a registered trademark of its owners; SpeakUp AI is not affiliated with them. All practice content is original.
Band scores and speaking scores are automated estimates, not official results.

# Cost breakdown, limitations and scaling plan

## What works with no paid API (Free Mode)

Everything below runs at ₹0 with no keys:
- Spoken English Foundation Course (28 grammar lessons with exercises and speaking drills).
- Landing page, guest onboarding, dashboard, progress charts, streaks, XP, badges, PNG share cards, WhatsApp links.
- AI English Speaking Teacher in **rule-based** mode (corrections, explanations in English/Hindi, follow-up questions,
  text-to-speech with replay and slow mode, browser speech recognition).
- Grammar coach + personal mistake tracker; vocabulary builder with spaced repetition and quizzes.
- 30-day challenge with scores, badges and before/after report.
- IELTS Listening (synthetic audio), Reading, Writing (criteria-based estimate), Speaking, full mock test.
- Interview simulator (12 categories, 75+ original questions, scoring /100, sample answers, report).
- Challenge-a-friend links, invite links, personal 7-day and monthly challenges.

## What needs configuration

| Feature | Needs | Cost |
|---|---|---|
| Accounts, cross-device sync, password reset | Supabase project | Free tier |
| Public leaderboard, referral counts, admin panel, feedback inbox, AI usage logs | Supabase + service key | Free tier |
| Google login | Google OAuth client | Free |
| AI conversation, contextual grammar, AI interview answers, AI IELTS feedback | An AI provider key (server) or learner's own key | Pay-per-use (see below) |
| Custom domain | Domain registrar | ~₹800–1,200/year |

## Estimated monthly operating cost

| Stage | Hosting | Database | AI | Total |
|---|---|---|---|---|
| MVP, < 1k users, AI off | ₹0 (Cloudflare free / Vercel Hobby non-commercial) | ₹0 (Supabase free) | ₹0 | **₹0** |
| 1k users, AI on, 10 req/user/day cap, Claude Haiku 5.5 | ₹0 | ₹0 | ≈ 300k req/month × ~600 tokens ≈ $40–60 | **≈ ₹3,500–5,000** |
| 10k+ users, commercial | Vercel Pro $20 or Cloudflare paid $5 | Supabase Pro $25 | grows with usage; gate behind Premium | **≈ ₹4,000 + AI** |

AI estimate assumes ~400 input + ~200 output tokens per request at $0.10 / $0.50 per million tokens (Claude Haiku 5.5
list price at the time of writing). Check current prices; the admin panel shows estimated spend from real token counts.

## Free-tier limitations to know

- **Vercel Hobby** forbids commercial use. **Supabase free** projects pause after a week without activity and have
  500 MB storage. Built-in Supabase email is heavily rate-limited — add SMTP for production.
- In-memory rate limits are per server instance (best effort); durable per-user daily limits use `ai_usage_logs`.
- Free AI tiers (e.g. Gemini) change often and may use prompts for training — read the provider terms.

## Known limitations (honest list)

- **Speech recognition** depends on the browser: best in Chrome/Edge (Android, desktop) and Safari; not in Firefox.
  Chrome sends audio to Google's speech service. Accuracy varies with accent and noise.
- **Pronunciation** is only an *indicator* derived from recognition confidence — not phoneme-level analysis.
  Typed answers show "not measured".
- **Rule-based grammar** catches common learner errors well but is not a full parser; it can miss errors and, rarely,
  flag correct English. AI mode improves this.
- **IELTS bands are estimates.** Practice tests are shorter than real ones (raw scores scaled to /40); writing bands
  come from measurable indicators (length, paragraphing, linking, lexical diversity, error rate), not an examiner.
  Synthetic listening audio is not the same as official recordings.
- Guest data lives in browser storage and can be lost if cleared.
- One listening test, two reading tests and 13 writing prompts ship today; admins can add speaking/interview/vocabulary
  content without code. More full tests should be authored before a large launch.

## Scaling plan

1. **Content**: author 4–6 more full listening/reading tests; add audio assets (recorded by voice actors) to `public/audio`.
2. **AI**: keep Haiku-class models for corrections; route only premium IELTS writing feedback to larger models; cache
   identical grammar requests; use prompt caching for the static system prompts (already structured for it).
3. **Pronunciation**: optional server-side scoring (e.g. an open-source forced-aligner on a small GPU, or a paid
   pronunciation API) behind the Premium plan.
4. **Data**: move heavy analytics to scheduled SQL views; add Postgres indexes as queries grow (core ones exist).
5. **Rate limiting**: replace in-memory limits with Cloudflare KV / Upstash Redis when running multiple instances.
6. **Payments**: Razorpay subscriptions (INR, UPI) with webhook-driven plan flags; never block core lessons.
7. **Mobile**: the PWA installs today; wrap with Capacitor/TWA for Play Store distribution if needed.

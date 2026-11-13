# Testing report

Run everything: `npm run test:all` (typecheck → unit → database RLS → production build), then `npm run test:e2e`.

| Suite | Command | Result (12–13 Nov 2026) |
|---|---|---|
| TypeScript | `npm run typecheck` | ✅ no errors |
| Unit (Vitest) | `npm test` | ✅ 42 / 42 |
| Database / RLS (PGlite + Supabase auth stub) | `npm run test:db` | ✅ all assertions |
| End-to-end (Playwright, desktop + Pixel 7) | `npm run test:e2e` | ✅ 32 / 32 |
| Production build | `npm run build` | ✅ |

## What is covered

- **Grammar engine** — 21 common learner errors corrected exactly (tense after time markers, articles, prepositions,
  agreement, stative verbs, "since/for" perfect tense, "Myself…", uncountables, question word order, spelling), and
  9 correct sentences that must *not* be flagged (false-positive guard). Filler counting in voice mode.
- **Scoring** — IELTS overall-band rounding (.25 → .5, .75 → next band), listening/reading conversion, criteria
  averaging, answer normalisation, writing evaluation range, speaking caps for very short answers, interview total ≤ 100,
  pronunciation only from voice confidence.
- **Gamification** — streaks (incl. month boundaries), longest streak, levels, achievements unlocked only by real data,
  spaced-repetition intervals, deterministic daily words, progress summary maths.
- **Database security** — signup trigger, owner-only read/write, no cross-user inserts, no self-promotion to admin,
  public read of *published* content only, admin-only writes, operational tables closed, cascading account deletion.
- **E2E** — landing sections & CTA, guest onboarding + persistence after reload, grammar coach + mistake tracker,
  speaking teacher free mode, 30-day challenge completion → streak/XP + WhatsApp link, vocabulary save/flashcard/quiz,
  IELTS reading band, writing four-criteria report, listening map + answer sheet, interview flow to final report,
  progress/community/settings, challenge-a-friend link, AI endpoint graceful fallback & validation, admin APIs reject
  anonymous users, PWA manifest + service worker, **no horizontal overflow on 9 pages at phone width**.

## Not automatable here (manual checks)

- Real microphone transcription and speech synthesis voices (headless browsers have no microphone). The UI paths were
  exercised with typed input; the voice hooks handle `not-allowed`, `no-speech`, `network` and unsupported browsers.
- Supabase sign-up / email / Google OAuth against a live project (RLS and triggers verified on Postgres).
- Calls to paid AI providers (no keys used in testing; adapter errors and fallbacks covered).
- WhatsApp share on a phone and the native share sheet.

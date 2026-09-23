# FITIQ — *Your Body. Your Style. Your Budget.*

AI men's fit & shopping intelligence for India. FITIQ answers four questions for every purchase:

1. **Will this fit my body and preferred silhouette?** → Fit Intelligence Engine, Fit Risk, Purchase Confidence
2. **Will this outfit look balanced on me?** → Outfit Engine, colour harmony, recipes
3. **Can I build it within my budget?** → Outfit Budget Optimizer (Budget Saver / Balanced / Premium)
4. **Where can I buy it at the best currently detected price?** → Multi-store price intelligence, exact-match detection, price history, Deal Score

## Quick start

```bash
cd fitiq
npm install
npm run dev            # http://localhost:3000
npm test               # engine tests (vitest)
npm run build && npm start
```

No environment variables are needed: the app runs in **DEMO MODE** with a labelled demo catalogue (87 models across ~196 retailer listings), simulated price history, and rule-based AI. Every page shows a **DEMO DATA** banner, and demo prices are never presented as live.

### Core journey

*"I'm a slim 5'7 Indian man with a ₹3,000 budget looking for a smart-casual office outfit."*

1. **Home** → *Build my style profile* (or *Skip — use demo persona*)
2. **Onboarding** → body (5'7", 58 kg, chest/waist, build *Slim*), fit (regular tops / straight bottoms), Style DNA (*Smart Casual*), budget ₹3,000, consent
3. **AI Stylist** → occasion *Office*, style *Smart Casual* → Budget Saver / Balanced / Premium outfits, each ≤ ₹3,000, with fit risk, recommended sizes, and a *Why this?* line for every piece
4. **Change** any item (e.g. shoes): budget, fit, style and colour harmony stay fixed, and only that slot changes
5. **Product page** → fit compatibility breakdown, fit risk, purchase confidence, price comparison (exact matches), price history, Deal Score, better-fit and cheaper alternatives, complete the look
6. **I bought this** → fit feedback updates your **Size Map** and future size picks

## Architecture

```
                FITIQ
                  |
      ┌───────────┼────────────┐
   FIT AI      STYLE AI      DEAL AI          src/lib/engines/{fit,harmony,deal}.ts
      └───────────┼────────────┘
            OUTFIT ENGINE                     src/lib/engines/{outfit,recipes}.ts
        ┌─────────┼─────────┐
     WARDROBE  PRODUCTS   PRICES              engines/wardrobe.ts · search/ · engines/price.ts
        └─────────┼─────────┘
          INDIAN RETAILERS                    src/lib/providers/* (adapter per permitted source)
```

| Area | Location |
| --- | --- |
| Domain types (normalized `Product`, profile, outputs) | `src/lib/types.ts` |
| Fit Intelligence: body/silhouette/size/style scores, fit risk, purchase confidence | `src/lib/engines/fit.ts` |
| Outfit engine, budget optimizer, swap, complete-the-look, cheapest outfits | `src/lib/engines/outfit.ts`, `recipes.ts` |
| Exact match vs similar alternative | `src/lib/engines/matching.ts` |
| Cheaper / better-fit alternatives | `src/lib/engines/alternatives.ts` |
| Price stats, freshness · Deal Score | `src/lib/engines/price.ts`, `deal.ts` |
| Wardrobe gaps, utility, owned outfits · style experiments | `src/lib/engines/wardrobe.ts`, `experiments.ts` |
| Trend → personal fit | `src/lib/engines/trends.ts`, `src/lib/data/trends.ts` |
| Natural-language query parsing | `src/lib/engines/nlp.ts` |
| Style scorecard | `src/lib/engines/scorecard.ts` |
| Provider adapters (demo, licensed merchant/affiliate JSON feed) | `src/lib/providers/` |
| Search index interface + in-memory implementation | `src/lib/search/` |
| Provider-agnostic AI (rules default; Anthropic vision adapter) | `src/lib/ai/` |
| Weather (only with a live provider, otherwise no claims) | `src/lib/weather/` |
| Background jobs (product/price sync, trends, recommendations) | `src/lib/jobs/` |
| Field encryption for measurements | `src/lib/security/crypto.ts` |
| PostgreSQL schema + seed | `prisma/schema.prisma`, `prisma/seed.ts` |
| API routes | `src/app/api/**` |
| Admin dashboard (protected by `ADMIN_TOKEN`) | `src/app/admin`, `src/middleware.ts` |

### Adding a retailer

Implement `ProductProvider` (`src/lib/providers/types.ts`) for a **permitted** source such as an official API, affiliate feed, merchant feed or licensed data, then register it in `providers/registry.ts`. Engines and UI need no changes. Adapters must never fabricate fields. They must not scrape in violation of a site's terms, or bypass CAPTCHAs, logins, anti-bot systems or paywalls. They may set `realtime: true` only when the provider contractually delivers real-time prices.

## Environment

See `.env.example`.

| Variable | Purpose |
| --- | --- |
| `DATABASE_URL` | PostgreSQL for persistent users, wardrobe, price history (`npm run db:migrate && npm run db:seed`) |
| `AI_PROVIDER`, `AI_API_KEY`, `AI_MODEL` | `anthropic` enables AI garment labelling for wardrobe and visual search (default model `claude-opus-5`) |
| `PRODUCT_FEED_URL`, `PRODUCT_PROVIDER_KEY` | Licensed JSON product feed. When set, demo data is replaced |
| `AFFILIATE_ID` | Appended to outbound links by providers that permit it |
| `STORAGE_URL` | Private object storage for wardrobe photos (production) |
| `WEATHER_API_KEY` | Enables weather-aware styling from live data |
| `ENCRYPTION_KEY` | 32-byte base64 key for measurement encryption |
| `ADMIN_TOKEN` | Required for `/admin` in production (visit `/admin?token=…` once to set the cookie) |

## Trust & safety rules built into the product

- Scores are **shopping recommendation metrics**. They are not medical or scientific measurements, and not judgements about appearance. The language is neutral: "recommended silhouette", "proportion", "comfort".
- **Exact match** requires the same brand, model identifier and colour. Everything else is labelled **Similar alternative**.
- Price history claims ("lowest detected", "30 days ago") appear only when recorded history exists.
- Every price shows its check time. After 48 hours it carries "⚠️ Price may have changed."
- Deal Score drops any component that has no data and never guesses one.
- Trends without a licensed source are labelled **FITIQ editorial recommendation** and carry no statistics.
- Outfits never exceed the budget unless the user explicitly allows it.
- **Sponsored** items are labelled and excluded from fit scoring and outfit optimisation.
- Photos require explicit consent, are downscaled on the device, are never stored server-side in demo mode, and are never sold.
- In demo mode, personal data stays in the browser. *Delete all my data* removes it.

## Roadmap status

| Phase | Status |
| --- | --- |
| 1: landing, onboarding, profile, demo DB, search + filters, outfit generator, fit scoring, price comparison | ✅ |
| 2: wardrobe, gap analysis, better-fit and cheaper alternatives, budget optimizer, price history | ✅ |
| 3: provider/affiliate architecture ✅, fit feedback ✅, personalised size map ✅, price alerts (schema only), real retailer integrations (need licensed feeds) | partial |
| 4: visual search (closest alternatives) ✅, weather-aware (with provider) ✅, trend compatibility ✅, virtual try-on | partial |

# DriverFare — Earn Smart. Save Daily.

A free, offline savings and expense tracker for Indian drivers (taxi, auto, cab, delivery).
Built from free tools only: no paid APIs, no server, no database bill, no login, no ads, no subscription.

| | |
|---|---|
| **Daily Income** | Many entries per day: date, amount, description |
| **Daily Expenses** | CNG, Petrol, Diesel, Electricity, Food, Toll, Parking, Maintenance, Other |
| **Automatic Savings Wallet** | One automatic allocation per day, plus manual deposits and withdrawals, with full ledger history |
| **Reports** | Daily, weekly (Mon–Sun) and monthly reports: WhatsApp share, CSV export, print / save as PDF |

Languages: English, हिंदी, मराठी. All amounts are shown in Indian format (₹1,23,456).

## How savings are calculated

```
Total Income      = sum of the day's income entries
Total Expenses    = sum of the day's expense entries
Remaining Balance = Income − Expenses
Savings           = Remaining Balance × Savings % ÷ 100   (default 100 %, never negative)
Available Balance = Remaining Balance − Savings
```

Example: income ₹2,000, CNG ₹500 → savings **₹1,500** (at 100 %).

* **Exactly once per day.** A day's automatic allocation has the fixed ID `auto-YYYY-MM-DD`. Adding, editing or deleting that day's entries updates the same record. It can never be added twice.
* **Expenses higher than income?** The app shows a warning and the day's savings are ₹0, never negative.
* **Changing the %** applies from today onwards. Each past allocation keeps the % it was saved with.
* **Withdrawals** cannot be more than the wallet balance on that date. A back-dated withdrawal also cannot make any later day's balance go negative.
* Money is stored as **integer paise**. Every financial write runs in a single **IndexedDB transaction**, so a failed check rolls back the whole change.
* Double-tapping *Save* cannot create duplicate records: each form submission has its own ID. Saving an entry that exactly matches an existing one asks for confirmation first.

## Data storage: please read

All records are stored **only in this browser on this phone** (IndexedDB). There is **no cloud sync**.
**Clearing browser data, uninstalling the browser, or losing the phone can delete your records.**

To protect your data:
1. Go to **Backup → Export full backup (JSON)** regularly. The app reminds you after 7 days without a backup.
2. Keep the file somewhere safe, for example send it to yourself on WhatsApp or save it in Google Drive.
3. To move to a new phone, open DriverFare there and use **Restore from backup**.

Restores are validated (IDs, dates, amounts, categories, no duplicate allocations, no negative balance) and applied all-or-nothing.
The app also asks the browser for persistent storage, which reduces the chance of automatic eviction.

## WhatsApp reports

The **Share on WhatsApp** button uses WhatsApp's official, free click-to-chat link (`https://wa.me/<number>?text=…`).
WhatsApp opens with the report already typed in, and **you press Send yourself**. Nothing is sent automatically, and the WhatsApp Business API is not used.
Leave the number empty to choose a contact inside WhatsApp. A 10-digit Indian number gets the `91` country code added automatically.

## Run locally

Requires Node.js 20+ (free).

```bash
cd driverfare
npm install
npm run dev          # http://localhost:5173
npm test             # unit + IndexedDB integration tests (Vitest + fake-indexeddb)
npm run build        # production build to dist/ (includes service worker + manifest)
npm run preview      # serve the production build locally
```

### Browser end-to-end test (optional)

`e2e/offline-e2e.mjs` drives the production build in Chromium on an emulated Pixel 5. It checks:
* the ₹2,000 / ₹500 → ₹1,500 example
* duplicate prevention
* withdrawals
* WhatsApp links
* CSV export
* JSON backup and restore
* offline reload with offline data entry
* the Marathi UI

It needs Playwright and Chromium:

```bash
npm i -D playwright && npx playwright install chromium
npm run build && npm run test:e2e
```

## Install on Android

1. Open the site in Chrome.
2. Open the menu (⋮) and tap **Add to Home screen** (or **Install app**).
3. DriverFare opens like an app and works without internet. The service worker caches all app files after the first visit.

## Deploy for free

### GitHub Pages (included)

The workflow `.github/workflows/driverfare-pages.yml` runs on every change to `driverfare/`. It runs `npm ci`, `npm test` and `npm run build`. On the repository's default branch it also publishes `dist/` to GitHub Pages.

One-time setup:
1. In the repository, go to **Settings → Pages → Build and deployment → Source** and choose **GitHub Actions**.
2. Merge to the default branch, or run the workflow manually from the **Actions** tab on the default branch.
3. The site appears at `https://<user>.github.io/<repo>/`.

The build uses relative paths (`base: './'`), so it works under any sub-path without changes.

### Cloudflare Pages (alternative)

Connect the repository with these settings:
* Root directory: `driverfare`
* Build command: `npm run build`
* Output directory: `dist`

This works within Cloudflare's free-tier limits.

No credit card, API key or paid plan is needed for either option.

## Project structure

```
driverfare/
├── index.html
├── public/                  icons (SVG + PNG)
├── src/
│   ├── lib/
│   │   ├── money.ts         paise parsing / ₹ formatting
│   │   ├── dates.ts         local dates, Mon–Sun weeks, months
│   │   ├── calc.ts          savings formula, ledger balances, period summaries
│   │   ├── db.ts            Dexie (IndexedDB) schema
│   │   ├── ledger.ts        transactional writes, auto-savings, withdrawals
│   │   ├── reports.ts       WhatsApp messages + click-to-chat URL
│   │   ├── csv.ts           CSV export
│   │   ├── backup.ts        JSON export / validate / restore
│   │   └── settings.ts
│   ├── i18n/                en, hi, mr
│   ├── pages/               Dashboard, Income, Expenses, Wallet, Reports, Backup
│   ├── components/ui.tsx
│   ├── state.tsx            language, toasts, confirm dialogs
│   └── App.tsx              header, hash routing, bottom navigation
├── tests/                   Vitest suites
├── e2e/offline-e2e.mjs      real-browser offline test
├── scripts/make-icons.mjs   regenerates PNG icons from icon.svg
└── vite.config.ts           Vite + PWA (manifest + Workbox service worker)
```

## License

Free to use and modify.

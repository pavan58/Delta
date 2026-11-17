// End-to-end check in a real Chromium on an emulated Android phone.
// Usage: npm run build && npm run test:e2e   (needs Playwright + Chromium available)
import { createRequire } from 'node:module';
import { spawn } from 'node:child_process';
import { readFileSync, mkdirSync } from 'node:fs';
const require = createRequire(import.meta.url);
const { chromium, devices } = require('playwright');

const PORT = 4173;
const URL = `http://localhost:${PORT}/`;
const shots = process.env.SHOTS_DIR || 'test-results';
mkdirSync(shots, { recursive: true });

const server = spawn('npx', ['vite', 'preview', '--port', String(PORT), '--strictPort'], { stdio: 'pipe', detached: true });
await new Promise((res, rej) => {
  server.stdout.on('data', (d) => d.toString().includes('localhost') && res());
  server.on('exit', (c) => rej(new Error('preview exited ' + c)));
  setTimeout(() => rej(new Error('preview timeout')), 20000);
});

let failures = 0;
const check = (name, cond, extra = '') => {
  console.log(`${cond ? '✔' : '✘'} ${name}${extra ? ' — ' + extra : ''}`);
  if (!cond) failures++;
};

/** Poll an element's text until it equals `want` (live IndexedDB queries render asynchronously). */
async function textIs(page, testId, want, timeout = 4000) {
  const end = Date.now() + timeout;
  let got = '';
  while (Date.now() < end) {
    got = await page.getByTestId(testId).innerText().catch(() => '');
    if (got === want) return [true, got];
    await page.waitForTimeout(100);
  }
  return [false, got];
}

const browser = await chromium.launch();
const ctx = await browser.newContext({ ...devices['Pixel 5'], acceptDownloads: true });
const page = await ctx.newPage();
page.on('pageerror', (e) => { console.log('pageerror', e.message); failures++; });

try {
  await page.goto(URL);
  await page.waitForFunction(() => navigator.serviceWorker?.controller || navigator.serviceWorker?.ready, null, { timeout: 15000 });
  await page.evaluate(() => navigator.serviceWorker.ready);
  await page.reload(); // now controlled by the service worker
  check('service worker controls page', await page.evaluate(() => !!navigator.serviceWorker.controller));

  // Income ₹2,000 — double tap Save must not create two records
  await page.goto(URL + '#/income');
  await page.fill('#inc-amount', '2000');
  await page.fill('#inc-desc', 'Booking income');
  await page.locator('form button[type=submit]').dblclick();
  await page.waitForTimeout(400);
  const incomeRows = await page.locator('main li').count();
  check('double tap saves only one income', incomeRows === 1, `rows=${incomeRows}`);

  // Expense CNG ₹500
  await page.goto(URL + '#/expenses');
  await page.getByRole('button', { name: /CNG/ }).first().click();
  await page.fill('#exp-amount', '500');
  await page.locator('form button[type=submit]').click();
  await page.waitForTimeout(300);

  await page.goto(URL + '#/dashboard');
  check('today savings ₹1,500', ...(await textIs(page, 'today-savings', '₹1,500')));
  check('wallet balance ₹1,500', ...(await textIs(page, 'wallet-balance', '₹1,500')));
  await page.screenshot({ path: `${shots}/dashboard.png`, fullPage: true });

  // Withdrawals
  await page.goto(URL + '#/wallet');
  check('max withdrawable ₹1,500', ...(await textIs(page, 'max-withdraw', '₹1,500')));
  await page.fill('#wd-amount', '2000');
  await page.getByRole('button', { name: 'Withdraw' }).last().click();
  check('over-withdrawal blocked', await page.getByRole('alert').filter({ hasText: 'more than' }).isVisible());
  await page.fill('#wd-amount', '400');
  await page.getByRole('button', { name: 'Withdraw' }).last().click();
  await page.waitForTimeout(300);
  check('balance after ₹400 withdrawal is ₹1,100', ...(await textIs(page, 'wallet-current', '₹1,100')));
  await page.screenshot({ path: `${shots}/wallet.png`, fullPage: true });

  // Reports + WhatsApp
  await page.goto(URL + '#/reports');
  await page.locator('details summary').click();
  const daily = await page.getByTestId('wa-preview').innerText();
  check('daily message has income/cng/savings/withdrawal/closing',
    ['Income: ₹2,000', 'CNG expenses: ₹500', 'Savings added: ₹1,500', 'Withdrawals: ₹400', 'Closing wallet balance: ₹1,100'].every((s) => daily.includes(s)), JSON.stringify(daily));
  await page.fill('#wa-num', '9876543210');
  const [popup] = await Promise.all([ctx.waitForEvent('page'), page.getByTestId('share-wa').click()]);
  const waUrl = popup.url();
  await popup.close();
  check('WhatsApp click-to-chat URL', /^https:\/\/(wa\.me|api\.whatsapp\.com)\//.test(waUrl) && waUrl.includes('919876543210'), waUrl.slice(0, 60));
  await page.getByRole('tab', { name: 'Monthly' }).click();
  const monthly = await page.getByTestId('wa-preview').innerText();
  check('monthly message has category breakdown', monthly.includes('CNG: ₹500') && monthly.includes('Net savings growth: ₹1,100'));
  const [csvDl] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Export CSV' }).click()]);
  const csv = readFileSync(await csvDl.path(), 'utf8');
  check('CSV export contains totals', csv.includes('Total income,2000.00') && csv.includes('Expense - CNG,500.00'));
  await page.getByRole('tab', { name: 'Weekly' }).click();
  check('weekly message', (await page.getByTestId('wa-preview').innerText()).includes('Mon–Sun'));
  await page.screenshot({ path: `${shots}/reports.png`, fullPage: true });

  // Backup → erase → restore
  await page.goto(URL + '#/backup');
  const [dl] = await Promise.all([page.waitForEvent('download'), page.getByTestId('export-json').click()]);
  const backupPath = await dl.path();
  const backup = JSON.parse(readFileSync(backupPath, 'utf8'));
  check('backup JSON has records', backup.incomes.length === 1 && backup.expenses.length === 1 && backup.walletTx.length === 2);
  await page.getByRole('button', { name: 'Erase all data' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Yes, delete' }).click();
  await page.waitForTimeout(300);
  await page.getByTestId('import-file').setInputFiles(backupPath);
  await page.getByRole('dialog').getByRole('button', { name: 'Restore from backup' }).click();
  await page.waitForTimeout(400);
  await page.goto(URL + '#/dashboard');
  check('restore brings back wallet ₹1,100', ...(await textIs(page, 'wallet-balance', '₹1,100')));

  // Offline: reload with network cut, app must load from service worker cache and keep working
  await ctx.setOffline(true);
  await page.reload();
  await page.waitForSelector('[data-testid=wallet-balance]', { timeout: 10000 });
  check('app loads offline', true);
  check('offline data intact', ...(await textIs(page, 'wallet-balance', '₹1,100')));
  await page.goto(URL + '#/income');
  await page.fill('#inc-amount', '300');
  await page.locator('form button[type=submit]').click();
  await page.waitForTimeout(300);
  await page.goto(URL + '#/dashboard');
  check('can add income offline', ...(await textIs(page, 'wallet-balance', '₹1,400')));
  await page.screenshot({ path: `${shots}/offline.png`, fullPage: true });

  // Language switch
  await page.selectOption('#lang', 'mr');
  check('Marathi UI', (await page.locator('header').innerText()).includes('हुशारीने कमवा'));
  await page.screenshot({ path: `${shots}/marathi.png`, fullPage: true });
  await ctx.setOffline(false);
} catch (e) {
  console.error(e);
  failures++;
} finally {
  await browser.close();
  try { process.kill(-server.pid); } catch { server.kill(); }
}
console.log(failures ? `\n${failures} check(s) FAILED` : '\nAll e2e checks passed');
process.exit(failures ? 1 : 0);

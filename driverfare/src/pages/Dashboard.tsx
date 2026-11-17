import { useApp } from '../state';
import { useAllData, useToday } from '../hooks';
import { computeSavings, summarizePeriod, walletBalance } from '../lib/calc';
import { formatDate, monthOf, monthRange } from '../lib/dates';
import { sumPaise } from '../lib/money';
import { Row, Stat, Warning } from '../components/ui';
import { go } from '../App';
import { autoTxId } from '../lib/ledger';

const WEEK_MS = 7 * 24 * 3600 * 1000;

export default function Dashboard() {
  const { t, lang, settings } = useApp();
  const today = useToday();
  const { incomes, expenses, txs, loaded } = useAllData();

  const dayIncome = sumPaise(incomes.filter((i) => i.date === today).map((i) => i.amountPaise));
  const dayExpense = sumPaise(expenses.filter((e) => e.date === today).map((e) => e.amountPaise));
  const auto = txs.find((x) => x.id === autoTxId(today));
  const pct = auto?.percent ?? settings.savingsPercent;
  const s = computeSavings(dayIncome, dayExpense, pct);
  const month = summarizePeriod(...Object.values(monthRange(monthOf(today))) as [string, string], incomes, expenses, txs);
  const hasData = incomes.length + expenses.length + txs.length > 0;
  const needsBackup = loaded && hasData && (!settings.lastBackupAt || Date.now() - settings.lastBackupAt > WEEK_MS);

  return (
    <div className="space-y-4">
      {needsBackup && (
        <Warning>
          <div className="flex items-center justify-between gap-3">
            <span>{t('backup_reminder')}</span>
            <button className="btn-navy min-h-[44px] shrink-0 text-base" onClick={() => go('backup')}>{t('backup_now')}</button>
          </div>
        </Warning>
      )}

      <section className="rounded-2xl bg-navy-900 p-4 text-white shadow">
        <div className="text-sm text-slate-300">{t('wallet_balance')}</div>
        <div className="text-4xl font-extrabold tabular-nums text-brand-400" data-testid="wallet-balance">
          {new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 2, minimumFractionDigits: 0 }).format(walletBalance(txs) / 100)}
        </div>
        <div className="mt-3 grid grid-cols-2 gap-3">
          <button className="btn-primary" onClick={() => go('income')}>{t('quick_add_income')}</button>
          <button className="btn border-2 border-white/70 text-white" onClick={() => go('expenses')}>{t('quick_add_expense')}</button>
        </div>
      </section>

      <section className="card">
        <h2 className="mb-2 text-lg font-bold text-navy-900">{t('today')} · {formatDate(today, lang)}</h2>
        <div className="grid grid-cols-2 gap-3">
          <Stat label={t('income')} value={dayIncome} tone="green" testId="today-income" />
          <Stat label={t('expenses')} value={dayExpense} tone="red" testId="today-expenses" />
          <Stat label={t('remaining')} value={s.remainingPaise} tone={s.remainingPaise < 0 ? 'red' : 'navy'} />
          <Stat label={`${t('savings')} (${pct}%)`} value={s.savingsPaise} tone="green" testId="today-savings" />
        </div>
        <div className="mt-3"><Stat label={t('available')} value={s.availablePaise} tone={s.availablePaise < 0 ? 'red' : 'slate'} /></div>
        {s.expensesExceedIncome && <div className="mt-3"><Warning tone="red">{t('warn_exceed')}</Warning></div>}
        <p className="mt-3 text-sm text-slate-600">{t('auto_note')}</p>
      </section>

      <section className="card">
        <h2 className="mb-1 text-lg font-bold text-navy-900">{t('this_month')}</h2>
        <Row label={t('total_income')} value={month.incomePaise} tone="green" />
        <Row label={t('total_expenses')} value={month.expensePaise} tone="red" />
        <Row label={t('savings_added')} value={month.savingsAddedPaise} />
        <Row label={t('withdrawals')} value={month.withdrawalsPaise} />
        <Row label={t('net_growth')} value={month.netSavingsGrowthPaise} bold />
      </section>

      <p className="text-center text-sm text-slate-500">{t('install_hint')}</p>
      <p className="text-center text-xs text-slate-500">{t('privacy')}</p>
    </div>
  );
}

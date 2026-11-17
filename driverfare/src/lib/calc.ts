import type { ISODate } from './dates';
import { inRange } from './dates';
import type { Paise } from './money';
import { sumPaise } from './money';
import type { ExpenseRecord, IncomeRecord, WalletTx, ExpenseCategory } from './types';
import { EXPENSE_CATEGORIES } from './types';

export interface DaySavings {
  incomePaise: Paise;
  expensePaise: Paise;
  /** Income − Expenses (can be negative) */
  remainingPaise: Paise;
  /** Remaining × % / 100, never negative, rounded down to the paisa */
  savingsPaise: Paise;
  /** Remaining − Savings */
  availablePaise: Paise;
  expensesExceedIncome: boolean;
}

export function clampPercent(p: number): number {
  if (!Number.isFinite(p)) return 100;
  return Math.min(100, Math.max(0, Math.round(p)));
}

/** Core DriverFare formula. */
export function computeSavings(incomePaise: Paise, expensePaise: Paise, percent: number): DaySavings {
  const remainingPaise = incomePaise - expensePaise;
  const pct = clampPercent(percent);
  const savingsPaise = remainingPaise > 0 ? Math.floor((remainingPaise * pct) / 100) : 0;
  return {
    incomePaise,
    expensePaise,
    remainingPaise,
    savingsPaise,
    availablePaise: remainingPaise - savingsPaise,
    expensesExceedIncome: expensePaise > incomePaise,
  };
}

export function txSigned(tx: WalletTx): Paise {
  return tx.type === 'withdrawal' ? -tx.amountPaise : tx.amountPaise;
}

const TYPE_ORDER: Record<WalletTx['type'], number> = { auto: 0, deposit: 1, withdrawal: 2 };

/** Chronological ledger order: date, then credits before debits, then creation time. */
export function sortLedger(txs: WalletTx[]): WalletTx[] {
  return [...txs].sort(
    (a, b) =>
      a.date.localeCompare(b.date) ||
      TYPE_ORDER[a.type] - TYPE_ORDER[b.type] ||
      a.createdAt - b.createdAt ||
      a.id.localeCompare(b.id),
  );
}

export interface LedgerRow {
  tx: WalletTx;
  openingPaise: Paise;
  closingPaise: Paise;
}

export function ledgerWithBalances(txs: WalletTx[]): LedgerRow[] {
  let bal = 0;
  return sortLedger(txs).map((tx) => {
    const openingPaise = bal;
    bal += txSigned(tx);
    return { tx, openingPaise, closingPaise: bal };
  });
}

export function walletBalance(txs: WalletTx[]): Paise {
  return sumPaise(txs.map(txSigned));
}

/** Returns the first row where the running balance goes negative, or null if the ledger is valid. */
export function findNegativeBalance(txs: WalletTx[]): LedgerRow | null {
  return ledgerWithBalances(txs).find((r) => r.closingPaise < 0) ?? null;
}

/** Balance at the end of a given date (inclusive). */
export function balanceAsOf(txs: WalletTx[], date: ISODate): Paise {
  return sumPaise(txs.filter((t) => t.date <= date).map(txSigned));
}

/** Maximum amount that can be withdrawn on `date` without any day's balance going negative. */
export function maxWithdrawable(txs: WalletTx[], date: ISODate): Paise {
  const rows = ledgerWithBalances(txs);
  let min = balanceAsOf(txs, date);
  for (const r of rows) if (r.tx.date > date) min = Math.min(min, r.closingPaise);
  return Math.max(0, min);
}

export type CategoryTotals = Record<ExpenseCategory, Paise>;

export function categoryTotals(expenses: ExpenseRecord[]): CategoryTotals {
  const out = Object.fromEntries(EXPENSE_CATEGORIES.map((c) => [c, 0])) as CategoryTotals;
  for (const e of expenses) out[e.category] += e.amountPaise;
  return out;
}

export interface PeriodSummary {
  from: ISODate;
  to: ISODate;
  incomePaise: Paise;
  expensePaise: Paise;
  remainingPaise: Paise;
  byCategory: CategoryTotals;
  cngPaise: Paise;
  otherExpensePaise: Paise;
  autoSavingsPaise: Paise;
  depositsPaise: Paise;
  /** auto + manual deposits */
  savingsAddedPaise: Paise;
  withdrawalsPaise: Paise;
  netSavingsGrowthPaise: Paise;
  openingBalancePaise: Paise;
  closingBalancePaise: Paise;
  incomeCount: number;
  expenseCount: number;
}

export function summarizePeriod(
  from: ISODate,
  to: ISODate,
  incomes: IncomeRecord[],
  expenses: ExpenseRecord[],
  txs: WalletTx[],
): PeriodSummary {
  const inc = incomes.filter((i) => inRange(i.date, from, to));
  const exp = expenses.filter((e) => inRange(e.date, from, to));
  const periodTx = txs.filter((t) => inRange(t.date, from, to));
  const incomePaise = sumPaise(inc.map((i) => i.amountPaise));
  const expensePaise = sumPaise(exp.map((e) => e.amountPaise));
  const byCategory = categoryTotals(exp);
  const autoSavingsPaise = sumPaise(periodTx.filter((t) => t.type === 'auto').map((t) => t.amountPaise));
  const depositsPaise = sumPaise(periodTx.filter((t) => t.type === 'deposit').map((t) => t.amountPaise));
  const withdrawalsPaise = sumPaise(periodTx.filter((t) => t.type === 'withdrawal').map((t) => t.amountPaise));
  const openingBalancePaise = sumPaise(txs.filter((t) => t.date < from).map(txSigned));
  const savingsAddedPaise = autoSavingsPaise + depositsPaise;
  const netSavingsGrowthPaise = savingsAddedPaise - withdrawalsPaise;
  return {
    from,
    to,
    incomePaise,
    expensePaise,
    remainingPaise: incomePaise - expensePaise,
    byCategory,
    cngPaise: byCategory.CNG,
    otherExpensePaise: expensePaise - byCategory.CNG,
    autoSavingsPaise,
    depositsPaise,
    savingsAddedPaise,
    withdrawalsPaise,
    netSavingsGrowthPaise,
    openingBalancePaise,
    closingBalancePaise: openingBalancePaise + netSavingsGrowthPaise,
    incomeCount: inc.length,
    expenseCount: exp.length,
  };
}

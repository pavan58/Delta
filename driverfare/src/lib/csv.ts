import type { PeriodSummary } from './calc';
import { inRange } from './dates';
import { paiseToDecimalString } from './money';
import type { ExpenseRecord, IncomeRecord, WalletTx } from './types';
import { EXPENSE_CATEGORIES } from './types';

export function csvCell(v: string | number): string {
  let s = String(v);
  // Neutralise spreadsheet formula injection
  if (typeof v === 'string' && /^[=+\-@\t\r]/.test(s) && !/^-?\d+(\.\d+)?$/.test(s)) s = `'${s}`;
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function toCsv(rows: (string | number)[][]): string {
  return rows.map((r) => r.map(csvCell).join(',')).join('\r\n');
}

/** Monthly (or any period) CSV: a summary block followed by every transaction. */
export function buildPeriodCsv(
  s: PeriodSummary,
  incomes: IncomeRecord[],
  expenses: ExpenseRecord[],
  txs: WalletTx[],
): string {
  const rows: (string | number)[][] = [];
  rows.push(['DriverFare Report', `${s.from} to ${s.to}`]);
  rows.push([]);
  rows.push(['Summary', 'Amount (INR)']);
  rows.push(['Total income', paiseToDecimalString(s.incomePaise)]);
  rows.push(['Total expenses', paiseToDecimalString(s.expensePaise)]);
  for (const c of EXPENSE_CATEGORIES) rows.push([`Expense - ${c}`, paiseToDecimalString(s.byCategory[c])]);
  rows.push(['Savings added', paiseToDecimalString(s.savingsAddedPaise)]);
  rows.push(['Withdrawals', paiseToDecimalString(s.withdrawalsPaise)]);
  rows.push(['Net savings growth', paiseToDecimalString(s.netSavingsGrowthPaise)]);
  rows.push(['Opening wallet balance', paiseToDecimalString(s.openingBalancePaise)]);
  rows.push(['Closing wallet balance', paiseToDecimalString(s.closingBalancePaise)]);
  rows.push([]);
  rows.push(['Date', 'Type', 'Category', 'Description', 'Amount (INR)', 'ID']);
  type Row = { date: string; created: number; cells: (string | number)[] };
  const list: Row[] = [];
  for (const i of incomes.filter((x) => inRange(x.date, s.from, s.to)))
    list.push({ date: i.date, created: i.createdAt, cells: [i.date, 'Income', '', i.description, paiseToDecimalString(i.amountPaise), i.id] });
  for (const e of expenses.filter((x) => inRange(x.date, s.from, s.to)))
    list.push({ date: e.date, created: e.createdAt, cells: [e.date, 'Expense', e.category, e.description, paiseToDecimalString(e.amountPaise), e.id] });
  for (const t of txs.filter((x) => inRange(x.date, s.from, s.to) && x.amountPaise > 0)) {
    const type = t.type === 'auto' ? `Auto savings (${t.percent ?? 100}%)` : t.type === 'deposit' ? 'Savings added' : 'Withdrawal';
    list.push({ date: t.date, created: t.createdAt, cells: [t.date, type, '', t.note, paiseToDecimalString(t.type === 'withdrawal' ? -t.amountPaise : t.amountPaise), t.id] });
  }
  list.sort((a, b) => a.date.localeCompare(b.date) || a.created - b.created);
  rows.push(...list.map((r) => r.cells));
  return '﻿' + toCsv(rows); // BOM so Excel opens UTF-8 correctly
}

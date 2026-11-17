/**
 * All financial writes go through this module. Every write runs inside a single
 * IndexedDB read-write transaction so income/expense records and the automatic
 * savings allocation can never get out of sync.
 */
import { db, newId } from './db';
import type { ISODate } from './dates';
import { isISODate } from './dates';
import type { Paise } from './money';
import { MAX_AMOUNT_PAISE, sumPaise } from './money';
import { clampPercent, computeSavings, findNegativeBalance, maxWithdrawable } from './calc';
import type { ExpenseCategory, ExpenseRecord, IncomeRecord, WalletTx } from './types';
import { EXPENSE_CATEGORIES } from './types';
import { DEFAULT_SETTINGS } from './settings';

export class LedgerError extends Error {
  constructor(public code: 'INVALID_AMOUNT' | 'INVALID_DATE' | 'INVALID_CATEGORY' | 'INSUFFICIENT_BALANCE' | 'WOULD_GO_NEGATIVE' | 'NOT_FOUND', message?: string) {
    super(message ?? code);
    this.name = 'LedgerError';
  }
}

export const autoTxId = (date: ISODate) => `auto-${date}`;

function assertAmount(p: Paise) {
  if (!Number.isSafeInteger(p) || p <= 0 || p > MAX_AMOUNT_PAISE) throw new LedgerError('INVALID_AMOUNT');
}
function assertDate(d: ISODate) {
  if (!isISODate(d)) throw new LedgerError('INVALID_DATE');
}
function cleanText(s: string | undefined): string {
  return (s ?? '').trim().slice(0, 200);
}

async function currentPercent(): Promise<number> {
  const row = await db.settings.get('savingsPercent');
  return clampPercent(typeof row?.value === 'number' ? row.value : DEFAULT_SETTINGS.savingsPercent);
}

async function assertLedgerNonNegative() {
  const all = await db.walletTx.toArray();
  const bad = findNegativeBalance(all);
  if (bad) throw new LedgerError('WOULD_GO_NEGATIVE', `Wallet balance would become negative on ${bad.tx.date}`);
}

/**
 * Recalculate the single automatic savings allocation for a date.
 * The record id is deterministic (`auto-<date>`) so repeated calls UPDATE the same row
 * instead of adding a second allocation – this is the duplicate-prevention guarantee.
 * The % stored on an existing allocation is reused so changing the global % later
 * never rewrites history. Must be called inside a transaction.
 */
async function recomputeAutoSavings(date: ISODate, overridePercent?: number): Promise<WalletTx | null> {
  const [incomes, expenses, existing] = await Promise.all([
    db.incomes.where('date').equals(date).toArray(),
    db.expenses.where('date').equals(date).toArray(),
    db.walletTx.get(autoTxId(date)),
  ]);
  const incomePaise = sumPaise(incomes.map((i) => i.amountPaise));
  const expensePaise = sumPaise(expenses.map((e) => e.amountPaise));
  if (incomes.length === 0 && expenses.length === 0) {
    if (existing) await db.walletTx.delete(existing.id);
    return null;
  }
  const percent = overridePercent ?? existing?.percent ?? (await currentPercent());
  const s = computeSavings(incomePaise, expensePaise, percent);
  const now = Date.now();
  const tx: WalletTx = {
    id: autoTxId(date),
    date,
    type: 'auto',
    amountPaise: s.savingsPaise,
    note: 'Automatic daily savings',
    percent: clampPercent(percent),
    basePaise: s.remainingPaise,
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
  };
  await db.walletTx.put(tx);
  return tx;
}

const RW = () => [db.incomes, db.expenses, db.walletTx, db.settings];

export interface IncomeInput {
  id?: string; // idempotency key from the form – a double tap re-writes the same record
  date: ISODate;
  amountPaise: Paise;
  description?: string;
}

export async function addIncome(input: IncomeInput): Promise<IncomeRecord> {
  assertDate(input.date);
  assertAmount(input.amountPaise);
  return db.transaction('rw', RW(), async () => {
    const prev = input.id ? await db.incomes.get(input.id) : undefined;
    const rec: IncomeRecord = {
      id: input.id ?? newId(),
      date: input.date,
      amountPaise: input.amountPaise,
      description: cleanText(input.description) || 'Income',
      createdAt: prev?.createdAt ?? Date.now(),
    };
    await db.incomes.put(rec);
    if (prev && prev.date !== rec.date) await recomputeAutoSavings(prev.date);
    await recomputeAutoSavings(rec.date);
    await assertLedgerNonNegative();
    return rec;
  });
}

export interface ExpenseInput {
  id?: string;
  date: ISODate;
  category: ExpenseCategory;
  amountPaise: Paise;
  description?: string;
}

export async function addExpense(input: ExpenseInput): Promise<ExpenseRecord> {
  assertDate(input.date);
  assertAmount(input.amountPaise);
  if (!EXPENSE_CATEGORIES.includes(input.category)) throw new LedgerError('INVALID_CATEGORY');
  return db.transaction('rw', RW(), async () => {
    const prev = input.id ? await db.expenses.get(input.id) : undefined;
    const rec: ExpenseRecord = {
      id: input.id ?? newId(),
      date: input.date,
      category: input.category,
      amountPaise: input.amountPaise,
      description: cleanText(input.description),
      createdAt: prev?.createdAt ?? Date.now(),
    };
    await db.expenses.put(rec);
    if (prev && prev.date !== rec.date) await recomputeAutoSavings(prev.date);
    await recomputeAutoSavings(rec.date);
    await assertLedgerNonNegative();
    return rec;
  });
}

export async function deleteIncome(id: string): Promise<void> {
  await db.transaction('rw', RW(), async () => {
    const rec = await db.incomes.get(id);
    if (!rec) throw new LedgerError('NOT_FOUND');
    await db.incomes.delete(id);
    await recomputeAutoSavings(rec.date);
    await assertLedgerNonNegative();
  });
}

export async function deleteExpense(id: string): Promise<void> {
  await db.transaction('rw', RW(), async () => {
    const rec = await db.expenses.get(id);
    if (!rec) throw new LedgerError('NOT_FOUND');
    await db.expenses.delete(id);
    await recomputeAutoSavings(rec.date);
    await assertLedgerNonNegative();
  });
}

export interface WalletInput {
  id?: string;
  date: ISODate;
  amountPaise: Paise;
  note?: string;
}

export async function addSavings(input: WalletInput): Promise<WalletTx> {
  assertDate(input.date);
  assertAmount(input.amountPaise);
  return db.transaction('rw', RW(), async () => {
    const id = input.id ?? newId();
    const prev = await db.walletTx.get(id);
    const now = Date.now();
    const tx: WalletTx = { id, date: input.date, type: 'deposit', amountPaise: input.amountPaise, note: cleanText(input.note) || 'Savings added', createdAt: prev?.createdAt ?? now, updatedAt: now };
    await db.walletTx.put(tx);
    await assertLedgerNonNegative();
    return tx;
  });
}

/** Withdrawals can never exceed the wallet balance available on that date (or make any later day negative). */
export async function withdraw(input: WalletInput): Promise<WalletTx> {
  assertDate(input.date);
  assertAmount(input.amountPaise);
  return db.transaction('rw', RW(), async () => {
    const id = input.id ?? newId();
    const prev = await db.walletTx.get(id);
    if (prev) return prev; // idempotent: same form submission twice
    const all = await db.walletTx.toArray();
    const max = maxWithdrawable(all, input.date);
    if (input.amountPaise > max) throw new LedgerError('INSUFFICIENT_BALANCE', `Maximum withdrawable is ${max} paise`);
    const now = Date.now();
    const tx: WalletTx = { id, date: input.date, type: 'withdrawal', amountPaise: input.amountPaise, note: cleanText(input.note) || 'Withdrawal', createdAt: now, updatedAt: now };
    await db.walletTx.put(tx);
    await assertLedgerNonNegative();
    return tx;
  });
}

/** Delete a manual deposit or withdrawal. Automatic allocations follow income/expense records. */
export async function deleteWalletTx(id: string): Promise<void> {
  await db.transaction('rw', RW(), async () => {
    const tx = await db.walletTx.get(id);
    if (!tx) throw new LedgerError('NOT_FOUND');
    if (tx.type === 'auto') throw new LedgerError('NOT_FOUND', 'Automatic savings follow income and expense entries');
    await db.walletTx.delete(id);
    await assertLedgerNonNegative();
  });
}

/**
 * Change the savings %. Past days keep the % they were saved with (history is preserved);
 * the new % applies from `effectiveFrom` (normally today) onwards.
 */
export async function setSavingsPercent(percent: number, effectiveFrom: ISODate): Promise<void> {
  const p = clampPercent(percent);
  await db.transaction('rw', RW(), async () => {
    await db.settings.put({ key: 'savingsPercent', value: p });
    const affected = await db.walletTx.where('[type+date]').between(['auto', effectiveFrom], ['auto', '9999-12-31'], true, true).toArray();
    for (const tx of affected) await recomputeAutoSavings(tx.date, p);
    await assertLedgerNonNegative();
  });
}

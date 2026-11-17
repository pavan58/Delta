import { db } from './db';
import { isISODate } from './dates';
import { findNegativeBalance } from './calc';
import { MAX_AMOUNT_PAISE } from './money';
import type { BackupFile, ExpenseRecord, IncomeRecord, SettingRow, WalletTx } from './types';
import { EXPENSE_CATEGORIES } from './types';

export async function exportBackup(now = new Date()): Promise<BackupFile> {
  return db.transaction('r', [db.incomes, db.expenses, db.walletTx, db.settings], async () => ({
    app: 'DriverFare' as const,
    schemaVersion: 1 as const,
    exportedAt: now.toISOString(),
    incomes: await db.incomes.toArray(),
    expenses: await db.expenses.toArray(),
    walletTx: await db.walletTx.toArray(),
    settings: (await db.settings.toArray()).filter((s) => s.key !== 'lastBackupAt'),
  }));
}

const isAmount = (v: unknown) => typeof v === 'number' && Number.isSafeInteger(v) && v >= 0 && v <= MAX_AMOUNT_PAISE;
const isStr = (v: unknown) => typeof v === 'string';
const isNum = (v: unknown) => typeof v === 'number' && Number.isFinite(v);

export class BackupError extends Error {}

/** Strictly validates a parsed backup. Throws BackupError with the first problem found. */
export function validateBackup(data: unknown): BackupFile {
  const d = data as Partial<BackupFile>;
  if (!d || typeof d !== 'object' || d.app !== 'DriverFare' || d.schemaVersion !== 1) throw new BackupError('Not a DriverFare backup');
  if (![d.incomes, d.expenses, d.walletTx, d.settings].every(Array.isArray)) throw new BackupError('Missing tables');
  const ids = new Set<string>();
  const uniq = (id: string, where: string) => {
    if (!isStr(id) || !id || ids.has(`${where}:${id}`)) throw new BackupError(`Bad or duplicate id in ${where}`);
    ids.add(`${where}:${id}`);
  };
  for (const i of d.incomes as IncomeRecord[]) {
    uniq(i.id, 'incomes');
    if (!isISODate(i.date) || !isAmount(i.amountPaise) || i.amountPaise === 0 || !isStr(i.description) || !isNum(i.createdAt)) throw new BackupError('Invalid income record');
  }
  for (const e of d.expenses as ExpenseRecord[]) {
    uniq(e.id, 'expenses');
    if (!isISODate(e.date) || !isAmount(e.amountPaise) || e.amountPaise === 0 || !EXPENSE_CATEGORIES.includes(e.category) || !isStr(e.description) || !isNum(e.createdAt)) throw new BackupError('Invalid expense record');
  }
  const autoDates = new Set<string>();
  for (const t of d.walletTx as WalletTx[]) {
    uniq(t.id, 'walletTx');
    if (!isISODate(t.date) || !isAmount(t.amountPaise) || !['auto', 'deposit', 'withdrawal'].includes(t.type) || !isStr(t.note) || !isNum(t.createdAt)) throw new BackupError('Invalid wallet transaction');
    if (t.type === 'auto') {
      if (t.id !== `auto-${t.date}` || autoDates.has(t.date)) throw new BackupError('Duplicate automatic savings');
      autoDates.add(t.date);
    }
  }
  if (findNegativeBalance(d.walletTx as WalletTx[])) throw new BackupError('Wallet balance goes negative');
  for (const s of d.settings as SettingRow[]) if (!isStr(s.key)) throw new BackupError('Invalid setting');
  return d as BackupFile;
}

/** Replaces all local data with the backup inside one transaction (all-or-nothing). */
export async function restoreBackup(data: unknown): Promise<{ incomes: number; expenses: number; walletTx: number }> {
  const b = validateBackup(data);
  await db.transaction('rw', [db.incomes, db.expenses, db.walletTx, db.settings], async () => {
    const lastBackup = await db.settings.get('lastBackupAt');
    await Promise.all([db.incomes.clear(), db.expenses.clear(), db.walletTx.clear(), db.settings.clear()]);
    await db.incomes.bulkAdd(b.incomes);
    await db.expenses.bulkAdd(b.expenses);
    await db.walletTx.bulkAdd(b.walletTx);
    await db.settings.bulkPut(b.settings.filter((s) => s.key !== 'lastBackupAt'));
    if (lastBackup) await db.settings.put(lastBackup);
  });
  return { incomes: b.incomes.length, expenses: b.expenses.length, walletTx: b.walletTx.length };
}

export async function eraseAll(): Promise<void> {
  await db.transaction('rw', [db.incomes, db.expenses, db.walletTx, db.settings], async () => {
    await Promise.all([db.incomes.clear(), db.expenses.clear(), db.walletTx.clear(), db.settings.clear()]);
  });
}

export function downloadText(filename: string, text: string, mime: string): void {
  const blob = new Blob([text], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

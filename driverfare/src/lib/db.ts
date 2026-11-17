import Dexie, { type Table } from 'dexie';
import type { ExpenseRecord, IncomeRecord, SettingRow, WalletTx } from './types';

export class DriverFareDB extends Dexie {
  incomes!: Table<IncomeRecord, string>;
  expenses!: Table<ExpenseRecord, string>;
  walletTx!: Table<WalletTx, string>;
  settings!: Table<SettingRow, string>;

  constructor(name = 'driverfare') {
    super(name);
    this.version(1).stores({
      incomes: 'id, date, createdAt',
      expenses: 'id, date, category, createdAt',
      walletTx: 'id, date, type, [type+date], createdAt',
      settings: 'key',
    });
  }
}

export let db = new DriverFareDB();

/** Used by tests to get a fresh database. */
export function setDatabase(next: DriverFareDB): void {
  db = next;
}

export function newId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
  // Fallback for very old browsers
  return 'id-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 12);
}

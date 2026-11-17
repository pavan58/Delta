import type { ISODate } from './dates';
import type { Paise } from './money';

export const EXPENSE_CATEGORIES = [
  'CNG', 'Petrol', 'Diesel', 'Electricity', 'Food', 'Toll', 'Parking', 'Maintenance', 'Other',
] as const;
export type ExpenseCategory = (typeof EXPENSE_CATEGORIES)[number];

export interface IncomeRecord {
  id: string;
  date: ISODate;
  amountPaise: Paise;
  description: string;
  createdAt: number;
}

export interface ExpenseRecord {
  id: string;
  date: ISODate;
  category: ExpenseCategory;
  amountPaise: Paise;
  description: string;
  createdAt: number;
}

/**
 * Savings wallet ledger.
 *  - auto: the one automatic allocation for a day. Its id is always `auto-YYYY-MM-DD`,
 *          so a day can never receive two automatic allocations.
 *  - deposit: manual "add savings".
 *  - withdrawal: money taken out of the wallet.
 * amountPaise is always >= 0; the type decides the sign.
 */
export type WalletTxType = 'auto' | 'deposit' | 'withdrawal';

export interface WalletTx {
  id: string;
  date: ISODate;
  type: WalletTxType;
  amountPaise: Paise;
  note: string;
  /** For auto allocations: the savings % used (kept so history survives % changes). */
  percent?: number;
  /** For auto allocations: the day's remaining balance the % was applied to. */
  basePaise?: Paise;
  createdAt: number;
  updatedAt: number;
}

export interface SettingRow {
  key: string;
  value: unknown;
}

export interface BackupFile {
  app: 'DriverFare';
  schemaVersion: 1;
  exportedAt: string;
  incomes: IncomeRecord[];
  expenses: ExpenseRecord[];
  walletTx: WalletTx[];
  settings: SettingRow[];
}

import { useLiveQuery } from 'dexie-react-hooks';
import { useEffect, useState } from 'react';
import { db } from './lib/db';
import type { ExpenseRecord, IncomeRecord, WalletTx } from './lib/types';
import { todayISO } from './lib/dates';

export interface AllData { incomes: IncomeRecord[]; expenses: ExpenseRecord[]; txs: WalletTx[]; loaded: boolean }

/** Live view of all local records (re-renders automatically after any IndexedDB write). */
export function useAllData(): AllData {
  const data = useLiveQuery(async () => {
    const [incomes, expenses, txs] = await Promise.all([db.incomes.toArray(), db.expenses.toArray(), db.walletTx.toArray()]);
    return { incomes, expenses, txs };
  }, []);
  return data ? { ...data, loaded: true } : { incomes: [], expenses: [], txs: [], loaded: false };
}

/** Today's date, refreshed when the app comes back to the foreground (e.g. after midnight). */
export function useToday(): string {
  const [today, setToday] = useState(todayISO());
  useEffect(() => {
    const tick = () => setToday(todayISO());
    const id = window.setInterval(tick, 60_000);
    document.addEventListener('visibilitychange', tick);
    return () => { window.clearInterval(id); document.removeEventListener('visibilitychange', tick); };
  }, []);
  return today;
}

export function useOnline(): boolean {
  const [online, setOnline] = useState(navigator.onLine);
  useEffect(() => {
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    return () => { window.removeEventListener('online', on); window.removeEventListener('offline', off); };
  }, []);
  return online;
}

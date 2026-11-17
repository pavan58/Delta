import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { DriverFareDB, setDatabase, db } from '../src/lib/db';
import { addExpense, addIncome, addSavings, deleteExpense, deleteIncome, setSavingsPercent, withdraw, LedgerError, autoTxId } from '../src/lib/ledger';
import { summarizePeriod, walletBalance } from '../src/lib/calc';
import { exportBackup, restoreBackup, validateBackup } from '../src/lib/backup';
import { buildPeriodCsv } from '../src/lib/csv';
import { buildReportMessage, whatsappUrl } from '../src/lib/reports';
import { makeT } from '../src/i18n';
import { weekRange, monthRange } from '../src/lib/dates';

let n = 0;
beforeEach(async () => {
  setDatabase(new DriverFareDB(`test-${n++}`));
  await db.open();
});

const D = '2026-11-17';
const all = async () => ({ incomes: await db.incomes.toArray(), expenses: await db.expenses.toArray(), txs: await db.walletTx.toArray() });

describe('automatic savings via IndexedDB', () => {
  it('₹2,000 income + ₹500 CNG → wallet gets exactly ₹1,500 once', async () => {
    await addIncome({ date: D, amountPaise: 200000, description: 'Booking income' });
    await addExpense({ date: D, category: 'CNG', amountPaise: 50000 });
    const txs = await db.walletTx.toArray();
    expect(txs).toHaveLength(1);
    expect(txs[0].id).toBe(autoTxId(D));
    expect(txs[0].amountPaise).toBe(150000);
    expect(txs[0].percent).toBe(100);
    expect(walletBalance(txs)).toBe(150000);
  });

  it('handles multiple incomes and expenses in a day with a single allocation', async () => {
    await addIncome({ date: D, amountPaise: 120000 });
    await addIncome({ date: D, amountPaise: 80000 });
    await addIncome({ date: D, amountPaise: 50050 });
    await addExpense({ date: D, category: 'CNG', amountPaise: 50000 });
    await addExpense({ date: D, category: 'Food', amountPaise: 15000 });
    await addExpense({ date: D, category: 'Toll', amountPaise: 7500 });
    const { txs, incomes, expenses } = await all();
    expect(incomes).toHaveLength(3);
    expect(expenses).toHaveLength(3);
    expect(txs).toHaveLength(1);
    expect(txs[0].amountPaise).toBe(250050 - 72500);
  });

  it('prevents duplicate records when the same form submission is saved twice', async () => {
    const id = 'form-key-1';
    await addIncome({ id, date: D, amountPaise: 200000 });
    await addIncome({ id, date: D, amountPaise: 200000 });
    await Promise.all([addExpense({ id: 'e1', date: D, category: 'CNG', amountPaise: 50000 }), addExpense({ id: 'e1', date: D, category: 'CNG', amountPaise: 50000 })]);
    const { incomes, expenses, txs } = await all();
    expect(incomes).toHaveLength(1);
    expect(expenses).toHaveLength(1);
    expect(txs).toHaveLength(1);
    expect(txs[0].amountPaise).toBe(150000);
  });

  it('expenses above income give zero savings, never negative', async () => {
    await addIncome({ date: D, amountPaise: 30000 });
    await addExpense({ date: D, category: 'Maintenance', amountPaise: 90000 });
    const txs = await db.walletTx.toArray();
    expect(txs[0].amountPaise).toBe(0);
    expect(walletBalance(txs)).toBe(0);
  });

  it('deleting entries updates the allocation and removes it when the day is empty', async () => {
    const inc = await addIncome({ date: D, amountPaise: 200000 });
    const exp = await addExpense({ date: D, category: 'CNG', amountPaise: 50000 });
    await deleteExpense(exp.id);
    expect((await db.walletTx.get(autoTxId(D)))!.amountPaise).toBe(200000);
    await deleteIncome(inc.id);
    expect(await db.walletTx.count()).toBe(0);
  });

  it('keeps historical % when the savings percentage changes', async () => {
    await addIncome({ date: '2026-11-16', amountPaise: 100000 });
    await setSavingsPercent(50, '2026-11-17');
    await addIncome({ date: '2026-11-17', amountPaise: 100000 });
    await addIncome({ date: '2026-11-16', amountPaise: 100000 }); // edit to an old day keeps its 100%
    expect((await db.walletTx.get(autoTxId('2026-11-16')))!.amountPaise).toBe(200000);
    expect((await db.walletTx.get(autoTxId('2026-11-17')))!.amountPaise).toBe(50000);
    expect((await db.walletTx.get(autoTxId('2026-11-17')))!.percent).toBe(50);
  });
});

describe('withdrawals', () => {
  it('records withdrawals and blocks amounts above balance', async () => {
    await addIncome({ date: D, amountPaise: 200000 });
    await addExpense({ date: D, category: 'CNG', amountPaise: 50000 });
    await withdraw({ date: D, amountPaise: 40000, note: 'Home' });
    expect(walletBalance(await db.walletTx.toArray())).toBe(110000);
    await expect(withdraw({ date: D, amountPaise: 110001 })).rejects.toMatchObject({ code: 'INSUFFICIENT_BALANCE' });
    await withdraw({ date: D, amountPaise: 110000 });
    expect(walletBalance(await db.walletTx.toArray())).toBe(0);
  });

  it('blocks withdrawals dated before the savings existed', async () => {
    await addIncome({ date: D, amountPaise: 200000 });
    await expect(withdraw({ date: '2026-11-10', amountPaise: 100 })).rejects.toBeInstanceOf(LedgerError);
  });

  it('blocks edits that would make the wallet negative after a withdrawal (all-or-nothing)', async () => {
    await addIncome({ date: D, amountPaise: 200000 });
    await withdraw({ date: D, amountPaise: 150000 });
    await expect(addExpense({ date: D, category: 'Food', amountPaise: 100000 })).rejects.toMatchObject({ code: 'WOULD_GO_NEGATIVE' });
    expect(await db.expenses.count()).toBe(0); // transaction rolled back
    expect((await db.walletTx.get(autoTxId(D)))!.amountPaise).toBe(200000);
  });

  it('manual deposits add to the wallet', async () => {
    await addSavings({ date: D, amountPaise: 25000 });
    await withdraw({ date: D, amountPaise: 25000 });
    expect(walletBalance(await db.walletTx.toArray())).toBe(0);
  });
});

async function seedWeek() {
  // Mon 16 – Sun 22 Nov 2026
  await addIncome({ date: '2026-11-15', amountPaise: 100000 }); // previous Sunday → opening balance
  await addIncome({ date: '2026-11-16', amountPaise: 200000 });
  await addExpense({ date: '2026-11-16', category: 'CNG', amountPaise: 50000 });
  await addIncome({ date: '2026-11-18', amountPaise: 180000 });
  await addExpense({ date: '2026-11-18', category: 'Toll', amountPaise: 10000 });
  await addExpense({ date: '2026-11-18', category: 'Food', amountPaise: 20000 });
  await withdraw({ date: '2026-11-20', amountPaise: 100000 });
  await addIncome({ date: '2026-11-23', amountPaise: 999900 }); // next Monday – excluded
}

describe('reports', () => {
  it('weekly report (Mon–Sun)', async () => {
    await seedWeek();
    const { incomes, expenses, txs } = await all();
    const { from, to } = weekRange('2026-11-19');
    const s = summarizePeriod(from, to, incomes, expenses, txs);
    expect(s.incomePaise).toBe(380000);
    expect(s.expensePaise).toBe(80000);
    expect(s.byCategory.CNG).toBe(50000);
    expect(s.byCategory.Toll).toBe(10000);
    expect(s.byCategory.Food).toBe(20000);
    expect(s.savingsAddedPaise).toBe(300000);
    expect(s.withdrawalsPaise).toBe(100000);
    expect(s.netSavingsGrowthPaise).toBe(200000);
    expect(s.openingBalancePaise).toBe(100000);
    expect(s.closingBalancePaise).toBe(300000);
  });

  it('monthly report and CSV', async () => {
    await seedWeek();
    await addIncome({ date: '2026-10-31', amountPaise: 50000 });
    const { incomes, expenses, txs } = await all();
    const { from, to } = monthRange('2026-11');
    const s = summarizePeriod(from, to, incomes, expenses, txs);
    expect(s.incomePaise).toBe(100000 + 380000 + 999900);
    expect(s.openingBalancePaise).toBe(50000);
    expect(s.closingBalancePaise).toBe(50000 + 100000 + 300000 + 999900 - 100000);
    const csv = buildPeriodCsv(s, incomes, expenses, txs);
    expect(csv.startsWith('﻿')).toBe(true);
    expect(csv).toContain('Total income,14799.00');
    expect(csv).toContain('Expense - CNG,500.00');
    expect(csv).toContain('2026-11-20,Withdrawal,,Withdrawal,-1000.00');
    expect(csv).not.toContain('2026-10-31');
  });

  it('builds WhatsApp messages and click-to-chat URL', async () => {
    await addIncome({ date: D, amountPaise: 200000, description: 'Booking income' });
    await addExpense({ date: D, category: 'CNG', amountPaise: 50000 });
    const { incomes, expenses, txs } = await all();
    const s = summarizePeriod(D, D, incomes, expenses, txs);
    const msg = buildReportMessage('daily', s, makeT('en'));
    expect(msg).toContain('Income: ₹2,000');
    expect(msg).toContain('CNG expenses: ₹500');
    expect(msg).toContain('Other expenses: ₹0');
    expect(msg).toContain('Savings added: ₹1,500');
    expect(msg).toContain('Withdrawals: ₹0');
    expect(msg).toContain('*Closing wallet balance: ₹1,500*');
    const url = whatsappUrl(msg, '98765 43210');
    expect(url.startsWith('https://wa.me/919876543210?text=')).toBe(true);
    expect(decodeURIComponent(url.split('text=')[1])).toBe(msg);
    expect(whatsappUrl('hi')).toBe('https://wa.me/?text=hi');
    const weekly = buildReportMessage('weekly', summarizePeriod('2026-11-16', '2026-11-22', incomes, expenses, txs), makeT('hi'), 'hi');
    expect(weekly).toContain('साप्ताहिक रिपोर्ट');
    expect(weekly).toContain('CNG: ₹500');
  });
});

describe('backup & restore', () => {
  it('round-trips a JSON backup exactly', async () => {
    await seedWeek();
    await setSavingsPercent(80, '2026-12-01');
    const backup = JSON.parse(JSON.stringify(await exportBackup()));
    const before = await all();
    setDatabase(new DriverFareDB(`restore-${n++}`));
    await db.open();
    await addIncome({ date: D, amountPaise: 1 }); // will be replaced
    const res = await restoreBackup(backup);
    expect(res.incomes).toBe(before.incomes.length);
    const after = await all();
    const byId = <T extends { id: string }>(a: T[]) => [...a].sort((x, y) => x.id.localeCompare(y.id));
    expect(byId(after.incomes)).toEqual(byId(before.incomes));
    expect(byId(after.expenses)).toEqual(byId(before.expenses));
    expect(byId(after.txs)).toEqual(byId(before.txs));
    expect((await db.settings.get('savingsPercent'))!.value).toBe(80);
  });

  it('rejects invalid or tampered backups without touching data', async () => {
    await addIncome({ date: D, amountPaise: 200000 });
    const good = JSON.parse(JSON.stringify(await exportBackup()));
    expect(() => validateBackup({ foo: 1 })).toThrow();
    const dupAuto = { ...good, walletTx: [...good.walletTx, { ...good.walletTx[0] }] };
    expect(() => validateBackup(dupAuto)).toThrow();
    const negative = { ...good, walletTx: [...good.walletTx, { id: 'w', date: D, type: 'withdrawal', amountPaise: 999999, note: '', createdAt: 1, updatedAt: 1 }] };
    await expect(restoreBackup(negative)).rejects.toThrow();
    expect(await db.incomes.count()).toBe(1);
  });
});

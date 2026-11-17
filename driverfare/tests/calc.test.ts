import { describe, expect, it } from 'vitest';
import { computeSavings, maxWithdrawable, summarizePeriod, ledgerWithBalances } from '../src/lib/calc';
import { formatINR, parseRupeesToPaise } from '../src/lib/money';
import { weekRange, monthRange, isISODate } from '../src/lib/dates';
import type { WalletTx } from '../src/lib/types';

describe('money', () => {
  it('parses rupee input to integer paise', () => {
    expect(parseRupeesToPaise('2000')).toBe(200000);
    expect(parseRupeesToPaise('2,000.5')).toBe(200050);
    expect(parseRupeesToPaise('₹ 1,500.25')).toBe(150025);
    expect(parseRupeesToPaise('0')).toBeNull();
    expect(parseRupeesToPaise('-5')).toBeNull();
    expect(parseRupeesToPaise('1.234')).toBeNull();
    expect(parseRupeesToPaise('abc')).toBeNull();
    expect(parseRupeesToPaise('')).toBeNull();
  });
  it('formats Indian currency', () => {
    expect(formatINR(150000)).toBe('₹1,500');
    expect(formatINR(12345678900)).toBe('₹12,34,56,789');
    expect(formatINR(150050)).toBe('₹1,500.50');
  });
});

describe('savings formula', () => {
  it('₹2,000 income, ₹500 CNG → ₹1,500 savings at 100%', () => {
    const s = computeSavings(200000, 50000, 100);
    expect(s.remainingPaise).toBe(150000);
    expect(s.savingsPaise).toBe(150000);
    expect(s.availablePaise).toBe(0);
    expect(s.expensesExceedIncome).toBe(false);
  });
  it('applies percentage and rounds down to the paisa', () => {
    const s = computeSavings(200000, 50000, 50);
    expect(s.savingsPaise).toBe(75000);
    expect(s.availablePaise).toBe(75000);
    expect(computeSavings(333, 0, 50).savingsPaise).toBe(166);
  });
  it('never produces negative savings when expenses exceed income', () => {
    const s = computeSavings(50000, 80000, 100);
    expect(s.savingsPaise).toBe(0);
    expect(s.remainingPaise).toBe(-30000);
    expect(s.expensesExceedIncome).toBe(true);
  });
});

describe('dates', () => {
  it('weeks run Monday to Sunday', () => {
    expect(weekRange('2026-11-17')).toEqual({ from: '2026-11-16', to: '2026-11-22' }); // Tue
    expect(weekRange('2026-11-22')).toEqual({ from: '2026-11-16', to: '2026-11-22' }); // Sun
    expect(weekRange('2026-11-16')).toEqual({ from: '2026-11-16', to: '2026-11-22' }); // Mon
  });
  it('month ranges handle leap years', () => {
    expect(monthRange('2028-02')).toEqual({ from: '2028-02-01', to: '2028-02-29' });
    expect(monthRange('2026-11')).toEqual({ from: '2026-11-01', to: '2026-11-30' });
  });
  it('validates ISO dates', () => {
    expect(isISODate('2026-02-30')).toBe(false);
    expect(isISODate('2026-02-28')).toBe(true);
  });
});

const tx = (id: string, date: string, type: WalletTx['type'], amountPaise: number, createdAt = 1): WalletTx => ({ id, date, type, amountPaise, note: '', createdAt, updatedAt: createdAt });

describe('ledger balances', () => {
  it('computes opening/closing per row and max withdrawable', () => {
    const txs = [tx('a', '2026-11-01', 'auto', 100000), tx('w', '2026-11-03', 'withdrawal', 30000), tx('b', '2026-11-02', 'auto', 50000)];
    const rows = ledgerWithBalances(txs);
    expect(rows.map((r) => [r.openingPaise, r.closingPaise])).toEqual([[0, 100000], [100000, 150000], [150000, 120000]]);
    expect(maxWithdrawable(txs, '2026-11-03')).toBe(120000);
    // Back-dated withdrawal on 1st cannot exceed what is left after the later withdrawal
    expect(maxWithdrawable(txs, '2026-11-01')).toBe(100000);
    expect(maxWithdrawable([tx('a', '2026-11-05', 'auto', 100000)], '2026-11-01')).toBe(0);
  });
  it('summarises a period with opening/closing balance', () => {
    const txs = [tx('a', '2026-10-31', 'auto', 10000), tx('b', '2026-11-02', 'auto', 50000), tx('d', '2026-11-03', 'deposit', 5000), tx('w', '2026-11-04', 'withdrawal', 20000)];
    const s = summarizePeriod('2026-11-01', '2026-11-30', [], [], txs);
    expect(s.openingBalancePaise).toBe(10000);
    expect(s.savingsAddedPaise).toBe(55000);
    expect(s.withdrawalsPaise).toBe(20000);
    expect(s.netSavingsGrowthPaise).toBe(35000);
    expect(s.closingBalancePaise).toBe(45000);
  });
});

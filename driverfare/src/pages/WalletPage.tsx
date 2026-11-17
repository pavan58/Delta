import { useState, type FormEvent } from 'react';
import { useApp } from '../state';
import { useAllData, useToday } from '../hooks';
import { addSavings, deleteWalletTx, setSavingsPercent, withdraw } from '../lib/ledger';
import { newId } from '../lib/db';
import { formatINR, parseRupeesToPaise, sumPaise } from '../lib/money';
import { formatDate, isISODate, monthOf, monthRange, weekRange, yearRange } from '../lib/dates';
import { ledgerWithBalances, maxWithdrawable, summarizePeriod, walletBalance } from '../lib/calc';
import { Field, PageTitle, Stat } from '../components/ui';
import type { WalletTx } from '../lib/types';

function MoneyForm({ kind, today, max }: { kind: 'deposit' | 'withdrawal'; today: string; max: (d: string) => number }) {
  const { t, toast, errorMessage } = useApp();
  const [date, setDate] = useState(today);
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const [formId, setFormId] = useState(newId);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const limit = max(date);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (busy) return;
    setErr('');
    const paise = parseRupeesToPaise(amount);
    if (!isISODate(date)) return setErr(t('invalid_date'));
    if (paise === null) return setErr(t('invalid_amount'));
    if (kind === 'withdrawal' && paise > limit) return setErr(`${t('err_insufficient')} ${t('max_withdraw')}: ${formatINR(limit)}`);
    setBusy(true);
    try {
      await (kind === 'deposit' ? addSavings : withdraw)({ id: formId, date, amountPaise: paise, note });
      toast(`${t('saved_ok')}: ${formatINR(paise)}`);
      setAmount(''); setNote(''); setFormId(newId());
    } catch (ex) { setErr(errorMessage(ex)); } finally { setBusy(false); }
  }

  const p = kind === 'deposit' ? 'dep' : 'wd';
  return (
    <form onSubmit={submit} className="card space-y-3" noValidate>
      <h2 className="text-lg font-bold text-navy-900">{kind === 'deposit' ? t('add_savings') : t('withdraw')}</h2>
      <div className="grid grid-cols-2 gap-3">
        <Field label={t('date')} htmlFor={`${p}-date`}><input id={`${p}-date`} type="date" className="input" value={date} onChange={(e) => setDate(e.target.value)} /></Field>
        <Field label={t('amount')} htmlFor={`${p}-amount`}><input id={`${p}-amount`} className="input font-bold" inputMode="decimal" autoComplete="off" value={amount} onChange={(e) => setAmount(e.target.value)} /></Field>
      </div>
      <Field label={t('note')} htmlFor={`${p}-note`}><input id={`${p}-note`} className="input" maxLength={200} value={note} onChange={(e) => setNote(e.target.value)} /></Field>
      {kind === 'withdrawal' && <p className="text-sm text-slate-700">{t('max_withdraw')}: <b data-testid="max-withdraw">{formatINR(limit)}</b></p>}
      {err && <p role="alert" className="font-semibold text-red-600">{err}</p>}
      <button className={kind === 'deposit' ? 'btn-primary w-full' : 'btn-navy w-full'} disabled={busy}>{busy ? t('saving') : kind === 'deposit' ? t('add_savings') : t('withdraw')}</button>
    </form>
  );
}

export default function WalletPage() {
  const { t, lang, settings, toast, confirm, errorMessage } = useApp();
  const today = useToday();
  const { incomes, expenses, txs } = useAllData();
  const [pct, setPct] = useState<string | null>(null);
  const [limit, setLimit] = useState(50);

  const sum = (r: { from: string; to: string }) => summarizePeriod(r.from, r.to, incomes, expenses, txs).savingsAddedPaise;
  const rows = ledgerWithBalances(txs.filter((x) => x.amountPaise > 0)).reverse();
  const typeLabel = (x: WalletTx) => (x.type === 'auto' ? `${t('tx_auto')} (${x.percent ?? 100}%)` : x.type === 'deposit' ? t('tx_deposit') : t('tx_withdrawal'));

  async function savePct() {
    const n = Number(pct);
    if (!Number.isInteger(n) || n < 0 || n > 100) return toast('0 – 100 %', 'err');
    try { await setSavingsPercent(n, today); setPct(null); toast(`${t('saved_ok')}: ${n}%`); } catch (ex) { toast(errorMessage(ex), 'err'); }
  }

  async function remove(x: WalletTx) {
    if (!(await confirm({ title: t('confirm_delete_title'), body: t('confirm_delete_body'), confirmLabel: t('yes_delete'), danger: true }))) return;
    try { await deleteWalletTx(x.id); toast(t('deleted_ok')); } catch (ex) { toast(errorMessage(ex), 'err'); }
  }

  return (
    <div className="space-y-4">
      <PageTitle>{t('title_wallet')}</PageTitle>
      <section className="card space-y-3">
        <Stat label={t('current_savings')} value={walletBalance(txs)} tone="green" big testId="wallet-current" />
        <div className="grid grid-cols-2 gap-3">
          <Stat label={t('daily_savings')} value={sum({ from: today, to: today })} />
          <Stat label={t('weekly_savings')} value={sum(weekRange(today))} />
          <Stat label={t('monthly_savings')} value={sum(monthRange(monthOf(today)))} />
          <Stat label={t('yearly_savings')} value={sum(yearRange(Number(today.slice(0, 4))))} />
        </div>
        <Stat label={t('total_withdrawals')} value={sumPaise(txs.filter((x) => x.type === 'withdrawal').map((x) => x.amountPaise))} tone="red" />
      </section>

      <section className="card space-y-2">
        <label className="label" htmlFor="pct">{t('savings_pct')}</label>
        <div className="flex gap-2">
          <input id="pct" className="input w-28 text-center font-bold" inputMode="numeric" value={pct ?? String(settings.savingsPercent)} onChange={(e) => setPct(e.target.value.replace(/\D/g, '').slice(0, 3))} />
          <span className="self-center text-xl font-bold">%</span>
          <button className="btn-navy flex-1" onClick={savePct} disabled={pct === null}>{t('update_pct')}</button>
        </div>
        <p className="text-sm text-slate-600">{t('pct_help')}</p>
      </section>

      <MoneyForm kind="deposit" today={today} max={() => Infinity} />
      <MoneyForm kind="withdrawal" today={today} max={(d) => maxWithdrawable(txs, d)} />

      <section className="card">
        <h2 className="mb-2 text-lg font-bold text-navy-900">{t('history')}</h2>
        {rows.length === 0 ? <p className="text-slate-600">{t('no_entries')}</p> : (
          <ul className="divide-y divide-slate-100">
            {rows.slice(0, limit).map(({ tx: x, openingPaise, closingPaise }) => (
              <li key={x.id} className="py-2">
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <div className="font-semibold text-navy-900">{typeLabel(x)}</div>
                    <div className="text-sm text-slate-600">{formatDate(x.date, lang)}{x.type !== 'auto' && x.note ? ` · ${x.note}` : ''}</div>
                  </div>
                  <div className={`text-lg font-bold tabular-nums ${x.type === 'withdrawal' ? 'text-red-600' : 'text-brand-700'}`}>{x.type === 'withdrawal' ? '−' : '+'}{formatINR(x.amountPaise)}</div>
                </div>
                <div className="mt-1 flex items-center justify-between text-xs text-slate-600">
                  <span>{t('opening')}: {formatINR(openingPaise)} → {t('closing')}: <b>{formatINR(closingPaise)}</b></span>
                  {x.type !== 'auto' && <button className="min-h-[36px] px-2 font-semibold text-red-600" onClick={() => remove(x)}>{t('delete')}</button>}
                </div>
              </li>
            ))}
          </ul>
        )}
        {rows.length > limit && <button className="btn-outline mt-2 w-full" onClick={() => setLimit(limit + 50)}>+ 50</button>}
      </section>
    </div>
  );
}

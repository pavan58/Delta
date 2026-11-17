import { useState, type FormEvent } from 'react';
import { useApp } from '../state';
import { useAllData, useToday } from '../hooks';
import { addIncome, deleteIncome } from '../lib/ledger';
import { newId } from '../lib/db';
import { parseRupeesToPaise, formatINR, sumPaise } from '../lib/money';
import { isISODate, formatDate } from '../lib/dates';
import { Field, PageTitle, Row } from '../components/ui';

export default function IncomePage() {
  const { t, lang, toast, confirm, errorMessage } = useApp();
  const today = useToday();
  const { incomes } = useAllData();
  const [date, setDate] = useState(today);
  const [amount, setAmount] = useState('');
  const [desc, setDesc] = useState('');
  const [formId, setFormId] = useState(newId);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  const dayList = incomes.filter((i) => i.date === date).sort((a, b) => b.createdAt - a.createdAt);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (busy) return;
    setErr('');
    const paise = parseRupeesToPaise(amount);
    if (!isISODate(date)) return setErr(t('invalid_date'));
    if (paise === null) return setErr(t('invalid_amount'));
    const description = desc.trim();
    const dup = dayList.some((i) => i.amountPaise === paise && i.description === (description || 'Income'));
    if (dup && !(await confirm({ title: t('duplicate_title'), body: t('duplicate_body'), confirmLabel: t('save_anyway') }))) return;
    setBusy(true);
    try {
      await addIncome({ id: formId, date, amountPaise: paise, description });
      toast(`${t('saved_ok')}: ${formatINR(paise)}`);
      setAmount('');
      setDesc('');
      setFormId(newId());
    } catch (ex) {
      setErr(errorMessage(ex));
    } finally {
      setBusy(false);
    }
  }

  async function remove(id: string) {
    if (!(await confirm({ title: t('confirm_delete_title'), body: t('confirm_delete_body'), confirmLabel: t('yes_delete'), danger: true }))) return;
    try { await deleteIncome(id); toast(t('deleted_ok')); } catch (ex) { toast(errorMessage(ex), 'err'); }
  }

  return (
    <div className="space-y-4">
      <PageTitle>{t('title_income')}</PageTitle>
      <form onSubmit={submit} className="card space-y-3" noValidate>
        <Field label={t('date')} htmlFor="inc-date">
          <input id="inc-date" type="date" className="input" value={date} max="2100-12-31" onChange={(e) => setDate(e.target.value)} required />
        </Field>
        <Field label={t('amount')} htmlFor="inc-amount">
          <input id="inc-amount" className="input text-2xl font-bold" inputMode="decimal" autoComplete="off" placeholder="2000" value={amount} onChange={(e) => setAmount(e.target.value)} required />
        </Field>
        <Field label={t('description')} htmlFor="inc-desc">
          <input id="inc-desc" className="input" maxLength={200} placeholder={t('income_placeholder')} value={desc} onChange={(e) => setDesc(e.target.value)} />
        </Field>
        {err && <p role="alert" className="font-semibold text-red-600">{err}</p>}
        <button type="submit" className="btn-primary w-full" disabled={busy}>{busy ? t('saving') : t('save')}</button>
      </form>

      <section className="card">
        <h2 className="mb-2 text-lg font-bold text-navy-900">{t('entries_for')} {formatDate(date, lang)}</h2>
        {dayList.length === 0 ? <p className="text-slate-600">{t('no_entries')}</p> : (
          <ul className="divide-y divide-slate-100">
            {dayList.map((i) => (
              <li key={i.id} className="flex items-center justify-between gap-3 py-2">
                <div className="min-w-0">
                  <div className="text-lg font-bold text-brand-700 tabular-nums">{formatINR(i.amountPaise)}</div>
                  <div className="truncate text-sm text-slate-600">{i.description}</div>
                </div>
                <button className="min-h-[44px] rounded-lg px-3 font-semibold text-red-600 ring-1 ring-red-200" onClick={() => remove(i.id)} aria-label={`${t('delete')} ${formatINR(i.amountPaise)}`}>{t('delete')}</button>
              </li>
            ))}
          </ul>
        )}
        <div className="mt-2"><Row label={t('total_income')} value={sumPaise(dayList.map((i) => i.amountPaise))} bold tone="green" /></div>
      </section>
    </div>
  );
}

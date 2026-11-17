import { useState, type FormEvent } from 'react';
import { useApp } from '../state';
import { useAllData, useToday } from '../hooks';
import { addExpense, deleteExpense } from '../lib/ledger';
import { newId } from '../lib/db';
import { parseRupeesToPaise, formatINR, sumPaise } from '../lib/money';
import { isISODate, formatDate } from '../lib/dates';
import { EXPENSE_CATEGORIES, type ExpenseCategory } from '../lib/types';
import { computeSavings } from '../lib/calc';
import { Field, PageTitle, Row, Warning } from '../components/ui';

const ICONS: Record<ExpenseCategory, string> = { CNG: '🟢', Petrol: '⛽', Diesel: '🛢️', Electricity: '🔌', Food: '🍛', Toll: '🛣️', Parking: '🅿️', Maintenance: '🔧', Other: '📦' };

export default function ExpensePage() {
  const { t, lang, toast, confirm, errorMessage } = useApp();
  const today = useToday();
  const { expenses, incomes } = useAllData();
  const [date, setDate] = useState(today);
  const [category, setCategory] = useState<ExpenseCategory>('CNG');
  const [amount, setAmount] = useState('');
  const [desc, setDesc] = useState('');
  const [formId, setFormId] = useState(newId);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  const dayList = expenses.filter((x) => x.date === date).sort((a, b) => b.createdAt - a.createdAt);
  const dayExpense = sumPaise(dayList.map((x) => x.amountPaise));
  const dayIncome = sumPaise(incomes.filter((i) => i.date === date).map((i) => i.amountPaise));
  const exceed = computeSavings(dayIncome, dayExpense, 100).expensesExceedIncome;

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (busy) return;
    setErr('');
    const paise = parseRupeesToPaise(amount);
    if (!isISODate(date)) return setErr(t('invalid_date'));
    if (paise === null) return setErr(t('invalid_amount'));
    const description = desc.trim();
    const dup = dayList.some((x) => x.amountPaise === paise && x.category === category && x.description === description);
    if (dup && !(await confirm({ title: t('duplicate_title'), body: t('duplicate_body'), confirmLabel: t('save_anyway') }))) return;
    setBusy(true);
    try {
      await addExpense({ id: formId, date, category, amountPaise: paise, description });
      toast(`${t('saved_ok')}: ${t(`cat_${category}`)} ${formatINR(paise)}`);
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
    try { await deleteExpense(id); toast(t('deleted_ok')); } catch (ex) { toast(errorMessage(ex), 'err'); }
  }

  return (
    <div className="space-y-4">
      <PageTitle>{t('title_expenses')}</PageTitle>
      <form onSubmit={submit} className="card space-y-3" noValidate>
        <Field label={t('date')} htmlFor="exp-date">
          <input id="exp-date" type="date" className="input" value={date} onChange={(e) => setDate(e.target.value)} required />
        </Field>
        <fieldset>
          <legend className="label">{t('category')}</legend>
          <div className="grid grid-cols-3 gap-2">
            {EXPENSE_CATEGORIES.map((c) => (
              <button type="button" key={c} onClick={() => setCategory(c)} aria-pressed={category === c}
                className={`flex min-h-[60px] flex-col items-center justify-center rounded-xl text-sm font-semibold ring-2 ${category === c ? 'bg-brand-600 text-white ring-brand-600' : 'bg-white text-navy-900 ring-slate-300'}`}>
                <span className="text-xl" aria-hidden>{ICONS[c]}</span>{t(`cat_${c}`)}
              </button>
            ))}
          </div>
        </fieldset>
        <Field label={t('amount')} htmlFor="exp-amount">
          <input id="exp-amount" className="input text-2xl font-bold" inputMode="decimal" autoComplete="off" placeholder="500" value={amount} onChange={(e) => setAmount(e.target.value)} required />
        </Field>
        <Field label={t('description')} htmlFor="exp-desc">
          <input id="exp-desc" className="input" maxLength={200} placeholder={t('expense_placeholder')} value={desc} onChange={(e) => setDesc(e.target.value)} />
        </Field>
        {err && <p role="alert" className="font-semibold text-red-600">{err}</p>}
        <button type="submit" className="btn-primary w-full" disabled={busy}>{busy ? t('saving') : t('save')}</button>
      </form>

      {exceed && <Warning tone="red">{t('warn_exceed')}</Warning>}

      <section className="card">
        <h2 className="mb-2 text-lg font-bold text-navy-900">{t('entries_for')} {formatDate(date, lang)}</h2>
        {dayList.length === 0 ? <p className="text-slate-600">{t('no_entries')}</p> : (
          <ul className="divide-y divide-slate-100">
            {dayList.map((x) => (
              <li key={x.id} className="flex items-center justify-between gap-3 py-2">
                <div className="min-w-0">
                  <div className="text-lg font-bold text-red-600 tabular-nums">{formatINR(x.amountPaise)} <span className="text-sm font-semibold text-slate-700">· {ICONS[x.category]} {t(`cat_${x.category}`)}</span></div>
                  {x.description && <div className="truncate text-sm text-slate-600">{x.description}</div>}
                </div>
                <button className="min-h-[44px] rounded-lg px-3 font-semibold text-red-600 ring-1 ring-red-200" onClick={() => remove(x.id)}>{t('delete')}</button>
              </li>
            ))}
          </ul>
        )}
        <div className="mt-2"><Row label={t('total_expenses')} value={dayExpense} bold tone="red" /></div>
      </section>
    </div>
  );
}

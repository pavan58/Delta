import { useMemo, useState } from 'react';
import { useApp } from '../state';
import { useAllData, useToday } from '../hooks';
import { summarizePeriod } from '../lib/calc';
import { formatDate, formatMonth, monthOf, monthRange, weekRange } from '../lib/dates';
import { buildReportMessage, whatsappUrl, type ReportKind } from '../lib/reports';
import { buildPeriodCsv } from '../lib/csv';
import { downloadText } from '../lib/backup';
import { setSetting } from '../lib/settings';
import { EXPENSE_CATEGORIES } from '../lib/types';
import { PageTitle, Row } from '../components/ui';

export default function ReportsPage() {
  const { t, lang, settings } = useApp();
  const today = useToday();
  const { incomes, expenses, txs } = useAllData();
  const [kind, setKind] = useState<ReportKind>('daily');
  const [day, setDay] = useState(today);
  const [month, setMonth] = useState(monthOf(today));
  const [phone, setPhone] = useState<string | null>(null);

  const range = kind === 'daily' ? { from: day, to: day } : kind === 'weekly' ? weekRange(day) : monthRange(month);
  const s = useMemo(() => summarizePeriod(range.from, range.to, incomes, expenses, txs), [range.from, range.to, incomes, expenses, txs]);
  const message = buildReportMessage(kind, s, t, lang);
  const number = phone ?? settings.whatsappNumber;
  const title = kind === 'daily' ? t('report_daily') : kind === 'weekly' ? t('report_weekly') : t('report_monthly');
  const periodLabel = kind === 'daily' ? formatDate(s.from, lang) : kind === 'weekly' ? `${formatDate(s.from, lang)} – ${formatDate(s.to, lang)}` : formatMonth(month, lang);

  function share() {
    if (phone !== null) void setSetting('whatsappNumber', phone.trim());
    // Click-to-chat: opens WhatsApp with the text filled in. The driver presses Send.
    window.open(whatsappUrl(message, number), '_blank', 'noopener');
  }

  function csv() {
    downloadText(`driverfare-${kind}-${s.from}${s.from !== s.to ? `_to_${s.to}` : ''}.csv`, buildPeriodCsv(s, incomes, expenses, txs), 'text/csv;charset=utf-8');
  }

  return (
    <div className="space-y-4">
      <div className="no-print">
        <PageTitle>{t('title_reports')}</PageTitle>
        <div className="grid grid-cols-3 gap-2" role="tablist">
          {(['daily', 'weekly', 'monthly'] as ReportKind[]).map((k) => (
            <button key={k} role="tab" aria-selected={kind === k} onClick={() => setKind(k)} className={`min-h-[52px] rounded-xl text-base font-bold ring-2 ${kind === k ? 'bg-navy-900 text-white ring-navy-900' : 'bg-white text-navy-900 ring-slate-300'}`}>{t(k)}</button>
          ))}
        </div>
        <div className="mt-3">
          {kind === 'monthly' ? (
            <><label className="label" htmlFor="rep-month">{t('select_month')}</label><input id="rep-month" type="month" className="input" value={month} onChange={(e) => e.target.value && setMonth(e.target.value)} /></>
          ) : (
            <><label className="label" htmlFor="rep-day">{kind === 'weekly' ? t('select_week') : t('select_date')}</label><input id="rep-day" type="date" className="input" value={day} onChange={(e) => e.target.value && setDay(e.target.value)} /></>
          )}
        </div>
      </div>

      <section className="card" id="printable-report">
        <div className="print-only mb-2 text-2xl font-extrabold">DriverFare – {t('tagline')}</div>
        <h2 className="text-lg font-bold text-navy-900">{title}</h2>
        <p className="mb-2 text-slate-600">{periodLabel}{kind === 'weekly' ? ' (Mon–Sun)' : ''}</p>
        <Row label={kind === 'daily' ? t('income') : t('total_income')} value={s.incomePaise} tone="green" />
        <Row label={t('total_expenses')} value={s.expensePaise} tone="red" />
        {kind === 'daily' ? (
          <>
            <Row label={t('cng_expenses')} value={s.cngPaise} />
            <Row label={t('other_expenses')} value={s.otherExpensePaise} />
          </>
        ) : (
          <div className="my-1 rounded-lg bg-slate-50 px-3 py-1">
            <div className="pt-1 text-sm font-semibold text-slate-700">{t('category_breakdown')}</div>
            {EXPENSE_CATEGORIES.map((c) => <Row key={c} label={t(`cat_${c}`)} value={s.byCategory[c]} />)}
          </div>
        )}
        <Row label={t('savings_added')} value={s.savingsAddedPaise} tone="green" />
        <Row label={t('withdrawals')} value={s.withdrawalsPaise} />
        {kind !== 'daily' && <Row label={t('net_growth')} value={s.netSavingsGrowthPaise} />}
        <Row label={t('opening_balance')} value={s.openingBalancePaise} />
        <Row label={t('closing_balance')} value={s.closingBalancePaise} bold tone="green" />
        <p className="print-only mt-4 text-xs">{s.incomeCount} {t('income')} · {s.expenseCount} {t('expenses')} · {new Date().toLocaleString('en-IN')}</p>
      </section>

      <section className="card no-print space-y-3">
        <label className="label" htmlFor="wa-num">{t('whatsapp_number')}</label>
        <input id="wa-num" className="input" type="tel" inputMode="tel" placeholder="98765 43210" value={number} onChange={(e) => setPhone(e.target.value)} />
        <button className="btn w-full bg-[#25D366] text-white" onClick={share} data-testid="share-wa">🟢 {t('share_whatsapp')}</button>
        <p className="text-sm text-slate-600">{t('whatsapp_help')}</p>
        <div className="grid grid-cols-2 gap-3">
          <button className="btn-outline" onClick={csv}>{t('export_csv')}</button>
          <button className="btn-outline" onClick={() => window.print()}>{t('print_pdf')}</button>
        </div>
        <details>
          <summary className="cursor-pointer py-2 font-semibold text-navy-900">{t('preview')}</summary>
          <pre data-testid="wa-preview" className="whitespace-pre-wrap rounded-xl bg-[#e7fbe9] p-3 text-sm text-slate-900">{message}</pre>
        </details>
      </section>
    </div>
  );
}

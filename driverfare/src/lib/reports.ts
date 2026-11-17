import type { PeriodSummary } from './calc';
import { formatDate, formatMonth } from './dates';
import { formatINR } from './money';
import { EXPENSE_CATEGORIES } from './types';
import type { T } from '../i18n';

export type ReportKind = 'daily' | 'weekly' | 'monthly';

function line(label: string, value: string) {
  return `${label}: ${value}`;
}

function categoryLines(s: PeriodSummary, t: T): string[] {
  const rows = EXPENSE_CATEGORIES.filter((c) => s.byCategory[c] > 0).map((c) => `  • ${t(`cat_${c}`)}: ${formatINR(s.byCategory[c])}`);
  return rows.length ? rows : ['  • —'];
}

/** Builds a plain-text WhatsApp message. WhatsApp supports *bold* markup. */
export function buildReportMessage(kind: ReportKind, s: PeriodSummary, t: T, lang = 'en'): string {
  const out: string[] = [];
  if (kind === 'daily') {
    out.push(`*DriverFare – ${t('report_daily')}*`);
    out.push(line(t('date'), formatDate(s.from, lang)));
    out.push('');
    out.push(line(t('income'), formatINR(s.incomePaise)));
    out.push(line(t('total_expenses'), formatINR(s.expensePaise)));
    out.push(line(t('cng_expenses'), formatINR(s.cngPaise)));
    out.push(line(t('other_expenses'), formatINR(s.otherExpensePaise)));
    out.push(line(t('savings_added'), formatINR(s.savingsAddedPaise)));
    out.push(line(t('withdrawals'), formatINR(s.withdrawalsPaise)));
    out.push(`*${line(t('closing_balance'), formatINR(s.closingBalancePaise))}*`);
  } else {
    out.push(`*DriverFare – ${t(kind === 'weekly' ? 'report_weekly' : 'report_monthly')}*`);
    if (kind === 'weekly') out.push(line(t('period'), `${formatDate(s.from, lang)} – ${formatDate(s.to, lang)} (Mon–Sun)`));
    else out.push(line(t('month'), formatMonth(s.from.slice(0, 7), lang)));
    out.push('');
    out.push(line(t('total_income'), formatINR(s.incomePaise)));
    out.push(line(t('total_expenses'), formatINR(s.expensePaise)));
    out.push(`${t('category_breakdown')}:`);
    out.push(...categoryLines(s, t));
    out.push(line(t('savings_added'), formatINR(s.savingsAddedPaise)));
    out.push(line(t('withdrawals'), formatINR(s.withdrawalsPaise)));
    out.push(line(t('net_growth'), formatINR(s.netSavingsGrowthPaise)));
    out.push(line(t('opening_balance'), formatINR(s.openingBalancePaise)));
    out.push(`*${line(t('closing_balance'), formatINR(s.closingBalancePaise))}*`);
  }
  out.push('');
  out.push(`_${t('msg_footer')}_`);
  return out.join('\n');
}

/** Normalise an Indian mobile number for wa.me (digits only, country code 91 added for 10-digit numbers). */
export function normalizeWhatsAppNumber(input: string): string {
  const digits = (input || '').replace(/\D/g, '').replace(/^0+/, '');
  if (digits.length === 10) return `91${digits}`;
  return digits;
}

/** Official WhatsApp click-to-chat link. The user still has to press Send. */
export function whatsappUrl(message: string, number = ''): string {
  const n = normalizeWhatsAppNumber(number);
  return `https://wa.me/${n}?text=${encodeURIComponent(message)}`;
}

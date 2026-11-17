import type { ReactNode } from 'react';
import { formatINR, type Paise } from '../lib/money';

export function Stat({ label, value, tone = 'navy', big = false, testId }: { label: string; value: Paise; tone?: 'navy' | 'green' | 'red' | 'slate'; big?: boolean; testId?: string }) {
  const color = { navy: 'text-navy-900', green: 'text-brand-600', red: 'text-red-600', slate: 'text-slate-700' }[tone];
  return (
    <div className="rounded-xl bg-slate-50 p-3 ring-1 ring-slate-200">
      <div className="text-sm font-medium text-slate-600">{label}</div>
      <div data-testid={testId} className={`${big ? 'text-3xl' : 'text-xl'} font-bold tabular-nums ${color}`}>{formatINR(value)}</div>
    </div>
  );
}

export function Row({ label, value, bold, tone }: { label: string; value: Paise; bold?: boolean; tone?: 'green' | 'red' }) {
  const c = tone === 'green' ? 'text-brand-700' : tone === 'red' ? 'text-red-600' : 'text-navy-900';
  return (
    <div className={`flex items-baseline justify-between gap-3 border-b border-slate-100 py-2 last:border-0 ${bold ? 'font-bold' : ''}`}>
      <span className="text-slate-700">{label}</span>
      <span className={`tabular-nums ${c}`}>{formatINR(value)}</span>
    </div>
  );
}

export function Warning({ children, tone = 'amber' }: { children: ReactNode; tone?: 'amber' | 'red' | 'blue' }) {
  const c = { amber: 'bg-amber-50 text-amber-900 ring-amber-300', red: 'bg-red-50 text-red-900 ring-red-300', blue: 'bg-sky-50 text-sky-900 ring-sky-300' }[tone];
  return <div role="alert" className={`rounded-xl p-3 text-base ring-1 ${c}`}>{children}</div>;
}

export function PageTitle({ children }: { children: ReactNode }) {
  return <h1 className="mb-3 text-2xl font-bold text-navy-900">{children}</h1>;
}

export function Field({ label, children, htmlFor }: { label: string; children: ReactNode; htmlFor: string }) {
  return (
    <div>
      <label className="label" htmlFor={htmlFor}>{label}</label>
      {children}
    </div>
  );
}

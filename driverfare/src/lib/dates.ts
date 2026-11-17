/** Dates are stored as local calendar dates in ISO form: YYYY-MM-DD. */
export type ISODate = string;

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export function isISODate(s: unknown): s is ISODate {
  if (typeof s !== 'string' || !DATE_RE.test(s)) return false;
  const d = fromISO(s);
  return toISO(d) === s;
}

export function toISO(d: Date): ISODate {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function fromISO(s: ISODate): Date {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d, 12, 0, 0, 0); // noon avoids DST edge cases
}

export function todayISO(now: Date = new Date()): ISODate {
  return toISO(now);
}

export function addDays(s: ISODate, n: number): ISODate {
  const d = fromISO(s);
  d.setDate(d.getDate() + n);
  return toISO(d);
}

/** Monday of the week containing the date. */
export function weekStart(s: ISODate): ISODate {
  const d = fromISO(s);
  const dow = (d.getDay() + 6) % 7; // Mon=0 … Sun=6
  return addDays(s, -dow);
}

export function weekRange(s: ISODate): { from: ISODate; to: ISODate } {
  const from = weekStart(s);
  return { from, to: addDays(from, 6) };
}

/** month as YYYY-MM */
export function monthRange(month: string): { from: ISODate; to: ISODate } {
  const [y, m] = month.split('-').map(Number);
  const last = new Date(y, m, 0).getDate();
  return { from: `${month}-01`, to: `${month}-${String(last).padStart(2, '0')}` };
}

export function yearRange(year: number): { from: ISODate; to: ISODate } {
  return { from: `${year}-01-01`, to: `${year}-12-31` };
}

export function monthOf(s: ISODate): string {
  return s.slice(0, 7);
}

export function inRange(d: ISODate, from: ISODate, to: ISODate): boolean {
  return d >= from && d <= to;
}

const LOCALES: Record<string, string> = { en: 'en-IN', hi: 'hi-IN', mr: 'mr-IN' };

export function formatDate(s: ISODate, lang = 'en'): string {
  return fromISO(s).toLocaleDateString(LOCALES[lang] ?? 'en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

export function formatMonth(month: string, lang = 'en'): string {
  return fromISO(`${month}-01`).toLocaleDateString(LOCALES[lang] ?? 'en-IN', { month: 'long', year: 'numeric' });
}

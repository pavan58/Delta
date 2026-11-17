/** All money is stored as integer paise (1 ₹ = 100 paise) to avoid floating-point errors. */
export type Paise = number;

export const MAX_AMOUNT_PAISE = 100_000_000_00; // ₹10 crore sanity limit per entry

/** Parse user input such as "2000", "2,000.50", "₹ 1500" into paise. Returns null when invalid. */
export function parseRupeesToPaise(input: string): Paise | null {
  if (typeof input !== 'string') return null;
  const cleaned = input.replace(/[₹,\s]/g, '').replace(/^Rs\.?/i, '');
  if (!/^\d+(\.\d{1,2})?$/.test(cleaned)) return null;
  const [whole, frac = ''] = cleaned.split('.');
  const paise = Number(whole) * 100 + Number((frac + '00').slice(0, 2));
  if (!Number.isSafeInteger(paise) || paise <= 0 || paise > MAX_AMOUNT_PAISE) return null;
  return paise;
}

export function isValidPaise(v: unknown): v is Paise {
  return typeof v === 'number' && Number.isSafeInteger(v) && v >= 0 && v <= MAX_AMOUNT_PAISE * 1000;
}

const fmtWhole = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', minimumFractionDigits: 0, maximumFractionDigits: 0 });
const fmtFrac = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** Indian formatting: ₹1,23,456 or ₹1,234.50 */
export function formatINR(paise: Paise): string {
  const neg = paise < 0;
  const abs = Math.abs(paise);
  const s = abs % 100 === 0 ? fmtWhole.format(abs / 100) : fmtFrac.format(abs / 100);
  return neg ? `-${s}` : s;
}

/** Plain number for CSV, e.g. 1500.00 */
export function paiseToDecimalString(paise: Paise): string {
  const neg = paise < 0;
  const abs = Math.abs(paise);
  return `${neg ? '-' : ''}${Math.floor(abs / 100)}.${String(abs % 100).padStart(2, '0')}`;
}

export function sumPaise(values: Paise[]): Paise {
  return values.reduce((a, b) => a + b, 0);
}

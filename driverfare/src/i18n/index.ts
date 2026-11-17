import { en, type Dict, type DictKey } from './en';
import { hi } from './hi';
import { mr } from './mr';
import type { Lang } from '../lib/settings';

export const DICTS: Record<Lang, Dict> = { en, hi, mr };
export const LANG_LABELS: Record<Lang, string> = { en: 'English', hi: 'हिंदी', mr: 'मराठी' };
export type T = (key: DictKey) => string;
export function makeT(lang: Lang): T {
  const d = DICTS[lang] ?? en;
  return (key) => d[key] ?? en[key] ?? key;
}
export type { DictKey };

import { db } from './db';

export type Lang = 'en' | 'hi' | 'mr';

export interface AppSettings {
  savingsPercent: number;
  language: Lang;
  lastBackupAt: number | null;
  whatsappNumber: string;
}

export const DEFAULT_SETTINGS: AppSettings = {
  savingsPercent: 100,
  language: 'en',
  lastBackupAt: null,
  whatsappNumber: '',
};

export async function getSettings(): Promise<AppSettings> {
  const rows = await db.settings.toArray();
  const out: AppSettings = { ...DEFAULT_SETTINGS };
  for (const r of rows) {
    if (r.key in out) (out as unknown as Record<string, unknown>)[r.key] = r.value;
  }
  return out;
}

export async function setSetting<K extends keyof AppSettings>(key: K, value: AppSettings[K]): Promise<void> {
  await db.settings.put({ key, value });
}

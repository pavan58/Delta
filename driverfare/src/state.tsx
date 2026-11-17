import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from './lib/db';
import { DEFAULT_SETTINGS, setSetting, type AppSettings, type Lang } from './lib/settings';
import { makeT, type T } from './i18n';
import { LedgerError } from './lib/ledger';

interface ConfirmOpts { title: string; body: string; confirmLabel?: string; danger?: boolean }
interface Ctx {
  t: T;
  lang: Lang;
  settings: AppSettings;
  setLang: (l: Lang) => void;
  toast: (msg: string, kind?: 'ok' | 'err') => void;
  confirm: (o: ConfirmOpts) => Promise<boolean>;
  errorMessage: (e: unknown) => string;
}
const AppCtx = createContext<Ctx | null>(null);

export function useApp(): Ctx {
  const c = useContext(AppCtx);
  if (!c) throw new Error('AppProvider missing');
  return c;
}

export function AppProvider({ children }: { children: ReactNode }) {
  const rows = useLiveQuery(() => db.settings.toArray(), []);
  const settings = useMemo<AppSettings>(() => {
    const s = { ...DEFAULT_SETTINGS };
    for (const r of rows ?? []) if (r.key in s) (s as unknown as Record<string, unknown>)[r.key] = r.value;
    return s;
  }, [rows]);
  const lang = settings.language;
  const t = useMemo(() => makeT(lang), [lang]);
  useEffect(() => { document.documentElement.lang = lang === 'en' ? 'en-IN' : lang; }, [lang]);

  const [toastState, setToast] = useState<{ msg: string; kind: 'ok' | 'err' } | null>(null);
  const timer = useRef<number>();
  const toast = useCallback((msg: string, kind: 'ok' | 'err' = 'ok') => {
    setToast({ msg, kind });
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setToast(null), kind === 'err' ? 5000 : 2200);
  }, []);

  const [dialog, setDialog] = useState<(ConfirmOpts & { resolve: (v: boolean) => void }) | null>(null);
  const confirm = useCallback((o: ConfirmOpts) => new Promise<boolean>((resolve) => setDialog({ ...o, resolve })), []);
  const close = (v: boolean) => { dialog?.resolve(v); setDialog(null); };

  const errorMessage = useCallback((e: unknown) => {
    if (e instanceof LedgerError) {
      if (e.code === 'WOULD_GO_NEGATIVE') return t('err_negative');
      if (e.code === 'INSUFFICIENT_BALANCE') return t('err_insufficient');
      if (e.code === 'INVALID_AMOUNT') return t('invalid_amount');
      if (e.code === 'INVALID_DATE') return t('invalid_date');
    }
    console.error(e);
    return t('err_generic');
  }, [t]);

  const value: Ctx = { t, lang, settings, setLang: (l) => void setSetting('language', l), toast, confirm, errorMessage };

  return (
    <AppCtx.Provider value={value}>
      {children}
      {toastState && (
        <div role="status" className={`no-print fixed inset-x-4 bottom-24 z-50 mx-auto max-w-md rounded-xl px-4 py-3 text-center text-base font-semibold text-white shadow-lg ${toastState.kind === 'ok' ? 'bg-brand-600' : 'bg-red-600'}`}>
          {toastState.msg}
        </div>
      )}
      {dialog && (
        <div className="no-print fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-4 sm:items-center" role="dialog" aria-modal="true" aria-labelledby="dlg-title">
          <div className="w-full max-w-md rounded-2xl bg-white p-5 shadow-xl">
            <h2 id="dlg-title" className="text-xl font-bold text-navy-900">{dialog.title}</h2>
            <p className="mt-2 text-base text-slate-700">{dialog.body}</p>
            <div className="mt-5 grid grid-cols-2 gap-3">
              <button className="btn-outline" onClick={() => close(false)}>{t('cancel')}</button>
              <button className={dialog.danger ? 'btn-danger' : 'btn-primary'} onClick={() => close(true)} autoFocus>{dialog.confirmLabel ?? t('confirm')}</button>
            </div>
          </div>
        </div>
      )}
    </AppCtx.Provider>
  );
}

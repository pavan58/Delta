import { useEffect, useState } from 'react';
import { useApp } from './state';
import { useOnline } from './hooks';
import { LANG_LABELS } from './i18n';
import type { Lang } from './lib/settings';
import type { DictKey } from './i18n';
import Dashboard from './pages/Dashboard';
import IncomePage from './pages/IncomePage';
import ExpensePage from './pages/ExpensePage';
import WalletPage from './pages/WalletPage';
import ReportsPage from './pages/ReportsPage';
import BackupPage from './pages/BackupPage';

export type Route = 'dashboard' | 'income' | 'expenses' | 'wallet' | 'reports' | 'backup';
const ROUTES: { id: Route; label: DictKey; icon: string }[] = [
  { id: 'dashboard', label: 'nav_dashboard', icon: '🏠' },
  { id: 'income', label: 'nav_income', icon: '💰' },
  { id: 'expenses', label: 'nav_expenses', icon: '⛽' },
  { id: 'wallet', label: 'nav_wallet', icon: '🐷' },
  { id: 'reports', label: 'nav_reports', icon: '📊' },
  { id: 'backup', label: 'nav_backup', icon: '💾' },
];

function readRoute(): Route {
  const h = window.location.hash.replace('#/', '').replace('#', '') as Route;
  return ROUTES.some((r) => r.id === h) ? h : 'dashboard';
}

export function go(route: Route) {
  window.location.hash = `#/${route}`;
}

export default function App() {
  const { t, lang, setLang } = useApp();
  const online = useOnline();
  const [route, setRoute] = useState<Route>(readRoute);
  useEffect(() => {
    const on = () => { setRoute(readRoute()); window.scrollTo(0, 0); };
    window.addEventListener('hashchange', on);
    return () => window.removeEventListener('hashchange', on);
  }, []);

  return (
    <div className="mx-auto flex min-h-screen max-w-2xl flex-col">
      <header className="no-print sticky top-0 z-30 bg-navy-900 px-4 pb-3 pt-[max(0.75rem,env(safe-area-inset-top))] text-white shadow">
        <div className="flex items-center justify-between gap-3">
          <button onClick={() => go('dashboard')} className="flex items-center gap-2 text-left" aria-label="DriverFare home">
            <span className="grid h-10 w-10 place-items-center rounded-full bg-brand-500 text-xl font-bold">₹</span>
            <span>
              <span className="block text-xl font-extrabold leading-tight">Driver<span className="text-brand-400">Fare</span></span>
              <span className="block text-xs text-slate-300">{t('tagline')}</span>
            </span>
          </button>
          <label className="sr-only" htmlFor="lang">{t('language')}</label>
          <select id="lang" value={lang} onChange={(e) => setLang(e.target.value as Lang)} className="min-h-[44px] rounded-lg bg-navy-800 px-2 text-base text-white ring-1 ring-navy-600">
            {(Object.keys(LANG_LABELS) as Lang[]).map((l) => <option key={l} value={l}>{LANG_LABELS[l]}</option>)}
          </select>
        </div>
        {!online && <div className="mt-2 rounded-lg bg-brand-700 px-3 py-1 text-center text-sm">{t('offline')}</div>}
      </header>

      <main className="flex-1 px-4 pb-28 pt-4">
        {route === 'dashboard' && <Dashboard />}
        {route === 'income' && <IncomePage />}
        {route === 'expenses' && <ExpensePage />}
        {route === 'wallet' && <WalletPage />}
        {route === 'reports' && <ReportsPage />}
        {route === 'backup' && <BackupPage />}
      </main>

      <nav className="no-print fixed inset-x-0 bottom-0 z-30 border-t border-navy-800 bg-navy-900 pb-[env(safe-area-inset-bottom)]" aria-label="Main">
        <ul className="mx-auto grid max-w-2xl grid-cols-6">
          {ROUTES.map((r) => (
            <li key={r.id}>
              <a href={`#/${r.id}`} aria-current={route === r.id ? 'page' : undefined}
                className={`flex min-h-[64px] flex-col items-center justify-center gap-0.5 px-0.5 text-[11px] font-semibold leading-tight ${route === r.id ? 'bg-navy-800 text-brand-400' : 'text-slate-300'}`}>
                <span className="text-2xl" aria-hidden>{r.icon}</span>
                <span className="text-center">{t(r.label)}</span>
              </a>
            </li>
          ))}
        </ul>
      </nav>
    </div>
  );
}

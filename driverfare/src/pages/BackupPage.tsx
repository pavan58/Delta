import { useEffect, useRef, useState } from 'react';
import { useApp } from '../state';
import { useAllData } from '../hooks';
import { downloadText, eraseAll, exportBackup, restoreBackup } from '../lib/backup';
import { setSetting } from '../lib/settings';
import { todayISO } from '../lib/dates';
import { PageTitle, Warning } from '../components/ui';

export default function BackupPage() {
  const { t, settings, toast, confirm } = useApp();
  const { incomes, expenses, txs } = useAllData();
  const fileRef = useRef<HTMLInputElement>(null);
  const [persisted, setPersisted] = useState<boolean | null>(null);

  useEffect(() => {
    navigator.storage?.persisted?.().then(setPersisted).catch(() => setPersisted(false));
  }, []);

  async function doExport() {
    const data = await exportBackup();
    downloadText(`driverfare-backup-${todayISO()}.json`, JSON.stringify(data, null, 2), 'application/json');
    await setSetting('lastBackupAt', Date.now());
    toast(t('saved_ok'));
  }

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    let parsed: unknown;
    try { parsed = JSON.parse(await file.text()); } catch { return toast(t('restore_bad'), 'err'); }
    if (!(await confirm({ title: t('import_confirm_title'), body: t('import_confirm_body'), confirmLabel: t('import_json'), danger: true }))) return;
    try {
      const r = await restoreBackup(parsed);
      toast(`${t('restore_ok')} (${r.incomes + r.expenses + r.walletTx} ${t('records')})`);
    } catch {
      toast(t('restore_bad'), 'err');
    }
  }

  async function erase() {
    if (!(await confirm({ title: t('erase_all'), body: t('erase_confirm_body'), confirmLabel: t('yes_delete'), danger: true }))) return;
    await eraseAll();
    toast(t('erased_ok'));
  }

  return (
    <div className="space-y-4">
      <PageTitle>{t('title_backup')}</PageTitle>
      <Warning>
        <b className="block">{t('backup_warning_title')}</b>
        {t('backup_warning_body')}
      </Warning>
      <section className="card space-y-3">
        <p className="text-slate-700">{t('records')}: <b>{incomes.length}</b> {t('income')} · <b>{expenses.length}</b> {t('expenses')} · <b>{txs.length}</b> {t('nav_wallet')}</p>
        <p className="text-slate-700">{t('last_backup')}: <b>{settings.lastBackupAt ? new Date(settings.lastBackupAt).toLocaleString('en-IN') : t('never')}</b></p>
        <button className="btn-primary w-full" onClick={doExport} data-testid="export-json">⬇️ {t('export_json')}</button>
        <button className="btn-outline w-full" onClick={() => fileRef.current?.click()}>⬆️ {t('import_json')}</button>
        <input ref={fileRef} type="file" accept="application/json,.json" className="hidden" onChange={onFile} data-testid="import-file" />
        {persisted !== null && <p className="text-sm text-slate-600">{persisted ? t('storage_persist_ok') : t('storage_persist_no')}</p>}
      </section>
      <section className="card space-y-3 ring-red-200">
        <h2 className="font-bold text-red-700">{t('danger_zone')}</h2>
        <button className="btn-danger w-full" onClick={erase}>{t('erase_all')}</button>
      </section>
      <p className="text-center text-xs text-slate-500">{t('privacy')}</p>
    </div>
  );
}

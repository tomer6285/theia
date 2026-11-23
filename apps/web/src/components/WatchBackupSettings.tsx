import React, { useRef, useState } from 'react';
import { describeWatchBackup, exportWatchBackup, importWatchBackup, readWatchBackup, WATCH_BACKUP_FILENAME } from '@theia/core';
import { colors } from '@theia/ui';
import styles from './WatchBackupSettings.module.css';

export function WatchBackupSettings() {
  const fileInput = useRef<HTMLInputElement>(null);
  const [backup, setBackup] = useState<ReturnType<typeof readWatchBackup>>();
  const [reading, setReading] = useState(false);
  const [message, setMessage] = useState('');

  const download = () => {
    const url = URL.createObjectURL(new Blob([exportWatchBackup()], { type: 'application/json' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = WATCH_BACKUP_FILENAME;
    link.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const readFile = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.currentTarget.files?.[0];
    event.currentTarget.value = '';
    if (!file) return;
    setBackup(undefined);
    setMessage('');
    setReading(true);
    try {
      setBackup(readWatchBackup(await file.text()));
    } catch {
      setMessage('Choose a valid Theia watch backup.');
    } finally {
      setReading(false);
    }
  };

  const merge = () => {
    if (!backup) return;
    importWatchBackup(backup);
    setBackup(undefined);
    setMessage('Watch backup imported.');
  };

  return (
    <section
      aria-labelledby="watch-backup-heading"
      className={styles.card}
      style={{
        backgroundColor: colors.bg.surface,
        borderColor: colors.border.subtle,
        color: colors.text.secondary,
      }}
    >
      <h3 id="watch-backup-heading">Watch backup</h3>
      <div className={styles.row}>
        <div>
          <h4>Export backup</h4>
          <p>Save your watch history, playback progress, and favorites as a JSON file.</p>
        </div>
        <button type="button" className={`${styles.action} ${styles.accent}`} onClick={download}>
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M12 3v12m-4-4 4 4 4-4M4 16v4h16v-4" />
          </svg>
          Export
        </button>
      </div>
      <div className={styles.row}>
        <div>
          <h4>Import backup</h4>
          <p>Choose a Theia JSON backup to restore your watch data.</p>
        </div>
        <button type="button" className={styles.action} aria-disabled={reading}
          onClick={() => { if (!reading) fileInput.current?.click(); }}>
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M12 15V3m-4 4 4-4 4 4M4 16v4h16v-4" />
          </svg>
          Import
        </button>
        <input ref={fileInput} type="file" accept=".json,application/json" hidden onChange={readFile} />
      </div>
      {backup && (
        <div className={styles.confirmation}>
          <p role="status">{describeWatchBackup(backup)}</p>
          <div className={styles.actions}>
            <button type="button" className={`${styles.action} ${styles.accent}`} onClick={merge}>Merge backup</button>
            <button type="button" className={styles.action} onClick={() => setBackup(undefined)}>Cancel</button>
          </div>
        </div>
      )}
      <div role="status">{(reading || message) && <p className={styles.message}>{reading ? 'Reading backup…' : message}</p>}</div>
    </section>
  );
}

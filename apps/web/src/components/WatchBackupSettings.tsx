import React, { useState } from 'react';
import { describeWatchBackup, exportWatchBackup, importWatchBackup, readWatchBackup, WATCH_BACKUP_FILENAME } from '@theia/core';

export function WatchBackupSettings() {
  const [backup, setBackup] = useState<ReturnType<typeof readWatchBackup>>();
  const [message, setMessage] = useState('');

  const download = () => {
    const url = URL.createObjectURL(new Blob([exportWatchBackup()], { type: 'application/json' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = WATCH_BACKUP_FILENAME;
    link.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  return <section>
    <h3>Watch backup</h3>
    <button type="button" onClick={download}>Export JSON</button>
    <label style={{ display: 'block', marginTop: 12 }}>
      Import JSON
      <input type="file" accept=".json,application/json" onChange={async (event) => {
        const file = event.currentTarget.files?.[0];
        event.currentTarget.value = '';
        setBackup(undefined);
        setMessage('');
        if (!file) return;
        try {
          setBackup(readWatchBackup(await file.text()));
        } catch {
          setMessage('Choose a valid Theia watch backup.');
        }
      }} />
    </label>
    {backup && <>
      <p>{describeWatchBackup(backup)}</p>
      <button type="button" onClick={() => {
        importWatchBackup(backup);
        setBackup(undefined);
        setMessage('Watch backup imported.');
      }}>Merge backup</button>
      <button type="button" onClick={() => setBackup(undefined)}>Cancel</button>
    </>}
    {message && <p role="status">{message}</p>}
  </section>;
}

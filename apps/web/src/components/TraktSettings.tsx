import React, { useId, useState, useSyncExternalStore } from 'react';
import { connectTrakt, disconnectTrakt, reportTraktError, syncTrakt, traktStatus } from '@theia/core';
import styles from './TraktSettings.module.css';

export function TraktSettings() {
  const titleId = useId();
  const status = useSyncExternalStore(traktStatus.subscribe, traktStatus.getState);
  const [busy, setBusy] = useState(false);
  const [authorization, setAuthorization] = useState<AbortController>();
  const canCancel = Boolean(window.theiaElectron?.trakt?.cancelAuthorization);
  if (!status.available) return null;

  const run = async (action: () => Promise<void>) => {
    setBusy(true);
    try { await action(); }
    catch (error) { reportTraktError(error); }
    finally { setBusy(false); }
  };

  const connect = async () => {
    const controller = canCancel ? new AbortController() : undefined;
    setAuthorization(controller);
    try {
      await run(() => connectTrakt(controller?.signal));
    } finally {
      setAuthorization(undefined);
    }
  };

  const connectionLabel = status.connected
    ? status.syncing ? 'Syncing…' : status.lastSync ? `Last synced ${new Date(status.lastSync).toLocaleString()}` : 'Connected to Trakt'
    : authorization ? 'Waiting for sign-in…' : busy ? 'Connecting…' : 'Not connected';

  return <section className={styles.card} aria-labelledby={titleId}>
    <div className={styles.identity}>
      <span className={styles.icon} aria-hidden="true">⇄</span>
      <div>
        <h3 id={titleId}>Trakt watch sync</h3>
        <p>Sync watch history, resume progress, and favorites across devices.</p>
      </div>
    </div>
    <div className={styles.footer}>
      <div className={styles.status} role="status" data-connected={status.connected}>
        <span className={styles.dot} aria-hidden="true" />
        {connectionLabel}
      </div>
      <div className={styles.actions}>
        {status.connected ? <>
          <button type="button" className={styles.primary} disabled={busy || status.syncing} onClick={() => void run(syncTrakt)}>Sync now</button>
          <button type="button" disabled={busy} onClick={() => void run(disconnectTrakt)}>Disconnect</button>
        </> : authorization ? <button type="button" onClick={() => authorization.abort()}>Cancel</button>
          : <button type="button" className={styles.primary} disabled={busy} onClick={() => void connect()}>
          Connect Trakt <span aria-hidden="true">↗</span>
        </button>}
      </div>
    </div>
    {status.error && <p className={styles.error} role="status">{status.error}</p>}
  </section>;
}

import React, { useState, useSyncExternalStore } from 'react';
import { connectTrakt, disconnectTrakt, reportTraktError, syncTrakt, traktStatus } from '@theia/core';

export function TraktSettings() {
  const status = useSyncExternalStore(traktStatus.subscribe, traktStatus.getState);
  const [upload, setUpload] = useState(false);
  const [busy, setBusy] = useState(false);
  if (!status.available) return null;

  const run = async (action: () => Promise<void>) => {
    setBusy(true);
    try { await action(); }
    catch (error) { reportTraktError(error); }
    finally { setBusy(false); }
  };

  return <section>
    <h3>Trakt watch sync</h3>
    {status.connected ? <>
      <p>{status.syncing ? 'Syncing…' : status.lastSync ? `Last synced ${new Date(status.lastSync).toLocaleString()}` : 'Connected to Trakt'}</p>
      <button type="button" disabled={busy || status.syncing} onClick={() => void run(syncTrakt)}>Sync now</button>
      <button type="button" disabled={busy} onClick={() => void run(disconnectTrakt)}>Disconnect</button>
    </> : <>
      <label style={{ display: 'block' }}>
        <input type="checkbox" checked={upload} onChange={event => setUpload(event.target.checked)} />
        Upload existing watch history, progress, and favorites
      </label>
      <button type="button" disabled={busy} onClick={() => void run(() => connectTrakt(upload))}>Connect Trakt</button>
    </>}
    {status.error && <p role="status">{status.error}</p>}
  </section>;
}

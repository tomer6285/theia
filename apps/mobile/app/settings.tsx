import React, { useState, useSyncExternalStore } from 'react';
import { Button, ScrollView, Text } from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import {
  connectTrakt, describeWatchBackup, disconnectTrakt, exportWatchBackup, importWatchBackup,
  readWatchBackup, reportTraktError, syncTrakt, traktStatus, WATCH_BACKUP_FILENAME,
} from '@theia/core';

export default function SettingsScreen() {
  const status = useSyncExternalStore(traktStatus.subscribe, traktStatus.getState);
  const [busy, setBusy] = useState(false);
  const [backup, setBackup] = useState<ReturnType<typeof readWatchBackup>>();
  const [message, setMessage] = useState('');

  const run = async (action: () => Promise<void>, report: (error: unknown) => void) => {
    setBusy(true);
    try { await action(); }
    catch (error) { report(error); }
    finally { setBusy(false); }
  };

  const exportBackup = async () => {
    if (!FileSystem.cacheDirectory || !(await Sharing.isAvailableAsync())) throw new Error('Sharing is unavailable.');
    const uri = FileSystem.cacheDirectory + WATCH_BACKUP_FILENAME;
    await FileSystem.writeAsStringAsync(uri, exportWatchBackup());
    await Sharing.shareAsync(uri, { mimeType: 'application/json' });
  };

  const selectBackup = async () => {
    setMessage('');
    setBackup(undefined);
    const result = await DocumentPicker.getDocumentAsync({ type: 'application/json', copyToCacheDirectory: true });
    if (result.canceled) return;
    const { uri } = result.assets[0];
    setBackup(readWatchBackup(await FileSystem.readAsStringAsync(uri)));
  };

  return <ScrollView contentContainerStyle={{ padding: 20, gap: 14 }}>
    <Text style={{ color: '#fff', fontSize: 20, fontWeight: 'bold' }}>Watch backup</Text>
    <Button title="Export JSON" disabled={busy} onPress={() => void run(exportBackup, () => setMessage('Could not export the watch backup.'))} />
    <Button title="Import JSON" disabled={busy} onPress={() => void run(selectBackup, () => setMessage('Choose a valid Theia watch backup.'))} />
    {backup && <>
      <Text style={{ color: '#fff' }}>{describeWatchBackup(backup)}</Text>
      <Button title="Merge backup" onPress={() => {
        importWatchBackup(backup);
        setBackup(undefined);
        setMessage('Watch backup imported.');
      }} />
      <Button title="Cancel" onPress={() => setBackup(undefined)} />
    </>}
    {message ? <Text accessibilityLiveRegion="polite" style={{ color: '#fff' }}>{message}</Text> : null}
    {status.available && <>
      <Text style={{ color: '#fff', fontSize: 20, fontWeight: 'bold' }}>Trakt watch sync</Text>
      {status.connected ? <>
        <Text style={{ color: '#fff' }}>{status.syncing ? 'Syncing…' : status.lastSync
          ? `Last synced ${new Date(status.lastSync).toLocaleString()}` : 'Connected to Trakt'}</Text>
        <Button title="Sync now" disabled={busy || status.syncing} onPress={() => void run(syncTrakt, reportTraktError)} />
        <Button title="Disconnect" disabled={busy} onPress={() => void run(disconnectTrakt, reportTraktError)} />
      </> : <Button title="Connect Trakt" disabled={busy} onPress={() => void run(connectTrakt, reportTraktError)} />}
      {!!status.error && <Text accessibilityLiveRegion="polite" style={{ color: '#fff' }}>{status.error}</Text>}
    </>}
  </ScrollView>;
}

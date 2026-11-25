import { app, BrowserWindow, ipcMain, net, safeStorage, type IpcMainInvokeEvent } from 'electron';
import { readFile, rename, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

import { authorizeTrakt } from './trakt-authorization';
const methods = new Set(['GET', 'POST', 'DELETE']);

export function installTraktHandlers(window: () => BrowserWindow | null, appDocument: () => string) {
  const checkSender = (event: IpcMainInvokeEvent) => {
    const contents = window()?.webContents;
    const url = event.senderFrame && new URL(event.senderFrame.url);
    if (!contents || event.sender !== contents || event.senderFrame !== contents.mainFrame || !url
      || !(url.href.split(/[?#]/)[0] === appDocument() || (!app.isPackaged && url.origin === 'http://localhost:3000'))) {
      throw new Error('Unauthorized Trakt request.');
    }
  };

  ipcMain.handle('trakt:credentials', async (event, operation: string, key: string, value?: string) => {
    checkSender(event);
    const name = key === 'theia_trakt_sync_v1' ? 'trakt-session' : key === 'theia_trakt_sync_v1:oauth' ? 'trakt-oauth' : null;
    if (!name) throw new Error('Invalid credential key.');
    const file = join(app.getPath('userData'), name);
    if (operation === 'remove') { await rm(file, { force: true }); return; }
    if (!safeStorage.isEncryptionAvailable() || (process.platform === 'linux' && safeStorage.getSelectedStorageBackend() === 'basic_text')) {
      throw new Error('Unlock or configure the system keyring to connect Trakt.');
    }
    if (operation === 'get') {
      try { return safeStorage.decryptString(await readFile(file)); }
      catch (error) {
        if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null;
        throw error;
      }
    }
    if (operation !== 'set' || typeof value !== 'string' || value.length > 16384) throw new Error('Invalid credential operation.');
    const temp = file + '.tmp';
    await writeFile(temp, safeStorage.encryptString(value), { mode: 0o600 });
    await rename(temp, file);
  });

  ipcMain.handle('trakt:request', async (event, input: string, method: string, headers: Record<string, string>, body?: string) => {
    checkSender(event);
    const url = new URL(input);
    const oauth = url.origin === 'https://auth.trakt.tv' && url.pathname === '/oauth/token' && method === 'POST';
    if (!oauth && (url.origin !== 'https://api.trakt.tv' || !methods.has(method)
      || !/^\/(users\/settings|sync\/(playback(\/\d+)?|last_activities|history(\/remove)?|favorites(\/remove)?)|scrobble\/(start|pause|stop)|shows\/tt\d+\/seasons\/\d+\/episodes\/\d+)$/.test(url.pathname))) {
      throw new Error('Invalid Trakt API request.');
    }
    const response = await net.fetch(url.href, { method, headers, body, redirect: 'error', signal: AbortSignal.timeout(12000) });
    return { body: await response.text(), status: response.status, headers: Object.fromEntries(response.headers.entries()) };
  });

  let authorization: AbortController | undefined;
  ipcMain.handle('trakt:cancel-authorization', event => {
    checkSender(event);
    authorization?.abort();
  });

  ipcMain.handle('trakt:authorize', async (event, input: string) => {
    checkSender(event);
    const url = new URL(input);
    if (url.origin !== 'https://auth.trakt.tv' || url.pathname !== '/oauth/authorize') throw new Error('Invalid Trakt sign-in URL.');
    if (authorization) throw new Error('Trakt sign-in is already in progress.');
    const controller = new AbortController();
    authorization = controller;
    const contents = event.sender;
    const cancel = () => controller.abort();
    contents.once('destroyed', cancel);
    try {
      return await authorizeTrakt(url, controller.signal);
    } finally {
      contents.removeListener('destroyed', cancel);
      authorization = undefined;
    }
  });
}

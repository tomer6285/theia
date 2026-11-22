import { app, BrowserWindow, ipcMain, net, safeStorage, type IpcMainInvokeEvent } from 'electron';
import { readFile, rename, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

const domains = new Set(['https://auth.trakt.tv', 'https://trakt.tv', 'https://app.trakt.tv']);
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

  ipcMain.handle('trakt:authorize', (event, input: string) => {
    checkSender(event);
    const url = new URL(input);
    if (url.origin !== 'https://auth.trakt.tv' || url.pathname !== '/oauth/authorize') throw new Error('Invalid Trakt sign-in URL.');
    const callback = new URL(url.searchParams.get('redirect_uri') || '');
    if (callback.protocol !== 'https:') throw new Error('Trakt requires an HTTPS callback.');
    const popup = new BrowserWindow({
      parent: window() ?? undefined, modal: true, width: 640, height: 760,
      webPreferences: { nodeIntegration: false, sandbox: true, contextIsolation: true, partition: 'theia-trakt-oauth' },
    });
    return new Promise<string | undefined>((resolve) => {
      const timeout = setTimeout(() => popup.close(), 10 * 60 * 1000);
      popup.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
      const navigate = (event: Electron.Event, target: string) => {
        const next = new URL(target);
        if (next.origin === callback.origin && next.pathname === callback.pathname) {
          event.preventDefault();
          resolve(next.href);
          popup.close();
        } else if (!domains.has(next.origin)) event.preventDefault();
      };
      popup.webContents.on('will-redirect', navigate);
      popup.webContents.on('will-navigate', navigate);
      popup.on('closed', () => { clearTimeout(timeout); resolve(undefined); });
      void popup.loadURL(url.href).catch(() => { if (!popup.isDestroyed()) popup.close(); });
    });
  });
}

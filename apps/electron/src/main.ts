import { pathToFileURL } from 'url';
import { app, BrowserWindow, dialog, session } from 'electron';
import * as path from 'path';
import * as fs from 'fs';
import { startDesktopProxy } from './proxy';
import { allowPlayerPermission } from './permissions';

let mainWindow: BrowserWindow | null = null;
let desktopProxy: Awaited<ReturnType<typeof startDesktopProxy>>;

function resolveWebIndexPath(): string {
  const candidates = [
    path.join(process.resourcesPath, 'web/index.html'),
    path.join(app.getAppPath(), '../web/dist/index.html'),
    path.join(__dirname, '../../web/dist/index.html'),
    path.join(__dirname, '../web/dist/index.html'),
    path.join(app.getAppPath(), 'web/dist/index.html'),
    path.join(app.getAppPath(), 'dist/index.html'),
  ];

  for (const p of candidates) {
    if (fs.existsSync(p)) {
      return p;
    }
  }
  return candidates[0];
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 800,
    minHeight: 500,
    backgroundColor: '#09090b',
    title: 'Theia',
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
      webSecurity: true,
      sandbox: true,
      additionalArguments: [`--theia-proxy=${desktopProxy.url}`],
    },
  });

  // Auto-hide still reveals the menu on Alt; remove it on Windows and Linux.
  if (process.platform === 'win32' || process.platform === 'linux') {
    mainWindow.setMenu(null);
  }

  // Intercept and rewrite outgoing headers to bypass anti-hotlinking and CORS
  session.defaultSession.webRequest.onBeforeSendHeaders(
    { urls: ['*://*/*'] },
    (details, callback) => {
      const hostname = new URL(details.url).hostname;
      const matches = (domain: string) => hostname === domain || hostname.endsWith(`.${domain}`);

      if (matches('vixsrc.to')) {
        details.requestHeaders['Referer'] = 'https://vixsrc.to/';
        details.requestHeaders['Origin'] = 'https://vixsrc.to';
      } else if (matches('vidlink.pro')) {
        details.requestHeaders['Referer'] = 'https://vidlink.pro/';
        details.requestHeaders['Origin'] = 'https://vidlink.pro';
      } else if (matches('vidora.su')) {
        details.requestHeaders['Referer'] = 'https://vidora.su/';
        details.requestHeaders['Origin'] = 'https://vidora.su';
      }

      details.requestHeaders['User-Agent'] =
        'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

      callback({ cancel: false, requestHeaders: details.requestHeaders });
    }
  );

  const indexPath = resolveWebIndexPath();
  const appDocumentPath = new URL(pathToFileURL(indexPath).href).pathname;
  mainWindow.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  mainWindow.webContents.on('will-navigate', (event, target) => {
    const destination = new URL(target);
    const isAppDocument = destination.protocol === 'file:' && destination.pathname === appDocumentPath;
    const isDevServer = destination.origin === 'http://localhost:3000' && !app.isPackaged;
    if (!isAppDocument && !isDevServer) {
      event.preventDefault();
    }
  });
  // Embeds share this WebContents. Permit their fullscreen requests too, while
  // retaining the default denial for all other permissions and documents.
  session.defaultSession.setPermissionRequestHandler((contents, permission, callback) => {
    callback(allowPlayerPermission(permission, contents, mainWindow?.webContents ?? null,
      pathToFileURL(indexPath).href, !app.isPackaged));
  });

  if (app.isPackaged || process.env.NODE_ENV === 'production') {
    mainWindow.loadFile(indexPath);
  } else {
    mainWindow.loadURL('http://localhost:3000').catch(() => {
      mainWindow?.loadFile(indexPath);
    });
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.whenReady().then(async () => {
  desktopProxy = await startDesktopProxy();
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
}).catch((error) => {
  dialog.showErrorBox('Theia could not start', `Could not start the desktop app: ${error.message}`);
  app.quit();
});

app.on('before-quit', () => desktopProxy?.close());

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

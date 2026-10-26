import { app, BrowserWindow, session } from 'electron';
import * as path from 'path';

let mainWindow: BrowserWindow | null = null;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 800,
    minHeight: 500,
    backgroundColor: '#09090b',
    title: 'Dion Touch',
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
      webSecurity: false, // Allows cross-origin video chunk loading
    },
  });

  // Intercept and rewrite outgoing headers to bypass anti-hotlinking and CORS
  session.defaultSession.webRequest.onBeforeSendHeaders(
    { urls: ['*://*/*'] },
    (details, callback) => {
      const url = details.url;

      if (url.includes('vixsrc.to') || url.includes('vixsrc')) {
        details.requestHeaders['Referer'] = 'https://vixsrc.to/';
        details.requestHeaders['Origin'] = 'https://vixsrc.to';
      } else if (url.includes('vidlink.pro') || url.includes('vidlink')) {
        details.requestHeaders['Referer'] = 'https://vidlink.pro/';
        details.requestHeaders['Origin'] = 'https://vidlink.pro';
      } else if (url.includes('vidora.su') || url.includes('vidora')) {
        details.requestHeaders['Referer'] = 'https://vidora.su/';
        details.requestHeaders['Origin'] = 'https://vidora.su';
      }

      details.requestHeaders['User-Agent'] =
        'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

      callback({ cancel: false, requestHeaders: details.requestHeaders });
    }
  );

  // In production, load the built web app
  const indexPath = path.join(__dirname, '../../web/dist/index.html');
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

app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

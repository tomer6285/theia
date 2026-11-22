import { contextBridge, ipcRenderer } from 'electron';

const electronApi = {
  isElectron: true,
  trakt: {
    authorize: (url: string) => ipcRenderer.invoke("trakt:authorize", url),
    request: (url: string, method: string, headers: Record<string, string>, body?: string) =>
      ipcRenderer.invoke("trakt:request", url, method, headers, body),
    credentials: {
      getItem: (key: string) => ipcRenderer.invoke("trakt:credentials", "get", key),
      setItem: (key: string, value: string) => ipcRenderer.invoke("trakt:credentials", "set", key, value),
      removeItem: (key: string) => ipcRenderer.invoke("trakt:credentials", "remove", key),
    },
  },
  platform: process.platform,
  proxyUrl: process.argv.find((arg) => arg.startsWith('--theia-proxy='))?.slice('--theia-proxy='.length),
};

contextBridge.exposeInMainWorld('theiaElectron', electronApi);
contextBridge.exposeInMainWorld('dionElectron', electronApi);

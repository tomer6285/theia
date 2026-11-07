import { contextBridge } from 'electron';

const electronApi = {
  isElectron: true,
  platform: process.platform,
  proxyUrl: process.argv.find((arg) => arg.startsWith('--theia-proxy='))?.slice('--theia-proxy='.length),
};

contextBridge.exposeInMainWorld('theiaElectron', electronApi);
contextBridge.exposeInMainWorld('dionElectron', electronApi);

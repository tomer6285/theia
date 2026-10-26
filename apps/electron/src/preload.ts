import { contextBridge } from 'electron';

contextBridge.exposeInMainWorld('dionElectron', {
  isElectron: true,
  platform: process.platform,
});

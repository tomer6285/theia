import { contextBridge } from 'electron';

const electronApi = {
  isElectron: true,
  platform: process.platform,
};

contextBridge.exposeInMainWorld('theiaElectron', electronApi);
contextBridge.exposeInMainWorld('dionElectron', electronApi);

/// <reference types="vite/client" />

interface Window {
  theiaElectron?: { isElectron: boolean; platform: string; proxyUrl?: string };
}

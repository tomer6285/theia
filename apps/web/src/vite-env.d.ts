/// <reference types="vite/client" />

interface Window {
  theiaElectron?: {
    isElectron: boolean;
    platform: string;
    proxyUrl?: string;
    trakt?: {
      authorize: (url: string) => Promise<string | undefined>;
      cancelAuthorization?: () => Promise<void>;
      request: (url: string, method: string, headers: Record<string, string>, body?: string) =>
        Promise<{ body: string; status: number; headers: Record<string, string> }>;
      credentials: import('@theia/core').StorageAdapter;
    };
  };
}

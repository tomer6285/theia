import {
  configureTrakt, finishTraktAuthorization, reportTraktError, syncTrakt, type StorageAdapter,
} from '@theia/core';

const LOCAL_TRAKT_CLIENT_ID = 'y-JRGpmADrP8uVrOUDmS3Xwem35F58-HWBnKqpFHdPs';
const LOCAL_TRAKT_ORIGIN = 'http://localhost:3000';

const bytesToBase64Url = (bytes: Uint8Array) =>
  btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

export async function initializeTrakt() {
  const desktop = window.theiaElectron?.trakt;
  const localWeb = !desktop && location.origin === LOCAL_TRAKT_ORIGIN;
  const clientId = import.meta.env.VITE_TRAKT_CLIENT_ID?.trim() || (localWeb ? LOCAL_TRAKT_CLIENT_ID : '');
  const redirectUri = desktop
    ? import.meta.env.VITE_TRAKT_DESKTOP_REDIRECT_URI
    : import.meta.env.VITE_TRAKT_WEB_REDIRECT_URI || (localWeb ? LOCAL_TRAKT_ORIGIN + '/' : '');
  if (!clientId || !redirectUri || !globalThis.crypto?.subtle) return;
  const webCredentials: StorageAdapter = {
    getItem: key => sessionStorage.getItem(key),
    setItem: (key, value) => sessionStorage.setItem(key, value),
    removeItem: key => sessionStorage.removeItem(key),
  };
  await configureTrakt({
    clientId, redirectUri, credentials: desktop?.credentials ?? webCredentials, storage: localStorage,
    allowLocalhostRedirect: localWeb,
    makeProof: async () => {
      const state = bytesToBase64Url(crypto.getRandomValues(new Uint8Array(32)));
      const verifier = bytesToBase64Url(crypto.getRandomValues(new Uint8Array(32)));
      const hash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier));
      return { state, verifier, challenge: bytesToBase64Url(new Uint8Array(hash)) };
    },
    authorize: desktop ? url => desktop.authorize(url) : async url => {
      window.location.assign(url);
      return undefined;
    },
    fetch: desktop ? async (input, init) => {
      if (init?.signal?.aborted) throw new DOMException('Request aborted', 'AbortError');
      const result = await desktop.request(String(input), init?.method || 'GET',
        init?.headers as Record<string, string>, typeof init?.body === 'string' ? init.body : undefined);
      if (init?.signal?.aborted) throw new DOMException('Request aborted', 'AbortError');
      return new Response(result.body || null, { status: result.status, headers: result.headers });
    } : undefined,
  });
  const url = new URL(location.href);
  if (!desktop && url.origin + url.pathname === new URL(redirectUri).href && url.searchParams.has('state')
    && (url.searchParams.has('code') || url.searchParams.has('error'))) {
    for (const key of ['code', 'state', 'error', 'error_description']) url.searchParams.delete(key);
    const callback = location.href;
    history.replaceState(history.state, '', url);
    await finishTraktAuthorization(callback).catch(reportTraktError);
  }
  const refresh = () => { if (!document.hidden) void syncTrakt(); };
  document.addEventListener('visibilitychange', refresh);
  window.addEventListener('online', refresh);
}

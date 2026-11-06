import { theiaStore } from '../storage';

let defaultProxyUrl = '';

/** App-specific routing defaults are not persisted as a user's custom endpoint. */
export function setDefaultProxyUrl(url: string): void {
  defaultProxyUrl = url;
}

export function getDefaultProxyUrl(): string {
  return defaultProxyUrl;
}

export function getProxyUrl(): string {
  return theiaStore.getState().settings.proxyUrl || defaultProxyUrl;
}

export function proxyResourceUrl(url: string, referer: string): string {
  const endpoint = getProxyUrl();
  if (!endpoint) return url;
  const proxy = new URL(endpoint, typeof location !== 'undefined' ? location.href : undefined);
  if (!['http:', 'https:'].includes(proxy.protocol)) throw new Error('Invalid proxy URL');
  proxy.searchParams.set('url', url);
  proxy.searchParams.set('referer', referer);
  return proxy.href;
}

import { theiaStore } from '../storage';

/** Responses here are small JSON/HTML documents. Keep timeout and cancellation
 * active through body consumption, and release every timer and listener. */
export async function fetchWithTimeout(
  url: string, init: RequestInit, signal?: AbortSignal, timeoutMs = 3500
): Promise<Response> {
  const controller = new AbortController();
  const abort = () => controller.abort();
  signal?.addEventListener('abort', abort, { once: true });
  if (signal?.aborted) controller.abort();
  const timer = setTimeout(abort, timeoutMs);
  try {
    const response = await fetch(url, { ...init, signal: controller.signal });
    const body = await response.arrayBuffer();
    return new Response(response.status === 204 || response.status === 304 ? null : body, {
      status: response.status, statusText: response.statusText, headers: response.headers,
    });
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener('abort', abort);
  }
}

/** Provider discovery also needs CORS routing in browsers, before a stream exists. */
export async function fetchProviderResponse(url: string, init: RequestInit, signal?: AbortSignal): Promise<Response> {
  const proxyUrl = theiaStore.getState().settings.proxyUrl;
  if (!proxyUrl) return fetchWithTimeout(url, init, signal);
  const proxy = new URL(proxyUrl, typeof location !== 'undefined' ? location.href : undefined);
  if (!['http:', 'https:'].includes(proxy.protocol)) throw new Error('Invalid proxy URL');
  const headers = new Headers(init.headers);
  proxy.searchParams.set('url', url);
  proxy.searchParams.set('referer', headers.get('Referer') || new URL(url).origin + '/');
  headers.delete('Referer');
  headers.delete('Origin');
  headers.delete('User-Agent');
  return fetchWithTimeout(proxy.href, { ...init, headers }, signal);
}

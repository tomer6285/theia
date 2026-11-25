import { randomBytes } from 'node:crypto';
import { setTimeout as delay } from 'node:timers/promises';
import { net, shell } from 'electron';

const lifetime = 10 * 60 * 1000;

export async function authorizeTrakt(url: URL, signal: AbortSignal) {
  const state = url.searchParams.get('state');
  const callback = new URL(url.searchParams.get('redirect_uri') || '');
  if (!state || !/^[A-Za-z0-9_-]{43}$/.test(state)
    || callback.protocol !== 'https:' || callback.pathname !== '/trakt/callback'
    || callback.username || callback.password || callback.search || callback.hash) {
    throw new Error('Trakt desktop sign-in requires an HTTPS /trakt/callback redirect.');
  }

  const endpoint = new URL('/trakt/attempt', callback);
  const headers = {
    Authorization: 'Bearer ' + randomBytes(32).toString('base64url'),
    'X-Trakt-State': state,
  };
  const request = (method: string, requestSignal?: AbortSignal) => {
    const timeout = AbortSignal.timeout(8000);
    return net.fetch(endpoint.href, {
      method, headers, redirect: 'error',
      signal: requestSignal ? AbortSignal.any([requestSignal, timeout]) : timeout,
    });
  };

  const deadline = AbortSignal.timeout(lifetime);
  const active = AbortSignal.any([signal, deadline]);
  let registered = false;
  let claimed = false;
  try {
    const registration = await request('POST', active);
    if (registration.status !== 201) throw new Error('Could not start Trakt sign-in. Try again.');
    registered = true;
    active.throwIfAborted();
    await shell.openExternal(url.href);

    for (;;) {
      await delay(1500, undefined, { signal: active });
      const response = await request('PUT', active);
      if (response.status === 204) continue;
      if (response.status === 410) throw new Error('Trakt sign-in expired. Try again.');
      if (!response.ok) throw new Error('Could not complete Trakt sign-in. Try again.');
      claimed = true;
      const result = await response.json() as { code?: unknown; error?: unknown };
      active.throwIfAborted();
      if (result.error === 'access_denied') return undefined;
      if (typeof result.code !== 'string' || !result.code) throw new Error('Trakt sign-in failed. Try again.');
      callback.search = new URLSearchParams({ state, code: result.code }).toString();
      return callback.href;
    }
  } catch (error) {
    if (signal.aborted) return undefined;
    if (deadline.aborted) throw new Error('Trakt sign-in expired. Try again.');
    // Network and browser errors can include URLs. Keep OAuth parameters out of UI errors.
    if (error instanceof Error && error.message.startsWith('Trakt sign-in')) throw error;
    throw new Error('Could not complete Trakt sign-in. Try again.');
  } finally {
    if (registered && !claimed) void request('DELETE').catch(() => {});
  }
}

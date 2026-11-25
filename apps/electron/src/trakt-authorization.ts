import { randomBytes } from 'node:crypto';
import { createServer, type RequestListener, type Server } from 'node:http';
import { setTimeout as delay } from 'node:timers/promises';
import { net, shell } from 'electron';

const lifetime = 10 * 60 * 1000;
const localhostCallback = 'http://localhost:3000/';

async function authorizeLocally(url: URL, state: string, signal: AbortSignal) {
  const deadline = AbortSignal.timeout(lifetime);
  const active = AbortSignal.any([signal, deadline]);
  const servers: Server[] = [];
  let complete: (callback: string | undefined) => void = () => {};
  const result = new Promise<string | undefined>(resolve => { complete = resolve; });
  const cancel = () => complete(undefined);
  const receive: RequestListener = (request, response) => {
    const target = request.url ?? '';
    const callback = new URL(localhostCallback);
    const query = new URLSearchParams(target.startsWith('/?') ? target.slice(2) : '');
    const code = query.get('code');
    const denied = query.get('error') === 'access_denied';
    response.setHeader('Cache-Control', 'no-store');
    response.setHeader('Content-Type', 'text/plain; charset=utf-8');
    if (request.method !== 'GET' || request.headers.host !== callback.host
      || query.get('state') !== state || (!code && !denied)) {
      response.writeHead(400).end('This Trakt sign-in request is invalid or has expired.');
      return;
    }
    if (code && !denied) callback.search = new URLSearchParams({ state, code }).toString();
    response.end(denied ? 'Trakt sign-in cancelled. Return to Theia.' : 'Return to Theia to finish connecting Trakt.',
      () => complete(denied ? undefined : callback.href));
  };

  try {
    if (signal.aborted) return;
    for (const host of ['127.0.0.1', '::1']) {
      const server = createServer(receive);
      servers.push(server);
      try {
        await new Promise<void>((resolve, reject) => {
          server.once('error', reject);
          server.listen(3000, host, () => {
            server.removeListener('error', reject);
            resolve();
          });
        });
      } catch (error) {
        const code = (error as NodeJS.ErrnoException).code;
        if (host === '::1' && (code === 'EADDRNOTAVAIL' || code === 'EAFNOSUPPORT')) continue;
        if (code === 'EADDRINUSE') throw new Error('Port 3000 is in use. Close the local server using it and try Trakt sign-in again.');
        throw new Error('Could not start the local Trakt sign-in listener.');
      }
    }
    active.addEventListener('abort', cancel, { once: true });
    if (!active.aborted) {
      const openBrowser = shell.openExternal(url.href).catch(() => {
        throw new Error('Could not open your browser for Trakt sign-in.');
      });
      const callback = await Promise.race([result, openBrowser.then(() => result)]);
      if (!active.aborted) return callback;
    }
    if (deadline.aborted && !signal.aborted) throw new Error('Trakt sign-in expired. Try again.');
  } finally {
    active.removeEventListener('abort', cancel);
    for (const server of servers) {
      server.close();
      server.closeAllConnections();
    }
  }
}

export async function authorizeTrakt(url: URL, signal: AbortSignal) {
  const state = url.searchParams.get('state');
  const redirectUri = url.searchParams.get('redirect_uri') || '';
  if (!state || !/^[A-Za-z0-9_-]{43}$/.test(state)) throw new Error('Invalid Trakt sign-in state.');
  if (redirectUri === localhostCallback) return authorizeLocally(url, state, signal);
  const callback = new URL(redirectUri);
  if (callback.protocol !== 'https:' || callback.pathname !== '/trakt/callback'
    || callback.username || callback.password || callback.search || callback.hash) {
    throw new Error('Trakt desktop sign-in requires the default localhost callback or an HTTPS /trakt/callback redirect.');
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

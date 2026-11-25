import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createServer } from 'node:http';

const { fetch, openExternal } = vi.hoisted(() => ({
  fetch: vi.fn<typeof globalThis.fetch>(),
  openExternal: vi.fn<(url: string) => Promise<void>>(),
}));

vi.mock('electron', () => ({ net: { fetch }, shell: { openExternal } }));
vi.mock('node:timers/promises', () => ({
  setTimeout: async (_ms: number, _value: unknown, { signal }: { signal: AbortSignal }) => signal.throwIfAborted(),
}));

import { authorizeTrakt } from '../src/trakt-authorization';

const callback = 'https://relay.example/trakt/callback';
const state = 's'.repeat(43);
const url = new URL('https://auth.trakt.tv/oauth/authorize');
url.search = new URLSearchParams({ redirect_uri: callback, state }).toString();
const localUrl = new URL(url);
localUrl.searchParams.set('redirect_uri', 'http://localhost:3000/');

describe('desktop Trakt authorization', () => {
  beforeEach(() => {
    fetch.mockReset();
    openExternal.mockReset().mockResolvedValue(undefined);
  });

  it('receives the local browser callback and releases port 3000', async () => {
    const request = (path: string) => globalThis.fetch('http://localhost:3000' + path);
    let browserRequests: Promise<string[]> | undefined;
    openExternal.mockImplementationOnce(() => {
      browserRequests = (async () => {
        const wrongState = await request('/?state=wrong&code=wrong');
        const wrongPath = await request('/other?state=' + state + '&code=wrong');
        const success = await request('/?state=' + state + '&code=local-code');
        return Promise.all([wrongState.text(), wrongPath.text(), success.text()]);
      })();
      return browserRequests.then(() => undefined);
    });
    expect(await authorizeTrakt(localUrl, new AbortController().signal))
      .toBe('http://localhost:3000/?state=' + state + '&code=local-code');
    expect(await browserRequests).toEqual([
      expect.stringContaining('invalid'), expect.stringContaining('invalid'), expect.stringContaining('Return to Theia'),
    ]);
    expect(openExternal).toHaveBeenCalledWith(localUrl.href);
    expect(fetch).not.toHaveBeenCalled();
    await expect(request('/')).rejects.toThrow();
  });

  it('releases the local listener on cancellation', async () => {
    const controller = new AbortController();
    openExternal.mockImplementationOnce(async () => { controller.abort(); });
    expect(await authorizeTrakt(localUrl, controller.signal)).toBeUndefined();
    await expect(globalThis.fetch('http://127.0.0.1:3000/')).rejects.toThrow();
  });

  it('reports an occupied loopback port before opening the browser', async () => {
    const server = createServer();
    await new Promise<void>((resolve, reject) => {
      server.once('error', reject);
      server.listen(3000, '127.0.0.1', resolve);
    });
    try {
      await expect(authorizeTrakt(localUrl, new AbortController().signal)).rejects.toThrow('Port 3000 is in use');
      expect(openExternal).not.toHaveBeenCalled();
    } finally {
      await new Promise<void>(resolve => server.close(() => resolve()));
    }
  });

  it('rejects other HTTP callbacks', async () => {
    const otherUrl = new URL(localUrl);
    otherUrl.searchParams.set('redirect_uri', 'http://localhost:3001/');
    await expect(authorizeTrakt(otherUrl, new AbortController().signal)).rejects.toThrow('requires');
    expect(openExternal).not.toHaveBeenCalled();
  });

  it('registers before opening the browser and returns the callback to Theia', async () => {
    fetch
      .mockResolvedValueOnce(new Response(null, { status: 201 }))
      .mockResolvedValueOnce(new Response(null, { status: 204 }))
      .mockResolvedValueOnce(Response.json({ code: 'trakt-code' }));

    const result = await authorizeTrakt(url, new AbortController().signal);
    expect(result).toBe(callback + '?state=' + state + '&code=trakt-code');
    expect(openExternal).toHaveBeenCalledWith(url.href);
    expect(fetch.mock.invocationCallOrder[0]).toBeLessThan(openExternal.mock.invocationCallOrder[0]);
    expect(fetch.mock.calls.map(([, options]) => options?.method)).toEqual(['POST', 'PUT', 'PUT']);
    const headers = new Headers(fetch.mock.calls[0][1]?.headers);
    expect(headers.get('X-Trakt-State')).toBe(state);
    expect(headers.get('Authorization')).toMatch(/^Bearer [A-Za-z0-9_-]{43}$/);
    expect(url.search).not.toContain(headers.get('Authorization')!.slice(7));
  });

  it('clears the pending relay attempt when the user cancels', async () => {
    const controller = new AbortController();
    fetch
      .mockResolvedValueOnce(new Response(null, { status: 201 }))
      .mockResolvedValueOnce(new Response(null, { status: 204 }));
    openExternal.mockImplementationOnce(async () => { controller.abort(); });

    expect(await authorizeTrakt(url, controller.signal)).toBeUndefined();
    expect(fetch.mock.calls.map(([, options]) => options?.method)).toEqual(['POST', 'DELETE']);
  });
});

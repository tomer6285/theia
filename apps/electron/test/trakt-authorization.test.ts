import { beforeEach, describe, expect, it, vi } from 'vitest';

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

describe('desktop Trakt authorization', () => {
  beforeEach(() => {
    fetch.mockReset();
    openExternal.mockReset().mockResolvedValue(undefined);
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

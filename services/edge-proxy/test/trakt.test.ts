import { describe, expect, it, vi } from 'vitest';
import worker from '../src/cloudflare';
import { TraktAttempt } from '../src/trakt';

const state = 's'.repeat(43);
const claim = 'k'.repeat(43);
const origin = 'https://relay.example';

function createRelay() {
  const data = new Map();
  const storage = {
    get: async (key: string) => data.get(key),
    put: async (key: string, value: unknown) => { data.set(key, value); },
    delete: async (key: string) => data.delete(key),
    deleteAll: async () => data.clear(),
    setAlarm: vi.fn(),
  };
  const attempt = new TraktAttempt({
    storage, blockConcurrencyWhile: (action: () => Promise<unknown>) => action(),
  } as unknown as ConstructorParameters<typeof TraktAttempt>[0]);
  const binding = {
    idFromName: vi.fn((name: string) => name),
    get: () => attempt,
  } as unknown as NonNullable<Parameters<typeof worker.fetch>[1]>['TRAKT_ATTEMPTS'];
  const fetch = (path: string, options?: RequestInit) =>
    worker.fetch(new Request(origin + path, options), { TRAKT_ATTEMPTS: binding });
  const desktop = (method: string, secret = claim) => fetch('/trakt/attempt', {
    method, headers: { 'X-Trakt-State': state, Authorization: 'Bearer ' + secret },
  });
  const callback = (query: string) => fetch('/trakt/callback?state=' + state + '&' + query);
  return { desktop, callback, storage };
}

describe('Trakt desktop callback relay', () => {
  it('hands the callback to the registered desktop once, then clears it', async () => {
    const { desktop, callback } = createRelay();
    expect((await callback('code=unused')).status).toBe(410);
    expect((await desktop('POST')).status).toBe(201);
    expect((await desktop('POST', 'x'.repeat(43))).status).toBe(409);
    expect((await desktop('PUT')).status).toBe(204);

    const browser = await callback('code=trakt-code');
    expect(browser.status).toBe(303);
    expect(browser.headers.get('Location')).toBe('/trakt/return');
    expect(browser.headers.get('Referrer-Policy')).toBe('no-referrer');
    expect((await callback('code=second-code')).status).toBe(409);
    expect((await desktop('PUT', 'x'.repeat(43))).status).toBe(401);
    expect((await desktop('DELETE', 'x'.repeat(43))).status).toBe(401);
    const result = await desktop('PUT');
    expect(result.headers.get('Cache-Control')).toBe('no-store');
    expect(await result.json()).toEqual({ code: 'trakt-code' });
    expect((await desktop('PUT')).status).toBe(410);
  });

  it('clears cancelled attempts and rejects expired attempts', async () => {
    const { desktop, callback, storage } = createRelay();
    await desktop('POST');
    expect((await desktop('DELETE')).status).toBe(204);
    expect((await callback('code=late')).status).toBe(410);

    await desktop('POST');
    const deadline = storage.setAlarm.mock.calls.at(-1)?.[0];
    vi.spyOn(Date, 'now').mockReturnValue(deadline);
    expect((await callback('code=expired')).status).toBe(410);
    expect((await desktop('PUT')).status).toBe(410);
  });

  it('returns denial without forwarding provider error details', async () => {
    const { desktop, callback } = createRelay();
    await desktop('POST');
    expect((await callback('error=access_denied&error_description=private')).status).toBe(303);
    expect(await (await desktop('PUT')).json()).toEqual({ error: 'access_denied' });
  });
});

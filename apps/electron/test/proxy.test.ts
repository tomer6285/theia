import { afterEach, expect, it, vi } from 'vitest';
import { startDesktopProxy } from '../src/proxy';

afterEach(() => vi.unstubAllGlobals());

it('serves the shared proxy on a private endpoint and rewrites playlists through it', async () => {
  const localFetch = globalThis.fetch;
  const upstream = vi.fn(async () => new Response('#EXTM3U\nsegment.ts', {
    headers: { 'Content-Type': 'application/vnd.apple.mpegurl' },
  }));
  vi.stubGlobal('fetch', upstream);
  const proxy = await startDesktopProxy();
  try {
    expect(new URL(proxy.url).hostname).toBe('127.0.0.1');
    const invalid = await localFetch(new URL('/api/proxy', proxy.url));
    expect(invalid.status).toBe(404);
    const url = new URL(proxy.url);
    url.searchParams.set('url', 'https://media.example.com/master.m3u8');
    const response = await localFetch(url, { headers: { Range: 'bytes=0-' } });
    expect(response.status).toBe(200);
    const playlist = await response.text();
    expect(playlist).toContain(proxy.url);
    expect(playlist).toContain(encodeURIComponent('https://media.example.com/segment.ts'));
    expect(upstream).toHaveBeenCalledOnce();
    url.searchParams.set('url', 'http://127.0.0.1/private');
    expect((await localFetch(url)).status).toBe(400);
    expect(upstream).toHaveBeenCalledOnce();
  } finally { proxy.close(); }
  await expect(localFetch(proxy.url)).rejects.toThrow();
});

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { VixSrcProvider, parseVixSrcPlaylist } from '../src/providers/vixsrc';
import { VidLinkProvider } from '../src/providers/vidlink';
import { getProxyUrl, proxyResourceUrl, setDefaultProxyUrl } from '../src/network/config';
import { theiaStore } from '../src/storage';
import { fetchProviderResponse } from '../src/network/request';

const expires = () => Math.floor(Date.now() / 1000) + 3600;
const embedHtml = () => `<script>
window.masterPlaylist = {
  params: { 'token': 'signed-token', 'expires': '${expires()}', 'asn': '' },
  url: 'https://vixsrc.to/playlist/1234',
}
window.canPlayFHD = true;
</script>`;

beforeEach(() => { setDefaultProxyUrl(''); theiaStore.getState().updateSettings({ proxyUrl: '' }); });
afterEach(() => { setDefaultProxyUrl(''); vi.unstubAllGlobals(); });

describe('playback routing', () => {
  it('uses the app proxy by default, preserves custom endpoints, and keeps native direct', () => {
    expect(getProxyUrl()).toBe('');
    expect(proxyResourceUrl('https://cdn.example/video', 'https://provider.example/')).toBe('https://cdn.example/video');
    vi.stubGlobal('location', { href: 'http://10.142.1.205:3000/' });
    setDefaultProxyUrl('/api/proxy');
    const proxy = new URL(proxyResourceUrl('https://cdn.example/master.m3u8?token=123', 'https://provider.example/'));
    expect(proxy.origin).toBe('http://10.142.1.205:3000');
    expect(proxy.pathname).toBe('/api/proxy');
    expect(proxy.searchParams.get('url')).toBe('https://cdn.example/master.m3u8?token=123');
    theiaStore.getState().updateSettings({ proxyUrl: 'https://custom.example/proxy?key=test' });
    expect(getProxyUrl()).toContain('https://custom.example');
  });
  it('routes discovery through the automatic LAN proxy even with saved empty settings', async () => {
    vi.stubGlobal('location', { href: 'http://10.142.1.205:3000/' });
    setDefaultProxyUrl('/api/proxy');
    const request = vi.fn().mockResolvedValue(Response.json({ src: '/embed/1234' }));
    vi.stubGlobal('fetch', request);
    await fetchProviderResponse('https://vixsrc.to/api/movie/27205', { headers: { Referer: 'https://vixsrc.to/' } });
    expect(new URL(request.mock.calls[0][0]).origin).toBe('http://10.142.1.205:3000');
  });
});

describe('VixSrc direct playback', () => {
  it('extracts signed playlists without evaluating page scripts', () => {
    const url = new URL(parseVixSrcPlaylist(embedHtml(), 'https://vixsrc.to/embed/1234')!);
    expect(url.pathname).toBe('/playlist/1234');
    expect(url.searchParams.get('token')).toBe('signed-token');
    expect(url.searchParams.get('expires')).toBe(String(expires()));
    expect(url.searchParams.get('h')).toBe('1');
    expect(url.searchParams.has('asn')).toBe(false);
  });
  it('rejects expired, malformed, and non-HTTP playlist data', () => {
    expect(parseVixSrcPlaylist(embedHtml().replace(String(expires()), '1'), 'https://vixsrc.to/')).toBeNull();
    expect(parseVixSrcPlaylist('<script>window.masterPlaylist = evil()</script>', 'https://vixsrc.to/')).toBeNull();
    expect(parseVixSrcPlaylist(embedHtml().replace('https://vixsrc.to/playlist/1234', 'javascript:alert(1)'), 'https://vixsrc.to/')).toBeNull();
  });
  it('resolves a fresh API token immediately to a long-lived HLS source', async () => {
    const request = vi.fn().mockResolvedValueOnce(Response.json({ src: '/embed/1234?token=short-lived' }))
      .mockResolvedValueOnce(new Response(embedHtml()));
    vi.stubGlobal('fetch', request);
    const streams = await new VixSrcProvider().resolveStreams({ imdbId: 'tt1375666', tmdbId: '27205', type: 'movie' });
    expect(streams).toHaveLength(1);
    expect(streams[0]).toMatchObject({ format: 'hls', requiresProxy: true });
    expect(streams[0].url).not.toContain('short-lived');
    expect(new URL(request.mock.calls[0][0]).pathname).toBe('/api/movie/27205');
    expect(new URL(request.mock.calls[0][0]).searchParams.has('_')).toBe(true);
    expect(request.mock.calls[1][0]).toBe('https://vixsrc.to/embed/1234?token=short-lived');
  });
  it('includes series season zero and episode numbers and cancels stale discovery', async () => {
    const request = vi.fn().mockResolvedValueOnce(Response.json({ src: '/embed/1234' })).mockResolvedValueOnce(new Response(embedHtml()));
    vi.stubGlobal('fetch', request);
    await new VixSrcProvider().resolveStreams({ imdbId: 'tt1', tmdbId: '100', type: 'series', season: 0, episode: 2 });
    expect(new URL(request.mock.calls[0][0]).pathname).toBe('/api/tv/100/0/2');
    const controller = new AbortController(); controller.abort();
    expect(await new VixSrcProvider().resolveStreams({ imdbId: 'tt1', type: 'movie', signal: controller.signal })).toEqual([]);
    expect(request).toHaveBeenCalledTimes(2);
  });
  it('does not fall back to a sandbox-incompatible or expiring iframe', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce(Response.json({ src: '/embed/1234?token=short-lived' }))
      .mockResolvedValueOnce(new Response('<html>Provider changed</html>')));
    const streams = await new VixSrcProvider().resolveStreams({ imdbId: 'tt1375666', type: 'movie' });
    expect(streams).toEqual([]);
  });
  it('does not advertise failed discovery as a playable source', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('unavailable', { status: 404 })));
    expect(await new VixSrcProvider().resolveStreams({ imdbId: 'tt1', type: 'movie' })).toEqual([]);
  });
});

it('does not offer a VidLink embed after upstream access errors', async () => {
  vi.stubGlobal('fetch', vi.fn().mockImplementation(async () => new Response('Forbidden', { status: 403 })));
  expect(await new VidLinkProvider().resolveStreams({ imdbId: 'tt1375666', tmdbId: '27205', type: 'movie' })).toEqual([]);
});

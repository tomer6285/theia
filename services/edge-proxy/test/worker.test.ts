import { afterEach, describe, expect, it, vi } from 'vitest';
import worker, { publicUrl, rewritePlaylist } from '../src/worker';

afterEach(() => vi.unstubAllGlobals());
const proxy = 'https://proxy.example/api/proxy';
const request = (target: string, init?: RequestInit) => new Request(`${proxy}?url=${encodeURIComponent(target)}`, init);

describe('media proxy', () => {
  it('rewrites segments, keys, audio, subtitle and initialization URLs', () => {
    const content = '#EXTM3U\n#EXT-X-MEDIA:TYPE=AUDIO,URI="audio/index.m3u8"\n#EXT-X-MAP:URI="init.mp4"\n#EXT-X-KEY:METHOD=AES-128,URI="/key"\nsegment.ts';
    const result = rewritePlaylist(content, 'https://cdn.example/video/master.m3u8', new URL(proxy), 'https://vixsrc.to/');
    for (const target of ['https://cdn.example/video/audio/index.m3u8', 'https://cdn.example/video/init.mp4', 'https://cdn.example/key', 'https://cdn.example/video/segment.ts']) {
      expect(result).toContain(encodeURIComponent(target));
    }
  });
  it.each(['file:///etc/passwd', 'http://localhost/private', 'http://127.0.0.1/', 'http://2130706433/', 'http://[::1]/', 'http://api.local/', 'https://user:password@cdn.example/'])('rejects %s', async (target) => {
    expect(() => publicUrl(target)).toThrow();
    expect((await worker.fetch(request(target))).status).toBe(400);
  });
  it('enforces a configured upstream allowlist on the original URL and redirects', async () => {
    const env = { ALLOWED_HOSTS: 'cdn.example,*.trusted.example' };
    expect((await worker.fetch(request('https://cdn.example.evil.example/file'), env)).status).toBe(403);
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(null, { status: 302, headers: { location: 'https://other.example/file' } })));
    expect((await worker.fetch(request('https://cdn.example/file'), env)).status).toBe(403);
  });
  it('blocks redirects to local services', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(null, { status: 302, headers: { location: 'http://127.0.0.1/private' } })));
    expect((await worker.fetch(request('https://cdn.example/video'))).status).toBe(502);
    expect(fetch).toHaveBeenCalledTimes(1);
  });
  it('never forwards cookies or authorization and supports ranged playback', async () => {
    const upstream = vi.fn().mockResolvedValue(new Response('chunk', { status: 206, headers: {
      'Content-Range': 'bytes 0-4/100', 'Accept-Ranges': 'bytes', 'Set-Cookie': 'secret=upstream',
    } }));
    vi.stubGlobal('fetch', upstream);
    const response = await worker.fetch(request('https://cdn.example/video.mp4', { headers: {
      Cookie: 'app=session', Authorization: 'Bearer secret', Range: 'bytes=0-4',
    } }));
    const headers = upstream.mock.calls[0][1].headers as Headers;
    expect(headers.get('cookie')).toBeNull();
    expect(headers.get('authorization')).toBeNull();
    expect(headers.get('range')).toBe('bytes=0-4');
    expect(response.headers.get('set-cookie')).toBeNull();
    expect(response.headers.get('content-range')).toBe('bytes 0-4/100');
    expect(response.status).toBe(206);
  });
  it('rewrites against the final redirect URL without a stale content length', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce(new Response(null, { status: 302, headers: { location: 'https://cdn.example/final/master.m3u8' } }))
      .mockResolvedValueOnce(new Response('#EXTM3U\nsegment.ts', { headers: { 'Content-Type': 'application/x-mpegURL', 'Content-Length': '19' } })));
    const response = await worker.fetch(request('https://cdn.example/original.m3u8'));
    expect(await response.text()).toContain(encodeURIComponent('https://cdn.example/final/segment.ts'));
    expect(response.headers.get('content-length')).toBeNull();
  });
  it('does not serve upstream HTML on the app origin', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('<script>bad()</script>', { headers: { 'Content-Type': 'text/html' } })));
    const response = await worker.fetch(request('https://cdn.example/video'));
    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toBe('text/plain; charset=utf-8');
    expect(response.headers.get('content-security-policy')).toContain('sandbox');
  });
  it('supports HEAD and rejects mutating methods', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(null, { headers: { 'Content-Type': 'application/vnd.apple.mpegurl' } })));
    expect(await (await worker.fetch(request('https://cdn.example/a.m3u8', { method: 'HEAD' }))).text()).toBe('');
    expect((await worker.fetch(request('https://cdn.example/a', { method: 'POST' }))).status).toBe(405);
  });
});

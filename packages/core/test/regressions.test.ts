import { encryptVidlinkToken, decryptVidlinkToken } from '../src/crypto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CinemetaClient } from '../src/metadata';
import { ProviderManager } from '../src/providers';
import { fetchWithTimeout, fetchProviderResponse } from '../src/network/request';
import { DefaultStorageAdapter, setStorageAdapter, theiaStore, saveState } from '../src/storage';
import { formatSubtitleTimestamp, offsetSubtitlesVTT, parseSubtitles } from '../src/subtitles';
import type { MediaItem, WatchProgress } from '../src/types';

afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });
const media: MediaItem = { id: 'tt1', title: 'Series', type: 'series' };
const progress = (id: string, positionSeconds = 30): WatchProgress => ({
  mediaId: media.id, episodeId: id, positionSeconds, durationSeconds: 100,
  percentage: 30, completed: false, updatedAt: Date.now(),
});

describe('persistent state', () => {
  beforeEach(() => theiaStore.setState({ history: [], progress: {}, favorites: [] }));
  it('moves a revisited episode to the front and finds the latest series progress', () => {
    const store = theiaStore.getState();
    store.updateProgress(progress('tt1:1:1'), media);
    store.updateProgress(progress('tt1:1:2'), media);
    store.updateProgress(progress('tt1:1:1', 70), media);
    expect(theiaStore.getState().history.map((item) => item.progress.episodeId)).toEqual(['tt1:1:1', 'tt1:1:2']);
    expect(store.getProgress('tt1')?.positionSeconds).toBe(70);
    expect(store.getProgress('tt1', 'tt1:1:2')?.positionSeconds).toBe(30);
  });
  it('ignores invalid progress instead of persisting NaN or zero-duration playback', () => {
    theiaStore.getState().updateProgress({ ...progress('invalid'), positionSeconds: NaN }, media);
    theiaStore.getState().updateProgress({ ...progress('invalid'), durationSeconds: 0 }, media);
    expect(theiaStore.getState().history).toEqual([]);
  });
  it('hydrates asynchronous adapters, validates saved shapes, and protects store actions', async () => {
    await setStorageAdapter({ getItem: async () => JSON.stringify({
      favorites: [media, null, {}], history: 'broken', progress: { bad: {} },
      updateSettings: 'overwritten', settings: { autoResume: false, preferredLanguages: 42 },
    }), setItem: async () => {}, removeItem: async () => {} });
    const state = theiaStore.getState();
    expect(state.favorites).toEqual([media]);
    expect(state.history).toEqual([]);
    expect(state.progress).toEqual({});
    expect(state.settings.autoResume).toBe(false);
    expect(state.settings.preferredLanguages).toEqual(['en', 'es', 'fr', 'de']);
    expect(typeof state.updateSettings).toBe('function');
  });
  it('saves browser adapters synchronously so page-exit progress is not lost', async () => {
    const adapter = new DefaultStorageAdapter();
    await setStorageAdapter(adapter);
    const state = theiaStore.getState();
    saveState(state);
    expect(adapter.getItem('theia_store')).not.toBeNull();
  });
  it('serializes asynchronous writes to prevent older saves overwriting newer state', async () => {
    const values: string[] = [];
    let release!: () => void;
    const first = new Promise<void>((resolve) => { release = resolve; });
    let calls = 0;
    await setStorageAdapter({ getItem: () => null, removeItem: () => {}, setItem: async (_key, value) => {
      if (++calls === 1) await first;
      values.push(value);
    } });
    theiaStore.getState().setSubtitleOffset('tt1', 100);
    theiaStore.getState().setSubtitleOffset('tt1', 200);
    await vi.waitFor(() => expect(calls).toBe(1));
    release();
    await vi.waitFor(() => expect(values).toHaveLength(2));
    expect(JSON.parse(values[1]).subtitleOffsets.tt1).toBe(200);
  });
});

describe('provider lifecycle', () => {
  it('cleans timers when providers finish immediately', async () => {
    vi.useFakeTimers();
    const manager = new ProviderManager({ providers: [{ id: 'fast', name: 'Fast', priority: 1, resolveStreams: async () => [] }] });
    await manager.resolveStreams({ imdbId: 'tt1', type: 'movie' });
    expect(vi.getTimerCount()).toBe(0);
  });
  it('aborts timed out providers even when they ignore cancellation', async () => {
    vi.useFakeTimers();
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    let signal: AbortSignal | undefined;
    const manager = new ProviderManager({ timeoutMs: 20, providers: [{ id: 'slow', name: 'Slow', priority: 1,
      resolveStreams: (query) => { signal = query.signal; return new Promise(() => {}); } }] });
    const pending = manager.resolveStreams({ imdbId: 'tt1', type: 'movie' });
    await vi.advanceTimersByTimeAsync(20);
    expect(await pending).toEqual([]);
    expect(signal?.aborted).toBe(true);
    expect(vi.getTimerCount()).toBe(0);
  });
  it('rejects script URLs and deduplicates equivalent provider streams', async () => {
    const valid = { id: 'valid', provider: 'test', name: 'Test', quality: 'auto', format: 'mp4' as const, url: 'https://cdn.example/video.mp4' };
    const manager = new ProviderManager({ providers: [{ id: 'test', name: 'Test', priority: 1,
      resolveStreams: async () => [valid, { ...valid, id: 'duplicate' }, { ...valid, url: 'javascript:alert(1)' }],
    }] });
    expect(await manager.resolveStreams({ imdbId: 'tt1', type: 'movie' })).toEqual([valid]);
  });
  it('routes provider discovery through the configured proxy', async () => {
    theiaStore.getState().updateSettings({ proxyUrl: 'https://proxy.example/api?token=public' });
    const request = vi.fn().mockResolvedValue(Response.json({ ok: true }));
    vi.stubGlobal('fetch', request);
    try {
      await fetchProviderResponse('https://provider.example/api/movie/1', { headers: { Referer: 'https://provider.example/movie/1' } });
      const url = new URL(request.mock.calls[0][0]);
      expect(url.origin).toBe('https://proxy.example');
      expect(url.searchParams.get('token')).toBe('public');
      expect(url.searchParams.get('url')).toBe('https://provider.example/api/movie/1');
      expect(url.searchParams.get('referer')).toBe('https://provider.example/movie/1');
    } finally { theiaStore.getState().updateSettings({ proxyUrl: '' }); }
  });
  it('cleans per-request timers after network rejection', async () => {
    vi.useFakeTimers();
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')));
    await expect(fetchWithTimeout('https://example.com', {})).rejects.toThrow('offline');
    expect(vi.getTimerCount()).toBe(0);
  });
});

describe('subtitle boundaries', () => {
  it('carries rounded milliseconds into minutes and hours', () => {
    expect(formatSubtitleTimestamp(59.9999)).toBe('00:01:00.000');
    expect(formatSubtitleTimestamp(3599.9999)).toBe('01:00:00.000');
    expect(formatSubtitleTimestamp(NaN)).toBe('00:00:00.000');
  });
  it('drops cues shifted entirely before playback', () => {
    const shifted = offsetSubtitlesVTT('1\n00:00:01,000 --> 00:00:02,000\nFirst\n\n2\n00:00:03,000 --> 00:00:05,000\nSecond', -3000);
    expect(parseSubtitles(shifted)).toEqual([{ start: 0, end: 2, text: 'Second' }]);
  });
});

describe('metadata payloads', () => {
  it('accepts catalog IDs without imdb_id and keeps specials after regular seasons', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce(Response.json({ metas: [{ id: 'tt1', name: 'Series' }] }))
      .mockResolvedValueOnce(Response.json({ meta: { id: 'tt1', name: 'Series', videos: [
        { season: 0, episode: 1, title: 'Special' }, { season: 1, episode: 2 }, { season: 1, episode: 1 },
        { season: 'bad', episode: 'bad' },
      ] } })));
    const client = new CinemetaClient();
    expect((await client.search('Series', 'series'))[0]?.id).toBe('tt1');
    const item = await client.getDetails('tt1', 'series');
    expect(item?.episodes?.map((ep) => [ep.season, ep.episode])).toEqual([[1, 1], [1, 2], [0, 1]]);
  });
});

it('supports native UTF-8 tokens without TextEncoder or TextDecoder globals', () => {
  vi.stubGlobal('TextEncoder', undefined);
  vi.stubGlobal('TextDecoder', undefined);
  const token = encryptVidlinkToken('tt1/été/日本語');
  expect(decryptVidlinkToken(token)?.mediaId).toBe('tt1/été/日本語');
});

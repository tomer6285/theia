import { describe, expect, it, vi } from 'vitest';
import type { MediaItem, WatchProgress } from '../src/types';

const movie: MediaItem = { id: 'tt12345', title: 'Example', type: 'movie' };
const sample: WatchProgress = {
  mediaId: movie.id, positionSeconds: 25, durationSeconds: 100, percentage: 25, completed: false, updatedAt: 1000,
};

function memoryStorage() {
  const data = new Map<string, string>();
  return {
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => { data.set(key, value); },
    removeItem: (key: string) => { data.delete(key); },
  };
}

describe('watch sync', () => {
  it('round-trips watch records, leaves settings intact, and keeps newer resume positions and dismissals', async () => {
    vi.resetModules();
    const { exportWatchBackup, importWatchBackup, readWatchBackup, theiaStore } = await import('../src/storage');
    const state = theiaStore.getState();
    state.updateSettings({ autoResume: false });
    state.updateProgress(sample, movie);
    state.toggleFavorite(movie);
    const raw = exportWatchBackup();
    expect(JSON.parse(raw)).not.toHaveProperty('settings');
    state.updateProgress({ ...sample, positionSeconds: 12, updatedAt: 2000 }, movie);
    state.dismissContinueWatching(movie.id);
    expect(() => readWatchBackup(raw.replace('"version": 2', '"version": 3'))).toThrow();
    importWatchBackup(readWatchBackup(raw));
    expect(theiaStore.getState().getProgress(movie.id)?.positionSeconds).toBe(12);
    expect(theiaStore.getState().history[0].dismissedFromContinueWatching).toBe(true);
    expect(theiaStore.getState().favorites).toEqual([movie]);
    expect(theiaStore.getState().settings.autoResume).toBe(false);
  });

  it.each([
    ['http://localhost:3000/', true, true],
    ['http://localhost:3000/', false, false],
    ['http://localhost:3000', true, false],
    ['http://localhost:3001/', true, false],
    ['http://localhost:3000/settings', true, false],
    ['http://localhost:3000/?code=test', true, false],
    ['http://127.0.0.1:3000/', true, false],
    ['http://localhost.example.com:3000/', true, false],
    ['https://example.com/', false, true],
  ])('checks Trakt redirect %s with localhost opt-in %s', async (redirectUri, allowLocalhostRedirect, available) => {
    vi.resetModules();
    const { configureTrakt, traktStatus } = await import('../src/storage');
    await configureTrakt({
      clientId: 'client-id', redirectUri, allowLocalhostRedirect,
      credentials: memoryStorage(), storage: memoryStorage(),
      authorize: async () => undefined,
      makeProof: async () => ({ state: 'correct', verifier: 'verifier', challenge: 'challenge' }),
    });
    expect(traktStatus.getState().available).toBe(available);
  });

  it.each([
    'https://example.com/settings',
    'http://localhost:3000/',
  ])('validates OAuth state, pulls resume progress, and uploads existing favorites via %s', async (redirectUri) => {
    vi.resetModules();
    const {
      configureTrakt, connectTrakt, disconnectTrakt, finishTraktAuthorization, syncTrakt,
      theiaStore, traktResumePosition,
    } = await import('../src/storage');
    const date = new Date().toISOString();
    const remoteMovie = { title: movie.title, ids: { imdb: movie.id, trakt: 1 } };
    let remoteFavorite = false;
    const fetch = vi.fn<typeof globalThis.fetch>(async (input, init) => {
      const url = new URL(String(input));
      if (url.pathname === '/oauth/token') {
        expect(url.host).toBe('auth.trakt.tv');
        expect(JSON.parse(String(init?.body))).toMatchObject({ code_verifier: 'verifier', grant_type: 'authorization_code' });
        return Response.json({ access_token: 'access', refresh_token: 'refresh', expires_in: 3600 });
      }
      if (url.pathname === '/users/settings') return Response.json({ user: { ids: { slug: 'demo' } } });
      if (url.pathname === '/sync/last_activities') return Response.json({ all: date });
      if (url.pathname === '/sync/playback') return Response.json([{ id: 1, movie: remoteMovie, progress: 42, paused_at: date }]);
      if (url.pathname === '/sync/history') return Response.json([]);
      if (url.pathname === '/sync/favorites' && init?.method === 'POST') {
        expect(JSON.parse(String(init.body))).toEqual({ movies: [{ ids: { imdb: movie.id } }] });
        remoteFavorite = true;
        return Response.json({ added: { movies: 1 } });
      }
      if (url.pathname === '/sync/favorites') return Response.json(remoteFavorite ? [{ movie: remoteMovie }] : []);
      throw new Error(`Unexpected request: ${url.pathname}`);
    });
    const authorize = vi.fn(async () => undefined);
    await configureTrakt({
      clientId: 'client-id', redirectUri, credentials: memoryStorage(), storage: memoryStorage(), fetch, authorize,
      allowLocalhostRedirect: redirectUri === 'http://localhost:3000/',
      makeProof: async () => ({ state: 'correct', verifier: 'verifier', challenge: 'challenge' }),
    });
    try {
      theiaStore.getState().toggleFavorite(movie);
      await connectTrakt();
      expect(authorize).toHaveBeenCalledWith(expect.stringContaining('code_challenge_method=S256'), undefined);
      await expect(finishTraktAuthorization(redirectUri + '?code=code&state=wrong')).rejects.toThrow();
      expect(fetch).not.toHaveBeenCalled();
      await finishTraktAuthorization(redirectUri + '?code=code&state=correct');
      await syncTrakt();
      expect(traktResumePosition(theiaStore.getState().getProgress(movie.id), 1000)).toBe(420);
      expect(remoteFavorite).toBe(true);
      expect(theiaStore.getState().favorites.map(item => item.id)).toEqual([movie.id]);
    } finally {
      await disconnectTrakt();
    }
  });
});

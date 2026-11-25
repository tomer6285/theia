import { createStore } from 'zustand/vanilla';
import type { Episode, MediaItem, WatchProgress } from '../types';
import { mergeWatchBackup, removeSyncedHistory, theiaStore, type StorageAdapter } from './index';

const API = 'https://api.trakt.tv';
const AUTH = 'https://auth.trakt.tv';
const STORAGE = 'theia_trakt_sync_v1';
type Tokens = { access_token: string; refresh_token: string; expires_in: number; expiresAt: number };
type OAuthAttempt = { state: string; verifier: string; startedAt: number };
export interface TraktPlatform {
  clientId: string;
  redirectUri: string;
  allowLocalhostRedirect?: boolean;
  credentials: StorageAdapter;
  storage: StorageAdapter;
  fetch?: typeof fetch;
  makeProof: () => Promise<{ state: string; verifier: string; challenge: string }>;
  authorize: (url: string, signal?: AbortSignal) => Promise<string | undefined>;
}
type PlaybackAction = 'start' | 'pause' | 'stop';
type Target = { movie: { ids: { imdb: string } } } | {
  show: { ids: { imdb: string } }; episode: { season: number; number: number };
};
type RemoteMedia = { title: string; year?: number; ids: { imdb?: string; trakt: number } };
type RemoteWatch = {
  id: number; movie?: RemoteMedia; show?: RemoteMedia;
  episode?: { season: number; number: number; ids: { trakt: number } };
};
type RemotePlayback = RemoteWatch & { progress: number; paused_at: string };
type RemoteHistory = RemoteWatch & { watched_at: string };
type RemoteFavorite = { movie?: RemoteMedia; show?: RemoteMedia };
type Mutation =
  | { kind: 'scrobble'; action: PlaybackAction; target: Target; progress: number; key: string; at: number; attemptedAt?: number }
  | { kind: 'favorite'; media: MediaItem; add: boolean }
  | { kind: 'history'; target: Target; key: string; at: number; attemptedAt?: number }
  | { kind: 'remove'; key: string; at: number };
type Journal = {
  queue: Mutation[];
  favorites: string[];
  history: Record<string, number>;
  playback: Record<string, number>;
};

class TraktError extends Error {
  constructor(readonly status: number, readonly retryAfter: number) {
    super(status === 401 ? 'Reconnect your Trakt account.' : `Trakt request failed (${status}).`);
  }
}

export const traktStatus = createStore(() => ({
  available: false, connected: false, syncing: false, lastSync: 0, error: '',
}));

let platform: TraktPlatform | undefined;
let connection: {
  platform: TraktPlatform; tokens: Tokens; account: string; journal: Journal; controller: AbortController;
  refresh?: Promise<void>; activityStamp?: string;
} | undefined;
type Connection = NonNullable<typeof connection>;
let running: Promise<void> | undefined;
let timer: ReturnType<typeof setTimeout> | undefined;
let applying = false;
let lastPull = 0;
let retryDelay = 0;
let retryAt = 0;
let writes: Promise<void> | undefined;
const imdb = (id?: string) => typeof id === 'string' && /^tt\d+$/.test(id);
const keyOf = (progress: WatchProgress) => progress.episodeId || progress.mediaId;

function targetFor(media: MediaItem, episode?: { season?: number; episode?: number }): Target | undefined {
  const id = media.imdbId || media.id;
  if (!imdb(id)) return;
  if (media.type === 'movie') return { movie: { ids: { imdb: id } } };
  const { season, episode: number } = episode ?? {};
  if (season === undefined || number === undefined || !Number.isInteger(season) || !Number.isInteger(number)
    || season < 0 || number < 0) return;
  return { show: { ids: { imdb: id } }, episode: { season, number } };
}

function mediaFrom(item: RemoteFavorite): MediaItem | undefined {
  const remote = item.movie ?? item.show;
  if (!remote || !imdb(remote.ids?.imdb)) return;
  const id = remote.ids.imdb!;
  return { id, imdbId: id, title: remote.title, year: remote.year?.toString(), type: item.movie ? 'movie' : 'series' };
}

function watchFrom(item: RemoteWatch) {
  const media = mediaFrom(item);
  if (!media || (media.type === 'series' && !item.episode)) return;
  const season = item.episode?.season;
  const episode = item.episode?.number;
  const episodeId = item.episode ? `${media.id}:${season}:${episode}` : undefined;
  return { media, episodeId, season, episode, key: episodeId || media.id };
}

function favoriteBody(media: MediaItem) {
  const id = media.imdbId || media.id;
  if (!imdb(id)) return;
  return { [media.type === 'movie' ? 'movies' : 'shows']: [{ ids: { imdb: id } }] };
}

async function saveJournal(session: Connection) {
  const key = `${STORAGE}:${session.account}`;
  const raw = JSON.stringify(session.journal);
  const adapter = session.platform.storage;
  const result = writes ? writes.catch(() => {}).then(() => adapter.setItem(key, raw)) : adapter.setItem(key, raw);
  if (!result) return Promise.resolve();
  const pending = result.finally(() => { if (writes === pending) writes = undefined; });
  writes = pending;
  return pending;
}

async function send(config: TraktPlatform, url: string, init: RequestInit, parent?: AbortSignal) {
  const controller = new AbortController();
  const abort = () => controller.abort();
  if (parent?.aborted) abort();
  parent?.addEventListener('abort', abort, { once: true });
  const timeout = setTimeout(abort, 12000);
  try {
    return await (config.fetch ?? fetch)(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timeout);
    parent?.removeEventListener('abort', abort);
  }
}

async function exchange(config: TraktPlatform, grant: Record<string, string>, signal?: AbortSignal): Promise<Tokens> {
  const response = await send(config, `${AUTH}/oauth/token`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ client_id: config.clientId, ...grant }),
  }, signal);
  if (response.status === 400 || response.status === 401) throw new TraktError(401, 0);
  if (!response.ok) throw new TraktError(response.status, Number(response.headers.get('Retry-After')) || 0);
  const tokens: Tokens = await response.json();
  if (!tokens.access_token || !tokens.refresh_token || !Number.isFinite(tokens.expires_in)) {
    throw new Error('Trakt returned an invalid authorization response.');
  }
  return { ...tokens, expiresAt: Date.now() + tokens.expires_in * 1000 };
}

async function request(session: Connection, path: string, method = 'GET', body?: unknown) {
  if (Date.now() >= session.tokens.expiresAt - 60000) {
    session.refresh ??= (async () => {
      const tokens = await exchange(session.platform, {
        grant_type: 'refresh_token', refresh_token: session.tokens.refresh_token,
      }, session.controller.signal);
      if (session.controller.signal.aborted) return;
      session.tokens = tokens;
      await session.platform.credentials.setItem(STORAGE, JSON.stringify({ tokens, account: session.account }));
    })().finally(() => { session.refresh = undefined; });
    await session.refresh;
  }
  const response = await send(session.platform, API + path, {
    method,
    headers: {
      'trakt-api-key': session.platform.clientId, 'trakt-api-version': '2',
      Authorization: `Bearer ${session.tokens.access_token}`, 'Content-Type': 'application/json',
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  }, session.controller.signal);
  if (!response.ok) throw new TraktError(response.status, Number(response.headers.get('Retry-After')) || 0);
  return response;
}

async function pages<T>(session: Connection, path: string): Promise<T[]> {
  const result: T[] = [];
  for (let page = 1; ; page++) {
    const response = await request(session, `${path}${path.includes('?') ? '&' : '?'}page=${page}&limit=100`);
    const rows: T[] = await response.json();
    result.push(...rows);
    const count = response.headers.get('X-Pagination-Page-Count');
    if (count ? page >= Number(count) : rows.length < 100) return result;
  }
}

async function restore(config: TraktPlatform, tokens: Tokens, account: string, upload: boolean) {
  await writes?.catch(() => {});
  const raw = await config.storage.getItem(`${STORAGE}:${account}`);
  const journal: Journal = raw ? JSON.parse(raw) : { queue: [], favorites: [], history: {}, playback: {} };
  const session = { platform: config, tokens, account, journal, controller: new AbortController() };
  if (upload) {
    const { history, favorites } = theiaStore.getState();
    for (const { media, progress, lastWatchedAt } of history) {
      const target = targetFor(media, progress);
      if (!target || progress.percentage < 1) continue;
      journal.queue.push(progress.completed
        ? { kind: 'history', target, key: keyOf(progress), at: lastWatchedAt }
        : { kind: 'scrobble', action: 'pause', target, key: keyOf(progress), progress: progress.percentage, at: progress.updatedAt });
    }
    journal.queue.push(...favorites.filter(favoriteBody).map((media) => ({ kind: 'favorite' as const, media, add: true })));
    await saveJournal(session);
  }
  connection = session;
  lastPull = retryDelay = retryAt = 0;
  traktStatus.setState({ connected: true, lastSync: 0, error: '' });
  schedule(0);
}

export async function configureTrakt(config: TraktPlatform) {
  if (!config.clientId) return;
  const callback = new URL(config.redirectUri);
  const localhostRedirect = config.allowLocalhostRedirect && config.redirectUri === 'http://localhost:3000/';
  if ((!localhostRedirect && callback.protocol !== 'https:') || callback.username || callback.password || callback.hash || callback.search) return;
  if (platform) return;
  platform = config;
  subscribeTraktFavorites();
  traktStatus.setState({ available: true });
  try {
    const raw = await config.credentials.getItem(STORAGE);
    if (raw) {
      const { tokens, account } = JSON.parse(raw) as { tokens: Tokens; account: string };
      await restore(config, tokens, account, false);
    }
  } catch {
    traktStatus.setState({ error: 'Could not restore your Trakt connection. Connect again.' });
  }
}

export async function finishTraktAuthorization(callback: string) {
  const config = platform;
  if (!config) return;
  const raw = await config.credentials.getItem(`${STORAGE}:oauth`);
  const attempt: OAuthAttempt | undefined = raw ? JSON.parse(raw) : undefined;
  const url = new URL(callback);
  const expected = new URL(config.redirectUri);
  if (!attempt || Date.now() - attempt.startedAt > 10 * 60 * 1000
    || url.protocol !== expected.protocol || url.host !== expected.host || url.pathname !== expected.pathname
    || url.searchParams.get('state') !== attempt.state) throw new Error('Trakt authorization was cancelled or expired.');
  await config.credentials.removeItem(`${STORAGE}:oauth`);
  const code = url.searchParams.get('code');
  if (!code) throw new Error('Trakt authorization was cancelled.');
  const tokens = await exchange(config, {
    grant_type: 'authorization_code', code, redirect_uri: config.redirectUri, code_verifier: attempt.verifier,
  });
  const temporary = { tokens, platform: config, account: '', journal: { queue: [], favorites: [], history: {}, playback: {} }, controller: new AbortController() };
  const response = await request(temporary, '/users/settings');
  const settings = await response.json();
  const account = settings.user?.ids?.uuid ?? settings.user?.ids?.slug;
  if (typeof account !== 'string' || !account) throw new Error('Could not identify your Trakt account.');
  await config.credentials.setItem(STORAGE, JSON.stringify({ tokens, account }));
  await restore(config, tokens, account, true);
}

export async function connectTrakt(signal?: AbortSignal) {
  if (!platform || connection || signal?.aborted) return;
  const config = platform;
  const { state, verifier, challenge } = await config.makeProof();
  if (signal?.aborted) return;
  await config.credentials.setItem(`${STORAGE}:oauth`, JSON.stringify({ state, verifier, startedAt: Date.now() }));
  const url = new URL(`${AUTH}/oauth/authorize`);
  url.search = new URLSearchParams({
    response_type: 'code', client_id: config.clientId, redirect_uri: config.redirectUri,
    state, code_challenge: challenge, code_challenge_method: 'S256',
  }).toString();
  try {
    if (signal?.aborted) return;
    const callback = await config.authorize(url.href, signal);
    if (callback && !signal?.aborted) await finishTraktAuthorization(callback);
  } finally {
    if (signal?.aborted) await config.credentials.removeItem(`${STORAGE}:oauth`);
  }
}

export async function disconnectTrakt() {
  const session = connection;
  connection = undefined;
  session?.controller.abort();
  clearTimeout(timer);
  try { await running; } catch { /* The aborted request is already handled. */ }
  await platform?.credentials.removeItem(STORAGE);
  traktStatus.setState({ connected: false, syncing: false, lastSync: 0, error: '' });
}

function schedule(delay: number) {
  clearTimeout(timer);
  timer = setTimeout(() => { void syncTrakt(); }, Math.max(delay, retryAt - Date.now()));
}

function enqueue(mutation: Mutation) {
  const session = connection;
  if (!session || applying) return;
  const queue = session.journal.queue;
  const previous = queue[queue.length - 1];
  if (previous?.kind === 'scrobble' && mutation.kind === 'scrobble' && !previous.attemptedAt && !(running && queue.length === 1)
    && previous.key === mutation.key && previous.action === 'pause' && mutation.action === 'pause') {
    queue[queue.length - 1] = mutation;
  } else queue.push(mutation);
  void saveJournal(session).catch(() => traktStatus.setState({ error: 'Could not save pending Trakt changes.' }));
  schedule(100);
}

export function trackTraktPlayback(action: PlaybackAction, media: MediaItem, episode: Episode | undefined, percent: number) {
  const target = targetFor(media, episode);
  if (!target || !Number.isFinite(percent) || (action !== 'start' && percent < 1)) return;
  enqueue({ kind: 'scrobble', action, target, key: episode?.id || media.id,
    progress: Math.max(0, Math.min(percent, 100)), at: Date.now() });
}

export function removeTraktWatch(key: string) {
  enqueue({ kind: 'remove', key, at: Date.now() });
}

export function queueTraktImport(history: ReturnType<typeof theiaStore.getState>['history']) {
  for (const { media, progress, lastWatchedAt } of history) {
    const target = targetFor(media, progress);
    if (!target || progress.percentage < 1) continue;
    enqueue(progress.completed
      ? { kind: 'history', target, key: keyOf(progress), at: lastWatchedAt }
      : { kind: 'scrobble', action: 'pause', target, key: keyOf(progress), progress: progress.percentage, at: progress.updatedAt });
  }
}

function subscribeTraktFavorites() {
  return theiaStore.subscribe((state, previous) => {
    if (!connection || applying || state.favorites === previous.favorites) return;
    const old = new Set(previous.favorites.map(({ id }) => id));
    const current = new Set(state.favorites.map(({ id }) => id));
    for (const media of state.favorites) if (!old.has(media.id) && favoriteBody(media)) enqueue({ kind: 'favorite', media, add: true });
    for (const media of previous.favorites) if (!current.has(media.id) && favoriteBody(media)) enqueue({ kind: 'favorite', media, add: false });
  });
}

async function push(session: Connection, mutation: Mutation) {
  if (mutation.kind === 'favorite') {
    await request(session, mutation.add ? '/sync/favorites' : '/sync/favorites/remove', 'POST', favoriteBody(mutation.media));
    return;
  }
  const { key, at } = mutation;
  if (mutation.kind === 'remove') {
    const playback = await pages<RemotePlayback>(session, '/sync/playback');
    for (const item of playback) {
      if (watchFrom(item)?.key === key && Date.parse(item.paused_at) <= at) {
        await request(session, `/sync/playback/${item.id}`, 'DELETE').catch(ignoreMissing);
      }
    }
    const history = await pages<RemoteHistory>(session, '/sync/history');
    const ids = history.filter(item => watchFrom(item)?.key === key && Date.parse(item.watched_at) <= at).map(item => item.id);
    if (ids.length) await request(session, '/sync/history/remove', 'POST', { ids });
    return;
  }
  const isCompletion = mutation.kind === 'history' || (mutation.action === 'stop' && mutation.progress > 80);
  if (isCompletion) {
    const expected = mutation.attemptedAt ?? at;
    const after = new Date(Math.min(expected, at) - 2000).toISOString();
    const history = await pages<RemoteHistory>(session, `/sync/history?start_at=${encodeURIComponent(after)}`);
    if (history.some(item => {
      const watchedAt = Date.parse(item.watched_at);
      return watchFrom(item)?.key === key && (Math.abs(watchedAt - at) < 2000
        || (mutation.attemptedAt !== undefined && Math.abs(watchedAt - mutation.attemptedAt) < 120000));
    })) return;
  }
  if (mutation.kind === 'history' || (isCompletion && Date.now() - at > 60000)) {
    const watched_at = new Date(at).toISOString();
    const target = mutation.target;
    const body = 'movie' in target ? { movies: [{ ...target.movie, watched_at }] } : {
      shows: [{ ...target.show, seasons: [{ number: target.episode.season,
        episodes: [{ number: target.episode.number, watched_at }] }] }],
    };
    await request(session, '/sync/history', 'POST', body);
    return;
  }
  if (isCompletion) {
    mutation.attemptedAt = Date.now();
    await saveJournal(session);
  }
  if (mutation.action === 'start' && Date.now() - at > 60000) return;
  if (!isCompletion) {
    const playback = await pages<RemotePlayback>(session, '/sync/playback');
    if (playback.some(item => watchFrom(item)?.key === key && Date.parse(item.paused_at) >= at)) return;
  }
  await request(session, `/scrobble/${mutation.action}`, 'POST', {
    ...mutation.target, progress: mutation.progress,
  }).catch((error: unknown) => {
    if (!(error instanceof TraktError) || error.status !== 409 || !isCompletion) throw error;
  });
}

function ignoreMissing(error: unknown) {
  if (!(error instanceof TraktError) || error.status !== 404) throw error;
}

async function pull(session: Connection) {
  const activities = await request(session, '/sync/last_activities');
  const activity = await activities.json();
  const activityStamp = typeof activity.all === 'string' ? activity.all : undefined;
  if (activityStamp && activityStamp === session.activityStamp) return;
  const [playback, history, favorites] = await Promise.all([
    pages<RemotePlayback>(session, '/sync/playback'),
    pages<RemoteHistory>(session, '/sync/history'),
    pages<RemoteFavorite>(session, '/sync/favorites'),
  ]);
  if (session.controller.signal.aborted) return;
  const records: Parameters<typeof mergeWatchBackup>[0] = { progress: {}, history: [], favorites: [] };
  const remoteHistory: Record<string, number> = {};
  const remotePlayback: Record<string, number> = {};
  const state = theiaStore.getState();
  const existingHistory = new Map(state.history.map(item => [keyOf(item.progress), item.media]));
  const mediaByKey = new Map<string, MediaItem>();
  const pendingRemovals = new Map(session.journal.queue.flatMap(item => item.kind === 'remove' ? [[item.key, item.at] as const] : []));
  for (const [rows, completed] of [[history, true], [playback, false]] as const) {
    for (const item of rows) {
      const watch = watchFrom(item);
      if (!watch) continue;
      const updatedAt = Date.parse('paused_at' in item ? item.paused_at : item.watched_at);
      if (!Number.isFinite(updatedAt) || updatedAt <= (pendingRemovals.get(watch.key) ?? -1)) continue;
      const index = completed ? remoteHistory : remotePlayback;
      index[watch.key] = Math.max(index[watch.key] ?? 0, updatedAt);
      if ((records.progress[watch.key]?.updatedAt ?? -1) >= updatedAt) continue;
      const percentage = 'progress' in item ? item.progress : 100;
      if (!Number.isFinite(percentage) || percentage < 0 || percentage > 100) continue;
      const durationSeconds = state.progress[watch.key]?.durationSeconds ?? 0;
      const progress = { mediaId: watch.media.id, episodeId: watch.episodeId, season: watch.season, episode: watch.episode,
        durationSeconds, positionSeconds: durationSeconds * percentage / 100, updatedAt, percentage, completed, resumeByPercentage: true };
      records.progress[watch.key] = progress;
      mediaByKey.set(watch.key, watch.media);
    }
  }
  for (const [key, progress] of Object.entries(records.progress)) {
    if (progress.updatedAt < (state.progress[key]?.updatedAt ?? -1)) continue;
    const media = existingHistory.get(key) ?? mediaByKey.get(key);
    if (media) records.history.push({ media,
      progress, lastWatchedAt: progress.updatedAt });
  }
  records.favorites = favorites.flatMap(item => {
    const media = mediaFrom(item);
    return media ? [media] : [];
  });
  const remoteFavorites = new Set(records.favorites.map(item => item.id));
  const pendingFavorites = new Set(session.journal.queue.flatMap(item => item.kind === 'favorite' ? [item.media.id] : []));
  records.favorites = records.favorites.filter(item => !pendingFavorites.has(item.id));
  applying = true;
  try {
    const removedFavorites = new Set(session.journal.favorites.filter(id => !remoteFavorites.has(id) && !pendingFavorites.has(id)));
    const nextFavorites = state.favorites.filter(item => !removedFavorites.has(item.id));
    if (nextFavorites.length !== state.favorites.length) theiaStore.setState({ favorites: nextFavorites });
    for (const key of new Set([...Object.keys(session.journal.history), ...Object.keys(session.journal.playback)])) {
      // Starting playback removes a Trakt checkpoint. Only remote history disappearance signals removal.
      if (session.journal.history[key] && !(key in remoteHistory) && !(key in remotePlayback)) {
        removeSyncedHistory(key, Math.max(session.journal.history[key], session.journal.playback[key] ?? 0));
      }
    }
    mergeWatchBackup(records);
  } finally {
    applying = false;
  }
  session.journal.favorites = [...remoteFavorites];
  session.journal.history = remoteHistory;
  session.journal.playback = remotePlayback;
  await saveJournal(session);
  session.activityStamp = activityStamp;
}

export function syncTrakt(): Promise<void> {
  const session = connection;
  if (!session || Date.now() < retryAt) return Promise.resolve();
  if (running) return running;
  clearTimeout(timer);
  traktStatus.setState({ syncing: true });
  running = (async () => {
    try {
      while (session.journal.queue.length && !session.controller.signal.aborted) {
        const mutation = session.journal.queue[0];
        try {
          await push(session, mutation);
        } catch (error) {
          if (!(error instanceof TraktError) || ![404, 422].includes(error.status) || mutation.kind !== 'scrobble') throw error;
        }
        session.journal.queue.shift();
        session.activityStamp = undefined;
        await saveJournal(session);
        if (session.journal.queue.length) await new Promise(resolve => setTimeout(resolve, 1050));
      }
      await pull(session);
      if (session.controller.signal.aborted) return;
      retryDelay = retryAt = 0;
      lastPull = Date.now();
      traktStatus.setState({ lastSync: lastPull, error: '' });
      if (session.journal.queue.length) schedule(1050);
    } catch (error) {
      if (session.controller.signal.aborted) return;
      retryDelay = Math.min(retryDelay ? retryDelay * 2 : 5000, 300000);
      retryAt = Date.now() + Math.max(retryDelay, error instanceof TraktError ? error.retryAfter * 1000 : 0);
      traktStatus.setState({ error: error instanceof TraktError ? error.message : 'Could not sync with Trakt. Try again shortly.' });
      if (error instanceof TraktError && error.status === 401) {
        connection = undefined;
        session.controller.abort();
        await Promise.resolve(session.platform.credentials.removeItem(STORAGE)).catch(reportTraktError);
        traktStatus.setState({ connected: false });
      } else schedule(retryDelay);
    } finally {
      running = undefined;
      traktStatus.setState({ syncing: false });
    }
  })();
  return running;
}

export async function refreshTraktResume() {
  if (connection && Date.now() - lastPull > 30000) {
    await Promise.race([syncTrakt(), new Promise(resolve => setTimeout(resolve, 1500))]);
  }
}

export function reportTraktError(error: unknown) {
  traktStatus.setState({ error: error instanceof Error ? error.message : 'Could not connect to Trakt.' });
}

export function traktResumePosition(progress: WatchProgress | undefined, duration?: number): number {
  if (!progress || progress.completed) return 0;
  if (progress.resumeByPercentage && duration && Number.isFinite(duration) && duration > 0) return duration * progress.percentage / 100;
  return progress.positionSeconds;
}

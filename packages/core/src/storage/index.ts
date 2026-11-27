import { queueTraktImport, removeTraktWatch } from "./trakt";
import { createStore } from 'zustand/vanilla';
import { WatchProgress, MediaItem, UserSettings } from '../types';

export interface StorageAdapter {
  getItem: (name: string) => Promise<string | null> | string | null;
  setItem: (name: string, value: string) => Promise<void> | void;
  removeItem: (name: string) => Promise<void> | void;
}

// In-memory or localStorage fallback adapter
export class DefaultStorageAdapter implements StorageAdapter {
  private mem: Record<string, string> = {};

  getItem(name: string): string | null {
    try {
      if (typeof localStorage !== 'undefined') return localStorage.getItem(name) ?? this.mem[name] ?? null;
    } catch { /* Private browsing or denied storage: retain the in-memory session. */ }
    return this.mem[name] ?? null;
  }

  setItem(name: string, value: string): void {
    this.mem[name] = value;
    try { if (typeof localStorage !== 'undefined') localStorage.setItem(name, value); } catch { /* use memory */ }
  }

  removeItem(name: string): void {
    delete this.mem[name];
    try { if (typeof localStorage !== 'undefined') localStorage.removeItem(name); } catch { /* use memory */ }
  }
}

export interface Watchlist {
  id: string;
  name: string;
  items: MediaItem[];
}

export const watchlistItemKey = (media: MediaItem) => `${media.type}:${media.id}`;

export interface WatchState {
  progress: Record<string, WatchProgress>;
  history: Array<{
    media: MediaItem;
    progress: WatchProgress;
    lastWatchedAt: number;
    dismissedFromContinueWatching?: boolean;
  }>;
  favorites: MediaItem[];
  watchlists: Watchlist[];
  subtitleOffsets: Record<string, number>;
  settings: UserSettings;

  updateProgress: (progress: WatchProgress, media?: MediaItem) => void;
  getProgress: (mediaId: string, episodeId?: string) => WatchProgress | undefined;
  toggleFavorite: (media: MediaItem) => void;
  createWatchlist: (name: string, media?: MediaItem) => string | undefined;
  renameWatchlist: (id: string, name: string) => void;
  deleteWatchlist: (id: string) => void;
  addToWatchlist: (id: string, media: MediaItem) => void;
  removeFromWatchlist: (id: string, itemKey: string) => void;
  reorderWatchlist: (id: string, itemKey: string, targetKey: string) => void;
  moveBetweenWatchlists: (sourceId: string, destinationId: string, itemKey: string) => void;
  isFavorite: (mediaId: string) => boolean;
  setSubtitleOffset: (mediaId: string, offsetMs: number) => void;
  getSubtitleOffset: (mediaId: string) => number;
  updateSettings: (settings: Partial<UserSettings>) => void;
  clearHistory: () => void;
  removeHistoryEntry: (mediaId: string, episodeId?: string) => void;
  dismissContinueWatching: (mediaId: string) => void;
}

const DEFAULT_SETTINGS: UserSettings = {
  defaultPlayer: 'native',
  preferredLanguages: ['en', 'es', 'fr', 'de'],
  preferredSubtitles: ['en'],
  serverPriority: ['vidlink', 'vixsrc', 'vidora'],
  proxyUrl: '',
  autoPlayNext: true,
  autoResume: true,
  volume: 100,
  muted: false,
  subtitleOffset: 0,
  aspectRatio: 'fit',
};

let currentAdapter: StorageAdapter = new DefaultStorageAdapter();
const STORAGE_KEY = 'theia_store';
const LEGACY_STORAGE_KEY = 'dion_tc_store';

type PersistedState = Pick<WatchState, 'progress' | 'history' | 'favorites' | 'watchlists' | 'subtitleOffsets' | 'settings'>;
const isRecord = (value: unknown): value is Record<string, any> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);
const isMedia = (value: unknown): value is MediaItem =>
  isRecord(value) && typeof value.id === 'string' && typeof value.title === 'string'
  && (value.type === 'movie' || value.type === 'series');
const isProgress = (value: unknown): value is WatchProgress =>
  isRecord(value) && typeof value.mediaId === 'string'
  && (value.episodeId === undefined || typeof value.episodeId === 'string')
  && ['positionSeconds', 'durationSeconds', 'percentage', 'updatedAt'].every(
    (key) => typeof value[key] === 'number' && Number.isFinite(value[key]) && value[key] >= 0
  ) && typeof value.completed === 'boolean';

function isWatchlist(value: unknown): value is Watchlist {
  return isRecord(value) && typeof value.id === 'string' && !!value.id.trim()
    && typeof value.name === 'string' && !!value.name.trim()
    && Array.isArray(value.items) && value.items.every(isBackupMedia)
    && new Set(value.items.map(watchlistItemKey)).size === value.items.length;
}

function readStoredWatchlists(value: unknown): Watchlist[] {
  if (!Array.isArray(value)) return [];
  const lists = new Map<string, Watchlist>();
  for (const list of value) {
    if (isWatchlist(list) && !lists.has(list.id)) lists.set(list.id, list);
  }
  return [...lists.values()];
}

function parseStoredState(raw: unknown): Partial<PersistedState> {
  if (typeof raw !== 'string') return {};
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!isRecord(parsed)) return {};
    const settings = { ...DEFAULT_SETTINGS };
    if (isRecord(parsed.settings)) {
      for (const key of ['autoPlayNext', 'autoResume', 'muted'] as const) {
        if (typeof parsed.settings[key] === 'boolean') settings[key] = parsed.settings[key];
      }
      for (const key of ['preferredLanguages', 'preferredSubtitles', 'serverPriority'] as const) {
        if (Array.isArray(parsed.settings[key]) && parsed.settings[key].every((v: unknown) => typeof v === 'string')) {
          settings[key] = parsed.settings[key];
        }
      }
      if (typeof parsed.settings.volume === 'number' && Number.isFinite(parsed.settings.volume)
        && parsed.settings.volume >= 0 && parsed.settings.volume <= 100) settings.volume = parsed.settings.volume;
      if (typeof parsed.settings.proxyUrl === 'string') settings.proxyUrl = parsed.settings.proxyUrl;
      if (Number.isFinite(parsed.settings.subtitleOffset)) settings.subtitleOffset = parsed.settings.subtitleOffset;
      if (['fit', 'fill', '16:9'].includes(parsed.settings.aspectRatio)) settings.aspectRatio = parsed.settings.aspectRatio;
      if (['native', 'hls'].includes(parsed.settings.defaultPlayer)) settings.defaultPlayer = parsed.settings.defaultPlayer;
    }
    return {
      settings,
      progress: isRecord(parsed.progress)
        ? Object.fromEntries(Object.entries(parsed.progress).filter(([, value]) => isProgress(value))) : {},
      history: Array.isArray(parsed.history) ? parsed.history.filter((h) =>
        isRecord(h) && isMedia(h.media) && isProgress(h.progress) && Number.isFinite(h.lastWatchedAt)
      ).sort((a, b) => b.lastWatchedAt - a.lastWatchedAt) : [],
      favorites: Array.isArray(parsed.favorites) ? parsed.favorites.filter(isMedia) : [],
      watchlists: readStoredWatchlists(parsed.watchlists),
      subtitleOffsets: isRecord(parsed.subtitleOffsets)
        ? Object.fromEntries(Object.entries(parsed.subtitleOffsets).filter(([, v]) => typeof v === 'number' && Number.isFinite(v))) : {},
    };
  } catch {
    return {};
  }
}

/** Install and hydrate an asynchronous adapter before mounting the application. */
export async function setStorageAdapter(adapter: StorageAdapter): Promise<void> {
  currentAdapter = adapter;
  try {
    const raw = await adapter.getItem(STORAGE_KEY) ?? await adapter.getItem(LEGACY_STORAGE_KEY);
    if (adapter === currentAdapter) theiaStore.setState({
      progress: {}, history: [], favorites: [], watchlists: [], subtitleOffsets: {}, settings: { ...DEFAULT_SETTINGS },
      ...parseStoredState(raw),
    });
  } catch (err) {
    console.error('Failed to load stored state:', err);
  }
}

export function loadStoredState(): Partial<PersistedState> {
  try {
    const raw = currentAdapter.getItem(STORAGE_KEY);
    if (raw instanceof Promise) {
      // Async storage is hydrated by setStorageAdapter, never parsed synchronously.
      void raw.catch(() => {});
      return {};
    }
    return parseStoredState(raw ?? currentAdapter.getItem(LEGACY_STORAGE_KEY));
  } catch {
    return {};
  }
}

let pendingWrite: Promise<void> | null = null;

export function saveState(state: PersistedState) {
  try {
    const adapter = currentAdapter;
    const serialized = JSON.stringify({
        progress: state.progress,
        history: state.history,
        favorites: state.favorites,
        watchlists: state.watchlists,
        subtitleOffsets: state.subtitleOffsets,
        settings: state.settings,
      });
    // Keep browser writes synchronous (including pagehide), but serialize async adapters.
    const result = pendingWrite
      ? pendingWrite.then(() => adapter.setItem(STORAGE_KEY, serialized))
      : adapter.setItem(STORAGE_KEY, serialized);
    if (result instanceof Promise) {
      const tracked: Promise<void> = result.catch((err) => {
        console.error('Failed to save state:', err);
      }).finally(() => { if (pendingWrite === tracked) pendingWrite = null; });
      pendingWrite = tracked;
    }
  } catch (err) {
    console.error('Failed to save state:', err);
  }
}

const initialSaved = loadStoredState();

function updateWatchlists(update: (lists: Watchlist[]) => Watchlist[]) {
  theiaStore.setState(state => {
    const watchlists = update(state.watchlists);
    if (watchlists === state.watchlists) return state;
    saveState({ ...state, watchlists });
    return { watchlists };
  });
}

function updateList(id: string, update: (list: Watchlist) => Watchlist) {
  updateWatchlists(lists => {
    const list = lists.find(item => item.id === id);
    if (!list) return lists;
    const updated = update(list);
    return updated === list ? lists : lists.map(item => item === list ? updated : item);
  });
}

export const theiaStore = createStore<WatchState>((set, get) => ({
  progress: initialSaved.progress || {},
  history: initialSaved.history || [],
  favorites: initialSaved.favorites || [],
  watchlists: initialSaved.watchlists || [],
  subtitleOffsets: initialSaved.subtitleOffsets || {},
  settings: { ...DEFAULT_SETTINGS, ...initialSaved.settings },

  updateProgress: (progress: WatchProgress, media?: MediaItem) => {
    if (!isProgress(progress) || progress.durationSeconds <= 0) return;
    const positionSeconds = Math.min(progress.positionSeconds, progress.durationSeconds);
    progress = { ...progress, positionSeconds, percentage: positionSeconds / progress.durationSeconds * 100 };
    set((state) => {
      const key = progress.episodeId || progress.mediaId;
      const updatedProgress = { ...state.progress, [key]: progress };

      let newHistory = [...state.history];
      const existingIdx = newHistory.findIndex((h) =>
        progress.episodeId
          ? h.progress.episodeId === progress.episodeId
          : h.media.id === progress.mediaId && !h.progress.episodeId
      );

      const mediaToStore = media || newHistory[existingIdx]?.media;
      if (mediaToStore) {
        const historyItem = {
          media: mediaToStore,
          progress,
          lastWatchedAt: Date.now(),
        };

        if (existingIdx >= 0) {
          newHistory.splice(existingIdx, 1);
          newHistory.unshift(historyItem);
        } else {
          newHistory.unshift(historyItem);
        }

      }

      const newState = {
        progress: updatedProgress,
        history: newHistory,
      };

      saveState({ ...state, ...newState });

      return newState;
    });
  },

  getProgress: (mediaId: string, episodeId?: string) => {
    const state = get();
    const key = episodeId || mediaId;
    return state.progress[key] ?? (!episodeId
      ? state.history.find((h) => h.media.id === mediaId)?.progress : undefined);
  },

  toggleFavorite: (media: MediaItem) => {
    set((state) => {
      const exists = state.favorites.some((f) => f.id === media.id);
      const newFavs = exists
        ? state.favorites.filter((f) => f.id !== media.id)
        : [...state.favorites, media];

      saveState({ ...state, favorites: newFavs });

      return { favorites: newFavs };
    });
  },

  createWatchlist: (name, media) => {
    name = name.trim();
    if (!name) return undefined;
    const id = globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    updateWatchlists(lists => [...lists, { id, name, items: media ? [media] : [] }]);
    return id;
  },

  renameWatchlist: (id, name) => {
    name = name.trim();
    if (name) updateList(id, list => list.name === name ? list : { ...list, name });
  },

  deleteWatchlist: id => {
    updateWatchlists(lists => lists.some(list => list.id === id) ? lists.filter(list => list.id !== id) : lists);
  },

  addToWatchlist: (id, media) => {
    const key = watchlistItemKey(media);
    updateList(id, list => list.items.some(item => watchlistItemKey(item) === key)
      ? list : { ...list, items: [...list.items, media] });
  },

  removeFromWatchlist: (id, key) => {
    updateList(id, list => {
      const items = list.items.filter(item => watchlistItemKey(item) !== key);
      return items.length === list.items.length ? list : { ...list, items };
    });
  },

  reorderWatchlist: (id, key, targetKey) => {
    updateList(id, list => {
      const from = list.items.findIndex(item => watchlistItemKey(item) === key);
      const to = list.items.findIndex(item => watchlistItemKey(item) === targetKey);
      if (from < 0 || to < 0 || from === to) return list;
      const items = [...list.items];
      const [media] = items.splice(from, 1);
      items.splice(to, 0, media);
      return { ...list, items };
    });
  },

  moveBetweenWatchlists: (sourceId, destinationId, key) => {
    if (sourceId === destinationId) return;
    updateWatchlists(lists => {
      const source = lists.find(list => list.id === sourceId);
      const destination = lists.find(list => list.id === destinationId);
      const media = source?.items.find(item => watchlistItemKey(item) === key);
      if (!source || !media || !destination) return lists;

      const updatedSource = { ...source, items: source.items.filter(item => watchlistItemKey(item) !== key) };
      const updatedDestination = destination.items.some(item => watchlistItemKey(item) === key)
        ? destination : { ...destination, items: [...destination.items, media] };
      return lists.map(list => {
        if (list === source) return updatedSource;
        return list === destination ? updatedDestination : list;
      });
    });
  },

  isFavorite: (mediaId: string) => {
    return get().favorites.some((f) => f.id === mediaId);
  },

  setSubtitleOffset: (mediaId: string, offsetMs: number) => {
    if (!Number.isFinite(offsetMs)) return;
    set((state) => {
      const newOffsets = { ...state.subtitleOffsets, [mediaId]: offsetMs };
      saveState({ ...state, subtitleOffsets: newOffsets });
      return { subtitleOffsets: newOffsets };
    });
  },

  getSubtitleOffset: (mediaId: string) => {
    return get().subtitleOffsets[mediaId] ?? get().settings.subtitleOffset ?? 0;
  },

  updateSettings: (newSettings: Partial<UserSettings>) => {
    set((state) => {
      const updated = { ...state.settings, ...newSettings };
      saveState({ ...state, settings: updated });
      return { settings: updated };
    });
  },

  dismissContinueWatching: (mediaId) => {
    set((state) => {
      const history = state.history.map((item) => item.media.id === mediaId
        ? { ...item, dismissedFromContinueWatching: true } : item);
      saveState({ ...state, history });
      return { history };
    });
  },

  removeHistoryEntry: (mediaId, episodeId) => {
    removeTraktWatch(episodeId || mediaId);
    set((state) => {
      const history = state.history.filter((item) =>
        !(item.media.id === mediaId && item.progress.episodeId === episodeId)
      ).map((item) => item.media.id === mediaId
        ? { ...item, dismissedFromContinueWatching: true } : item);
      const progress = { ...state.progress };
      const key = episodeId || mediaId;
      if (progress[key]?.mediaId === mediaId) delete progress[key];
      saveState({ ...state, history, progress });
      return { history, progress };
    });
  },

  clearHistory: () => {
    set((state) => {
      saveState({ ...state, progress: {}, history: [] });
      return { progress: {}, history: [] };
    });
  },
}));

export const dionStore = theiaStore;

export * from './continueWatching';

type WatchRecords = Pick<PersistedState, 'progress' | 'history' | 'favorites'> & { watchlists?: Watchlist[] };

function isBackupEpisode(value: unknown): boolean {
  return isRecord(value) && typeof value.id === 'string' && typeof value.title === 'string'
    && Number.isInteger(value.season) && Number.isInteger(value.episode)
    && ['overview', 'thumbnail', 'released', 'rating'].every(key => value[key] === undefined || typeof value[key] === 'string');
}

function isBackupMedia(value: unknown): value is MediaItem {
  if (!isRecord(value) || !isMedia(value)) return false;
  return (['imdbId', 'tmdbId', 'year', 'poster', 'background', 'description', 'rating', 'runtime', 'status'] as const)
    .every(key => value[key] === undefined || typeof value[key] === 'string')
    && (['genres', 'cast', 'director', 'writer'] as const).every(key => value[key] === undefined
      || (Array.isArray(value[key]) && value[key].every((entry: unknown) => typeof entry === 'string')))
    && (value.episodes === undefined || (Array.isArray(value.episodes) && value.episodes.every(isBackupEpisode)))
    && (value.seasons === undefined || (Array.isArray(value.seasons) && value.seasons.every(season =>
      isRecord(season) && Number.isInteger(season.season) && Array.isArray(season.episodes) && season.episodes.every(isBackupEpisode))));
}

function isBackupProgress(value: unknown): value is WatchProgress {
  return isRecord(value) && isProgress(value) && value.percentage <= 100
    && (value.resumeByPercentage === undefined || typeof value.resumeByPercentage === 'boolean')
    && (['season', 'episode'] as const).every(key => value[key] === undefined || Number.isInteger(value[key]));
}

export function exportWatchBackup(): string {
  const { progress, history, favorites, watchlists } = theiaStore.getState();
  return JSON.stringify({ format: 'theia-watch-backup', version: 2, progress, history, favorites, watchlists }, null, 2);
}

export function readWatchBackup(raw: string): WatchRecords {
  const data: unknown = JSON.parse(raw);
  if (!isRecord(data) || data.format !== 'theia-watch-backup' || (data.version !== 1 && data.version !== 2)
    || !isRecord(data.progress)
    || !Object.entries(data.progress).every(([key, progress]) =>
      isBackupProgress(progress) && key === (progress.episodeId || progress.mediaId))
    || !Array.isArray(data.history)
    || !data.history.every((entry: unknown) => isRecord(entry) && isBackupMedia(entry.media)
      && isBackupProgress(entry.progress) && entry.progress.mediaId === entry.media.id
      && Number.isFinite(entry.lastWatchedAt)
      && (entry.dismissedFromContinueWatching === undefined || typeof entry.dismissedFromContinueWatching === 'boolean'))
    || !Array.isArray(data.favorites) || !data.favorites.every(isBackupMedia)
    || (data.version === 2 && (!Array.isArray(data.watchlists) || !data.watchlists.every(isWatchlist)
      || new Set(data.watchlists.map(list => list.id)).size !== data.watchlists.length))) {
    throw new Error('Choose a valid Theia watch backup.');
  }
  const { progress, history, favorites } = data;
  return data.version === 2 ? { progress, history, favorites, watchlists: data.watchlists } : { progress, history, favorites };
}

function mergeWatchlists(current: Watchlist[], incoming: Watchlist[]): Watchlist[] {
  const merged = new Map(current.map(list => [list.id, list]));
  const incomingIds = new Set(incoming.map(list => list.id));
  for (const list of incoming) {
    if (!merged.has(list.id)) {
      merged.set(list.id, list);
      continue;
    }

    const copyPrefix = `${list.id}:import:`;
    const alreadyImported = [...merged.values()].some(existing =>
      (existing.id === list.id || (existing.id.startsWith(copyPrefix) && !incomingIds.has(existing.id)))
      && existing.name === list.name && existing.items.length === list.items.length
      && existing.items.every((item, index) => watchlistItemKey(item) === watchlistItemKey(list.items[index])));
    if (alreadyImported) continue;

    // Keep both orders when a backup and the current list have diverged.
    let copy = 1;
    while (merged.has(`${copyPrefix}${copy}`) || incomingIds.has(`${copyPrefix}${copy}`)) copy++;
    const id = `${copyPrefix}${copy}`;
    merged.set(id, { ...list, id });
  }
  return [...merged.values()];
}

export function mergeWatchBackup(backup: WatchRecords): void {
  theiaStore.setState((state) => {
    const progress = new Map(Object.entries(state.progress));
    for (const [key, incoming] of Object.entries(backup.progress)) {
      if ((progress.get(key)?.updatedAt ?? -1) < incoming.updatedAt) progress.set(key, incoming);
    }
    const history = new Map(state.history.map((entry) => [entry.progress.episodeId || entry.media.id, entry]));
    for (const incoming of backup.history) {
      const key = incoming.progress.episodeId || incoming.media.id;
      const existing = history.get(key);
      if (!existing || incoming.lastWatchedAt > existing.lastWatchedAt) {
        history.set(key, {
          ...incoming,
          dismissedFromContinueWatching: existing?.dismissedFromContinueWatching ?? incoming.dismissedFromContinueWatching,
        });
      }
    }
    const favorites = new Map([...backup.favorites, ...state.favorites].map((media) => [media.id, media]));
    const records = {
      progress: Object.fromEntries(progress),
      history: [...history.values()].sort((a, b) => b.lastWatchedAt - a.lastWatchedAt),
      favorites: [...favorites.values()],
      watchlists: backup.watchlists?.length ? mergeWatchlists(state.watchlists, backup.watchlists) : state.watchlists,
    };
    saveState({ ...state, ...records });
    return records;
  });
}

export function describeWatchBackup(backup: WatchRecords): string {
  const records = `${Object.keys(backup.progress).length} progress records, ${backup.history.length} history entries, and ${backup.favorites.length} favorites`;
  const count = backup.watchlists?.length ?? 0;
  return count ? `${records}, plus ${count} custom ${count === 1 ? 'list' : 'lists'}.` : `${records}.`;
}

export const WATCH_BACKUP_FILENAME = 'theia-watch-backup.json';

export function importWatchBackup(backup: WatchRecords): void {
  const before = theiaStore.getState();
  mergeWatchBackup(backup);
  queueTraktImport(theiaStore.getState().history.filter((entry) => !before.history.includes(entry)
    && entry.progress.updatedAt >= (before.progress[entry.progress.episodeId || entry.media.id]?.updatedAt ?? 0)));
}

export function removeSyncedHistory(key: string, remoteTimestamp: number): void {
  theiaStore.setState(state => {
    if ((state.progress[key]?.updatedAt ?? 0) > remoteTimestamp) return state;
    const progress = { ...state.progress };
    delete progress[key];
    return { progress, history: state.history.filter(entry => (entry.progress.episodeId || entry.media.id) !== key) };
  });
}

export * from './trakt';

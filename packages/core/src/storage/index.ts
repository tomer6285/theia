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

export interface WatchState {
  progress: Record<string, WatchProgress>;
  history: Array<{
    media: MediaItem;
    progress: WatchProgress;
    lastWatchedAt: number;
  }>;
  favorites: MediaItem[];
  subtitleOffsets: Record<string, number>;
  settings: UserSettings;

  updateProgress: (progress: WatchProgress, media?: MediaItem) => void;
  getProgress: (mediaId: string, episodeId?: string) => WatchProgress | undefined;
  toggleFavorite: (media: MediaItem) => void;
  isFavorite: (mediaId: string) => boolean;
  setSubtitleOffset: (mediaId: string, offsetMs: number) => void;
  getSubtitleOffset: (mediaId: string) => number;
  updateSettings: (settings: Partial<UserSettings>) => void;
  clearHistory: () => void;
}

const DEFAULT_SETTINGS: UserSettings = {
  defaultPlayer: 'native',
  preferredLanguages: ['en', 'es', 'fr', 'de'],
  preferredSubtitles: ['en'],
  serverPriority: ['vidlink', 'vixsrc', 'vidora'],
  proxyUrl: '',
  autoPlayNext: true,
  autoResume: true,
  subtitleOffset: 0,
  aspectRatio: 'fit',
};

let currentAdapter: StorageAdapter = new DefaultStorageAdapter();
const STORAGE_KEY = 'theia_store';
const LEGACY_STORAGE_KEY = 'dion_tc_store';

type PersistedState = Pick<WatchState, 'progress' | 'history' | 'favorites' | 'subtitleOffsets' | 'settings'>;
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

function parseStoredState(raw: unknown): Partial<PersistedState> {
  if (typeof raw !== 'string') return {};
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!isRecord(parsed)) return {};
    const settings = { ...DEFAULT_SETTINGS };
    if (isRecord(parsed.settings)) {
      for (const key of ['autoPlayNext', 'autoResume'] as const) {
        if (typeof parsed.settings[key] === 'boolean') settings[key] = parsed.settings[key];
      }
      for (const key of ['preferredLanguages', 'preferredSubtitles', 'serverPriority'] as const) {
        if (Array.isArray(parsed.settings[key]) && parsed.settings[key].every((v: unknown) => typeof v === 'string')) {
          settings[key] = parsed.settings[key];
        }
      }
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
      ).sort((a, b) => b.lastWatchedAt - a.lastWatchedAt).slice(0, 50) : [],
      favorites: Array.isArray(parsed.favorites) ? parsed.favorites.filter(isMedia) : [],
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
      progress: {}, history: [], favorites: [], subtitleOffsets: {}, settings: { ...DEFAULT_SETTINGS },
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

export function saveState(state: {
  progress: Record<string, WatchProgress>;
  history: WatchState['history'];
  favorites: MediaItem[];
  subtitleOffsets: Record<string, number>;
  settings: UserSettings;
}) {
  try {
    const adapter = currentAdapter;
    const serialized = JSON.stringify({
        progress: state.progress,
        history: state.history,
        favorites: state.favorites,
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

export const theiaStore = createStore<WatchState>((set, get) => ({
  progress: initialSaved.progress || {},
  history: initialSaved.history || [],
  favorites: initialSaved.favorites || [],
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

        if (newHistory.length > 50) {
          newHistory = newHistory.slice(0, 50);
        }
      }

      const newState = {
        progress: updatedProgress,
        history: newHistory,
      };

      saveState({
        progress: updatedProgress,
        history: newHistory,
        favorites: state.favorites,
        subtitleOffsets: state.subtitleOffsets,
        settings: state.settings,
      });

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

      saveState({
        progress: state.progress,
        history: state.history,
        favorites: newFavs,
        subtitleOffsets: state.subtitleOffsets,
        settings: state.settings,
      });

      return { favorites: newFavs };
    });
  },

  isFavorite: (mediaId: string) => {
    return get().favorites.some((f) => f.id === mediaId);
  },

  setSubtitleOffset: (mediaId: string, offsetMs: number) => {
    if (!Number.isFinite(offsetMs)) return;
    set((state) => {
      const newOffsets = { ...state.subtitleOffsets, [mediaId]: offsetMs };
      saveState({
        progress: state.progress,
        history: state.history,
        favorites: state.favorites,
        subtitleOffsets: newOffsets,
        settings: state.settings,
      });
      return { subtitleOffsets: newOffsets };
    });
  },

  getSubtitleOffset: (mediaId: string) => {
    return get().subtitleOffsets[mediaId] ?? get().settings.subtitleOffset ?? 0;
  },

  updateSettings: (newSettings: Partial<UserSettings>) => {
    set((state) => {
      const updated = { ...state.settings, ...newSettings };
      saveState({
        progress: state.progress,
        history: state.history,
        favorites: state.favorites,
        subtitleOffsets: state.subtitleOffsets,
        settings: updated,
      });
      return { settings: updated };
    });
  },

  clearHistory: () => {
    set((state) => {
      saveState({
        progress: {},
        history: [],
        favorites: state.favorites,
        subtitleOffsets: state.subtitleOffsets,
        settings: state.settings,
      });
      return { progress: {}, history: [] };
    });
  },
}));

export const dionStore = theiaStore;

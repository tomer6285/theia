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
    if (typeof localStorage !== 'undefined') {
      try {
        return localStorage.getItem(name);
      } catch {
        // fallback
      }
    }
    return this.mem[name] || null;
  }

  setItem(name: string, value: string): void {
    if (typeof localStorage !== 'undefined') {
      try {
        localStorage.setItem(name, value);
        return;
      } catch {
        // fallback
      }
    }
    this.mem[name] = value;
  }

  removeItem(name: string): void {
    if (typeof localStorage !== 'undefined') {
      try {
        localStorage.removeItem(name);
        return;
      } catch {
        // fallback
      }
    }
    delete this.mem[name];
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

export function setStorageAdapter(adapter: StorageAdapter) {
  currentAdapter = adapter;
}

export function loadStoredState(): Partial<WatchState> {
  try {
    const raw = currentAdapter.getItem(STORAGE_KEY) || currentAdapter.getItem(LEGACY_STORAGE_KEY);
    if (raw && typeof raw === 'string') {
      return JSON.parse(raw);
    }
  } catch (err) {
    console.error('Failed to load stored state:', err);
  }
  return {};
}

export function saveState(state: {
  progress: Record<string, WatchProgress>;
  history: WatchState['history'];
  favorites: MediaItem[];
  subtitleOffsets: Record<string, number>;
  settings: UserSettings;
}) {
  try {
    currentAdapter.setItem(
      STORAGE_KEY,
      JSON.stringify({
        progress: state.progress,
        history: state.history,
        favorites: state.favorites,
        subtitleOffsets: state.subtitleOffsets,
        settings: state.settings,
      })
    );
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
    set((state) => {
      const key = progress.episodeId || progress.mediaId;
      const updatedProgress = { ...state.progress, [key]: progress };

      let newHistory = [...state.history];
      const existingIdx = newHistory.findIndex((h) =>
        progress.episodeId
          ? h.progress.episodeId === progress.episodeId
          : h.media.id === progress.mediaId
      );

      const mediaToStore = media || newHistory[existingIdx]?.media;
      if (mediaToStore) {
        const historyItem = {
          media: mediaToStore,
          progress,
          lastWatchedAt: Date.now(),
        };

        if (existingIdx >= 0) {
          newHistory[existingIdx] = historyItem;
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
    return state.progress[key];
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

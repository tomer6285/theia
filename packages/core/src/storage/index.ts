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

export const DEFAULT_PROFILE_ID = 'default';
export const PROFILE_NAME_LIMIT = 40;

export interface HouseholdProfile {
  id: string;
  name: string;
}

export interface WatchState {
  profiles: HouseholdProfile[];
  activeProfileId: string;
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

  updateProgress: (progress: WatchProgress, media?: MediaItem, profileId?: string) => void;
  getProgress: (mediaId: string, episodeId?: string, profileId?: string) => WatchProgress | undefined;
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

type SubtitleSettings = Pick<UserSettings, 'preferredSubtitles' | 'subtitleOffset'>;
type ProfileData = Omit<PersistedState, 'settings'> & SubtitleSettings;

const defaultProfile = { id: DEFAULT_PROFILE_ID, name: 'Default' };
let profileData = new Map<string, ProfileData>();

function splitState({ settings, progress, history, favorites, watchlists, subtitleOffsets }: PersistedState) {
  const { preferredSubtitles, subtitleOffset, ...deviceSettings } = settings;
  return { deviceSettings, viewer: { progress, history, favorites, watchlists, subtitleOffsets, preferredSubtitles, subtitleOffset } };
}

function emptyState(): PersistedState {
  return { progress: {}, history: [], favorites: [], watchlists: [], subtitleOffsets: {}, settings: { ...DEFAULT_SETTINGS } };
}

function parseHousehold(raw: unknown) {
  let parsed: unknown;
  try { if (typeof raw === 'string') parsed = JSON.parse(raw); } catch { /* use defaults */ }
  if (isRecord(parsed) && parsed.version === 2 && Array.isArray(parsed.profiles)) {
    const profiles: HouseholdProfile[] = [];
    const data = new Map<string, ProfileData>();
    const { deviceSettings } = splitState({ ...emptyState(), ...parseStoredState(
      JSON.stringify({ settings: parsed.settings }),
    ) });
    for (const entry of parsed.profiles) {
      if (!isRecord(entry) || typeof entry.id !== 'string' || !entry.id || data.has(entry.id)
        || typeof entry.name !== 'string' || !entry.name.trim()) continue;
      profiles.push({ id: entry.id, name: entry.name });
      data.set(entry.id, splitState({ ...emptyState(), ...parseStoredState(JSON.stringify(entry.data)) }).viewer);
    }
    const primary = data.get(DEFAULT_PROFILE_ID);
    if (primary) {
      const { preferredSubtitles, subtitleOffset, ...records } = primary;
      return { data, state: { ...records, settings: { ...deviceSettings, preferredSubtitles, subtitleOffset }, profiles, activeProfileId: DEFAULT_PROFILE_ID } };
    }
  }
  const state = { ...emptyState(), ...parseStoredState(raw) };
  return {
    data: new Map([[DEFAULT_PROFILE_ID, splitState(state).viewer]]),
    state: { ...state, profiles: [defaultProfile], activeProfileId: DEFAULT_PROFILE_ID },
  };
}

/** Install and hydrate an asynchronous adapter before mounting the application. */
export async function setStorageAdapter(adapter: StorageAdapter): Promise<void> {
  currentAdapter = adapter;
  try {
    await pendingWrite;
    const raw = await adapter.getItem(STORAGE_KEY) ?? await adapter.getItem(LEGACY_STORAGE_KEY);
    if (adapter === currentAdapter) {
      const household = parseHousehold(raw);
      profileData = household.data;
      theiaStore.setState(household.state);
    }
  } catch (err) {
    console.error('Failed to load stored state:', err);
  }
}

function readLocalState() {
  try {
    const raw = currentAdapter.getItem(STORAGE_KEY);
    if (raw instanceof Promise) {
      void raw.catch(() => {});
      return undefined;
    }
    return raw ?? currentAdapter.getItem(LEGACY_STORAGE_KEY);
  } catch {
    return undefined;
  }
}

export function loadStoredState(): Partial<PersistedState> {
  const raw = readLocalState();
  if (raw === undefined || raw instanceof Promise) return {};
  const { profiles, activeProfileId, ...state } = parseHousehold(raw).state;
  return state;
}

let pendingWrite: Promise<void> | null = null;

function persistHousehold(state: PersistedState, profiles: HouseholdProfile[]) {
  try {
    const adapter = currentAdapter;
    const { deviceSettings } = splitState(state);
    const serialized = JSON.stringify({
      version: 2,
      settings: deviceSettings,
      profiles: profiles.map((profile) => {
        const { preferredSubtitles, subtitleOffset, ...records } = profileData.get(profile.id)!;
        return { ...profile, data: { ...records, settings: { preferredSubtitles, subtitleOffset } } };
      }),
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

export function saveState(state: PersistedState) {
  const { activeProfileId, profiles } = theiaStore.getState();
  profileData.set(activeProfileId, splitState(state).viewer);
  persistHousehold(state, profiles);
}

export function getProfileState(profileId: string): PersistedState | undefined {
  const state = theiaStore.getState();
  if (profileId === state.activeProfileId) return state;
  const viewer = profileData.get(profileId);
  if (!viewer) return undefined;
  const { preferredSubtitles, subtitleOffset, ...records } = viewer;
  return { ...records, settings: { ...state.settings, preferredSubtitles, subtitleOffset } };
}

function updateProfileState(profileId: string, update: (state: PersistedState) => Partial<PersistedState>) {
  const viewer = getProfileState(profileId);
  if (!viewer) return;
  const changes = update(viewer);
  const next = { ...viewer, ...changes };
  const state = theiaStore.getState();
  if (profileId === state.activeProfileId) {
    saveState(next);
    theiaStore.setState(changes);
  } else {
    profileData.set(profileId, splitState(next).viewer);
    persistHousehold(state, state.profiles);
  }
}

export function selectProfile(profileId: string) {
  const state = theiaStore.getState();
  if (profileId === state.activeProfileId) return;
  const viewer = getProfileState(profileId);
  if (!viewer) return;
  profileData.set(state.activeProfileId, splitState(state).viewer);
  theiaStore.setState({ ...viewer, activeProfileId: profileId });
}

function saveProfiles(profiles: HouseholdProfile[]) {
  const state = theiaStore.getState();
  profileData.set(state.activeProfileId, splitState(state).viewer);
  persistHousehold(state, profiles);
  theiaStore.setState({ profiles });
}

export function addProfile(name: string): void {
  name = name.trim().slice(0, PROFILE_NAME_LIMIT);
  if (!name) return;
  const { profiles } = theiaStore.getState();
  const id = `viewer-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  profileData.set(id, splitState(emptyState()).viewer);
  saveProfiles([...profiles, { id, name }]);
}

export function renameProfile(profileId: string, name: string): void {
  name = name.trim().slice(0, PROFILE_NAME_LIMIT);
  if (!name) return;
  saveProfiles(theiaStore.getState().profiles.map((profile) =>
    profile.id === profileId ? { ...profile, name } : profile));
}

export function deleteProfile(profileId: string): void {
  const { profiles, activeProfileId } = theiaStore.getState();
  if (profileId === DEFAULT_PROFILE_ID || profileId === activeProfileId || !profileData.delete(profileId)) return;
  saveProfiles(profiles.filter(({ id }) => id !== profileId));
}

// Web hydrates before React mounts. Android supplies its adapter at startup.
const initial = parseHousehold(readLocalState());
profileData = initial.data;

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
  ...initial.state,

  updateProgress: (progress, media, profileId = get().activeProfileId) => {
    if (!isProgress(progress) || progress.durationSeconds <= 0) return;
    const positionSeconds = Math.min(progress.positionSeconds, progress.durationSeconds);
    progress = { ...progress, positionSeconds, percentage: positionSeconds / progress.durationSeconds * 100 };
    updateProfileState(profileId, (state) => {
      const key = progress.episodeId || progress.mediaId;
      const updatedProgress = { ...state.progress, [key]: progress };
      const history = [...state.history];
      const existingIdx = history.findIndex((item) =>
        progress.episodeId
          ? item.progress.episodeId === progress.episodeId
          : item.media.id === progress.mediaId && !item.progress.episodeId
      );
      const mediaToStore = media || history[existingIdx]?.media;
      if (mediaToStore) {
        if (existingIdx >= 0) history.splice(existingIdx, 1);
        history.unshift({ media: mediaToStore, progress, lastWatchedAt: Date.now() });
      }
      return { progress: updatedProgress, history };
    });
  },

  getProgress: (mediaId, episodeId, profileId = get().activeProfileId) => {
    const state = getProfileState(profileId);
    if (!state) return undefined;
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

export function mergeWatchBackup(
  backup: WatchRecords,
  profileId = theiaStore.getState().activeProfileId,
  removedFavorites?: ReadonlySet<string>,
): void {
  updateProfileState(profileId, (state) => {
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
    const favorites = new Map([...backup.favorites, ...state.favorites.filter((media) => !removedFavorites?.has(media.id))]
      .map((media) => [media.id, media]));
    const records = {
      progress: Object.fromEntries(progress),
      history: [...history.values()].sort((a, b) => b.lastWatchedAt - a.lastWatchedAt),
      favorites: [...favorites.values()],
      watchlists: backup.watchlists?.length ? mergeWatchlists(state.watchlists, backup.watchlists) : state.watchlists,
    };
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

export function removeSyncedHistory(
  key: string,
  remoteTimestamp: number,
  profileId = theiaStore.getState().activeProfileId,
): void {
  updateProfileState(profileId, state => {
    if ((state.progress[key]?.updatedAt ?? 0) > remoteTimestamp) return {};
    const progress = { ...state.progress };
    delete progress[key];
    return { progress, history: state.history.filter(entry => (entry.progress.episodeId || entry.media.id) !== key) };
  });
}

export * from './trakt';

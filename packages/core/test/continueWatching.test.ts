import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { CONTINUE_WATCHING_MAX_AGE_MS, DefaultStorageAdapter, getContinueWatching, setStorageAdapter, theiaStore } from '../src/storage';
import type { MediaItem, WatchHistoryItem } from '../src/types';
beforeEach(() => {
  vi.spyOn(Date, 'now').mockReturnValue(100);
  theiaStore.setState({ history: [], progress: {}, favorites: [] });
});
afterEach(() => vi.restoreAllMocks());
const media: MediaItem = { id: 'show', title: 'Show', type: 'series', episodes: [
  { id: 'one', title: 'First', season: 1, episode: 1 },
  { id: 'two', title: 'Second', season: 2, episode: 1 },
] };
const item = (episodeId: string, lastWatchedAt: number, completed = false): WatchHistoryItem => ({ media, lastWatchedAt,
  progress: { mediaId: media.id, episodeId, positionSeconds: 50, durationSeconds: 100, percentage: 50, completed, updatedAt: lastWatchedAt } });
it('keeps one entry per series using latest activity even when input is unsorted', () => {
  expect(getContinueWatching([item('one', 1), item('two', 2)]).map(x => x.progress.episodeId)).toEqual(['two']);
});
it.each([2, 30])('includes positive saved positions at or below 1%% (%s seconds)', (positionSeconds) => {
  const entry = item('one', 1);
  entry.progress = { ...entry.progress, positionSeconds, durationSeconds: 3000, percentage: positionSeconds / 3000 * 100 };
  expect(getContinueWatching([entry])).toEqual([entry]);
});
it('keeps the show visible when the latest episode has only just started', () => {
  const earlier = item('one', 1);
  earlier.progress = { ...earlier.progress, positionSeconds: 1200, durationSeconds: 3000, percentage: 40 };
  const latest = item('two', 2);
  latest.progress = { ...latest.progress, positionSeconds: 2, durationSeconds: 3000, percentage: 2 / 3000 * 100 };
  expect(getContinueWatching([earlier, latest])).toEqual([latest]);
});
it('excludes zero saved positions even if the stored percentage is positive', () => {
  const entry = item('one', 1);
  entry.progress.positionSeconds = 0;
  expect(getContinueWatching([entry])).toEqual([]);
});
it('offers the next season after completion and never resurrects earlier episodes at the finale', () => {
  expect(getContinueWatching([item('one', 2, true)])[0].nextEpisode?.id).toBe('two');
  expect(getContinueWatching([item('two', 3, true), item('one', 1)])).toEqual([]);
});
it('excludes unreleased next episodes and completed movies', () => {
  const entry = item('one', 1, true);
  entry.media = { ...media, episodes: [media.episodes![0], { ...media.episodes![1], released: '2099-01-01' }] };
  expect(getContinueWatching([entry])).toEqual([]);
  expect(getContinueWatching([{ ...entry, media: { ...media, type: 'movie' } }])).toEqual([]);
});

it('expires only after 60 days without falling back to an older episode', () => {
  const now = CONTINUE_WATCHING_MAX_AGE_MS + 100;
  expect(getContinueWatching([item('one', 100)], now)).toHaveLength(1);
  expect(getContinueWatching([item('one', 99)], now)).toEqual([]);
  expect(getContinueWatching([item('two', 99), item('one', 98)], now)).toEqual([]);
});

it('removes one episode and its progress, keeps other history, and prevents fallback', () => {
  const store = theiaStore.getState();
  store.updateProgress(item('one', 1).progress, media);
  store.updateProgress(item('two', 2).progress, media);
  store.toggleFavorite(media);
  store.removeHistoryEntry(media.id, 'two');
  const state = theiaStore.getState();
  expect(state.history.map(h => h.progress.episodeId)).toEqual(['one']);
  expect(state.getProgress(media.id, 'two')).toBeUndefined();
  expect(state.getProgress(media.id, 'one')).toBeDefined();
  expect(getContinueWatching(state.history)).toEqual([]);
  expect(state.isFavorite(media.id)).toBe(true);
  state.updateProgress(item('one', 3).progress, media);
  expect(getContinueWatching(theiaStore.getState().history)).toHaveLength(1);
});

it('retains more than 50 history entries across saving and hydration, including dismissals', async () => {
  const adapter = new DefaultStorageAdapter();
  await setStorageAdapter(adapter);
  theiaStore.setState({ history: [], progress: {}, favorites: [] });
  for (let i = 0; i < 65; i++) {
    theiaStore.getState().updateProgress({ ...item('one', 1).progress, episodeId: `ep${i}` }, media);
  }
  theiaStore.getState().removeHistoryEntry(media.id, 'ep64');
  await setStorageAdapter(adapter);
  expect(theiaStore.getState().history).toHaveLength(64);
  expect(theiaStore.getState().progress.ep64).toBeUndefined();
  expect(getContinueWatching(theiaStore.getState().history)).toEqual([]);
});

it('applies dismissal and expiry to titles with newly started playback', () => {
  const entry = item('one', 100);
  entry.progress = { ...entry.progress, positionSeconds: 2, durationSeconds: 3000, percentage: 2 / 3000 * 100 };
  const now = CONTINUE_WATCHING_MAX_AGE_MS + 100;
  expect(getContinueWatching([entry], now)).toEqual([entry]);
  expect(getContinueWatching([{ ...entry, dismissedFromContinueWatching: true }], now)).toEqual([]);
  expect(getContinueWatching([entry], now + 1)).toEqual([]);
});

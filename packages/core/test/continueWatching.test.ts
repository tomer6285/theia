import { expect, it } from 'vitest';
import { getContinueWatching } from '../src/storage';
import type { MediaItem, WatchHistoryItem } from '../src/types';
const media: MediaItem = { id: 'show', title: 'Show', type: 'series', episodes: [
  { id: 'one', title: 'First', season: 1, episode: 1 },
  { id: 'two', title: 'Second', season: 2, episode: 1 },
] };
const item = (episodeId: string, lastWatchedAt: number, completed = false): WatchHistoryItem => ({ media, lastWatchedAt,
  progress: { mediaId: media.id, episodeId, positionSeconds: 50, durationSeconds: 100, percentage: 50, completed, updatedAt: lastWatchedAt } });
it('keeps one entry per series using latest activity even when input is unsorted', () => {
  expect(getContinueWatching([item('one', 1), item('two', 2)]).map(x => x.progress.episodeId)).toEqual(['two']);
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

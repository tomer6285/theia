import { beforeEach, expect, it } from 'vitest';
import {
  DefaultStorageAdapter, exportWatchBackup, importWatchBackup, readWatchBackup,
  setStorageAdapter, theiaStore, watchlistItemKey,
} from '../src/storage';
import type { MediaItem } from '../src/types';

const movie: MediaItem = { id: 'one', title: 'Movie', type: 'movie' };
const series: MediaItem = { id: 'one', title: 'Series', type: 'series' };
const second: MediaItem = { id: 'two', title: 'Second movie', type: 'movie' };
let storage: DefaultStorageAdapter;

beforeEach(async () => {
  storage = new DefaultStorageAdapter();
  await setStorageAdapter(storage);
});

it('persists title order and atomic moves through unrelated writes and hydration', async () => {
  const state = theiaStore.getState();
  expect(state.createWatchlist('   ')).toBeUndefined();
  const weekend = state.createWatchlist(' Weekend ', movie)!;
  const friends = state.createWatchlist('With friends', second)!;
  state.addToWatchlist(weekend, series);
  state.addToWatchlist(weekend, second);
  state.addToWatchlist(weekend, movie);
  state.reorderWatchlist(weekend, watchlistItemKey(series), watchlistItemKey(movie));
  state.moveBetweenWatchlists(weekend, 'missing', watchlistItemKey(movie));
  state.moveBetweenWatchlists(weekend, friends, watchlistItemKey(second));
  state.moveBetweenWatchlists(weekend, friends, watchlistItemKey(movie));
  state.addToWatchlist(weekend, movie);
  state.renameWatchlist(friends, 'Watch with friends');
  state.toggleFavorite(movie);
  state.updateSettings({ autoResume: false });
  state.clearHistory();

  await setStorageAdapter(storage);
  expect(theiaStore.getState().watchlists).toEqual([
    { id: weekend, name: 'Weekend', items: [series, movie] },
    { id: friends, name: 'Watch with friends', items: [second, movie] },
  ]);
  expect(theiaStore.getState().favorites).toEqual([movie]);

  state.removeFromWatchlist(weekend, watchlistItemKey(movie));
  state.deleteWatchlist(friends);
  await setStorageAdapter(storage);
  expect(theiaStore.getState().watchlists).toEqual([{ id: weekend, name: 'Weekend', items: [series] }]);
});

it('keeps divergent orders as separate lists and makes repeated imports idempotent', () => {
  const state = theiaStore.getState();
  const id = state.createWatchlist('Weekend', movie)!;
  state.addToWatchlist(id, series);
  const raw = exportWatchBackup();
  state.reorderWatchlist(id, watchlistItemKey(series), watchlistItemKey(movie));

  importWatchBackup(readWatchBackup(raw));
  importWatchBackup(readWatchBackup(raw));
  expect(theiaStore.getState().watchlists.map(list => list.items)).toEqual([[series, movie], [movie, series]]);
});

it('accepts older backups and rejects invalid custom list data', () => {
  const old = { format: 'theia-watch-backup', version: 1, progress: {}, history: [], favorites: [movie] };
  const id = theiaStore.getState().createWatchlist('Weekend')!;
  importWatchBackup(readWatchBackup(JSON.stringify(old)));
  expect(theiaStore.getState().favorites).toEqual([movie]);
  expect(theiaStore.getState().watchlists).toEqual([{ id, name: 'Weekend', items: [] }]);
  expect(() => readWatchBackup(JSON.stringify({
    ...old, version: 2, watchlists: [{ id, name: 'Weekend', items: [movie, movie] }],
  }))).toThrow();
});

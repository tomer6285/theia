// @vitest-environment jsdom
import React from 'react';
import { afterEach, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { CONTINUE_WATCHING_MAX_AGE_MS, getContinueWatching, theiaStore } from '@theia/core';
import { LibraryView } from '../src/components/LibraryView';
import { ContinueWatchingView } from '../src/components/ContinueWatchingView';

afterEach(() => { cleanup(); vi.useRealTimers(); });

it('shows active and old entries in History and removes individual entries', () => {
  const media = { id: 'movie', title: 'Example Movie', type: 'movie' as const };
  const old = { id: 'old', title: 'Old Movie', type: 'movie' as const };
  theiaStore.setState({ history: [], progress: {}, favorites: [] });
  const progress = { mediaId: media.id, positionSeconds: 50, durationSeconds: 100,
    percentage: 50, completed: false, updatedAt: Date.now() };
  theiaStore.getState().updateProgress(progress, media);
  theiaStore.getState().updateProgress({ ...progress, mediaId: old.id }, old);
  theiaStore.setState(state => ({ history: state.history.map(h => h.media.id === old.id
    ? { ...h, lastWatchedAt: Date.now() - CONTINUE_WATCHING_MAX_AGE_MS - 1 } : h) }));
  render(<LibraryView onSelectMedia={vi.fn()} />);
  fireEvent.click(screen.getByText('History', { exact: true }));
  expect(screen.getByRole('button', { name: 'Remove Example Movie from History' })).toBeTruthy();
  expect(screen.getByRole('button', { name: 'Remove Old Movie from History' })).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: 'Remove Example Movie from History' }));
  expect(theiaStore.getState().history.map(h => h.media.id)).toEqual(['old']);
  expect(theiaStore.getState().getProgress(media.id)).toBeUndefined();
  expect(getContinueWatching(theiaStore.getState().history)).toEqual([]);
});

it('expires an entry while Continue Watching is open without deleting history', () => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-11-11T00:00:00Z'));
  const media = { id: 'movie', title: 'Example Movie', type: 'movie' as const };
  const progress = { mediaId: media.id, positionSeconds: 50, durationSeconds: 100,
    percentage: 50, completed: false, updatedAt: Date.now() };
  theiaStore.setState({ history: [{ media, progress,
    lastWatchedAt: Date.now() - CONTINUE_WATCHING_MAX_AGE_MS + 1000 }], progress: { movie: progress } });
  render(<ContinueWatchingView onSelectMedia={vi.fn()} />);
  expect(screen.getByRole('button', { name: 'Resume Example Movie' })).toBeTruthy();
  act(() => { vi.advanceTimersByTime(1001); });
  expect(screen.queryByRole('button', { name: 'Resume Example Movie' })).toBeNull();
  expect(theiaStore.getState().history).toHaveLength(1);
});

it('groups shows, opens details, resumes the latest episode and removes episodes independently', () => {
  const show = { id: 'show', title: 'Example Show', type: 'series' as const,
    episodes: [
      { id: 'e1', title: 'Pilot', season: 1, episode: 1 },
      { id: 'e2', title: 'Return', season: 2, episode: 1 },
    ] };
  const movie = { id: 'movie', title: 'Example Movie', type: 'movie' as const };
  const progress = { mediaId: show.id, positionSeconds: 50, durationSeconds: 100,
    percentage: 50, completed: false, updatedAt: 100 };
  const first = { ...progress, episodeId: 'e1' };
  const latest = { ...progress, episodeId: 'e2' };
  // Deliberately unsorted: grouping must use timestamps rather than array order.
  theiaStore.setState({ favorites: [], history: [
    { media: show, progress: first, lastWatchedAt: 100 },
    { media: movie, progress: { ...progress, mediaId: movie.id }, lastWatchedAt: 200 },
    { media: show, progress: latest, lastWatchedAt: 300 },
  ], progress: { e1: first, e2: latest } });
  const onSelectMedia = vi.fn();
  render(<LibraryView onSelectMedia={onSelectMedia} />);
  fireEvent.click(screen.getByText('History', { exact: true }));
  expect(screen.getAllByRole('button', { name: 'View Example Show' })).toHaveLength(1);
  expect(screen.getAllByRole('button', { name: /^View / }).map(el => el.getAttribute('aria-label')))
    .toEqual(['View Example Show', 'View Example Movie']);
  expect(screen.getByText('Last watched: S2 E1 · Return')).toBeTruthy();
  expect(screen.getByText('2 episodes watched')).toBeTruthy();
  expect(screen.getByRole('button', { name: 'History 2' })).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: 'View Example Show' }));
  expect(onSelectMedia).toHaveBeenLastCalledWith(show, undefined);
  fireEvent.click(screen.getAllByRole('button', { name: 'Resume video' })[0]);
  expect(onSelectMedia).toHaveBeenLastCalledWith(show, 'e2');
  expect(screen.queryByRole('button', { name: 'S1 E1 · Pilot' })).toBeNull();
  const toggle = screen.getByRole('button', { name: 'Episode history for Example Show' });
  fireEvent.click(toggle);
  expect(toggle.getAttribute('aria-expanded')).toBe('true');
  expect(screen.getByRole('region', { name: 'Season 1' })).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: 'S1 E1 · Pilot' }));
  expect(onSelectMedia).toHaveBeenLastCalledWith(show, 'e1');
  fireEvent.click(screen.getByRole('button', { name: 'Remove Example Show S2 E1 · Return from History' }));
  expect(screen.getByText('Last watched: S1 E1 · Pilot')).toBeTruthy();
  expect(theiaStore.getState().getProgress(show.id, 'e1')).toEqual(first);
  expect(theiaStore.getState().getProgress(show.id, 'e2')).toBeUndefined();
  fireEvent.click(screen.getByRole('button', { name: 'Remove Example Show show from History' }));
  expect(screen.queryByRole('button', { name: 'View Example Show' })).toBeNull();
  expect(theiaStore.getState().history.map(entry => entry.media.id)).toEqual(['movie']);
  expect(theiaStore.getState().getProgress(show.id, 'e1')).toBeUndefined();
});

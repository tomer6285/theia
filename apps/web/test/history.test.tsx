// @vitest-environment jsdom
import React from 'react';
import { afterEach, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { cinemeta, CONTINUE_WATCHING_MAX_AGE_MS, getContinueWatching, theiaStore } from '@theia/core';
import { LibraryView } from '../src/components/LibraryView';
import { ContinueWatchingView } from '../src/components/ContinueWatchingView';

afterEach(() => { cleanup(); vi.useRealTimers(); vi.restoreAllMocks(); });

it('shares and caches artwork for imported history across both screens', async () => {
  const media = { id: 'tt1234567', title: 'Imported Show', type: 'series' as const };
  const progress = { mediaId: media.id, episodeId: 'tt1234567:1:1', season: 1, episode: 1,
    positionSeconds: 0, durationSeconds: 0, percentage: 25, completed: false, updatedAt: Date.now(),
    resumeByPercentage: true };
  const history = [{ media, progress, lastWatchedAt: progress.updatedAt }];
  theiaStore.setState({ history, progress: { [progress.episodeId]: progress }, favorites: [] });
  const poster = 'https://example.com/poster.jpg';
  const getDetails = vi.spyOn(cinemeta, 'getDetails').mockResolvedValue({ ...media, poster });
  const onSelectMedia = vi.fn();
  const first = render(<ContinueWatchingView onSelectMedia={onSelectMedia} />);
  expect(screen.getByRole('button', { name: 'View Imported Show' }).querySelector('img')).toBeNull();
  const second = render(<LibraryView onSelectMedia={onSelectMedia} />);
  fireEvent.click(screen.getByText('History', { exact: true }));

  const expectPosters = (count: number) => {
    expect(screen.getAllByRole('button', { name: 'View Imported Show' })
      .map(card => card.querySelector('img')?.getAttribute('src'))).toEqual(Array(count).fill(poster));
  };
  await waitFor(() => expectPosters(2));
  first.unmount();
  second.unmount();
  render(<ContinueWatchingView onSelectMedia={onSelectMedia} />);
  await waitFor(() => expectPosters(1));
  expect(getDetails).toHaveBeenCalledExactlyOnceWith(media.id, 'series');
  expect(theiaStore.getState().history).toBe(history);
  fireEvent.click(screen.getByRole('button', { name: 'Resume Imported Show S1 E1' }));
  expect(onSelectMedia).toHaveBeenCalledWith(media, progress.episodeId);
});

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
  expect(screen.getByRole('button', { name: 'Options for Old Movie' })).toBeTruthy();
  const options = screen.getByRole('button', { name: 'Options for Example Movie' });
  const requestRemoval = () => {
    fireEvent.click(options);
    fireEvent.click(screen.getByRole('button', { name: 'Remove Example Movie from History' }));
  };
  expect(screen.queryByRole('button', { name: 'Remove Example Movie from History' })).toBeNull();
  requestRemoval();
  const dialog = screen.getByRole('alertdialog', { name: 'Remove movie from history?' });
  const cancel = within(dialog).getByRole('button', { name: 'Cancel' });
  expect(document.activeElement).toBe(cancel);
  fireEvent.click(cancel);
  expect(screen.queryByRole('alertdialog')).toBeNull();
  expect(document.activeElement).toBe(options);
  expect(theiaStore.getState().history).toHaveLength(2);
  requestRemoval();
  fireEvent.keyDown(document.activeElement!, { key: 'Escape' });
  expect(screen.queryByRole('alertdialog')).toBeNull();
  expect(theiaStore.getState().history).toHaveLength(2);
  requestRemoval();
  fireEvent.click(within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Remove movie' }));
  expect(theiaStore.getState().history.map(h => h.media.id)).toEqual(['old']);
  expect(theiaStore.getState().getProgress(media.id)).toBeUndefined();
  expect(getContinueWatching(theiaStore.getState().history)).toEqual([]);
  fireEvent.click(screen.getByRole('button', { name: 'History options' }));
  fireEvent.click(screen.getByRole('button', { name: 'Clear history', exact: true }));
  const clearDialog = screen.getByRole('alertdialog', { name: 'Clear history?' });
  expect(theiaStore.getState().history).toHaveLength(1);
  fireEvent.click(within(clearDialog).getByRole('button', { name: 'Clear history' }));
  expect(screen.getByText('No watch history yet')).toBeTruthy();
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
  expect(screen.getByText('S2 E1 · Return · 2 episodes watched')).toBeTruthy();
  expect(screen.getByText('2 titles')).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: 'View Example Show' }));
  expect(onSelectMedia).toHaveBeenLastCalledWith(show, undefined);
  fireEvent.click(screen.getByRole('button', { name: 'Resume Example Show' }));
  expect(onSelectMedia).toHaveBeenLastCalledWith(show, 'e2');
  expect(screen.queryByRole('button', { name: 'S1 E1 · Pilot' })).toBeNull();
  const toggle = screen.getByRole('button', { name: 'Episode history for Example Show' });
  fireEvent.click(toggle);
  expect(toggle.getAttribute('aria-expanded')).toBe('true');
  expect(screen.getByRole('region', { name: 'Season 1' })).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: 'S1 E1 · Pilot' }));
  expect(onSelectMedia).toHaveBeenLastCalledWith(show, 'e1');
  fireEvent.click(screen.getByRole('button', { name: 'Remove Example Show S2 E1 · Return from History' }));
  const episodeDialog = screen.getByRole('alertdialog', { name: 'Remove episode from history?' });
  expect(within(episodeDialog).getByText('Example Show · S2 E1 · Return')).toBeTruthy();
  expect(theiaStore.getState().getProgress(show.id, 'e2')).toEqual(latest);
  fireEvent.click(within(episodeDialog).getByRole('button', { name: 'Remove episode' }));
  expect(screen.getByText('S1 E1 · Pilot · 1 episode watched')).toBeTruthy();
  expect(theiaStore.getState().getProgress(show.id, 'e1')).toEqual(first);
  expect(theiaStore.getState().getProgress(show.id, 'e2')).toBeUndefined();
  fireEvent.click(screen.getByRole('button', { name: 'Options for Example Show' }));
  fireEvent.click(screen.getByRole('button', { name: 'Remove Example Show show from History' }));
  const showDialog = screen.getByRole('alertdialog', { name: 'Remove show from history?' });
  expect(theiaStore.getState().getProgress(show.id, 'e1')).toEqual(first);
  fireEvent.click(within(showDialog).getByRole('button', { name: 'Remove show' }));
  expect(screen.queryByRole('button', { name: 'View Example Show' })).toBeNull();
  expect(theiaStore.getState().history.map(entry => entry.media.id)).toEqual(['movie']);
  expect(theiaStore.getState().getProgress(show.id, 'e1')).toBeUndefined();
});

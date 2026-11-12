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

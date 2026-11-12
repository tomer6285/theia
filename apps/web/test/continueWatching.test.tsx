// @vitest-environment jsdom
import React from 'react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { theiaStore } from '@theia/core';
import type { MediaItem } from '@theia/core';
import { ContinueWatchingView } from '../src/components/ContinueWatchingView';

const media: MediaItem = {
  id: 'show', title: 'Example Show', type: 'series', year: '2024', rating: 8,
  genres: ['Drama'], episodes: [{ id: 'ep1', season: 1, episode: 1, title: 'Pilot' },
    { id: 'ep2', season: 1, episode: 2, title: 'Next episode' }],
};
const progress = { mediaId: media.id, episodeId: 'ep1', season: 1, episode: 1,
  positionSeconds: 90, durationSeconds: 6000, percentage: 1.5, completed: false, updatedAt: Date.now() };
beforeEach(() => {
  theiaStore.setState({ history: [], progress: {}, favorites: [] });
  theiaStore.getState().updateProgress(progress, media);
});
afterEach(cleanup);

it('shows early progress and resumes the saved episode, with discovery metadata removed', () => {
  const play = vi.fn();
  render(<ContinueWatchingView onSelectMedia={vi.fn()} onQuickPlay={play} />);
  expect(screen.getByRole('progressbar').getAttribute('aria-valuenow')).toBe('2');
  expect(screen.getByText('Pilot')).toBeTruthy();
  expect(screen.queryByText('2024')).toBeNull();
  expect(screen.queryByText('Drama')).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: 'Resume Example Show S1 E1' }));
  expect(play).toHaveBeenCalledWith(media, 'ep1');
});

it('keeps saved progress and history when dismissed, and returns after watching again', () => {
  render(<ContinueWatchingView onSelectMedia={vi.fn()} />);
  fireEvent.click(screen.getByText('More options'));
  fireEvent.click(screen.getByRole('button', { name: 'Add to favorites' }));
  expect(theiaStore.getState().isFavorite(media.id)).toBe(true);
  fireEvent.click(screen.getByRole('button', { name: 'Remove from Continue Watching' }));
  expect(screen.getByText('No unwatched titles in progress')).toBeTruthy();
  expect(theiaStore.getState().history).toHaveLength(1);
  expect(theiaStore.getState().getProgress(media.id, 'ep1')?.positionSeconds).toBe(90);
  cleanup();
  theiaStore.getState().updateProgress({ ...progress, positionSeconds: 120 }, media);
  render(<ContinueWatchingView onSelectMedia={vi.fn()} />);
  expect(screen.getByRole('button', { name: 'Resume Example Show S1 E1' })).toBeTruthy();
});

it('offers the next episode with zero progress after completion', () => {
  theiaStore.getState().updateProgress({ ...progress, positionSeconds: 6000, completed: true }, media);
  const play = vi.fn();
  render(<ContinueWatchingView onSelectMedia={vi.fn()} onQuickPlay={play} />);
  expect(screen.getByRole('progressbar').getAttribute('aria-valuenow')).toBe('0');
  fireEvent.click(screen.getByRole('button', { name: 'Play Example Show S1 E2' }));
  expect(play).toHaveBeenCalledWith(media, 'ep2');
});

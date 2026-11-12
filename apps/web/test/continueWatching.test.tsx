// @vitest-environment jsdom
import React from 'react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
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
  fireEvent.contextMenu(screen.getByRole('button', { name: 'View Example Show' }));
  fireEvent.click(screen.getByRole('menuitem', { name: 'Add to favorites' }));
  expect(theiaStore.getState().isFavorite(media.id)).toBe(true);
  fireEvent.contextMenu(screen.getByRole('button', { name: 'View Example Show' }));
  fireEvent.click(screen.getByRole('menuitem', { name: 'Remove from Continue Watching' }));
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

it('opens from the keyboard and restores focus on Escape', () => {
  render(<ContinueWatchingView onSelectMedia={vi.fn()} />);
  const card = screen.getByRole('button', { name: 'View Example Show' });
  fireEvent.keyDown(card, { key: 'F10', shiftKey: true });
  expect(screen.getByRole('menu')).toBeTruthy();
  fireEvent.keyDown(screen.getByRole('menuitem', { name: 'Add to favorites' }), { key: 'Escape' });
  expect(screen.queryByRole('menu')).toBeNull();
  expect(document.activeElement).toBe(card);
});

it('opens on touch hold without selecting the title, and cancels a scrolling gesture', () => {
  vi.useFakeTimers();
  const select = vi.fn();
  try {
    render(<ContinueWatchingView onSelectMedia={select} />);
    const card = screen.getByRole('button', { name: 'View Example Show' });
    const pointer = (type: string, x: number) => {
      const event = new Event(type, { bubbles: true });
      Object.assign(event, { pointerType: 'touch', clientX: x, clientY: 50 });
      fireEvent(card, event);
    };
    pointer('pointerdown', 50);
    pointer('pointermove', 80);
    act(() => vi.advanceTimersByTime(600));
    expect(screen.queryByRole('menu')).toBeNull();
    pointer('pointerdown', 50);
    act(() => vi.advanceTimersByTime(500));
    expect(screen.getByRole('menu')).toBeTruthy();
    pointer('pointerup', 50);
    fireEvent.click(card);
    expect(select).not.toHaveBeenCalled();
  } finally { vi.useRealTimers(); }
});

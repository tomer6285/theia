// @vitest-environment jsdom
import React from 'react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { providerManager, theiaStore } from '@theia/core';
import type { MediaItem, StreamSource } from '@theia/core';
import { MediaDetailModal } from '../src/components/MediaDetailModal';
const media: MediaItem = { id: 'tt1', tmdbId: '1', title: 'Movie', type: 'movie' };
const embed: StreamSource = { id: 'embed', provider: 'vidora', name: 'Embed', quality: 'auto', format: 'embed', url: 'https://vidora.su/movie/1' };
const direct: StreamSource = { ...embed, id: 'direct', name: 'Direct', format: 'mp4', url: 'https://cdn.example/movie.mp4' };
beforeEach(() => {
  theiaStore.setState({ history: [], progress: {} });
  theiaStore.getState().updateProgress({ mediaId: media.id, positionSeconds: 45, durationSeconds: 100, percentage: 45, completed: false, updatedAt: Date.now() }, media);
  vi.spyOn(providerManager, 'resolveStreams').mockResolvedValue([embed, direct]);
});
afterEach(cleanup);
it('one-tap resume resolves fresh streams, prefers direct playback, and passes the saved timestamp', async () => {
  const play = vi.fn();
  render(<MediaDetailModal media={media} isOpen onClose={vi.fn()} onPlay={play} resumeImmediately />);
  await waitFor(() => expect(play).toHaveBeenCalledWith(media, direct, [embed, direct], undefined, 45));
  expect(providerManager.resolveStreams).toHaveBeenCalledWith(expect.objectContaining({ imdbId: 'tt1' }));
});
it('offers Start over without deleting history until playback actually starts', async () => {
  const play = vi.fn();
  render(<MediaDetailModal media={media} isOpen onClose={vi.fn()} onPlay={play} />);
  fireEvent.click(await screen.findByRole('button', { name: 'Start over' }));
  expect(play).toHaveBeenCalledWith(media, direct, [embed, direct], undefined, 0);
  expect(theiaStore.getState().getProgress(media.id)?.positionSeconds).toBe(45);
});
it('shows a recoverable empty state when resume cannot find streams', async () => {
  vi.mocked(providerManager.resolveStreams).mockResolvedValue([]);
  const play = vi.fn();
  render(<MediaDetailModal media={media} isOpen onClose={vi.fn()} onPlay={play} resumeImmediately />);
  await screen.findByText('No Streams Found');
  expect(play).not.toHaveBeenCalled();
});

it('skips the details sheet while quick resume is resolving', async () => {
  let resolve!: (streams: StreamSource[]) => void;
  vi.mocked(providerManager.resolveStreams).mockImplementation(() => new Promise(done => { resolve = done; }));
  const play = vi.fn();
  render(<MediaDetailModal media={media} isOpen onClose={vi.fn()} onPlay={play} resumeImmediately />);
  expect(screen.getByRole('status').textContent).toBe('Resuming Movie…');
  expect(screen.queryByRole('button', { name: /Watch Now|Resume/ })).toBeNull();
  expect(screen.queryByText('Source')).toBeNull();
  resolve([embed, direct]);
  await waitFor(() => expect(play).toHaveBeenCalledWith(media, direct, [embed, direct], undefined, 45));
});

it('cancels quick resume and aborts stream resolution', () => {
  let signal: AbortSignal | undefined;
  vi.mocked(providerManager.resolveStreams).mockImplementation(query => {
    signal = query.signal;
    return new Promise(() => {});
  });
  const close = vi.fn();
  const { unmount } = render(<MediaDetailModal media={media} isOpen onClose={close} onPlay={vi.fn()} resumeImmediately />);
  fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
  expect(close).toHaveBeenCalledOnce();
  unmount();
  expect(signal?.aborted).toBe(true);
});

// @vitest-environment jsdom
import React from 'react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { providerManager } from '@theia/core';
import { App } from '../src/App';
import type { MediaItem, StreamSource } from '@theia/core';
const { series, stream } = vi.hoisted(() => ({
  series: { id: 'tt1', type: 'series', title: 'Show', episodes: [
    { id: 'tt1:1:1', title: 'First', season: 1, episode: 1 },
    { id: 'tt1:1:2', title: 'Second', season: 1, episode: 2 },
  ] } as MediaItem,
  stream: { id: 'first', name: 'First server', url: 'https://cdn.example/first.mp4', provider: 'test', format: 'mp4', quality: 'auto' } as StreamSource,
}));
vi.mock('../src/components/HomeView', () => ({ HomeView: ({ onSelectMedia }: any) => <button onClick={() => onSelectMedia(series)}>Open show</button> }));
vi.mock('../src/components/MediaDetailModal', () => ({ MediaDetailModal: ({ onPlay }: any) => <button onClick={() => onPlay(series, stream, [stream], series.episodes![0])}>Start show</button> }));
vi.mock('@theia/player', () => ({ VideoPlayer: ({ stream, episode, onNextEpisode, onBack }: any) => <div>
  <p>{episode.title}: {stream.url}</p><button onClick={onNextEpisode}>Next episode</button><button onClick={onBack}>Back</button>
</div> }));
afterEach(cleanup);
beforeEach(() => { vi.spyOn(providerManager, 'resolveStreams').mockResolvedValue([{ ...stream, id: 'second', url: 'https://cdn.example/second.mp4' }]); });
it('resolves and plays the next episode with a fresh stream', async () => {
  render(<App />);
  fireEvent.click(screen.getByText('Open show'));
  fireEvent.click(screen.getByText('Start show'));
  fireEvent.click(await screen.findByRole('button', { name: 'Next episode' }));
  await screen.findByText('Second: https://cdn.example/second.mp4');
  expect(providerManager.resolveStreams).toHaveBeenCalledWith(expect.objectContaining({ imdbId: 'tt1', season: 1, episode: 2 }));
});
it('lets the user retry a missing next episode without replaying the old stream', async () => {
  vi.mocked(providerManager.resolveStreams).mockResolvedValueOnce([]);
  render(<App />);
  fireEvent.click(screen.getByText('Open show'));
  fireEvent.click(screen.getByText('Start show'));
  fireEvent.click(await screen.findByRole('button', { name: 'Next episode' }));
  expect(await screen.findByRole('alert')).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
  await screen.findByText('Second: https://cdn.example/second.mp4');
});
it('aborts a pending next episode when leaving playback', async () => {
  let signal: AbortSignal | undefined;
  vi.mocked(providerManager.resolveStreams).mockImplementation(async (query) => {
    signal = query.signal;
    return new Promise(() => {});
  });
  render(<App />);
  fireEvent.click(screen.getByText('Open show'));
  fireEvent.click(screen.getByText('Start show'));
  fireEvent.click(await screen.findByRole('button', { name: 'Next episode' }));
  fireEvent.click(screen.getByRole('button', { name: 'Back to browsing' }));
  await waitFor(() => expect(signal?.aborted).toBe(true));
  expect(screen.getByText('Open show')).toBeTruthy();
});

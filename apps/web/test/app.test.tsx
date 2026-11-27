// @vitest-environment jsdom
import React from 'react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { DEFAULT_PROFILE_ID, DefaultStorageAdapter, providerManager, setStorageAdapter, theiaStore } from '@theia/core';
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

it('opens straight to Home with one profile and asks who is watching on subsequent launches', async () => {
  const adapter = new DefaultStorageAdapter();
  await setStorageAdapter(adapter);
  const first = render(<App />);
  expect(screen.getByText('Open show')).toBeTruthy();

  fireEvent.click(screen.getByRole('button', { name: 'Settings' }));
  fireEvent.change(screen.getByLabelText('Profile name'), { target: { value: 'Sam' } });
  fireEvent.click(screen.getByRole('button', { name: 'Add profile' }));
  expect(screen.queryByRole('heading', { name: 'Who’s watching?' })).toBeNull();
  expect(theiaStore.getState().activeProfileId).toBe(DEFAULT_PROFILE_ID);
  first.unmount();

  await setStorageAdapter(adapter);
  const second = render(<App />);
  expect(screen.getByRole('heading', { name: 'Who’s watching?' })).toBeTruthy();
  expect(screen.queryByText('Open show')).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: 'Sam' }));
  expect(screen.getByText('Open show')).toBeTruthy();
  expect(theiaStore.getState().profiles[1].id).toBe(theiaStore.getState().activeProfileId);

  fireEvent.click(screen.getByRole('button', { name: 'Settings' }));
  fireEvent.click(screen.getByRole('button', { name: 'Switch to Default' }));
  fireEvent.click(screen.getByRole('button', { name: 'Settings' }));
  fireEvent.click(screen.getByRole('button', { name: 'Remove Sam' }));
  fireEvent.click(screen.getByRole('button', { name: 'Remove profile' }));
  second.unmount();

  await setStorageAdapter(adapter);
  render(<App />);
  expect(screen.getByText('Open show')).toBeTruthy();
  expect(screen.queryByRole('heading', { name: 'Who’s watching?' })).toBeNull();
}, 15_000);

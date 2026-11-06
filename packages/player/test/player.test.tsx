// @vitest-environment jsdom
import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, waitFor } from '@testing-library/react';
import { theiaStore } from '@theia/core';
import { VideoPlayerWeb } from '../src/VideoPlayer.web';
import type { MediaItem, StreamSource } from '@theia/core';
vi.mock('hls.js', () => ({ default: { isSupported: () => false } }));

const media: MediaItem = { id: 'tt1', title: 'Example', type: 'movie' };
const stream: StreamSource = { id: 'one', name: 'Server', provider: 'test', url: 'https://cdn.example/video.mp4', format: 'mp4', quality: 'auto' };
const setupVideo = (video: HTMLVideoElement, time = 0) => {
  Object.defineProperties(video, { duration: { configurable: true, value: 100 }, currentTime: { configurable: true, writable: true, value: time } });
  fireEvent.loadedMetadata(video);
};
beforeEach(() => {
  vi.spyOn(HTMLMediaElement.prototype, 'load').mockImplementation(() => {});
  vi.spyOn(HTMLMediaElement.prototype, 'play').mockResolvedValue();
  vi.spyOn(HTMLMediaElement.prototype, 'pause').mockImplementation(() => {});
  theiaStore.setState({ progress: {}, history: [] });
  theiaStore.getState().updateSettings({ autoResume: true, autoPlayNext: true, proxyUrl: '' });
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

describe('web playback', () => {
  it('applies saved resume time after metadata and saves the final time on exit', () => {
    theiaStore.getState().updateProgress({ mediaId: media.id, positionSeconds: 25, durationSeconds: 100,
      percentage: 25, completed: false, updatedAt: Date.now() }, media);
    const { container, unmount } = render(<VideoPlayerWeb media={media} stream={stream} />);
    const video = container.querySelector('video')!;
    setupVideo(video);
    expect(video.currentTime).toBe(25);
    video.currentTime = 61;
    unmount();
    expect(theiaStore.getState().getProgress(media.id)?.positionSeconds).toBe(61);
  });
  it('respects disabled auto-resume and explicit initial positions', () => {
    theiaStore.getState().updateSettings({ autoResume: false });
    theiaStore.getState().updateProgress({ mediaId: media.id, positionSeconds: 25, durationSeconds: 100,
      percentage: 25, completed: false, updatedAt: Date.now() }, media);
    const { container } = render(<VideoPlayerWeb media={media} stream={stream} initialTime={10} />);
    const video = container.querySelector('video')!;
    setupVideo(video);
    expect(video.currentTime).toBe(10);
  });
  it('preserves playback position when selecting another server', () => {
    const { container, rerender } = render(<VideoPlayerWeb media={media} stream={stream} />);
    const video = container.querySelector('video')!;
    setupVideo(video);
    video.currentTime = 42;
    rerender(<VideoPlayerWeb media={media} stream={{ ...stream, id: 'two', url: 'https://cdn.example/other.mp4' }} />);
    setupVideo(video);
    expect(video.currentTime).toBe(42);
  });
  it('loads SRT/VTT subtitles as a usable WebVTT track', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('1\n00:00:01,000 --> 00:00:02,000\nHello')));
    const create = vi.fn().mockReturnValue('blob:subtitle');
    const revoke = vi.fn();
    URL.createObjectURL = create;
    URL.revokeObjectURL = revoke;
    const { container, unmount } = render(<VideoPlayerWeb media={media} stream={{ ...stream, subtitles: [
      { id: 'en', url: 'https://cdn.example/en.srt', format: 'srt', label: 'English', language: 'en' },
    ] }} />);
    await waitFor(() => expect(container.querySelector('track')?.getAttribute('src')).toBe('blob:subtitle'));
    expect(create.mock.calls[0][0].type).toBe('text/vtt');
    unmount();
    expect(revoke).toHaveBeenCalledWith('blob:subtitle');
  });
  it('shows recovery controls when video fails and honors auto-next', () => {
    const next = vi.fn();
    const { container, getByRole, rerender } = render(<VideoPlayerWeb media={media} stream={stream} hasNextEpisode onNextEpisode={next} />);
    const video = container.querySelector('video')!;
    setupVideo(video);
    fireEvent.error(video);
    expect(getByRole('alert').textContent).toContain('could not be played');
    expect(getByRole('button', { name: 'Retry stream' })).toBeTruthy();
    fireEvent.ended(video);
    expect(next).toHaveBeenCalledTimes(1);
    theiaStore.getState().updateSettings({ autoPlayNext: false });
    rerender(<VideoPlayerWeb media={media} stream={stream} hasNextEpisode onNextEpisode={next} />);
    fireEvent.ended(video);
    expect(next).toHaveBeenCalledTimes(1);
  });
});

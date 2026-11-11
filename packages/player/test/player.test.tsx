// @vitest-environment jsdom
import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, waitFor } from '@testing-library/react';
import { theiaStore, setDefaultProxyUrl, getContinueWatching } from '@theia/core';
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
  setDefaultProxyUrl('');
  vi.spyOn(HTMLMediaElement.prototype, 'load').mockImplementation(() => {});
  vi.spyOn(HTMLMediaElement.prototype, 'play').mockResolvedValue();
  vi.spyOn(HTMLMediaElement.prototype, 'pause').mockImplementation(() => {});
  theiaStore.setState({ progress: {}, history: [] });
  theiaStore.getState().updateSettings({ autoResume: true, autoPlayNext: true, proxyUrl: '', preferredSubtitles: ['en'] });
});
afterEach(() => { cleanup(); setDefaultProxyUrl(''); vi.unstubAllGlobals(); });

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

it('automatically chooses a preferred external track over an unrelated provider default and uses the proxy', async () => {
  setDefaultProxyUrl('/api/proxy');
  const request = vi.fn().mockResolvedValue(new Response('1\n00:00:01,000 --> 00:00:02,000\nHello'));
  vi.stubGlobal('fetch', request);
  URL.createObjectURL = vi.fn().mockReturnValue('blob:english');
  URL.revokeObjectURL = vi.fn();
  const { container } = render(<VideoPlayerWeb media={media} stream={{ ...stream,
    headers: { Referer: 'https://provider.example/' }, subtitles: [
      { id: 'it', language: 'ita', label: 'Italian', isDefault: true, url: 'https://cdn.example/it.srt', format: 'srt' },
      { id: 'en', language: 'eng', label: 'English', url: 'https://cdn.example/en.srt', format: 'srt' },
    ] }} />);
  await waitFor(() => expect(container.querySelector('track')?.getAttribute('src')).toBe('blob:english'));
  const url = new URL(request.mock.calls[0][0]);
  expect(url.pathname).toBe('/api/proxy');
  expect(url.searchParams.get('url')).toBe('https://cdn.example/en.srt');
  expect(url.searchParams.get('referer')).toBe('https://provider.example/');
});

it('enables captions automatically when native HLS text tracks appear', () => {
  const { container } = render(<VideoPlayerWeb media={media} stream={{ ...stream, format: 'hls' }} />);
  const video = container.querySelector('video')!;
  const italian = { kind: 'subtitles', language: 'ita', label: 'Italian', mode: 'disabled', cues: [] };
  const english = { kind: 'subtitles', language: 'eng', label: 'English', mode: 'disabled', cues: [] };
  Object.defineProperty(video, 'textTracks', { configurable: true, value: [italian, english] });
  setupVideo(video);
  expect(english.mode).toBe('showing');
  expect(italian.mode).toBe('disabled');
});

it('respects an explicit automatic-subtitles Off preference for external tracks', () => {
  theiaStore.getState().updateSettings({ preferredSubtitles: [] });
  const request = vi.fn();
  vi.stubGlobal('fetch', request);
  const { container } = render(<VideoPlayerWeb media={media} stream={{ ...stream, subtitles: [
    { id: 'en', language: 'eng', label: 'English', isDefault: true, url: 'https://cdn.example/en.vtt', format: 'vtt' },
  ] }} />);
  expect(request).not.toHaveBeenCalled();
  expect(container.querySelector('track')).toBeNull();
});

describe('cinema controls', () => {
  it('connects the timeline and volume controls to the video', () => {
    const { container, getByRole } = render(<VideoPlayerWeb media={media} stream={stream} />);
    const video = container.querySelector('video')!;
    setupVideo(video);
    fireEvent.change(getByRole('slider', { name: 'Playback position' }), { target: { value: '45' } });
    expect(video.currentTime).toBe(45);
    fireEvent.change(getByRole('slider', { name: 'Volume' }), { target: { value: '35' } });
    expect(video.volume).toBe(0.35);
    fireEvent.click(getByRole('button', { name: 'Mute' }));
    expect(video.volume).toBe(0);
    fireEvent.click(getByRole('button', { name: 'Unmute' }));
    expect(video.volume).toBeGreaterThan(0);
  });

  it('reports rejected and unsupported fullscreen requests', async () => {
    const { container, getByRole, getByText } = render(<VideoPlayerWeb media={media} stream={stream} />);
    fireEvent.click(getByRole('button', { name: 'Enter fullscreen' }));
    expect(getByText('Fullscreen is not supported in this browser.')).toBeTruthy();
    Object.defineProperty(container.querySelector('.video-player'), 'requestFullscreen', {
      value: vi.fn().mockRejectedValue(new Error('Denied')),
    });
    fireEvent.click(getByRole('button', { name: 'Enter fullscreen' }));
    await waitFor(() => expect(getByText(/Fullscreen could not start/)).toBeTruthy());
  });

  it('tracks fullscreen changes and exits without navigating back', async () => {
    const back = vi.fn();
    const { container, getByRole } = render(<VideoPlayerWeb media={media} stream={stream} onBack={back} />);
    const player = container.querySelector('.video-player')!;
    const exit = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(document, 'fullscreenElement', { configurable: true, get: () => player });
    Object.defineProperty(document, 'exitFullscreen', { configurable: true, value: exit });
    fireEvent(document, new Event('fullscreenchange'));
    fireEvent.keyDown(player, { key: 'Escape' });
    expect(back).not.toHaveBeenCalled();
    fireEvent.click(getByRole('button', { name: 'Exit fullscreen' }));
    expect(exit).toHaveBeenCalledOnce();
    Object.defineProperty(document, 'fullscreenElement', { configurable: true, get: () => null });
    fireEvent(document, new Event('fullscreenchange'));
    expect(getByRole('button', { name: 'Enter fullscreen' })).toBeTruthy();
    delete (document as Document & { exitFullscreen?: unknown }).exitFullscreen;
  });

  it('supports prefixed Safari container fullscreen and reports fullscreenerror events', () => {
    const { container, getByRole, getByText } = render(<VideoPlayerWeb media={media} stream={stream} />);
    const request = vi.fn();
    Object.defineProperty(container.querySelector('.video-player'), 'webkitRequestFullscreen', { value: request });
    fireEvent.click(getByRole('button', { name: 'Enter fullscreen' }));
    expect(request).toHaveBeenCalledOnce();
    fireEvent(container.querySelector('.video-player')!, new Event('fullscreenerror', { bubbles: true }));
    expect(getByText(/Fullscreen could not start/)).toBeTruthy();
  });

  it('uses native video fullscreen on iPhone Safari and tracks native exit', () => {
    const { container, getByRole } = render(<VideoPlayerWeb media={media} stream={stream} />);
    const video = container.querySelector('video')!;
    const enter = vi.fn();
    Object.defineProperties(video, {
      webkitEnterFullscreen: { value: enter },
      webkitDisplayingFullscreen: { configurable: true, value: false },
    });
    fireEvent.click(getByRole('button', { name: 'Enter fullscreen' }));
    expect(enter).toHaveBeenCalledOnce();
    Object.defineProperty(video, 'webkitDisplayingFullscreen', { value: true });
    fireEvent(video, new Event('webkitbeginfullscreen'));
    expect(getByRole('button', { name: 'Exit fullscreen' })).toBeTruthy();
    Object.defineProperty(video, 'webkitDisplayingFullscreen', { value: false });
    fireEvent(video, new Event('webkitendfullscreen'));
    expect(getByRole('button', { name: 'Enter fullscreen' })).toBeTruthy();
  });

  it('requests fullscreen on the player container', () => {
    const { container, getByRole } = render(<VideoPlayerWeb media={media} stream={stream} />);
    const request = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(container.querySelector('.video-player'), 'requestFullscreen', { value: request });
    fireEvent.click(getByRole('button', { name: 'Enter fullscreen' }));
    expect(request).toHaveBeenCalledOnce();
  });
});

it('switches servers and lets Escape dismiss the picker without leaving playback', () => {
  const back = vi.fn();
  const select = vi.fn();
  const other = { ...stream, id: 'alternate', name: 'Alternate server' };
  const { getByRole, queryByRole } = render(<VideoPlayerWeb media={media} stream={stream}
    availableStreams={[stream, other]} onSelectStream={select} onBack={back} />);
  fireEvent.click(getByRole('button', { name: 'Choose server' }));
  const dialog = getByRole('dialog', { name: 'Playback servers' });
  expect(document.activeElement).toBe(getByRole('button', { name: 'Close server selector' }));
  fireEvent.keyDown(dialog, { key: 'Escape' });
  expect(queryByRole('dialog', { name: 'Playback servers' })).toBeNull();
  expect(back).not.toHaveBeenCalled();
  fireEvent.click(getByRole('button', { name: 'Choose server' }));
  fireEvent.click(getByRole('button', { name: /Alternate server/ }));
  expect(select).toHaveBeenCalledWith(other);
  expect(queryByRole('dialog', { name: 'Playback servers' })).toBeNull();
});

it('tracks only events from the active VidLink iframe and keeps its resume URL stable', () => {
  theiaStore.getState().updateProgress({ mediaId: media.id, positionSeconds: 25, durationSeconds: 100,
    percentage: 25, completed: false, updatedAt: Date.now() }, media);
  const embed: StreamSource = { ...stream, provider: 'vidlink', format: 'embed', url: 'https://vidlink.pro/movie/123' };
  const { container, unmount } = render(<VideoPlayerWeb media={media} stream={embed} />);
  const frame = container.querySelector('iframe')!;
  expect(frame.src).toContain('startAt=25');
  const send = (origin: string, source: Window | null, currentTime = 45) => window.dispatchEvent(new MessageEvent('message', {
    origin, source, data: { type: 'PLAYER_EVENT', data: { event: 'pause', currentTime, duration: 100, mediaType: 'movie', mtmdbId: 123 } },
  }));
  send('https://evil.example', frame.contentWindow);
  send('https://vidlink.pro', window);
  expect(theiaStore.getState().getProgress(media.id)?.positionSeconds).toBe(25);
  send('https://vidlink.pro', frame.contentWindow, NaN);
  expect(theiaStore.getState().getProgress(media.id)?.positionSeconds).toBe(25);
  send('https://vidlink.pro', frame.contentWindow);
  expect(theiaStore.getState().getProgress(media.id)?.positionSeconds).toBe(45);
  expect(frame.src).toContain('startAt=25');
  unmount();
  send('https://vidlink.pro', null, 60);
  expect(theiaStore.getState().getProgress(media.id)?.positionSeconds).toBe(45);
});


it.each(['pause', 'pagehide', 'background', 'unmount', 'periodic'])('saves credits completion on %s without losing the movie timestamp', (event) => {
  vi.useFakeTimers();
  const { container, unmount } = render(<VideoPlayerWeb media={media} stream={{ ...stream, creditsStartSeconds: 80 }} />);
  const video = container.querySelector('video')!;
  setupVideo(video);
  video.currentTime = 85;
  if (event === 'pause') fireEvent.pause(video);
  else if (event === 'pagehide') window.dispatchEvent(new Event('pagehide'));
  else if (event === 'background') {
    vi.spyOn(document, 'hidden', 'get').mockReturnValue(true);
    document.dispatchEvent(new Event('visibilitychange'));
  }
  else if (event === 'periodic') vi.advanceTimersByTime(5000);
  else unmount();
  expect(theiaStore.getState().getProgress(media.id)).toMatchObject({ positionSeconds: 85, completed: true });
  expect(getContinueWatching(theiaStore.getState().history)).toEqual([]);
  vi.useRealTimers();
});

it('offers the next episode at credits without starting it automatically', () => {
  const episode = { id: 'first', title: 'First', season: 1, episode: 1 };
  const next = { id: 'second', title: 'Second', season: 1, episode: 2 };
  const show: MediaItem = { ...media, type: 'series', episodes: [episode, next] };
  const onNext = vi.fn();
  const { container } = render(<VideoPlayerWeb media={show} episode={episode}
    stream={{ ...stream, creditsStartSeconds: 80 }} onNextEpisode={onNext} hasNextEpisode />);
  const video = container.querySelector('video')!;
  setupVideo(video);
  video.currentTime = 85;
  fireEvent.pause(video);
  expect(getContinueWatching(theiaStore.getState().history)[0].nextEpisode?.id).toBe(next.id);
  expect(theiaStore.getState().getProgress(show.id, episode.id)?.positionSeconds).toBe(85);
  expect(onNext).not.toHaveBeenCalled();
});

it('applies credits timing to supported embed progress', () => {
  const { container } = render(<VideoPlayerWeb media={media} stream={{ ...stream,
    provider: 'vidlink', format: 'embed', url: 'https://vidlink.pro/movie/123', creditsStartSeconds: 80 }} />);
  window.dispatchEvent(new MessageEvent('message', {
    origin: 'https://vidlink.pro', source: container.querySelector('iframe')!.contentWindow,
    data: { type: 'PLAYER_EVENT', data: { event: 'pause', currentTime: 85, duration: 100, mediaType: 'movie', mtmdbId: 123 } },
  }));
  expect(theiaStore.getState().getProgress(media.id)).toMatchObject({ positionSeconds: 85, completed: true });
  expect(getContinueWatching(theiaStore.getState().history)).toEqual([]);
});

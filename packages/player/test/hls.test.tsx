// @vitest-environment jsdom
import React from 'react';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { setDefaultProxyUrl, theiaStore } from '@theia/core';
import { VideoPlayerWeb } from '../src/VideoPlayer.web';
import { preferredTrackIndex } from '../src/languages';

const { instances } = vi.hoisted(() => ({ instances: [] as any[] }));
vi.mock('hls.js', () => {
  class Hls {
    static isSupported = () => true;
    static Events = { ERROR: 'error', AUDIO_TRACKS_UPDATED: 'tracks', AUDIO_TRACK_SWITCHED: 'switched',
      SUBTITLE_TRACKS_UPDATED: 'subtitles', SUBTITLE_FRAG_PROCESSED: 'subtitle-loaded' };
    static ErrorTypes = { NETWORK_ERROR: 'network', MEDIA_ERROR: 'media' };
    handlers = new Map<string, Set<Function>>();
    subtitleTracks = [];
    subtitleTrack = -1;
    subtitleDisplay = true;
    _audioTrack = -1;
    config: unknown;
    constructor(config: unknown) { this.config = config; instances.push(this); }
    on(event: string, handler: Function) {
      if (!this.handlers.has(event)) this.handlers.set(event, new Set());
      this.handlers.get(event)!.add(handler);
    }
    off(event: string, handler: Function) { this.handlers.get(event)?.delete(handler); }
    emit(event: string, data: unknown) { this.handlers.get(event)?.forEach((handler) => handler(event, data)); }
    set audioTrack(value: number) { this._audioTrack = value; this.emit('switched', { id: value }); }
    get audioTrack() { return this._audioTrack; }
    loadSource = vi.fn(); attachMedia = vi.fn(); destroy = vi.fn();
    startLoad = vi.fn(); recoverMediaError = vi.fn();
  }
  return { default: Hls };
});
const media = { id: 'tt1', type: 'movie' as const, title: 'Example' };
const stream = { id: 'hls', name: 'VixSrc', provider: 'vixsrc', format: 'hls' as const,
  quality: 'auto', url: 'https://vixsrc.to/playlist/123?token=signed', requiresProxy: true,
  headers: { Referer: 'https://vixsrc.to/' } };
beforeEach(() => {
  instances.length = 0;
  setDefaultProxyUrl('/api/proxy');
  theiaStore.getState().updateSettings({ proxyUrl: '', preferredLanguages: ['en', 'es'], preferredSubtitles: ['en'] });
  vi.spyOn(HTMLMediaElement.prototype, 'load').mockImplementation(() => {});
  vi.spyOn(HTMLMediaElement.prototype, 'play').mockResolvedValue();
});
afterEach(() => { cleanup(); setDefaultProxyUrl(''); });

describe('direct HLS playback', () => {
  it('routes extensionless playlists through the automatic same-origin proxy', () => {
    render(<VideoPlayerWeb media={media} stream={stream} />);
    const url = new URL(instances[0].loadSource.mock.calls[0][0]);
    expect(url.origin).toBe(window.location.origin);
    expect(url.pathname).toBe('/api/proxy');
    expect(url.searchParams.get('url')).toBe(stream.url);
    expect(url.searchParams.get('referer')).toBe('https://vixsrc.to/');
  });
  it('chooses the preferred audio language and supports manually switching tracks', () => {
    render(<VideoPlayerWeb media={media} stream={stream} />);
    const hls = instances[0];
    act(() => hls.emit('tracks', { audioTracks: [{ name: 'Italian', lang: 'ita' }, { name: 'English', lang: 'eng' }] }));
    expect(hls.audioTrack).toBe(1);
    expect(hls.subtitleDisplay).toBe(false);
    const selector = screen.getByRole('combobox', { name: 'Audio language' }) as HTMLSelectElement;
    expect(selector.value).toBe('1');
    fireEvent.change(selector, { target: { value: '0' } });
    expect(hls.audioTrack).toBe(0);
  });
  it('stops fatal network recovery attempts and shows an actionable error', () => {
    render(<VideoPlayerWeb media={media} stream={stream} />);
    const hls = instances[0];
    act(() => {
      for (let i = 0; i < 3; i++) hls.emit('error', { fatal: true, type: 'network' });
    });
    expect(hls.startLoad).toHaveBeenCalledTimes(2);
    expect(hls.destroy).toHaveBeenCalled();
    expect(screen.getByRole('alert').textContent).toContain('could not be played');
  });
});

it('matches ISO-639-2 and regional language tags without selecting an unrelated track', () => {
  expect(preferredTrackIndex([{ lang: 'ita' }, { lang: 'eng' }], ['en-US'])).toBe(1);
  expect(preferredTrackIndex([{ lang: 'fre' }], ['fr'])).toBe(0);
  expect(preferredTrackIndex([{ lang: 'ita' }], ['en'])).toBe(-1);
});

const subtitleTracks = [
  { name: 'Italian [Forced]', lang: 'ita', forced: true, default: true, url: 'https://cdn.example/it.m3u8' },
  { name: 'English [Forced]', lang: 'eng', forced: true, url: 'https://cdn.example/en-forced.m3u8' },
  { name: 'English [CC]', lang: 'eng', forced: false, url: 'https://cdn.example/en.m3u8' },
];

it('automatically enables full English HLS subtitles and lists manifest tracks in the picker', async () => {
  render(<VideoPlayerWeb media={media} stream={stream} />);
  const hls = instances[0];
  await act(async () => {
    hls.emit('subtitles', { subtitleTracks });
    // HLS itself applies this default after its tracks-updated event returns.
    hls.subtitleTrack = 0;
  });
  expect(hls.subtitleDisplay).toBe(true);
  expect(hls.subtitleTrack).toBe(2);
  fireEvent.click(screen.getByTitle('Subtitles & Sync'));
  expect(screen.getByRole('button', { name: 'English [CC]' }).getAttribute('aria-pressed')).toBe('true');
  expect(screen.getByRole('button', { name: 'Italian [Forced]' })).toBeTruthy();
});

it('keeps an explicit Off through HLS rendition updates and remembers the choice', async () => {
  render(<VideoPlayerWeb media={media} stream={stream} />);
  const hls = instances[0];
  await act(async () => { hls.emit('subtitles', { subtitleTracks }); });
  fireEvent.click(screen.getByTitle('Subtitles & Sync'));
  fireEvent.click(screen.getByRole('button', { name: 'Off' }));
  await waitFor(() => expect(hls.subtitleTrack).toBe(-1));
  expect(hls.subtitleDisplay).toBe(false);
  expect(theiaStore.getState().settings.preferredSubtitles).toEqual([]);
  await act(async () => { hls.emit('subtitles', { subtitleTracks }); hls.subtitleTrack = 0; });
  expect(hls.subtitleTrack).toBe(-1);
  fireEvent.click(screen.getByRole('button', { name: 'English [CC]' }));
  await waitFor(() => expect(hls.subtitleTrack).toBe(2));
  expect(theiaStore.getState().settings.preferredSubtitles[0]).toBe('eng');
});

it('selects a different preferred subtitle language and leaves unavailable languages off', async () => {
  theiaStore.getState().updateSettings({ preferredSubtitles: ['it'] });
  const { unmount } = render(<VideoPlayerWeb media={media} stream={stream} />);
  await act(async () => { instances[0].emit('subtitles', { subtitleTracks }); });
  expect(instances[0].subtitleTrack).toBe(0);
  unmount();
  theiaStore.getState().updateSettings({ preferredSubtitles: ['ja'] });
  render(<VideoPlayerWeb media={media} stream={stream} />);
  await act(async () => { instances[1].emit('subtitles', { subtitleTracks }); });
  expect(instances[1].subtitleTrack).toBe(-1);
  expect(instances[1].subtitleDisplay).toBe(false);
});

it('cleans subtitle listeners when switching streams and selects the new manifest automatically', async () => {
  const { rerender } = render(<VideoPlayerWeb media={media} stream={stream} />);
  const old = instances[0];
  await act(async () => { old.emit('subtitles', { subtitleTracks }); });
  rerender(<VideoPlayerWeb media={media} stream={{ ...stream, id: 'second', url: 'https://vixsrc.to/playlist/456' }} />);
  expect(old.handlers.get('subtitles').size).toBe(0);
  const next = instances[1];
  await act(async () => { next.emit('subtitles', { subtitleTracks: [subtitleTracks[2]] }); });
  expect(next.subtitleTrack).toBe(0);
  expect(next.subtitleDisplay).toBe(true);
});

// @vitest-environment jsdom
import React from 'react';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { setDefaultProxyUrl, theiaStore } from '@theia/core';
import { VideoPlayerWeb } from '../src/VideoPlayer.web';
import { preferredTrackIndex } from '../src/languages';

const { instances } = vi.hoisted(() => ({ instances: [] as any[] }));
vi.mock('hls.js', () => {
  class Hls {
    static isSupported = () => true;
    static Events = { ERROR: 'error', AUDIO_TRACKS_UPDATED: 'tracks', AUDIO_TRACK_SWITCHED: 'switched' };
    static ErrorTypes = { NETWORK_ERROR: 'network', MEDIA_ERROR: 'media' };
    handlers = new Map<string, Function>();
    subtitleDisplay = true;
    _audioTrack = -1;
    config: unknown;
    constructor(config: unknown) { this.config = config; instances.push(this); }
    on(event: string, handler: Function) { this.handlers.set(event, handler); }
    emit(event: string, data: unknown) { this.handlers.get(event)?.(event, data); }
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
  theiaStore.getState().updateSettings({ proxyUrl: '', preferredLanguages: ['en', 'es'] });
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

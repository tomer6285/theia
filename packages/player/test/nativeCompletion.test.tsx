// @vitest-environment jsdom
import React from 'react';
import { afterEach, expect, it, vi } from 'vitest';
import { act, cleanup, render } from '@testing-library/react';
import { theiaStore } from '@theia/core';
import { VideoPlayerNative } from '../src/VideoPlayer.native';

const callbacks = vi.hoisted(() => ({ audio: null as any, status: null as any, background: null as any, remove: vi.fn() }));
vi.mock('react-native', () => ({
  View: 'div', Text: 'span', Pressable: 'button', StyleSheet: { create: (s: unknown) => s },
  AppState: { addEventListener: (_: string, callback: unknown) => {
    callbacks.background = callback;
    return { remove: callbacks.remove };
  } },
}));
vi.mock('expo-av', () => ({
  ResizeMode: { CONTAIN: 'contain' },
  Video: (props: any) => { callbacks.audio = { volume: props.volume, muted: props.isMuted }; callbacks.status = props.onPlaybackStatusUpdate; return null; },
}));
vi.mock('react-native-webview', () => ({ WebView: () => null }));
afterEach(() => { cleanup(); vi.useRealTimers(); });

it.each(['background', 'unmount', 'pause'])('flushes the latest native position on %s', event => {
  vi.useFakeTimers();
  theiaStore.setState({ progress: {}, history: [] });
  const media = { id: 'native-movie', title: 'Movie', type: 'movie' as const };
  const { unmount } = render(<VideoPlayerNative media={media} stream={{ id: 'direct',
    provider: 'test', name: 'Direct', quality: 'auto', format: 'mp4', url: 'https://cdn.example/movie', creditsStartSeconds: 80 }} />);
  const status = { isLoaded: true, durationMillis: 100000, positionMillis: 70000, isPlaying: true, didJustFinish: false };
  callbacks.status(status);
  // This update is throttled but must still be retained for the lifecycle flush.
  callbacks.status({ ...status, positionMillis: 85000 });
  expect(theiaStore.getState().getProgress(media.id)?.completed).toBe(false);
  if (event === 'background') callbacks.background('background');
  else if (event === 'pause') callbacks.status({ ...status, positionMillis: 85000, isPlaying: false });
  else unmount();
  expect(theiaStore.getState().getProgress(media.id)).toMatchObject({ positionSeconds: 85, completed: true });
});

it('restores native audio and saves native control changes before progress is available', () => {
  theiaStore.getState().updateSettings({ volume: 28, muted: false });
  const props = { media: { id: 'audio', title: 'Audio', type: 'movie' as const },
    stream: { id: 'direct', provider: 'test', name: 'Direct', quality: 'auto' as const,
      format: 'mp4' as const, url: 'https://cdn.example/movie' } };
  const first = render(<VideoPlayerNative {...props} />);
  expect(callbacks.audio).toEqual({ volume: 0.28, muted: false });
  act(() => callbacks.status({ isLoaded: true, volume: 0.61, isMuted: true }));
  expect(theiaStore.getState().settings).toMatchObject({ volume: 61, muted: true });
  first.unmount();
  render(<VideoPlayerNative {...props} />);
  expect(callbacks.audio).toEqual({ volume: 0.61, muted: true });
});

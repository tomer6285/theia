// @vitest-environment jsdom
import React from 'react';
import { afterEach, expect, it, vi } from 'vitest';
import { cleanup, render } from '@testing-library/react';
import { theiaStore } from '@theia/core';
import { VideoPlayerNative } from '../src/VideoPlayer.native';

const callbacks = vi.hoisted(() => ({ status: null as any, background: null as any, remove: vi.fn() }));
vi.mock('react-native', () => ({
  View: 'div', Text: 'span', Pressable: 'button', StyleSheet: { create: (s: unknown) => s },
  AppState: { addEventListener: (_: string, callback: unknown) => {
    callbacks.background = callback;
    return { remove: callbacks.remove };
  } },
}));
vi.mock('expo-av', () => ({
  ResizeMode: { CONTAIN: 'contain' },
  Video: (props: any) => { callbacks.status = props.onPlaybackStatusUpdate; return null; },
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

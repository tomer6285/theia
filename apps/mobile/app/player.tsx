import React, { useEffect, useRef, useState } from 'react';
import { View, StyleSheet, TouchableOpacity, Text, ActivityIndicator } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import * as ScreenOrientation from 'expo-screen-orientation';
import { activateKeepAwakeAsync, deactivateKeepAwake } from 'expo-keep-awake';
import { MediaItem, StreamSource, Episode, providerManager } from '@theia/core';
import { VideoPlayer } from '@theia/player';

type Session = { media: MediaItem; stream: StreamSource; episode?: Episode };
function parseSession(params: { media?: string; stream?: string; episode?: string }): Session | null {
  try {
    const media = JSON.parse(params.media || 'null') as MediaItem;
    const stream = JSON.parse(params.stream || 'null') as StreamSource;
    const episode = params.episode ? JSON.parse(params.episode) as Episode : undefined;
    if (typeof media?.id !== 'string' || typeof media.title !== 'string'
      || typeof stream?.url !== 'string' || !['http:', 'https:'].includes(new URL(stream.url).protocol)
      || !['hls', 'mp4', 'embed'].includes(stream.format)) return null;
    return { media, stream, episode };
  } catch { return null; }
}

export default function PlayerScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ media: string; stream: string; episode?: string }>();
  const [session, setSession] = useState(() => parseSession(params));
  const [loadingNext, setLoadingNext] = useState(false);
  const [error, setError] = useState('');
  const controllerRef = useRef<AbortController | null>(null);
  const episodeIndex = session?.media.episodes?.findIndex((item) => item.id === session.episode?.id) ?? -1;
  const nextEpisode = episodeIndex >= 0 ? session?.media.episodes?.[episodeIndex + 1] : undefined;
  const loadNext = async () => {
    if (!session || !nextEpisode || loadingNext) return;
    const controller = new AbortController();
    controllerRef.current?.abort();
    controllerRef.current = controller;
    setLoadingNext(true);
    setError('');
    try {
      const streams = await providerManager.resolveStreams({
        imdbId: session.media.imdbId || session.media.id, tmdbId: session.media.tmdbId,
        type: session.media.type, title: session.media.title,
        season: nextEpisode.season, episode: nextEpisode.episode, signal: controller.signal,
      });
      if (controller.signal.aborted) return;
      if (streams[0]) setSession({ media: session.media, stream: streams[0], episode: nextEpisode });
      else setError('No servers found for the next episode.');
    } catch {
      if (!controller.signal.aborted) setError('Could not load the next episode.');
    } finally {
      if (!controller.signal.aborted) setLoadingNext(false);
    }
  };
  useEffect(() => {
    void activateKeepAwakeAsync('THEIA_PLAYER').catch(() => {});
    void ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.LANDSCAPE).catch(() => {});
    return () => {
      controllerRef.current?.abort();
      deactivateKeepAwake('THEIA_PLAYER');
      void ScreenOrientation.unlockAsync().catch(() => {});
    };
  }, []);

  if (!session) return <View style={styles.message}>
    <Text style={styles.text}>This playback link is invalid.</Text>
    <TouchableOpacity onPress={() => router.back()}><Text style={styles.action}>Go back</Text></TouchableOpacity>
  </View>;

  return <View style={styles.container}>
    <VideoPlayer key={session.episode?.id || session.media.id} {...session}
      onBack={() => router.back()} hasNextEpisode={Boolean(nextEpisode)} onNextEpisode={loadNext} />
    {(loadingNext || error) ? <View style={[StyleSheet.absoluteFill, styles.message]}>
      {loadingNext ? <ActivityIndicator color="#06b6d4" /> : <Text style={styles.text}>{error}</Text>}
      {error ? <TouchableOpacity accessibilityRole="button" onPress={loadNext}><Text style={styles.action}>Try again</Text></TouchableOpacity> : null}
      <TouchableOpacity accessibilityRole="button" onPress={() => router.back()}><Text style={styles.action}>Back to details</Text></TouchableOpacity>
    </View> : null}
  </View>;
}
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  message: { flex: 1, backgroundColor: '#09090b', alignItems: 'center', justifyContent: 'center', gap: 20, padding: 24 },
  text: { color: '#fff', fontSize: 16 },
  action: { color: '#22d3ee', fontSize: 16, padding: 12 },
});

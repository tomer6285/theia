import React, { useRef, useState } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { Video, ResizeMode, AVPlaybackStatus } from 'expo-av';
import { WebView } from 'react-native-webview';
import { theiaStore } from '@theia/core';
import { VideoPlayerProps } from './types';

/** Native playback uses Expo's video engine; provider embeds use an isolated WebView. */
export const VideoPlayerNative: React.FC<VideoPlayerProps> = ({
  media, episode, stream, onBack, onNextEpisode, hasNextEpisode = false,
  autoPlay = true, initialTime,
}) => {
  const [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0);
  const saved = theiaStore.getState().getProgress(media.id, episode?.id);
  const start = useRef(initialTime ?? (theiaStore.getState().settings.autoResume && saved && !saved.completed
    ? saved.positionSeconds : 0));
  const lastSaved = useRef(0);
  const save = (status: AVPlaybackStatus) => {
    if (!status.isLoaded || !status.durationMillis) return;
    if (!status.didJustFinish && status.isPlaying && Date.now() - lastSaved.current < 5000) return;
    lastSaved.current = Date.now();
    const percentage = status.positionMillis / status.durationMillis * 100;
    theiaStore.getState().updateProgress({
      mediaId: media.id, episodeId: episode?.id, season: episode?.season, episode: episode?.episode,
      positionSeconds: status.positionMillis / 1000, durationSeconds: status.durationMillis / 1000,
      percentage, completed: status.didJustFinish || percentage > 92, updatedAt: Date.now(),
    }, media);
    if (status.didJustFinish && hasNextEpisode && theiaStore.getState().settings.autoPlayNext) onNextEpisode?.();
  };
  return (
    <View style={styles.container}>
      {stream.format === 'embed' ? (
        <WebView key={`${stream.url}-${attempt}`} source={{ uri: stream.url, headers: stream.headers }}
          style={styles.video} allowsFullscreenVideo allowsInlineMediaPlayback
          mediaPlaybackRequiresUserAction={!autoPlay} javaScriptCanOpenWindowsAutomatically={false}
          setSupportMultipleWindows onError={() => setError('This server could not be loaded.')}
          onShouldStartLoadWithRequest={(request) => /^https?:\/\//.test(request.url)} />
      ) : (
        <Video key={`${episode?.id || media.id}-${stream.url}-${attempt}`}
          source={{ uri: stream.url, headers: stream.headers,
            overrideFileExtensionAndroid: stream.format === 'hls' ? 'm3u8' : undefined }}
          style={styles.video} useNativeControls resizeMode={ResizeMode.CONTAIN}
          shouldPlay={autoPlay} positionMillis={Math.max(0, start.current) * 1000}
          onPlaybackStatusUpdate={save} onError={() => setError('This stream could not be played. Try again or choose another server.')} />
      )}
      {onBack && <Pressable accessibilityRole="button" accessibilityLabel="Back to details"
        style={styles.back} onPress={onBack}><Text style={styles.text}>‹ Back</Text></Pressable>}
      {error ? <View style={styles.error} accessibilityRole="alert">
        <Text style={styles.text}>{error}</Text>
        <Pressable accessibilityRole="button" style={styles.retry} onPress={() => { setError(''); setAttempt(attempt + 1); }}>
          <Text style={styles.text}>Retry</Text>
        </Pressable>
      </View> : null}
    </View>
  );
};

export const VideoPlayer = VideoPlayerNative;
export default VideoPlayerNative;
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  video: { flex: 1, width: '100%', height: '100%', backgroundColor: '#000' },
  back: { position: 'absolute', top: 16, left: 16, padding: 14, borderRadius: 14, backgroundColor: '#18181bcc' },
  text: { color: '#fff', fontSize: 16 },
  error: { position: 'absolute', top: '30%', left: '15%', right: '15%', padding: 24, borderRadius: 16, backgroundColor: '#18181b', gap: 16 },
  retry: { padding: 12, backgroundColor: '#0e7490', borderRadius: 12, alignItems: 'center' },
});

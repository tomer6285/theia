import React, { useEffect } from 'react';
import { View, StyleSheet, TouchableOpacity, Text } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import * as ScreenOrientation from 'expo-screen-orientation';
import { activateKeepAwakeAsync, deactivateKeepAwake } from 'expo-keep-awake';
import { MediaItem, StreamSource, Episode } from '@theia/core';
import { VideoPlayer } from '@theia/player';

export default function PlayerScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{
    media: string;
    stream: string;
    episode?: string;
  }>();

  const media: MediaItem = JSON.parse(params.media);
  const stream: StreamSource = JSON.parse(params.stream);
  const episode: Episode | undefined = params.episode ? JSON.parse(params.episode) : undefined;

  useEffect(() => {
    // Keep screen awake while playing
    activateKeepAwakeAsync('THEIA_PLAYER');

    // Lock to landscape orientation
    ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.LANDSCAPE);

    return () => {
      deactivateKeepAwake('THEIA_PLAYER');
      ScreenOrientation.unlockAsync();
    };
  }, []);

  return (
    <View style={styles.container}>
      <VideoPlayer
        media={media}
        stream={stream}
        episode={episode}
        onBack={() => router.back()}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
  },
});

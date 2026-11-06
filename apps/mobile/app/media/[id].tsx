import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  Image,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { MediaItem, cinemeta, providerManager, StreamSource, Episode } from '@theia/core';

export default function MediaDetailScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ id: string; item?: string }>();
  let initialItem: MediaItem = { id: params.id, title: '', type: 'movie' };
  try { if (params.item) initialItem = JSON.parse(params.item); } catch { /* use route fallback */ }
  const [media, setMedia] = useState<MediaItem>(initialItem);
  const [loading, setLoading] = useState(false);
  const [resolving, setResolving] = useState(false);
  const [hasResolved, setHasResolved] = useState(false);
  const [pendingPlay, setPendingPlay] = useState(false);
  const [streams, setStreams] = useState<StreamSource[]>([]);
  const resolveController = useRef<AbortController | null>(null);

  useEffect(() => {
    let active = true;
    setLoading(true);
    void cinemeta.getDetails(initialItem.id, initialItem.type).then((details) => {
      if (active) { if (details) setMedia(details); setLoading(false); }
    });
    return () => { active = false; resolveController.current?.abort(); };
  }, [initialItem.id, initialItem.type]);

  const handlePlay = async (episode?: Episode) => {
    if (resolving || loading) return;
    const ep = episode || (media.type === 'series' ? media.episodes?.find((item) => item.season >= 1) || media.episodes?.[0] : undefined);
    if (media.type === 'series' && !ep) return;
    resolveController.current?.abort();
    const controller = new AbortController();
    resolveController.current = controller;
    setResolving(true);
    setPendingPlay(true);
    setHasResolved(false);
    try {
      const result = await providerManager.resolveStreams({
        imdbId: media.imdbId || media.id, tmdbId: media.tmdbId, type: media.type, title: media.title,
        season: ep?.season, episode: ep?.episode, signal: controller.signal,
      });
      if (controller.signal.aborted) return;
      setStreams(result);
      setHasResolved(true);
      if (result[0]) router.push({ pathname: '/player', params: {
        media: JSON.stringify(media), stream: JSON.stringify(result[0]), episode: ep ? JSON.stringify(ep) : undefined,
      } });
    } finally {
      if (!controller.signal.aborted) { setResolving(false); setPendingPlay(false); }
    }
  };

  const isNoStreams = hasResolved && streams.length === 0;

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <Image
          source={{ uri: media.background || media.poster }}
          style={styles.backdrop}
        />
        <TouchableOpacity style={styles.closeBtn} onPress={() => router.back()}>
          <Text style={{ color: '#fff', fontSize: 18, fontWeight: '700' }}>✕</Text>
        </TouchableOpacity>

        <View style={styles.info}>
          <Text style={styles.title}>{media.title}</Text>
          <Text style={styles.subtext}>
            {media.year} • {media.rating ? `★ ${media.rating}` : ''} • {media.type.toUpperCase()}
          </Text>

          <TouchableOpacity
            style={[
              styles.playBtn,
              isNoStreams && { backgroundColor: '#27272a' },
            ]}
            disabled={resolving || loading || (media.type === 'series' && !media.episodes?.length)}
            onPress={() => handlePlay()}
          >
            {pendingPlay ? (
              <ActivityIndicator color="#000" />
            ) : isNoStreams ? (
              <Text style={[styles.playText, { color: '#71717a' }]}>No servers found — retry</Text>
            ) : (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Text style={styles.playText}>Watch Now ▶</Text>
                {resolving && (
                  <View
                    style={{
                      width: 6,
                      height: 6,
                      borderRadius: 3,
                      backgroundColor: 'rgba(0,0,0,0.4)',
                    }}
                  />
                )}
              </View>
            )}
          </TouchableOpacity>

          {media.description && (
            <Text style={styles.description}>{media.description}</Text>
          )}

          {/* Episodes if series */}
          {media.type === 'series' && media.episodes && (
            <View style={{ marginTop: 20 }}>
              <Text style={styles.episodesHeader}>Episodes</Text>
              {media.episodes.map((ep) => (
                <TouchableOpacity
                  key={ep.id}
                  style={styles.epRow}
                  disabled={resolving}
                  accessibilityRole="button"
                  onPress={() => handlePlay(ep)}
                >
                  <Text style={styles.epTitle}>
                    {ep.season}x{ep.episode}. {ep.title}
                  </Text>
                  <Text style={styles.epPlayIcon}>▶</Text>
                </TouchableOpacity>
              ))}
            </View>
          )}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#09090b',
  },
  scroll: {
    paddingBottom: 40,
  },
  backdrop: {
    width: '100%',
    height: 250,
    backgroundColor: '#18181b',
  },
  closeBtn: {
    position: 'absolute',
    top: 20,
    right: 20,
    backgroundColor: 'rgba(0,0,0,0.6)',
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  info: {
    padding: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: '800',
    color: '#fff',
  },
  subtext: {
    fontSize: 14,
    color: '#06b6d4',
    marginTop: 4,
    fontWeight: '600',
  },
  playBtn: {
    marginTop: 18,
    backgroundColor: '#06b6d4',
    height: 48,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  playText: {
    color: '#000',
    fontWeight: '700',
    fontSize: 16,
  },
  description: {
    color: '#a1a1aa',
    fontSize: 14,
    lineHeight: 20,
    marginTop: 16,
  },
  episodesHeader: {
    fontSize: 18,
    fontWeight: '700',
    color: '#fff',
    marginBottom: 12,
  },
  epRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#27272a',
  },
  epTitle: {
    color: '#e4e4e7',
    fontSize: 14,
  },
  epPlayIcon: {
    color: '#06b6d4',
    fontSize: 14,
  },
});

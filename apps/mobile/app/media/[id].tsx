import React, { useState, useEffect } from 'react';
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
import { MediaItem, cinemeta, providerManager, StreamSource, Episode } from '@dion/core';

export default function MediaDetailScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ id: string; item?: string }>();
  const initialItem: MediaItem = params.item ? JSON.parse(params.item) : { id: params.id, title: '', type: 'movie' };

  const [media, setMedia] = useState<MediaItem>(initialItem);
  const [loading, setLoading] = useState(false);
  const [resolving, setResolving] = useState(false);
  const [streams, setStreams] = useState<StreamSource[]>([]);
  const [selectedStream, setSelectedStream] = useState<StreamSource | null>(null);

  useEffect(() => {
    async function loadMeta() {
      setLoading(true);
      const details = await cinemeta.getDetails(media.id, media.type);
      if (details) setMedia(details);
      setLoading(false);
    }
    loadMeta();
  }, [media.id]);

  useEffect(() => {
    async function resolve() {
      setResolving(true);
      const res = await providerManager.resolveStreams({
        imdbId: media.id,
        type: media.type,
        title: media.title,
      });
      setStreams(res);
      if (res.length > 0) setSelectedStream(res[0]);
      setResolving(false);
    }
    resolve();
  }, [media.id]);

  const handlePlay = (ep?: Episode) => {
    if (selectedStream) {
      router.push({
        pathname: '/player',
        params: {
          media: JSON.stringify(media),
          stream: JSON.stringify(selectedStream),
          episode: ep ? JSON.stringify(ep) : undefined,
        },
      });
    }
  };

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
            style={[styles.playBtn, resolving && { opacity: 0.6 }]}
            disabled={resolving || !selectedStream}
            onPress={() => handlePlay()}
          >
            {resolving ? (
              <ActivityIndicator color="#000" />
            ) : (
              <Text style={styles.playText}>Watch Now ▶</Text>
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
    fontSize: 16,
    fontWeight: '700',
  },
  description: {
    color: '#a1a1aa',
    fontSize: 14,
    lineHeight: 20,
    marginTop: 16,
  },
  episodesHeader: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 10,
  },
  epRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderColor: '#27272a',
  },
  epTitle: {
    color: '#f4f4f5',
    fontSize: 14,
    fontWeight: '600',
  },
  epPlayIcon: {
    color: '#06b6d4',
    fontWeight: '700',
  },
});

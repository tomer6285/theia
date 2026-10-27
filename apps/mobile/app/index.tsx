import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TextInput,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  StyleSheet,
  SafeAreaView,
} from 'react-native';
import { useRouter } from 'expo-router';
import { MediaItem, cinemeta, theiaStore } from '@theia/core';

export default function HomeScreen() {
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [popularMovies, setPopularMovies] = useState<MediaItem[]>([]);
  const [popularSeries, setPopularSeries] = useState<MediaItem[]>([]);
  const [searchResults, setSearchResults] = useState<MediaItem[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    async function loadData() {
      setLoading(true);
      const [movies, series] = await Promise.all([
        cinemeta.getPopular('movie', 0),
        cinemeta.getPopular('series', 0),
      ]);
      setPopularMovies(movies);
      setPopularSeries(series);
      setLoading(false);
    }
    loadData();
  }, []);

  useEffect(() => {
    if (!query.trim()) {
      setSearchResults([]);
      return;
    }
    const timer = setTimeout(async () => {
      setLoading(true);
      const res = await cinemeta.search(query);
      setSearchResults(res);
      setLoading(false);
    }, 400);

    return () => clearTimeout(timer);
  }, [query]);

  const handleSelectMedia = (item: MediaItem) => {
    router.push({
      pathname: '/media/[id]',
      params: { id: item.id, item: JSON.stringify(item) },
    });
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.logoBadge}>
          <Text style={styles.logoText}>T</Text>
        </View>
        <Text style={styles.headerTitle}>
          The<Text style={{ color: '#06b6d4' }}>ia</Text>
        </Text>
      </View>

      {/* Search Input */}
      <View style={styles.searchContainer}>
        <TextInput
          style={styles.searchInput}
          placeholder="Search movies, shows..."
          placeholderTextColor="#71717a"
          value={query}
          onChangeText={setQuery}
        />
        {query.length > 0 && (
          <TouchableOpacity onPress={() => setQuery('')}>
            <Text style={{ color: '#a1a1aa', fontSize: 16 }}>✕</Text>
          </TouchableOpacity>
        )}
      </View>

      {loading && (
        <View style={styles.loader}>
          <ActivityIndicator size="large" color="#06b6d4" />
        </View>
      )}

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Search Results */}
        {query.trim().length > 0 && !loading && (
          <View>
            <Text style={styles.sectionTitle}>
              Results ({searchResults.length})
            </Text>
            <View style={styles.grid}>
              {searchResults.map((item) => (
                <TouchableOpacity
                  key={item.id}
                  style={styles.card}
                  onPress={() => handleSelectMedia(item)}
                >
                  <Image
                    source={{ uri: item.poster || item.background }}
                    style={styles.poster}
                  />
                  <Text style={styles.cardTitle} numberOfLines={1}>
                    {item.title}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        )}

        {/* Discovery Sections */}
        {!query.trim() && (
          <>
            {/* Trending Movies */}
            <Text style={styles.sectionTitle}>🔥 Trending Movies</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.carousel}>
              {popularMovies.slice(0, 15).map((item) => (
                <TouchableOpacity
                  key={item.id}
                  style={styles.carouselCard}
                  onPress={() => handleSelectMedia(item)}
                >
                  <Image
                    source={{ uri: item.poster || item.background }}
                    style={styles.carouselPoster}
                  />
                  <Text style={styles.cardTitle} numberOfLines={1}>
                    {item.title}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            {/* Popular Series */}
            <Text style={[styles.sectionTitle, { marginTop: 24 }]}>📺 Popular Series</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.carousel}>
              {popularSeries.slice(0, 15).map((item) => (
                <TouchableOpacity
                  key={item.id}
                  style={styles.carouselCard}
                  onPress={() => handleSelectMedia(item)}
                >
                  <Image
                    source={{ uri: item.poster || item.background }}
                    style={styles.carouselPoster}
                  />
                  <Text style={styles.cardTitle} numberOfLines={1}>
                    {item.title}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#09090b',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  logoBadge: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: '#06b6d4',
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoText: {
    fontSize: 16,
    fontWeight: '900',
    color: '#000',
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: '#fff',
  },
  searchContainer: {
    marginHorizontal: 20,
    marginVertical: 10,
    backgroundColor: '#18181b',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#27272a',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    height: 46,
  },
  searchInput: {
    flex: 1,
    color: '#fff',
    fontSize: 15,
  },
  loader: {
    padding: 20,
    alignItems: 'center',
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 40,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#fff',
    marginBottom: 12,
  },
  carousel: {
    marginHorizontal: -20,
    paddingHorizontal: 20,
  },
  carouselCard: {
    width: 140,
    marginRight: 14,
  },
  carouselPoster: {
    width: 140,
    height: 210,
    borderRadius: 12,
    backgroundColor: '#1c1c22',
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 14,
    justifyContent: 'space-between',
  },
  card: {
    width: '47%',
    marginBottom: 14,
  },
  poster: {
    width: '100%',
    aspectRatio: 2 / 3,
    borderRadius: 12,
    backgroundColor: '#1c1c22',
  },
  cardTitle: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '600',
    marginTop: 6,
  },
});

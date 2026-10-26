import React, { useState, useEffect } from 'react';
import { MediaItem, cinemeta, dionStore } from '@dion/core';
import { colors, SearchBar, TouchPill, MediaCard } from '@dion/ui';

interface DiscoverViewProps {
  onSelectMedia: (media: MediaItem) => void;
}

export const DiscoverView: React.FC<DiscoverViewProps> = ({ onSelectMedia }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'movie' | 'series'>('all');
  const [popularMovies, setPopularMovies] = useState<MediaItem[]>([]);
  const [popularSeries, setPopularSeries] = useState<MediaItem[]>([]);
  const [searchResults, setSearchResults] = useState<MediaItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  // Fetch initial popular items
  useEffect(() => {
    let isMounted = true;
    async function fetchPopular() {
      setIsLoading(true);
      const [movies, series] = await Promise.all([
        cinemeta.getPopular('movie', 0),
        cinemeta.getPopular('series', 0),
      ]);
      if (isMounted) {
        setPopularMovies(movies);
        setPopularSeries(series);
        setIsLoading(false);
      }
    }
    fetchPopular();
    return () => {
      isMounted = false;
    };
  }, []);

  // Handle search query changes
  useEffect(() => {
    let isMounted = true;
    async function performSearch() {
      if (!searchQuery.trim()) {
        setSearchResults([]);
        return;
      }
      setIsLoading(true);
      const results = await cinemeta.search(
        searchQuery,
        filterType === 'all' ? undefined : filterType
      );
      if (isMounted) {
        setSearchResults(results);
        setIsLoading(false);
      }
    }
    performSearch();
    return () => {
      isMounted = false;
    };
  }, [searchQuery, filterType]);

  const hasSearch = searchQuery.trim().length > 0;

  return (
    <div style={{ padding: '16px 20px 100px 20px', display: 'flex', flexDirection: 'column', gap: 24 }}>
      {/* Top Header & Search Bar */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div
              style={{
                width: 32,
                height: 32,
                borderRadius: 8,
                background: 'linear-gradient(135deg, #06b6d4, #8b5cf6)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontWeight: 900,
                color: '#000',
                fontSize: '16px',
              }}
            >
              D
            </div>
            <h1 style={{ margin: 0, fontSize: '22px', fontWeight: 800, color: '#fff' }}>
              Dion <span style={{ color: colors.accent.primary }}>Touch</span>
            </h1>
          </div>
        </div>

        <SearchBar
          onSearch={(q) => setSearchQuery(q)}
          placeholder="Search movies, series, anime..."
        />

        {/* Filter Pills */}
        <div style={{ display: 'flex', gap: 8, overflowX: 'auto', scrollbarWidth: 'none', paddingBottom: 2 }}>
          <TouchPill
            label="All"
            size="sm"
            active={filterType === 'all'}
            onClick={() => setFilterType('all')}
          />
          <TouchPill
            label="Movies"
            size="sm"
            active={filterType === 'movie'}
            onClick={() => setFilterType('movie')}
          />
          <TouchPill
            label="Series"
            size="sm"
            active={filterType === 'series'}
            onClick={() => setFilterType('series')}
          />
        </div>
      </div>

      {/* Loading state */}
      {isLoading && (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '40px 0' }}>
          <div
            style={{
              width: 36,
              height: 36,
              borderRadius: '50%',
              border: `3px solid ${colors.border.subtle}`,
              borderTopColor: colors.accent.primary,
              animation: 'spin 0.8s linear infinite',
            }}
          />
        </div>
      )}

      {/* Search Results Grid */}
      {hasSearch && !isLoading && (
        <div>
          <h2 style={{ fontSize: '18px', fontWeight: 700, margin: '0 0 16px 0', color: '#fff' }}>
            Results for &ldquo;{searchQuery}&rdquo; ({searchResults.length})
          </h2>
          {searchResults.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px 0', color: colors.text.muted }}>
              No media found matching &ldquo;{searchQuery}&rdquo;. Try another title.
            </div>
          ) : (
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))',
                gap: 16,
              }}
            >
              {searchResults.map((item) => (
                <MediaCard
                  key={item.id}
                  media={item}
                  width="100%"
                  onPress={() => onSelectMedia(item)}
                  progress={dionStore.getState().getProgress(item.id)}
                  isFavorite={dionStore.getState().isFavorite(item.id)}
                  onToggleFavorite={() => dionStore.getState().toggleFavorite(item)}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* Default Discovery Sections (when not searching) */}
      {!hasSearch && (
        <>
          {/* Trending Movies Horizontal Carousel */}
          {popularMovies.length > 0 && (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
                <h2 style={{ fontSize: '18px', fontWeight: 700, margin: 0, color: '#fff' }}>
                  🔥 Trending Movies
                </h2>
              </div>
              <div
                style={{
                  display: 'flex',
                  gap: 14,
                  overflowX: 'auto',
                  scrollbarWidth: 'none',
                  paddingBottom: 8,
                }}
              >
                {popularMovies.slice(0, 15).map((item) => (
                  <MediaCard
                    key={item.id}
                    media={item}
                    width={150}
                    onPress={() => onSelectMedia(item)}
                    progress={dionStore.getState().getProgress(item.id)}
                    isFavorite={dionStore.getState().isFavorite(item.id)}
                    onToggleFavorite={() => dionStore.getState().toggleFavorite(item)}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Popular TV Series Horizontal Carousel */}
          {popularSeries.length > 0 && (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
                <h2 style={{ fontSize: '18px', fontWeight: 700, margin: 0, color: '#fff' }}>
                  📺 Popular Series
                </h2>
              </div>
              <div
                style={{
                  display: 'flex',
                  gap: 14,
                  overflowX: 'auto',
                  scrollbarWidth: 'none',
                  paddingBottom: 8,
                }}
              >
                {popularSeries.slice(0, 15).map((item) => (
                  <MediaCard
                    key={item.id}
                    media={item}
                    width={150}
                    onPress={() => onSelectMedia(item)}
                    progress={dionStore.getState().getProgress(item.id)}
                    isFavorite={dionStore.getState().isFavorite(item.id)}
                    onToggleFavorite={() => dionStore.getState().toggleFavorite(item)}
                  />
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
};

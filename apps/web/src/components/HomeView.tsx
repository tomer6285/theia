import { useWatchState } from '@theia/ui';
import React, { useState, useEffect } from 'react';
import { MediaItem, cinemeta, theiaStore } from '@theia/core';
import { colors, SearchBar, MediaCard } from '@theia/ui';

interface HomeViewProps {
  onSelectMedia?: (media: MediaItem) => void;
  onQuickPlay?: (media: MediaItem) => void;
}

export const HomeView: React.FC<HomeViewProps> = ({ onSelectMedia, onQuickPlay }) => {
  useWatchState();
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<MediaItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    let isMounted = true;
    async function performSearch() {
      const q = searchQuery.trim();
      if (!q) {
        setSearchResults([]);
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      const results = await cinemeta.search(q);
      if (isMounted) {
        setSearchResults(results);
        setIsLoading(false);
      }
    }
    performSearch();
    return () => {
      isMounted = false;
    };
  }, [searchQuery]);

  const hasSearch = searchQuery.trim().length > 0;

  return (
    <div
      style={{
        minHeight: '100dvh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: hasSearch ? 'flex-start' : 'center',
        padding: hasSearch ? '40px 20px 110px 20px' : '0 20px 100px 20px',
        position: 'relative',
        userSelect: 'none',
        WebkitUserSelect: 'none',
        transition: 'padding 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
      }}
    >
      {/* Sleek ambient glow */}
      <div
        style={{
          position: 'absolute',
          top: hasSearch ? '15%' : '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          width: 360,
          height: 360,
          borderRadius: '50%',
          background:
            'radial-gradient(circle, rgba(6, 182, 212, 0.18) 0%, rgba(139, 92, 246, 0.08) 50%, transparent 70%)',
          filter: 'blur(60px)',
          pointerEvents: 'none',
          transition: 'top 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
        }}
      />

      {/* Brand logo, site name of Theia, and Search Bar */}
      <div
        style={{
          width: '100%',
          maxWidth: 480,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: hasSearch ? 14 : 20,
          zIndex: 1,
          transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
        }}
      >
        <div
          style={{
            width: hasSearch ? 58 : 80,
            height: hasSearch ? 58 : 80,
            borderRadius: hasSearch ? 18 : 24,
            background: 'linear-gradient(135deg, #06b6d4, #8b5cf6)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontWeight: 900,
            color: '#000',
            fontSize: hasSearch ? '28px' : '40px',
            boxShadow: '0 0 45px rgba(6, 182, 212, 0.45)',
            transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
          }}
        >
          T
        </div>

        <h1
          style={{
            margin: 0,
            fontSize: hasSearch ? '38px' : '52px',
            fontWeight: 900,
            color: '#ffffff',
            letterSpacing: '-1.5px',
            lineHeight: 1,
            transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
          }}
        >
          The<span style={{ color: colors.accent.primary }}>ia</span>
        </h1>

        <p style={{ color: colors.text.secondary, textAlign: 'center', lineHeight: 1.6 }}>
          Find a film. Start a series. Pick up where you left off.
        </p>
        {/* Search Bar directly under logo and name */}
        <div style={{ width: '100%', marginTop: hasSearch ? 4 : 10 }}>
          <SearchBar
            initialValue={searchQuery}
            onSearch={(q) => setSearchQuery(q)}
            placeholder="Search movies, series, titles..."
          />
        </div>
      </div>

      {/* Loading state */}
      {isLoading && (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '40px 0', zIndex: 1 }}>
          <div
            style={{
              width: 44,
              height: 44,
              borderRadius: '50%',
              border: `3px solid ${colors.border.subtle}`,
              borderTopColor: colors.accent.primary,
              animation: 'spin 0.8s linear infinite',
            }}
          />
        </div>
      )}

      {/* Search results grid */}
      {hasSearch && !isLoading && (
        <div aria-live="polite" style={{ width: '100%', maxWidth: 960, marginTop: 28, zIndex: 1 }}>
          <h2 style={{ fontSize: '18px', fontWeight: 800, margin: '0 0 16px 0', color: '#fff' }}>
            Results ({searchResults.length})
          </h2>

          {searchResults.length === 0 ? (
            <div
              style={{
                textAlign: 'center',
                padding: '50px 20px',
                backgroundColor: colors.bg.surface,
                borderRadius: 20,
                border: `1.5px solid ${colors.border.subtle}`,
                color: colors.text.muted,
              }}
            >
              <div style={{ fontSize: '32px', marginBottom: 8 }}>🔍</div>
              No media found matching &ldquo;{searchQuery}&rdquo;.
            </div>
          ) : (
            <div className="media-grid">
              {searchResults.map((item) => (
                <MediaCard
                  key={item.id}
                  media={item}
                  width="100%"
                  onPress={() => onSelectMedia?.(item)}
                  onQuickPlay={onQuickPlay}
                  progress={theiaStore.getState().getProgress(item.id)}
                  isFavorite={theiaStore.getState().isFavorite(item.id)}
                  onToggleFavorite={() => theiaStore.getState().toggleFavorite(item)}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

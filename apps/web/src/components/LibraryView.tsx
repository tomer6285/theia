import React, { useState } from 'react';
import { dionStore, MediaItem } from '@dion/core';
import { colors, TouchPill, MediaCard } from '@dion/ui';

interface LibraryViewProps {
  onSelectMedia: (media: MediaItem) => void;
}

export const LibraryView: React.FC<LibraryViewProps> = ({ onSelectMedia }) => {
  const [activeTab, setActiveTab] = useState<'favorites' | 'history'>('favorites');
  const [, setTick] = useState(0); // For forcing re-render on state changes

  const favorites = dionStore.getState().favorites;
  const history = dionStore.getState().history;

  return (
    <div style={{ padding: '20px 20px 100px 20px', display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1 style={{ margin: '0 0 6px 0', fontSize: '24px', fontWeight: 800, color: '#fff' }}>
            📚 Library & History
          </h1>
          <p style={{ margin: 0, fontSize: '14px', color: colors.text.muted }}>
            Your saved favorites and complete playback history
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', gap: 8 }}>
          <TouchPill
            label="Favorites"
            badge={favorites.length}
            active={activeTab === 'favorites'}
            onClick={() => setActiveTab('favorites')}
          />
          <TouchPill
            label="History"
            badge={history.length}
            active={activeTab === 'history'}
            onClick={() => setActiveTab('history')}
          />
        </div>

        {activeTab === 'history' && history.length > 0 && (
          <button
            type="button"
            onClick={() => {
              if (window.confirm('Clear all playback history?')) {
                dionStore.getState().clearHistory();
                setTick((t) => t + 1);
              }
            }}
            style={{
              background: 'none',
              border: 'none',
              color: colors.status.danger,
              fontSize: '13px',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            Clear History
          </button>
        )}
      </div>

      {/* Favorites Tab Content */}
      {activeTab === 'favorites' && (
        <>
          {favorites.length === 0 ? (
            <div
              style={{
                textAlign: 'center',
                padding: '60px 20px',
                backgroundColor: colors.bg.surface,
                borderRadius: 20,
                border: `1px solid ${colors.border.subtle}`,
              }}
            >
              <span style={{ fontSize: '36px', display: 'block', marginBottom: 10 }}>♥</span>
              <h3 style={{ margin: '0 0 6px 0', color: '#fff' }}>No Favorites Yet</h3>
              <p style={{ margin: 0, color: colors.text.muted, fontSize: '14px' }}>
                Tap the heart icon on any movie or series to bookmark it here.
              </p>
            </div>
          ) : (
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))',
                gap: 16,
              }}
            >
              {favorites.map((item) => (
                <MediaCard
                  key={item.id}
                  media={item}
                  width="100%"
                  onPress={() => onSelectMedia(item)}
                  progress={dionStore.getState().getProgress(item.id)}
                  isFavorite={true}
                  onToggleFavorite={() => {
                    dionStore.getState().toggleFavorite(item);
                    setTick((t) => t + 1);
                  }}
                />
              ))}
            </div>
          )}
        </>
      )}

      {/* History Tab Content */}
      {activeTab === 'history' && (
        <>
          {history.length === 0 ? (
            <div
              style={{
                textAlign: 'center',
                padding: '60px 20px',
                backgroundColor: colors.bg.surface,
                borderRadius: 20,
                border: `1px solid ${colors.border.subtle}`,
              }}
            >
              <span style={{ fontSize: '36px', display: 'block', marginBottom: 10 }}>📜</span>
              <h3 style={{ margin: '0 0 6px 0', color: '#fff' }}>History Empty</h3>
              <p style={{ margin: 0, color: colors.text.muted, fontSize: '14px' }}>
                Your watched videos will be logged here with timestamps.
              </p>
            </div>
          ) : (
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))',
                gap: 16,
              }}
            >
              {history.map(({ media, progress }) => (
                <MediaCard
                  key={progress.episodeId || media.id}
                  media={media}
                  width="100%"
                  onPress={() => onSelectMedia(media)}
                  progress={progress}
                  isFavorite={dionStore.getState().isFavorite(media.id)}
                  onToggleFavorite={() => {
                    dionStore.getState().toggleFavorite(media);
                    setTick((t) => t + 1);
                  }}
                />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
};

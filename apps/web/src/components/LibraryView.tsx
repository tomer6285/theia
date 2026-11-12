import { useWatchState } from '@theia/ui';
import React, { useState } from 'react';
import { theiaStore, MediaItem } from '@theia/core';
import { colors, TouchPill, MediaCard } from '@theia/ui';

interface LibraryViewProps {
  onSelectMedia: (media: MediaItem, episodeId?: string) => void;
  onQuickPlay?: (media: MediaItem) => void;
}

export const LibraryView: React.FC<LibraryViewProps> = ({ onSelectMedia, onQuickPlay }) => {
  useWatchState();
  const [activeTab, setActiveTab] = useState<'favorites' | 'history'>('favorites');

  const favorites = theiaStore.getState().favorites;
  const history = theiaStore.getState().history;

  return (
    <div style={{ padding: '20px 20px 110px 20px', display: 'flex', flexDirection: 'column', gap: 24 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1 style={{ margin: '0 0 6px 0', fontSize: '26px', fontWeight: 900, color: '#fff', letterSpacing: '-0.5px' }}>
            📚 Library & History
          </h1>
          <p style={{ margin: 0, fontSize: '14px', color: colors.text.muted }}>
            Your saved bookmarks and complete playback history
          </p>
        </div>
      </div>

      {/* Segmented Control Tabs */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', gap: 10 }}>
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
                theiaStore.getState().clearHistory();
              }
            }}
            style={{
              background: 'none',
              border: `1px solid ${colors.status.danger}44`,
              padding: '8px 14px',
              borderRadius: 12,
              color: colors.status.danger,
              fontSize: '13px',
              fontWeight: 700,
              cursor: 'pointer',
              touchAction: 'manipulation',
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
                padding: '80px 20px',
                backgroundColor: colors.bg.surface,
                borderRadius: 24,
                border: `1.5px solid ${colors.border.subtle}`,
              }}
            >
              <span style={{ fontSize: '44px', display: 'block', marginBottom: 12, color: '#ef4444' }}>♥</span>
              <h3 style={{ margin: '0 0 6px 0', color: '#fff', fontSize: '20px', fontWeight: 800 }}>No Favorites Yet</h3>
              <p style={{ margin: 0, color: colors.text.muted, fontSize: '14px', maxWidth: 300, marginInline: 'auto' }}>
                Tap the heart icon on any movie or series to bookmark it here for quick access.
              </p>
            </div>
          ) : (
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))',
                gap: 18,
              }}
            >
              {favorites.map((item) => (
                <MediaCard
                  key={item.id}
                  media={item}
                  width="100%"
                  onPress={() => onSelectMedia(item)}
                  onQuickPlay={onQuickPlay}
                  progress={theiaStore.getState().getProgress(item.id)}
                  isFavorite={true}
                  onToggleFavorite={() => {
                    theiaStore.getState().toggleFavorite(item);
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
                padding: '80px 20px',
                backgroundColor: colors.bg.surface,
                borderRadius: 24,
                border: `1.5px solid ${colors.border.subtle}`,
              }}
            >
              <span style={{ fontSize: '44px', display: 'block', marginBottom: 12 }}>📜</span>
              <h3 style={{ margin: '0 0 6px 0', color: '#fff', fontSize: '20px', fontWeight: 800 }}>History Empty</h3>
              <p style={{ margin: 0, color: colors.text.muted, fontSize: '14px', maxWidth: 300, marginInline: 'auto' }}>
                Your watched videos will be logged here with timestamps and progress bars.
              </p>
            </div>
          ) : (
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))',
                gap: 18,
              }}
            >
              {history.map(({ media, progress }) => (
                <div key={`${media.id}:${progress.episodeId || ''}`} style={{ minWidth: 0 }}>
                  <MediaCard
                    media={media}
                    width="100%"
                    onPress={() => onSelectMedia(media, progress.episodeId)}
                    onQuickPlay={() => onSelectMedia(media, progress.episodeId)}
                    progress={progress}
                    isFavorite={theiaStore.getState().isFavorite(media.id)}
                    onToggleFavorite={() => {
                      theiaStore.getState().toggleFavorite(media);
                    }}
                  />
                  <button
                    type="button"
                    aria-label={`Remove ${media.title}${progress.episodeId ? ` episode ${progress.episodeId}` : ''} from History`}
                    onClick={() => theiaStore.getState().removeHistoryEntry(media.id, progress.episodeId)}
                    style={{ background: 'none', border: 'none', color: colors.status.danger,
                      minHeight: 44, cursor: 'pointer', padding: '8px 0' }}
                  >
                    Remove from History
                  </button>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
};

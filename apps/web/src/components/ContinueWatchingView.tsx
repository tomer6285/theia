import React from 'react';
import { theiaStore, MediaItem } from '@theia/core';
import { colors, MediaCard } from '@theia/ui';

interface ContinueWatchingViewProps {
  onSelectMedia: (media: MediaItem) => void;
}

export const ContinueWatchingView: React.FC<ContinueWatchingViewProps> = ({ onSelectMedia }) => {
  const history = theiaStore.getState().history;
  const inProgress = history.filter((h) => !h.progress.completed && h.progress.percentage > 1);

  return (
    <div style={{ padding: '20px 20px 100px 20px', display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div>
        <h1 style={{ margin: '0 0 6px 0', fontSize: '24px', fontWeight: 800, color: '#fff' }}>
          ⏱️ Continue Watching
        </h1>
        <p style={{ margin: 0, fontSize: '14px', color: colors.text.muted }}>
          Pick up right where you left off across your devices
        </p>
      </div>

      {inProgress.length === 0 ? (
        <div
          style={{
            textAlign: 'center',
            padding: '80px 20px',
            backgroundColor: colors.bg.surface,
            borderRadius: 20,
            border: `1px solid ${colors.border.subtle}`,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 12,
          }}
        >
          <span style={{ fontSize: '40px' }}>🎬</span>
          <h3 style={{ margin: 0, fontSize: '18px', color: '#fff', fontWeight: 700 }}>
            No unwatched titles in progress
          </h3>
          <p style={{ margin: 0, fontSize: '14px', color: colors.text.muted, maxWidth: 300 }}>
            Start watching any movie or series from Discover, and it will automatically appear here.
          </p>
        </div>
      ) : (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))',
            gap: 18,
          }}
        >
          {inProgress.map(({ media, progress }) => (
            <div key={progress.episodeId || media.id} style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <MediaCard
                media={media}
                width="100%"
                onPress={() => onSelectMedia(media)}
                progress={progress}
                isFavorite={theiaStore.getState().isFavorite(media.id)}
                onToggleFavorite={() => theiaStore.getState().toggleFavorite(media)}
              />
              {progress.episode && (
                <span style={{ fontSize: '12px', color: colors.accent.primary, fontWeight: 600 }}>
                  S{progress.season}:E{progress.episode}
                </span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

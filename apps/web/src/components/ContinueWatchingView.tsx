import { useWatchState } from '@theia/ui';
import React from 'react';
import { theiaStore, MediaItem, getContinueWatching } from '@theia/core';
import { colors, MediaCard } from '@theia/ui';

interface ContinueWatchingViewProps {
  onSelectMedia: (media: MediaItem, episodeId?: string) => void;
  onQuickPlay?: (media: MediaItem, episodeId?: string) => void;
}

export const ContinueWatchingView: React.FC<ContinueWatchingViewProps> = ({ onSelectMedia, onQuickPlay }) => {
  useWatchState();
  const history = theiaStore.getState().history;
  const inProgress = getContinueWatching(history);

  const formatRemaining = (durationSecs: number, posSecs: number) => {
    const remaining = Math.max(0, durationSecs - posSecs);
    const mins = Math.round(remaining / 60);
    if (mins >= 60) {
      const h = Math.floor(mins / 60);
      const m = mins % 60;
      return `${h}h ${m}m left`;
    }
    return `${mins}m left`;
  };

  return (
    <div style={{ padding: '20px 20px 110px 20px', display: 'flex', flexDirection: 'column', gap: 24 }}>
      <div>
        <h1 style={{ margin: '0 0 6px 0', fontSize: '26px', fontWeight: 900, color: '#fff', letterSpacing: '-0.5px' }}>
          ⏱️ Continue Watching
        </h1>
        <p style={{ margin: 0, fontSize: '14px', color: colors.text.muted }}>
          Pick up right where you left off with a single tap
        </p>
      </div>

      {inProgress.length === 0 ? (
        <div
          style={{
            textAlign: 'center',
            padding: '80px 20px',
            backgroundColor: colors.bg.surface,
            borderRadius: 24,
            border: `1.5px solid ${colors.border.subtle}`,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 14,
          }}
        >
          <span style={{ fontSize: '48px' }}>🎬</span>
          <h3 style={{ margin: 0, fontSize: '20px', color: '#fff', fontWeight: 800 }}>
            No unwatched titles in progress
          </h3>
          <p style={{ margin: 0, fontSize: '14px', color: colors.text.muted, maxWidth: 320, lineHeight: 1.5 }}>
            Movies and shows watched on supported servers save their progress here.
          </p>
        </div>
      ) : (
        <div className="media-grid">
          {inProgress.map(({ media, progress, nextEpisode }) => (
            <div key={progress.episodeId || media.id} style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <MediaCard
                media={media}
                width="100%"
                onPress={() => (onQuickPlay || onSelectMedia)(media, nextEpisode?.id || progress.episodeId)}
                onQuickPlay={() => (onQuickPlay || onSelectMedia)(media, nextEpisode?.id || progress.episodeId)}
                progress={nextEpisode ? undefined : progress}
                isFavorite={theiaStore.getState().isFavorite(media.id)}
                onToggleFavorite={() => theiaStore.getState().toggleFavorite(media)}
              />
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0 4px' }}>
                {nextEpisode ? <span style={{ color: colors.accent.primary }}>Up next · S{nextEpisode.season}:E{nextEpisode.episode}</span> : progress.episode ? (
                  <span style={{ fontSize: '13px', color: colors.accent.primary, fontWeight: 700 }}>
                    S{progress.season}:E{progress.episode}
                  </span>
                ) : (
                  <span style={{ fontSize: '12px', color: colors.text.muted, fontWeight: 600 }}>
                    {Math.round(progress.percentage)}%
                  </span>
                )}
                {!nextEpisode && progress.durationSeconds > 0 && (
                  <span style={{ fontSize: '12px', color: colors.text.muted }}>
                    {formatRemaining(progress.durationSeconds, progress.positionSeconds)}
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

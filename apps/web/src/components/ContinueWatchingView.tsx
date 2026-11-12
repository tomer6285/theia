import { useWatchState } from '@theia/ui';
import React, { useEffect, useState } from 'react';
import { theiaStore, MediaItem, getContinueWatching, CONTINUE_WATCHING_MAX_AGE_MS } from '@theia/core';
import { colors, MediaCard } from '@theia/ui';

const optionStyle: React.CSSProperties = {
  background: 'none', border: 'none', color: colors.text.primary, textAlign: 'left',
  padding: '10px 8px', minHeight: 44, cursor: 'pointer', fontSize: 12,
};

interface ContinueWatchingViewProps {
  onSelectMedia: (media: MediaItem, episodeId?: string) => void;
  onQuickPlay?: (media: MediaItem, episodeId?: string) => void;
}

export const ContinueWatchingView: React.FC<ContinueWatchingViewProps> = ({ onSelectMedia, onQuickPlay }) => {
  useWatchState();
  const history = theiaStore.getState().history;
  const [now, setNow] = useState(Date.now);
  const inProgress = getContinueWatching(history, Math.max(now, Date.now()));

  useEffect(() => {
    const refresh = () => setNow(Date.now());
    window.addEventListener('focus', refresh);
    document.addEventListener('visibilitychange', refresh);
    // Schedule the nearest expiry; cap delays to the browser's signed 32-bit limit.
    const expiresAt = history.map(item => item.lastWatchedAt + CONTINUE_WATCHING_MAX_AGE_MS + 1)
      .filter(time => time > now).sort((a, b) => a - b)[0];
    const timer = expiresAt === undefined ? undefined
      : window.setTimeout(refresh, Math.min(Math.max(1, expiresAt - Date.now()), 2_147_483_647));
    return () => {
      window.removeEventListener('focus', refresh);
      document.removeEventListener('visibilitychange', refresh);
      if (timer !== undefined) window.clearTimeout(timer);
    };
  }, [history, now]);

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
          Continue Watching
        </h1>
        <p style={{ margin: 0, fontSize: '14px', color: colors.text.secondary }}>
          Pick up where you left off on titles watched in the past 60 days.
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
          <p style={{ margin: 0, fontSize: '14px', color: colors.text.secondary, maxWidth: 320, lineHeight: 1.5 }}>
            Movies and shows watched on supported servers save their progress here.
          </p>
        </div>
      ) : (
        <div className="media-grid">
          {inProgress.map(({ media, progress, nextEpisode }) => {
            const episodeId = nextEpisode?.id || progress.episodeId;
            const episode = nextEpisode || media.episodes?.find((item) => item.id === progress.episodeId);
            const season = nextEpisode?.season ?? progress.season;
            const episodeNumber = nextEpisode?.episode ?? progress.episode;
            const episodeLabel = season !== undefined && episodeNumber !== undefined
              ? `S${season} E${episodeNumber}` : '';
            const percentage = nextEpisode ? 0 : Math.min(100, Math.max(0, progress.percentage));
            const resume = () => (onQuickPlay || onSelectMedia)(media, episodeId);
            const isFavorite = theiaStore.getState().isFavorite(media.id);
            return (
              <div key={media.id} style={{ display: 'flex', flexDirection: 'column', gap: 10, minWidth: 0 }}>
                <MediaCard media={media} variant="continue" width="100%"
                  onPress={() => onSelectMedia(media, episodeId)} />
                {episode?.title && (
                  <div style={{ fontSize: 13, color: colors.text.secondary }}>{episode.title}</div>
                )}
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, fontSize: 12, color: colors.text.secondary }}>
                  <span>{nextEpisode ? 'Up next' : episodeLabel || `${Math.round(percentage)}% watched`}</span>
                  {!nextEpisode && progress.durationSeconds > 0 && (
                    <span>{formatRemaining(progress.durationSeconds, progress.positionSeconds)}</span>
                  )}
                </div>
                <div role="progressbar" aria-label={`${media.title} playback progress`}
                  aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(percentage)}
                  style={{ height: 4, borderRadius: 2, overflow: 'hidden', backgroundColor: colors.border.default }}>
                  <div style={{ height: '100%', width: `${percentage}%`, backgroundColor: colors.accent.primary }} />
                </div>
                <button type="button" onClick={resume}
                  aria-label={`${nextEpisode ? 'Play' : 'Resume'} ${media.title}${episodeLabel ? ` ${episodeLabel}` : ''}`}
                  style={{ minHeight: 44, border: 'none', borderRadius: 10, backgroundColor: colors.accent.primary,
                    color: colors.text.inverse, fontSize: 13, fontWeight: 750, cursor: 'pointer' }}>
                  <span aria-hidden="true">▶ </span>{nextEpisode ? 'Play' : 'Resume'}{episodeLabel ? ` ${episodeLabel}` : ''}
                </button>
                <details style={{ position: 'relative', fontSize: 12, color: colors.text.secondary }}>
                  <summary aria-label={`More options for ${media.title}`} style={{ cursor: 'pointer', padding: '6px 0' }}>More options</summary>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4, padding: 8,
                    backgroundColor: colors.bg.surface, border: `1px solid ${colors.border.subtle}`, borderRadius: 10 }}>
                    <button type="button" onClick={() => theiaStore.getState().toggleFavorite(media)}
                      style={optionStyle}>{isFavorite ? 'Remove from favorites' : 'Add to favorites'}</button>
                    <button type="button" onClick={() => theiaStore.getState().dismissContinueWatching(media.id)}
                      style={optionStyle}>Remove from Continue Watching</button>
                  </div>
                </details>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

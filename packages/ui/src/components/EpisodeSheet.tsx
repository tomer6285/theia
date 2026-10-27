import React, { useState, useEffect, useRef } from 'react';
import { MediaItem, Episode, SeasonInfo, WatchProgress } from '@theia/core';
import { colors } from '../theme/colors';
import { TouchPill } from './TouchPill';

export interface EpisodeSheetProps {
  media: MediaItem;
  isOpen: boolean;
  onClose: () => void;
  onSelectEpisode: (episode: Episode) => void;
  currentEpisodeId?: string;
  progressMap?: Record<string, WatchProgress>;
}

export const EpisodeSheet: React.FC<EpisodeSheetProps> = ({
  media,
  isOpen,
  onClose,
  onSelectEpisode,
  currentEpisodeId,
  progressMap = {},
}) => {
  const seasons: SeasonInfo[] = media.seasons || [];
  const [selectedSeason, setSelectedSeason] = useState<number>(
    seasons[0]?.season || 1
  );
  const activeEpisodeRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen && activeEpisodeRef.current) {
      activeEpisodeRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [isOpen, selectedSeason]);

  if (!isOpen) return null;

  const currentSeasonInfo = seasons.find((s) => s.season === selectedSeason) || seasons[0];
  const episodes = currentSeasonInfo?.episodes || media.episodes || [];

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 999,
        backgroundColor: 'rgba(0,0,0,0.7)',
        backdropFilter: 'blur(8px)',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'flex-end',
      }}
      onClick={onClose}
    >
      <div
        style={{
          backgroundColor: colors.bg.surface,
          borderTopLeftRadius: 24,
          borderTopRightRadius: 24,
          borderTop: `1px solid ${colors.border.subtle}`,
          maxHeight: '85vh',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 -10px 40px rgba(0,0,0,0.8)',
          animation: 'slideUp 0.25s ease-out',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Handle bar */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'center',
            padding: '12px 0 6px 0',
          }}
        >
          <div
            style={{
              width: 44,
              height: 5,
              borderRadius: 3,
              backgroundColor: colors.border.default,
            }}
          />
        </div>

        {/* Header */}
        <div
          style={{
            padding: '10px 20px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            borderBottom: `1px solid ${colors.border.subtle}`,
          }}
        >
          <div>
            <h3 style={{ margin: 0, fontSize: '18px', color: colors.text.primary, fontWeight: 700 }}>
              {media.title}
            </h3>
            <span style={{ fontSize: '13px', color: colors.text.muted }}>
              Episodes & Seasons
            </span>
          </div>
          <button
            type="button"
            onClick={onClose}
            style={{
              background: colors.bg.elevated,
              border: `1px solid ${colors.border.subtle}`,
              color: colors.text.secondary,
              width: 32,
              height: 32,
              borderRadius: 16,
              cursor: 'pointer',
              fontSize: '16px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            ✕
          </button>
        </div>

        {/* Season Selector Tabs */}
        {seasons.length > 1 && (
          <div
            style={{
              display: 'flex',
              gap: 8,
              padding: '14px 20px',
              overflowX: 'auto',
              borderBottom: `1px solid ${colors.border.subtle}`,
              scrollbarWidth: 'none',
            }}
          >
            {seasons.map((s) => (
              <TouchPill
                key={s.season}
                label={`Season ${s.season}`}
                active={s.season === selectedSeason}
                onClick={() => setSelectedSeason(s.season)}
                badge={s.episodes.length}
                size="sm"
              />
            ))}
          </div>
        )}

        {/* Episodes List */}
        <div
          style={{
            flex: 1,
            overflowY: 'auto',
            padding: '16px 20px',
            display: 'flex',
            flexDirection: 'column',
            gap: 12,
          }}
        >
          {episodes.map((ep) => {
            const isCurrent = ep.id === currentEpisodeId;
            const progress = progressMap[ep.id];
            const isCompleted = progress?.completed;

            return (
              <div
                key={ep.id}
                ref={isCurrent ? activeEpisodeRef : undefined}
                onClick={() => {
                  onSelectEpisode(ep);
                  onClose();
                }}
                style={{
                  display: 'flex',
                  gap: 14,
                  padding: 12,
                  borderRadius: 12,
                  backgroundColor: isCurrent ? `${colors.accent.primary}18` : colors.bg.elevated,
                  border: isCurrent
                    ? `1.5px solid ${colors.accent.primary}`
                    : `1px solid ${colors.border.subtle}`,
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                  userSelect: 'none',
                }}
              >
                {/* Thumbnail */}
                <div
                  style={{
                    position: 'relative',
                    width: 110,
                    height: 65,
                    borderRadius: 8,
                    overflow: 'hidden',
                    backgroundColor: '#000',
                    flexShrink: 0,
                  }}
                >
                  <img
                    src={
                      ep.thumbnail ||
                      media.background ||
                      media.poster ||
                      'https://via.placeholder.com/200x120/1c1c22/71717a?text=Episode'
                    }
                    alt={ep.title}
                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                  />
                  {progress && progress.percentage > 0 && (
                    <div
                      style={{
                        position: 'absolute',
                        bottom: 0,
                        left: 0,
                        right: 0,
                        height: 3,
                        backgroundColor: 'rgba(255,255,255,0.3)',
                      }}
                    >
                      <div
                        style={{
                          height: '100%',
                          width: `${progress.percentage}%`,
                          backgroundColor: colors.accent.primary,
                        }}
                      />
                    </div>
                  )}
                </div>

                {/* Info */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: 8,
                    }}
                  >
                    <span
                      style={{
                        fontSize: '14px',
                        fontWeight: 600,
                        color: isCurrent ? colors.accent.primary : colors.text.primary,
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                      }}
                    >
                      {ep.episode}. {ep.title}
                    </span>
                    {isCompleted && (
                      <span
                        style={{
                          fontSize: '11px',
                          color: colors.status.success,
                          fontWeight: 600,
                        }}
                      >
                        ✓ Watched
                      </span>
                    )}
                  </div>
                  {ep.overview && (
                    <p
                      style={{
                        margin: '4px 0 0 0',
                        fontSize: '12px',
                        color: colors.text.muted,
                        lineHeight: '1.4',
                        display: '-webkit-box',
                        WebkitLineClamp: 2,
                        WebkitBoxOrient: 'vertical',
                        overflow: 'hidden',
                      }}
                    >
                      {ep.overview}
                    </p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

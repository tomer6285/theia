import React, { useState } from 'react';
import { Episode, MediaItem, WatchProgress } from '@theia/core';
import { colors } from '../theme/colors';

export interface EpisodeCardProps {
  episode: Episode;
  media: MediaItem;
  isSelected?: boolean;
  progress?: WatchProgress;
  onSelect?: (episode: Episode) => void;
  onPlay?: (episode: Episode) => void;
}

export const EpisodeCard: React.FC<EpisodeCardProps> = ({
  episode,
  media,
  isSelected = false,
  progress,
  onSelect,
  onPlay,
}) => {
  const [isHovered, setIsHovered] = useState(false);

  const isCompleted = progress?.completed;
  const inProgress = progress && progress.percentage > 0 && !isCompleted;

  // Format release date nicely
  const formattedDate = React.useMemo(() => {
    if (!episode.released) return null;
    try {
      const d = new Date(episode.released);
      if (isNaN(d.getTime())) return null;
      return d.toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      });
    } catch {
      return null;
    }
  }, [episode.released]);

  const thumbUrl =
    episode.thumbnail ||
    media.background ||
    media.poster ||
    'https://via.placeholder.com/320x180/1c1c22/71717a?text=Episode';

  const handleCardClick = () => {
    if (onSelect) {
      onSelect(episode);
    }
  };

  const handlePlayClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onPlay) {
      onPlay(episode);
    } else if (onSelect) {
      onSelect(episode);
    }
  };

  return (
    <div
      onClick={handleCardClick}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          handleCardClick();
        }
      }}
      style={{
        display: 'flex',
        flexDirection: 'row',
        alignItems: 'stretch',
        gap: 16,
        padding: 12,
        borderRadius: 16,
        backgroundColor: isSelected
          ? 'rgba(6, 182, 212, 0.08)'
          : isHovered
          ? colors.bg.elevated
          : 'rgba(28, 28, 34, 0.6)',
        border: isSelected
          ? `1.5px solid ${colors.accent.primary}`
          : isHovered
          ? `1.5px solid ${colors.border.default}`
          : `1.5px solid ${colors.border.subtle}`,
        boxShadow: isSelected
          ? `0 0 20px ${colors.accent.primary}33`
          : isHovered
          ? '0 6px 20px rgba(0,0,0,0.5)'
          : 'none',
        cursor: 'pointer',
        transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
        outline: 'none',
        userSelect: 'none',
        WebkitTapHighlightColor: 'transparent',
      }}
    >
      {/* 16:9 Thumbnail Area */}
      <div
        onClick={handlePlayClick}
        style={{
          position: 'relative',
          width: 160,
          minWidth: 160,
          aspectRatio: '16/9',
          borderRadius: 12,
          overflow: 'hidden',
          backgroundColor: '#0c0c0e',
          flexShrink: 0,
          boxShadow: '0 4px 12px rgba(0,0,0,0.4)',
        }}
      >
        <img
          src={thumbUrl}
          alt={episode.title}
          loading="lazy"
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            transform: isHovered ? 'scale(1.05)' : 'scale(1)',
            transition: 'transform 0.3s ease',
          }}
        />

        {/* Gradient shadow overlay */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            background: 'linear-gradient(to top, rgba(0,0,0,0.7) 0%, transparent 60%)',
          }}
        />

        {/* Episode Number Pill in Top-Left */}
        <div
          style={{
            position: 'absolute',
            top: 6,
            left: 6,
            padding: '2px 7px',
            borderRadius: 6,
            backgroundColor: 'rgba(0, 0, 0, 0.75)',
            backdropFilter: 'blur(8px)',
            border: '1px solid rgba(255, 255, 255, 0.15)',
            fontSize: '11px',
            fontWeight: 800,
            color: '#fff',
            letterSpacing: '0.4px',
          }}
        >
          E{episode.episode}
        </div>

        {/* Watched Badge in Top-Right */}
        {isCompleted && (
          <div
            style={{
              position: 'absolute',
              top: 6,
              right: 6,
              padding: '2px 7px',
              borderRadius: 6,
              backgroundColor: 'rgba(16, 185, 129, 0.85)',
              backdropFilter: 'blur(8px)',
              fontSize: '10px',
              fontWeight: 800,
              color: '#fff',
              display: 'flex',
              alignItems: 'center',
              gap: 3,
            }}
          >
            <span>✓</span>
            <span>WATCHED</span>
          </div>
        )}

        {/* Center Play Button Overlay on Hover/Selected */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: isHovered ? 'rgba(0,0,0,0.35)' : 'transparent',
            transition: 'background-color 0.2s ease',
          }}
        >
          <div
            style={{
              width: 38,
              height: 38,
              borderRadius: 19,
              backgroundColor: isSelected
                ? colors.accent.primary
                : isHovered
                ? 'rgba(255, 255, 255, 0.95)'
                : 'rgba(0, 0, 0, 0.6)',
              color: isSelected ? '#000' : isHovered ? '#000' : '#fff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '14px',
              paddingLeft: 3,
              boxShadow: isSelected
                ? `0 0 16px ${colors.accent.primary}`
                : '0 4px 12px rgba(0,0,0,0.5)',
              transform: isHovered ? 'scale(1.1)' : 'scale(1)',
              transition: 'all 0.2s cubic-bezier(0.34, 1.56, 0.64, 1)',
            }}
          >
            ▶
          </div>
        </div>

        {/* Progress Bar at Bottom of Thumbnail */}
        {inProgress && (
          <div
            style={{
              position: 'absolute',
              bottom: 0,
              left: 0,
              right: 0,
              height: 4,
              backgroundColor: 'rgba(0, 0, 0, 0.7)',
            }}
          >
            <div
              style={{
                height: '100%',
                width: `${Math.min(100, Math.max(0, progress.percentage))}%`,
                backgroundColor: colors.accent.primary,
                boxShadow: `0 0 8px ${colors.accent.primary}`,
              }}
            />
          </div>
        )}
      </div>

      {/* Content & Metadata */}
      <div
        style={{
          flex: 1,
          minWidth: 0,
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          gap: 6,
        }}
      >
        {/* Title and Badges Row */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 10,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
            <h4
              style={{
                margin: 0,
                fontSize: '15px',
                fontWeight: 700,
                color: isSelected ? colors.accent.primary : '#fff',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}
            >
              {episode.episode}. {episode.title}
            </h4>

            {isSelected && (
              <span
                style={{
                  fontSize: '10px',
                  fontWeight: 800,
                  letterSpacing: '0.5px',
                  padding: '2px 7px',
                  borderRadius: 6,
                  backgroundColor: `${colors.accent.primary}22`,
                  color: colors.accent.primary,
                  border: `1px solid ${colors.accent.primary}66`,
                  flexShrink: 0,
                }}
              >
                SELECTED
              </span>
            )}
          </div>

          {/* Quick Play CTA on desktop */}
          <button
            type="button"
            onClick={handlePlayClick}
            style={{
              flexShrink: 0,
              padding: '6px 14px',
              borderRadius: 10,
              border: isSelected
                ? `1.5px solid ${colors.accent.primary}`
                : `1px solid ${colors.border.subtle}`,
              backgroundColor: isSelected
                ? colors.accent.primary
                : isHovered
                ? colors.bg.surface
                : 'transparent',
              color: isSelected ? '#000' : isHovered ? colors.accent.primary : colors.text.secondary,
              fontSize: '12px',
              fontWeight: 700,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              transition: 'all 0.15s ease',
            }}
          >
            <span>▶</span>
            <span>{inProgress ? 'Resume' : 'Play'}</span>
          </button>
        </div>

        {/* Metadata info: Air date, rating */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            fontSize: '12px',
            color: colors.text.muted,
          }}
        >
          {formattedDate && <span>{formattedDate}</span>}
          {episode.rating && Number(episode.rating) > 0 && (
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 3,
                color: '#facc15',
                fontWeight: 700,
              }}
            >
              ★ {episode.rating}
            </span>
          )}
          {inProgress && (
            <span style={{ color: colors.accent.primary, fontWeight: 600 }}>
              {Math.round(progress.percentage)}% watched
            </span>
          )}
        </div>

        {/* Overview Synopsis */}
        {episode.overview && (
          <p
            style={{
              margin: 0,
              fontSize: '12.5px',
              color: colors.text.secondary,
              lineHeight: '1.45',
              display: '-webkit-box',
              WebkitLineClamp: 2,
              WebkitBoxOrient: 'vertical',
              overflow: 'hidden',
            }}
          >
            {episode.overview}
          </p>
        )}
      </div>
    </div>
  );
};

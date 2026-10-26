import React from 'react';
import { MediaItem, WatchProgress } from '@dion/core';
import { colors } from '../theme/colors';

export interface MediaCardProps {
  media: MediaItem;
  progress?: WatchProgress;
  onPress: (media: MediaItem) => void;
  onToggleFavorite?: (media: MediaItem) => void;
  isFavorite?: boolean;
  width?: number | string;
}

export const MediaCard: React.FC<MediaCardProps> = ({
  media,
  progress,
  onPress,
  onToggleFavorite,
  isFavorite = false,
  width = 170,
}) => {
  const [isPressed, setIsPressed] = React.useState(false);

  const posterUrl =
    media.poster ||
    media.background ||
    'https://via.placeholder.com/300x450/1c1c22/71717a?text=No+Poster';

  return (
    <div
      onClick={() => onPress(media)}
      onPointerDown={() => setIsPressed(true)}
      onPointerUp={() => setIsPressed(false)}
      onPointerLeave={() => setIsPressed(false)}
      style={{
        width,
        display: 'flex',
        flexDirection: 'column',
        cursor: 'pointer',
        userSelect: 'none',
        transition: 'transform 0.15s ease, opacity 0.15s ease',
        transform: isPressed ? 'scale(0.96)' : 'scale(1)',
        WebkitTapHighlightColor: 'transparent',
      }}
    >
      {/* Poster Container */}
      <div
        style={{
          position: 'relative',
          width: '100%',
          aspectRatio: '2 / 3',
          borderRadius: 12,
          overflow: 'hidden',
          backgroundColor: colors.bg.elevated,
          boxShadow: '0 4px 16px rgba(0,0,0,0.3)',
          border: `1px solid ${colors.border.subtle}`,
        }}
      >
        <img
          src={posterUrl}
          alt={media.title}
          loading="lazy"
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            display: 'block',
          }}
        />

        {/* Rating Badge */}
        {media.rating && (
          <div
            style={{
              position: 'absolute',
              top: 8,
              left: 8,
              backgroundColor: 'rgba(0,0,0,0.75)',
              backdropFilter: 'blur(4px)',
              padding: '3px 7px',
              borderRadius: 6,
              fontSize: '11px',
              fontWeight: 700,
              color: '#facc15', // Gold
              display: 'flex',
              alignItems: 'center',
              gap: 3,
            }}
          >
            ★ {media.rating}
          </div>
        )}

        {/* Favorite Button */}
        {onToggleFavorite && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onToggleFavorite(media);
            }}
            style={{
              position: 'absolute',
              top: 8,
              right: 8,
              width: 32,
              height: 32,
              borderRadius: 16,
              backgroundColor: 'rgba(0,0,0,0.65)',
              backdropFilter: 'blur(4px)',
              border: 'none',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: isFavorite ? '#ef4444' : colors.text.muted,
              fontSize: '16px',
            }}
          >
            {isFavorite ? '♥' : '♡'}
          </button>
        )}

        {/* Type Badge (Movie / Series) */}
        <div
          style={{
            position: 'absolute',
            bottom: progress ? 8 : 8,
            right: 8,
            backgroundColor: 'rgba(0,0,0,0.75)',
            backdropFilter: 'blur(4px)',
            padding: '2px 6px',
            borderRadius: 4,
            fontSize: '10px',
            fontWeight: 600,
            color: colors.text.secondary,
            textTransform: 'uppercase',
          }}
        >
          {media.type}
        </div>

        {/* Progress Bar (if in watch progress) */}
        {progress && (
          <div
            style={{
              position: 'absolute',
              bottom: 0,
              left: 0,
              right: 0,
              height: 4,
              backgroundColor: 'rgba(255,255,255,0.2)',
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

      {/* Title & Metadata */}
      <div style={{ marginTop: 8, padding: '0 2px' }}>
        <div
          style={{
            fontSize: '14px',
            fontWeight: 600,
            color: colors.text.primary,
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}
          title={media.title}
        >
          {media.title}
        </div>
        <div
          style={{
            fontSize: '12px',
            color: colors.text.muted,
            marginTop: 2,
            display: 'flex',
            alignItems: 'center',
            gap: 6,
          }}
        >
          {media.year && <span>{media.year}</span>}
          {media.genres && media.genres[0] && (
            <>
              <span>•</span>
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {media.genres[0]}
              </span>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

import React, { useState } from 'react';
import { MediaItem, WatchProgress } from '@theia/core';
import { colors } from '../theme/colors';

export interface MediaCardProps {
  media: MediaItem;
  progress?: WatchProgress;
  onPress: (media: MediaItem) => void;
  onToggleFavorite?: (media: MediaItem) => void;
  onQuickPlay?: (media: MediaItem) => void;
  isFavorite?: boolean;
  width?: number | string;
}

export const MediaCard: React.FC<MediaCardProps> = ({
  media,
  progress,
  onPress,
  onToggleFavorite,
  onQuickPlay,
  isFavorite = false,
  width = 170,
}) => {
  const [isPressed, setIsPressed] = useState(false);
  const [isFavPressed, setIsFavPressed] = useState(false);

  const posterUrl =
    media.poster ||
    media.background ||
    'https://via.placeholder.com/300x450/1c1c22/71717a?text=No+Poster';

  const hasProgress = progress && progress.percentage > 2 && !progress.completed;

  return (
    <div
      onClick={() => onPress(media)}
      onPointerDown={() => setIsPressed(true)}
      onPointerUp={() => setIsPressed(false)}
      onPointerLeave={() => setIsPressed(false)}
      onPointerCancel={() => setIsPressed(false)}
      style={{
        width,
        display: 'flex',
        flexDirection: 'column',
        cursor: 'pointer',
        userSelect: 'none',
        transition: 'transform 0.15s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.15s ease',
        transform: isPressed ? 'scale(0.95)' : 'scale(1)',
        WebkitTapHighlightColor: 'transparent',
        touchAction: 'manipulation',
      }}
    >
      {/* Poster Container */}
      <div
        style={{
          position: 'relative',
          width: '100%',
          aspectRatio: '2 / 3',
          borderRadius: 16,
          overflow: 'hidden',
          backgroundColor: colors.bg.elevated,
          boxShadow: '0 6px 20px rgba(0,0,0,0.4)',
          border: `1.5px solid ${colors.border.subtle}`,
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
              backgroundColor: 'rgba(9, 9, 11, 0.85)',
              backdropFilter: 'blur(8px)',
              padding: '3px 8px',
              borderRadius: 8,
              fontSize: '11px',
              fontWeight: 800,
              color: '#facc15', // Gold
              display: 'flex',
              alignItems: 'center',
              gap: 3,
              border: '1px solid rgba(250, 204, 21, 0.3)',
            }}
          >
            ★ {media.rating}
          </div>
        )}

        {/* Touch Favorite Button (Generous touch target) */}
        {onToggleFavorite && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onToggleFavorite(media);
            }}
            onPointerDown={(e) => {
              e.stopPropagation();
              setIsFavPressed(true);
            }}
            onPointerUp={(e) => {
              e.stopPropagation();
              setIsFavPressed(false);
            }}
            onPointerLeave={() => setIsFavPressed(false)}
            style={{
              position: 'absolute',
              top: 6,
              right: 6,
              width: 38,
              height: 38,
              borderRadius: 19,
              backgroundColor: 'rgba(9, 9, 11, 0.75)',
              backdropFilter: 'blur(8px)',
              border: '1px solid rgba(255,255,255,0.1)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: isFavorite ? '#ef4444' : colors.text.primary,
              fontSize: '18px',
              transition: 'transform 0.15s ease',
              transform: isFavPressed ? 'scale(0.85)' : 'scale(1)',
              touchAction: 'manipulation',
            }}
            aria-label="Toggle favorite"
          >
            {isFavorite ? '♥' : '♡'}
          </button>
        )}

        {/* Quick Resume Touch Play Icon */}
        {hasProgress && onQuickPlay && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onQuickPlay(media);
            }}
            style={{
              position: 'absolute',
              top: '50%',
              left: '50%',
              transform: 'translate(-50%, -50%)',
              width: 46,
              height: 46,
              borderRadius: 23,
              backgroundColor: 'rgba(6, 182, 212, 0.9)',
              border: '2px solid #ffffff',
              color: '#000000',
              fontSize: '18px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: `0 0 20px ${colors.accent.primary}`,
              paddingLeft: 3, // visual centering for triangle
              touchAction: 'manipulation',
            }}
            aria-label="Resume video"
          >
            ▶
          </button>
        )}

        {/* Type Badge (Movie / Series) */}
        <div
          style={{
            position: 'absolute',
            bottom: hasProgress ? 12 : 8,
            right: 8,
            backgroundColor: 'rgba(9, 9, 11, 0.85)',
            backdropFilter: 'blur(6px)',
            padding: '3px 7px',
            borderRadius: 6,
            fontSize: '10px',
            fontWeight: 700,
            color: colors.accent.primary,
            textTransform: 'uppercase',
            letterSpacing: '0.5px',
            border: `1px solid ${colors.border.subtle}`,
          }}
        >
          {media.type}
        </div>

        {/* Progress Bar (if in watch progress) */}
        {hasProgress && (
          <div
            style={{
              position: 'absolute',
              bottom: 0,
              left: 0,
              right: 0,
              height: 5,
              backgroundColor: 'rgba(0,0,0,0.6)',
            }}
          >
            <div
              style={{
                height: '100%',
                width: `${Math.min(100, Math.max(0, progress.percentage))}%`,
                backgroundColor: colors.accent.primary,
                boxShadow: `0 0 10px ${colors.accent.primary}`,
              }}
            />
          </div>
        )}
      </div>

      {/* Title & Metadata */}
      <div style={{ marginTop: 10, padding: '0 2px' }}>
        <div
          style={{
            fontSize: '14px',
            fontWeight: 700,
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
            marginTop: 3,
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

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
    seasons.find((s) => s.season === 1)?.season ?? seasons[0]?.season ?? 1
  );
  const activeEpisodeRef = useRef<HTMLDivElement>(null);

  // Swipe-down to dismiss gesture state
  const [dragY, setDragY] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const startYRef = useRef(0);

  useEffect(() => {
    if (isOpen && activeEpisodeRef.current) {
      activeEpisodeRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [isOpen, selectedSeason]);

  // Sync selectedSeason if media changes
  useEffect(() => {
    if (seasons.length > 0) {
      const initialSeason = seasons.find((s) => s.season === 1)?.season ?? seasons[0]?.season ?? 1;
      setSelectedSeason(initialSeason);
    }
    setDragY(0);
  }, [media.id]);

  if (!isOpen) return null;

  const currentSeasonInfo = seasons.find((s) => s.season === selectedSeason) || seasons[0];
  const episodes = currentSeasonInfo?.episodes || media.episodes || [];

  const handlePointerDownHeader = (e: React.PointerEvent<HTMLDivElement>) => {
    startYRef.current = e.clientY;
    setIsDragging(true);
    try {
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
    } catch {
      // ignore
    }
  };

  const handlePointerMoveHeader = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isDragging) return;
    const delta = e.clientY - startYRef.current;
    if (delta > 0) {
      setDragY(delta);
    }
  };

  const handlePointerUpHeader = () => {
    if (!isDragging) return;
    setIsDragging(false);
    if (dragY > 100) {
      onClose();
    } else {
      setDragY(0);
    }
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 999,
        backgroundColor: `rgba(0,0,0,${Math.max(0.2, 0.75 - dragY / 400)})`,
        backdropFilter: 'blur(10px)',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'flex-end',
        animation: 'fadeIn 0.2s ease-out',
      }}
      onClick={onClose}
    >
      <div
        style={{
          backgroundColor: colors.bg.surface,
          borderTopLeftRadius: 28,
          borderTopRightRadius: 28,
          borderTop: `1.5px solid ${colors.border.subtle}`,
          maxHeight: '88vh',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 -10px 40px rgba(0,0,0,0.8)',
          transform: `translateY(${dragY}px)`,
          transition: isDragging ? 'none' : 'transform 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
          overflow: 'hidden',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Swipe-down Drag Handle Area */}
        <div
          onPointerDown={handlePointerDownHeader}
          onPointerMove={handlePointerMoveHeader}
          onPointerUp={handlePointerUpHeader}
          onPointerCancel={handlePointerUpHeader}
          style={{
            height: 32,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'grab',
            touchAction: 'none',
          }}
        >
          <div
            style={{
              width: 44,
              height: 5,
              borderRadius: 3,
              backgroundColor: isDragging ? colors.accent.primary : 'rgba(255,255,255,0.3)',
              transition: 'background-color 0.2s ease',
            }}
          />
        </div>

        {/* Title Bar */}
        <div
          style={{
            padding: '4px 20px 14px 20px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            borderBottom: `1px solid ${colors.border.subtle}`,
          }}
        >
          <div>
            <h2 style={{ margin: 0, fontSize: '18px', fontWeight: 800, color: '#fff' }}>
              Select Episode
            </h2>
            <p style={{ margin: '2px 0 0 0', fontSize: '13px', color: colors.text.muted }}>
              {media.title}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            style={{
              width: 36,
              height: 36,
              borderRadius: 18,
              backgroundColor: colors.bg.elevated,
              border: `1px solid ${colors.border.subtle}`,
              color: colors.text.muted,
              fontSize: '18px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              touchAction: 'manipulation',
            }}
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        {/* Season Selector Horizontal Scroll Tabs */}
        {seasons.length > 1 && (
          <div
            className="touch-scroll-row"
            style={{
              display: 'flex',
              gap: 10,
              padding: '14px 20px',
              overflowX: 'auto',
              borderBottom: `1px solid ${colors.border.subtle}`,
              scrollbarWidth: 'none',
              scrollSnapType: 'x proximity',
              WebkitOverflowScrolling: 'touch',
              touchAction: 'pan-x pan-y',
            }}
          >
            {seasons.map((s) => (
              <div key={s.season} style={{ scrollSnapAlign: 'start' }}>
                <TouchPill
                  label={s.season === 0 ? 'Specials' : `Season ${s.season}`}
                  active={s.season === selectedSeason}
                  onClick={() => setSelectedSeason(s.season)}
                  badge={s.episodes.length}
                  size="sm"
                />
              </div>
            ))}
          </div>
        )}

        {/* Episodes List with Generous Touch Rows */}
        <div
          style={{
            flex: 1,
            overflowY: 'auto',
            padding: '16px 20px 32px 20px',
            display: 'flex',
            flexDirection: 'column',
            gap: 12,
            WebkitOverflowScrolling: 'touch',
            touchAction: 'pan-y',
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
                  padding: '12px 14px',
                  borderRadius: 16,
                  backgroundColor: isCurrent ? `${colors.accent.primary}18` : colors.bg.elevated,
                  border: isCurrent
                    ? `1.5px solid ${colors.accent.primary}`
                    : `1px solid ${colors.border.subtle}`,
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                  userSelect: 'none',
                  WebkitTapHighlightColor: 'transparent',
                  touchAction: 'manipulation',
                }}
              >
                {/* Thumbnail with Touch Play Overlay */}
                <div
                  style={{
                    position: 'relative',
                    width: 116,
                    height: 68,
                    borderRadius: 10,
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

                  {/* Play circle icon overlay */}
                  <div
                    style={{
                      position: 'absolute',
                      inset: 0,
                      backgroundColor: 'rgba(0,0,0,0.3)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <div
                      style={{
                        width: 28,
                        height: 28,
                        borderRadius: 14,
                        backgroundColor: isCurrent ? colors.accent.primary : 'rgba(0,0,0,0.7)',
                        color: isCurrent ? '#000' : '#fff',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '12px',
                        paddingLeft: 2,
                      }}
                    >
                      ▶
                    </div>
                  </div>

                  {progress && progress.percentage > 0 && (
                    <div
                      style={{
                        position: 'absolute',
                        bottom: 0,
                        left: 0,
                        right: 0,
                        height: 4,
                        backgroundColor: 'rgba(0,0,0,0.6)',
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
                <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
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
                        fontSize: '15px',
                        fontWeight: 700,
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
                          fontWeight: 700,
                          flexShrink: 0,
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

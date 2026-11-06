import React, { useState, useEffect, useLayoutEffect, useRef, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { MediaItem, Episode, SeasonInfo, WatchProgress } from '@theia/core';
import { colors } from '../theme/colors';
import { EpisodeCard } from './EpisodeCard';
import { SeasonSelector } from './SeasonSelector';

export interface EpisodeSheetProps {
  media: MediaItem;
  isOpen: boolean;
  onClose: () => void;
  onSelectEpisode: (episode: Episode) => void;
  onPlayEpisode?: (episode: Episode) => void;
  currentEpisodeId?: string;
  progressMap?: Record<string, WatchProgress>;
}

export const EpisodeSheet: React.FC<EpisodeSheetProps> = ({
  media,
  isOpen,
  onClose,
  onSelectEpisode,
  onPlayEpisode,
  currentEpisodeId,
  progressMap = {},
}) => {
  const seasons: SeasonInfo[] = media.seasons || [];
  const [selectedSeason, setSelectedSeason] = useState<number>(() => {
    return seasons.find((s) => s.season === 1)?.season ?? seasons[0]?.season ?? 1;
  });
  const [searchQuery, setSearchQuery] = useState('');
  const episodeListRef = useRef<HTMLDivElement>(null);
  const activeEpisodeRef = useRef<HTMLDivElement>(null);

  // Swipe-down to dismiss gesture state
  const [dragY, setDragY] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const startYRef = useRef(0);

  // Initialize before paint so reopening never flashes the previous season or filter.
  useLayoutEffect(() => {
    if (!isOpen) return;
    const initialSeason = seasons.find((s) =>
      s.episodes.some((ep) => ep.id === currentEpisodeId)
    )?.season ?? seasons.find((s) => s.season === 1)?.season ?? seasons[0]?.season ?? 1;
    setSelectedSeason(initialSeason);
    setDragY(0);
    setIsDragging(false);
    setSearchQuery('');
  }, [isOpen, media.id, currentEpisodeId]);

  // Scroll only this list. scrollIntoView also scrolls modal/page ancestors.
  useLayoutEffect(() => {
    const list = episodeListRef.current;
    if (!isOpen || !list) return;
    const active = activeEpisodeRef.current;
    list.scrollTop = active
      ? Math.max(0, active.getBoundingClientRect().top - list.getBoundingClientRect().top
          + list.scrollTop - (list.clientHeight - active.clientHeight) / 2)
      : 0;
  }, [isOpen, selectedSeason, media.id, currentEpisodeId]);

  useEffect(() => {
    if (!isOpen) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = previousOverflow; };
  }, [isOpen]);

  const currentSeasonInfo = seasons.find((s) => s.season === selectedSeason) || seasons[0];
  const allSeasonEpisodes = currentSeasonInfo?.episodes || media.episodes || [];

  // Filter episodes based on searchQuery
  const displayedEpisodes = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return allSeasonEpisodes;
    return allSeasonEpisodes.filter((ep) => {
      const matchNum = String(ep.episode) === q || `e${ep.episode}` === q;
      const matchTitle = ep.title.toLowerCase().includes(q);
      const matchOverview = ep.overview?.toLowerCase().includes(q) ?? false;
      return matchNum || matchTitle || matchOverview;
    });
  }, [allSeasonEpisodes, searchQuery]);

  if (!isOpen) return null;

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

  return createPortal(
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 999,
        backgroundColor: `rgba(0,0,0,${Math.max(0.3, 0.85 - dragY / 400)})`,
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'flex-end',
        animation: 'fadeIn 0.2s ease-out',
      }}
      onClick={(event) => {
        event.stopPropagation();
        onClose();
      }}
    >
      <div
        style={{
          backgroundColor: colors.bg.surface,
          borderTopLeftRadius: 28,
          borderTopRightRadius: 28,
          borderTop: `1.5px solid ${colors.border.subtle}`,
          height: '90dvh',
          maxHeight: '90%',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 -15px 50px rgba(0,0,0,0.9)',
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
              width: 48,
              height: 5,
              borderRadius: 3,
              backgroundColor: isDragging ? colors.accent.primary : 'rgba(255,255,255,0.3)',
              boxShadow: '0 2px 8px rgba(0,0,0,0.5)',
              transition: 'background-color 0.2s ease',
            }}
          />
        </div>

        {/* Title Bar */}
        <div
          style={{
            padding: '4px 24px 14px 24px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            borderBottom: `1px solid ${colors.border.subtle}`,
          }}
        >
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <h2 style={{ margin: 0, fontSize: '19px', fontWeight: 800, color: '#fff' }}>
                Episodes
              </h2>
              <span
                style={{
                  fontSize: '11px',
                  fontWeight: 800,
                  padding: '2px 8px',
                  borderRadius: 6,
                  backgroundColor: `${colors.accent.primary}22`,
                  color: colors.accent.primary,
                }}
              >
                {media.episodes?.length || 0} TOTAL
              </span>
            </div>
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

        {/* Season Selector Bar */}
        <div style={{ padding: '14px 24px', borderBottom: `1px solid ${colors.border.subtle}` }}>
          <SeasonSelector
            seasons={seasons}
            selectedSeason={selectedSeason}
            onSelectSeason={(s) => setSelectedSeason(s)}
            progressMap={progressMap}
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
          />
        </div>

        {/* Episodes List */}
        <div
          ref={episodeListRef}
          style={{
            flex: 1,
            minHeight: 0,
            overscrollBehavior: 'contain',
            overflowY: 'auto',
            padding: '16px 24px 36px 24px',
            display: 'flex',
            flexDirection: 'column',
            gap: 12,
            WebkitOverflowScrolling: 'touch',
            touchAction: 'pan-y',
          }}
        >
          {displayedEpisodes.length === 0 ? (
            <div
              style={{
                textAlign: 'center',
                padding: '40px 20px',
                color: colors.text.muted,
                fontSize: '14px',
              }}
            >
              <div style={{ fontSize: '32px', marginBottom: 12 }}>🔍</div>
              <p style={{ margin: 0, fontWeight: 600 }}>No episodes matching "{searchQuery}"</p>
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                style={{
                  marginTop: 12,
                  padding: '6px 14px',
                  borderRadius: 8,
                  backgroundColor: colors.bg.elevated,
                  border: `1px solid ${colors.border.subtle}`,
                  color: colors.accent.primary,
                  fontSize: '13px',
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
              >
                Clear Search
              </button>
            </div>
          ) : (
            displayedEpisodes.map((ep) => {
              const isSelected = ep.id === currentEpisodeId;
              const epProgress = progressMap[ep.id];

              return (
                <div key={ep.id} ref={isSelected ? activeEpisodeRef : undefined}>
                  <EpisodeCard
                    episode={ep}
                    media={media}
                    isSelected={isSelected}
                    progress={epProgress}
                    onSelect={(selected) => {
                      onSelectEpisode(selected);
                      onClose();
                    }}
                    onPlay={(played) => {
                      if (onPlayEpisode) {
                        onPlayEpisode(played);
                      } else {
                        onSelectEpisode(played);
                      }
                      onClose();
                    }}
                  />
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>,
    document.body
  );
};

import { useWatchState } from '@theia/ui';
import React, { useState, useEffect, useRef } from 'react';
import {
  MediaItem,
  cinemeta,
  providerManager,
  StreamSource,
  Episode,
  theiaStore,
} from '@theia/core';
import { colors, TouchPill, EpisodeSheet, useModal } from '@theia/ui';

interface MediaDetailModalProps {
  media: MediaItem;
  isOpen: boolean;
  initialEpisodeId?: string;
  resumeImmediately?: boolean;
  onClose: () => void;
  onPlay: (media: MediaItem, stream: StreamSource, availableStreams: StreamSource[], episode?: Episode, initialTime?: number) => void;
}

export const MediaDetailModal: React.FC<MediaDetailModalProps> = ({
  media: initialMedia,
  initialEpisodeId,
  resumeImmediately = false,
  isOpen,
  onClose,
  onPlay,
}) => {
  useWatchState();
  const dialogRef = useModal(isOpen, onClose);
  const [resolveAttempt, setResolveAttempt] = useState(0);
  const [media, setMedia] = useState<MediaItem>(initialMedia);
  const [isLoadingDetails, setIsLoadingDetails] = useState(false);
  const [isResolvingStreams, setIsResolvingStreams] = useState(false);
  const [hasResolvedStreams, setHasResolvedStreams] = useState(false);
  const [isPendingPlay, setIsPendingPlay] = useState(false);
  const [streams, setStreams] = useState<StreamSource[]>([]);
  const [selectedStream, setSelectedStream] = useState<StreamSource | null>(null);
  const [isEpisodeSheetOpen, setIsEpisodeSheetOpen] = useState(false);
  const [selectedEpisode, setSelectedEpisode] = useState<Episode | undefined>(undefined);

  // Swipe-down to dismiss gesture
  const [dragY, setDragY] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const startYRef = useRef(0);

  const pendingPlayRef = useRef(false);

  // Sync state
  const isFav = theiaStore.getState().isFavorite(media.id);
  const progress = theiaStore.getState().getProgress(media.id, selectedEpisode?.id);

  // Fetch full details if episodes/cast/tmdbId are missing
  useEffect(() => {
    setMedia(initialMedia);
    const lastEpisodeId = initialEpisodeId || theiaStore.getState().getProgress(initialMedia.id)?.episodeId;
    const chooseEpisode = (item: MediaItem) => item.episodes?.find((episode) => episode.id === lastEpisodeId)
      || item.episodes?.find((episode) => episode.season >= 1) || item.episodes?.[0];
    setSelectedEpisode(chooseEpisode(initialMedia));
    setDragY(0);
    let isMounted = true;

    async function loadFullMeta() {
      const needsDetails =
        (!initialMedia.episodes && initialMedia.type === 'series') || !initialMedia.tmdbId;

      if (needsDetails) {
        setIsLoadingDetails(true);
        const full = await cinemeta.getDetails(initialMedia.id, initialMedia.type);
        if (isMounted && full) {
          setMedia(full);
          setSelectedEpisode((current) => full.episodes?.find((episode) => episode.id === current?.id) || chooseEpisode(full));
        }
        if (isMounted) setIsLoadingDetails(false);
      }
    }

    loadFullMeta();
    return () => {
      isMounted = false;
    };
  }, [initialMedia, initialEpisodeId]);

  // Resolve streams whenever media or episode changes discretely in the background
  useEffect(() => {
    setStreams([]);
    setSelectedStream(null);
    setHasResolvedStreams(false);
    if (!isOpen || isLoadingDetails || (media.type === 'series' && !selectedEpisode)) {
      setIsResolvingStreams(false);
      return;
    }

    const controller = new AbortController();
    setIsResolvingStreams(true);
    setHasResolvedStreams(false);
    setIsPendingPlay(false);
    pendingPlayRef.current = false;

    async function fetchStreams() {
      try {
        const query = {
          imdbId: media.imdbId || media.id,
          tmdbId: media.tmdbId,
          type: media.type,
          season: selectedEpisode?.season,
          episode: selectedEpisode?.episode,
          title: media.title,
          signal: controller.signal,
        };

        const resolved = await providerManager.resolveStreams(query);

        if (!controller.signal.aborted) {
          setStreams(resolved);
          const best = resolved.find(source => source.format !== 'embed') || resolved[0] || null;
          setSelectedStream(best);
          setIsResolvingStreams(false);
          setHasResolvedStreams(true);

          // If the user clicked Watch while streams were resolving in the background
          if (pendingPlayRef.current || resumeImmediately) {
            pendingPlayRef.current = false;
            setIsPendingPlay(false);
            if (best) {
              const saved = theiaStore.getState().getProgress(media.id, selectedEpisode?.id);
              onPlay(media, best, resolved, selectedEpisode, resumeImmediately && saved && !saved.completed ? saved.positionSeconds : undefined);
              onClose();
            }
          }
        }
      } catch (err: any) {
        if (!controller.signal.aborted) {
          setIsResolvingStreams(false);
          setHasResolvedStreams(true);
          pendingPlayRef.current = false;
          setIsPendingPlay(false);
        }
      }
    }

    fetchStreams();

    // Cancel all in-flight background requests immediately when user exits or switches item
    return () => {
      controller.abort();
      pendingPlayRef.current = false;
    };
  }, [media.id, media.tmdbId, selectedEpisode?.id, isOpen, resolveAttempt, isLoadingDetails, resumeImmediately]);

  if (!isOpen) return null;

  const handleStartPlayback = (startOver = false) => {
    if (selectedStream) {
      onPlay(media, selectedStream, streams, selectedEpisode, startOver ? 0 : progress && !progress.completed ? progress.positionSeconds : undefined);
      onClose();
    } else if (isResolvingStreams) {
      pendingPlayRef.current = true;
      setIsPendingPlay(true);
    }
  };

  const handlePointerDownDrag = (e: React.PointerEvent<HTMLDivElement>) => {
    if ((e.target as HTMLElement).closest('button')) return;
    startYRef.current = e.clientY;
    setIsDragging(true);
    try {
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
    } catch {
      // ignore
    }
  };

  const handlePointerMoveDrag = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isDragging) return;
    const delta = e.clientY - startYRef.current;
    if (delta > 0) {
      setDragY(delta);
    }
  };

  const handlePointerUpDrag = () => {
    if (!isDragging) return;
    setIsDragging(false);
    if (dragY > 110) {
      onClose();
    } else {
      setDragY(0);
    }
  };

  const backdropUrl =
    media.background ||
    media.poster ||
    '';

  const isNoStreamsAvailable = hasResolvedStreams && streams.length === 0;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 100,
        backgroundColor: `rgba(0,0,0,${Math.max(0.3, 0.85 - dragY / 400)})`,
        backdropFilter: 'blur(12px)',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'flex-end',
        animation: 'fadeIn 0.2s ease-out',
        }}
      onClick={onClose}
    >
      {/* Modal Dialog Card with Swipe-Down Gesture */}
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label={media.title}
        tabIndex={-1}
        className="media-detail"
        style={{
          width: '100%',
          maxHeight: '92vh',
          backgroundColor: colors.bg.surface,
          borderTopLeftRadius: 28,
          borderTopRightRadius: 28,
          borderTop: `1.5px solid ${colors.border.subtle}`,
          display: 'flex',
          flexDirection: 'column',
          overflowY: 'auto',
          touchAction: 'pan-y',
          transform: `translateY(${dragY}px)`,
          transition: isDragging ? 'none' : 'transform 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
          boxShadow: '0 -15px 50px rgba(0,0,0,0.85)',
          WebkitOverflowScrolling: 'touch',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {progress && !progress.completed && progress.positionSeconds > 0 && selectedStream && (
          <button type="button" onClick={() => handleStartPlayback(true)} style={{ margin: 16 }}>Start over</button>
        )}
        {/* Swipe Handle Indicator */}
        <div
          onPointerDown={handlePointerDownDrag}
          onPointerMove={handlePointerMoveDrag}
          onPointerUp={handlePointerUpDrag}
          onPointerCancel={handlePointerUpDrag}
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            height: 36,
            zIndex: 10,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'grab',
            touchAction: 'none',
          }}
        >
          <div
            style={{
              width: 50,
              height: 5,
              borderRadius: 3,
              backgroundColor: isDragging ? colors.accent.primary : 'rgba(255,255,255,0.4)',
              boxShadow: '0 2px 8px rgba(0,0,0,0.5)',
              transition: 'background-color 0.2s ease',
            }}
          />
        </div>

        {/* Backdrop Image Header */}
        <div
          onPointerDown={handlePointerDownDrag}
          onPointerMove={handlePointerMoveDrag}
          onPointerUp={handlePointerUpDrag}
          onPointerCancel={handlePointerUpDrag}
          style={{
            position: 'relative',
            width: '100%',
            height: 250,
            backgroundImage: backdropUrl ? `url(${JSON.stringify(backdropUrl)})` : undefined,
            backgroundSize: 'cover',
            backgroundPosition: 'center 20%',
            borderTopLeftRadius: 28,
            borderTopRightRadius: 28,
            flexShrink: 0,
            cursor: 'grab',
            touchAction: 'none',
          }}
        >
          {/* Gradient overlay for readability */}
          <div
            style={{
              position: 'absolute',
              inset: 0,
              background: 'linear-gradient(to top, #121215 0%, rgba(18, 18, 21, 0.5) 60%, rgba(0,0,0,0.8) 100%)',
            }}
          />

          {/* Close button (Generous touch target) */}
          <button
            type="button"
            onClick={onClose}
            style={{
              position: 'absolute',
              top: 14,
              right: 16,
              backgroundColor: 'rgba(9, 9, 11, 0.75)',
              backdropFilter: 'blur(10px)',
              border: `1px solid ${colors.border.subtle}`,
              color: '#fff',
              width: 40,
              height: 40,
              borderRadius: 20,
              cursor: 'pointer',
              fontSize: '18px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: 12,
              touchAction: 'manipulation',
            }}
            aria-label="Close"
          >
            ✕
          </button>

          {/* Title & metadata overlaid on backdrop */}
          <div style={{ position: 'absolute', bottom: 16, left: 24, right: 24, pointerEvents: 'none' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
              {media.rating && (
                <span
                  style={{
                    backgroundColor: 'rgba(9, 9, 11, 0.85)',
                    color: '#facc15',
                    fontSize: '12px',
                    fontWeight: 800,
                    padding: '3px 8px',
                    borderRadius: 6,
                    border: '1px solid rgba(250, 204, 21, 0.3)',
                  }}
                >
                  ★ {media.rating}
                </span>
              )}
              {media.year && (
                <span style={{ fontSize: '13px', color: colors.text.secondary, fontWeight: 600 }}>
                  {media.year}
                </span>
              )}
              <span
                style={{
                  fontSize: '11px',
                  textTransform: 'uppercase',
                  color: colors.accent.primary,
                  fontWeight: 800,
                  letterSpacing: '0.5px',
                }}
              >
                {media.type}
              </span>
            </div>
            <h1 style={{ margin: 0, fontSize: '26px', color: '#fff', fontWeight: 900, letterSpacing: '-0.5px' }}>
              {media.title}
            </h1>
          </div>
        </div>

        {/* Content Body */}
        <div style={{ padding: '20px 24px 36px 24px', display: 'flex', flexDirection: 'column', gap: 20 }}>
          {/* Main Thumb Action Bar: Play CTA & Episodes & Favorite */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'center' }}>
            <button
              type="button"
              disabled={isNoStreamsAvailable || (media.type === 'series' && !selectedEpisode)}
              onClick={() => handleStartPlayback()}
              style={{
                flex: 1,
                height: 54,
                borderRadius: 16,
                backgroundColor: isNoStreamsAvailable ? colors.bg.elevated : colors.accent.primary,
                border: 'none',
                color: isNoStreamsAvailable ? colors.text.muted : '#000',
                fontSize: '16px',
                fontWeight: 800,
                cursor: isNoStreamsAvailable ? 'not-allowed' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 10,
                boxShadow: !isNoStreamsAvailable ? `0 0 20px ${colors.accent.primary}66` : 'none',
                transition: 'all 0.2s ease',
                touchAction: 'manipulation',
              }}
            >
              {isPendingPlay ? (
                <>
                  <span
                    style={{
                      display: 'inline-block',
                      width: 16,
                      height: 16,
                      border: '2.5px solid rgba(0,0,0,0.3)',
                      borderTopColor: '#000',
                      borderRadius: '50%',
                      animation: 'spin 0.8s linear infinite',
                    }}
                  />
                  <span>Connecting Stream...</span>
                </>
              ) : isNoStreamsAvailable ? (
                'No Streams Found'
              ) : (
                <>
                  <span>
                    {progress && progress.percentage > 1 && !progress.completed
                      ? `Resume (${Math.round(progress.percentage)}%) ▶`
                      : 'Watch Now ▶'}
                  </span>
                  {isResolvingStreams && (
                    <span
                      style={{
                        display: 'inline-block',
                        width: 8,
                        height: 8,
                        borderRadius: '50%',
                        backgroundColor: 'rgba(0,0,0,0.5)',
                        animation: 'pulse 1.5s infinite',
                        marginLeft: 4,
                      }}
                      title="Resolving streams in background"
                    />
                  )}
                </>
              )}
            </button>

            {/* Series Episodes Button */}
            {media.type === 'series' && (
              <button
                type="button"
                onClick={() => setIsEpisodeSheetOpen(true)}
                style={{
                  height: 54,
                  padding: '0 20px',
                  borderRadius: 16,
                  backgroundColor: colors.bg.elevated,
                  border: `1.5px solid ${colors.border.subtle}`,
                  color: '#fff',
                  fontSize: '15px',
                  fontWeight: 700,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  touchAction: 'manipulation',
                }}
              >
                <span>📺 Episodes</span>
              </button>
            )}

            {/* Favorite Heart Button */}
            <button
              type="button"
              onClick={() => theiaStore.getState().toggleFavorite(media)}
              style={{
                width: 54,
                height: 54,
                borderRadius: 16,
                backgroundColor: colors.bg.elevated,
                border: `1.5px solid ${colors.border.subtle}`,
                color: isFav ? '#ef4444' : colors.text.secondary,
                fontSize: '22px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                touchAction: 'manipulation',
              }}
              aria-label="Toggle Favorite"
            >
              {isFav ? '♥' : '♡'}
            </button>
          </div>

          {media.type === 'series' && !selectedEpisode && <p role="status" style={{ color: colors.text.secondary }}>
            {isLoadingDetails ? 'Loading episode information…' : 'Episode information is unavailable for this series.'}
          </p>}
          {/* Current episode indicator for Series with Change Action */}
          {selectedEpisode && (
            <div
              style={{
                padding: '12px 16px',
                borderRadius: 14,
                backgroundColor: `${colors.accent.primary}15`,
                border: `1.5px solid ${colors.accent.primary}44`,
                fontSize: '14px',
                color: colors.accent.primary,
                fontWeight: 700,
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}
            >
              <span>
                Selected: S{selectedEpisode.season}:E{selectedEpisode.episode} — {selectedEpisode.title}
              </span>
              <button
                type="button"
                onClick={() => setIsEpisodeSheetOpen(true)}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#fff',
                  textDecoration: 'underline',
                  fontSize: '13px',
                  fontWeight: 700,
                  cursor: 'pointer',
                  touchAction: 'manipulation',
                }}
              >
                Change
              </button>
            </div>
          )}

          {isNoStreamsAvailable && <div role="status" className="empty-state">
            <p>No servers are available for this title right now.</p>
            <TouchPill label="Try again" onClick={() => setResolveAttempt((count) => count + 1)} />
          </div>}
          {/* Stream Quality / Server Options */}
          {streams.length > 0 && (
            <div>
              <span style={{ fontSize: '13px', fontWeight: 700, color: colors.text.muted, display: 'block', marginBottom: 10 }}>
                Available Servers & Formats
              </span>
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                {streams.map((s) => (
                  <TouchPill
                    key={s.id}
                    label={`${s.name} (${s.format.toUpperCase()})`}
                    active={selectedStream?.id === s.id}
                    size="sm"
                    onClick={() => setSelectedStream(s)}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Genres Chips */}
          {media.genres && media.genres.length > 0 && (
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {media.genres.map((g) => (
                <span
                  key={g}
                  style={{
                    fontSize: '12px',
                    fontWeight: 600,
                    padding: '5px 12px',
                    borderRadius: 10,
                    backgroundColor: colors.bg.elevated,
                    color: colors.text.secondary,
                    border: `1px solid ${colors.border.subtle}`,
                  }}
                >
                  {g}
                </span>
              ))}
            </div>
          )}

          {/* Synopsis */}
          {media.description && (
            <div>
              <h4 style={{ margin: '0 0 6px 0', fontSize: '15px', color: colors.text.secondary, fontWeight: 700 }}>
                Synopsis
              </h4>
              <p
                style={{
                  margin: 0,
                  fontSize: '14px',
                  color: colors.text.muted,
                  lineHeight: '1.6',
                }}
              >
                {media.description}
              </p>
            </div>
          )}

          {/* Cast */}
          {media.cast && media.cast.length > 0 && (
            <div>
              <h4 style={{ margin: '0 0 6px 0', fontSize: '15px', color: colors.text.secondary, fontWeight: 700 }}>
                Cast
              </h4>
              <div style={{ fontSize: '13px', color: colors.text.muted, lineHeight: '1.5' }}>
                {media.cast.slice(0, 8).join(' • ')}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Episode Drawer */}
      <EpisodeSheet
        media={media}
        isOpen={isEpisodeSheetOpen}
        onClose={() => setIsEpisodeSheetOpen(false)}
        currentEpisodeId={selectedEpisode?.id}
        progressMap={theiaStore.getState().progress}
        onSelectEpisode={(ep) => { setSelectedEpisode(ep); setIsEpisodeSheetOpen(false); }}
      />
    </div>
  );
};

import React, { useState, useEffect } from 'react';
import {
  MediaItem,
  cinemeta,
  providerManager,
  StreamSource,
  Episode,
  dionStore,
} from '@dion/core';
import { colors, TouchPill, EpisodeSheet } from '@dion/ui';

interface MediaDetailModalProps {
  media: MediaItem;
  isOpen: boolean;
  onClose: () => void;
  onPlay: (media: MediaItem, stream: StreamSource, availableStreams: StreamSource[], episode?: Episode) => void;
}

export const MediaDetailModal: React.FC<MediaDetailModalProps> = ({
  media: initialMedia,
  isOpen,
  onClose,
  onPlay,
}) => {
  const [media, setMedia] = useState<MediaItem>(initialMedia);
  const [isLoadingDetails, setIsLoadingDetails] = useState(false);
  const [isResolvingStreams, setIsResolvingStreams] = useState(false);
  const [streams, setStreams] = useState<StreamSource[]>([]);
  const [selectedStream, setSelectedStream] = useState<StreamSource | null>(null);
  const [isEpisodeSheetOpen, setIsEpisodeSheetOpen] = useState(false);
  const [selectedEpisode, setSelectedEpisode] = useState<Episode | undefined>(undefined);

  // Sync state
  const isFav = dionStore.getState().isFavorite(media.id);
  const progress = dionStore.getState().getProgress(media.id, selectedEpisode?.id);

  // Fetch full details if episodes/cast are missing
  useEffect(() => {
    setMedia(initialMedia);
    let isMounted = true;

    async function loadFullMeta() {
      if (!initialMedia.episodes && initialMedia.type === 'series') {
        setIsLoadingDetails(true);
        const full = await cinemeta.getDetails(initialMedia.id, initialMedia.type);
        if (isMounted && full) {
          setMedia(full);
          if (full.episodes && full.episodes.length > 0) {
            setSelectedEpisode(full.episodes[0]);
          }
        }
        if (isMounted) setIsLoadingDetails(false);
      }
    }

    loadFullMeta();
    return () => {
      isMounted = false;
    };
  }, [initialMedia]);

  // Resolve streams whenever media or episode changes
  useEffect(() => {
    let isMounted = true;
    async function fetchStreams() {
      setIsResolvingStreams(true);
      const query = {
        imdbId: media.imdbId || media.id,
        tmdbId: media.tmdbId,
        type: media.type,
        season: selectedEpisode?.season,
        episode: selectedEpisode?.episode,
        title: media.title,
      };

      const resolved = await providerManager.resolveStreams(query);
      if (isMounted) {
        setStreams(resolved);
        setSelectedStream(resolved.length > 0 ? resolved[0] : null);
        setIsResolvingStreams(false);
      }
    }

    if (isOpen) {
      fetchStreams();
    }

    return () => {
      isMounted = false;
    };
  }, [media.id, selectedEpisode?.id, isOpen]);

  if (!isOpen) return null;

  const handleStartPlayback = () => {
    if (selectedStream) {
      onPlay(media, selectedStream, streams, selectedEpisode);
      onClose();
    }
  };

  const backdropUrl =
    media.background ||
    media.poster ||
    'https://via.placeholder.com/1280x720/1c1c22/71717a?text=No+Backdrop';

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 100,
        backgroundColor: 'rgba(0,0,0,0.85)',
        backdropFilter: 'blur(12px)',
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
          maxHeight: '92vh',
          overflowY: 'auto',
          borderTop: `1px solid ${colors.border.subtle}`,
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 -20px 50px rgba(0,0,0,0.9)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Backdrop Image Header */}
        <div style={{ position: 'relative', width: '100%', height: 260, backgroundColor: '#000' }}>
          <img
            src={backdropUrl}
            alt={media.title}
            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
          />
          <div
            style={{
              position: 'absolute',
              inset: 0,
              background: 'linear-gradient(to top, #121215 5%, rgba(18,18,21,0.5) 50%, transparent 100%)',
            }}
          />

          {/* Close button */}
          <button
            type="button"
            onClick={onClose}
            style={{
              position: 'absolute',
              top: 16,
              right: 16,
              backgroundColor: 'rgba(0,0,0,0.6)',
              border: `1px solid ${colors.border.subtle}`,
              color: '#fff',
              width: 36,
              height: 36,
              borderRadius: 18,
              cursor: 'pointer',
              fontSize: '16px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            ✕
          </button>

          {/* Title & metadata overlaid on backdrop */}
          <div style={{ position: 'absolute', bottom: 16, left: 24, right: 24 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
              {media.rating && (
                <span
                  style={{
                    backgroundColor: 'rgba(0,0,0,0.7)',
                    color: '#facc15',
                    fontSize: '12px',
                    fontWeight: 700,
                    padding: '3px 8px',
                    borderRadius: 6,
                  }}
                >
                  ★ {media.rating}
                </span>
              )}
              {media.year && (
                <span style={{ fontSize: '13px', color: colors.text.secondary }}>
                  {media.year}
                </span>
              )}
              <span
                style={{
                  fontSize: '11px',
                  textTransform: 'uppercase',
                  color: colors.accent.primary,
                  fontWeight: 700,
                }}
              >
                {media.type}
              </span>
            </div>
            <h1 style={{ margin: 0, fontSize: '26px', color: '#fff', fontWeight: 800 }}>
              {media.title}
            </h1>
          </div>
        </div>

        {/* Content Body */}
        <div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 20 }}>
          {/* Main Action Buttons: Play & Episodes & Favorite */}
          <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
            <button
              type="button"
              disabled={isResolvingStreams || streams.length === 0}
              onClick={handleStartPlayback}
              style={{
                flex: 1,
                height: 50,
                borderRadius: 14,
                backgroundColor: isResolvingStreams || streams.length === 0 ? colors.bg.elevated : colors.accent.primary,
                border: 'none',
                color: isResolvingStreams || streams.length === 0 ? colors.text.muted : '#000',
                fontSize: '16px',
                fontWeight: 700,
                cursor: isResolvingStreams || streams.length === 0 ? 'not-allowed' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
                boxShadow: streams.length > 0 ? `0 0 16px ${colors.accent.primary}55` : 'none',
              }}
            >
              {isResolvingStreams ? (
                'Resolving Streams...'
              ) : streams.length === 0 ? (
                'No Streams Found'
              ) : progress && progress.percentage > 5 && !progress.completed ? (
                `Resume (${Math.round(progress.percentage)}%) ▶`
              ) : (
                'Watch Now ▶'
              )}
            </button>

            {/* Series Episodes Button */}
            {media.type === 'series' && (
              <button
                type="button"
                onClick={() => setIsEpisodeSheetOpen(true)}
                style={{
                  height: 50,
                  padding: '0 18px',
                  borderRadius: 14,
                  backgroundColor: colors.bg.elevated,
                  border: `1px solid ${colors.border.subtle}`,
                  color: '#fff',
                  fontSize: '14px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                }}
              >
                <span>📺 Episodes</span>
              </button>
            )}

            {/* Favorite Button */}
            <button
              type="button"
              onClick={() => dionStore.getState().toggleFavorite(media)}
              style={{
                width: 50,
                height: 50,
                borderRadius: 14,
                backgroundColor: colors.bg.elevated,
                border: `1px solid ${colors.border.subtle}`,
                color: isFav ? '#ef4444' : colors.text.secondary,
                fontSize: '20px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              {isFav ? '♥' : '♡'}
            </button>
          </div>

          {/* Current episode indicator for Series */}
          {selectedEpisode && (
            <div
              style={{
                padding: '10px 14px',
                borderRadius: 10,
                backgroundColor: `${colors.accent.primary}12`,
                border: `1px solid ${colors.accent.primary}44`,
                fontSize: '13px',
                color: colors.accent.primary,
                fontWeight: 600,
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
                  fontSize: '12px',
                  cursor: 'pointer',
                }}
              >
                Change
              </button>
            </div>
          )}

          {/* Stream Quality / Server Options */}
          {streams.length > 0 && (
            <div>
              <span style={{ fontSize: '13px', color: colors.text.muted, display: 'block', marginBottom: 8 }}>
                Available Servers & Formats
              </span>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
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
                    padding: '4px 12px',
                    borderRadius: 8,
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
              <h4 style={{ margin: '0 0 6px 0', fontSize: '14px', color: colors.text.secondary }}>
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
              <h4 style={{ margin: '0 0 6px 0', fontSize: '14px', color: colors.text.secondary }}>
                Cast
              </h4>
              <div style={{ fontSize: '13px', color: colors.text.muted }}>
                {media.cast.slice(0, 6).join(' • ')}
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
        onSelectEpisode={(ep) => setSelectedEpisode(ep)}
      />
    </div>
  );
};

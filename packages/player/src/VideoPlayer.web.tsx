import React, { useRef, useState, useEffect } from 'react';
import Hls from 'hls.js';
import { theiaStore, StreamSource, formatSubtitleTimestamp } from '@theia/core';
import { colors, TouchSlider, SubtitleStepper, TouchPill } from '@theia/ui';
import { VideoPlayerProps, AspectRatioMode } from './types';
import { GestureCoordinator } from './gestures/coordinator';

export const VideoPlayerWeb: React.FC<VideoPlayerProps> = ({
  stream,
  availableStreams = [],
  media,
  episode,
  onBack,
  onNextEpisode,
  hasNextEpisode = false,
  onSelectStream,
  autoPlay = true,
  initialTime,
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Player state
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isBuffering, setIsBuffering] = useState(true);

  // Gesture HUD states
  const [isLocked, setIsLocked] = useState(false);
  const [showLockNotice, setShowLockNotice] = useState(false);
  const [isHUDVisible, setIsHUDVisible] = useState(true);
  const [brightness, setBrightness] = useState(100);
  const [volume, setVolume] = useState(100);
  const [showBrightness, setShowBrightness] = useState(false);
  const [showVolume, setShowVolume] = useState(false);
  const [scrubOffset, setScrubOffset] = useState<number | null>(null);
  const [doubleTapFeedback, setDoubleTapFeedback] = useState<'forward' | 'backward' | null>(null);
  const [aspectRatio, setAspectRatio] = useState<AspectRatioMode>('fit');
  const [aspectToast, setAspectToast] = useState<string | null>(null);

  // Subtitle Stepper modal state
  const [isSubModalOpen, setIsSubModalOpen] = useState(false);
  const [selectedSubId, setSelectedSubId] = useState<string>('');
  const [subtitleOffsetMs, setSubtitleOffsetMs] = useState(0);

  // Stream selector dropdown
  const [isStreamSelectorOpen, setIsStreamSelectorOpen] = useState(false);

  // Auto-next episode countdown banner (last 30s)
  const [showNextOverlay, setShowNextOverlay] = useState(false);

  // Load saved resume time and subtitle offset
  const mediaKey = episode ? episode.id : media.id;
  useEffect(() => {
    const saved = theiaStore.getState().getProgress(media.id, episode?.id);
    const savedOffset = theiaStore.getState().getSubtitleOffset(media.id);
    setSubtitleOffsetMs(savedOffset);

    if (initialTime !== undefined) {
      setCurrentTime(initialTime);
    } else if (saved && saved.positionSeconds > 5 && !saved.completed) {
      setCurrentTime(saved.positionSeconds);
    }
  }, [media.id, episode?.id, initialTime]);

  // HLS stream setup
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    if (stream.format === 'embed') {
      setIsBuffering(false);
      return;
    }

    let hls: Hls | null = null;
    let streamUrl = stream.url;

    // Route through edge proxy if required and configured
    const proxyUrl = theiaStore.getState().settings.proxyUrl;
    if (stream.requiresProxy && proxyUrl) {
      const referer = stream.headers?.Referer || 'https://vixsrc.to/';
      streamUrl = `${proxyUrl}?url=${encodeURIComponent(stream.url)}&referer=${encodeURIComponent(referer)}`;
    }

    if (Hls.isSupported() && (streamUrl.includes('.m3u8') || stream.format === 'hls')) {
      hls = new Hls({
        enableWorker: true,
        lowLatencyMode: false,
        backBufferLength: 30,
        maxBufferLength: 30,
        maxMaxBufferLength: 120,
        maxBufferSize: 60 * 1000 * 1000,
        maxBufferHole: 0.5,
        highBufferWatchdogPeriod: 2,
        nudgeOffset: 0.1,
        nudgeMaxRetry: 5,
      });

      hls.loadSource(streamUrl);
      hls.attachMedia(video);

      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        setIsBuffering(false);
        if (currentTime > 0) {
          video.currentTime = currentTime;
        }
        if (autoPlay) {
          video.play().catch(() => setIsPlaying(false));
        }
      });

      hls.on(Hls.Events.ERROR, (_, data) => {
        if (data.fatal) {
          switch (data.type) {
            case Hls.ErrorTypes.NETWORK_ERROR:
              hls?.startLoad();
              break;
            case Hls.ErrorTypes.MEDIA_ERROR:
              hls?.recoverMediaError();
              break;
            default:
              hls?.destroy();
              break;
          }
        }
      });
    } else if (video.canPlayType('application/vnd.apple.mpegurl') || stream.format === 'mp4') {
      video.src = streamUrl;
      if (currentTime > 0) {
        video.currentTime = currentTime;
      }
      if (autoPlay) {
        video.play().catch(() => setIsPlaying(false));
      }
    }

    return () => {
      if (hls) {
        hls.destroy();
      }
    };
  }, [stream.url, stream.format]);

  // Auto-save watch position every 5s and on pause
  useEffect(() => {
    const interval = setInterval(() => {
      if (videoRef.current && duration > 0) {
        const time = videoRef.current.currentTime;
        const percentage = (time / duration) * 100;
        const completed = percentage > 92;

        theiaStore.getState().updateProgress(
          {
            mediaId: media.id,
            episodeId: episode?.id,
            season: episode?.season,
            episode: episode?.episode,
            positionSeconds: Math.floor(time),
            durationSeconds: Math.floor(duration),
            percentage,
            completed,
            updatedAt: Date.now(),
          },
          media
        );
      }
    }, 5000);

    return () => clearInterval(interval);
  }, [media.id, episode?.id, duration]);

  const handleCycleAspect = () => {
    setAspectRatio((current) => {
      const next: AspectRatioMode =
        current === 'fit' ? 'fill' : current === 'fill' ? '16:9' : 'fit';
      setAspectToast(`Aspect Ratio: ${next.toUpperCase()}`);
      setTimeout(() => setAspectToast(null), 1500);
      return next;
    });
  };

  // Gesture Coordinator
  const coordinatorRef = useRef<GestureCoordinator | null>(null);
  useEffect(() => {
    coordinatorRef.current = new GestureCoordinator({
      onToggleHUD: () => {
        if (!isLocked) {
          setIsHUDVisible((prev) => !prev);
        }
      },
      onSeekDelta: (deltaSeconds) => {
        if (videoRef.current && !isLocked) {
          const target = Math.max(0, Math.min(duration, videoRef.current.currentTime + deltaSeconds));
          videoRef.current.currentTime = target;
          setCurrentTime(target);
        }
      },
      onBrightnessChange: (newB) => {
        setBrightness(newB);
        setShowBrightness(true);
        setTimeout(() => setShowBrightness(false), 1500);
      },
      onVolumeChange: (newV) => {
        setVolume(newV);
        if (videoRef.current) {
          videoRef.current.volume = newV / 100;
        }
        setShowVolume(true);
        setTimeout(() => setShowVolume(false), 1500);
      },
      onScrubUpdate: (offset) => {
        setScrubOffset(offset);
      },
      onDoubleTapSeek: (direction) => {
        if (videoRef.current && !isLocked) {
          const delta = direction === 'forward' ? 10 : -10;
          const target = Math.max(0, Math.min(duration, videoRef.current.currentTime + delta));
          videoRef.current.currentTime = target;
          setCurrentTime(target);
          setDoubleTapFeedback(direction);
          setTimeout(() => setDoubleTapFeedback(null), 800);
        }
      },
      onAspectCycle: handleCycleAspect,
    });
  }, [duration, isLocked]);

  // Video event handlers
  const handleTimeUpdate = () => {
    if (!videoRef.current) return;
    const curr = videoRef.current.currentTime;
    setCurrentTime(curr);

    // Trigger next episode banner if 30s or less remain
    if (duration > 60 && duration - curr <= 30 && hasNextEpisode) {
      setShowNextOverlay(true);
    } else {
      setShowNextOverlay(false);
    }
  };

  const handleTogglePlay = () => {
    if (!videoRef.current) return;
    if (isPlaying) {
      videoRef.current.pause();
      setIsPlaying(false);
    } else {
      videoRef.current.play();
      setIsPlaying(true);
    }
  };

  const formatTime = (secs: number) => {
    const s = Math.floor(secs);
    const m = Math.floor(s / 60);
    const h = Math.floor(m / 60);
    const pad = (n: number) => String(n).padStart(2, '0');
    if (h > 0) {
      return `${pad(h)}:${pad(m % 60)}:${pad(s % 60)}`;
    }
    return `${pad(m)}:${pad(s % 60)}`;
  };

  // Video object-fit mode
  const videoObjectFit = aspectRatio === 'fill' ? 'cover' : 'contain';

  return (
    <div
      ref={containerRef}
      style={{
        position: 'relative',
        width: '100%',
        height: '100%',
        backgroundColor: '#000000',
        overflow: 'hidden',
        userSelect: 'none',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        touchAction: 'manipulation',
      }}
      onPointerDown={(e) => {
        if (isLocked) {
          setShowLockNotice(true);
          setTimeout(() => setShowLockNotice(false), 2200);
          return;
        }
        if (containerRef.current) {
          coordinatorRef.current?.handlePointerDown(
            e,
            containerRef.current.getBoundingClientRect(),
            brightness,
            volume
          );
        }
      }}
      onPointerMove={(e) => {
        if (!isLocked && containerRef.current) {
          coordinatorRef.current?.handlePointerMove(
            e,
            containerRef.current.getBoundingClientRect(),
            brightness,
            volume,
            duration
          );
        }
      }}
      onPointerUp={(e) => {
        if (containerRef.current) {
          coordinatorRef.current?.handlePointerUp(
            e,
            containerRef.current.getBoundingClientRect(),
            scrubOffset
          );
        }
      }}
    >
      {/* Brightness Dimming Filter */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          backgroundColor: '#000',
          opacity: Math.max(0, (100 - brightness) / 100),
          pointerEvents: 'none',
          zIndex: 5,
        }}
      />

      {/* Media Element: Video or Iframe Embed */}
      {stream.format === 'embed' ? (
        <iframe
          src={stream.url}
          style={{ width: '100%', height: '100%', border: 'none' }}
          allow="autoplay; fullscreen; encrypted-media; picture-in-picture"
          allowFullScreen
          referrerPolicy="origin"
        />
      ) : (
        <video
          ref={videoRef}
          style={{
            width: '100%',
            height: '100%',
            objectFit: videoObjectFit,
            aspectRatio: aspectRatio === '16:9' ? '16 / 9' : undefined,
          }}
          playsInline
          onPlay={() => setIsPlaying(true)}
          onPause={() => setIsPlaying(false)}
          onTimeUpdate={handleTimeUpdate}
          onLoadedMetadata={() => {
            if (videoRef.current) {
              setDuration(videoRef.current.duration);
            }
          }}
          onWaiting={() => setIsBuffering(true)}
          onPlaying={() => setIsBuffering(false)}
        />
      )}

      {/* Buffering Spinner */}
      {isBuffering && stream.format !== 'embed' && (
        <div
          style={{
            position: 'absolute',
            zIndex: 10,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 12,
            color: colors.accent.primary,
          }}
        >
          <div
            style={{
              width: 52,
              height: 52,
              borderRadius: '50%',
              border: `3.5px solid ${colors.border.subtle}`,
              borderTopColor: colors.accent.primary,
              animation: 'spin 0.8s linear infinite',
            }}
          />
        </div>
      )}

      {/* Vertical Brightness Gesture Overlay Badge */}
      {showBrightness && (
        <div
          style={{
            position: 'absolute',
            left: 32,
            top: '50%',
            transform: 'translateY(-50%)',
            zIndex: 30,
            backgroundColor: 'rgba(9, 9, 11, 0.85)',
            backdropFilter: 'blur(12px)',
            borderRadius: 20,
            padding: '18px 16px',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 12,
            border: `1.5px solid ${colors.border.subtle}`,
            boxShadow: '0 8px 32px rgba(0,0,0,0.6)',
          }}
        >
          <span style={{ fontSize: '22px' }}>☀️</span>
          <div style={{ height: 130, display: 'flex', alignItems: 'center' }}>
            <TouchSlider
              value={brightness}
              orientation="vertical"
              height={130}
              width={10}
              onChange={(val) => setBrightness(val)}
            />
          </div>
          <span style={{ fontSize: '13px', fontWeight: 800, color: '#fff' }}>
            {brightness}%
          </span>
        </div>
      )}

      {/* Vertical Volume Gesture Overlay Badge */}
      {showVolume && (
        <div
          style={{
            position: 'absolute',
            right: 32,
            top: '50%',
            transform: 'translateY(-50%)',
            zIndex: 30,
            backgroundColor: 'rgba(9, 9, 11, 0.85)',
            backdropFilter: 'blur(12px)',
            borderRadius: 20,
            padding: '18px 16px',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 12,
            border: `1.5px solid ${colors.border.subtle}`,
            boxShadow: '0 8px 32px rgba(0,0,0,0.6)',
          }}
        >
          <span style={{ fontSize: '22px' }}>🔊</span>
          <div style={{ height: 130, display: 'flex', alignItems: 'center' }}>
            <TouchSlider
              value={volume}
              orientation="vertical"
              height={130}
              width={10}
              fillColor={colors.accent.secondary}
              onChange={(val) => {
                setVolume(val);
                if (videoRef.current) videoRef.current.volume = val / 100;
              }}
            />
          </div>
          <span style={{ fontSize: '13px', fontWeight: 800, color: '#fff' }}>
            {volume}%
          </span>
        </div>
      )}

      {/* Horizontal Scrub Floating Badge */}
      {scrubOffset !== null && (
        <div
          style={{
            position: 'absolute',
            top: '38%',
            zIndex: 30,
            backgroundColor: 'rgba(9, 9, 11, 0.9)',
            backdropFilter: 'blur(14px)',
            padding: '14px 28px',
            borderRadius: 24,
            border: `2px solid ${colors.accent.primary}`,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 6,
            boxShadow: `0 0 25px ${colors.accent.primary}55`,
          }}
        >
          <span style={{ fontSize: '24px', fontWeight: 800, color: colors.accent.primary }}>
            {scrubOffset > 0 ? `+${scrubOffset}s` : `${scrubOffset}s`}
          </span>
          <span style={{ fontSize: '14px', fontWeight: 600, color: colors.text.secondary }}>
            {formatTime(Math.max(0, Math.min(duration, currentTime + scrubOffset)))} / {formatTime(duration)}
          </span>
        </div>
      )}

      {/* Double Tap Ripple Indicators */}
      {doubleTapFeedback && (
        <div
          style={{
            position: 'absolute',
            [doubleTapFeedback === 'backward' ? 'left' : 'right']: '14%',
            top: '50%',
            transform: 'translateY(-50%)',
            zIndex: 30,
            backgroundColor: 'rgba(6, 182, 212, 0.25)',
            backdropFilter: 'blur(8px)',
            borderRadius: '50%',
            width: 100,
            height: 100,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '18px',
            fontWeight: 800,
            color: '#fff',
            border: `2.5px solid ${colors.accent.primary}`,
            boxShadow: `0 0 20px ${colors.accent.primary}66`,
          }}
        >
          {doubleTapFeedback === 'backward' ? '◀◀ 10s' : '10s ▶▶'}
        </div>
      )}

      {/* Aspect Ratio Toast Notification */}
      {aspectToast && (
        <div
          style={{
            position: 'absolute',
            top: 70,
            zIndex: 30,
            backgroundColor: 'rgba(9, 9, 11, 0.9)',
            backdropFilter: 'blur(10px)',
            padding: '10px 22px',
            borderRadius: 20,
            fontSize: '14px',
            fontWeight: 700,
            color: colors.text.primary,
            border: `1.5px solid ${colors.border.subtle}`,
            boxShadow: '0 4px 20px rgba(0,0,0,0.5)',
          }}
        >
          {aspectToast}
        </div>
      )}

      {/* Screen Lock Notice Overlay (When locked and user touches) */}
      {isLocked && showLockNotice && (
        <div
          style={{
            position: 'absolute',
            zIndex: 45,
            backgroundColor: 'rgba(9, 9, 11, 0.92)',
            backdropFilter: 'blur(16px)',
            border: `1.5px solid ${colors.status.danger}`,
            borderRadius: 24,
            padding: '18px 26px',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 12,
            boxShadow: '0 12px 40px rgba(0,0,0,0.85)',
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <div style={{ fontSize: '28px' }}>🔒</div>
          <div style={{ fontSize: '15px', fontWeight: 700, color: '#fff' }}>
            Touch Controls Locked
          </div>
          <button
            type="button"
            onClick={() => {
              setIsLocked(false);
              setShowLockNotice(false);
            }}
            style={{
              padding: '10px 22px',
              borderRadius: 14,
              backgroundColor: colors.accent.primary,
              border: 'none',
              color: '#000',
              fontWeight: 800,
              fontSize: '14px',
              cursor: 'pointer',
              touchAction: 'manipulation',
            }}
          >
            Tap to Unlock 🔓
          </button>
        </div>
      )}

      {/* Screen Lock Toggle Button (Always visible on touch) */}
      <button
        type="button"
        onClick={() => setIsLocked((prev) => !prev)}
        style={{
          position: 'absolute',
          top: 24,
          right: 24,
          zIndex: 40,
          backgroundColor: isLocked ? colors.status.danger : 'rgba(9, 9, 11, 0.75)',
          border: `1.5px solid ${isLocked ? colors.status.danger : colors.border.subtle}`,
          borderRadius: '50%',
          width: 48,
          height: 48,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: 'pointer',
          color: '#fff',
          fontSize: '20px',
          touchAction: 'manipulation',
          boxShadow: '0 4px 16px rgba(0,0,0,0.5)',
        }}
        aria-label={isLocked ? 'Unlock controls' : 'Lock controls'}
      >
        {isLocked ? '🔒' : '🔓'}
      </button>

      {/* Next Episode Floating Overlay Banner (last 30s) */}
      {showNextOverlay && hasNextEpisode && !isLocked && (
        <div
          style={{
            position: 'absolute',
            bottom: 110,
            right: 24,
            zIndex: 35,
            backgroundColor: 'rgba(9, 9, 11, 0.95)',
            backdropFilter: 'blur(14px)',
            border: `1.5px solid ${colors.accent.primary}`,
            borderRadius: 20,
            padding: '16px 22px',
            display: 'flex',
            alignItems: 'center',
            gap: 16,
            boxShadow: `0 8px 32px rgba(0,0,0,0.7), 0 0 20px ${colors.accent.primary}33`,
          }}
        >
          <div>
            <div style={{ fontSize: '11px', color: colors.accent.primary, fontWeight: 800, letterSpacing: '0.5px' }}>
              UP NEXT
            </div>
            <div style={{ fontSize: '15px', color: '#fff', fontWeight: 700, marginTop: 2 }}>
              Next Episode Playing Soon
            </div>
          </div>
          <button
            type="button"
            onClick={onNextEpisode}
            style={{
              padding: '10px 18px',
              borderRadius: 12,
              backgroundColor: colors.accent.primary,
              border: 'none',
              color: '#000',
              fontWeight: 800,
              fontSize: '14px',
              cursor: 'pointer',
              touchAction: 'manipulation',
            }}
          >
            Play Now ▶
          </button>
        </div>
      )}

      {/* Floating Top Bar for Embed Mode */}
      {stream.format === 'embed' && (
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            padding: '20px 24px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            zIndex: 40,
            pointerEvents: 'none',
            background: 'linear-gradient(to bottom, rgba(0,0,0,0.9) 0%, rgba(0,0,0,0.4) 70%, transparent 100%)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 14, pointerEvents: 'auto' }}>
            {onBack && (
              <button
                type="button"
                onClick={onBack}
                style={{
                  ...topIconButtonStyle,
                  backgroundColor: 'rgba(9, 9, 11, 0.75)',
                }}
              >
                ◀
              </button>
            )}
            <div>
              <h2 style={{ margin: 0, fontSize: '17px', color: '#fff', fontWeight: 800 }}>
                {media.title}
              </h2>
              {episode && (
                <span style={{ fontSize: '13px', color: colors.text.secondary }}>
                  S{episode.season}:E{episode.episode} — {episode.title}
                </span>
              )}
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginRight: 58, pointerEvents: 'auto' }}>
            {availableStreams.length > 1 && (
              <button
                type="button"
                onClick={() => setIsStreamSelectorOpen((prev) => !prev)}
                style={{
                  ...topIconButtonStyle,
                  width: 'auto',
                  padding: '0 16px',
                  borderRadius: 16,
                  fontSize: '13px',
                  fontWeight: 700,
                  backgroundColor: 'rgba(9, 9, 11, 0.8)',
                  border: `1px solid ${colors.border.subtle}`,
                }}
              >
                {stream.name} ▾
              </button>
            )}
          </div>
        </div>
      )}

      {/* Stream Selector Dropdown */}
      {isStreamSelectorOpen && (
        <div
          style={{
            position: 'absolute',
            top: 76,
            right: 80,
            backgroundColor: colors.bg.surface,
            border: `1.5px solid ${colors.border.subtle}`,
            borderRadius: 18,
            padding: 12,
            display: 'flex',
            flexDirection: 'column',
            gap: 8,
            zIndex: 50,
            boxShadow: '0 12px 36px rgba(0,0,0,0.85)',
          }}
        >
          {availableStreams.map((s) => (
            <TouchPill
              key={s.id}
              label={s.name}
              active={s.id === stream.id}
              size="sm"
              onClick={() => {
                onSelectStream?.(s);
                setIsStreamSelectorOpen(false);
              }}
            />
          ))}
        </div>
      )}

      {/* Main HUD Overlay Controls (Native Video Mode) */}
      {stream.format !== 'embed' && isHUDVisible && !isLocked && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            zIndex: 20,
            backgroundColor: 'rgba(0,0,0,0.5)',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            padding: '24px 28px',
            transition: 'opacity 0.25s ease',
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setIsHUDVisible(false);
            }
          }}
        >
          {/* Top Bar */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
              {onBack && (
                <button
                  type="button"
                  onClick={onBack}
                  style={topIconButtonStyle}
                  aria-label="Back"
                >
                  ◀
                </button>
              )}
              <div>
                <h2 style={{ margin: 0, fontSize: '18px', color: '#fff', fontWeight: 800 }}>
                  {media.title}
                </h2>
                {episode && (
                  <span style={{ fontSize: '13px', color: colors.text.secondary }}>
                    S{episode.season}:E{episode.episode} — {episode.title}
                  </span>
                )}
              </div>
            </div>

            {/* Quick action buttons in top bar */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginRight: 58 }}>
              {/* Aspect Ratio Button */}
              <button
                type="button"
                onClick={handleCycleAspect}
                style={topIconButtonStyle}
                title="Aspect Ratio"
              >
                ⛶
              </button>

              {/* Subtitles Button */}
              <button
                type="button"
                onClick={() => setIsSubModalOpen(true)}
                style={topIconButtonStyle}
                title="Subtitles & Sync"
              >
                💬
              </button>

              {/* Server / Stream Selector */}
              {availableStreams.length > 1 && (
                <button
                  type="button"
                  onClick={() => setIsStreamSelectorOpen((prev) => !prev)}
                  style={{
                    ...topIconButtonStyle,
                    width: 'auto',
                    padding: '0 14px',
                    borderRadius: 16,
                    fontSize: '13px',
                    fontWeight: 700,
                  }}
                >
                  {stream.name} ▾
                </button>
              )}
            </div>
          </div>

          {/* Center Play/Pause Large Touch Buttons */}
          <div
            style={{
              alignSelf: 'center',
              display: 'flex',
              alignItems: 'center',
              gap: 36,
            }}
          >
            <button
              type="button"
              onClick={() => {
                if (videoRef.current) {
                  videoRef.current.currentTime = Math.max(0, videoRef.current.currentTime - 10);
                }
              }}
              style={centerCircleButtonStyle}
              aria-label="Seek back 10 seconds"
            >
              -10s
            </button>
            <button
              type="button"
              onClick={handleTogglePlay}
              style={{
                ...centerCircleButtonStyle,
                width: 78,
                height: 78,
                fontSize: '32px',
                backgroundColor: colors.accent.primary,
                color: '#000',
                boxShadow: `0 0 24px ${colors.accent.primary}66`,
              }}
              aria-label={isPlaying ? 'Pause' : 'Play'}
            >
              {isPlaying ? '⏸' : '▶'}
            </button>
            <button
              type="button"
              onClick={() => {
                if (videoRef.current) {
                  videoRef.current.currentTime = Math.min(duration, videoRef.current.currentTime + 10);
                }
              }}
              style={centerCircleButtonStyle}
              aria-label="Seek forward 10 seconds"
            >
              +10s
            </button>
          </div>

          {/* Bottom Bar: Progress scrubber & time */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <TouchSlider
              value={currentTime}
              min={0}
              max={duration || 100}
              formatTooltip={(val) => formatTime(val)}
              onChange={(val) => {
                if (videoRef.current) {
                  videoRef.current.currentTime = val;
                  setCurrentTime(val);
                }
              }}
            />
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '14px', color: '#fff', fontWeight: 700 }}>
                {formatTime(currentTime)} / {formatTime(duration)}
              </span>
              <div style={{ display: 'flex', gap: 12 }}>
                {hasNextEpisode && onNextEpisode && (
                  <button
                    type="button"
                    onClick={onNextEpisode}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: colors.accent.primary,
                      fontWeight: 800,
                      cursor: 'pointer',
                      fontSize: '14px',
                      touchAction: 'manipulation',
                    }}
                  >
                    Next Episode ▶|
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Subtitle Sync Stepper Modal */}
      <SubtitleStepper
        isOpen={isSubModalOpen}
        onClose={() => setIsSubModalOpen(false)}
        offsetMs={subtitleOffsetMs}
        onOffsetChange={(offset) => {
          setSubtitleOffsetMs(offset);
          theiaStore.getState().setSubtitleOffset(media.id, offset);
        }}
        tracks={stream.subtitles}
        selectedTrackId={selectedSubId}
        onSelectTrack={(id) => setSelectedSubId(id)}
      />
    </div>
  );
};

const topIconButtonStyle: React.CSSProperties = {
  backgroundColor: 'rgba(255,255,255,0.15)',
  border: 'none',
  borderRadius: '50%',
  width: 44,
  height: 44,
  color: '#fff',
  fontSize: '18px',
  cursor: 'pointer',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  touchAction: 'manipulation',
  WebkitTapHighlightColor: 'transparent',
  transition: 'transform 0.15s ease',
};

const centerCircleButtonStyle: React.CSSProperties = {
  backgroundColor: 'rgba(9, 9, 11, 0.75)',
  border: `1.5px solid ${colors.border.subtle}`,
  borderRadius: '50%',
  width: 60,
  height: 60,
  color: '#fff',
  fontSize: '15px',
  fontWeight: 800,
  cursor: 'pointer',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  touchAction: 'manipulation',
  WebkitTapHighlightColor: 'transparent',
  transition: 'transform 0.15s ease',
};

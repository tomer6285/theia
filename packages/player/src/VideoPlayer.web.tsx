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
        lowLatencyMode: true,
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
      onAspectCycle: () => {
        setAspectRatio((current) => {
          const next: AspectRatioMode =
            current === 'fit' ? 'fill' : current === 'fill' ? '16:9' : 'fit';
          setAspectToast(`Aspect Ratio: ${next.toUpperCase()}`);
          setTimeout(() => setAspectToast(null), 1500);
          return next;
        });
      },
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
      }}
      onPointerDown={(e) => {
        if (!isLocked && containerRef.current) {
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
              width: 48,
              height: 48,
              borderRadius: '50%',
              border: `3px solid ${colors.border.subtle}`,
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
            left: 40,
            top: '50%',
            transform: 'translateY(-50%)',
            zIndex: 30,
            backgroundColor: 'rgba(0,0,0,0.8)',
            backdropFilter: 'blur(8px)',
            borderRadius: 16,
            padding: '16px 14px',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 10,
            border: `1px solid ${colors.border.subtle}`,
          }}
        >
          <span style={{ fontSize: '20px' }}>☀️</span>
          <div style={{ height: 120, display: 'flex', alignItems: 'center' }}>
            <TouchSlider
              value={brightness}
              orientation="vertical"
              height={120}
              width={8}
              onChange={(val) => setBrightness(val)}
            />
          </div>
          <span style={{ fontSize: '12px', fontWeight: 700, color: '#fff' }}>
            {brightness}%
          </span>
        </div>
      )}

      {/* Vertical Volume Gesture Overlay Badge */}
      {showVolume && (
        <div
          style={{
            position: 'absolute',
            right: 40,
            top: '50%',
            transform: 'translateY(-50%)',
            zIndex: 30,
            backgroundColor: 'rgba(0,0,0,0.8)',
            backdropFilter: 'blur(8px)',
            borderRadius: 16,
            padding: '16px 14px',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 10,
            border: `1px solid ${colors.border.subtle}`,
          }}
        >
          <span style={{ fontSize: '20px' }}>🔊</span>
          <div style={{ height: 120, display: 'flex', alignItems: 'center' }}>
            <TouchSlider
              value={volume}
              orientation="vertical"
              height={120}
              width={8}
              fillColor={colors.accent.secondary}
              onChange={(val) => {
                setVolume(val);
                if (videoRef.current) videoRef.current.volume = val / 100;
              }}
            />
          </div>
          <span style={{ fontSize: '12px', fontWeight: 700, color: '#fff' }}>
            {volume}%
          </span>
        </div>
      )}

      {/* Horizontal Scrub Floating Badge */}
      {scrubOffset !== null && (
        <div
          style={{
            position: 'absolute',
            top: '40%',
            zIndex: 30,
            backgroundColor: 'rgba(0,0,0,0.85)',
            backdropFilter: 'blur(10px)',
            padding: '12px 24px',
            borderRadius: 20,
            border: `1.5px solid ${colors.accent.primary}`,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 4,
          }}
        >
          <span style={{ fontSize: '20px', fontWeight: 700, color: colors.accent.primary }}>
            {scrubOffset > 0 ? `+${scrubOffset}s` : `${scrubOffset}s`}
          </span>
          <span style={{ fontSize: '13px', color: colors.text.secondary }}>
            {formatTime(Math.max(0, Math.min(duration, currentTime + scrubOffset)))} / {formatTime(duration)}
          </span>
        </div>
      )}

      {/* Double Tap Ripple Indicators */}
      {doubleTapFeedback && (
        <div
          style={{
            position: 'absolute',
            [doubleTapFeedback === 'backward' ? 'left' : 'right']: '15%',
            top: '50%',
            transform: 'translateY(-50%)',
            zIndex: 30,
            backgroundColor: 'rgba(6, 182, 212, 0.25)',
            backdropFilter: 'blur(6px)',
            borderRadius: '50%',
            width: 90,
            height: 90,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '18px',
            fontWeight: 700,
            color: '#fff',
            border: `2px solid ${colors.accent.primary}`,
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
            top: 60,
            zIndex: 30,
            backgroundColor: 'rgba(0,0,0,0.8)',
            padding: '8px 18px',
            borderRadius: 16,
            fontSize: '13px',
            fontWeight: 600,
            color: colors.text.primary,
            border: `1px solid ${colors.border.subtle}`,
          }}
        >
          {aspectToast}
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
          backgroundColor: isLocked ? colors.status.danger : 'rgba(0,0,0,0.6)',
          border: `1px solid ${colors.border.subtle}`,
          borderRadius: '50%',
          width: 44,
          height: 44,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: 'pointer',
          color: '#fff',
          fontSize: '18px',
        }}
      >
        {isLocked ? '🔒' : '🔓'}
      </button>

      {/* Next Episode Floating Overlay Banner (last 30s) */}
      {showNextOverlay && hasNextEpisode && !isLocked && (
        <div
          style={{
            position: 'absolute',
            bottom: 100,
            right: 24,
            zIndex: 35,
            backgroundColor: 'rgba(9, 9, 11, 0.95)',
            backdropFilter: 'blur(10px)',
            border: `1.5px solid ${colors.accent.primary}`,
            borderRadius: 16,
            padding: '14px 20px',
            display: 'flex',
            alignItems: 'center',
            gap: 16,
            boxShadow: '0 8px 30px rgba(0,0,0,0.6)',
          }}
        >
          <div>
            <div style={{ fontSize: '11px', color: colors.accent.primary, fontWeight: 700 }}>
              UP NEXT
            </div>
            <div style={{ fontSize: '14px', color: '#fff', fontWeight: 600 }}>
              Next Episode Playing Soon
            </div>
          </div>
          <button
            type="button"
            onClick={onNextEpisode}
            style={{
              padding: '8px 16px',
              borderRadius: 10,
              backgroundColor: colors.accent.primary,
              border: 'none',
              color: '#000',
              fontWeight: 700,
              cursor: 'pointer',
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
            padding: '16px 24px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            zIndex: 40,
            pointerEvents: 'none',
            background: 'linear-gradient(to bottom, rgba(0,0,0,0.85) 0%, rgba(0,0,0,0.3) 70%, transparent 100%)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 14, pointerEvents: 'auto' }}>
            {onBack && (
              <button
                type="button"
                onClick={onBack}
                style={{
                  backgroundColor: 'rgba(0,0,0,0.65)',
                  border: `1px solid ${colors.border.subtle}`,
                  borderRadius: '50%',
                  width: 40,
                  height: 40,
                  color: '#fff',
                  fontSize: '18px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                ◀
              </button>
            )}
            <div>
              <h2 style={{ margin: 0, fontSize: '16px', color: '#fff', fontWeight: 700 }}>
                {media.title}
              </h2>
              {episode && (
                <span style={{ fontSize: '13px', color: colors.text.secondary }}>
                  S{episode.season}:E{episode.episode} — {episode.title}
                </span>
              )}
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginRight: 56, pointerEvents: 'auto' }}>
            {availableStreams.length > 1 && (
              <button
                type="button"
                onClick={() => setIsStreamSelectorOpen((prev) => !prev)}
                style={{
                  ...topIconButtonStyle,
                  width: 'auto',
                  padding: '0 14px',
                  borderRadius: 14,
                  fontSize: '12px',
                  fontWeight: 700,
                  backgroundColor: 'rgba(0,0,0,0.7)',
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
            top: 70,
            right: 80,
            backgroundColor: colors.bg.surface,
            border: `1px solid ${colors.border.subtle}`,
            borderRadius: 14,
            padding: 10,
            display: 'flex',
            flexDirection: 'column',
            gap: 6,
            zIndex: 50,
            boxShadow: '0 10px 30px rgba(0,0,0,0.8)',
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
            backgroundColor: 'rgba(0,0,0,0.45)',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            padding: '20px 24px',
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
                  style={{
                    backgroundColor: 'rgba(255,255,255,0.15)',
                    border: 'none',
                    borderRadius: '50%',
                    width: 40,
                    height: 40,
                    color: '#fff',
                    fontSize: '18px',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  ◀
                </button>
              )}
              <div>
                <h2 style={{ margin: 0, fontSize: '16px', color: '#fff', fontWeight: 700 }}>
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
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginRight: 56 }}>
              {/* Aspect Ratio Button */}
              <button
                type="button"
                onClick={() => coordinatorRef.current?.handlePointerUp}
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
                    padding: '0 12px',
                    borderRadius: 14,
                    fontSize: '12px',
                    fontWeight: 700,
                  }}
                >
                  {stream.name} ▾
                </button>
              )}
            </div>
          </div>

          {/* Center Play/Pause Large Touch Button */}
          <div
            style={{
              alignSelf: 'center',
              display: 'flex',
              alignItems: 'center',
              gap: 28,
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
            >
              -10s
            </button>
            <button
              type="button"
              onClick={handleTogglePlay}
              style={{
                ...centerCircleButtonStyle,
                width: 68,
                height: 68,
                fontSize: '28px',
                backgroundColor: colors.accent.primary,
                color: '#000',
              }}
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
            >
              +10s
            </button>
          </div>

          {/* Bottom Bar: Progress scrubber & time */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <TouchSlider
              value={currentTime}
              min={0}
              max={duration || 100}
              onChange={(val) => {
                if (videoRef.current) {
                  videoRef.current.currentTime = val;
                  setCurrentTime(val);
                }
              }}
            />
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '13px', color: '#fff', fontWeight: 600 }}>
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
                      fontWeight: 700,
                      cursor: 'pointer',
                      fontSize: '13px',
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
  backgroundColor: 'rgba(255,255,255,0.12)',
  border: 'none',
  borderRadius: '50%',
  width: 40,
  height: 40,
  color: '#fff',
  fontSize: '16px',
  cursor: 'pointer',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
};

const centerCircleButtonStyle: React.CSSProperties = {
  backgroundColor: 'rgba(0,0,0,0.6)',
  border: `1px solid ${colors.border.subtle}`,
  borderRadius: '50%',
  width: 52,
  height: 52,
  color: '#fff',
  fontSize: '14px',
  fontWeight: 700,
  cursor: 'pointer',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
};

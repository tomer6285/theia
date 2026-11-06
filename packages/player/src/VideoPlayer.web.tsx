import React, { useRef, useState, useEffect, useCallback } from 'react';
import Hls from 'hls.js';
import { theiaStore, offsetSubtitlesVTT } from '@theia/core';
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
  const timers = useRef(new Map<string, ReturnType<typeof setTimeout>>());
  const showTemporarily = (key: string, callback: () => void, delay: number) => {
    clearTimeout(timers.current.get(key));
    timers.current.set(key, setTimeout(callback, delay));
  };
  useEffect(() => () => { timers.current.forEach(clearTimeout); timers.current.clear(); }, []);
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
  const [aspectRatio, setAspectRatio] = useState<AspectRatioMode>(theiaStore.getState().settings.aspectRatio);
  const [aspectToast, setAspectToast] = useState<string | null>(null);

  // Subtitle Stepper modal state
  const [isSubModalOpen, setIsSubModalOpen] = useState(false);
  const [selectedSubId, setSelectedSubId] = useState<string>('');
  const [subtitleOffsetMs, setSubtitleOffsetMs] = useState(0);

  // Stream selector dropdown
  const [isStreamSelectorOpen, setIsStreamSelectorOpen] = useState(false);

  // Auto-next episode countdown banner (last 30s)
  const [showNextOverlay, setShowNextOverlay] = useState(false);

  const [playbackError, setPlaybackError] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);
  const [subtitleUrl, setSubtitleUrl] = useState('');
  const [subtitleError, setSubtitleError] = useState<string | null>(null);
  const mediaKey = episode?.id || media.id;
  const lastPosition = useRef<{ key: string; time: number } | null>(null);
  const requestedTime = useRef(0);

  const saveVideoProgress = useCallback((video: HTMLVideoElement | null) => {
    if (!video || !Number.isFinite(video.duration) || video.duration <= 0 || video.currentTime <= 0) return;
    const percentage = video.currentTime / video.duration * 100;
    theiaStore.getState().updateProgress({
      mediaId: media.id, episodeId: episode?.id, season: episode?.season, episode: episode?.episode,
      positionSeconds: video.currentTime, durationSeconds: video.duration, percentage,
      completed: video.ended || percentage > 92, updatedAt: Date.now(),
    }, media);
  }, [media, episode]);
  const saveProgress = useCallback(() => saveVideoProgress(videoRef.current), [saveVideoProgress]);

  useEffect(() => {
    setSubtitleOffsetMs(theiaStore.getState().getSubtitleOffset(media.id));
    setShowNextOverlay(false);
    setIsHUDVisible(true);
  }, [mediaKey]);

  useEffect(() => {
    if (stream.format === 'embed') {
      setIsBuffering(false);
      setPlaybackError(null);
      return;
    }
    const video = videoRef.current;
    if (!video) return;
    const settings = theiaStore.getState().settings;
    const saved = theiaStore.getState().getProgress(media.id, episode?.id);
    requestedTime.current = lastPosition.current?.key === mediaKey ? lastPosition.current.time
      : initialTime !== undefined ? Math.max(0, initialTime)
      : settings.autoResume && saved && !saved.completed ? saved.positionSeconds : 0;
    setCurrentTime(requestedTime.current);
    setDuration(0);
    setIsPlaying(false);
    setIsBuffering(true);
    setPlaybackError(null);
    let hls: Hls | null = null;
    let networkRetries = 0;
    let mediaRetries = 0;
    let streamUrl = stream.url;
    if (stream.requiresProxy && settings.proxyUrl) {
      try {
        const proxy = new URL(settings.proxyUrl, window.location.href);
        if (!['http:', 'https:'].includes(proxy.protocol)) throw new Error('Invalid proxy');
        proxy.searchParams.set('url', stream.url);
        proxy.searchParams.set('referer', stream.headers?.Referer || 'https://vixsrc.to/');
        streamUrl = proxy.href;
      } catch {
        setIsBuffering(false);
        setPlaybackError('The playback proxy address is invalid. Update it in Settings.');
        return;
      }
    }
    const fail = () => {
      setIsBuffering(false);
      setPlaybackError('This stream could not be played. Retry or choose another server.');
    };
    if (stream.format === 'hls' && Hls.isSupported()) {
      hls = new Hls({ enableWorker: true, backBufferLength: 30, maxBufferLength: 30,
        startPosition: requestedTime.current || -1 });
      hls.on(Hls.Events.ERROR, (_, data) => {
        if (!data.fatal) return;
        if (data.type === Hls.ErrorTypes.NETWORK_ERROR && networkRetries++ < 2) hls?.startLoad();
        else if (data.type === Hls.ErrorTypes.MEDIA_ERROR && mediaRetries++ < 1) hls?.recoverMediaError();
        else { hls?.destroy(); fail(); }
      });
      hls.loadSource(streamUrl);
      hls.attachMedia(video);
    } else if (stream.format === 'mp4' || video.canPlayType('application/vnd.apple.mpegurl')) {
      video.src = streamUrl;
      video.load();
    } else fail();

    return () => {
      saveVideoProgress(video);
      lastPosition.current = { key: mediaKey, time: video.currentTime };
      hls?.destroy();
      video.removeAttribute('src');
      video.load();
    };
  }, [stream.url, stream.format, stream.requiresProxy, mediaKey, initialTime, retryCount]);

  useEffect(() => {
    const interval = setInterval(saveProgress, 5000);
    const onVisibility = () => { if (document.hidden) saveProgress(); };
    window.addEventListener('pagehide', saveProgress);
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      clearInterval(interval);
      window.removeEventListener('pagehide', saveProgress);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [saveProgress]);

  useEffect(() => {
    const preferred = theiaStore.getState().settings.preferredSubtitles;
    setSelectedSubId(stream.subtitles?.find((track) => track.isDefault)?.id
      || stream.subtitles?.find((track) => preferred.includes(track.language))?.id || '');
  }, [stream.id, stream.url]);

  useEffect(() => {
    setSubtitleUrl('');
    setSubtitleError(null);
    const track = stream.subtitles?.find((sub) => sub.id === selectedSubId);
    if (!track || stream.format === 'embed') return;
    const controller = new AbortController();
    let objectUrl: string | undefined;
    async function load() {
      try {
        const response = await fetch(track!.url, { signal: controller.signal });
        if (!response.ok) throw new Error('Subtitle unavailable');
        const content = await response.text();
        if (controller.signal.aborted) return;
        objectUrl = URL.createObjectURL(new Blob([offsetSubtitlesVTT(content, subtitleOffsetMs)], { type: 'text/vtt' }));
        setSubtitleUrl(objectUrl);
      } catch {
        if (!controller.signal.aborted) setSubtitleError('Subtitles could not be loaded. Try another track.');
      }
    }
    void load();
    return () => { controller.abort(); if (objectUrl) URL.revokeObjectURL(objectUrl); };
  }, [selectedSubId, subtitleOffsetMs, stream.url, stream.format]);

  useEffect(() => {
    if (!isPlaying || !isHUDVisible || isSubModalOpen || isStreamSelectorOpen) return;
    const timer = setTimeout(() => setIsHUDVisible(false), 4000);
    return () => clearTimeout(timer);
  }, [isPlaying, isHUDVisible, isSubModalOpen, isStreamSelectorOpen, currentTime === 0]);

  const handleCycleAspect = () => {
    setAspectRatio((current) => {
      const next: AspectRatioMode =
        current === 'fit' ? 'fill' : current === 'fill' ? '16:9' : 'fit';
      setAspectToast(`Aspect Ratio: ${next.toUpperCase()}`);
      showTemporarily('aspect', () => setAspectToast(null), 1500);
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
        showTemporarily('brightness', () => setShowBrightness(false), 1500);
      },
      onVolumeChange: (newV) => {
        setVolume(newV);
        if (videoRef.current) {
          videoRef.current.volume = newV / 100;
        }
        setShowVolume(true);
        showTemporarily('volume', () => setShowVolume(false), 1500);
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
          showTemporarily('seek', () => setDoubleTapFeedback(null), 800);
        }
      },
      onAspectCycle: handleCycleAspect,
    });
    return () => coordinatorRef.current?.dispose();
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
      void videoRef.current.play().catch(() => setIsPlaying(false));
    }
  };

  const formatTime = (secs: number) => {
    const s = Math.floor(Number.isFinite(secs) ? Math.max(0, secs) : 0);
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
      className="video-player"
      role="region"
      aria-label={`${media.title} player`}
      tabIndex={0}
      onKeyDown={(event) => {
        if ((event.target as HTMLElement).closest('button, input, [role="slider"], [role="dialog"]')) return;
        if (event.key === 'Escape') { onBack?.(); return; }
        if (isLocked) return;
        if (event.key === ' ' || event.key === 'k') { event.preventDefault(); handleTogglePlay(); }
        if ((event.key === 'ArrowLeft' || event.key === 'ArrowRight') && videoRef.current) {
          event.preventDefault();
          videoRef.current.currentTime = Math.max(0, Math.min(duration,
            videoRef.current.currentTime + (event.key === 'ArrowLeft' ? -10 : 10)));
        }
        setIsHUDVisible(true);
      }}
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
        touchAction: 'none',
      }}
      onPointerDown={(e) => {
        if ((e.target as HTMLElement).closest('button, input, [role="slider"], [role="dialog"]')) return;
        if (!e.isPrimary || e.button !== 0) return;
        e.currentTarget.setPointerCapture?.(e.pointerId);
        if (isLocked) {
          setShowLockNotice(true);
          showTemporarily('lock', () => setShowLockNotice(false), 2200);
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
      onPointerCancel={() => coordinatorRef.current?.cancel()}
      onLostPointerCapture={() => coordinatorRef.current?.cancel()}
      onPointerUp={(e) => {
        if (!isLocked && containerRef.current) {
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
          title={`${media.title} — ${stream.name}`}
          sandbox="allow-scripts allow-same-origin allow-forms allow-presentation"
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
          onPause={() => { setIsPlaying(false); saveProgress(); }}
          onEnded={() => {
            saveProgress();
            if (hasNextEpisode && theiaStore.getState().settings.autoPlayNext) onNextEpisode?.();
          }}
          onError={() => {
            setIsBuffering(false);
            setPlaybackError('This stream could not be played. Retry or choose another server.');
          }}
          onTimeUpdate={handleTimeUpdate}
          onLoadedMetadata={() => {
            if (videoRef.current) {
              const video = videoRef.current;
              setDuration(Number.isFinite(video.duration) ? video.duration : 0);
              if (requestedTime.current > 0 && Number.isFinite(video.duration)) {
                video.currentTime = Math.min(requestedTime.current, Math.max(0, video.duration - 1));
              }
              if (autoPlay) void video.play().catch(() => { setIsPlaying(false); setIsBuffering(false); });
            }
          }}
          onCanPlay={() => setIsBuffering(false)}
          onWaiting={() => setIsBuffering(true)}
          onPlaying={() => { setIsBuffering(false); setPlaybackError(null); }}
        >
          {subtitleUrl && <track key={subtitleUrl} kind="subtitles" src={subtitleUrl}
            label="Selected subtitles" default onLoad={(event) => { event.currentTarget.track.mode = 'showing'; }} />}
        </video>
      )}

      {playbackError && (
        <div role="alert" style={{ position: 'absolute', zIndex: 60, maxWidth: 380, margin: 20,
          padding: 24, borderRadius: 20, background: '#18181b', color: '#fff', textAlign: 'center' }}>
          <p style={{ marginBottom: 16 }}>{playbackError}</p>
          <TouchPill label="Retry stream" onClick={() => setRetryCount((count) => count + 1)} />
          {availableStreams.length > 1 && <TouchPill label="Choose server" onClick={() => {
            setPlaybackError(null); setIsStreamSelectorOpen(true);
          }} />}
          {onBack && <TouchPill label="Back" onClick={onBack} />}
        </div>
      )}
      {subtitleError && <div role="status" style={{ position: 'absolute', bottom: 120, zIndex: 55,
        padding: 12, borderRadius: 12, background: '#18181b', color: '#fff' }}>{subtitleError}</div>}
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
              label="Brightness"
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
              label="Volume"
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
            padding: 'clamp(12px, 3vw, 24px)',
            transition: 'opacity 0.25s ease',
          }}
          onClick={(e) => {
            // Surface taps are handled by the gesture coordinator.
          }}
        >
          {/* Top Bar */}
          <div className="player-topbar" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
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
            <div className="player-quick-actions" style={{ display: 'flex', alignItems: 'center', gap: 8, marginRight: 58, flexWrap: 'wrap' }}>
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
              gap: 'clamp(12px, 4vw, 36px)',
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
              label="Playback position"
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

import { readEmbedProgress, supportsEmbedProgress } from './embedProgress';
import { useVideoSubtitles } from './useVideoSubtitles';
import { preferredTrackIndex } from './languages';
import React, { useRef, useState, useEffect, useCallback } from 'react';
import Hls from 'hls.js';
import { theiaStore, proxyResourceUrl } from '@theia/core';
import { colors, TouchSlider, SubtitleStepper } from '@theia/ui';
import { VideoPlayerProps, AspectRatioMode } from './types';
import { playerStyles, PlayerIcon } from './playerChrome';
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
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const hlsRef = useRef<Hls | null>(null);
  const [audioTracks, setAudioTracks] = useState<Array<{ id: number; label: string }>>([]);
  const [audioTrack, setAudioTrack] = useState(-1);
  const timers = useRef(new Map<string, ReturnType<typeof setTimeout>>());
  const showTemporarily = (key: string, callback: () => void, delay: number) => {
    clearTimeout(timers.current.get(key));
    timers.current.set(key, setTimeout(callback, delay));
  };
  useEffect(() => () => { timers.current.forEach(clearTimeout); timers.current.clear(); }, []);
  const containerRef = useRef<HTMLDivElement>(null);

  // Player state
  const [isFullscreen, setIsFullscreen] = useState(false);
  useEffect(() => {
    const update = () => setIsFullscreen(document.fullscreenElement === containerRef.current);
    document.addEventListener('fullscreenchange', update);
    return () => document.removeEventListener('fullscreenchange', update);
  }, []);
  const toggleFullscreen = () => {
    const action = document.fullscreenElement ? document.exitFullscreen() : containerRef.current?.requestFullscreen?.();
    void action?.catch(() => {});
  };
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isBuffering, setIsBuffering] = useState(true);

  // Gesture HUD states
  const [isLocked, setIsLocked] = useState(false);
  const [showLockNotice, setShowLockNotice] = useState(false);
  const [isHUDVisible, setIsHUDVisible] = useState(true);
  const [hudActivity, setHudActivity] = useState(0);
  const [keyboardFocus, setKeyboardFocus] = useState(false);
  const lastMouseActivity = useRef(0);
  const [brightness, setBrightness] = useState(100);
  const [volume, setVolume] = useState(100);
  const previousVolume = useRef(100);
  const [showBrightness, setShowBrightness] = useState(false);
  const [showVolume, setShowVolume] = useState(false);
  const [scrubOffset, setScrubOffset] = useState<number | null>(null);
  const [doubleTapFeedback, setDoubleTapFeedback] = useState<'forward' | 'backward' | null>(null);
  const [aspectRatio, setAspectRatio] = useState<AspectRatioMode>(theiaStore.getState().settings.aspectRatio);
  const [aspectToast, setAspectToast] = useState<string | null>(null);

  // Subtitle Stepper modal state
  const [isSubModalOpen, setIsSubModalOpen] = useState(false);
  const [subtitleOffsetMs, setSubtitleOffsetMs] = useState(0);

  // Stream selector dropdown
  const [isStreamSelectorOpen, setIsStreamSelectorOpen] = useState(false);

  useEffect(() => {
    if (!isStreamSelectorOpen) return;
    const previousFocus = document.activeElement as HTMLElement | null;
    containerRef.current?.querySelector<HTMLButtonElement>('.player-servers button')?.focus();
    return () => { if (previousFocus?.isConnected) previousFocus.focus(); };
  }, [isStreamSelectorOpen]);

  // Auto-next episode countdown banner (last 30s)
  const [showNextOverlay, setShowNextOverlay] = useState(false);

  const [playbackError, setPlaybackError] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);
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

  const nextEpisodeCallback = useRef(onNextEpisode);
  nextEpisodeCallback.current = onNextEpisode;
  const embedSession = `${mediaKey}:${stream.id}:${stream.url}:${initialTime ?? 'auto'}`;
  const embedStart = React.useMemo(() => {
    const saved = theiaStore.getState().getProgress(media.id, episode?.id);
    if (videoRef.current && videoRef.current.currentTime > 0) return videoRef.current.currentTime;
    if (lastPosition.current?.key === mediaKey) return lastPosition.current.time;
    return initialTime ?? (theiaStore.getState().settings.autoResume && saved && !saved.completed ? saved.positionSeconds : 0);
  }, [embedSession]);
  const embedUrl = React.useMemo(() => {
    if (!supportsEmbedProgress(stream)) return stream.url;
    const url = new URL(stream.url);
    url.searchParams.set('startAt', String(Math.floor(Math.max(0, embedStart))));
    return url.href;
  }, [embedSession, embedStart]);

  useEffect(() => {
    if (!supportsEmbedProgress(stream)) return;
    let latest: ReturnType<typeof readEmbedProgress> = null;
    let lastSave = 0;
    let advanced = false;
    const flush = () => {
      if (!latest) return;
      const percentage = latest.time / latest.duration * 100;
      theiaStore.getState().updateProgress({
        mediaId: media.id, episodeId: episode?.id, season: episode?.season, episode: episode?.episode,
        positionSeconds: latest.time, durationSeconds: latest.duration, percentage,
        completed: latest.ended || percentage > 92, updatedAt: Date.now(),
      }, media);
      lastSave = Date.now();
    };
    const receive = (event: MessageEvent) => {
      if (event.origin !== 'https://vidlink.pro' || event.source !== iframeRef.current?.contentWindow) return;
      const expectedId = new URL(stream.url).pathname.split('/')[2];
      if (event.data?.data?.mtmdbId !== undefined && String(event.data.data.mtmdbId) !== expectedId) return;
      const progress = readEmbedProgress(event.data, episode);
      if (!progress) return;
      latest = progress;
      lastPosition.current = { key: mediaKey, time: progress.time };
      if (progress.event !== 'timeupdate' || Date.now() - lastSave >= 5000) flush();
      if (progress.ended && !advanced && hasNextEpisode && theiaStore.getState().settings.autoPlayNext) {
        advanced = true;
        nextEpisodeCallback.current?.();
      }
    };
    const hidden = () => { if (document.hidden) flush(); };
    window.addEventListener('message', receive);
    window.addEventListener('pagehide', flush);
    document.addEventListener('visibilitychange', hidden);
    return () => {
      flush();
      window.removeEventListener('message', receive);
      window.removeEventListener('pagehide', flush);
      document.removeEventListener('visibilitychange', hidden);
    };
  }, [embedSession, media, episode, hasNextEpisode]);

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
    setAudioTracks([]);
    setAudioTrack(-1);
    setIsPlaying(false);
    setIsBuffering(true);
    setPlaybackError(null);
    let hls: Hls | null = null;
    let networkRetries = 0;
    let mediaRetries = 0;
    let streamUrl = stream.url;
    if (stream.requiresProxy) {
      try {
        streamUrl = proxyResourceUrl(stream.url, stream.headers?.Referer || 'https://vixsrc.to/');
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
      hlsRef.current = hls;
      // The subtitle controller enables captions after choosing the preferred language.
      hls.subtitleDisplay = false;
      hls.on(Hls.Events.AUDIO_TRACKS_UPDATED, (_, data) => {
        setAudioTracks(data.audioTracks.map((track, index) => ({ id: index, label: track.name || track.lang || `Track ${index + 1}` })));
        const index = preferredTrackIndex(data.audioTracks, settings.preferredLanguages);
        if (index >= 0 && hls) hls.audioTrack = index;
      });
      hls.on(Hls.Events.AUDIO_TRACK_SWITCHED, (_, data) => setAudioTrack(data.id));
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
      hlsRef.current = null;
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

  const subtitles = useVideoSubtitles({ videoRef, hlsRef, stream,
    sessionKey: `${mediaKey}:${stream.id}:${stream.url}:${retryCount}`, offsetMs: subtitleOffsetMs });

  useEffect(() => {
    if (!isPlaying || !isHUDVisible || isSubModalOpen || isStreamSelectorOpen || keyboardFocus) return;
    const timer = setTimeout(() => setIsHUDVisible(false), 4000);
    return () => clearTimeout(timer);
  }, [isPlaying, isHUDVisible, isSubModalOpen, isStreamSelectorOpen, keyboardFocus, hudActivity, currentTime === 0]);

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
      onFocusCapture={(event) => {
        if ((event.target as HTMLElement).matches(':focus-visible')) {
          setKeyboardFocus(true); setIsHUDVisible(true);
        }
      }}
      onBlurCapture={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setKeyboardFocus(false);
      }}
      onKeyDownCapture={() => { if (!isLocked) setIsHUDVisible(true); }}
      onKeyDown={(event) => {
        if ((event.target as HTMLElement).closest('button, input, select, [role="slider"], [role="dialog"]')) return;
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
        setKeyboardFocus(false);
        if ((e.target as HTMLElement).closest('button, input, select, [role="slider"], [role="dialog"]')) return;
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
        if (e.pointerType === 'mouse' && !isLocked && Date.now() - lastMouseActivity.current > 250) {
          lastMouseActivity.current = Date.now();
          setIsHUDVisible(true); setHudActivity((value) => value + 1);
        }
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

      {stream.format === 'embed' && <p role="status" style={{ position: 'absolute', bottom: 12, left: 16, right: 16, zIndex: 40, background: '#09090bdd', padding: 10, pointerEvents: 'none' }}>
        {supportsEmbedProgress(stream) ? 'Progress saves on this device. This server may prefer its own saved position; choose a direct server for precise resume and Start over.' : 'This server does not support progress saving. Choose a direct server to use Continue Watching.'}
      </p>}
      {/* Media Element: Video or Iframe Embed */}
      {stream.format === 'embed' ? (
        <iframe
          ref={iframeRef}
          src={embedUrl}
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
          {subtitles.url && <track key={subtitles.url} kind="subtitles" src={subtitles.url}
            data-theia-subtitles={subtitles.selectedId}
            label={subtitles.tracks.find((track) => track.id === subtitles.selectedId)?.label || 'Selected subtitles'}
            default onLoad={(event) => subtitles.onExternalLoad(event.currentTarget)} />}
        </video>
      )}

      {playbackError && (
        <div role="alert" className="player-recovery">
          <span className="player-state-icon"><PlayerIcon name="server" /></span>
          <span className="player-eyebrow">PLAYBACK INTERRUPTED</span>
          <h3>Let’s get you back to watching.</h3>
          <p>{playbackError}</p>
          <div className="player-recovery-actions">
            <button type="button" className="player-primary" onClick={() => setRetryCount((count) => count + 1)}>Retry stream</button>
            {availableStreams.length > 1 && <button type="button" className="player-secondary" onClick={() => {
              setPlaybackError(null); setIsStreamSelectorOpen(true);
            }}>Choose server</button>}
            {onBack && <button type="button" className="player-secondary" onClick={onBack}>Back</button>}
          </div>
        </div>
      )}
      {subtitles.error && <div role="status" className="player-notice">{subtitles.error}</div>}
      {isBuffering && !playbackError && stream.format !== 'embed' && (
        <div className="player-buffering" role="status">
          <span className="player-spinner" />
          <span>{duration ? 'Buffering' : 'Preparing your stream'}</span>
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
          <span style={{ fontSize: '22px' }}><PlayerIcon name="sun" /></span>
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
          <span style={{ fontSize: '22px' }}><PlayerIcon name="volume" /></span>
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
            boxShadow: '0 8px 32px #0004',
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
            backgroundColor: 'rgba(20, 23, 28, 0.65)',
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
            border: '1px solid #ffffff20',
            boxShadow: '0 8px 32px #0004',
          }}
        >
          <PlayerIcon name={doubleTapFeedback === 'backward' ? 'rewind' : 'forward'} /><span style={{ marginLeft: 8 }}>10s</span>
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
          <PlayerIcon name="lock" />
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
              backgroundColor: '#e1edf0',
              border: 'none',
              color: '#000',
              fontWeight: 800,
              fontSize: '14px',
              cursor: 'pointer',
              touchAction: 'manipulation',
            }}
          >
            Unlock controls
          </button>
        </div>
      )}

      {/* Screen Lock Toggle Button (Always visible on touch) */}
      <button
        type="button"
        className="player-lock"
        tabIndex={isHUDVisible || isLocked ? 0 : -1}
        onClick={() => setIsLocked((prev) => !prev)}
        style={{
          position: 'absolute',
          visibility: isHUDVisible || isLocked ? 'visible' : 'hidden',
          top: 24,
          right: 24,
          zIndex: 40,
          backgroundColor: isLocked ? '#ffffff25' : 'rgba(9, 9, 11, 0.35)',
          border: '1px solid #ffffff20',
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
        <PlayerIcon name={isLocked ? 'lock' : 'unlock'} />
      </button>

      {/* Next Episode Floating Overlay Banner (last 30s) */}
      {showNextOverlay && hasNextEpisode && !isLocked && (
        <div
          style={{
            position: 'absolute',
            bottom: 160,
            maxWidth: 'calc(100% - 48px)',
            boxSizing: 'border-box',
            right: 24,
            zIndex: 35,
            backgroundColor: 'rgba(9, 9, 11, 0.95)',
            backdropFilter: 'blur(14px)',
            border: '1px solid #ffffff26',
            borderRadius: 20,
            padding: '16px 22px',
            display: 'flex',
            alignItems: 'center',
            gap: 16,
            boxShadow: '0 12px 40px #0006',
          }}
        >
          <div>
            <div style={{ fontSize: '11px', color: colors.accent.primary, fontWeight: 800, letterSpacing: '0.5px' }}>
              UP NEXT
            </div>
            <div style={{ fontSize: '15px', color: '#fff', fontWeight: 700, marginTop: 2 }}>
              Next episode starts soon
            </div>
          </div>
          <button
            type="button"
            onClick={onNextEpisode}
            style={{
              padding: '10px 18px',
              borderRadius: 12,
              backgroundColor: '#e1edf0',
              border: 'none',
              color: '#000',
              fontWeight: 800,
              fontSize: '14px',
              cursor: 'pointer',
              touchAction: 'manipulation',
            }}
          >
            Play now
          </button>
        </div>
      )}

      {stream.format === 'embed' && (
        <div className="player-embed-header">
          <div className="player-heading">
            {onBack && <button type="button" className="player-icon" aria-label="Back" onClick={onBack}><PlayerIcon name="back" /></button>}
            <div className="player-title-block">
              <span className="player-eyebrow">{episode ? `SEASON ${episode.season} · EPISODE ${episode.episode}` : 'NOW PLAYING'}</span>
              <h2>{media.title}</h2>
            </div>
          </div>
          {availableStreams.length > 1 && <button type="button" className="player-secondary" aria-label="Choose server" aria-expanded={isStreamSelectorOpen}
            onClick={() => setIsStreamSelectorOpen((prev) => !prev)}><PlayerIcon name="server" /><span>{stream.name}</span></button>}
        </div>
      )}
      {isStreamSelectorOpen && (
        <div className={`player-servers ${stream.format === 'embed' ? 'is-embed' : ''}`} role="dialog" aria-label="Playback servers"
          onKeyDown={(event) => { if (event.key === 'Escape') { event.stopPropagation(); setIsStreamSelectorOpen(false); } }}>
          <div className="player-servers-heading"><div><span className="player-eyebrow">PLAYBACK</span><h3>Choose a server</h3></div>
            <button type="button" className="player-icon" aria-label="Close server selector" onClick={() => setIsStreamSelectorOpen(false)}><PlayerIcon name="close" /></button></div>
          {availableStreams.map((source, index) => (
            <button type="button" key={source.id} className="player-server-option" aria-pressed={source.id === stream.id}
              onClick={() => { onSelectStream?.(source); setIsStreamSelectorOpen(false); }}>
              <span className="player-server-number">{String(index + 1).padStart(2, '0')}</span>
              <span className="player-server-label">{source.name}<small>{source.id === stream.id ? 'Currently playing' : 'Switch to this source'}</small></span>
              {source.id === stream.id && <PlayerIcon name="check" />}
            </button>
          ))}
        </div>
      )}

      <style>{playerStyles}</style>
      {/* Cinema controls keep the picture clear between the top and bottom gradients. */}
      {stream.format !== 'embed' && !isLocked && (
        <div className={`player-chrome ${isPlaying ? 'is-playing' : 'is-paused'} ${isHUDVisible ? '' : 'is-hidden'}`} aria-hidden={!isHUDVisible}>
          <div className="player-header">
            <div className="player-heading">
              {onBack && <button type="button" className="player-icon" onClick={onBack} aria-label="Back"><PlayerIcon name="back" /></button>}
              <div className="player-title-block">
                <span className="player-eyebrow">{episode ? `SEASON ${episode.season} · EPISODE ${episode.episode}` : 'NOW PLAYING'}</span>
                <h2>{media.title}</h2>
                {episode && <p>{episode.title}</p>}
              </div>
            </div>
            <div className="player-source">{stream.name}</div>
          </div>

          <div className="player-transport" style={{ visibility: isBuffering || playbackError ? 'hidden' : 'visible' }}>
            <button type="button" className="player-seek" aria-label="Seek back 10 seconds" onClick={() => {
              if (videoRef.current) videoRef.current.currentTime = Math.max(0, videoRef.current.currentTime - 10);
            }}><PlayerIcon name="rewind" /><span>10</span></button>
            <button type="button" className="player-play" onClick={handleTogglePlay} aria-label={isPlaying ? 'Pause' : 'Play'}>
              <PlayerIcon name={isPlaying ? 'pause' : 'play'} />
            </button>
            <button type="button" className="player-seek" aria-label="Seek forward 10 seconds" onClick={() => {
              if (videoRef.current) videoRef.current.currentTime = Math.min(duration, videoRef.current.currentTime + 10);
            }}><PlayerIcon name="forward" /><span>10</span></button>
          </div>

          <div className="player-footer">
            <div className="player-footer-rule" />
            <div className="player-timeline-meta"><span>{formatTime(currentTime)} <span className="player-time-divider">/ {formatTime(duration)}</span></span>
              <span>{duration > 0 ? `${formatTime(duration - currentTime)} remaining` : 'Loading stream'}</span></div>
            <input className="player-timeline" type="range" aria-label="Playback position" min={0} max={duration || 100} step={0.1}
              value={currentTime} disabled={!duration} style={{ '--progress': `${duration ? Math.min(100, currentTime / duration * 100) : 0}%` } as React.CSSProperties}
              onChange={(event) => { const time = Number(event.target.value); if (videoRef.current) { videoRef.current.currentTime = time; setCurrentTime(time); } }} />
            <div className="player-toolbar">
              <div className="player-toolbar-group">
                <button type="button" className="player-icon" aria-label={volume === 0 ? 'Unmute' : 'Mute'} onClick={() => {
                  if (volume > 0) previousVolume.current = volume;
                  const next = volume === 0 ? previousVolume.current : 0; setVolume(next); if (videoRef.current) videoRef.current.volume = next / 100;
                }}><PlayerIcon name={volume === 0 ? 'muted' : 'volume'} /></button>
                <input className="player-volume" type="range" aria-label="Volume" min={0} max={100} value={volume}
                  onChange={(event) => { const value = Number(event.target.value); setVolume(value); if (videoRef.current) videoRef.current.volume = value / 100; }} />
                {hasNextEpisode && onNextEpisode && <button type="button" className="player-text-button" onClick={onNextEpisode}><PlayerIcon name="next" /><span>Next episode</span></button>}
              </div>
              <div className="player-toolbar-group">
                {audioTracks.length > 1 && <select className="player-audio" aria-label="Audio language" value={audioTrack}
                  onChange={(event) => { if (hlsRef.current) hlsRef.current.audioTrack = Number(event.target.value); }}>
                  {audioTrack < 0 && <option value={-1}>Audio language</option>}
                  {audioTracks.map((track) => <option key={track.id} value={track.id}>{track.label}</option>)}
                </select>}
                {availableStreams.length > 1 && <button type="button" className="player-icon" aria-label="Choose server" title="Choose server" aria-expanded={isStreamSelectorOpen}
                  onClick={() => setIsStreamSelectorOpen((prev) => !prev)}><PlayerIcon name="server" /></button>}
                <button type="button" className="player-icon" aria-label="Subtitles & Sync" title="Subtitles & Sync" aria-haspopup="dialog" onClick={() => setIsSubModalOpen(true)}><PlayerIcon name="captions" /></button>
                <button type="button" className="player-icon" aria-label={`Aspect ratio: ${aspectRatio}`} title={`Aspect ratio: ${aspectRatio}`} onClick={handleCycleAspect}><PlayerIcon name="aspect" /></button>
                <button type="button" className="player-icon" aria-label={isFullscreen ? 'Exit fullscreen' : 'Enter fullscreen'} title={isFullscreen ? 'Exit fullscreen' : 'Enter fullscreen'} onClick={toggleFullscreen}><PlayerIcon name="fullscreen" /></button>
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
        tracks={subtitles.tracks}
        selectedTrackId={subtitles.selectedId}
        onSelectTrack={subtitles.select}
      />
    </div>
  );
};

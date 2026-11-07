import { useEffect, useRef, useState, RefObject } from 'react';
import Hls from 'hls.js';
import type { SubtitleTracksUpdatedData } from 'hls.js';
import { offsetSubtitlesVTT, proxyResourceUrl, StreamSource, SubtitleTrack, theiaStore } from '@theia/core';
import { preferredSubtitleIndex, SubtitleTiming } from './subtitles';

type Choice = SubtitleTrack & { source: 'external' | 'hls' | 'native'; index?: number; forced?: boolean; nativeTrack?: TextTrack };

export function useVideoSubtitles({ videoRef, hlsRef, stream, sessionKey, offsetMs }: {
  videoRef: RefObject<HTMLVideoElement>;
  hlsRef: RefObject<Hls | null>;
  stream: StreamSource;
  sessionKey: string;
  offsetMs: number;
}) {
  const [tracks, setTracks] = useState<Choice[]>([]);
  const [selectedId, setSelectedId] = useState('');
  const [external, setExternal] = useState<Choice | null>(null);
  const [url, setUrl] = useState('');
  const [error, setError] = useState<string | null>(null);
  const selectRef = useRef<(id: string) => void>(() => {});
  const syncTimingRef = useRef<() => void>(() => {});
  const offsetRef = useRef(offsetMs);
  offsetRef.current = offsetMs;

  useEffect(() => {
    const video = videoRef.current;
    const hls = hlsRef.current;
    if (!video || stream.format === 'embed') {
      setTracks([]); setSelectedId(''); setExternal(null); setError(null);
      return;
    }
    let disposed = false;
    let manualChoice: string | null = null;
    let selected = '';
    let selectionGeneration = 0;
    let choices: Choice[] = [];
    let hlsChoices: Choice[] = [];
    let nativeChoices: Choice[] = [];
    const externalChoices: Choice[] = (stream.subtitles || []).map((track) => ({ ...track, source: 'external' }));
    const preferences = theiaStore.getState().settings.preferredSubtitles;
    const timing = new SubtitleTiming();
    const externalTracks = () => Array.from(video.querySelectorAll<HTMLTrackElement>('track[data-theia-subtitles]'))
      .map((node) => node.track);
    const syncTiming = () => timing.apply(Array.from(video.textTracks || []).filter((track) => !externalTracks().includes(track)), offsetRef.current);
    syncTimingRef.current = syncTiming;

    const apply = (id: string) => {
      if (disposed) return;
      const choice = choices.find((track) => track.id === id);
      selected = choice?.id || '';
      setSelectedId(selected);
      setError(null);
      for (const node of video.querySelectorAll<HTMLTrackElement>('track[data-theia-subtitles]')) {
        node.track.mode = choice?.source === 'external' && node.dataset.theiaSubtitles === choice.id ? 'showing' : 'disabled';
      }
      if (hls) {
        hls.subtitleDisplay = choice?.source === 'hls';
        const generation = ++selectionGeneration;
        // HLS applies its own default after SUBTITLE_TRACKS_UPDATED returns. Select
        // after that event finishes and its native TextTrack nodes have been created.
        queueMicrotask(() => {
          if (disposed || generation !== selectionGeneration) return;
          hls.subtitleDisplay = choice?.source === 'hls';
          hls.subtitleTrack = choice?.source === 'hls' ? choice.index! : -1;
          syncTiming();
        });
      }
      for (const track of nativeChoices) {
        const mode = choice?.id === track.id ? 'showing' : 'disabled';
        if (track.nativeTrack && track.nativeTrack.mode !== mode) track.nativeTrack.mode = mode;
      }
      setExternal(choice?.source === 'external' ? choice : null);
      syncTiming();
    };
    const update = () => {
      if (disposed) return;
      choices = [...hlsChoices, ...externalChoices, ...nativeChoices];
      setTracks(choices);
      if (manualChoice !== null) {
        // An explicit Off must survive rendition/audio-group changes.
        apply(manualChoice);
      } else {
        const index = preferredSubtitleIndex(choices, preferences);
        apply(choices[index]?.id || '');
      }
    };
    selectRef.current = (id) => {
      manualChoice = id;
      apply(id);
      const choice = choices.find((track) => track.id === id);
      if (!id) theiaStore.getState().updateSettings({ preferredSubtitles: [] });
      else if (choice?.language) {
        const others = theiaStore.getState().settings.preferredSubtitles.filter((language) =>
          preferredSubtitleIndex([choice], [language]) < 0);
        theiaStore.getState().updateSettings({ preferredSubtitles: [choice.language, ...others] });
      }
    };
    const onHlsTracks = (_event: unknown, data: SubtitleTracksUpdatedData) => {
      hlsChoices = data.subtitleTracks.map((track, index) => ({
        id: `hls:${track.lang || ''}:${track.name || index}`,
        source: 'hls', index, language: track.lang || '', label: track.name || track.lang || `Subtitles ${index + 1}`,
        url: track.url, format: 'vtt', forced: track.forced, isDefault: track.default,
      }));
      update();
    };
    const onNativeTracks = () => {
      if (hls) return;
      nativeChoices = Array.from(video.textTracks || []).filter((track) =>
        (track.kind === 'subtitles' || track.kind === 'captions') && !externalTracks().includes(track)
      ).map((track, index) => ({
        id: `native:${index}:${track.language}:${track.label}`, source: 'native', nativeTrack: track,
        language: track.language, label: track.label || track.language || `Subtitles ${index + 1}`,
        url: '', format: 'vtt',
      }));
      update();
    };
    const onSubtitleError = (_event: unknown, data: { details?: string; frag?: { type?: string } }) => {
      if (selected.startsWith('hls:') && (data.details?.toLowerCase().startsWith('subtitle') || data.frag?.type === 'subtitle')) {
        setError('Subtitles could not be loaded. Try another track.');
      }
    };
    const onSubtitleLoaded = (_event: unknown, data: { success?: boolean }) => {
      syncTiming();
      setError(data.success === false ? 'Subtitles could not be loaded. Try another track.' : null);
    };
    if (hls) {
      hls.on(Hls.Events.SUBTITLE_TRACKS_UPDATED, onHlsTracks);
      hls.on(Hls.Events.SUBTITLE_FRAG_PROCESSED, onSubtitleLoaded);
      hls.on(Hls.Events.ERROR, onSubtitleError);
      onHlsTracks(undefined, { subtitleTracks: hls.subtitleTracks || [] });
    } else onNativeTracks();
    video.textTracks?.addEventListener?.('addtrack', onNativeTracks);
    video.addEventListener('loadedmetadata', onNativeTracks);
    video.addEventListener('timeupdate', syncTiming);
    return () => {
      disposed = true;
      selectRef.current = () => {};
      syncTimingRef.current = () => {};
      hls?.off(Hls.Events.SUBTITLE_TRACKS_UPDATED, onHlsTracks);
      hls?.off(Hls.Events.SUBTITLE_FRAG_PROCESSED, onSubtitleLoaded);
      hls?.off(Hls.Events.ERROR, onSubtitleError);
      video.textTracks?.removeEventListener?.('addtrack', onNativeTracks);
      video.removeEventListener('loadedmetadata', onNativeTracks);
      video.removeEventListener('timeupdate', syncTiming);
    };
  }, [sessionKey]);

  useEffect(() => { syncTimingRef.current(); }, [offsetMs, sessionKey]);

  useEffect(() => {
    setUrl('');
    if (!external) return;
    const controller = new AbortController();
    let objectUrl: string | undefined;
    async function load() {
      try {
        const resource = proxyResourceUrl(external!.url, stream.headers?.Referer || new URL(stream.url).origin + '/');
        const response = await fetch(resource, { signal: controller.signal });
        if (!response.ok) throw new Error('Subtitle unavailable');
        const content = await response.text();
        if (controller.signal.aborted) return;
        objectUrl = URL.createObjectURL(new Blob([offsetSubtitlesVTT(content, offsetMs)], { type: 'text/vtt' }));
        setUrl(objectUrl);
        setError(null);
      } catch {
        if (!controller.signal.aborted) setError('Subtitles could not be loaded. Try another track.');
      }
    }
    void load();
    return () => { controller.abort(); if (objectUrl) URL.revokeObjectURL(objectUrl); };
  }, [external, offsetMs, sessionKey]);

  return {
    tracks, selectedId, url, error,
    select: (id: string) => selectRef.current(id),
    onExternalLoad: (node: HTMLTrackElement) => {
      node.track.mode = external ? 'showing' : 'disabled';
    },
  };
}

import React, { useState, useRef, useEffect, lazy, Suspense } from 'react';
import { MediaItem, StreamSource, Episode, theiaStore, providerManager } from '@theia/core';
import { useWatchState, TouchPill } from '@theia/ui';
const VideoPlayer = lazy(() => import('@theia/player').then((module) => ({ default: module.VideoPlayer })));
import { BottomNav, TabType } from './components/BottomNav';
import { HomeView } from './components/HomeView';
import { MoviesView } from './components/MoviesView';
import { ShowsView } from './components/ShowsView';
import { ContinueWatchingView } from './components/ContinueWatchingView';
import { LibraryView } from './components/LibraryView';
import { SettingsView } from './components/SettingsView';
import { MediaDetailModal } from './components/MediaDetailModal';

export const App: React.FC = () => {
  const { history } = useWatchState();
  const [nextLoading, setNextLoading] = useState(false);
  const [nextError, setNextError] = useState('');
  const nextController = useRef<AbortController | null>(null);
  useEffect(() => () => nextController.current?.abort(), []);
  const [activeTab, setActiveTab] = useState<TabType>('home');
  const [selectedMedia, setSelectedMedia] = useState<MediaItem | null>(null);
  const [selectedEpisodeId, setSelectedEpisodeId] = useState<string>();
  const handleSelectMedia = (media: MediaItem, episodeId?: string) => {
    setSelectedMedia(media);
    setSelectedEpisodeId(episodeId);
  };

  // Active playing stream session
  const [activePlayingSession, setActivePlayingSession] = useState<{
    media: MediaItem;
    stream: StreamSource;
    availableStreams: StreamSource[];
    episode?: Episode;
  } | null>(null);

  const continueCount = history.filter((h) => !h.progress.completed && h.progress.percentage > 1).length;

  const handleStartPlay = (
    media: MediaItem,
    stream: StreamSource,
    availableStreams: StreamSource[],
    episode?: Episode
  ) => {
    setActivePlayingSession({
      media,
      stream,
      availableStreams,
      episode,
    });
  };

  const handleBack = () => {
    nextController.current?.abort();
    setNextLoading(false);
    setNextError('');
    setActivePlayingSession(null);
  };

  const handleNextEpisode = async () => {
    if (nextLoading || !activePlayingSession?.episode || !activePlayingSession.media.episodes) return;
    const { media, episode } = activePlayingSession;
    const episodes = media.episodes!;
    const index = episodes.findIndex((item) => item.id === episode.id);
    const next = episodes[index + 1];
    if (index < 0 || !next) return;
    nextController.current?.abort();
    const controller = new AbortController();
    nextController.current = controller;
    setNextLoading(true);
    setNextError('');
    try {
      const streams = await providerManager.resolveStreams({
        imdbId: media.imdbId || media.id, tmdbId: media.tmdbId, type: media.type,
        season: next.season, episode: next.episode, title: media.title, signal: controller.signal,
      });
      if (controller.signal.aborted) return;
      if (!streams.length) { setNextError('No servers found for the next episode. Please try again.'); return; }
      setActivePlayingSession({ media, episode: next, stream: streams[0], availableStreams: streams });
    } catch {
      if (!controller.signal.aborted) setNextError('Could not load the next episode. Please try again.');
    } finally {
      if (!controller.signal.aborted) setNextLoading(false);
    }
  };

  const hasNextEpisode = (() => {
    if (!activePlayingSession?.episode || !activePlayingSession.media.episodes) return false;
    const episodes = activePlayingSession.media.episodes;
    const currentIdx = episodes.findIndex((e) => e.id === activePlayingSession.episode?.id);
    return currentIdx >= 0 && currentIdx < episodes.length - 1;
  })();

  // If playing, render fullscreen VideoPlayer
  if (activePlayingSession) {
    return (
      <div style={{ position: 'fixed', inset: 0, zIndex: 1000, backgroundColor: '#000' }}>
        <Suspense fallback={<div role="status" className="player-loading">Loading player…</div>}>
        <VideoPlayer
          key={activePlayingSession.episode?.id || activePlayingSession.media.id}
          media={activePlayingSession.media}
          stream={activePlayingSession.stream}
          availableStreams={activePlayingSession.availableStreams}
          episode={activePlayingSession.episode}
          onBack={handleBack}
          onNextEpisode={handleNextEpisode}
          hasNextEpisode={hasNextEpisode}
          onSelectStream={(newStream) =>
            setActivePlayingSession({
              ...activePlayingSession,
              stream: newStream,
            })
          }
        />
        </Suspense>
        {(nextLoading || nextError) && <div className="episode-status" role={nextError ? 'alert' : 'status'}>
          <p>{nextLoading ? 'Finding servers for the next episode…' : nextError}</p>
          {nextError && <TouchPill label="Try again" onClick={handleNextEpisode} />}
          <TouchPill label="Back to browsing" onClick={handleBack} />
        </div>}
      </div>
    );
  }

  return (
    <main id="main-content" className="app-content" style={{ minHeight: '100%', flex: 1, backgroundColor: '#09090b', color: '#f4f4f5' }}>
      {activeTab === 'home' && (
        <HomeView
          onSelectMedia={handleSelectMedia}
          onQuickPlay={handleSelectMedia}
        />
      )}

      {activeTab === 'movies' && (
        <MoviesView
          onSelectMedia={handleSelectMedia}
          onQuickPlay={handleSelectMedia}
        />
      )}

      {activeTab === 'shows' && (
        <ShowsView
          onSelectMedia={handleSelectMedia}
          onQuickPlay={handleSelectMedia}
        />
      )}

      {activeTab === 'continue' && (
        <ContinueWatchingView
          onSelectMedia={handleSelectMedia}
          onQuickPlay={handleSelectMedia}
        />
      )}

      {activeTab === 'library' && (
        <LibraryView
          onSelectMedia={handleSelectMedia}
          onQuickPlay={handleSelectMedia}
        />
      )}

      {activeTab === 'settings' && <SettingsView />}

      <BottomNav
        activeTab={activeTab}
        onChangeTab={(tab) => setActiveTab(tab)}
        continueCount={continueCount}
      />

      {/* Media Detail & Stream Resolver Modal with Swipe-down Dismiss */}
      {selectedMedia && (
        <MediaDetailModal
          key={selectedMedia.id}
          media={selectedMedia}
          initialEpisodeId={selectedEpisodeId}
          isOpen={true}
          onClose={() => setSelectedMedia(null)}
          onPlay={handleStartPlay}
        />
      )}
    </main>
  );
};

export default App;

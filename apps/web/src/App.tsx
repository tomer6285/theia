import React, { useState } from 'react';
import { MediaItem, StreamSource, Episode, theiaStore } from '@theia/core';
import { VideoPlayer } from '@theia/player';
import { BottomNav, TabType } from './components/BottomNav';
import { DiscoverView } from './components/DiscoverView';
import { ContinueWatchingView } from './components/ContinueWatchingView';
import { LibraryView } from './components/LibraryView';
import { SettingsView } from './components/SettingsView';
import { MediaDetailModal } from './components/MediaDetailModal';

export const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<TabType>('discover');
  const [selectedMedia, setSelectedMedia] = useState<MediaItem | null>(null);

  // Active playing stream session
  const [activePlayingSession, setActivePlayingSession] = useState<{
    media: MediaItem;
    stream: StreamSource;
    availableStreams: StreamSource[];
    episode?: Episode;
  } | null>(null);

  const history = theiaStore.getState().history;
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

  const handleNextEpisode = () => {
    if (!activePlayingSession?.episode || !activePlayingSession.media.episodes) return;
    const episodes = activePlayingSession.media.episodes;
    const currentIdx = episodes.findIndex((e) => e.id === activePlayingSession.episode?.id);
    if (currentIdx >= 0 && currentIdx < episodes.length - 1) {
      const nextEp = episodes[currentIdx + 1];
      setActivePlayingSession({
        ...activePlayingSession,
        episode: nextEp,
      });
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
        <VideoPlayer
          media={activePlayingSession.media}
          stream={activePlayingSession.stream}
          availableStreams={activePlayingSession.availableStreams}
          episode={activePlayingSession.episode}
          onBack={() => setActivePlayingSession(null)}
          onNextEpisode={handleNextEpisode}
          hasNextEpisode={hasNextEpisode}
          onSelectStream={(newStream) =>
            setActivePlayingSession({
              ...activePlayingSession,
              stream: newStream,
            })
          }
        />
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#09090b', color: '#f4f4f5' }}>
      {activeTab === 'discover' && <DiscoverView onSelectMedia={(m) => setSelectedMedia(m)} />}
      {activeTab === 'continue' && <ContinueWatchingView onSelectMedia={(m) => setSelectedMedia(m)} />}
      {activeTab === 'library' && <LibraryView onSelectMedia={(m) => setSelectedMedia(m)} />}
      {activeTab === 'settings' && <SettingsView />}

      <BottomNav
        activeTab={activeTab}
        onChangeTab={(tab) => setActiveTab(tab)}
        continueCount={continueCount}
      />

      {/* Media Detail & Stream Resolver Modal */}
      {selectedMedia && (
        <MediaDetailModal
          media={selectedMedia}
          isOpen={true}
          onClose={() => setSelectedMedia(null)}
          onPlay={handleStartPlay}
        />
      )}
    </div>
  );
};

export default App;

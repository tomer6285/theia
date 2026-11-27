import React, { useState } from 'react';
import { theiaStore, type MediaItem } from '@theia/core';
import { MediaCard, useWatchState } from '@theia/ui';
import { groupHistory, HistoryCard } from './HistoryCard';
import { HistoryConfirmation } from './HistoryConfirmation';
import { HistoryOptions } from './HistoryOptions';
import { Watchlists } from './Watchlists';
import styles from './HistoryCard.module.css';

interface LibraryViewProps {
  onSelectMedia: (media: MediaItem, episodeId?: string) => void;
  onQuickPlay?: (media: MediaItem) => void;
}

export const LibraryView: React.FC<LibraryViewProps> = ({ onSelectMedia, onQuickPlay }) => {
  useWatchState();
  const [activeTab, setActiveTab] = useState<'favorites' | 'history' | 'lists'>('favorites');
  const [confirmClear, setConfirmClear] = useState(false);
  const { favorites, history } = theiaStore.getState();
  const historyGroups = activeTab === 'history' ? groupHistory(history) : [];
  const count = historyGroups.length;

  return (
    <div className={styles.library}>
      <h1>Library</h1>
      <div className={styles.tabs} role="group" aria-label="Library sections">
        <button type="button" aria-pressed={activeTab === 'favorites'}
          onClick={() => setActiveTab('favorites')}>Favorites</button>
        <button type="button" aria-pressed={activeTab === 'history'}
          onClick={() => setActiveTab('history')}>History</button>
        <button type="button" aria-pressed={activeTab === 'lists'}
          onClick={() => setActiveTab('lists')}>Lists</button>
      </div>
      {activeTab === 'lists' ? <Watchlists onSelectMedia={onSelectMedia} /> : activeTab === 'favorites' ? (
        favorites.length === 0 ? (
          <div className={styles.empty}>
            <h2>No favorites yet</h2>
            <p>Save a movie or show to find it here.</p>
          </div>
        ) : (
          <div className={styles.favorites}>
            {favorites.map(item => (
              <MediaCard key={item.id} media={item} width="100%"
                onPress={() => onSelectMedia(item)} onQuickPlay={onQuickPlay}
                progress={theiaStore.getState().getProgress(item.id)} isFavorite
                onToggleFavorite={() => theiaStore.getState().toggleFavorite(item)} />
            ))}
          </div>
        )
      ) : count === 0 ? (
        <div className={styles.empty}>
          <h2>No watch history yet</h2>
          <p>Movies and episodes you watch will appear here.</p>
        </div>
      ) : (
        <section className={styles.listing} aria-label="Recently watched">
          <header className={styles.toolbar}>
            <div><h2>Recently watched</h2><span>{count} {count === 1 ? 'title' : 'titles'}</span></div>
            <HistoryOptions label="History options">
              {close => (
                <button type="button" className={styles.danger} onClick={() => {
                  close();
                  setConfirmClear(true);
                }}>Clear history</button>
              )}
            </HistoryOptions>
          </header>
          {historyGroups.map(entries => (
            <HistoryCard key={`${entries[0].media.type}:${entries[0].media.id}`}
              entries={entries} onSelectMedia={onSelectMedia} />
          ))}
        </section>
      )}
      {confirmClear && (
        <HistoryConfirmation title="Clear history?" action="Clear history" onCancel={() => setConfirmClear(false)}
          onConfirm={() => {
            setConfirmClear(false);
            theiaStore.getState().clearHistory();
          }}>
          This will remove all titles and their saved watch progress from your history.
        </HistoryConfirmation>
      )}
    </div>
  );
};

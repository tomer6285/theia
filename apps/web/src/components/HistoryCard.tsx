import React, { useId, useState } from 'react';
import { MediaItem, WatchHistoryItem, theiaStore } from '@theia/core';
import { HistoryConfirmation } from './HistoryConfirmation';
import { useHistoryArtwork } from './HistoryMediaCard';
import { HistoryOptions } from './HistoryOptions';
import styles from './HistoryCard.module.css';

export function groupHistory(history: WatchHistoryItem[]): WatchHistoryItem[][] {
  const groups = new Map<string, WatchHistoryItem[]>();
  for (const entry of [...history].sort((a, b) => b.lastWatchedAt - a.lastWatchedAt)) {
    const key = `${entry.media.type}:${entry.media.id}`;
    const group = groups.get(key);
    if (group) group.push(entry);
    else groups.set(key, [entry]);
  }
  return [...groups.values()];
}

function episodeDetails(entry: WatchHistoryItem, entries: WatchHistoryItem[]) {
  const id = entry.progress.episodeId;
  const metadata = entries.flatMap(({ media }) => [
    ...(media.episodes ?? []), ...(media.seasons?.flatMap(s => s.episodes) ?? []),
  ]).find(episode => episode.id === id);
  const season = entry.progress.season ?? metadata?.season;
  const episode = entry.progress.episode ?? metadata?.episode;
  return {
    season,
    episode,
    label: season !== undefined && episode !== undefined
      ? `S${season} E${episode}${metadata?.title ? ` · ${metadata.title}` : ''}`
      : metadata?.title ?? (id ? `Episode ${id}` : 'Series playback'),
  };
}

export const HistoryCard: React.FC<{
  entries: WatchHistoryItem[];
  onSelectMedia: (media: MediaItem, episodeId?: string) => void;
}> = ({ entries, onSelectMedia }) => {
  const [expanded, setExpanded] = useState(false);
  const [removal, setRemoval] = useState<{ entry: WatchHistoryItem; label: string } | 'title'>();
  const [failedArtwork, setFailedArtwork] = useState<string>();
  const panelId = useId();
  const { media, progress } = entries[0];
  const artwork = useHistoryArtwork(media);
  const isShow = media.type === 'series';
  const episodeCount = entries.filter(entry => entry.progress.episodeId).length;
  const episodeCountLabel = `${episodeCount} ${episodeCount === 1 ? 'episode' : 'episodes'} watched`;
  const latestEpisode = episodeDetails(entries[0], entries).label;
  const percentage = Math.max(0, Math.min(100, progress.percentage));
  const canResume = !progress.completed && (progress.positionSeconds > 0 || percentage > 0);
  const remainingMinutes = Math.round(Math.max(0, progress.durationSeconds - progress.positionSeconds) / 60);
  const status = progress.completed
    ? (isShow ? '✓ Episode completed' : '✓ Completed')
    : canResume && remainingMinutes > 0 ? `${remainingMinutes} min left` : 'In progress';
  const isFavorite = theiaStore.getState().isFavorite(media.id);
  const closeConfirmation = () => setRemoval(undefined);
  const removalKind = removal === 'title' ? (isShow ? 'show' : 'movie') : 'episode';

  const seasons = new Map<number | undefined, { entry: WatchHistoryItem; label: string }[]>();
  if (expanded) {
    const sorted = entries.map(entry => ({ entry, ...episodeDetails(entry, entries) }))
      .sort((a, b) => (a.season ?? Infinity) - (b.season ?? Infinity)
        || (a.episode ?? Infinity) - (b.episode ?? Infinity));
    for (const item of sorted) {
      const season = seasons.get(item.season);
      if (season) season.push(item);
      else seasons.set(item.season, [item]);
    }
  }

  const remove = (entry: WatchHistoryItem) =>
    theiaStore.getState().removeHistoryEntry(entry.media.id, entry.progress.episodeId);

  return (
    <article className={styles.row}>
      <div className={styles.item}>
        <button type="button" className={styles.titleButton} aria-label={`View ${media.title}`}
          onClick={() => onSelectMedia(media, isShow ? undefined : progress.episodeId)}>
          <span className={styles.poster}>
            {artwork && artwork !== failedArtwork
              ? <img src={artwork} alt="" loading="lazy" decoding="async" onError={() => setFailedArtwork(artwork)} />
              : <span aria-hidden="true">{media.title.slice(0, 1)}</span>}
          </span>
          <span className={styles.titleText}>
            <span className={styles.name}>{media.title}</span>
            <span className={styles.meta}>
              {isShow ? `${latestEpisode} · ${episodeCountLabel}` : media.year || 'Movie'}
            </span>
          </span>
        </button>
        <div className={styles.state}>
          <span className={styles.meta}>{status}</span>
          {!progress.completed && (
            <progress className={styles.progress} aria-label={`${media.title} playback progress`} max={100} value={percentage} />
          )}
        </div>
        <div className={styles.tools}>
          {canResume && (
            <button type="button" className={styles.resume} aria-label={`Resume ${media.title}`}
              onClick={() => onSelectMedia(media, progress.episodeId)}>
              <span aria-hidden="true">▶</span><span className={styles.resumeLabel}>Resume</span>
            </button>
          )}
          {isShow && (
            <button type="button" className={styles.icon} aria-expanded={expanded}
              aria-controls={panelId} aria-label={`Episode history for ${media.title}`}
              onClick={() => setExpanded(value => !value)}>
              <span aria-hidden="true" className={styles.chevron} />
            </button>
          )}
          <HistoryOptions label={`Options for ${media.title}`}>
            {close => (
              <>
                <button type="button" onClick={() => {
                  close();
                  theiaStore.getState().toggleFavorite(media);
                }}>{isFavorite ? 'Remove from favorites' : 'Add to favorites'}</button>
                <button type="button" className={styles.danger}
                  aria-label={`Remove ${media.title}${isShow ? ' show' : ''} from History`} onClick={() => {
                    close();
                    setRemoval('title');
                  }}>Remove from history</button>
              </>
            )}
          </HistoryOptions>
        </div>
      </div>
      {isShow && (
        <div id={panelId} className={styles.episodes} hidden={!expanded}>
          {[...seasons].map(([season, items]) => {
            const heading = season === undefined ? 'Other episodes' : `Season ${season}`;
            return (
              <section key={season ?? 'unknown'} aria-label={heading} className={styles.season}>
                <h3>{heading}</h3>
                {items.map(({ entry, label }) => (
                  <div key={entry.progress.episodeId ?? 'series'} className={styles.episode}>
                    <button type="button" className={styles.episodeTitle}
                      onClick={() => onSelectMedia(entry.media, entry.progress.episodeId)}>{label}</button>
                    <span className={styles.meta}>
                      {entry.progress.completed ? 'Completed' : `${Math.round(entry.progress.percentage)}% watched`}
                    </span>
                    <button type="button" className={styles.icon} aria-label={`Remove ${media.title} ${label} from History`}
                      onClick={() => setRemoval({ entry, label })}>×</button>
                  </div>
                ))}
              </section>
            );
          })}
        </div>
      )}
      {removal && (
        <HistoryConfirmation title={`Remove ${removalKind} from history?`} action={`Remove ${removalKind}`}
          onCancel={closeConfirmation} onConfirm={() => {
            closeConfirmation();
            if (removal === 'title') entries.forEach(remove);
            else remove(removal.entry);
          }}>
          This will remove <strong>{media.title}{removal !== 'title' && ` · ${removal.label}`}</strong>{' '}
          and its saved watch progress from your history.
        </HistoryConfirmation>
      )}
    </article>
  );
};

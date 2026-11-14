import React, { useId, useState } from 'react';
import { MediaItem, WatchHistoryItem, theiaStore } from '@theia/core';
import { colors, MediaCard } from '@theia/ui';

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

const actionStyle: React.CSSProperties = {
  background: 'none', border: 'none', minHeight: 44, cursor: 'pointer',
  padding: '8px 0', textAlign: 'left', color: colors.accent.primary,
};

export const HistoryCard: React.FC<{
  entries: WatchHistoryItem[];
  onSelectMedia: (media: MediaItem, episodeId?: string) => void;
}> = ({ entries, onSelectMedia }) => {
  const [expanded, setExpanded] = useState(false);
  const panelId = useId();
  const { media, progress } = entries[0];
  const isShow = media.type === 'series';
  const episodes = entries.filter(entry => entry.progress.episodeId);
  const seasons = new Map<number | undefined, WatchHistoryItem[]>();
  for (const entry of [...entries].sort((a, b) => {
    const first = episodeDetails(a, entries);
    const second = episodeDetails(b, entries);
    return (first.season ?? Infinity) - (second.season ?? Infinity)
      || (first.episode ?? Infinity) - (second.episode ?? Infinity);
  })) {
    const season = episodeDetails(entry, entries).season;
    seasons.set(season, [...(seasons.get(season) ?? []), entry]);
  }
  const remove = (entry: WatchHistoryItem) =>
    theiaStore.getState().removeHistoryEntry(entry.media.id, entry.progress.episodeId);

  return (
    <div style={{ minWidth: 0, alignSelf: 'start' }}>
      <MediaCard media={media} width="100%" progress={progress}
        onPress={() => onSelectMedia(media, isShow ? undefined : progress.episodeId)}
        onQuickPlay={() => onSelectMedia(media, progress.episodeId)}
        isFavorite={theiaStore.getState().isFavorite(media.id)}
        onToggleFavorite={() => theiaStore.getState().toggleFavorite(media)} />
      {isShow && (
        <>
          <p style={{ color: colors.text.secondary, fontSize: 12, margin: '8px 0 4px' }}>
            Last watched: {episodeDetails(entries[0], entries).label}
          </p>
          <p style={{ color: colors.text.muted, fontSize: 12, margin: 0 }}>
            {episodes.length} {episodes.length === 1 ? 'episode' : 'episodes'} watched
          </p>
          <button type="button" style={actionStyle} aria-expanded={expanded}
            aria-controls={panelId} aria-label={`Episode history for ${media.title}`}
            onClick={() => setExpanded(value => !value)}>
            Episode history {expanded ? '▴' : '▾'}
          </button>
          {expanded && (
            <div id={panelId} style={{ borderTop: `1px solid ${colors.border.subtle}` }}>
              {[...seasons].map(([season, items]) => (
                <section key={season ?? 'unknown'} aria-label={season === undefined ? 'Other episodes' : `Season ${season}`}>
                  <h4 style={{ color: colors.text.secondary, margin: '12px 0 4px', fontSize: 13 }}>
                    {season === undefined ? 'Other episodes' : `Season ${season}`}
                  </h4>
                  {items.map(entry => {
                    const label = episodeDetails(entry, entries).label;
                    return (
                      <div key={entry.progress.episodeId ?? 'series'} style={{ padding: '4px 0 8px' }}>
                        <button type="button" style={{ ...actionStyle, width: '100%' }}
                          onClick={() => onSelectMedia(entry.media, entry.progress.episodeId)}>{label}</button>
                        <progress aria-label={`${label} progress`} max={100}
                          value={entry.progress.completed ? 100 : entry.progress.percentage}
                          style={{ width: '100%', accentColor: colors.accent.primary }} />
                        <span style={{ color: colors.text.muted, fontSize: 12 }}>
                          {entry.progress.completed ? 'Completed' : `${Math.round(entry.progress.percentage)}% watched`}
                        </span>
                        <button type="button" aria-label={`Remove ${media.title} ${label} from History`}
                          style={{ ...actionStyle, color: colors.status.danger, display: 'block' }}
                          onClick={() => remove(entry)}>Remove episode</button>
                      </div>
                    );
                  })}
                </section>
              ))}
            </div>
          )}
        </>
      )}
      <button type="button" aria-label={`Remove ${media.title}${isShow ? ' show' : ''} from History`}
        onClick={() => entries.forEach(remove)}
        style={{ ...actionStyle, color: colors.status.danger, display: 'block' }}>
        {isShow ? 'Remove show from history' : 'Remove from History'}
      </button>
    </div>
  );
};

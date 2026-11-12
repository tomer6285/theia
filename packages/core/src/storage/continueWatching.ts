import { Episode, WatchHistoryItem } from '../types';

export interface ContinueWatchingItem extends WatchHistoryItem {
  nextEpisode?: Episode;
}

export const CONTINUE_WATCHING_MAX_AGE_MS = 60 * 24 * 60 * 60 * 1000;

/** Latest activity wins, including completed episodes, so old episodes never resurface. */
export function getContinueWatching(history: WatchHistoryItem[], now = Date.now()): ContinueWatchingItem[] {
  const seen = new Set<string>();
  return [...history].sort((a, b) => b.lastWatchedAt - a.lastWatchedAt).flatMap((item) => {
    if (seen.has(item.media.id)) return [];
    seen.add(item.media.id);
    if (item.dismissedFromContinueWatching || item.lastWatchedAt < now - CONTINUE_WATCHING_MAX_AGE_MS) return [];
    if (!item.progress.completed) return item.progress.positionSeconds > 0 ? [item] : [];
    if (item.media.type !== 'series') return [];
    const episodes = [...(item.media.episodes || [])].filter(e => e.season > 0)
      .sort((a, b) => a.season - b.season || a.episode - b.episode);
    const index = episodes.findIndex(e => e.id === item.progress.episodeId);
    const next = index >= 0 ? episodes[index + 1] : undefined;
    if (!next || (next.released && Date.parse(next.released) > now)) return [];
    return [{ ...item, nextEpisode: next }];
  });
}

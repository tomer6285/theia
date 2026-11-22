import { trackTraktPlayback, type Episode, type MediaItem } from '@theia/core';

export function createScrobbleSession(media: MediaItem, episode?: Episode) {
  let playing = false;
  let started = false;
  let completed = false;

  return (event: 'playing' | 'progress' | 'pause' | 'stop' | 'end', position: number, duration: number) => {
    if (completed || !Number.isFinite(position) || !Number.isFinite(duration) || duration <= 0) return;
    const percentage = position / duration * 100;
    if (event === 'playing' && !playing) {
      trackTraktPlayback('start', media, episode, percentage);
      playing = started = true;
    }
    if (!started || (event === 'progress' && !playing)) return;
    if (event === 'end' || (percentage > 80 && event !== 'playing')) {
      trackTraktPlayback('stop', media, episode, event === 'end' ? 100 : percentage);
      completed = true;
      playing = false;
    } else if (playing && (event === 'pause' || event === 'stop')) {
      trackTraktPlayback(event, media, episode, percentage);
      playing = false;
    }
  };
}

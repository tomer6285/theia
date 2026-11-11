import { Episode, StreamSource } from '@theia/core';

// VidLink's documented PLAYER_EVENT / startAt API: https://vidlink.pro/
export function supportsEmbedProgress(stream: StreamSource): boolean {
  try { return stream.format === 'embed' && stream.provider === 'vidlink' && new URL(stream.url).origin === 'https://vidlink.pro'; }
  catch { return false; }
}

export function readEmbedProgress(data: unknown, episode?: Episode): { time: number; duration: number; ended: boolean; event: string } | null {
  if (!data || typeof data !== 'object') return null;
  const message = data as Record<string, any>;
  if (message.type !== 'PLAYER_EVENT' || !message.data || typeof message.data !== 'object') return null;
  const value = message.data;
  if (!['play', 'pause', 'seeked', 'ended', 'timeupdate'].includes(value.event)
    || !Number.isFinite(value.currentTime) || value.currentTime < 0
    || !Number.isFinite(value.duration) || value.duration <= 0
    || (episode && (Number(value.season) !== episode.season || Number(value.episode) !== episode.episode))
    || (!episode && value.mediaType !== 'movie')) return null;
  return { time: Math.min(value.currentTime, value.duration), duration: value.duration, ended: value.event === 'ended', event: value.event };
}

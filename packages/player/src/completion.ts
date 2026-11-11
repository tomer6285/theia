import type { CompletionPolicy } from './types';

export const DEFAULT_COMPLETION_POLICY: CompletionPolicy = {
  minimumPercentage: 90,
  movieRemainingSeconds: 300,
  episodeRemainingSeconds: 90,
};

/** Credits metadata is authoritative only when it fits this stream's timeline. */
export function isPlaybackCompleted(position: number, duration: number, ended: boolean,
  isEpisode: boolean, creditsStartSeconds?: number, overrides?: Partial<CompletionPolicy>): boolean {
  if (!Number.isFinite(position) || !Number.isFinite(duration) || duration <= 0 || position <= 0) return false;
  if (ended) return true;
  if (creditsStartSeconds !== undefined && Number.isFinite(creditsStartSeconds)
    && creditsStartSeconds > 0 && creditsStartSeconds < duration) return position >= creditsStartSeconds;
  const policy = { ...DEFAULT_COMPLETION_POLICY, ...overrides };
  return position / duration * 100 >= policy.minimumPercentage
    && duration - position <= (isEpisode ? policy.episodeRemainingSeconds : policy.movieRemainingSeconds);
}

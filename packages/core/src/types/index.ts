export type MediaType = 'movie' | 'series';

export interface Episode {
  id: string; // e.g., 'tt0903747:1:1'
  title: string;
  season: number;
  episode: number;
  overview?: string;
  thumbnail?: string;
  released?: string;
  rating?: string;
}

export interface SeasonInfo {
  season: number;
  episodes: Episode[];
}

export interface MediaItem {
  id: string; // IMDb ID (e.g., 'tt1375666')
  imdbId?: string;
  tmdbId?: string;
  type: MediaType;
  title: string;
  year?: string;
  poster?: string;
  background?: string;
  description?: string;
  genres?: string[];
  rating?: string;
  runtime?: string;
  cast?: string[];
  director?: string[];
  writer?: string[];
  status?: string;
  episodes?: Episode[];
  seasons?: SeasonInfo[];
}

export interface SubtitleTrack {
  id: string;
  language: string; // e.g. "en", "es", "fr"
  label: string;
  url: string;
  format: 'vtt' | 'srt';
  isDefault?: boolean;
}

export type StreamFormat = 'hls' | 'mp4' | 'embed';

export interface StreamSource {
  id: string;
  provider: 'vidlink' | 'vixsrc' | 'vidora' | string;
  name: string;
  quality: 'auto' | '1080p' | '720p' | '480p' | '360p' | string;
  url: string;
  format: StreamFormat;
  headers?: Record<string, string>;
  subtitles?: SubtitleTrack[];
  requiresProxy?: boolean;
  priority?: number;
}

export interface ProviderQuery {
  imdbId: string;
  tmdbId?: string;
  type: MediaType;
  season?: number;
  episode?: number;
  title?: string;
  signal?: AbortSignal;
}

export interface IProvider {
  name: string;
  id: string;
  priority: number;
  resolveStreams(query: ProviderQuery): Promise<StreamSource[]>;
}

export interface WatchProgress {
  mediaId: string;
  episodeId?: string;
  season?: number;
  episode?: number;
  positionSeconds: number;
  durationSeconds: number;
  percentage: number;
  completed: boolean;
  updatedAt: number;
}

export interface WatchHistoryItem {
  media: MediaItem;
  progress: WatchProgress;
  lastWatchedAt: number;
}

export interface UserSettings {
  defaultPlayer: 'native' | 'hls';
  preferredLanguages: string[];
  preferredSubtitles: string[];
  serverPriority: string[];
  proxyUrl: string;
  autoPlayNext: boolean;
  autoResume: boolean;
  subtitleOffset: number; // in milliseconds
  aspectRatio: 'fit' | 'fill' | '16:9';
}

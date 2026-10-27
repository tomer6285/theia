import { StreamSource, MediaItem, Episode, SubtitleTrack } from '@theia/core';

export type AspectRatioMode = 'fit' | 'fill' | '16:9';

export interface VideoPlayerProps {
  stream: StreamSource;
  availableStreams?: StreamSource[];
  media: MediaItem;
  episode?: Episode;
  onBack?: () => void;
  onNextEpisode?: () => void;
  hasNextEpisode?: boolean;
  onSelectStream?: (stream: StreamSource) => void;
  autoPlay?: boolean;
  initialTime?: number;
}

export interface PlayerGestureState {
  isLocked: boolean;
  isHUDVisible: boolean;
  brightness: number; // 0 to 100
  volume: number;     // 0 to 100
  showBrightnessBadge: boolean;
  showVolumeBadge: boolean;
  scrubOffsetSeconds: number | null;
  targetScrubTime: number | null;
  doubleTapSeek: {
    direction: 'forward' | 'backward';
    timestamp: number;
  } | null;
  aspectRatio: AspectRatioMode;
  showAspectToast: boolean;
}

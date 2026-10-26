import React from 'react';
import { VideoPlayerProps } from './types';
import { VideoPlayerWeb } from './VideoPlayer.web';

/**
 * Universal VideoPlayer entry point.
 * Bundlers with platform extensions (.native.tsx vs .web.tsx) resolve automatically,
 * while this component provides the universal fallback.
 */
export const VideoPlayer: React.FC<VideoPlayerProps> = (props) => {
  return <VideoPlayerWeb {...props} />;
};

export default VideoPlayer;

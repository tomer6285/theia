import React, { useEffect, useState } from 'react';
import { cinemeta, type MediaItem, type MediaType } from '@theia/core';
import { MediaCard, type MediaCardProps } from '@theia/ui';

const artworkRequests = new Map<string, Promise<string | undefined>>();

function lookupArtwork(key: string, imdbId: string, type: MediaType) {
  const cached = artworkRequests.get(key);
  if (cached) return cached;

  const request = cinemeta.getDetails(imdbId, type).then(details => {
    const artwork = details?.poster || details?.background;
    if (!artwork) artworkRequests.delete(key);
    return artwork;
  }, () => {
    artworkRequests.delete(key);
    return undefined;
  });
  artworkRequests.set(key, request);
  return request;
}

export function useHistoryArtwork(media: MediaItem) {
  const imdbId = media.imdbId || media.id;
  const type = media.type;
  const key = !media.poster && !media.background && /^tt\d+$/.test(imdbId)
    ? `${type}:${imdbId}` : undefined;
  const [artwork, setArtwork] = useState<{ key: string; url: string }>();

  useEffect(() => {
    if (!key) return;
    let active = true;
    void lookupArtwork(key, imdbId, type).then(url => {
      if (active && url) setArtwork({ key, url });
    });
    return () => { active = false; };
  }, [key, imdbId, type]);

  return media.poster || media.background || (artwork?.key === key ? artwork?.url : undefined);
}

export function HistoryMediaCard({ media, ...props }: MediaCardProps) {
  const artwork = useHistoryArtwork(media);
  return <MediaCard {...props}
    media={artwork && !media.poster && !media.background ? { ...media, poster: artwork } : media} />;
}

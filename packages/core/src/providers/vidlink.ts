import { IProvider, ProviderQuery, StreamSource, SubtitleTrack } from '../types';
import { encryptVidlinkToken } from '../crypto/vidlink';

export class VidLinkProvider implements IProvider {
  name = 'VidLink';
  id = 'vidlink';
  priority = 100;
  private baseUrl = 'https://vidlink.pro';

  async resolveStreams(query: ProviderQuery): Promise<StreamSource[]> {
    const streams: StreamSource[] = [];
    const isTv = query.type === 'series' && query.season !== undefined && query.episode !== undefined;
    // VidLink's TV routes strictly require numeric TMDb ID (IMDb tt... triggers Next.js server crash 4082599258)
    const tvMediaId = query.tmdbId || (query.imdbId && !query.imdbId.startsWith('tt') ? query.imdbId : undefined);
    const movieMediaId = query.tmdbId || query.imdbId;
    const mediaId = isTv ? tvMediaId : movieMediaId;

    if (mediaId) {
      try {
        const tokenTarget = isTv ? `${mediaId}/${query.season}/${query.episode}` : mediaId;
        const token = encryptVidlinkToken(tokenTarget);

        const endpoint = isTv
          ? `${this.baseUrl}/api/b/tv/${token}?multiLang=1`
          : `${this.baseUrl}/api/b/movie/${token}?multiLang=1`;

        const res = await fetch(endpoint, {
          headers: {
            'Origin': this.baseUrl,
            'Referer': `${this.baseUrl}/`,
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          },
        });

        if (res.ok) {
          const data = await res.json();
          const subtitles: SubtitleTrack[] = [];
          if (Array.isArray(data.subtitles)) {
            data.subtitles.forEach((sub: any, idx: number) => {
              if (sub.url) {
                subtitles.push({
                  id: `vidlink-sub-${idx}`,
                  language: sub.lang || sub.label || 'en',
                  label: sub.label || sub.lang || `Track ${idx + 1}`,
                  url: sub.url,
                  format: sub.url.endsWith('.srt') ? 'srt' : 'vtt',
                });
              }
            });
          }

          // Direct m3u8 playlist if available
          if (data.stream?.playlist || data.stream?.url || data.url) {
            const streamUrl = data.stream?.playlist || data.stream?.url || data.url;
            streams.push({
              id: `vidlink-${query.imdbId || query.tmdbId}-hls`,
              provider: 'vidlink',
              name: 'VidLink (HLS)',
              quality: data.stream?.quality || 'auto',
              url: streamUrl,
              format: 'hls',
              headers: {
                'Referer': `${this.baseUrl}/`,
                'Origin': this.baseUrl,
              },
              subtitles,
              requiresProxy: true,
              priority: 100,
            });
          }

          // Multiple qualities if provided (supports both array and object dictionary format)
          if (data.stream?.qualities && typeof data.stream.qualities === 'object') {
            const qualityList = Array.isArray(data.stream.qualities)
              ? data.stream.qualities
              : Object.entries(data.stream.qualities).map(([key, val]: any) => ({
                  quality: key,
                  ...val,
                }));

            qualityList.forEach((q: any) => {
              if (q.url) {
                streams.push({
                  id: `vidlink-${query.imdbId || query.tmdbId}-${q.quality || 'res'}`,
                  provider: 'vidlink',
                  name: `VidLink (${q.quality || 'Auto'})`,
                  quality: q.quality || 'auto',
                  url: q.url,
                  format: q.url.includes('.m3u8') ? 'hls' : 'mp4',
                  headers: {
                    'Referer': `${this.baseUrl}/`,
                    'Origin': this.baseUrl,
                  },
                  subtitles,
                  requiresProxy: true,
                  priority: 95,
                });
              }
            });
          }
        }
      } catch (err) {
        console.warn('VidLink stream resolution error:', err);
      }
    }

    // Embed fallback / direct link
    // Only register VidLink TV embed if a numeric TMDb ID is known (prevents Next.js crash Digest 4082599258)
    if (isTv) {
      if (tvMediaId) {
        streams.push({
          id: `vidlink-${tvMediaId}-embed`,
          provider: 'vidlink',
          name: 'VidLink (Embed)',
          quality: 'auto',
          url: `${this.baseUrl}/tv/${tvMediaId}/${query.season}/${query.episode}`,
          format: 'embed',
          requiresProxy: false,
          priority: 80,
        });
      }
    } else if (movieMediaId) {
      streams.push({
        id: `vidlink-${movieMediaId}-embed`,
        provider: 'vidlink',
        name: 'VidLink (Embed)',
        quality: 'auto',
        url: `${this.baseUrl}/movie/${movieMediaId}`,
        format: 'embed',
        requiresProxy: false,
        priority: 80,
      });
    }

    return streams;
  }
}

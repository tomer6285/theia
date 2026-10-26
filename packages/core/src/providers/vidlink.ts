import { IProvider, ProviderQuery, StreamSource, SubtitleTrack } from '../types';
import { encryptVidlinkToken } from '../crypto/vidlink';

export class VidLinkProvider implements IProvider {
  name = 'VidLink';
  id = 'vidlink';
  priority = 100;
  private baseUrl = 'https://vidlink.pro';

  async resolveStreams(query: ProviderQuery): Promise<StreamSource[]> {
    const streams: StreamSource[] = [];
    const mediaId = query.imdbId || query.tmdbId;
    if (!mediaId) return streams;

    try {
      const isTv = query.type === 'series' && query.season && query.episode;
      // In VidLink TV tokens, often mediaId is tmdb/imdb or formatted as id/season/episode
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
            id: `vidlink-${query.imdbId}-hls`,
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

        // Multiple qualities if provided
        if (Array.isArray(data.stream?.qualities)) {
          data.stream.qualities.forEach((q: any) => {
            if (q.url) {
              streams.push({
                id: `vidlink-${query.imdbId}-${q.quality || 'res'}`,
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

    // Embed fallback / direct link
    const embedUrl = query.type === 'series' && query.season && query.episode
      ? `${this.baseUrl}/tv/${mediaId}/${query.season}/${query.episode}`
      : `${this.baseUrl}/movie/${mediaId}`;

    streams.push({
      id: `vidlink-${query.imdbId}-embed`,
      provider: 'vidlink',
      name: 'VidLink (Embed)',
      quality: 'auto',
      url: embedUrl,
      format: 'embed',
      requiresProxy: false,
      priority: 80,
    });

    return streams;
  }
}

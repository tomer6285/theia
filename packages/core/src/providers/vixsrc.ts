import { IProvider, ProviderQuery, StreamSource } from '../types';

export class VixSrcProvider implements IProvider {
  name = 'VixSrc';
  id = 'vixsrc';
  priority = 90;
  private baseUrl = 'https://vixsrc.to';

  async resolveStreams(query: ProviderQuery): Promise<StreamSource[]> {
    const streams: StreamSource[] = [];
    const mediaId = query.imdbId || query.tmdbId;
    if (!mediaId) return streams;

    const embedUrl = query.type === 'series' && query.season && query.episode
      ? `${this.baseUrl}/tv/${mediaId}/${query.season}/${query.episode}`
      : `${this.baseUrl}/movie/${mediaId}`;

    try {
      const res = await fetch(embedUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Referer': `${this.baseUrl}/`,
        },
      });

      if (res.ok) {
        const html = await res.text();
        // Match m3u8 playlists in the page source
        const m3u8Regex = /https?:\/\/[^"'\s]+\.m3u8[^"'\s]*/g;
        const matches = html.match(m3u8Regex);

        if (matches && matches.length > 0) {
          const uniqueUrls = Array.from(new Set(matches));
          uniqueUrls.forEach((url, idx) => {
            streams.push({
              id: `vixsrc-${query.imdbId}-stream-${idx}`,
              provider: 'vixsrc',
              name: `VixSrc Stream ${idx + 1}`,
              quality: 'auto',
              url,
              format: 'hls',
              headers: {
                'Referer': `${this.baseUrl}/`,
                'Origin': this.baseUrl,
              },
              requiresProxy: true,
              priority: 90 - idx,
            });
          });
        }
      }
    } catch (err) {
      console.warn('VixSrc scraping error:', err);
    }

    // Always provide embed stream
    streams.push({
      id: `vixsrc-${query.imdbId}-embed`,
      provider: 'vixsrc',
      name: 'VixSrc (Embed)',
      quality: 'auto',
      url: embedUrl,
      format: 'embed',
      headers: {
        'Referer': `${this.baseUrl}/`,
      },
      requiresProxy: false,
      priority: 75,
    });

    return streams;
  }
}

import { IProvider, ProviderQuery, StreamSource } from '../types';

export class VidoraProvider implements IProvider {
  name = 'Vidora';
  id = 'vidora';
  priority = 80;
  private baseUrl = 'https://vidora.su';

  async resolveStreams(query: ProviderQuery): Promise<StreamSource[]> {
    const streams: StreamSource[] = [];
    if (query.signal?.aborted) return streams;

    const mediaId = query.imdbId || query.tmdbId;
    if (!mediaId) return streams;

    const embedUrl = query.type === 'series' && query.season && query.episode
      ? `${this.baseUrl}/tv/${mediaId}/${query.season}/${query.episode}?autoplay=true`
      : `${this.baseUrl}/movie/${mediaId}?autoplay=true`;

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 2000);

      if (query.signal) {
        query.signal.addEventListener('abort', () => controller.abort(), { once: true });
      }

      const res = await fetch(embedUrl, {
        signal: controller.signal,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Referer': `${this.baseUrl}/`,
        },
      });
      clearTimeout(timeoutId);

      if (res.ok) {
        const html = await res.text();
        const m3u8Regex = /https?:\/\/[^"'\s]+\.m3u8[^"'\s]*/g;
        const matches = html.match(m3u8Regex);

        if (matches && matches.length > 0) {
          Array.from(new Set(matches)).forEach((url, idx) => {
            streams.push({
              id: `vidora-${query.imdbId}-stream-${idx}`,
              provider: 'vidora',
              name: `Vidora Stream ${idx + 1}`,
              quality: 'auto',
              url,
              format: 'hls',
              headers: {
                'Referer': `${this.baseUrl}/`,
                'Origin': this.baseUrl,
              },
              requiresProxy: true,
              priority: 85 - idx,
            });
          });
        }

        streams.push({
          id: `vidora-${query.imdbId}-embed`,
          provider: 'vidora',
          name: 'Vidora (Embed)',
          quality: 'auto',
          url: embedUrl,
          format: 'embed',
          requiresProxy: false,
          priority: 70,
        });
      }
    } catch {
      // Host unreachable or timed out; fail gracefully without hanging ProviderManager
    }

    if (query.signal?.aborted) return [];

    return streams;
  }
}

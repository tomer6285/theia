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

    const isTv = query.type === 'series' && query.season !== undefined && query.episode !== undefined;
    const embedUrl = isTv
      ? `${this.baseUrl}/tv/${mediaId}/${query.season}/${query.episode}`
      : `${this.baseUrl}/movie/${mediaId}`;

    // Direct endpoint query for clean direct player embed
    const apiEndpoint = isTv
      ? `${this.baseUrl}/api/tv/${mediaId}/${query.season}/${query.episode}`
      : `${this.baseUrl}/api/movie/${mediaId}`;

    try {
      const apiRes = await fetch(apiEndpoint, {
        headers: {
          'Referer': embedUrl,
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        },
      });

      if (apiRes.ok) {
        const data = await apiRes.json();
        if (data?.src) {
          const directEmbedUrl = data.src.startsWith('http')
            ? data.src
            : `${this.baseUrl}${data.src}`;

          // Register direct player embed (bypasses Next.js wrappers directly to JWPlayer)
          streams.push({
            id: `vixsrc-${query.imdbId}-direct-embed`,
            provider: 'vixsrc',
            name: 'VixSrc (Player)',
            quality: 'auto',
            url: directEmbedUrl,
            format: 'embed',
            headers: {
              'Referer': `${this.baseUrl}/`,
            },
            requiresProxy: false,
            priority: 85,
          });
        }
      }
    } catch (err) {
      console.warn('VixSrc API error:', err);
    }

    // Always provide standard embed fallback
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

import { fetchProviderResponse } from '../network/request';
import { IProvider, ProviderQuery, StreamSource } from '../types';

/** Read provider data literals only. Never execute scripts from an upstream page. */
export function parseVixSrcPlaylist(html: string, pageUrl: string): string | null {
  const block = html.match(/window\.masterPlaylist\s*=\s*\{([\s\S]*?)(?:<\/script>|window\.)/)?.[1];
  if (!block) return null;
  const literal = (key: string) => {
    const value = block.match(new RegExp(`(?:["']?${key}["']?)\\s*:\\s*(["'])(.*?)\\1`))?.[2];
    return value?.replace(/\\\//g, '/').replace(/\\u0026/gi, '&').replace(/&amp;/g, '&');
  };
  const path = literal('url');
  const token = literal('token');
  const expires = literal('expires');
  if (!path || !token || !expires || !Number.isFinite(Number(expires)) || Number(expires) <= Date.now() / 1000) return null;
  try {
    const url = new URL(path, pageUrl);
    if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) return null;
    for (const key of ['token', 'expires', 'asn']) {
      const value = literal(key);
      if (value) url.searchParams.set(key, value);
    }
    if (/window\.canPlayFHD\s*=\s*true/.test(html)) url.searchParams.set('h', '1');
    return url.href;
  } catch { return null; }
}

export class VixSrcProvider implements IProvider {
  name = 'VixSrc';
  id = 'vixsrc';
  priority = 90;
  private baseUrl = 'https://vixsrc.to';

  async resolveStreams(query: ProviderQuery): Promise<StreamSource[]> {
    if (query.signal?.aborted || (query.type === 'series' && (query.season === undefined || query.episode === undefined))) return [];
    const mediaId = query.tmdbId || query.imdbId;
    if (!mediaId) return [];
    const route = query.type === 'series'
      ? `tv/${encodeURIComponent(mediaId)}/${query.season}/${query.episode}`
      : `movie/${encodeURIComponent(mediaId)}`;
    const headers = { Referer: `${this.baseUrl}/` };
    try {
      // Embed tokens last only seconds. Fetch fresh data and consume it immediately;
      // the master playlist has its own longer-lived signed parameters.
      const api = new URL(`${this.baseUrl}/api/${route}`);
      api.searchParams.set('_', String(Date.now()));
      const response = await fetchProviderResponse(api.href, { headers, cache: 'no-store' }, query.signal);
      if (!response.ok) return [];
      const data = await response.json();
      if (typeof data?.src !== 'string') return [];
      const embedUrl = new URL(data.src, this.baseUrl);
      if (embedUrl.origin !== this.baseUrl) return [];
      const embed = await fetchProviderResponse(embedUrl.href, { headers, cache: 'no-store' }, query.signal);
      if (!embed.ok || query.signal?.aborted) return [];
      const playlist = parseVixSrcPlaylist(await embed.text(), embedUrl.href);
      if (playlist) return [{
        id: `vixsrc-${route}-hls`, provider: this.id, name: 'VixSrc', quality: 'auto',
        url: playlist, format: 'hls', headers, requiresProxy: true, priority: 110,
      }];
      // This provider rejects sandboxed iframes. Do not advertise an unplayable embed.
      return [];
    } catch {
      return [];
    }
  }
}

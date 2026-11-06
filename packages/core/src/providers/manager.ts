import { IProvider, ProviderQuery, StreamSource } from '../types';
import { VidLinkProvider } from './vidlink';
import { VixSrcProvider } from './vixsrc';
import { VidoraProvider } from './vidora';

export interface ProviderManagerOptions {
  providers?: IProvider[];
  timeoutMs?: number;
}

export class ProviderManager {
  private providers: Map<string, IProvider> = new Map();
  private timeoutMs: number;

  constructor(options?: ProviderManagerOptions) {
    this.timeoutMs = options?.timeoutMs ?? 10000;

    const defaultProviders = options?.providers || [
      new VidLinkProvider(),
      new VixSrcProvider(),
      new VidoraProvider(),
    ];

    defaultProviders.forEach((p) => this.registerProvider(p));
  }

  registerProvider(provider: IProvider) {
    this.providers.set(provider.id, provider);
  }

  unregisterProvider(id: string) {
    this.providers.delete(id);
  }

  getProviders(): IProvider[] {
    return Array.from(this.providers.values()).sort((a, b) => b.priority - a.priority);
  }

  /**
   * Resolves streams in parallel across all registered providers.
   * Tolerates single-provider failures and sorts results by priority and format.
   * Can be aborted via query.signal.
   */
  async resolveStreams(query: ProviderQuery): Promise<StreamSource[]> {
    if (query.signal?.aborted) {
      return [];
    }

    const activeProviders = this.getProviders();
    const results: StreamSource[] = [];

    const promises = activeProviders.map(async (provider) => {
      const controller = new AbortController();
      let timer: ReturnType<typeof setTimeout> | undefined;
      let onAbort: (() => void) | undefined;
      try {
        const cancelled = new Promise<StreamSource[]>((_, reject) => {
          onAbort = () => {
            controller.abort();
            const error = new Error('Aborted');
            error.name = 'AbortError';
            reject(error);
          };
          query.signal?.addEventListener('abort', onAbort, { once: true });
          timer = setTimeout(() => {
            controller.abort();
            reject(new Error(`Timeout resolving ${provider.name}`));
          }, this.timeoutMs);
        });
        return await Promise.race([
          provider.resolveStreams({ ...query, signal: controller.signal }),
          cancelled,
        ]);
      } catch (err: unknown) {
        if (!query.signal?.aborted) console.warn(`Provider [${provider.name}] failed:`, err);
        return [];
      } finally {
        clearTimeout(timer);
        if (onAbort) query.signal?.removeEventListener('abort', onAbort);
      }
    });

    const streamArrays = await Promise.all(promises);
    if (query.signal?.aborted) {
      return [];
    }

    const seen = new Set<string>();
    for (const arr of streamArrays) {
      if (!Array.isArray(arr)) continue;
      for (const stream of arr) {
        if (!stream || typeof stream.url !== 'string' || !['hls', 'mp4', 'embed'].includes(stream.format)) continue;
        try {
          const url = new URL(stream.url);
          if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) continue;
        } catch { continue; }
        const key = `${stream.format}:${stream.url}`;
        if (seen.has(key)) continue;
        seen.add(key);
        results.push(stream);
      }
    }

    // Sort by priority (higher first), prioritizing direct HLS/MP4 streams over embeds
    results.sort((a, b) => {
      const aTypeScore = a.format === 'hls' ? 30 : a.format === 'mp4' ? 20 : 10;
      const bTypeScore = b.format === 'hls' ? 30 : b.format === 'mp4' ? 20 : 10;
      const aTotal = (a.priority ?? 50) + aTypeScore;
      const bTotal = (b.priority ?? 50) + bTypeScore;
      return bTotal - aTotal;
    });

    return results;
  }

  /**
   * Returns the best available stream for playback.
   */
  async getBestStream(query: ProviderQuery): Promise<StreamSource | null> {
    const streams = await this.resolveStreams(query);
    return streams.length > 0 ? streams[0] : null;
  }
}

export const providerManager = new ProviderManager();

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
    this.timeoutMs = options?.timeoutMs || 5000;

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
   */
  async resolveStreams(query: ProviderQuery): Promise<StreamSource[]> {
    const activeProviders = this.getProviders();
    const results: StreamSource[] = [];

    const promises = activeProviders.map(async (provider) => {
      try {
        const streamPromise = provider.resolveStreams(query);
        const timeoutPromise = new Promise<StreamSource[]>((_, reject) =>
          setTimeout(() => reject(new Error(`Timeout resolving ${provider.name}`)), this.timeoutMs)
        );

        const streams = await Promise.race([streamPromise, timeoutPromise]);
        return streams;
      } catch (err) {
        console.warn(`Provider [${provider.name}] failed:`, err);
        return [];
      }
    });

    const streamArrays = await Promise.all(promises);
    for (const arr of streamArrays) {
      results.push(...arr);
    }

    // Sort by priority (higher first), prioritizing direct HLS/MP4 streams over embeds
    results.sort((a, b) => {
      const aTypeScore = a.format === 'hls' ? 30 : a.format === 'mp4' ? 20 : 10;
      const bTypeScore = b.format === 'hls' ? 30 : b.format === 'mp4' ? 20 : 10;
      const aTotal = (a.priority || 50) + aTypeScore;
      const bTotal = (b.priority || 50) + bTypeScore;
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

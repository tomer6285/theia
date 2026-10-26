import { MediaItem, MediaType, Episode, SeasonInfo } from '../types';

export class CinemetaClient {
  private baseUrl = 'https://v3-cinemeta.strem.io';

  /**
   * Search for movies and series by title
   */
  async search(query: string, type?: MediaType): Promise<MediaItem[]> {
    const trimmed = query.trim();
    if (!trimmed) return [];

    const typesToFetch: MediaType[] = type ? [type] : ['movie', 'series'];
    const results: MediaItem[] = [];

    await Promise.all(
      typesToFetch.map(async (t) => {
        try {
          const url = `${this.baseUrl}/catalog/${t}/top/search=${encodeURIComponent(trimmed)}.json`;
          const res = await fetch(url);
          if (!res.ok) return;
          const data = (await res.json()) as { metas?: any[] };
          if (data && Array.isArray(data.metas)) {
            for (const meta of data.metas) {
              if (meta && meta.imdb_id) {
                results.push(this.formatMetaItem(meta, t));
              }
            }
          }
        } catch (err) {
          console.error(`Error searching Cinemeta for ${t}:`, err);
        }
      })
    );

    return results;
  }

  /**
   * Get detailed metadata for a movie or TV series
   */
  async getDetails(imdbId: string, type: MediaType): Promise<MediaItem | null> {
    try {
      const url = `${this.baseUrl}/meta/${type}/${imdbId}.json`;
      const res = await fetch(url);
      if (!res.ok) return null;
      const data = (await res.json()) as { meta?: any };
      if (!data || !data.meta) return null;

      const item = this.formatMetaItem(data.meta, type);

      // If series, parse episodes and group by season
      if (type === 'series' && Array.isArray(data.meta.videos)) {
        const episodes: Episode[] = data.meta.videos.map((v: any) => ({
          id: v.id || `${imdbId}:${v.season}:${v.episode || v.number}`,
          title: v.title || v.name || `Episode ${v.episode || v.number}`,
          season: Number(v.season) || 1,
          episode: Number(v.episode ?? v.number) || 1,
          overview: v.overview || v.description,
          thumbnail: v.thumbnail,
          released: v.released || v.firstAired,
          rating: v.rating ? String(v.rating) : undefined,
        }));

        // Sort episodes by season then episode
        episodes.sort((a, b) => {
          if (a.season !== b.season) return a.season - b.season;
          return a.episode - b.episode;
        });

        item.episodes = episodes;

        // Group into seasons
        const seasonMap = new Map<number, Episode[]>();
        for (const ep of episodes) {
          const list = seasonMap.get(ep.season) || [];
          list.push(ep);
          seasonMap.set(ep.season, list);
        }

        const seasons: SeasonInfo[] = [];
        Array.from(seasonMap.entries())
          .sort(([a], [b]) => a - b)
          .forEach(([seasonNum, eps]) => {
            seasons.push({
              season: seasonNum,
              episodes: eps,
            });
          });

        item.seasons = seasons;
      }

      return item;
    } catch (err) {
      console.error(`Error fetching Cinemeta details for ${imdbId}:`, err);
      return null;
    }
  }

  /**
   * Get popular / top catalog items
   */
  async getPopular(type: MediaType = 'movie', skip = 0): Promise<MediaItem[]> {
    try {
      const url = skip > 0
        ? `${this.baseUrl}/catalog/${type}/top/skip=${skip}.json`
        : `${this.baseUrl}/catalog/${type}/top.json`;
      const res = await fetch(url);
      if (!res.ok) return [];
      const data = (await res.json()) as { metas?: any[] };
      if (data && Array.isArray(data.metas)) {
        return data.metas
          .filter((m) => m && (m.imdb_id || m.id))
          .map((m) => this.formatMetaItem(m, type));
      }
      return [];
    } catch (err) {
      console.error(`Error fetching popular ${type} items:`, err);
      return [];
    }
  }

  private formatMetaItem(meta: any, defaultType: MediaType): MediaItem {
    const rawType = meta.type === 'series' || meta.type === 'tv' ? 'series' : 'movie';
    const imdbId = meta.imdb_id || meta.id;
    return {
      id: imdbId,
      imdbId,
      tmdbId: meta.tmdb_id ? String(meta.tmdb_id) : undefined,
      type: defaultType || rawType,
      title: meta.name || meta.title || 'Untitled',
      year: meta.year ? String(meta.year) : meta.releaseInfo ? String(meta.releaseInfo) : undefined,
      poster: meta.poster,
      background: meta.background,
      description: meta.description || meta.overview,
      genres: Array.isArray(meta.genres)
        ? meta.genres
        : Array.isArray(meta.genre)
        ? meta.genre
        : meta.genre
        ? [meta.genre]
        : [],
      rating: meta.imdbRating ? String(meta.imdbRating) : undefined,
      runtime: meta.runtime ? String(meta.runtime) : undefined,
      cast: Array.isArray(meta.cast) ? meta.cast : [],
      director: Array.isArray(meta.director) ? meta.director : meta.director ? [meta.director] : [],
      writer: Array.isArray(meta.writer) ? meta.writer : meta.writer ? [meta.writer] : [],
      status: meta.status,
    };
  }
}

export const cinemeta = new CinemetaClient();

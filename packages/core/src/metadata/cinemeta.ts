import { fetchWithTimeout } from '../network/request';
import { MediaItem, MediaType, Episode, SeasonInfo } from '../types';

function normalizeTitle(title: string): string {
  return title.normalize('NFKD').replace(/\p{M}/gu, '').toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
}

function titleRelevance(title: string, query: string): number {
  const normalized = normalizeTitle(title);
  if (normalized === query) return 0;
  if (normalized.startsWith(`${query} `)) return 1;
  if (` ${normalized} `.includes(` ${query} `)) return 2;
  const words = new Set(normalized.split(' '));
  if (query.split(' ').every((word) => words.has(word))) return 3;
  return 4;
}

export class CinemetaClient {
  private baseUrl = 'https://v3-cinemeta.strem.io';

  /**
   * Search for movies and series by title
   */
  async search(query: string, type?: MediaType): Promise<MediaItem[]> {
    const trimmed = query.trim();
    if (!trimmed) return [];

    const typesToFetch: MediaType[] = type ? [type] : ['movie', 'series'];
    const groups = await Promise.all(
      typesToFetch.map(async (t) => {
        try {
          const url = `${this.baseUrl}/catalog/${t}/top/search=${encodeURIComponent(trimmed)}.json`;
          const res = await fetchWithTimeout(url, {}, undefined, 10000);
          if (!res.ok) return;
          const data = (await res.json()) as { metas?: any[] };
          if (data && Array.isArray(data.metas)) {
            return data.metas.filter((meta) => meta && (meta.imdb_id || meta.id))
              .map((meta) => this.formatMetaItem(meta, t));
          }
        } catch (err) {
          console.error(`Error searching Cinemeta for ${t}:`, err);
        }
      })
    );

    const normalizedQuery = normalizeTitle(trimmed);
    // Interleave equally relevant source results by their original rank, so neither
    // media type nor request completion time can bury the other source's top hits.
    const ranked = groups.flatMap((items) => (items ?? []).map((item, rank) => ({
      item, rank, relevance: normalizedQuery ? titleRelevance(item.title, normalizedQuery) : 4,
    })));
    ranked.sort((a, b) => a.relevance - b.relevance || a.rank - b.rank);
    const results = ranked.map(({ item }) => item);
    return Array.from(new Map(results.map((item) => [item.id, item])).values());
  }

  /**
   * Get detailed metadata for a movie or TV series
   */
  async getDetails(imdbId: string, type: MediaType): Promise<MediaItem | null> {
    try {
      const url = `${this.baseUrl}/meta/${type}/${encodeURIComponent(imdbId)}.json`;
      const res = await fetchWithTimeout(url, {}, undefined, 10000);
      if (!res.ok) return null;
      const data = (await res.json()) as { meta?: any };
      if (!data || !data.meta) return null;

      const item = this.formatMetaItem(data.meta, type);

      // If series, parse episodes and group by season
      if (type === 'series' && Array.isArray(data.meta.videos)) {
        const episodes: Episode[] = data.meta.videos.filter((v: any) => v &&
          Number.isInteger(Number(v.season ?? 1)) && Number(v.season ?? 1) >= 0 &&
          Number.isInteger(Number(v.episode ?? v.number)) && Number(v.episode ?? v.number) > 0
        ).map((v: any) => ({
          id: v.id || `${imdbId}:${v.season}:${v.episode || v.number}`,
          title: v.title || v.name || `Episode ${v.episode || v.number}`,
          season: v.season !== undefined && v.season !== null ? Number(v.season) : 1,
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

        // Group into seasons (regular seasons 1+ first, season 0/specials placed at end)
        const seasonMap = new Map<number, Episode[]>();
        for (const ep of episodes) {
          const list = seasonMap.get(ep.season) || [];
          list.push(ep);
          seasonMap.set(ep.season, list);
        }

        const regularSeasons: SeasonInfo[] = [];
        let specialsSeason: SeasonInfo | null = null;

        Array.from(seasonMap.entries())
          .sort(([a], [b]) => a - b)
          .forEach(([seasonNum, eps]) => {
            if (seasonNum === 0) {
              specialsSeason = { season: 0, episodes: eps };
            } else {
              regularSeasons.push({ season: seasonNum, episodes: eps });
            }
          });

        const seasons: SeasonInfo[] = specialsSeason
          ? [...regularSeasons, specialsSeason]
          : regularSeasons;

        item.seasons = seasons;

        // Order primary episodes list with regular seasons first (Season 1 Episode 1 as index 0)
        item.episodes = [
          ...regularSeasons.flatMap((s) => s.episodes),
          ...(specialsSeason ? (specialsSeason as SeasonInfo).episodes : []),
        ];
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
      const res = await fetchWithTimeout(url, {}, undefined, 10000);
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
    // Cinemeta uses moviedb_id for TMDb ID (fallback to tmdb_id if present)
    const rawTmdb = meta.moviedb_id ?? meta.tmdb_id ?? meta.moviedbId ?? meta.tmdbId;
    const tmdbId = rawTmdb ? String(rawTmdb) : undefined;

    return {
      id: imdbId,
      imdbId,
      tmdbId,
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

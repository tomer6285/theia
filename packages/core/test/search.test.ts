import { afterEach, expect, it, vi } from 'vitest';
import { CinemetaClient } from '../src/metadata';

afterEach(() => vi.unstubAllGlobals());

it('ranks exact TV title matches ahead of loosely matching movies', async () => {
  vi.stubGlobal('fetch', vi.fn(async (url: string) => Response.json({ metas: url.includes('/movie/') ? [
    { id: 'movie1', name: 'Flash Gordon' },
    { id: 'movie2', name: 'The Flash: A Hero' },
    { id: 'movie3', name: 'Adventures of The Flash' },
  ] : [{ id: 'show', name: 'The Flash' }] })));

  const results = await new CinemetaClient().search('  THE flash  ');
  expect(results.map((item) => item.id)).toEqual(['show', 'movie2', 'movie3', 'movie1']);
});

it('interleaves equal matches by source rank regardless of response timing', async () => {
  let finishMovies!: (response: Response) => void;
  vi.stubGlobal('fetch', vi.fn((url: string) => url.includes('/movie/')
    ? new Promise<Response>((resolve) => { finishMovies = resolve; })
    : Promise.resolve(Response.json({ metas: [
      { id: 'show1', name: 'Flash' }, { id: 'show2', name: 'Flash' },
    ] }))));
  const pending = new CinemetaClient().search('Flash');
  finishMovies(Response.json({ metas: [
    { id: 'movie1', name: 'Flash' }, { id: 'movie2', name: 'Flash' },
  ] }));
  expect((await pending).map((item) => item.id)).toEqual(['movie1', 'show1', 'movie2', 'show2']);
});

it('normalizes punctuation and accents while preserving type filters and deduplication', async () => {
  const request = vi.fn(async (_url: string) => Response.json({ metas: [
    { id: 'other', name: 'Café adventures' },
    { id: 'exact', name: 'CAFÉ—NOIR' },
    { id: 'exact', name: 'CAFÉ—NOIR' },
  ] }));
  vi.stubGlobal('fetch', request);
  const results = await new CinemetaClient().search('cafe noir', 'series');
  expect(results.map((item) => item.id)).toEqual(['exact', 'other']);
  expect(results.every((item) => item.type === 'series')).toBe(true);
  expect(request).toHaveBeenCalledTimes(1);
  expect(request.mock.calls[0]?.[0]).toContain('/series/');
});

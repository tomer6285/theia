import { expect, it } from 'vitest';
import { readEmbedProgress, supportsEmbedProgress } from '../src/embedProgress';
const episode = { id: 'show:1:2', title: 'Episode', season: 1, episode: 2 };
const message = (data: object) => ({ type: 'PLAYER_EVENT', data: { event: 'timeupdate', currentTime: 40, duration: 100, mediaType: 'tv', season: 1, episode: 2, ...data } });
it('rejects malformed events and events for another episode', () => {
  for (const data of [null, 'invalid', {}, message({ currentTime: Infinity }), message({ duration: 0 }), message({ episode: 3 }), message({ event: 'unknown' })]) {
    expect(readEmbedProgress(data, episode)).toBeNull();
  }
  expect(readEmbedProgress(message({}), episode)?.time).toBe(40);
  expect(readEmbedProgress(message({ event: 'ended', currentTime: 105 }), episode)).toMatchObject({ time: 100, ended: true });
});
it('only enables the documented provider origin', () => {
  const stream = { id: 'test', provider: 'vidlink', name: 'Test', quality: 'auto', format: 'embed' as const, url: 'https://vidlink.pro/movie/1' };
  expect(supportsEmbedProgress(stream)).toBe(true);
  expect(supportsEmbedProgress({ ...stream, url: 'https://vidlink.pro.evil.example/movie/1' })).toBe(false);
  expect(supportsEmbedProgress({ ...stream, provider: 'vidora' })).toBe(false);
});

import { describe, expect, it, vi } from 'vitest';

vi.mock('@theia/core', () => ({ trackTraktPlayback: vi.fn() }));
import { trackTraktPlayback } from '@theia/core';
import { createScrobbleSession } from '../src/scrobble';

describe('playback scrobbling', () => {
  it('reports start and unpause, then completes once despite overlapping player events', () => {
    const movie = { id: 'tt1234', type: 'movie', title: 'Example' } as const;
    const event = createScrobbleSession(movie);
    event('pause', 0, 100);
    event('playing', 0, 100);
    event('pause', 25, 100);
    event('playing', 25, 100);
    event('progress', 80, 100);
    event('progress', 81, 100);
    event('end', 100, 100);
    event('stop', 100, 100);
    expect(vi.mocked(trackTraktPlayback).mock.calls.map(([action, , , progress]) => [action, progress])).toEqual([
      ['start', 0], ['pause', 25], ['start', 25], ['stop', 81],
    ]);
  });
});

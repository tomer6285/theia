import { expect, it } from 'vitest';
import { isPlaybackCompleted as completed } from '../src/completion';

it('requires both percentage and remaining time with separate movie and episode limits', () => {
  expect(completed(10000, 10800, false, false)).toBe(false);
  expect(completed(10500, 10800, false, false)).toBe(true);
  expect(completed(2700, 3000, false, true)).toBe(false);
  expect(completed(2910, 3000, false, true)).toBe(true);
  expect(completed(700, 1000, false, false)).toBe(false);
  expect(completed(950, 1000, false, true, undefined, { minimumPercentage: 99 })).toBe(false);
});
it('uses valid credits timing instead of the fallback', () => {
  expect(completed(2400, 3000, false, true, 2400)).toBe(true);
  expect(completed(2950, 3000, false, true, 2980)).toBe(false);
  for (const invalid of [NaN, Infinity, -1, 0, 3001]) {
    expect(completed(2950, 3000, false, true, invalid)).toBe(true);
  }
});
it('handles ended playback and rejects invalid timelines', () => {
  expect(completed(800, 1000, true, false)).toBe(true);
  expect(completed(0, 1000, false, false)).toBe(false);
  expect(completed(20, Infinity, false, false)).toBe(false);
  expect(completed(NaN, 1000, false, false)).toBe(false);
});

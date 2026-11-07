import { expect, it } from 'vitest';
import { preferredSubtitleIndex, SubtitleTiming } from '../src/subtitles';

it('matches ISO language tags and prefers full captions over provider forced defaults', () => {
  expect(preferredSubtitleIndex([
    { language: 'ita', label: 'Italian', isDefault: true },
    { language: 'eng', label: 'English forced', forced: true, isDefault: true },
    { language: 'eng', label: 'English [CC]' },
  ], ['en-US'])).toBe(2);
  expect(preferredSubtitleIndex([{ language: 'fra', label: 'French' }], ['fr'])).toBe(0);
  expect(preferredSubtitleIndex([{ language: 'English', label: 'English [CC]' }], ['en'])).toBe(0);
  expect(preferredSubtitleIndex([{ language: '', label: 'English [CC]' }], ['en'])).toBe(0);
  expect(preferredSubtitleIndex([{ language: 'en', label: 'English' }], [])).toBe(-1);
});

it('applies timing changes once and includes cues loaded after playback starts', () => {
  const cue = { startTime: 10, endTime: 12 } as TextTrackCue;
  const cues = [cue];
  const track = { kind: 'subtitles', cues } as unknown as TextTrack;
  const timing = new SubtitleTiming();
  timing.apply([track], 500);
  timing.apply([track], 500);
  expect([cue.startTime, cue.endTime]).toEqual([10.5, 12.5]);
  cues.push({ startTime: 20, endTime: 22 } as TextTrackCue);
  timing.apply([track], -1000);
  expect(cues.map((cue) => [cue.startTime, cue.endTime])).toEqual([[9, 11], [19, 21]]);
  timing.apply([track], 0);
  expect(cues.map((cue) => [cue.startTime, cue.endTime])).toEqual([[10, 12], [20, 22]]);
});

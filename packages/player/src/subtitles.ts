import { preferredTrackIndex } from './languages';

export type SubtitleOption = {
  language: string;
  label: string;
  forced?: boolean;
  isDefault?: boolean;
};

/** Prefer a full track over forced-only captions in the requested language. */
export function preferredSubtitleIndex(tracks: SubtitleOption[], languages: string[]): number {
  for (const language of languages) {
    const matching = tracks.map((track, index) => ({ track, index }))
      .filter(({ track }) => preferredTrackIndex([{ lang: track.language || track.label }], [language]) === 0)
      .sort((a, b) => Number(Boolean(a.track.forced)) - Number(Boolean(b.track.forced))
        || Number(!a.track.isDefault) - Number(!b.track.isDefault));
    if (matching.length) return matching[0].index;
  }
  return -1;
}

/** Keep original times so adjustments never accumulate, including streamed cues. */
export class SubtitleTiming {
  private originals = new WeakMap<TextTrackCue, { start: number; end: number }>();

  apply(tracks: Iterable<TextTrack>, offsetMs: number): void {
    const offset = Number.isFinite(offsetMs) ? offsetMs / 1000 : 0;
    for (const track of tracks) {
      if (track.kind !== 'subtitles' && track.kind !== 'captions') continue;
      for (const cue of Array.from(track.cues || [])) {
        let original = this.originals.get(cue);
        if (!original) {
          original = { start: cue.startTime, end: cue.endTime };
          this.originals.set(cue, original);
        }
        const start = Math.max(0, original.start + offset);
        const end = Math.max(0, original.end + offset);
        if (cue.startTime !== start || cue.endTime !== end) {
          // Assign in a valid order when moving a cue past its current end/start.
          if (start >= cue.endTime) { cue.endTime = end; cue.startTime = start; }
          else { cue.startTime = start; cue.endTime = end; }
        }
      }
    }
  }
}

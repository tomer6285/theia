export interface SubtitleCue {
  id?: string;
  start: number; // in seconds
  end: number;   // in seconds
  text: string;
  settings?: string;
}

/**
 * Parses timestamp string "00:01:23.456" or "00:01:23,456" into seconds
 */
export function parseSubtitleTimestamp(ts: string): number {
  const match = ts.trim().match(/^(?:(\d+):)?(\d{2}):(\d{2}(?:[.,]\d{1,3})?)$/);
  if (!match) return 0;
  const hours = Number(match[1] || 0);
  const minutes = Number(match[2]);
  const seconds = Number(match[3].replace(',', '.'));
  return minutes < 60 && seconds < 60 ? hours * 3600 + minutes * 60 + seconds : 0;
}

/**
 * Formats seconds into WebVTT timestamp "00:00:00.000"
 */
export function formatSubtitleTimestamp(seconds: number): string {
  const millis = Math.round(Math.max(0, Number.isFinite(seconds) ? seconds : 0) * 1000);
  const pad = (n: number, size = 2) => String(n).padStart(size, '0');
  return `${pad(Math.floor(millis / 3600000))}:${pad(Math.floor(millis / 60000) % 60)}:${pad(Math.floor(millis / 1000) % 60)}.${pad(millis % 1000, 3)}`;
}

/**
 * Parses raw WebVTT or SRT text into an array of SubtitleCue
 */
export function parseSubtitles(content: string): SubtitleCue[] {
  const cues: SubtitleCue[] = [];
  const lines = content.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n');

  let currentCue: Partial<SubtitleCue> | null = null;
  const timeRegex = /^((?:\d+:)?\d{2}:\d{2}[.,]\d{3})\s*-->\s*((?:\d+:)?\d{2}:\d{2}[.,]\d{3})(.*)$/;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();

    if (!line) {
      if (currentCue && currentCue.start !== undefined && currentCue.end !== undefined && currentCue.text) {
        cues.push(currentCue as SubtitleCue);
      }
      currentCue = null;
      continue;
    }

    const match = line.match(timeRegex);
    if (match) {
      if (currentCue?.text && currentCue.start !== undefined && currentCue.end !== undefined) {
        cues.push(currentCue as SubtitleCue);
      }
      currentCue = {
        start: parseSubtitleTimestamp(match[1]),
        end: parseSubtitleTimestamp(match[2]),
        text: '',
        ...(match[3].trim() ? { settings: match[3].trim() } : {}),
      };
      continue;
    }

    if (currentCue) {
      currentCue.text = currentCue.text ? `${currentCue.text}\n${line}` : line;
    }
  }

  if (currentCue && currentCue.start !== undefined && currentCue.end !== undefined && currentCue.text) {
    cues.push(currentCue as SubtitleCue);
  }

  return cues;
}

/**
 * Adjusts all cue timestamps by offsetMs and re-serializes as WebVTT
 */
export function offsetSubtitlesVTT(content: string, offsetMs: number): string {
  const cues = parseSubtitles(content);
  const offsetSec = Number.isFinite(offsetMs) ? offsetMs / 1000 : 0;

  let vtt = 'WEBVTT\n\n';
  cues.forEach((cue, idx) => {
    const newStart = Math.max(0, cue.start + offsetSec);
    const newEnd = Math.max(0, cue.end + offsetSec);
    if (newEnd <= newStart) return;
    vtt += `${idx + 1}\n`;
    vtt += `${formatSubtitleTimestamp(newStart)} --> ${formatSubtitleTimestamp(newEnd)}${cue.settings ? ` ${cue.settings}` : ''}\n`;
    vtt += `${cue.text}\n\n`;
  });

  return vtt;
}

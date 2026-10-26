export interface SubtitleCue {
  id?: string;
  start: number; // in seconds
  end: number;   // in seconds
  text: string;
}

/**
 * Parses timestamp string "00:01:23.456" or "00:01:23,456" into seconds
 */
export function parseSubtitleTimestamp(ts: string): number {
  const normalized = ts.trim().replace(',', '.');
  const parts = normalized.split(':');
  if (parts.length === 3) {
    const hours = parseFloat(parts[0]);
    const minutes = parseFloat(parts[1]);
    const seconds = parseFloat(parts[2]);
    return hours * 3600 + minutes * 60 + seconds;
  } else if (parts.length === 2) {
    const minutes = parseFloat(parts[0]);
    const seconds = parseFloat(parts[1]);
    return minutes * 60 + seconds;
  }
  return 0;
}

/**
 * Formats seconds into WebVTT timestamp "00:00:00.000"
 */
export function formatSubtitleTimestamp(seconds: number): string {
  const validSec = Math.max(0, seconds);
  const hrs = Math.floor(validSec / 3600);
  const mins = Math.floor((validSec % 3600) / 60);
  const secs = (validSec % 60).toFixed(3);

  const pad = (n: number, size = 2) => String(n).padStart(size, '0');
  const [s, ms] = secs.split('.');
  return `${pad(hrs)}:${pad(mins)}:${pad(Number(s))}.${pad(Number(ms), 3)}`;
}

/**
 * Parses raw WebVTT or SRT text into an array of SubtitleCue
 */
export function parseSubtitles(content: string): SubtitleCue[] {
  const cues: SubtitleCue[] = [];
  const lines = content.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n');

  let currentCue: Partial<SubtitleCue> | null = null;
  const timeRegex = /((?:\d{1,2}:)?\d{2}:\d{2}[.,]\d{3})\s*-->\s*((?:\d{1,2}:)?\d{2}:\d{2}[.,]\d{3})/;

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
      currentCue = {
        start: parseSubtitleTimestamp(match[1]),
        end: parseSubtitleTimestamp(match[2]),
        text: '',
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
  const offsetSec = offsetMs / 1000;

  let vtt = 'WEBVTT\n\n';
  cues.forEach((cue, idx) => {
    const newStart = Math.max(0, cue.start + offsetSec);
    const newEnd = Math.max(0, cue.end + offsetSec);
    vtt += `${idx + 1}\n`;
    vtt += `${formatSubtitleTimestamp(newStart)} --> ${formatSubtitleTimestamp(newEnd)}\n`;
    vtt += `${cue.text}\n\n`;
  });

  return vtt;
}
